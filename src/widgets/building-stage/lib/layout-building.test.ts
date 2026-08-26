import { describe, expect, it } from "vitest";

import { layoutBuilding, MIN_FLOOR } from "./layout-building.ts";

/** A single floor's worth of weight, repeated — the game's own default today. */
function uniformWeights(count: number): number[] {
  return Array.from({ length: count }, () => 1);
}

describe("layoutBuilding", () => {
  it("clamps the per-weight unit up to MIN_FLOOR when the stage can't fit every floor otherwise", () => {
    // room = max(160, 1000-38) = 962; 962/25 = 38.48, below MIN_FLOOR.
    const layout = layoutBuilding({ stageHeight: 1000, floorWeights: uniformWeights(25) });
    expect(layout.floorHeights).toEqual(uniformWeights(25).map(() => MIN_FLOOR));
    expect(layout.shortestFloor).toBe(MIN_FLOOR);
    expect(layout.totalHeight).toBe(25 * MIN_FLOOR);
    expect(layout.carHeight).toBe(46);
    expect(layout.density).toBe("compact");
  });

  it("floors the stage's usable room at 160px even when the stage is shorter still", () => {
    // stageHeight-38 = 12, which would give unit = 6 if room weren't floored —
    // floored to 160 instead gives unit = 80, distinct from both bounds.
    const layout = layoutBuilding({ stageHeight: 50, floorWeights: uniformWeights(2) });
    expect(layout.floorHeights).toEqual([80, 80]);
    expect(layout.totalHeight).toBe(160);
  });

  it("clamps the per-weight unit down to 96 when the stage has room to spare", () => {
    // room = max(160, 2038-38) = 2000; 2000/2 = 1000, above the 96 ceiling.
    const layout = layoutBuilding({ stageHeight: 2038, floorWeights: uniformWeights(2) });
    expect(layout.floorHeights).toEqual([96, 96]);
    expect(layout.shortestFloor).toBe(96);
    expect(layout.carHeight).toBe(88);
    expect(layout.density).toBe("full");
  });

  it("distributes uneven weights by cumulative rounding, not per-floor rounding", () => {
    // unit = 222/4 = 55.5; cumulative rounding gives [56, 111, 55] summing to exactly 222,
    // where rounding each floor independently would give 56+111+56 = 223.
    const layout = layoutBuilding({ stageHeight: 260, floorWeights: [1, 2, 1] });
    expect(layout.floorHeights).toEqual([56, 111, 55]);
    expect(layout.floorBottoms).toEqual([0, 56, 167]);
    expect(layout.totalHeight).toBe(222);
  });

  it("is 'full' density at exactly the 58px threshold", () => {
    // room = 232, weightSum = 4, unit = 58 exactly.
    const layout = layoutBuilding({ stageHeight: 270, floorWeights: uniformWeights(4) });
    expect(layout.shortestFloor).toBe(58);
    expect(layout.density).toBe("full");
  });

  it("is 'compact' density one pixel below the 58px threshold", () => {
    // room = 228, weightSum = 4, unit = 57 exactly.
    const layout = layoutBuilding({ stageHeight: 266, floorWeights: uniformWeights(4) });
    expect(layout.shortestFloor).toBe(57);
    expect(layout.density).toBe("compact");
  });

  it("lays out a twenty-floor sandbox world end to end", () => {
    // unit = clamp(54, (max(160,762))/20 = 38.1, 96) = 54 (MIN_FLOOR binds).
    const layout = layoutBuilding({ stageHeight: 800, floorWeights: uniformWeights(20) });
    expect(layout.floorHeights).toEqual(uniformWeights(20).map(() => 54));
    expect(layout.floorBottoms.at(-1)).toBe(19 * 54);
    expect(layout.totalHeight).toBe(1080);
    expect(layout.shortestFloor).toBe(54);
    expect(layout.carHeight).toBe(46);
    expect(layout.density).toBe("compact");
  });
});
