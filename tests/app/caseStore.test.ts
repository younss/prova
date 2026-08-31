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
