import { describe, expect, it } from "vitest";

import { computeShaftScale } from "./shaft-scale.ts";

describe("computeShaftScale", () => {
  it("returns scale 1 with nothing to scale when there are no elevators", () => {
    expect(
      computeShaftScale({ stageWidth: 1000, levelsWidth: 84, carHeight: 50, elevators: [] }),
    ).toEqual({
      scaleX: 1,
      counted: [],
    });
  });

  it("pins scaleX to exactly 1 whenever a car is already narrower than MIN_SHAFT, regardless of free space", () => {
    // width 40 < MIN_SHAFT (46), so minShaftScale = 46/40 = 1.15 > 1, which
    // pins clamp's low bound to 1 — and its high bound is always 1 — so the
    // free/naturalWidth ratio (16.92 here) never gets a say.
    const scale = computeShaftScale({
      stageWidth: 2000,
      levelsWidth: 84,
      carHeight: 50,
      elevators: [
        { worldX: 200, width: 40, capacity: 4 },
        { worldX: 260, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBe(1);
  });

  it("shrinks by the free/naturalWidth ratio when that ratio is the binding constraint", () => {
    // free = max(120, 300-32-84-170-22) = max(120, -8) = 120.
    // naturalWidth = (300+80) - 200 = 180. value = 120/180 = 0.6667.
    // minShaftScale = 46/80 = 0.575, so low = 0.575 doesn't bind; value does.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      carHeight: 50,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.6667, 4);
  });

  it("floors scaleX at minShaftScale when the free/naturalWidth ratio would shrink cars past MIN_SHAFT", () => {
    // free floors at 120 (300-32-84-170-22 is negative).
    // naturalWidth = (400+80) - 200 = 280. value = 120/280 = 0.4286.
    // minShaftScale = 46/80 = 0.575, which now binds instead of value.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      carHeight: 50,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
        { worldX: 400, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.575, 4);
  });

  it("marks a car counted once its rendered width is too narrow for one rider glyph per seat", () => {
    // carHeight 20: riderWidth = round(clamp(8, 20-22, 16) * 0.55) + 1
    //             = round(clamp(8, -2, 16) * 0.55) + 1 = round(8*0.55)+1 = 5.
    // scaleX pinned to 1 (both cars narrower than MIN_SHAFT: 46/30, 46/40 > 1).
    // capacity 3: inner = 30-19 = 11; 3*5=15 > 11 -> counted.
    // capacity 4: inner = 40-19 = 21; 4*5=20 > 21 is false -> not counted.
    const scale = computeShaftScale({
      stageWidth: 1000,
      levelsWidth: 84,
      carHeight: 20,
      elevators: [
        { worldX: 200, width: 30, capacity: 3 },
        { worldX: 250, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBe(1);
    expect(scale.counted).toEqual([true, false]);
  });
});
