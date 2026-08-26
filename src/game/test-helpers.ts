/** Not part of the game bundle; excluded from coverage in `vite.config.ts`. */

import type { RandomSource } from "./random.ts";

/** A {@link RandomSource} that replays the given values in order and throws once exhausted. */
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

/** Steps a simulation in fixed increments; the total simulated time may overshoot `dt`. */
export function timeForwarder(dt: number, stepSize: number, fn: (dt: number) => void): void {
  let accumulated = 0.0;
  while (accumulated < dt) {
    accumulated += stepSize;
    fn(stepSize);
  }
}

/** Reads an array element known to exist, avoiding a non-null assertion under `noUncheckedIndexedAccess`. */
export function at<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Expected an element at index ${String(index)}`);
  }
  return value;
}

/** Asserts `value` lies within the inclusive range `[floor, ceiling]`. */
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
