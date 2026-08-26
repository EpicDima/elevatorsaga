import { describe, expect, it } from "vitest";

import {
  computeShaftScale,
  shaftPadPx,
  CORRIDOR_PX,
  MAX_ZOOM,
  MIN_CORRIDOR_PX,
} from "./shaft-scale.ts";

describe("computeShaftScale", () => {
  it("returns scale 1 and no corridor when there are no elevators", () => {
    expect(computeShaftScale({ stageWidth: 1000, levelsWidth: 84, elevators: [] })).toEqual({
      scaleX: 1,
      corridorPx: 0,
      corridorWorld: 0,
    });
  });

  it("never shrinks a car that is already narrower than MIN_CAR, however little room there is", () => {
    // free (140) is under the corridor's own 200, leaving the band nothing at all, but a
    // capacity-2 car is already 20 world units wide, below MIN_CAR (60); min(1, 60/20)
    // clamps the floor to 1 so it isn't shrunk further.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 20, capacity: 2 },
        { worldX: 240, width: 20, capacity: 2 },
        { worldX: 280, width: 20, capacity: 2 },
        { worldX: 320, width: 20, capacity: 2 },
        { worldX: 360, width: 20, capacity: 2 },
      ],
    });
    expect(scale.scaleX).toBe(1);
  });

  it("draws a building with room to spare half again the size the engine states it at", () => {
    // (free - CORRIDOR_PX)/bandWidth = 440/100 = 4.4, so MAX_ZOOM caps it rather than growing the
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
    // (free - CORRIDOR_PX)/bandWidth = 216/180 = 1.2, binding below MAX_ZOOM: growing past the pane
    // would trade a wider car for a sideways scrollbar, which is the worse deal.
    const scale = computeShaftScale({
      stageWidth: 576,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(1.2, 4);
  });

  it("stops shrinking the capacity-4 cars most levels use at their own full size", () => {
    // min(1, 60/40) = 1 floors the scale, so the 176/220 = 0.8 the leftover room would
    // otherwise allow doesn't bind, and the stage scrolls sideways instead.
    const scale = computeShaftScale({
      stageWidth: 536,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 40, capacity: 4 },
        { worldX: 260, width: 40, capacity: 4 },
        { worldX: 320, width: 40, capacity: 4 },
        { worldX: 380, width: 40, capacity: 4 },
      ],
    });
    expect(scale.scaleX).toBe(1);
  });

  it("shrinks by the room-left-over ratio when that ratio is the binding constraint", () => {
    // free = max(120, 536-32-84-44) = 376, less the corridor's 200 = 176 for the band.
    // bandWidth = 320+100-200 = 220 (from the first car, the corridor held out).
    // value = 176/220 = 0.8; minShaftScale = 60/100 = 0.6 doesn't bind.
    const scale = computeShaftScale({
      stageWidth: 536,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 100, capacity: 10 },
        { worldX: 320, width: 100, capacity: 10 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.8, 4);
  });

  it("floors scaleX at minShaftScale when the room left over would shrink cars past MIN_CAR", () => {
    // free (140) is under the corridor's own 200, so the band's share is negative, but
    // minShaftScale = 60/80 = 0.75 binds instead: below it a car would be narrower than
    // MIN_CAR allows.
    const scale = computeShaftScale({
      stageWidth: 300,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 80, capacity: 8 },
        { worldX: 300, width: 80, capacity: 8 },
        { worldX: 400, width: 80, capacity: 8 },
        { worldX: 500, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBeCloseTo(0.75, 4);
  });

  it("holds the corridor out of the fit, so how far the cars stand from the wall never moves the scale", () => {
    // The same two cars, twice: once where they stand, once shifted 200 world units
    // right. The walk in front of them is drawn at CORRIDOR_PX either way, so the
    // shafts are scaled the same and the corridor reads the same width on both.
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
    expect(far.scaleX).toBe(near.scaleX);
    expect(far.corridorPx).toBe(CORRIDOR_PX);
    expect(near.corridorPx).toBe(CORRIDOR_PX);
    // Only the world span each maps onto that fixed width differs.
    expect(near.corridorWorld).toBe(200);
    expect(far.corridorWorld).toBe(400);
  });

  it("gives corridor pixels back once the cars have hit MIN_CAR and the building still spills", () => {
    // The busiest level of chapter one: eight cars of capacity 6 and 8, in 835px of free
    // room. minShaftScale (60/60 = 1) floors the scale, so the 700-unit band cannot shrink
    // at all; holding the full 200px corridor anyway would push the building 65px past the
    // pane. The walk gives that up instead of the cars.
    const scale = computeShaftScale({
      stageWidth: 995,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 60, capacity: 6 },
        { worldX: 280, width: 80, capacity: 8 },
        { worldX: 380, width: 60, capacity: 6 },
        { worldX: 460, width: 80, capacity: 8 },
        { worldX: 560, width: 60, capacity: 6 },
        { worldX: 640, width: 80, capacity: 8 },
        { worldX: 740, width: 60, capacity: 6 },
        { worldX: 820, width: 80, capacity: 8 },
      ],
    });
    expect(scale.scaleX).toBe(1);
    expect(scale.corridorPx).toBe(135);
    expect(scale.corridorPx).toBeGreaterThan(MIN_CORRIDOR_PX);
  });

  it("never squeezes the corridor past MIN_CORRIDOR_PX, however little room is left", () => {
    // A pane far too narrow for this building: the band alone takes 660px of the 120px
    // floor `free` never goes below, so the leftover is deeply negative. The corridor stops
    // at its own floor and the stage scrolls sideways from there.
    const scale = computeShaftScale({
      stageWidth: 200,
      levelsWidth: 84,
      elevators: [
        { worldX: 200, width: 60, capacity: 6 },
        { worldX: 280, width: 60, capacity: 6 },
        { worldX: 360, width: 60, capacity: 6 },
        { worldX: 800, width: 60, capacity: 6 },
      ],
    });
    expect(scale.scaleX).toBe(1);
    expect(scale.corridorPx).toBe(MIN_CORRIDOR_PX);
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

  it("leaves a visible seam between two neighboring shafts at every scale in range", () => {
    // Two capacity-10 cars, 20 world units apart, drawn exactly as the widget draws them:
    // each edge rounded to a whole pixel, each shaft grown by one pad per side. Swept in
    // hundredths from 0.30 - under anything the fit now produces - to MAX_ZOOM, since it is
    // the rounding, not the arithmetic, that closed this seam at scaleX 0.32.
    for (let step = 30; step <= MAX_ZOOM * 100; step++) {
      const scaleX = step / 100;
      const pad = shaftPadPx(scaleX);
      const left = Math.round(200 * scaleX) - pad;
      const width = Math.round(100 * scaleX) + 2 * pad;
      const nextLeft = Math.round(320 * scaleX) - pad;
      expect(nextLeft - (left + width), `scaleX ${String(scaleX)}`).toBeGreaterThan(0);
    }
  });
});
