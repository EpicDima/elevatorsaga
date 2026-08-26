/**
 * Computes the uniform scale that stretches the engine's vertical world units to land on
 * `layoutBuilding()`'s floor boundaries. Since every floor weighs the same, `totalHeight`
 * divided by `floorCount * floorHeight` recovers its per-floor pixel unit, off by at most
 * `1 / floorCount` relative — the same rounding tolerance `layoutBuilding()` itself accepts.
 */

/** What {@link computeVerticalScale} needs in order to size the real building. */
export interface VerticalScaleInput {
  /** `layoutBuilding()`'s own computed building height, in pixels. */
  readonly totalHeight: number;
  /** How many floors the world has (`world.floors.length`). */
  readonly floorCount: number;
  /** One floor's height in world units (`world.floorHeight`). */
  readonly floorHeight: number;
}

/**
 * Computes the uniform vertical scale that turns real `worldY` values into pixels matching
 * `layoutBuilding()`'s floor boundaries. Returns `1` for an empty or zero-height world.
 */
export function computeVerticalScale(input: VerticalScaleInput): number {
  const { totalHeight, floorCount, floorHeight } = input;
  if (floorCount <= 0 || floorHeight <= 0) {
    return 1;
  }
  return totalHeight / (floorCount * floorHeight);
}
