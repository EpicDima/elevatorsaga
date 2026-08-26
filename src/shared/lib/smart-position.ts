/**
 * Places a floating card next to whatever it explains, flipping to the
 * opposite side near an edge and clamping inside its container. Pure
 * geometry: it works on plain rectangles, not real DOM elements.
 */

/**
 * A rectangle in the same shape `DOMRect` and `getBoundingClientRect()`
 * already use, so a real one can be passed here without conversion.
 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Where the card should be drawn, relative to its container's own top-left corner. */
export interface CardPosition {
  readonly x: number;
  readonly y: number;
}

/** How close to a container's edge a card may come before it is pulled back in. */
const EDGE_MARGIN = 6;

/** Holds a value inside `[low, high]`. */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Pulls a placement back inside the container so the card is never cut off by its edge. */
function clampInsideWrap(
  position: CardPosition,
  wrap: Rect,
  cardWidth: number,
  cardHeight: number,
): CardPosition {
  return {
    x: clamp(EDGE_MARGIN, position.x, Math.max(EDGE_MARGIN, wrap.width - cardWidth - EDGE_MARGIN)),
    y: clamp(
      EDGE_MARGIN,
      position.y,
      Math.max(EDGE_MARGIN, wrap.height - cardHeight - EDGE_MARGIN),
    ),
  };
}

/**
 * Places a card beside an anchor (e.g. an elevator's shaft) — left of it by
 * default, flipping right when too close to the container's left edge — and
 * vertically centered on it. Position is relative to `wrap`'s top-left corner.
 */
export function positionBesideAnchor(
  anchor: Rect,
  wrap: Rect,
  cardWidth: number,
  cardHeight: number,
): CardPosition {
  const GAP = 10;
  let x = anchor.left - wrap.left - cardWidth - GAP;
  if (x < EDGE_MARGIN) {
    x = anchor.right - wrap.left + GAP;
  }
  const y = anchor.top - wrap.top + anchor.height / 2 - cardHeight / 2;
  return clampInsideWrap({ x, y }, wrap, cardWidth, cardHeight);
}

/**
 * Places a card above an anchor (e.g. a floor's queue), right-aligned with
 * it — flipping to below when too close to the container's top edge.
 * Position is relative to `wrap`'s top-left corner.
 */
export function positionAboveAnchor(
  anchor: Rect,
  wrap: Rect,
  cardWidth: number,
  cardHeight: number,
): CardPosition {
  const GAP = 8;
  const x = anchor.right - wrap.left - cardWidth;
  let y = anchor.top - wrap.top - cardHeight - GAP;
  if (y < EDGE_MARGIN) {
    y = anchor.bottom - wrap.top + GAP;
  }
  return clampInsideWrap({ x, y }, wrap, cardWidth, cardHeight);
}
