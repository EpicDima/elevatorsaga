/**
 * Seedable randomness for the simulation.
 *
 * The engine used to draw straight from the global `Math.random`, which cannot
 * be replayed: a run that failed a challenge, or a fitness score that looked
 * wrong, could never be looked at a second time. Everything that needs
 * randomness now takes a {@link RandomSource} instead, and the world builds one
 * from a seed it records, so any run can be repeated exactly by handing that
 * seed back to {@link "./world.ts"!createWorld}.
 *
 * Swapping the generator does not break the port's promise of behavioural
 * identity with legacy 1.6.5. The legacy engine drew from an unseeded
 * `Math.random`, whose sequence is implementation-defined and differs between
 * engines and between runs, so the only property of those draws a legacy run
 * could ever have observed — and therefore the only one this port has to match
 * — is their *distribution*. Those are untouched; see
 * {@link "./math.ts"!randomInt}.
 */

/**
 * A stream of pseudo-random numbers, uniform in `[0, 1)`.
 *
 * Deliberately the same shape as `Math.random`, so that a call site can take
 * one without any adaptation and a test can hand over a plain arrow function.
 */
export type RandomSource = () => number;

/**
 * A value a {@link RandomSource} can be rebuilt from.
 *
 * Strings are accepted so a run can be labelled with something a human can read
 * out and retype ("issue-61"), numbers so that a generated seed stays short
 * enough to print next to the statistics.
 */
export type RandomSeed = string | number;

/**
 * The unseeded, unreproducible stream.
 *
 * The one place the simulation still touches `Math.random`. It is the entropy
 * behind {@link generateRandomSeed}, and the fallback for the call sites that
 * have no source threaded to them yet — {@link "./elevator.ts"!Elevator}
 * picking a slot for a boarding passenger is the only one left, and it decides
 * nothing but where that passenger is drawn inside the car. Anything that wants
 * to be replayable takes a {@link RandomSource} rather than reaching for this.
 */
export const systemRandom: RandomSource = () => Math.random();

/**
 * Mixes a seed into a well-distributed 32-bit generator state.
 *
 * xmur3, the hash mulberry32 is conventionally paired with. Seeds are hashed
 * rather than used as the state directly so that every seed shape behaves the
 * same: `1`, `1.5` and `"rush-hour"` all mix down to unrelated states, whereas
 * feeding them to the generator raw would need one rule for integers, another
 * for fractional and negative numbers, and none at all would exist for strings.
 * It also keeps neighbouring seeds — the `1`, `2`, `3` a batch run reaches for
 * — from starting a fixed distance apart in the same stream.
 *
 * @param seed - The seed, in its string form.
 * @returns A 32-bit unsigned integer to start the generator from.
 */
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

/**
 * Builds a reproducible {@link RandomSource} from a seed.
 *
 * The generator is mulberry32, picked over sfc32 because its whole state is a
 * single 32-bit word, so a seed is one number a player can read off the screen
 * and type back. Its period of 2^32 draws is five orders of magnitude more than
 * a full challenge run consumes — a 200 second run at the highest shipped spawn
 * rate is some 400 passengers, seven draws each — and its output quality is far
 * beyond what integer draws over ranges of a few dozen values can tell apart.
 * sfc32 would offer a 128-bit state and a longer period, but wants four seed
 * words and buys nothing at this scale. mulberry32 is also already the
 * generator `elevator.test.ts` seeds its sweeps with, so the tree keeps one.
 *
 * @param seed - Seed to derive the stream from; equal seeds give equal streams.
 * @returns A stream of values uniform in `[0, 1)`.
 */
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

/**
 * Draws a fresh seed, for a run nobody supplied one for.
 *
 * Every world records the seed it was built from, generated ones included, so
 * that a run is replayable *after the fact* — the interesting case, since
 * nobody knows a run is worth repeating until it has already gone wrong.
 *
 * @returns A seed in `[0, 2^32)`.
 */
export function generateRandomSeed(): number {
  return Math.floor(systemRandom() * 0x100000000);
}
