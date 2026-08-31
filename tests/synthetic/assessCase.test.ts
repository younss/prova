import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../src/synthetic/random';
import { assignComplexityScore, assignCoverageValidity } from '../../src/synthetic/assessCase';

describe('assignComplexityScore', () => {
  it('returns an integer in [0, 100]', () => {
    const random = createSeededRandom(11);
    for (let i = 0; i < 200; i += 1) {
      const score = assignComplexityScore(random);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for a given random source', () => {
    const a = assignComplexityScore(createSeededRandom(5));
    const b = assignComplexityScore(createSeededRandom(5));
    expect(a).toBe(b);
  });
});

describe('assignCoverageValidity', () => {
  it('returns a boolean', () => {
    const random = createSeededRandom(11);
    const result = assignCoverageValidity(random);
    expect(typeof result).toBe('boolean');
  });

  it('produces both true and false outcomes across many draws', () => {
    const random = createSeededRandom(11);
    const outcomes = new Set<boolean>();
    for (let i = 0; i < 100; i += 1) {
      outcomes.add(assignCoverageValidity(random));
    }
    expect(outcomes.size).toBe(2);
  });

  it('is mostly valid — coverage rejection is the minority outcome (spec §3 decision table)', () => {
    const random = createSeededRandom(11);
    let validCount = 0;
    const draws = 500;
    for (let i = 0; i < draws; i += 1) {
      if (assignCoverageValidity(random)) {
        validCount += 1;
      }
    }
    expect(validCount / draws).toBeGreaterThan(0.5);
  });
});
