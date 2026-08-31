import { describe, expect, it } from 'vitest';
import {
  applyTransition,
  createCase,
  getAvailableTransitions,
} from '../../src/engine/stateMachine';
import {
  DEFAULT_WATER_DAMAGE_THRESHOLDS,
  createWaterDamageScenario,
  type WaterDamageCaseContext,
} from '../../src/scenarios/waterDamage';

function baseContext(overrides: Partial<WaterDamageCaseContext> = {}): WaterDamageCaseContext {
  return {
    coverageValid: true,
    complexityScore: 10,
    proposedAmountDollars: 1000,
    ...overrides,
  };
}

describe('createWaterDamageScenario', () => {
  it('defines the 8 spec steps plus a rejected terminal step, starting at declaration', () => {
    const scenario = createWaterDamageScenario();

    expect(scenario.initialStepId).toBe('declaration');
    expect(scenario.steps.map((step) => step.id)).toEqual([
      'declaration',
      'triage',
      'coverage-check',
      'evaluation',
      'external-expertise',
      'settlement-proposal',
      'supervisor-approval',
      'payment',
      'rejected',
    ]);
  });

  it('exposes the three spec decision rules as readable, data-driven entries', () => {
    const scenario = createWaterDamageScenario();
    const ruleIds = scenario.decisionRules.map((rule) => rule.id);

    expect(ruleIds).toEqual([
      'invalid-coverage-rejection',
      'complexity-requires-expertise',
      'amount-requires-supervisor-approval',
    ]);
    for (const rule of scenario.decisionRules) {
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('does not build any UI or engine module — a case can be created and validated purely from data', () => {
    const scenario = createWaterDamageScenario();
    const state = createCase(scenario, baseContext());
    expect(state.stepId).toBe('declaration');
  });

  describe('happy path: low complexity, low amount', () => {
    it('skips external expertise and supervisor approval', () => {
      const scenario = createWaterDamageScenario();
      let state = createCase(
        scenario,
        baseContext({ complexityScore: 10, proposedAmountDollars: 1000 }),
      );

      state = applyTransition(scenario, state, 'submit-declaration');
      state = applyTransition(scenario, state, 'complete-triage');
      state = applyTransition(scenario, state, 'coverage-valid');
      expect(state.stepId).toBe('evaluation');

      state = applyTransition(scenario, state, 'evaluation-skips-expertise');
      expect(state.stepId).toBe('settlement-proposal');

      state = applyTransition(scenario, state, 'proposal-skips-supervisor');
      expect(state.stepId).toBe('payment');
      expect(getAvailableTransitions(scenario, state)).toEqual([]);
    });
  });

  describe('coverage rejection', () => {
    it('ends the flow at the rejected step when coverage is invalid', () => {
      const scenario = createWaterDamageScenario();
      let state = createCase(scenario, baseContext({ coverageValid: false }));

      state = applyTransition(scenario, state, 'submit-declaration');
      state = applyTransition(scenario, state, 'complete-triage');
      state = applyTransition(scenario, state, 'coverage-invalid');

      expect(state.stepId).toBe('rejected');
      expect(getAvailableTransitions(scenario, state)).toEqual([]);
    });
  });

  describe('high complexity path', () => {
    it('routes through external expertise before settlement proposal', () => {
      const scenario = createWaterDamageScenario();
      let state = createCase(
        scenario,
        baseContext({ complexityScore: 90, proposedAmountDollars: 1000 }),
      );

      state = applyTransition(scenario, state, 'submit-declaration');
      state = applyTransition(scenario, state, 'complete-triage');
      state = applyTransition(scenario, state, 'coverage-valid');
      state = applyTransition(scenario, state, 'evaluation-requires-expertise');
      expect(state.stepId).toBe('external-expertise');

      state = applyTransition(scenario, state, 'expertise-received');
      expect(state.stepId).toBe('settlement-proposal');
    });
  });

  describe('high amount path', () => {
    it('routes through supervisor approval before payment', () => {
      const scenario = createWaterDamageScenario();
      let state = createCase(
        scenario,
        baseContext({ complexityScore: 10, proposedAmountDollars: 15_000 }),
      );

      state = applyTransition(scenario, state, 'submit-declaration');
      state = applyTransition(scenario, state, 'complete-triage');
      state = applyTransition(scenario, state, 'coverage-valid');
      state = applyTransition(scenario, state, 'evaluation-skips-expertise');
      state = applyTransition(scenario, state, 'proposal-requires-supervisor');
      expect(state.stepId).toBe('supervisor-approval');

      state = applyTransition(scenario, state, 'supervisor-approves');
      expect(state.stepId).toBe('payment');
    });

    it('lets the supervisor refuse a proposal, returning it to settlement-proposal', () => {
      const scenario = createWaterDamageScenario();
      let state = createCase(
        scenario,
        baseContext({ complexityScore: 10, proposedAmountDollars: 15_000 }),
      );

      state = applyTransition(scenario, state, 'submit-declaration');
      state = applyTransition(scenario, state, 'complete-triage');
      state = applyTransition(scenario, state, 'coverage-valid');
      state = applyTransition(scenario, state, 'evaluation-skips-expertise');
      state = applyTransition(scenario, state, 'proposal-requires-supervisor');

      state = applyTransition(scenario, state, 'supervisor-refuses');
      expect(state.stepId).toBe('settlement-proposal');
    });
  });

  describe('AC7 — threshold lives in declarative data, not engine code', () => {
    it('changes routing behavior when the amount threshold is mutated in the fixture, with no engine change', () => {
      const context = baseContext({ complexityScore: 10, proposedAmountDollars: 7_000 });

      const defaultScenario = createWaterDamageScenario();
      let stateAtDefaultThreshold = createCase(defaultScenario, context);
      stateAtDefaultThreshold = applyTransition(
        defaultScenario,
        stateAtDefaultThreshold,
        'submit-declaration',
      );
      stateAtDefaultThreshold = applyTransition(
        defaultScenario,
        stateAtDefaultThreshold,
        'complete-triage',
      );
      stateAtDefaultThreshold = applyTransition(
        defaultScenario,
        stateAtDefaultThreshold,
        'coverage-valid',
      );
      stateAtDefaultThreshold = applyTransition(
        defaultScenario,
        stateAtDefaultThreshold,
        'evaluation-skips-expertise',
      );
      // At the default $10,000 threshold, a $7,000 proposal must NOT require supervisor approval.
      expect(
        getAvailableTransitions(defaultScenario, stateAtDefaultThreshold).map((t) => t.id),
      ).toEqual(['proposal-skips-supervisor']);

      const loweredThresholdScenario = createWaterDamageScenario({
        ...DEFAULT_WATER_DAMAGE_THRESHOLDS,
        amountRequiringSupervisorApprovalDollars: 5_000,
      });
      let stateAtLoweredThreshold = createCase(loweredThresholdScenario, context);
      stateAtLoweredThreshold = applyTransition(
        loweredThresholdScenario,
        stateAtLoweredThreshold,
        'submit-declaration',
      );
      stateAtLoweredThreshold = applyTransition(
        loweredThresholdScenario,
        stateAtLoweredThreshold,
        'complete-triage',
      );
      stateAtLoweredThreshold = applyTransition(
        loweredThresholdScenario,
        stateAtLoweredThreshold,
        'coverage-valid',
      );
      stateAtLoweredThreshold = applyTransition(
        loweredThresholdScenario,
        stateAtLoweredThreshold,
        'evaluation-skips-expertise',
      );
      // With the threshold lowered to $5,000 in the fixture only, the same $7,000 case now requires it.
      expect(
        getAvailableTransitions(loweredThresholdScenario, stateAtLoweredThreshold).map((t) => t.id),
      ).toEqual(['proposal-requires-supervisor']);
    });
  });
});
