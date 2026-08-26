import { describe, expect, it } from "vitest";

import { layoutBuilding, COMPACT_FLOOR, ROOMY_FLOOR, TALL_FLOOR_COUNT } from "./layout-building.ts";

describe("layoutBuilding", () => {
  it("draws a building under TALL_FLOOR_COUNT floors at the roomy height", () => {
    const layout = layoutBuilding({ floorCount: TALL_FLOOR_COUNT - 1 });
    expect(layout.floorHeight).toBe(ROOMY_FLOOR);
    expect(layout.totalHeight).toBe((TALL_FLOOR_COUNT - 1) * ROOMY_FLOOR);
    expect(layout.carHeight).toBe(72);
    expect(layout.density).toBe("full");
  });

  it("drops to the compact height at exactly TALL_FLOOR_COUNT floors", () => {
    const layout = layoutBuilding({ floorCount: TALL_FLOOR_COUNT });
    expect(layout.floorHeight).toBe(COMPACT_FLOOR);
    expect(layout.totalHeight).toBe(TALL_FLOOR_COUNT * COMPACT_FLOOR);
    expect(layout.carHeight).toBe(46);
    expect(layout.density).toBe("compact");
  });

  it("draws the game's tallest building at the compact height too", () => {
    // 21 floors, the tallest the game has: a screen and a half of scrolling.
    expect(layoutBuilding({ floorCount: 21 })).toEqual({
      floorHeight: 54,
      totalHeight: 1134,
      carHeight: 46,
      density: "compact",
    });
  });

  it("gives the game's every level one of exactly two floor heights", () => {
    // Every real floor count, three to twenty-one, and a sandbox's own range past it.
    const heights = new Set<number>();
    for (let floorCount = 3; floorCount <= 100; floorCount += 1) {
      heights.add(layoutBuilding({ floorCount }).floorHeight);
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([COMPACT_FLOOR, ROOMY_FLOOR]);
  });

  it("splits where no level stands, so no building is one floor from resizing", () => {
    // The game's floor counts run 3 to 9 and then 12, 13 and 21; nothing sits on either
    // side of the line, so adding or removing a floor never resizes a level's building.
    const levelFloorCounts = [3, 5, 5, 8, 6, 4, 3, 6, 7, 13, 9, 9, 9, 9, 8, 12, 21, 21, 8];
    expect(levelFloorCounts).not.toContain(TALL_FLOOR_COUNT);
    expect(levelFloorCounts).not.toContain(TALL_FLOOR_COUNT + 1);
  });

  it("gives an empty world no height rather than a negative one", () => {
    expect(layoutBuilding({ floorCount: 0 }).totalHeight).toBe(0);
    expect(layoutBuilding({ floorCount: -3 }).totalHeight).toBe(0);
  });

  it("draws a floor tall enough for its call lamps at the roomy height, and not at the compact one", () => {
    // The density flag follows the height rather than being set beside it, so the two
    // constants can't drift apart from the threshold the stylesheet is written against.
    expect(ROOMY_FLOOR).toBeGreaterThan(COMPACT_FLOOR);
    expect(layoutBuilding({ floorCount: 1 }).density).toBe("full");
    expect(layoutBuilding({ floorCount: 40 }).density).toBe("compact");
  });
});
