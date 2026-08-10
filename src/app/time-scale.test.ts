import { describe, expect, it } from "vitest";

import {
  clampTimeScale,
  DEFAULT_TIME_SCALE,
  decreasedTimeScale,
  increasedTimeScale,
  TIME_SCALE_MAX,
  TIME_SCALE_MIN,
} from "./time-scale.ts";

describe("clampTimeScale", () => {
  it("leaves a runnable time scale alone", () => {
    expect(clampTimeScale(1)).toBe(1);
    expect(clampTimeScale(0.5)).toBe(0.5);
    expect(clampTimeScale(TIME_SCALE_MAX)).toBe(TIME_SCALE_MAX);
  });

  it("clamps values outside the runnable range", () => {
    expect(clampTimeScale(0)).toBe(TIME_SCALE_MIN);
    expect(clampTimeScale(-10)).toBe(TIME_SCALE_MIN);
    expect(clampTimeScale(1e9)).toBe(TIME_SCALE_MAX);
  });

  it("falls back to the default for values that would freeze the world", () => {
    // `#timescale=abc` used to reach the world controller as NaN, and every
    // simulated `dt` became NaN with it.
    expect(clampTimeScale(Number.NaN)).toBe(DEFAULT_TIME_SCALE);
    expect(clampTimeScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TIME_SCALE);
    expect(clampTimeScale(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_TIME_SCALE);
  });
});

describe("increasedTimeScale", () => {
  it("steps up by the golden ratio, rounded", () => {
    expect(increasedTimeScale(1)).toBe(2);
    expect(increasedTimeScale(2)).toBe(3);
    expect(increasedTimeScale(3)).toBe(5);
    expect(increasedTimeScale(5)).toBe(8);
  });

  it("stops offering increases at the ceiling", () => {
    expect(increasedTimeScale(39)).toBe(63);
    expect(increasedTimeScale(63)).toBe(63);
  });
});

describe("decreasedTimeScale", () => {
  it("steps back down through the values the increase produced", () => {
    expect(decreasedTimeScale(63)).toBe(39);
    expect(decreasedTimeScale(8)).toBe(5);
    expect(decreasedTimeScale(5)).toBe(3);
    expect(decreasedTimeScale(3)).toBe(2);
    expect(decreasedTimeScale(2)).toBe(1);
  });

  it("never reaches the frozen zero the legacy buttons could reach", () => {
    // Math.round(1 / 1.618) === 1 already, but a URL-supplied 0.5 rounded to 0,
    // and 0 * 1.618 rounds to 0, so the world could not be restarted.
    expect(decreasedTimeScale(1)).toBe(1);
    expect(decreasedTimeScale(0.5)).toBe(1);
    expect(increasedTimeScale(decreasedTimeScale(0.5))).toBe(2);
  });
});
