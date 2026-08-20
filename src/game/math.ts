/**
 * Numeric helpers shared by the simulation.
 *
 * These are ported verbatim in behaviour from the legacy `base.js` so that the
 * modernized simulation reproduces the original physics bit-for-bit.
 */

import { systemRandom, type RandomSource } from "./random.ts";

/**
 * Tolerance used for floating point comparisons throughout the simulation.
 *
 * Kept exactly at the legacy literal `0.00000001` — widening or narrowing it
 * changes elevator arrival/stop behaviour.
 */
export const EPSILON = 1e-8;

/**
 * Clamps `num` into the inclusive range `[min, max]`.
 *
 * Mirrors the legacy `Math.min(max, Math.max(num, min))`
 * (`legacy-1.x:base.js:11`), which means `max` wins when the range is inverted
 * (`min > max`), and that `NaN` comes back out unchanged: it compares false
 * against both bounds, so neither `Math.max` nor `Math.min` replaces it. Every
 * caller that takes its argument from player code has to say what it does with
 * that on its own.
 *
 * @param num - Value to clamp.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns `num` clamped to the range, or `NaN` when `num` is `NaN`.
 */
export function limitNumber(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(num, min));
}

/**
 * Tests whether two numbers are equal within {@link EPSILON}.
 *
 * The comparison is strictly less-than, so a difference of exactly `1e-8` is
 * *not* considered equal.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns `true` when `|a - b| < 1e-8`.
 */
export function epsilonEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/**
 * Distance required to change from `currentSpeed` to `targetSpeed` under
 * constant `acceleration`.
 *
 * Solves the kinematic identity `v² = u² + 2ad` for `d`.
 *
 * @param currentSpeed - Present speed `u`.
 * @param targetSpeed - Desired speed `v`.
 * @param acceleration - Constant acceleration `a`.
 * @returns The required distance `d`. Non-finite when `acceleration` is `0`.
 */
export function distanceNeededToAchieveSpeed(
  currentSpeed: number,
  targetSpeed: number,
  acceleration: number,
): number {
  // v² = u² + 2a * d
  return (Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / (2 * acceleration);
}

/**
 * Constant acceleration required to change from `currentSpeed` to
 * `targetSpeed` over `distance`.
 *
 * Solves the kinematic identity `v² = u² + 2ad` for `a`.
 *
 * @param currentSpeed - Present speed `u`.
 * @param targetSpeed - Desired speed `v`.
 * @param distance - Distance `d` available for the change.
 * @returns The required acceleration `a`. Non-finite when `distance` is `0`.
 */
export function accelerationNeededToAchieveChangeDistance(
  currentSpeed: number,
  targetSpeed: number,
  distance: number,
): number {
  // v² = u² + 2a * d
  return 0.5 * ((Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / distance);
}

/**
 * Blends two values according to a progress factor `x` in `[0, 1]`, returning
 * `value0` at `0` and `value1` at `1`.
 */
export type Interpolator = (value0: number, value1: number, x: number) => number;

/**
 * Straight-line interpolation between `value0` and `value1`.
 *
 * @param value0 - Value at `x === 0`.
 * @param value1 - Value at `x === 1`.
 * @param x - Progress in `[0, 1]`.
 * @returns `value0 + (value1 - value0) * x`.
 */
export function linearInterpolate(value0: number, value1: number, x: number): number {
  return value0 + (value1 - value0) * x;
}

/**
 * Sigmoid-ish interpolation whose steepness is controlled by `a`.
 *
 * Ported verbatim from `movable.js`; `a > 1` eases in and out around the
 * midpoint, and the endpoints degenerate to `value0` / `value1`.
 *
 * @param value0 - Value at `x === 0`.
 * @param value1 - Value at `x === 1`.
 * @param x - Progress in `[0, 1]`.
 * @param a - Steepness exponent.
 * @returns The interpolated value.
 */
export function powInterpolate(value0: number, value1: number, x: number, a: number): number {
  return value0 + ((value1 - value0) * Math.pow(x, a)) / (Math.pow(x, a) + Math.pow(1 - x, a));
}

/**
 * The interpolation used for elevator and passenger animations.
 *
 * {@link powInterpolate} with the legacy exponent `1.3`.
 *
 * @param value0 - Value at `x === 0`.
 * @param value1 - Value at `x === 1`.
 * @param x - Progress in `[0, 1]`.
 * @returns The interpolated value.
 */
export function coolInterpolate(value0: number, value1: number, x: number): number {
  return powInterpolate(value0, value1, x, 1.3);
}

/** Interpolator used by {@link "./movable.ts"!Movable.moveToOverTime} when none is given. */
export const DEFAULT_INTERPOLATOR: Interpolator = coolInterpolate;

/**
 * Random integer in the inclusive range `[min, max]`.
 *
 * Replaces the bundled lodash 2/3 `_.random`, which is inclusive on both ends
 * (`_.random(n)` is `randomInt(0, n)`). Keeping the distribution identical
 * matters because it drives passenger spawning.
 *
 * The arithmetic is unchanged; only where the underlying `[0, 1)` value comes
 * from is now the caller's choice, so that a whole run can be replayed from a
 * seed (see {@link "./random.ts"!RandomSource}).
 *
 * @param min - Lowest value that can be returned.
 * @param max - Highest value that can be returned.
 * @param random - Stream to draw from. Every call site inside a
 * {@link "./world.ts"!World} is handed one, and which one depends on whether
 * the moment of the draw is fixed by the seed or moved by the player's program:
 * spawning uses the world's own stream, while boarding slots, button
 * repressing and walk-off durations each use a separate stream derived from
 * the same seed. `src/game/world.ts` opens with the audit. The default is the
 * unseeded {@link systemRandom}, which now serves only callers outside a world.
 * @returns An integer in `[min, max]`.
 */
export function randomInt(min: number, max: number, random: RandomSource = systemRandom): number {
  return min + Math.floor(random() * (max - min + 1));
}
