/** Seedable random-number streams so simulation runs can be replayed from a seed. */

/** A stream of pseudo-random numbers, uniform in `[0, 1)`, shaped like `Math.random`. */
export type RandomSource = () => number;

/** A value a {@link RandomSource} can be rebuilt from. */
export type RandomSeed = string | number;

/** The unseeded, unreproducible source; used only outside a running world. */
export const systemRandom: RandomSource = () => Math.random();

/** Hashes a seed string into a 32-bit generator state (xmur3). */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Builds a reproducible {@link RandomSource} from a seed using mulberry32. */
export function createRandomSource(seed: RandomSeed): RandomSource {
  let state = hashSeed(String(seed));
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Separates a label from a seed so the two cannot collapse onto the same string. */
const LABEL_SEPARATOR = "\u0000";

/**
 * Derives a stream that the same seed reproduces but that runs independently
 * of the base stream, so a cosmetic draw can be added or removed without
 * shifting the draws that decide what the run does.
 */
export function deriveRandomSource(seed: RandomSeed, label: string): RandomSource {
  return createRandomSource(`${label}${LABEL_SEPARATOR}${String(seed)}`);
}

/** Draws a fresh seed, in `[0, 2^32)`, for a run nobody supplied one for. */
export function generateRandomSeed(): number {
  return Math.floor(systemRandom() * 0x100000000);
}
