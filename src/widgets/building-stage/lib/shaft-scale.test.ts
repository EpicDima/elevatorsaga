import { describe, expect, it } from "vitest";

import { computeShaftScale, shaftPadPx, MAX_ZOOM } from "./shaft-scale.ts";

describe("computeShaftScale", () => {
  it("returns scale 1 when there are no elevators", () => {
    expect(computeShaftScale({ stageWidth: 1000, levelsWidth: 84, elevators: [] })).toEqual({
      scaleX: 1,
    });
  });

  it("never shrinks a car that is already narrower than MIN_CAR, however little room there is", () => {
    // free/naturalWidth = 140/260 = 0.538, but a capacity-2 car is already 20 world units
    // wide, below MIN_CAR (30); min(1, 30/20) clamps the floor to 1 so it isn't shrunk further.
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

  it("draws a building with room to spare half again the size the engine states it at", () => {
    // free/naturalWidth = 640/300 = 2.13, so MAX_ZOOM caps it rather than growing the
    // building past the pane's own room to spare.
    const scale = computeShaftScale({
      stageWidth: 800,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 40, capacity: 4 },
        { worldX: 260, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBe(MAX_ZOOM);
  });

  it("grows a building only as far as its own pane, when the pane stops first", () => {
    // free/naturalWidth = 360/300 = 1.2, binding below MAX_ZOOM: growing past the pane
    // would trade a wider car for a sideways scrollbar, which is the worse deal.
    const scale = computeShaftScale({
      stageWidth: 520,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 40, capacity: 4 },
        { worldX: 260, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(1.2, 4);
  });

  it("still shrinks the capacity-4 cars most levels use", () => {
    // min(1, 30/40) = 0.75 leaves room for the ratio to bind: free/naturalWidth =
    // 240/300 = 0.8, below 1 rather than pinned there by too-high a floor.
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
    // free/naturalWidth = 140/480 = 0.2917, but minShaftScale = 30/80 = 0.375 binds
    // instead: below it a car would be narrower than MIN_CAR allows.
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

describe("shaftPadPx", () => {
  it("takes 8 world units per side at full size", () => {
    expect(shaftPadPx(1)).toBe(8);
  });

  it("shrinks with the building, so the seam between two shafts shrinks with it too", () => {
    expect(shaftPadPx(0.5)).toBe(4);
  });

  it("never rounds away to nothing", () => {
    // At the smallest scale, 8 * scaleX rounds to 1px or 0, which would leave the order
    // marks that sit inside this pad with nowhere to be drawn.
    expect(shaftPadPx(0.1)).toBe(2);
    expect(shaftPadPx(0)).toBe(2);
  });

  it("leaves a visible seam between two neighboring shafts at every scale it floors", () => {
    // Two cars are 20 world units apart, and each takes its pad from that gap; checked
    // across the whole range, from MIN_CAR's floor on scaleX (30/80 = 0.375) to MAX_ZOOM.
    for (const scaleX of [0.375, 0.5, 0.75, 1, MAX_ZOOM]) {
      expect(20 * scaleX - 2 * shaftPadPx(scaleX)).toBeGreaterThan(0);
    }
  });
});
