// Synthetic case generator (spec §5.2): produces a plausible Quebec claimant, a fictitious
// address, a varied description, and a claimed amount in the spec's $800–$45,000 range. Scope
// is intentionally limited to what plan.md's Phase 3 lists — complexity score, coverage
// validity, and which step a case starts at are not part of this generator (the latter is
// gated on open question G for Phase 5); this stays decoupled from the scenario's context shape.
import type { RandomSource } from './random';
import {
  FIRST_NAMES,
  LAST_NAMES,
  QUEBEC_CITIES,
  STREET_NAMES,
  WATER_DAMAGE_DESCRIPTIONS,
} from './data';

const MIN_CLAIMED_AMOUNT_DOLLARS = 800;
const MAX_CLAIMED_AMOUNT_DOLLARS = 45_000;
const MIN_STREET_NUMBER = 100;
const MAX_STREET_NUMBER = 9999;

export interface SyntheticClaimant {
  readonly fullName: string;
  readonly address: string;
}

export interface SyntheticWaterDamageCase {
  readonly claimant: SyntheticClaimant;
  readonly description: string;
  readonly claimedAmountDollars: number;
}

function pick<T>(random: RandomSource, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('pick() called with an empty list.');
  }
  return item;
}

function randomInt(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function generateSyntheticCase(random: RandomSource): SyntheticWaterDamageCase {
  const fullName = `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
  const streetNumber = randomInt(random, MIN_STREET_NUMBER, MAX_STREET_NUMBER);
  const address = `${streetNumber} ${pick(random, STREET_NAMES)}, ${pick(random, QUEBEC_CITIES)} (QC)`;

  return {
    claimant: { fullName, address },
    description: pick(random, WATER_DAMAGE_DESCRIPTIONS),
    claimedAmountDollars: randomInt(random, MIN_CLAIMED_AMOUNT_DOLLARS, MAX_CLAIMED_AMOUNT_DOLLARS),
  };
}
