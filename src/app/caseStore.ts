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
import {
  createWaterDamageScenario,
  EXPERT_NON_RESPONSE_TIMEOUT_MS,
  VOLUME_SPIKE_CASE_COUNT,
  type WaterDamageCaseContext,
} from '../scenarios/waterDamage';
import type { ScenarioException, ScenarioStep } from '../scenarios/types';
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

/**
 * Control Tower KPIs (spec §5.5). All averages/rates are `undefined` until at least one case has
 * closed (AC5) — showing 0 would misleadingly imply a real (zero) result rather than "no data
 * yet". Rates are 0..1. Rework counts a case that either was refused by a supervisor (a "renvoi")
 * or was sent through the E2 retouche loop, per spec §5.5's "dossiers ayant subi E2 ou un renvoi".
 */
export interface ControlTowerKpis {
  readonly closedCaseCount: number;
  readonly averageCycleTimeMs: number | undefined;
  readonly averageHandoffsPerCase: number | undefined;
  readonly reworkRate: number | undefined;
  readonly doubleSignatureRate: number | undefined;
  readonly loadByRole: { readonly analyst: number; readonly supervisor: number };
}

export interface CaseStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CaseStoreSnapshot;
  getCase(caseId: string): CaseRecord | undefined;
  getQueueForRole(role: Role): readonly CaseRecord[];
  getAuditLog(): AuditLog;
  getScenarioSteps(): readonly ScenarioStep[];
  getScenarioExceptions(): readonly ScenarioException[];
  getKpis(): ControlTowerKpis;
  declareCase(input: DeclareCaseInput): CaseRecord;
  completeEvaluation(caseId: string, actor: string): void;
  proposeSettlement(caseId: string, proposedAmountDollars: number, actor: string): void;
  approveSupervisor(caseId: string, approverUserId: string): FourEyesCheckResult;
  refuseSupervisor(caseId: string, approverUserId: string, comment: string): void;
  /**
   * Resolves a case escalated by E1 (no proposing analyst on record — see injectExceptionE1):
   * the supervisor sets the amount and approves in one manual decision. No four-eyes check
   * applies — there is no analyst identity to separate from (spec §5.4/§5.6, docs/plan.md item E).
   */
  resolveEscalation(caseId: string, proposedAmountDollars: number, approverUserId: string): void;
  /** The client resubmits after an E2 retouche loop (spec §5.4, docs/plan.md item F). */
  resubmitDocuments(caseId: string): void;
  /** E1 (spec §3, §5.4): targets a case waiting on external expertise. */
  injectExceptionE1(caseId: string, actor: string): void;
  /** E2 (spec §3, §5.4): targets a case under analyst evaluation. */
  injectExceptionE2(caseId: string, actor: string): void;
  /** E3 (spec §3, §5.4): global — generates VOLUME_SPIKE_CASE_COUNT synthetic cases at once. */
  injectExceptionE3(): readonly CaseRecord[];
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
   * Lets a caller override an automated draw (currently only E3's coverage-valid guarantee —
   * see injectExceptionE3) instead of leaving it to the synthetic random source. Complexity is
   * never overridden: AC4 only promises the 8 cases reach the analyst's queue, and both
   * evaluation and external-expertise count as that queue (QUEUE_STEP_IDS_BY_ROLE).
   */
  interface AutoAdvanceOverrides {
    readonly forceCoverageValid?: boolean;
  }

  /**
   * Repeatedly assigns and fires automated steps (spec §3's "automatisé" actor type) until the
   * case reaches a step that waits on a human, or schedules a third-party-async step's return
   * on the clock (spec AC2).
   */
  function autoAdvance(
    initialState: CaseState<WaterDamageCaseContext>,
    caseId: string,
    overrides: AutoAdvanceOverrides = {},
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
        const coverageValid = overrides.forceCoverageValid ?? assignCoverageValidity(random);
        state = updateContext(state, { coverageValid });
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

  /**
   * Advances the clock by the CURRENT step's declared simulated duration (spec §3's "durée
   * simulée" column applies to human steps too, not just automated ones) — without this, a
   * case's cycle time would only ever reflect automated/third-party waits, never the work a
   * human step is declared to take, making the Control Tower's cycle-time KPI incoherent (AC5).
   */
  function advanceClockForStep(stepId: string): void {
    clock.advance(findStep(scenario.steps, stepId).simulatedDurationMs);
  }

  /**
   * Submits (or resubmits, after an E2 retouche loop) a "declaration" step and auto-advances —
   * the shared core of declareCase() and resubmitDocuments(), since spec §5.4's E2 effect is
   * defined as "re-enters at step 1", i.e. the exact same path a brand-new case takes.
   */
  function submitDeclarationAndAutoAdvance(
    state: CaseState<WaterDamageCaseContext>,
    caseId: string,
    actor: string,
    justification: string,
    overrides: AutoAdvanceOverrides = {},
  ): CaseState<WaterDamageCaseContext> {
    advanceClockForStep('declaration');
    const submitted = applyTransitionWithAudit(auditLog, scenario, state, 'submit-declaration', {
      caseId,
      actor,
      justification,
      simulatedTimestampMs: clock.now(),
    });
    return autoAdvance(submitted, caseId, overrides);
  }

  function declareCase(input: DeclareCaseInput, overrides: AutoAdvanceOverrides = {}): CaseRecord {
    const id = `SIN-${String(nextCaseNumber).padStart(4, '0')}`;
    nextCaseNumber += 1;

    // Placeholder values: overwritten by autoAdvance() before any guard reads them, since the
    // submit-declaration -> triage transition below is unguarded.
    const initialState = createCase(scenario, {
      coverageValid: false,
      complexityScore: 0,
      proposedAmountDollars: 0,
    });
    const state = submitDeclarationAndAutoAdvance(
      initialState,
      id,
      input.fullName,
      'Déclaration soumise via le formulaire.',
      overrides,
    );

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
    advanceClockForStep(record.state.stepId);
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
    advanceClockForStep(record.state.stepId);
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
    advanceClockForStep(record.state.stepId);
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
    advanceClockForStep(record.state.stepId);
    const state = applyTransitionWithAudit(auditLog, scenario, record.state, 'supervisor-refuses', {
      caseId,
      actor: approverUserId,
      justification: comment,
      simulatedTimestampMs: clock.now(),
    });
    replaceCase(caseId, (current) => ({ ...current, state, proposedByUserId: undefined }));
  }

  /**
   * Resolves a case escalated by injectExceptionE1(): it arrives at supervisor-approval with no
   * proposedByUserId, since no analyst ever proposed an amount (docs/plan.md item E — the
   * escalation bypasses steps 5/6 entirely). The supervisor sets the amount and approves in one
   * manual decision; the normal four-eyes check (checkFourEyesSeparation) does not apply here,
   * since there is no analyst identity to separate the approver from.
   */
  function resolveEscalation(
    caseId: string,
    proposedAmountDollars: number,
    approverUserId: string,
  ): void {
    const record = requireCase(caseId);
    if (record.state.stepId !== 'supervisor-approval' || record.proposedByUserId) {
      throw new Error(
        `Case "${caseId}" is not an E1-escalated case awaiting a manual supervisor decision.`,
      );
    }
    advanceClockForStep(record.state.stepId);
    const withAmount = updateContext(record.state, { proposedAmountDollars });
    const transitioned = applyTransitionWithAudit(
      auditLog,
      scenario,
      withAmount,
      'supervisor-approves',
      {
        caseId,
        actor: approverUserId,
        justification:
          `Décision manuelle du superviseur suite à l'escalade E1 — montant fixé à ` +
          `${proposedAmountDollars} $ par ${approverUserId} (aucun contrôle quatre yeux ` +
          "applicable : aucun analyste n'a proposé ce dossier).",
        simulatedTimestampMs: clock.now(),
      },
    );
    const state = autoAdvance(transitioned, caseId);
    replaceCase(caseId, (current) => ({ ...current, state, proposedByUserId: approverUserId }));
  }

  /** The client resubmits after an E2 retouche loop (spec §5.4, docs/plan.md item F). */
  function resubmitDocuments(caseId: string): void {
    const record = requireCase(caseId);
    if (record.state.stepId !== 'waiting-on-client') {
      throw new Error(
        `Case "${caseId}" is not waiting on the client (currently at "${record.state.stepId}").`,
      );
    }
    const actor = record.claimant.fullName;
    const backAtDeclaration = applyTransitionWithAudit(
      auditLog,
      scenario,
      record.state,
      'client-resubmits',
      {
        caseId,
        actor,
        justification: 'Documents corrigés renvoyés par le client.',
        simulatedTimestampMs: clock.now(),
      },
    );
    const state = submitDeclarationAndAutoAdvance(
      backAtDeclaration,
      caseId,
      actor,
      'Nouvelle déclaration soumise après correction des documents.',
    );
    replaceCase(caseId, (current) => ({ ...current, state }));
  }

  /**
   * E1 (spec §3, §5.4): the expert doesn't respond within the simulated timeout — cancels the
   * pending normal auto-resolution (scheduleThirdPartyResolution) so it can't fire later on a
   * case that has since moved on, advances the shared clock by the timeout (spec's "5 jours
   * simulés"), then escalates straight to the supervisor (docs/plan.md item E).
   */
  function injectExceptionE1(caseId: string, actor: string): void {
    const record = requireCase(caseId);
    if (record.state.stepId !== 'external-expertise') {
      throw new Error(
        `E1 ne peut cibler qu'un dossier en attente d'expertise externe (dossier "${caseId}" ` +
          `est à l'étape "${record.state.stepId}").`,
      );
    }
    clock.cancel(`external-expertise-${caseId}`);
    clock.advance(EXPERT_NON_RESPONSE_TIMEOUT_MS);
    const currentState = requireCase(caseId).state;
    const transitioned = applyTransitionWithAudit(
      auditLog,
      scenario,
      currentState,
      'exception-e1-escalation',
      {
        caseId,
        actor,
        justification:
          "L'expert externe n'a pas répondu dans le délai simulé de 5 jours — escalade " +
          'automatique vers le superviseur (E1).',
        simulatedTimestampMs: clock.now(),
      },
    );
    const state = autoAdvance(transitioned, caseId);
    replaceCase(caseId, (current) => ({ ...current, state }));
  }

  /** E2 (spec §3, §5.4): targets a case under analyst evaluation (docs/plan.md item F). */
  function injectExceptionE2(caseId: string, actor: string): void {
    const record = requireCase(caseId);
    if (record.state.stepId !== 'evaluation') {
      throw new Error(
        `E2 ne peut cibler qu'un dossier en cours d'évaluation (dossier "${caseId}" est à ` +
          `l'étape "${record.state.stepId}").`,
      );
    }
    const state = applyTransitionWithAudit(
      auditLog,
      scenario,
      record.state,
      'exception-e2-retouche',
      {
        caseId,
        actor,
        justification: 'Documents illisibles — retour au client pour correction (E2).',
        simulatedTimestampMs: clock.now(),
      },
    );
    replaceCase(caseId, (current) => ({ ...current, state }));
  }

  /**
   * E3 (spec §3, §5.4): global — spawns VOLUME_SPIKE_CASE_COUNT synthetic cases via the normal
   * step-1 path (docs/plan.md item G). Coverage is forced valid so all of them clear
   * coverage-check: AC4 promises "8 dossiers dans la file de l'analyste", and a random coverage
   * draw could otherwise auto-reject a few before they ever reach the queue. Complexity stays
   * random — both evaluation and external-expertise count as the analyst's queue either way.
   */
  function injectExceptionE3(): readonly CaseRecord[] {
    return Array.from({ length: VOLUME_SPIKE_CASE_COUNT }, () =>
      generateNewCase({ forceCoverageValid: true }),
    );
  }

  function getQueueForRole(role: Role): readonly CaseRecord[] {
    const stepIds = QUEUE_STEP_IDS_BY_ROLE[role];
    return cases.filter((record) => stepIds.includes(record.state.stepId));
  }

  function isCaseClosed(record: CaseRecord): boolean {
    return getAvailableTransitions(scenario, record.state).length === 0;
  }

  function getKpis(): ControlTowerKpis {
    const loadByRole = {
      analyst: getQueueForRole('analyst').length,
      supervisor: getQueueForRole('supervisor').length,
    };
    const closedCases = cases.filter(isCaseClosed);
    const closedCaseCount = closedCases.length;

    if (closedCaseCount === 0) {
      return {
        closedCaseCount,
        averageCycleTimeMs: undefined,
        averageHandoffsPerCase: undefined,
        reworkRate: undefined,
        doubleSignatureRate: undefined,
        loadByRole,
      };
    }

    let totalCycleTimeMs = 0;
    let totalHandoffs = 0;
    let reworkCount = 0;
    let doubleSignatureCount = 0;

    for (const record of closedCases) {
      const entries = auditLog.entriesForCase(record.id);
      const first = entries[0];
      const last = entries[entries.length - 1];
      if (first && last) {
        totalCycleTimeMs += last.simulatedTimestampMs - first.simulatedTimestampMs;
      }

      for (let i = 1; i < entries.length; i += 1) {
        if (entries[i]!.actor !== entries[i - 1]!.actor) {
          totalHandoffs += 1;
        }
      }

      if (
        entries.some(
          (entry) =>
            entry.action === 'supervisor-refuses' || entry.action === 'exception-e2-retouche',
        )
      ) {
        reworkCount += 1;
      }
      if (entries.some((entry) => entry.action === 'supervisor-approves')) {
        doubleSignatureCount += 1;
      }
    }

    return {
      closedCaseCount,
      averageCycleTimeMs: totalCycleTimeMs / closedCaseCount,
      averageHandoffsPerCase: totalHandoffs / closedCaseCount,
      reworkRate: reworkCount / closedCaseCount,
      doubleSignatureRate: doubleSignatureCount / closedCaseCount,
      loadByRole,
    };
  }

  function generateNewCase(overrides: AutoAdvanceOverrides = {}): CaseRecord {
    const generated = generateSyntheticCase(random);
    return declareCase(
      {
        fullName: generated.claimant.fullName,
        address: generated.claimant.address,
        incidentDate: 'Générée par l’animateur',
        description: generated.description,
        claimedAmountDollars: generated.claimedAmountDollars,
      },
      overrides,
    );
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
    getScenarioExceptions: () => scenario.exceptions,
    getKpis,
    declareCase,
    completeEvaluation,
    proposeSettlement,
    approveSupervisor,
    refuseSupervisor,
    resolveEscalation,
    resubmitDocuments,
    injectExceptionE1,
    injectExceptionE2,
    injectExceptionE3,
    generateNewCase,
    playClock,
    pauseClock,
    setClockSpeed,
    advanceToNextEvent,
    tick,
  };
}
