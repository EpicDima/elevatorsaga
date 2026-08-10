import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_INTERPOLATOR,
  EPSILON,
  accelerationNeededToAchieveChangeDistance,
  coolInterpolate,
  distanceNeededToAchieveSpeed,
  epsilonEquals,
  limitNumber,
  linearInterpolate,
  powInterpolate,
  randomInt,
} from "./math.ts";

describe("limitNumber", () => {
  it("returns the value untouched when it is inside the range", () => {
    expect(limitNumber(5, 0, 10)).toBe(5);
    expect(limitNumber(-2.5, -10, 10)).toBe(-2.5);
  });

  it("clamps to the lower bound when below the range", () => {
    expect(limitNumber(-1, 0, 10)).toBe(0);
    expect(limitNumber(-100, -10, 10)).toBe(-10);
  });

  it("clamps to the upper bound when above the range", () => {
    expect(limitNumber(11, 0, 10)).toBe(10);
    expect(limitNumber(100, -10, 10)).toBe(10);
  });

  it("returns the bounds themselves unchanged", () => {
    expect(limitNumber(0, 0, 10)).toBe(0);
    expect(limitNumber(10, 0, 10)).toBe(10);
  });

  it("lets max win for an inverted range, matching the legacy implementation", () => {
    // Math.min(max, Math.max(num, min)) => Math.min(1, 5) === 1
    expect(limitNumber(3, 5, 1)).toBe(1);
  });
});

describe("epsilonEquals", () => {
  it("uses the exact legacy tolerance", () => {
    expect(EPSILON).toBe(0.00000001);
  });

  it("treats identical values as equal", () => {
    expect(epsilonEquals(1.25, 1.25)).toBe(true);
    expect(epsilonEquals(0, 0)).toBe(true);
  });

  it("is true just below the epsilon boundary", () => {
    expect(epsilonEquals(0, 9.999e-9)).toBe(true);
    expect(epsilonEquals(1, 1 + 9e-9)).toBe(true);
  });

  it("is false exactly at the epsilon boundary (strict less-than)", () => {
    expect(epsilonEquals(0, 1e-8)).toBe(false);
  });

  it("is false just above the epsilon boundary", () => {
    expect(epsilonEquals(0, 1.0001e-8)).toBe(false);
    expect(epsilonEquals(0, 1e-7)).toBe(false);
  });

  it("is symmetric and sign-agnostic", () => {
    expect(epsilonEquals(-9e-9, 0)).toBe(true);
    expect(epsilonEquals(0, -9e-9)).toBe(true);
    expect(epsilonEquals(-1e-7, 0)).toBe(false);
  });
});

describe("distanceNeededToAchieveSpeed", () => {
  it("computes (v^2 - u^2) / (2a) for acceleration from rest", () => {
    // u = 0, v = 10, a = 5 -> (100 - 0) / 10 = 10
    expect(distanceNeededToAchieveSpeed(0, 10, 5)).toBe(10);
  });

  it("computes a positive distance when decelerating with negative acceleration", () => {
    // u = 3, v = 1, a = -2 -> (1 - 9) / -4 = 2
    expect(distanceNeededToAchieveSpeed(3, 1, -2)).toBe(2);
  });

  it("returns zero when the speed does not change", () => {
    expect(distanceNeededToAchieveSpeed(4, 4, 2)).toBe(0);
  });

  it("returns a negative distance when the sign of acceleration opposes the change", () => {
    // u = 0, v = 10, a = -5 -> 100 / -10 = -10
    expect(distanceNeededToAchieveSpeed(0, 10, -5)).toBe(-10);
  });

  it("is non-finite for zero acceleration", () => {
    expect(distanceNeededToAchieveSpeed(0, 10, 0)).toBe(Infinity);
  });
});

describe("accelerationNeededToAchieveChangeDistance", () => {
  it("computes 0.5 * ((v^2 - u^2) / d)", () => {
    // u = 0, v = 10, d = 10 -> 0.5 * (100 / 10) = 5
    expect(accelerationNeededToAchieveChangeDistance(0, 10, 10)).toBe(5);
  });

  it("computes a negative acceleration when slowing down", () => {
    // u = 3, v = 1, d = 2 -> 0.5 * (-8 / 2) = -2
    expect(accelerationNeededToAchieveChangeDistance(3, 1, 2)).toBe(-2);
  });

  it("returns zero when the speed does not change", () => {
    expect(accelerationNeededToAchieveChangeDistance(4, 4, 8)).toBe(0);
  });

  it("is non-finite for zero distance", () => {
    expect(accelerationNeededToAchieveChangeDistance(0, 10, 0)).toBe(Infinity);
  });

  it("round-trips with distanceNeededToAchieveSpeed", () => {
    const u = 1.5;
    const v = 4.25;
    const a = 0.75;

    const distance = distanceNeededToAchieveSpeed(u, v, a);
    const acceleration = accelerationNeededToAchieveChangeDistance(u, v, distance);

    expect(epsilonEquals(acceleration, a)).toBe(true);
  });
});

describe("linearInterpolate", () => {
  it("returns the endpoints at x = 0 and x = 1", () => {
    expect(linearInterpolate(2, 10, 0)).toBe(2);
    expect(linearInterpolate(2, 10, 1)).toBe(10);
  });

  it("returns the midpoint at x = 0.5", () => {
    expect(linearInterpolate(2, 10, 0.5)).toBe(6);
  });

  it("extrapolates outside [0, 1]", () => {
    expect(linearInterpolate(0, 10, 2)).toBe(20);
    expect(linearInterpolate(0, 10, -1)).toBe(-10);
  });

  it("works with a descending range", () => {
    expect(linearInterpolate(10, 2, 0.25)).toBe(8);
  });
});

describe("powInterpolate", () => {
  it("returns the endpoints at x = 0 and x = 1", () => {
    expect(powInterpolate(2, 10, 0, 1.3)).toBe(2);
    expect(powInterpolate(2, 10, 1, 1.3)).toBe(10);
  });

  it("is symmetric around the midpoint", () => {
    expect(powInterpolate(0, 1, 0.5, 1.3)).toBeCloseTo(0.5, 12);
  });

  it("degenerates to linear interpolation for a = 1", () => {
    expect(powInterpolate(0, 10, 0.25, 1)).toBeCloseTo(2.5, 12);
    expect(powInterpolate(0, 10, 0.75, 1)).toBeCloseTo(7.5, 12);
  });

  it("eases in for a > 1", () => {
    // A steeper exponent keeps the value closer to value0 early on.
    expect(powInterpolate(0, 1, 0.25, 1.3)).toBeLessThan(0.25);
    expect(powInterpolate(0, 1, 0.75, 1.3)).toBeGreaterThan(0.75);
  });
});

describe("coolInterpolate", () => {
  it("is powInterpolate with the legacy exponent 1.3", () => {
    for (const x of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(coolInterpolate(3, 17, x)).toBe(powInterpolate(3, 17, x, 1.3));
    }
  });

  it("is the default interpolator", () => {
    expect(DEFAULT_INTERPOLATOR).toBe(coolInterpolate);
  });
});

describe("randomInt", () => {
  it("is inclusive on both ends", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      seen.add(randomInt(0, 2));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("only ever returns values inside the range", () => {
    for (let i = 0; i < 2000; i++) {
      const value = randomInt(55, 100);
      expect(value).toBeGreaterThanOrEqual(55);
      expect(value).toBeLessThanOrEqual(100);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("returns the only possible value for a single-value range", () => {
    expect(randomInt(7, 7)).toBe(7);
  });

  it("maps the extremes of Math.random to min and max", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0);
    expect(randomInt(0, 40)).toBe(0);
    random.mockReturnValue(0.9999999999);
    expect(randomInt(0, 40)).toBe(40);
    random.mockRestore();
  });
});
