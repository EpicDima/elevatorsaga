import { describe, expect, it } from "vitest";

import {
  clampTimeScale,
  DEFAULT_TIME_SCALE,
  decreasedTimeScale,
  increasedTimeScale,
  isFastestTimeScale,
  isSlowestTimeScale,
  TIME_SCALE_MAX,
  TIME_SCALE_MIN,
  TIME_SCALES,
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
    // NaN and Infinity both produce a `dt` multiplier that would freeze the world;
    // that hazard is also why the instant stop isn't modeled as a time scale.
    expect(clampTimeScale(Number.NaN)).toBe(DEFAULT_TIME_SCALE);
    expect(clampTimeScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TIME_SCALE);
    expect(clampTimeScale(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_TIME_SCALE);
  });
});

/** Each neighboring pair of stops, as `[slower, faster]`. */
const LADDER_STEPS = TIME_SCALES.flatMap((slower, index) => {
  const faster = TIME_SCALES[index + 1];
  return faster === undefined ? [] : [[slower, faster] as const];
});

describe("TIME_SCALES", () => {
  it("is the ladder of whole-number stops, with no Infinity", () => {
    expect([...TIME_SCALES]).toEqual([1, 2, 3, 6, 10, 20]);
  });

  it("holds only finite, positive speeds inside the runnable range", () => {
    // The point of a list of stops: no press can produce a stopping or freezing `dt`.
    for (const stop of TIME_SCALES) {
      expect(Number.isFinite(stop)).toBe(true);
      expect(stop).toBeGreaterThan(0);
      expect(clampTimeScale(stop)).toBe(stop);
    }
  });

  it("starts the game on one of its own stops", () => {
    expect(TIME_SCALES).toContain(DEFAULT_TIME_SCALE);
  });
});

describe("increasedTimeScale", () => {
  it("steps up the ladder", () => {
    expect(increasedTimeScale(1)).toBe(2);
    expect(increasedTimeScale(2)).toBe(3);
    expect(increasedTimeScale(3)).toBe(6);
    expect(increasedTimeScale(6)).toBe(10);
    expect(increasedTimeScale(10)).toBe(20);
  });

  it("has nothing faster to offer at the top of the ladder", () => {
    // That press is the one the speed control spends on its instant stop instead.
    expect(increasedTimeScale(20)).toBe(20);
  });

  it("climbs out of a slow speed only a URL can ask for", () => {
    expect(increasedTimeScale(TIME_SCALE_MIN)).toBe(1);
    expect(increasedTimeScale(0.5)).toBe(1);
    expect(increasedTimeScale(0.7)).toBe(1);
  });

  it("leaves a speed above the ladder where the URL put it", () => {
    // #timescale=40 stays exactly 40x; rounding it onto the ladder would silently disobey the URL.
    expect(increasedTimeScale(40)).toBe(40);
    expect(increasedTimeScale(TIME_SCALE_MAX)).toBe(TIME_SCALE_MAX);
  });
});

describe("decreasedTimeScale", () => {
  it("steps back down through the values the increase produced", () => {
    expect(decreasedTimeScale(20)).toBe(10);
    expect(decreasedTimeScale(10)).toBe(6);
    expect(decreasedTimeScale(6)).toBe(3);
    expect(decreasedTimeScale(3)).toBe(2);
    expect(decreasedTimeScale(2)).toBe(1);
  });

  it("brings a speed above the ladder down to its neighboring stop", () => {
    expect(decreasedTimeScale(40)).toBe(20);
    expect(decreasedTimeScale(1.2)).toBe(1);
  });

  it("never reaches the frozen zero the legacy button could reach", () => {
    // Math.round(0.5 / 1.618) === 0, and 0 × 1.618 rounds to 0 too: a list of
    // stops can't reach that frozen zero, since below the ladder there's nowhere to go.
    expect(decreasedTimeScale(1)).toBe(1);
    expect(decreasedTimeScale(0.5)).toBe(0.5);
    expect(decreasedTimeScale(TIME_SCALE_MIN)).toBe(TIME_SCALE_MIN);
  });
});

describe("isSlowestTimeScale", () => {
  it("is true only at the bottom of the ladder and below it", () => {
    expect(isSlowestTimeScale(1)).toBe(true);
    expect(isSlowestTimeScale(0.5)).toBe(true);
    expect(isSlowestTimeScale(TIME_SCALE_MIN)).toBe(true);
    expect(isSlowestTimeScale(2)).toBe(false);
    expect(isSlowestTimeScale(20)).toBe(false);
  });

  it("agrees with what a press of `-` would actually do", () => {
    for (const timeScale of [...TIME_SCALES, 0.5, 1.2, 40]) {
      expect(decreasedTimeScale(timeScale) === timeScale, String(timeScale)).toBe(
        isSlowestTimeScale(timeScale),
      );
    }
  });
});

describe("isFastestTimeScale", () => {
  it("is true only at the top of the ladder and above it", () => {
    expect(isFastestTimeScale(20)).toBe(true);
    expect(isFastestTimeScale(40)).toBe(true);
    expect(isFastestTimeScale(10)).toBe(false);
    expect(isFastestTimeScale(0.5)).toBe(false);
  });

  it("agrees with what a press of `+` would actually do", () => {
    for (const timeScale of [...TIME_SCALES, 0.5, 1.2, 40]) {
      expect(increasedTimeScale(timeScale) === timeScale, String(timeScale)).toBe(
        isFastestTimeScale(timeScale),
      );
    }
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
    for (const stop of TIME_SCALES) {
      expect(increasedTimeScale(stop)).toBeLessThanOrEqual(TIME_SCALE_MAX);
      expect(decreasedTimeScale(stop)).toBeGreaterThanOrEqual(TIME_SCALE_MIN);
    }
  });

  it("never lets a press stop or freeze the world", () => {
    let timeScale = DEFAULT_TIME_SCALE;
    for (let i = 0; i < 20; i += 1) {
      timeScale = decreasedTimeScale(timeScale);
      expect(Number.isFinite(timeScale)).toBe(true);
      expect(timeScale).toBeGreaterThan(0);
    }
    expect(timeScale).toBe(TIME_SCALES[0]);
    for (let i = 0; i < 20; i += 1) {
      timeScale = increasedTimeScale(timeScale);
      expect(Number.isFinite(timeScale)).toBe(true);
    }
    expect(timeScale).toBe(TIME_SCALES.at(-1));
  });
});
