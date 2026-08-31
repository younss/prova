// Seeded pseudo-random source so synthetic generation stays deterministic and testable —
// consistent with the project's "no ambient non-determinism" stance (CLAUDE.md's injected-time
// rule for the engine; here it's an injected random source instead of Math.random()).

export type RandomSource = () => number;

/** mulberry32: small, dependency-free, deterministic for a given seed. Returns values in [0, 1). */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
