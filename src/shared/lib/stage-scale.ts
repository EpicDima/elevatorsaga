/**
 * The live scale a moving entity reads on every position update: a mutable
 * cell, shared by reference, that a widget writes to on recompute and
 * entities read on their own existing per-tick update.
 */

/** How much bigger real `worldX`/`worldY` units are drawn than the engine's own pixels. */
export interface StageScale {
  /** Horizontal scale, applied to `worldX`. */
  scaleX: number;
  /** Vertical scale, applied to `worldY`. */
  scaleY: number;
}
