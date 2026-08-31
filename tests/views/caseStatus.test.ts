import { describe, expect, it } from 'vitest';
import { getStatusVariant } from '../../src/views/caseStatus';
import { WATER_DAMAGE_STEPS } from '../../src/scenarios/waterDamage';

function step(id: string) {
  const found = WATER_DAMAGE_STEPS.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`Unknown step "${id}" in fixture.`);
  }
  return found;
}

describe('getStatusVariant (spec §5.7)', () => {
  it('maps the payment terminal step to success', () => {
    expect(getStatusVariant(step('payment'))).toBe('success');
  });

  it('maps the rejected terminal step to danger', () => {
    expect(getStatusVariant(step('rejected'))).toBe('danger');
  });

  it('maps a third-party-async step (external-expertise) to waiting', () => {
    expect(getStatusVariant(step('external-expertise'))).toBe('waiting');
  });

  it('maps a human step to active', () => {
    expect(getStatusVariant(step('evaluation'))).toBe('active');
  });

  it('maps an automated, non-terminal step to neutral', () => {
    expect(getStatusVariant(step('triage'))).toBe('neutral');
  });
});
