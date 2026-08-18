/**
 * How much to stretch the engine's own vertical world units so they land on
 * `layoutBuilding()`'s floor boundaries.
 *
 * `layoutBuilding()` computes pixel floor heights from `floorWeights` and
 * never exports the per-weight-unit pixel figure it derived them from — only
 * the rounded, cumulative result (`floorHeights`, `floorBottoms`,
 * `totalHeight`). The engine's own `worldY` (`src/game/world.ts`'s
 * `createFloors`) is built the opposite way: every floor is exactly
 * `world.floorHeight` world units tall, with no per-floor weighting at all —
 * `layoutBuilding()`'s own header comment notes "every level in the game
 * today weighs `1`", which is not a simplification here but the whole of
 * what `World` is capable of building. With uniform weights,
 * `layoutBuilding()`'s per-floor pixel height is the same rounded unit for
 * every floor, so `totalHeight` is that unit times `floorCount`, up to the
 * single rounding `layoutBuilding()` applies to the running total. Dividing
 * back out gives the one scale that turns `world.floorHeight` world units
 * into that unit's worth of pixels — off from the true per-floor unit by at
 * most `1 / floorCount` relative, the same cumulative-rounding tolerance
 * `layoutBuilding()` itself already accepts.
 *
 * Pure geometry, like `layout-building.ts` and `shaft-scale.ts`.
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
 * Computes the uniform vertical scale that turns real `worldY` values into
 * pixels matching `layoutBuilding()`'s own floor boundaries.
 *
 * @param input - The building's pixel height and the world's own floor count
 * and floor height.
 * @returns The factor `worldY` is multiplied by, or `1` when there is
 * nothing to scale (an empty or zero-height world).
 */
export function computeVerticalScale(input: VerticalScaleInput): number {
  const { totalHeight, floorCount, floorHeight } = input;
  if (floorCount <= 0 || floorHeight <= 0) {
    return 1;
  }
  return totalHeight / (floorCount * floorHeight);
}
