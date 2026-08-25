import { describe, expect, it } from "vitest";

import { positionCardOverTile } from "./place-card.ts";
import type { Rect } from "#shared/lib/smart-position.ts";

/** Builds a `Rect` from a top-left corner and a size — every field a real `DOMRect` carries. */
function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

/** A strip the width of a game pane, docked at the foot of a 900px window. */
const STRIP: Rect = rect(0, 780, 800, 120);

describe("positionCardOverTile", () => {
  it("stands the card on the tile, aligned with its leading edge", () => {
    const tile = rect(200, 800, 160, 60);
    const position = positionCardOverTile(tile, STRIP, 240, 100);
    // x = 200 - 0; y = 800 - 780 - 100 = -80, which is 80px above the strip.
    expect(position).toEqual({ x: 200, y: -80 });
  });

  it("raises a card off the top row clear of the strip altogether", () => {
    const tile = rect(0, 780, 200, 56);
    const position = positionCardOverTile(tile, STRIP, 240, 100);
    // The primary row starts at the strip's own top edge, so the whole card is
    // outside it — which is the placement, not an overflow to be corrected.
    expect(position.y).toBe(-100);
  });

  it("pulls a card off the last tile in a row back inside the strip", () => {
    const tile = rect(640, 800, 160, 60);
    const position = positionCardOverTile(tile, STRIP, 240, 100);
    // Aligned with the tile it would start at 640 and run 80px past the strip;
    // clamped to 800 - 240 - 6 = 554 instead.
    expect(position.x).toBe(554);
  });

  it("keeps the card off the strip's leading edge", () => {
    const tile = rect(-2, 800, 160, 60);
    const position = positionCardOverTile(tile, STRIP, 240, 100);
    expect(position.x).toBe(6);
  });

  it("gives a card wider than the strip the leading margin rather than a negative one", () => {
    // The pane can be dragged narrower than the card is wide, and a clamp
    // written as a bare upper bound would then push the card off the near edge
    // to keep it off the far one.
    const narrow = rect(0, 780, 200, 120);
    const position = positionCardOverTile(rect(100, 800, 100, 60), narrow, 240, 100);
    expect(position.x).toBe(6);
  });
});
