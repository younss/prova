// Demo-only pseudo-random assignments standing in for the "AI triage" and "rules engine"
// automated steps (spec §3, steps 2-3). The spec never defines a real scoring or coverage
// algorithm, so — like the names/addresses in generateCase.ts — these are treated as synthetic
// content, never as invented business rules baked into a view or the engine.
import type { RandomSource } from './random';

/** Most synthetic claims should have valid coverage, so the demo mostly walks the happy path. */
const COVERAGE_VALID_PROBABILITY = 0.85;

export function assignComplexityScore(random: RandomSource): number {
  return Math.floor(random() * 101); // integer in [0, 100]
}

export function assignCoverageValidity(random: RandomSource): boolean {
  return random() < COVERAGE_VALID_PROBABILITY;
}
