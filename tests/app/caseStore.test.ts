import { describe, expect, it } from 'vitest';
import { createCaseStore } from '../../src/app/caseStore';
import type { RandomSource } from '../../src/synthetic/random';

/** A test double that returns a fixed sequence of values, repeating the last once exhausted. */
function sequence(...values: number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)]!;
    index += 1;
    return value;
  };
}

const declarationInput = {
  fullName: 'Amélie Tremblay',
  address: '123 rue des Érables, Laval (QC)',
  incidentDate: '2026-08-15',
  description: "Infiltration d'eau au sous-sol.",
  claimedAmountDollars: 5_000,
};

describe('createCaseStore — declareCase', () => {
  it('creates a case and auto-advances through triage/coverage-check to evaluation on a happy path', () => {
    // complexityScore draw -> low (skips expertise); coverageValid draw -> valid (0 < 0.85).
    const store = createCaseStore({ random: sequence(0, 0) });

    const record = store.declareCase(declarationInput);

    expect(record.state.stepId).toBe('evaluation');
    expect(record.claimant.fullName).toBe('Amélie Tremblay');
    expect(store.getCase(record.id)).toEqual(record);
  });

  it('auto-rejects a case when the synthetic coverage-check draw is invalid', () => {
    // complexityScore draw -> low; coverageValid draw -> 0.99 is NOT < 0.85, so invalid.
    const store = createCaseStore({ random: sequence(0, 0.99) });

    const record = store.declareCase(declarationInput);

    expect(record.state.stepId).toBe('rejected');
  });

  it('leaves the case at evaluation regardless of the complexity draw — routing is the analyst’s call', () => {
    // complexityScore draw -> 0.8 * 101 = 80 (> 70 threshold); coverageValid draw -> valid.
    const store = createCaseStore({ random: sequence(0.8, 0) });

    const record = store.declareCase(declarationInput);

    expect(record.state.stepId).toBe('evaluation');
  });

  it('journalizes the declaration and the automated transitions in the audit log', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const record = store.declareCase(declarationInput);

    const entries = store.getAuditLog().entriesForCase(record.id);
    expect(entries.map((entry) => entry.action)).toEqual([
      'submit-declaration',
      'complete-triage',
      'coverage-valid',
    ]);
  });

  it('assigns readable, sequential case ids', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const first = store.declareCase(declarationInput);
    const second = store.declareCase(declarationInput);

    expect(first.id).not.toBe(second.id);
  });
});

describe('createCaseStore — completeEvaluation', () => {
  it('moves a low-complexity case straight to settlement-proposal', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);

    store.completeEvaluation(record.id, 'analyste-1');

    expect(store.getCase(record.id)!.state.stepId).toBe('settlement-proposal');
  });

  it('moves a high-complexity case to external-expertise instead', () => {
    // complexityScore draw -> 0.8 * 101 = 80 (> 70 threshold); coverageValid draw -> valid.
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const record = store.declareCase(declarationInput);

    store.completeEvaluation(record.id, 'analyste-1');

    expect(store.getCase(record.id)!.state.stepId).toBe('external-expertise');
  });

  it('advances the clock by the evaluation step’s declared simulated duration (4h)', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    const beforeMs = store.getSnapshot().clock.now; // 35_000 after triage (30s) + coverage-check (5s)

    store.completeEvaluation(record.id, 'analyste-1');

    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    expect(store.getSnapshot().clock.now).toBe(beforeMs + FOUR_HOURS_MS);
  });
});

describe('createCaseStore — proposeSettlement', () => {
  function caseAtSettlementProposal(store: ReturnType<typeof createCaseStore>) {
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    return record.id;
  }

  it('routes a low proposal straight to payment (case closed, no supervisor needed)', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const caseId = caseAtSettlementProposal(store);

    store.proposeSettlement(caseId, 5_000, 'analyste-1');

    expect(store.getCase(caseId)!.state.stepId).toBe('payment');
  });

  it('routes a proposal over $10,000 to supervisor-approval', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const caseId = caseAtSettlementProposal(store);

    store.proposeSettlement(caseId, 15_000, 'analyste-1');

    expect(store.getCase(caseId)!.state.stepId).toBe('supervisor-approval');
  });
});

describe('createCaseStore — approveSupervisor (spec §5.6, AC3)', () => {
  function caseAtSupervisorApproval(store: ReturnType<typeof createCaseStore>) {
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 15_000, 'analyste-1');
    return record.id;
  }

  it('refuses (four-eyes) when the approver is the same as the proposing analyst, case stays open', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const caseId = caseAtSupervisorApproval(store);

    const result = store.approveSupervisor(caseId, 'analyste-1');

    expect(result.allowed).toBe(false);
    expect(store.getCase(caseId)!.state.stepId).toBe('supervisor-approval');
    const blocked = store
      .getAuditLog()
      .entriesForCase(caseId)
      .filter((e) => e.action === 'blocked-attempt');
    expect(blocked).toHaveLength(1);
  });

  it('approves and closes the case when the approver is a distinct identity', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const caseId = caseAtSupervisorApproval(store);

    const result = store.approveSupervisor(caseId, 'superviseur-1');

    expect(result.allowed).toBe(true);
    expect(store.getCase(caseId)!.state.stepId).toBe('payment');
  });
});

describe('createCaseStore — refuseSupervisor', () => {
  it('returns the case to settlement-proposal and requires a non-empty comment', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 15_000, 'analyste-1');

    expect(() => store.refuseSupervisor(record.id, 'superviseur-1', '')).toThrow();

    store.refuseSupervisor(record.id, 'superviseur-1', 'Justificatifs insuffisants.');
    expect(store.getCase(record.id)!.state.stepId).toBe('settlement-proposal');
  });
});

describe('createCaseStore — getQueueForRole', () => {
  it('groups cases by the step their next actor needs to act on', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const evaluationCase = store.declareCase(declarationInput);
    const closedCase = store.declareCase(declarationInput);
    store.completeEvaluation(closedCase.id, 'analyste-1');
    store.proposeSettlement(closedCase.id, 5_000, 'analyste-1');

    const analystQueue = store.getQueueForRole('analyst');
    expect(analystQueue.map((c) => c.id)).toEqual([evaluationCase.id]);

    const supervisorQueue = store.getQueueForRole('supervisor');
    expect(supervisorQueue).toEqual([]);
  });
});

describe('createCaseStore — getScenarioSteps', () => {
  it('exposes the 8 spec steps plus rejected, with their French labels', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const steps = store.getScenarioSteps();

    expect(steps.map((step) => step.id)).toContain('evaluation');
    const evaluation = steps.find((step) => step.id === 'evaluation');
    expect(evaluation?.label).toBe('Évaluation du dossier');
  });
});

describe('createCaseStore — clock controls (spec §5.1)', () => {
  it('starts paused at speed x1 and time 0', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    expect(store.getSnapshot().clock).toEqual({ now: 0, isPlaying: false, speed: 1 });
  });

  it('play/pause toggle isPlaying', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    store.playClock();
    expect(store.getSnapshot().clock.isPlaying).toBe(true);
    store.pauseClock();
    expect(store.getSnapshot().clock.isPlaying).toBe(false);
  });

  it('setClockSpeed changes the speed used by subsequent ticks', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    store.setClockSpeed(500);
    store.playClock();

    store.tick(10);

    expect(store.getSnapshot().clock.now).toBe(5_000);
  });

  it('tick() does nothing while paused', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    store.tick(1_000);
    expect(store.getSnapshot().clock.now).toBe(0);
  });
});

describe('createCaseStore — external expertise auto-resolves via the clock (AC2)', () => {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  it('advanceToNextEvent moves a case straight from external-expertise to settlement-proposal', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) }); // high complexity -> expertise
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    expect(store.getCase(record.id)!.state.stepId).toBe('external-expertise');

    store.advanceToNextEvent();

    expect(store.getCase(record.id)!.state.stepId).toBe('settlement-proposal');
  });

  it('does not resolve before the 3 simulated days elapse, and does after via play+tick', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');

    store.setClockSpeed(2_000);
    store.playClock();
    store.tick(1); // 1 real ms * 2000 = 2000 simulated ms, far short of 3 days
    expect(store.getCase(record.id)!.state.stepId).toBe('external-expertise');

    store.tick(Math.ceil(THREE_DAYS_MS / 2_000) + 1);
    expect(store.getCase(record.id)!.state.stepId).toBe('settlement-proposal');
  });
});

describe('createCaseStore — generateNewCase (spec §5.2, facilitator "Nouveau dossier")', () => {
  it('creates a synthetic case using the store’s own random source', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const record = store.generateNewCase();

    expect(record.claimant.fullName.trim().length).toBeGreaterThan(0);
    expect(record.claimedAmountDollars).toBeGreaterThanOrEqual(800);
    expect(store.getCase(record.id)).toEqual(record);
  });
});

describe('createCaseStore — getKpis (spec §5.5, AC5)', () => {
  it('returns undefined averages and zero closedCaseCount when nothing is closed yet', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const kpis = store.getKpis();

    expect(kpis.closedCaseCount).toBe(0);
    expect(kpis.averageCycleTimeMs).toBeUndefined();
    expect(kpis.averageHandoffsPerCase).toBeUndefined();
    expect(kpis.reworkRate).toBeUndefined();
    expect(kpis.doubleSignatureRate).toBeUndefined();
    expect(kpis.loadByRole).toEqual({ analyst: 0, supervisor: 0 });
  });

  it('computes cycle time and handoffs for a single closed case from its own audit trail', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 5_000, 'analyste-1');

    const entries = store.getAuditLog().entriesForCase(record.id);
    const expectedCycleTime =
      entries[entries.length - 1]!.simulatedTimestampMs - entries[0]!.simulatedTimestampMs;
    let expectedHandoffs = 0;
    for (let i = 1; i < entries.length; i += 1) {
      if (entries[i]!.actor !== entries[i - 1]!.actor) {
        expectedHandoffs += 1;
      }
    }

    const kpis = store.getKpis();
    expect(kpis.closedCaseCount).toBe(1);
    expect(kpis.averageCycleTimeMs).toBe(expectedCycleTime);
    expect(kpis.averageHandoffsPerCase).toBe(expectedHandoffs);
    expect(kpis.reworkRate).toBe(0);
    expect(kpis.doubleSignatureRate).toBe(0);
  });

  it('counts a case that went through supervisor approval toward doubleSignatureRate', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 15_000, 'analyste-1');
    store.approveSupervisor(record.id, 'superviseur-1');

    expect(store.getKpis().doubleSignatureRate).toBe(1);
  });

  it('counts a case that was refused (renvoi) toward reworkRate', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 15_000, 'analyste-1');
    store.refuseSupervisor(record.id, 'superviseur-1', 'Justificatifs insuffisants.');
    store.proposeSettlement(record.id, 15_000, 'analyste-1');
    store.approveSupervisor(record.id, 'superviseur-2');

    expect(store.getKpis().reworkRate).toBe(1);
  });

  it('reflects live queue counts in loadByRole', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    store.declareCase(declarationInput); // sits at evaluation
    const other = store.declareCase(declarationInput);
    store.completeEvaluation(other.id, 'analyste-1');
    store.proposeSettlement(other.id, 15_000, 'analyste-1'); // sits at supervisor-approval

    const kpis = store.getKpis();
    expect(kpis.loadByRole).toEqual({ analyst: 1, supervisor: 1 });
  });
});

describe('createCaseStore — injectExceptionE2 (spec §3, §5.4, docs/plan.md item F)', () => {
  it('routes an evaluation-stage case to waiting-on-client and logs it', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    expect(record.state.stepId).toBe('evaluation');

    store.injectExceptionE2(record.id, 'Animatrice');

    expect(store.getCase(record.id)!.state.stepId).toBe('waiting-on-client');
    const entries = store.getAuditLog().entriesForCase(record.id);
    expect(entries[entries.length - 1]!.action).toBe('exception-e2-retouche');
  });

  it('refuses to target a case that is not at evaluation', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1'); // now at settlement-proposal

    expect(() => store.injectExceptionE2(record.id, 'Animatrice')).toThrow();
  });

  it('counts an E2-affected case toward reworkRate once closed', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.injectExceptionE2(record.id, 'Animatrice');
    store.resubmitDocuments(record.id);
    store.completeEvaluation(record.id, 'analyste-1');
    store.proposeSettlement(record.id, 5_000, 'analyste-1');

    expect(store.getCase(record.id)!.state.stepId).toBe('payment');
    expect(store.getKpis().reworkRate).toBe(1);
  });
});

describe('createCaseStore — resubmitDocuments (spec §5.4, docs/plan.md item F)', () => {
  it('sends the case back through declaration -> triage -> coverage-check -> evaluation', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);
    store.injectExceptionE2(record.id, 'Animatrice');

    store.resubmitDocuments(record.id);

    expect(store.getCase(record.id)!.state.stepId).toBe('evaluation');
    const actions = store
      .getAuditLog()
      .entriesForCase(record.id)
      .map((entry) => entry.action);
    expect(actions).toEqual([
      'submit-declaration',
      'complete-triage',
      'coverage-valid',
      'exception-e2-retouche',
      'client-resubmits',
      'submit-declaration',
      'complete-triage',
      'coverage-valid',
    ]);
  });

  it('refuses to resubmit a case that is not waiting on the client', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput);

    expect(() => store.resubmitDocuments(record.id)).toThrow();
  });
});

describe('createCaseStore — injectExceptionE1 (spec §3, §5.4, docs/plan.md item E)', () => {
  function caseAtExternalExpertise(store: ReturnType<typeof createCaseStore>) {
    const record = store.declareCase(declarationInput); // high complexity -> expertise
    store.completeEvaluation(record.id, 'analyste-1');
    return record.id;
  }

  it('escalates straight to supervisor-approval with no proposing analyst on record', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const caseId = caseAtExternalExpertise(store);

    store.injectExceptionE1(caseId, 'Animatrice');

    const record = store.getCase(caseId)!;
    expect(record.state.stepId).toBe('supervisor-approval');
    expect(record.proposedByUserId).toBeUndefined();
  });

  it('advances the shared clock by the simulated timeout and logs the escalation', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const caseId = caseAtExternalExpertise(store);
    const beforeMs = store.getSnapshot().clock.now;

    store.injectExceptionE1(caseId, 'Animatrice');

    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    expect(store.getSnapshot().clock.now).toBe(beforeMs + FIVE_DAYS_MS);
    const entries = store.getAuditLog().entriesForCase(caseId);
    expect(entries[entries.length - 1]!.action).toBe('exception-e1-escalation');
  });

  it('cancels the pending normal auto-resolution so it cannot fire after escalation', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const caseId = caseAtExternalExpertise(store);

    store.injectExceptionE1(caseId, 'Animatrice');
    store.advanceToNextEvent(); // would resolve to settlement-proposal if the old timer still fired

    expect(store.getCase(caseId)!.state.stepId).toBe('supervisor-approval');
  });

  it('refuses to target a case that is not at external-expertise', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput); // low complexity -> evaluation

    expect(() => store.injectExceptionE1(record.id, 'Animatrice')).toThrow();
  });
});

describe('createCaseStore — resolveEscalation (spec §5.4/§5.6, docs/plan.md item E)', () => {
  it('sets the amount and closes the case without a four-eyes check', () => {
    const store = createCaseStore({ random: sequence(0.8, 0) });
    const record = store.declareCase(declarationInput);
    store.completeEvaluation(record.id, 'analyste-1');
    store.injectExceptionE1(record.id, 'Animatrice');

    store.resolveEscalation(record.id, 20_000, 'superviseur-1');

    expect(store.getCase(record.id)!.state.stepId).toBe('payment');
  });

  it('refuses when the case is not an E1-escalated case awaiting a manual decision', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const record = store.declareCase(declarationInput); // sits at evaluation

    expect(() => store.resolveEscalation(record.id, 5_000, 'superviseur-1')).toThrow();
  });
});

describe('createCaseStore — injectExceptionE3 (spec §3, §5.4, docs/plan.md item G)', () => {
  it('generates 8 synthetic cases via the normal step-1 path', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const spike = store.injectExceptionE3();

    expect(spike).toHaveLength(8);
    expect(store.getSnapshot().cases).toHaveLength(8);
    for (const record of spike) {
      const entries = store.getAuditLog().entriesForCase(record.id);
      expect(entries[0]!.action).toBe('submit-declaration');
    }
  });

  it("AC4: guarantees all 8 land in the analyst's queue, even with an otherwise-invalid coverage draw", () => {
    // 0.99 would normally fail assignCoverageValidity's < 0.85 check and auto-reject every case.
    const store = createCaseStore({ random: sequence(0.99) });

    const spike = store.injectExceptionE3();

    for (const record of spike) {
      expect(store.getCase(record.id)!.state.stepId).toBe('evaluation');
    }
    expect(store.getQueueForRole('analyst')).toHaveLength(8);
    expect(store.getKpis().loadByRole.analyst).toBe(8);
  });
});

describe('createCaseStore — getScenarioExceptions', () => {
  it('exposes the three spec exceptions as declarative data', () => {
    const store = createCaseStore({ random: sequence(0, 0) });

    const exceptions = store.getScenarioExceptions();

    expect(exceptions.map((exception) => exception.id)).toEqual(['E1', 'E2', 'E3']);
  });
});

describe('createCaseStore — subscribe/getSnapshot', () => {
  it('notifies subscribers and returns a new snapshot after a mutation', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    const before = store.getSnapshot();
    let notified = false;
    const unsubscribe = store.subscribe(() => {
      notified = true;
    });

    store.declareCase(declarationInput);

    expect(notified).toBe(true);
    expect(store.getSnapshot()).not.toBe(before);
    unsubscribe();
  });

  it('returns the same snapshot reference when nothing has changed', () => {
    const store = createCaseStore({ random: sequence(0, 0) });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});
