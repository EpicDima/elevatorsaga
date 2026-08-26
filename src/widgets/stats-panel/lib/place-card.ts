/**
 * Places the card that explains one tile of the figures strip. The strip is only a row or
 * two of tiles, shorter than the card it has to raise, so unlike the building's own card
 * placements, this one deliberately lets the card leave the strip through the top.
 */

import type { CardPosition, Rect } from "#shared/lib/smart-position.ts";

/** How close to the strip's side the card may come before it is pulled back in. */
const EDGE_MARGIN = 6;

/** Holds a value inside `[low, high]`. */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Places the card flush on top of its tile, aligned with the tile's leading edge. Flush
 * rather than a gap above it, so a pointer traveling up to read the card crosses no strip in
 * between — a gap would fail WCAG 1.4.13's "hoverable" leg. Only the inline axis is clamped.
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
