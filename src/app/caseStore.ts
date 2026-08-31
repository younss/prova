// Shared, in-memory application state (spec §4: "l'état est unique et partagé entre toutes les
// vues"). Orchestrates the engine (state machine + clock), the audit trail, and synthetic
// assignment for the one embedded water-damage scenario — plain TypeScript, no React, so it's
// testable the same way as the engine/audit/synthetic modules. src/views/ binds to it via
// subscribe()/getSnapshot() (React's useSyncExternalStore contract).
import {
  createCase,
  getAvailableTransitions,
  updateContext,
  type CaseState,
} from '../engine/stateMachine';
import { createSimulatedClock, type ClockSpeed } from '../engine/clock';
import { createAuditLog, type AuditEntry, type AuditLog } from '../audit/auditLog';
import { applyTransitionWithAudit, attemptSupervisorApproval } from '../audit/caseAuditTrail';
import type { FourEyesCheckResult } from '../audit/caseAuditTrail';
import { createWaterDamageScenario, type WaterDamageCaseContext } from '../scenarios/waterDamage';
import type { ScenarioStep } from '../scenarios/types';
import { createSeededRandom, type RandomSource } from '../synthetic/random';
import { assignComplexityScore, assignCoverageValidity } from '../synthetic/assessCase';
import { generateSyntheticCase } from '../synthetic/generateCase';

export type Role = 'client' | 'analyst' | 'supervisor';

/** Steps at which the given role has an action to take (spec §4's per-role queues). */
const QUEUE_STEP_IDS_BY_ROLE: Record<Role, readonly string[]> = {
  client: [],
  analyst: ['evaluation', 'settlement-proposal', 'external-expertise'],
  supervisor: ['supervisor-approval'],
};

export interface DeclareCaseInput {
  readonly fullName: string;
  readonly address: string;
  readonly incidentDate: string;
  readonly description: string;
  readonly claimedAmountDollars: number;
}

export interface CaseRecord {
  readonly id: string;
  readonly claimant: { readonly fullName: string; readonly address: string };
  readonly incidentDate: string;
  readonly description: string;
  readonly claimedAmountDollars: number;
  /** Set once a settlement is proposed — the identity the four-eyes check compares against. */
  readonly proposedByUserId?: string;
  readonly state: CaseState<WaterDamageCaseContext>;
}

export interface ClockSnapshot {
  readonly now: number;
  readonly isPlaying: boolean;
  readonly speed: ClockSpeed;
}

export interface CaseStoreSnapshot {
  readonly cases: readonly CaseRecord[];
  readonly auditEntries: readonly AuditEntry[];
  readonly clock: ClockSnapshot;
}

export interface CaseStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CaseStoreSnapshot;
  getCase(caseId: string): CaseRecord | undefined;
  getQueueForRole(role: Role): readonly CaseRecord[];
  getAuditLog(): AuditLog;
  getScenarioSteps(): readonly ScenarioStep[];
  declareCase(input: DeclareCaseInput): CaseRecord;
  completeEvaluation(caseId: string, actor: string): void;
  proposeSettlement(caseId: string, proposedAmountDollars: number, actor: string): void;
  approveSupervisor(caseId: string, approverUserId: string): FourEyesCheckResult;
  refuseSupervisor(caseId: string, approverUserId: string, comment: string): void;
  /** Generates a synthetic case (spec §5.2's "Nouveau dossier" facilitator button). */
  generateNewCase(): CaseRecord;
  playClock(): void;
  pauseClock(): void;
  setClockSpeed(speed: ClockSpeed): void;
  /** Jumps straight to the next scheduled event (e.g. a pending expertise return). */
  advanceToNextEvent(): void;
  /** Advances simulated time by `realDeltaMs * current speed`, only while playing. Called by a
   *  real-time driver (a React effect, not this module) to pace the clock during "Lecture". */
  tick(realDeltaMs: number): void;
}

export interface CaseStoreOptions {
  /** Injectable for deterministic tests; defaults to a source seeded from the current time. */
  readonly random?: RandomSource;
}

function findStep(steps: readonly ScenarioStep[], stepId: string): ScenarioStep {
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    throw new Error(`Unknown step "${stepId}" in scenario.`);
  }
  return step;
}

export function createCaseStore(options: CaseStoreOptions = {}): CaseStore {
  const clock = createSimulatedClock();
  const auditLog = createAuditLog();
  const scenario = createWaterDamageScenario();
  const random = options.random ?? createSeededRandom(Date.now());

  let cases: CaseRecord[] = [];
  let nextCaseNumber = 1;
  const listeners = new Set<() => void>();
  let snapshot: CaseStoreSnapshot = {
    cases: [],
    auditEntries: [],
    clock: { now: clock.now(), isPlaying: clock.isPlaying(), speed: clock.speed() },
  };

  function publish(): void {
    snapshot = {
      cases: [...cases],
      auditEntries: auditLog.allEntries(),
      clock: { now: clock.now(), isPlaying: clock.isPlaying(), speed: clock.speed() },
    };
    for (const listener of listeners) {
      listener();
    }
  }

  function requireCase(caseId: string): CaseRecord {
    const record = cases.find((candidate) => candidate.id === caseId);
    if (!record) {
      throw new Error(`Unknown case "${caseId}".`);
    }
    return record;
  }

  function replaceCase(caseId: string, updater: (record: CaseRecord) => CaseRecord): void {
    cases = cases.map((record) => (record.id === caseId ? updater(record) : record));
    publish();
  }

  /**
   * When a case reaches a third-party-async step (external-expertise), schedules its return on
   * the simulated clock (spec AC2: "revient automatiquement après ~3 jours simulés, sans action
   * humaine") instead of resolving it synchronously — real elapsed simulated time must pass,
   * driven by playClock()/tick() or advanceToNextEvent().
   */
  function scheduleThirdPartyResolution(step: ScenarioStep, caseId: string): void {
    const dueAt = clock.now() + step.simulatedDurationMs;
    clock.schedule({ id: `${step.id}-${caseId}`, dueAt }, () => {
      const record = requireCase(caseId);
      const [transition] = getAvailableTransitions(scenario, record.state);
      if (!transition) {
        return;
      }
      let nextState = applyTransitionWithAudit(auditLog, scenario, record.state, transition.id, {
        caseId,
        actor: step.actorRole,
        justification: `${step.label} terminée.`,
        simulatedTimestampMs: clock.now(),
      });
      nextState = autoAdvance(nextState, caseId);
      replaceCase(caseId, (current) => ({ ...current, state: nextState }));
    });
  }

  /**
   * Repeatedly assigns and fires automated steps (spec §3's "automatisé" actor type) until the
   * case reaches a step that waits on a human, or schedules a third-party-async step's return
   * on the clock (spec AC2).
   */
  function autoAdvance(
    initialState: CaseState<WaterDamageCaseContext>,
    caseId: string,
  ): CaseState<WaterDamageCaseContext> {
    let state = initialState;
    for (;;) {
      const step = findStep(scenario.steps, state.stepId);
      if (step.actorType === 'third-party-async') {
        scheduleThirdPartyResolution(step, caseId);
        return state;
      }
      if (step.actorType !== 'automated') {
        return state;
      }

      if (state.stepId === 'triage') {
        state = updateContext(state, { complexityScore: assignComplexityScore(random) });
      } else if (state.stepId === 'coverage-check') {
        state = updateContext(state, { coverageValid: assignCoverageValidity(random) });
      }

      clock.advance(step.simulatedDurationMs);
      const [transition] = getAvailableTransitions(scenario, state);
      if (!transition) {
        return state; // terminal automated step (payment, rejected) — nothing left to fire
      }

      state = applyTransitionWithAudit(auditLog, scenario, state, transition.id, {
        caseId,
        actor: step.actorRole,
        justification: `${step.label} effectué automatiquement.`,
        simulatedTimestampMs: clock.now(),
      });
    }
  }

  function declareCase(input: DeclareCaseInput): CaseRecord {
    const id = `SIN-${String(nextCaseNumber).padStart(4, '0')}`;
    nextCaseNumber += 1;

    // Placeholder values: overwritten by autoAdvance() before any guard reads them, since the
    // submit-declaration -> triage transition below is unguarded.
    let state = createCase(scenario, {
      coverageValid: false,
      complexityScore: 0,
      proposedAmountDollars: 0,
    });
    state = applyTransitionWithAudit(auditLog, scenario, state, 'submit-declaration', {
      caseId: id,
      actor: input.fullName,
      justification: 'Déclaration soumise via le formulaire.',
      simulatedTimestampMs: clock.now(),
    });
    state = autoAdvance(state, id);

    const record: CaseRecord = {
      id,
      claimant: { fullName: input.fullName, address: input.address },
      incidentDate: input.incidentDate,
      description: input.description,
      claimedAmountDollars: input.claimedAmountDollars,
      state,
    };
    cases = [...cases, record];
    publish();
    return record;
  }

  function completeEvaluation(caseId: string, actor: string): void {
    const record = requireCase(caseId);
    const [transition] = getAvailableTransitions(scenario, record.state);
    if (!transition) {
      throw new Error(
        `Case "${caseId}" has no available transition from "${record.state.stepId}".`,
      );
    }
    let state = applyTransitionWithAudit(auditLog, scenario, record.state, transition.id, {
      caseId,
      actor,
      justification: "Évaluation terminée par l'analyste.",
      simulatedTimestampMs: clock.now(),
    });
    state = autoAdvance(state, caseId);
    replaceCase(caseId, (current) => ({ ...current, state }));
  }

  function proposeSettlement(caseId: string, proposedAmountDollars: number, actor: string): void {
    const record = requireCase(caseId);
    const withAmount = updateContext(record.state, { proposedAmountDollars });
    const [transition] = getAvailableTransitions(scenario, withAmount);
    if (!transition) {
      throw new Error(`Case "${caseId}" has no available transition from "${withAmount.stepId}".`);
    }
    let state = applyTransitionWithAudit(auditLog, scenario, withAmount, transition.id, {
      caseId,
      actor,
      justification: `Montant proposé : ${proposedAmountDollars} $ par ${actor}.`,
      simulatedTimestampMs: clock.now(),
    });
    state = autoAdvance(state, caseId);
    replaceCase(caseId, (current) => ({ ...current, state, proposedByUserId: actor }));
  }

  function approveSupervisor(caseId: string, approverUserId: string): FourEyesCheckResult {
    const record = requireCase(caseId);
    if (!record.proposedByUserId) {
      throw new Error(`Case "${caseId}" has no proposing analyst on record yet.`);
    }
    const outcome = attemptSupervisorApproval(
      auditLog,
      scenario,
      record.state,
      'supervisor-approves',
      {
        caseId,
        analystUserId: record.proposedByUserId,
        approverUserId,
        simulatedTimestampMs: clock.now(),
      },
    );
    const state = autoAdvance(outcome.state, caseId);
    replaceCase(caseId, (current) => ({ ...current, state }));
    return outcome.result;
  }

  function refuseSupervisor(caseId: string, approverUserId: string, comment: string): void {
    if (comment.trim().length === 0) {
      throw new Error('Un commentaire est obligatoire pour refuser une proposition (spec §4).');
    }
    const record = requireCase(caseId);
    const state = applyTransitionWithAudit(auditLog, scenario, record.state, 'supervisor-refuses', {
      caseId,
      actor: approverUserId,
      justification: comment,
      simulatedTimestampMs: clock.now(),
    });
    replaceCase(caseId, (current) => ({ ...current, state, proposedByUserId: undefined }));
  }

  function getQueueForRole(role: Role): readonly CaseRecord[] {
    const stepIds = QUEUE_STEP_IDS_BY_ROLE[role];
    return cases.filter((record) => stepIds.includes(record.state.stepId));
  }

  function generateNewCase(): CaseRecord {
    const generated = generateSyntheticCase(random);
    return declareCase({
      fullName: generated.claimant.fullName,
      address: generated.claimant.address,
      incidentDate: 'Générée par l’animateur',
      description: generated.description,
      claimedAmountDollars: generated.claimedAmountDollars,
    });
  }

  function playClock(): void {
    clock.play();
    publish();
  }

  function pauseClock(): void {
    clock.pause();
    publish();
  }

  function setClockSpeed(speed: ClockSpeed): void {
    clock.setSpeed(speed);
    publish();
  }

  function advanceToNextEvent(): void {
    clock.advanceToNextEvent();
    publish();
  }

  function tick(realDeltaMs: number): void {
    if (!clock.isPlaying()) {
      return;
    }
    clock.advance(realDeltaMs * clock.speed());
    publish();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getCase: (caseId) => cases.find((record) => record.id === caseId),
    getQueueForRole,
    getAuditLog: () => auditLog,
    getScenarioSteps: () => scenario.steps,
    declareCase,
    completeEvaluation,
    proposeSettlement,
    approveSupervisor,
    refuseSupervisor,
    generateNewCase,
    playClock,
    pauseClock,
    setClockSpeed,
    advanceToNextEvent,
    tick,
  };
}
