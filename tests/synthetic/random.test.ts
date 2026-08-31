import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../src/synthetic/random';

describe('createSeededRandom', () => {
  it('produces values in [0, 1)', () => {
    const random = createSeededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic: the same seed produces the same sequence', () => {
    const a = createSeededRandom(1234);
    const b = createSeededRandom(1234);
    const sequenceA = Array.from({ length: 20 }, () => a());
    const sequenceB = Array.from({ length: 20 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('different seeds produce different sequences', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const sequenceA = Array.from({ length: 10 }, () => a());
    const sequenceB = Array.from({ length: 10 }, () => b());
    expect(sequenceA).not.toEqual(sequenceB);
  });
});
