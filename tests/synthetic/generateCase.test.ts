import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../src/synthetic/random';
import { generateSyntheticCase } from '../../src/synthetic/generateCase';
import { QUEBEC_CITIES } from '../../src/synthetic/data';

describe('generateSyntheticCase', () => {
  it('is deterministic for a given seed', () => {
    const a = generateSyntheticCase(createSeededRandom(7));
    const b = generateSyntheticCase(createSeededRandom(7));
    expect(a).toEqual(b);
  });

  it('generates a claimant with a non-empty name and an address citing a real Quebec city', () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 30; i += 1) {
      const generated = generateSyntheticCase(random);
      expect(generated.claimant.fullName.trim().length).toBeGreaterThan(0);
      const matchesKnownCity = QUEBEC_CITIES.some((city) =>
        generated.claimant.address.includes(city),
      );
      expect(matchesKnownCity).toBe(true);
    }
  });

  it('generates a claimed amount within the spec range of $800–$45,000', () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const generated = generateSyntheticCase(random);
      expect(generated.claimedAmountDollars).toBeGreaterThanOrEqual(800);
      expect(generated.claimedAmountDollars).toBeLessThanOrEqual(45_000);
    }
  });

  it('generates a non-empty water-damage description containing no Lorem Ipsum placeholder text', () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 30; i += 1) {
      const generated = generateSyntheticCase(random);
      expect(generated.description.trim().length).toBeGreaterThan(0);
      expect(generated.description.toLowerCase()).not.toContain('lorem');
    }
  });

  it('varies claimant names and descriptions across draws instead of repeating one fixture', () => {
    const random = createSeededRandom(7);
    const names = new Set<string>();
    const descriptions = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const generated = generateSyntheticCase(random);
      names.add(generated.claimant.fullName);
      descriptions.add(generated.description);
    }
    expect(names.size).toBeGreaterThan(1);
    expect(descriptions.size).toBeGreaterThan(1);
  });
});
