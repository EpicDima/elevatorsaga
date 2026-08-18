/**
 * The live scale a moving entity reads on every position update.
 *
 * `widgets/building-stage` recomputes `scaleX`/`scaleY` rarely — on mount, on
 * `ResizeObserver`, on a new world — but an elevator or passenger's own
 * `worldX`/`worldY` change every simulation tick via `new_display_state`, and
 * each of those ticks has to multiply by whatever the scale currently is.
 * Re-subscribing every entity to a second "geometry changed" event just to
 * cache the two numbers would be more wiring for the same result: a mutable
 * cell, shared by reference between the widget and every entity it creates,
 * that the widget writes to on recompute and entities read from on their own
 * existing per-tick event. See the "Единый глобальный масштаб" decision this
 * shape was built against — one scale, shared, not a per-entity remapping.
 */

/** How much bigger real `worldX`/`worldY` units are drawn than the engine's own pixels. */
export interface StageScale {
  /** Horizontal scale, applied to `worldX`. */
  scaleX: number;
  /** Vertical scale, applied to `worldY`. */
  scaleY: number;
}
