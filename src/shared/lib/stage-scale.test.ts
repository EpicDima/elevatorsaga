import { describe, expect, it } from "vitest";

import { unscaled, worldXToPx, type StageScale } from "./stage-scale.ts";

/** A building whose 200-unit corridor is drawn at 200px, with shafts at half size beyond it. */
const halved: StageScale = { scaleX: 0.5, scaleY: 1, corridorPx: 200, corridorWorld: 200 };

describe("worldXToPx", () => {
  it("draws the corridor at its fixed width, whatever the shafts are scaled to", () => {
    expect(worldXToPx(halved, 0)).toBe(0);
    expect(worldXToPx(halved, 100)).toBe(100);
    expect(worldXToPx(halved, 200)).toBe(200);
  });

  it("scales the shaft band past the corridor, and only that band", () => {
    // 80 world units past the corridor, at half size: 200 + 40.
    expect(worldXToPx(halved, 280)).toBe(240);
  });

  it("is continuous at the corridor's edge, so a walk into a car never jumps", () => {
    const edge = worldXToPx(halved, 200);
    expect(worldXToPx(halved, 200 - 1e-9)).toBeCloseTo(edge, 6);
    expect(worldXToPx(halved, 200 + 1e-9)).toBeCloseTo(edge, 6);
  });

  it("stretches a corridor drawn wider than its world span, keeping both ends pinned", () => {
    const stretched: StageScale = { scaleX: 1, scaleY: 1, corridorPx: 300, corridorWorld: 200 };
    expect(worldXToPx(stretched, 100)).toBe(150);
    expect(worldXToPx(stretched, 200)).toBe(300);
  });

  it("falls back to a plain scale when there is no corridor to hold out", () => {
    // What a world with no elevators gets: nothing stands right of the walk, so there is
    // no band to scale separately and dividing by the corridor's span would be a zero divide.
    const noCorridor: StageScale = { ...unscaled(), scaleX: 2 };
    expect(worldXToPx(noCorridor, 50)).toBe(100);
  });
});

describe("unscaled", () => {
  it("maps world units 1:1", () => {
    expect(worldXToPx(unscaled(), 123)).toBe(123);
  });

  it("hands back a fresh cell each call, since callers write to it in place", () => {
    const first = unscaled();
    first.scaleX = 3;
    expect(unscaled().scaleX).toBe(1);
  });
});
