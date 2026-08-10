/**
 * Helpers shared by the simulation unit tests.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

import type { RandomSource } from "./random.ts";

/**
 * A {@link RandomSource} that hands out exactly the values it was given.
 *
 * The clearer replacement for chains of `vi.spyOn(Math, "random")` with
 * `mockReturnValueOnce`: the values are what the code under test will see, in
 * order, and running off the end is a test bug rather than a silent `NaN`. Use
 * it to steer a single decision; a whole run is better pinned with a seed.
 *
 * @param values - The values to return, in order.
 * @returns A source that yields them one per call.
 * @throws When called more times than there are values.
 */
export function scriptedRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return (): number => {
    const value = values[index];
    if (value === undefined) {
      throw new Error(`Scripted random source exhausted after ${String(values.length)} draws`);
    }
    index++;
    return value;
  };
}

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
 * Reads an array element the test knows is there.
 *
 * Works around `noUncheckedIndexedAccess` without a non-null assertion, which
 * the lint configuration forbids.
 *
 * @param arr - Array to read.
 * @param index - Index to read.
 * @returns The element at `index`.
 * @throws When there is no element at `index`.
 */
export function at<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Expected an element at index ${String(index)}`);
  }
  return value;
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
