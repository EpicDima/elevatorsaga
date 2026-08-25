/**
 * Placing the card that explains one tile of the figures strip.
 *
 * `shared/lib/smart-position.ts` holds the two placements the building uses and
 * neither fits here, because both clamp the card inside the box it is measured
 * against. That is right for a card raised inside the stage, which is most of a
 * pane tall, and wrong for this one: the strip is a row or two of tiles, shorter
 * than the card it has to raise, so a card held inside it would be drawn over
 * the very figure it explains. This card leaves the strip through the top and is
 * drawn across the building, which has the room.
 *
 * Pure geometry, like that module: plain rectangles in, a position out, so it
 * runs the same under Node as in a browser.
 */

import type { CardPosition, Rect } from "#shared/lib/smart-position.ts";

/** How close to the strip's side the card may come before it is pulled back in. */
const EDGE_MARGIN = 6;

/**
 * Holds a value inside `[low, high]`.
 *
 * @param low - The lowest value to return.
 * @param value - The value to clamp.
 * @param high - The highest value to return.
 */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Places the card on top of its tile, aligned with the tile's leading edge.
 *
 * Flush against the tile rather than a gap above it, on purpose: a pointer
 * travelling up from the figure to read the card crosses no strip in between,
 * so the card is still up when the pointer arrives on it. A tooltip that
 * vanishes on the way to being read is WCAG 1.4.13's "hoverable" leg, and a
 * gap of a few pixels is all it takes to fail it.
 *
 * Only the inline axis is clamped, and the `y` this returns is normally
 * negative. Above the strip is where the card belongs — the strip is the last
 * row of the pane, so there is nothing below it to raise a card into.
 *
 * @param tile - The tile being explained.
 * @param strip - The panel both the tile and the card live inside.
 * @param cardWidth - The card's width in pixels.
 * @param cardHeight - The card's height in pixels.
 * @returns The card's position, relative to the strip's top-left corner.
 */
export function positionCardOverTile(
  tile: Rect,
  strip: Rect,
  cardWidth: number,
  cardHeight: number,
): CardPosition {
  return {
    x: clamp(
      EDGE_MARGIN,
      tile.left - strip.left,
      Math.max(EDGE_MARGIN, strip.width - cardWidth - EDGE_MARGIN),
    ),
    y: tile.top - strip.top - cardHeight,
  };
}
