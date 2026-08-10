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

/** Every stop the `+`/`-` buttons can reach, slowest first. */
const LADDER = [0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55];

/** Each neighbouring pair of stops, as `[slower, faster]`. */
const LADDER_STEPS = LADDER.flatMap((slower, index) => {
  const faster = LADDER[index + 1];
  return faster === undefined ? [] : [[slower, faster] as const];
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

  it("climbs back out of the slow speeds a URL can ask for", () => {
    expect(increasedTimeScale(TIME_SCALE_MIN)).toBe(0.25);
    expect(increasedTimeScale(0.25)).toBe(0.5);
    expect(increasedTimeScale(0.5)).toBe(1);
  });

  it("moves a speed that is not on the ladder upwards", () => {
    // #timescale=0.7 is a perfectly legal request; pressing + must speed it up.
    expect(increasedTimeScale(0.7)).toBe(1);
    expect(increasedTimeScale(0.15)).toBe(0.25);
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

  it("keeps going below 1 instead of sticking there", () => {
    // The `-` button used to bottom out at 1 because rounding 1 / 1.618 gives
    // 1, so the slow half of the runnable range was unreachable by playing even
    // though clampTimeScale allows it and #timescale= hands it out.
    expect(decreasedTimeScale(1)).toBe(0.5);
    expect(decreasedTimeScale(0.5)).toBe(0.25);
    expect(decreasedTimeScale(0.25)).toBe(TIME_SCALE_MIN);
  });

  it("never reaches the frozen zero the legacy button could reach", () => {
    // Legacy: Math.round(0.5 / 1.618) === 0, and 0 * 1.618 rounds to 0, so one
    // press of `-` at a URL-supplied 0.5 stopped the world for good.
    expect(decreasedTimeScale(TIME_SCALE_MIN)).toBe(TIME_SCALE_MIN);
    expect(decreasedTimeScale(0.05)).toBe(TIME_SCALE_MIN);
  });

  it("moves a speed that is not on the ladder downwards", () => {
    expect(decreasedTimeScale(0.7)).toBe(0.5);
    expect(decreasedTimeScale(1.2)).toBe(1);
  });
});

describe("the +/- ladder", () => {
  it.each(LADDER_STEPS)("goes from %sx up to %sx and straight back down", (slower, faster) => {
    expect(increasedTimeScale(slower)).toBe(faster);
    expect(decreasedTimeScale(faster)).toBe(slower);
  });

  it("stays inside the runnable range at both ends", () => {
    expect(decreasedTimeScale(TIME_SCALE_MIN)).toBe(TIME_SCALE_MIN);
    expect(increasedTimeScale(TIME_SCALE_MAX)).toBe(TIME_SCALE_MAX);
    for (const stop of LADDER) {
      expect(increasedTimeScale(stop)).toBeLessThanOrEqual(TIME_SCALE_MAX);
      expect(decreasedTimeScale(stop)).toBeGreaterThanOrEqual(TIME_SCALE_MIN);
    }
  });

  it("never lets a press stop the world", () => {
    let timeScale = 2;
    for (let i = 0; i < 20; i += 1) {
      timeScale = decreasedTimeScale(timeScale);
      expect(timeScale).toBeGreaterThan(0);
    }
    expect(timeScale).toBe(TIME_SCALE_MIN);
    for (let i = 0; i < 20; i += 1) {
      timeScale = increasedTimeScale(timeScale);
    }
    // 55 is the top of the ladder: the press that reached it started at 34,
    // below the ceiling, and 55 is above it, so `+` offers nothing more.
    expect(timeScale).toBe(LADDER.at(-1));
  });
});
