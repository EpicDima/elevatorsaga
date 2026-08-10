/**
 * Numeric helpers shared by the simulation.
 *
 * These are ported verbatim in behaviour from the legacy `base.js` so that the
 * modernized simulation reproduces the original physics bit-for-bit.
 */

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
 * Mirrors the legacy `Math.min(max, Math.max(num, min))`, which means `max`
 * wins when the range is inverted (`min > max`).
 *
 * @param num - Value to clamp.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns `num` clamped to the range.
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
