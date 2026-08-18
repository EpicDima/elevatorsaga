import { describe, expect, it } from "vitest";

import { positionAboveAnchor, positionBesideAnchor } from "./smart-position.ts";
import type { Rect } from "./smart-position.ts";

/** A generously sized container, so the finishing clamp is a no-op unless a test means to trigger it. */
const ROOMY_WRAP: Rect = { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };

/** Builds a `Rect` from a top-left corner and a size — every field a real `DOMRect` carries. */
function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe("positionBesideAnchor", () => {
  it("places the card to the anchor's left, vertically centered on it", () => {
    const anchor = rect(400, 200, 60, 60);
    const position = positionBesideAnchor(anchor, ROOMY_WRAP, 150, 100);
    // x = 400 - 150 - 10 = 240; y = 200 + 30 - 50 = 180.
    expect(position).toEqual({ x: 240, y: 180 });
  });

  it("flips to the anchor's right when the left placement would clip the wrap's edge", () => {
    const anchor = rect(20, 200, 60, 60);
    const position = positionBesideAnchor(anchor, ROOMY_WRAP, 150, 100);
    // Left placement: 20 - 150 - 10 = -140, under the 6px margin, so it
    // flips to the right instead: 80 + 10 = 90.
    expect(position).toEqual({ x: 90, y: 180 });
  });

  it("clamps the flipped placement back inside the wrap's right edge", () => {
    const anchor = rect(100, 200, 790, 60);
    const position = positionBesideAnchor(anchor, ROOMY_WRAP, 150, 100);
    // Flips right (890 + 10 = 900), then clamps to 1000 - 150 - 6 = 844.
    expect(position).toEqual({ x: 844, y: 180 });
  });

  it("clamps the default left placement back inside the wrap's top edge", () => {
    const anchor = rect(400, 0, 60, 20);
    const position = positionBesideAnchor(anchor, ROOMY_WRAP, 150, 100);
    // y = 0 + 10 - 50 = -40, clamped up to the 6px margin.
    expect(position).toEqual({ x: 240, y: 6 });
  });

  it("clamps the vertical centering back inside the wrap's bottom edge", () => {
    const anchor = rect(400, 750, 60, 40);
    const position = positionBesideAnchor(anchor, ROOMY_WRAP, 150, 100);
    // y = 750 + 20 - 50 = 720, clamped down to 800 - 100 - 6 = 694.
    expect(position).toEqual({ x: 240, y: 694 });
  });

  it("holds x at the 6px margin, not a negative bound, when the wrap is narrower than the card", () => {
    const narrowWrap: Rect = { left: 0, top: 0, right: 100, bottom: 800, width: 100, height: 800 };
    const anchor = rect(50, 200, 40, 60);
    const position = positionBesideAnchor(anchor, narrowWrap, 150, 100);
    // Flips right (100), but 100 - 150 - 6 is negative, so Math.max(6, ...)
    // holds the upper clamp bound at 6 too — the card sits at the margin.
    expect(position).toEqual({ x: 6, y: 180 });
  });
});

describe("positionAboveAnchor", () => {
  it("places the card above the anchor, right-aligned with it", () => {
    const anchor = rect(300, 300, 200, 60);
    const position = positionAboveAnchor(anchor, ROOMY_WRAP, 150, 100);
    // x = 500 - 150 = 350; y = 300 - 100 - 8 = 192.
    expect(position).toEqual({ x: 350, y: 192 });
  });

  it("flips to below the anchor when the above placement would clip the wrap's edge", () => {
    const anchor = rect(300, 10, 200, 60);
    const position = positionAboveAnchor(anchor, ROOMY_WRAP, 150, 100);
    // Above placement: 10 - 100 - 8 = -98, under the 6px margin, so it flips
    // to below instead: 70 + 8 = 78.
    expect(position).toEqual({ x: 350, y: 78 });
  });

  it("clamps the default placement back inside the wrap's left edge", () => {
    const anchor = rect(0, 300, 50, 60);
    const position = positionAboveAnchor(anchor, ROOMY_WRAP, 150, 100);
    // x = 50 - 150 = -100, clamped up to the 6px margin.
    expect(position).toEqual({ x: 6, y: 192 });
  });
});
