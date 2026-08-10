/**
 * Helpers shared by the simulation unit tests.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

/**
 * Steps a simulation forward in fixed increments.
 *
 * Ported verbatim from the legacy `test/tests.js`, including the fact that the
 * accumulator is incremented *before* the callback, so the total simulated
 * time is `ceil(dt / stepSize) * stepSize` — i.e. it may overshoot `dt`.
 *
 * @param dt - Simulated seconds to advance.
 * @param stepSize - Simulated seconds per step.
 * @param fn - Invoked once per step with `stepSize`.
 */
export function timeForwarder(dt: number, stepSize: number, fn: (dt: number) => void): void {
  let accumulated = 0.0;
  while (accumulated < dt) {
    accumulated += stepSize;
    fn(stepSize);
  }
}

/**
 * Asserts `value` lies within an inclusive range.
 *
 * Replacement for the Jasmine-only `toBeWithinRange` matcher used by the legacy
 * suite (see `test/jasmine/jasmine-matchers.js`), which has no Vitest
 * equivalent.
 *
 * @param value - Value under test.
 * @param floor - Inclusive lower bound.
 * @param ceiling - Inclusive upper bound.
 * @param message - Context included in the failure message.
 * @throws When `value` is outside `[floor, ceiling]`.
 */
export function assertWithinRange(
  value: number,
  floor: number,
  ceiling: number,
  message: string,
): void {
  if (!(value >= floor && value <= ceiling)) {
    throw new Error(
      `Expected ${String(value)} to be within [${String(floor)}, ${String(ceiling)}] ${message}`,
    );
  }
}
