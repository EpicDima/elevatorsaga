import { systemRandom, type RandomSource } from "./random.ts";

/** Floating-point tolerance; changing it changes elevator arrival/stop behavior. */
export const EPSILON = 1e-8;

/** Clamps `num` to `[min, max]`. `NaN` passes through unchanged, and `max` wins if `min > max`. */
export function limitNumber(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(num, min));
}

/** True when `|a - b|` is strictly less than {@link EPSILON}. */
export function epsilonEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** Distance to go from `currentSpeed` to `targetSpeed` under constant `acceleration` (solves `v² = u² + 2ad` for `d`). */
export function distanceNeededToAchieveSpeed(
  currentSpeed: number,
  targetSpeed: number,
  acceleration: number,
): number {
  return (Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / (2 * acceleration);
}

/** Acceleration to go from `currentSpeed` to `targetSpeed` over `distance` (solves `v² = u² + 2ad` for `a`). */
export function accelerationNeededToAchieveChangeDistance(
  currentSpeed: number,
  targetSpeed: number,
  distance: number,
): number {
  return 0.5 * ((Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / distance);
}

/** Blends `value0` and `value1` by progress `x` in `[0, 1]`. */
export type Interpolator = (value0: number, value1: number, x: number) => number;

export function linearInterpolate(value0: number, value1: number, x: number): number {
  return value0 + (value1 - value0) * x;
}

/** Sigmoid-ish interpolation between `value0` and `value1`; `a` controls the steepness. */
export function powInterpolate(value0: number, value1: number, x: number, a: number): number {
  return value0 + ((value1 - value0) * Math.pow(x, a)) / (Math.pow(x, a) + Math.pow(1 - x, a));
}

/** {@link powInterpolate} with exponent `1.3`; used for elevator and passenger animation. */
export function coolInterpolate(value0: number, value1: number, x: number): number {
  return powInterpolate(value0, value1, x, 1.3);
}

/** Interpolator used by {@link "./movable.ts"!Movable.moveToOverTime} when none is given. */
export const DEFAULT_INTERPOLATOR: Interpolator = coolInterpolate;

/**
 * Random integer in `[min, max]`, inclusive on both ends. Defaults to the
 * unseeded {@link systemRandom}; simulation code should pass a seeded stream
 * instead so runs stay replayable.
 */
export function randomInt(min: number, max: number, random: RandomSource = systemRandom): number {
  return min + Math.floor(random() * (max - min + 1));
}
