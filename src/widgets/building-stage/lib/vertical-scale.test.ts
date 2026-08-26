import { describe, expect, it } from "vitest";

import { computeVerticalScale } from "./vertical-scale.ts";

describe("computeVerticalScale", () => {
  it("is 1 when the building's pixel height already matches the world 1:1", () => {
    expect(computeVerticalScale({ totalHeight: 200, floorCount: 4, floorHeight: 50 })).toBe(1);
  });

  it("scales up when the building is drawn taller than the world's own units", () => {
    expect(computeVerticalScale({ totalHeight: 400, floorCount: 4, floorHeight: 50 })).toBe(2);
  });

  it("scales down when the building is drawn shorter than the world's own units", () => {
    // Ten floors drawn at 48px each against a 50px world floor: a building
    // squeezed shorter than the world it stands for.
    expect(computeVerticalScale({ totalHeight: 480, floorCount: 10, floorHeight: 50 })).toBe(0.96);
  });

  it("falls back to 1 for an empty world rather than dividing by zero", () => {
    expect(computeVerticalScale({ totalHeight: 0, floorCount: 0, floorHeight: 50 })).toBe(1);
  });

  it("falls back to 1 for a zero floor height rather than dividing by zero", () => {
    expect(computeVerticalScale({ totalHeight: 200, floorCount: 4, floorHeight: 0 })).toBe(1);
  });
});
