import { describe, expect, it } from "vitest";

import { computeShaftScale } from "./shaft-scale.ts";

describe("computeShaftScale", () => {
  it("returns scale 1 when there are no elevators", () => {
    expect(computeShaftScale({ stageWidth: 1000, levelsWidth: 84, elevators: [] })).toEqual({
      scaleX: 1,
    });
  });

  it("never shrinks a car that is already narrower than MIN_CAR, however little room there is", () => {
    // free = max(120, 300-32-84-44) = 140, naturalWidth = 240+20 = 260, so the
    // ratio asks for 0.538. But a capacity-2 car is 20 world units wide, below
    // MIN_CAR (30) at full size already, and shrinking it further would be the
    // one thing this floor exists to refuse: min(1, 30/20) clamps to 1.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 20, capacity: 2 },
        { worldX: 240, width: 20, capacity: 2 },
      ],
    });
    expect(scale.scaleX).toBe(1);
  });

  it("still shrinks the capacity-4 cars most challenges use", () => {
    // The regression this floor was rewritten for. A capacity-4 car is 40 world
    // units wide, and the floor used to be `layout-building.ts`'s MIN_SHAFT of
    // 46 — a floor *above* the car's own width, so 46/40 = 1.15 pinned the low
    // bound to 1 and the fit never engaged on any of the challenges that use
    // capacity 4, which is most of them. min(1, 30/40) = 0.75 lets it.
    //
    // free = max(120, 400-32-84-44) = 240, naturalWidth = 260+40 = 300, so the
    // ratio is 0.8 and it is the ratio that binds.
    const scale = computeShaftScale({
      stageWidth: 400,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 40, capacity: 4 },
        { worldX: 260, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.8, 4);
  });

  it("shrinks by the free/naturalWidth ratio when that ratio is the binding constraint", () => {
    // free = max(120, 500-32-84-44) = 340.
    // naturalWidth = 300+80 = 380 (from world x 0, corridor included).
    // value = 340/380 = 0.8947; minShaftScale = 30/80 = 0.375 doesn't bind.
    const scale = computeShaftScale({
      stageWidth: 500,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.8947, 4);
  });

  it("floors scaleX at minShaftScale when the free/naturalWidth ratio would shrink cars past MIN_CAR", () => {
    // free floors at 120 (300-32-84-44 = 140, so 140 here).
    // naturalWidth = 400+80 = 480. value = 140/480 = 0.2917.
    // minShaftScale = 30/80 = 0.375, which binds instead: below it a car is
    // narrower than a car should ever be drawn, and the stage scrolls sideways.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
        { worldX: 400, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.375, 4);
  });

  it("counts the corridor in the span it fits, not as a fixed budget taken off the top", () => {
    // The same two cars, twice: once where they stand, once shifted 200 world
    // units right. A formula that measured only the shafts would return the
    // same scale for both and draw the second building off the stage.
    const near = computeShaftScale({
      stageWidth: 600,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
      ],
    });
    const far = computeShaftScale({
      stageWidth: 600,
      levelsWidth: 84,
      elevators: [
        { worldX: 400, width: 80, capacity: 8 },
        { worldX: 500, width: 80, capacity: 8 },
      ],
    });
    expect(far.scaleX).toBeLessThan(near.scaleX);
  });
});
