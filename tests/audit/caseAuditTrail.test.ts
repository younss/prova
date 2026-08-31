import { describe, expect, it } from 'vitest';
import { createCase, getAvailableTransitions } from '../../src/engine/stateMachine';
import { createAuditLog } from '../../src/audit/auditLog';
import {
  applyTransitionWithAudit,
  attemptSupervisorApproval,
  checkFourEyesSeparation,
} from '../../src/audit/caseAuditTrail';
import {
  createWaterDamageScenario,
  type WaterDamageCaseContext,
} from '../../src/scenarios/waterDamage';

function baseContext(overrides: Partial<WaterDamageCaseContext> = {}): WaterDamageCaseContext {
  return {
    coverageValid: true,
    complexityScore: 10,
    proposedAmountDollars: 15_000,
    ...overrides,
  };
}

describe('checkFourEyesSeparation', () => {
  it('refuses when the approver is the same identity as the analyst', () => {
    const result = checkFourEyesSeparation({
      analystUserId: 'analyste-1',
      approverUserId: 'analyste-1',
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) {
      throw new Error('expected the check to refuse');
    }
    expect(result.refusalReason).toMatch(/séparation des tâches/i);
  });

  it('allows when the approver is a distinct identity from the analyst', () => {
    const result = checkFourEyesSeparation({
      analystUserId: 'analyste-1',
      approverUserId: 'superviseur-1',
    });

    expect(result.allowed).toBe(true);
  });
});

describe('applyTransitionWithAudit', () => {
  it('applies the transition and records exactly one audit entry describing it', () => {
    const scenario = createWaterDamageScenario();
    const auditLog = createAuditLog();
    const state = createCase(scenario, baseContext());

    const nextState = applyTransitionWithAudit(auditLog, scenario, state, 'submit-declaration', {
      caseId: 'case-1',
      actor: 'client-1',
      justification: 'Déclaration soumise via le formulaire.',
      simulatedTimestampMs: 500,
    });

    expect(nextState.stepId).toBe('triage');
    const entries = auditLog.entriesForCase('case-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      caseId: 'case-1',
      actor: 'client-1',
      action: 'submit-declaration',
      justification: 'Déclaration soumise via le formulaire.',
      simulatedTimestampMs: 500,
    });
  });

  it('does not record anything if the transition itself is invalid', () => {
    const scenario = createWaterDamageScenario();
    const auditLog = createAuditLog();
    const state = createCase(scenario, baseContext());

    expect(() =>
      applyTransitionWithAudit(auditLog, scenario, state, 'supervisor-approves', {
        caseId: 'case-1',
        actor: 'x',
        justification: 'j',
        simulatedTimestampMs: 0,
      }),
    ).toThrow();
    expect(auditLog.allEntries()).toHaveLength(0);
  });
});

describe('attemptSupervisorApproval (spec §5.6, AC3)', () => {
  function caseAtSupervisorApproval() {
    const scenario = createWaterDamageScenario();
    const auditLog = createAuditLog();
    let state = createCase(scenario, baseContext({ proposedAmountDollars: 15_000 }));
    for (const transitionId of [
      'submit-declaration',
      'complete-triage',
      'coverage-valid',
      'evaluation-skips-expertise',
      'proposal-requires-supervisor',
    ]) {
      state = applyTransitionWithAudit(auditLog, scenario, state, transitionId, {
        caseId: 'case-1',
        actor: 'system',
        justification: 'setup',
        simulatedTimestampMs: 0,
      });
    }
    expect(state.stepId).toBe('supervisor-approval');
    return { scenario, state, auditLog };
  }

  it('blocks a $15,000 case from closing when the approver is the same as the analyst, and logs the blocked attempt', () => {
    const { scenario, state, auditLog } = caseAtSupervisorApproval();

    const outcome = attemptSupervisorApproval(auditLog, scenario, state, 'supervisor-approves', {
      caseId: 'case-1',
      analystUserId: 'analyste-1',
      approverUserId: 'analyste-1',
      simulatedTimestampMs: 999,
    });

    expect(outcome.result.allowed).toBe(false);
    expect(outcome.state.stepId).toBe('supervisor-approval');
    expect(getAvailableTransitions(scenario, outcome.state).length).toBeGreaterThan(0);

    const blockedEntries = auditLog
      .entriesForCase('case-1')
      .filter((entry) => entry.action === 'blocked-attempt');
    expect(blockedEntries).toHaveLength(1);
    const [blockedEntry] = blockedEntries;
    expect(blockedEntry!.actor).toBe('analyste-1');
    expect(blockedEntry!.justification).toMatch(/séparation des tâches/i);
  });

  it('approves and closes a $15,000 case when the approver is distinct from the analyst', () => {
    const { scenario, state, auditLog } = caseAtSupervisorApproval();

    const outcome = attemptSupervisorApproval(auditLog, scenario, state, 'supervisor-approves', {
      caseId: 'case-1',
      analystUserId: 'analyste-1',
      approverUserId: 'superviseur-1',
      simulatedTimestampMs: 999,
    });

    expect(outcome.result.allowed).toBe(true);
    expect(outcome.state.stepId).toBe('payment');

    const approvalEntries = auditLog
      .entriesForCase('case-1')
      .filter((entry) => entry.action === 'supervisor-approves');
    expect(approvalEntries).toHaveLength(1);
    const [approvalEntry] = approvalEntries;
    expect(approvalEntry!.actor).toBe('superviseur-1');
  });
});
