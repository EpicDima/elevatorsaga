/**
 * The live scale a moving entity reads on every position update: a mutable
 * cell, shared by reference, that a widget writes to on recompute and
 * entities read on their own existing per-tick update.
 */

/** How much bigger real `worldX`/`worldY` units are drawn than the engine's own pixels. */
export interface StageScale {
  /** Horizontal scale, applied to world x past the corridor. */
  scaleX: number;
  /** Vertical scale, applied to `worldY`. */
  scaleY: number;
  /** The corridor's drawn width in pixels; fixed, so it reads the same on every level. */
  corridorPx: number;
  /** How much of world x the corridor spans: everything left of the first car. */
  corridorWorld: number;
}

/** A fresh scale that draws world units 1:1, with no corridor held out of the mapping. */
export function unscaled(): StageScale {
  return { scaleX: 1, scaleY: 1, corridorPx: 0, corridorWorld: 0 };
}

/**
 * Maps a world x onto its drawn offset from the building's left edge. The corridor left of
 * the first car keeps one width across every level, so only the shafts past it take `scaleX`.
 * Continuous at the corridor's edge, so a passenger's walk into a car never jumps.
 */
export function worldXToPx(scale: Omit<StageScale, "scaleY">, worldX: number): number {
  const { corridorWorld, corridorPx, scaleX } = scale;
  if (corridorWorld <= 0) {
    return worldX * scaleX;
  }
  return worldX <= corridorWorld
    ? (worldX / corridorWorld) * corridorPx
    : corridorPx + (worldX - corridorWorld) * scaleX;
}
