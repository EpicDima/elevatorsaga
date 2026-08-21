/**
 * Placing a floating card next to whatever it explains, without spilling off
 * the edge of the area it explains it in.
 *
 * A card tries a preferred spot next to its anchor, flips to the opposite side
 * when that spot would clip past the near edge, and is clamped inside its
 * container either way. Two placements use this shape — beside an elevator's
 * shaft, and above a floor's queue — so the module exposes exactly those two
 * rather than a general-purpose placement engine.
 *
 * Pure geometry: it takes plain rectangles, not real DOM elements, so it runs
 * the same under Node as in a browser.
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
 * Pulls a placement back inside the container, so the card is never cut off
 * by the container's own edge — the finishing step every placement in this
 * module ends with.
 *
 * @param position - The placement to clamp.
 * @param wrap - The container the card must stay inside.
 * @param cardWidth - The card's width in pixels.
 * @param cardHeight - The card's height in pixels.
 * @returns `position`, moved inside the container if it wasn't already.
 */
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
 * Places a card beside an anchor — left of it by default, flipping to the
 * right when the anchor sits too close to the container's left edge — and
 * vertically centered on it.
 *
 * Ported verbatim from `drawHoverCard()`'s `hover.kind === "car"` branch:
 * the elevator's hover card prefers the open corridor to the shaft's left,
 * and falls back to its right only when the shaft itself is near the edge.
 *
 * @param anchor - The element the card explains, e.g. an elevator's shaft.
 * @param wrap - The container both the anchor and the card live inside.
 * @param cardWidth - The card's width in pixels.
 * @param cardHeight - The card's height in pixels.
 * @returns The card's position, relative to `wrap`'s top-left corner.
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
 * Places a card above an anchor, right-aligned with it — flipping to below
 * when the anchor sits too close to the container's top edge.
 *
 * Ported verbatim from `drawHoverCard()`'s queue branch: a floor's queue
 * fills the whole corridor, so there is no room beside it for a card. The
 * card sits above the floor instead, aligned with the queue's right edge
 * where the waiting figures stand.
 *
 * @param anchor - The element the card explains, e.g. a floor's queue.
 * @param wrap - The container both the anchor and the card live inside.
 * @param cardWidth - The card's width in pixels.
 * @param cardHeight - The card's height in pixels.
 * @returns The card's position, relative to `wrap`'s top-left corner.
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
