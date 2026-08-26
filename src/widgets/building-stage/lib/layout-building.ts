/**
 * Computes the building's vertical geometry: the floor height, the cabin height keyed to it,
 * and whether a floor has room to lay its parts out generously. A building is drawn at one of
 * two floor heights, picked from how many floors it has rather than from the window, so a car
 * and a passenger are the same size on every level and at every window size; a building too
 * tall for the stage scrolls instead of shrinking.
 */

/**
 * The floor height a building under {@link TALL_FLOOR_COUNT} floors is drawn at, in pixels.
 * The smallest height at which every part that scales with a floor has reached its own
 * ceiling: the floor number's type at 57px, a passenger figure at 63px, a call lamp at 80px.
 * Past this, a taller floor is only more empty air.
 */
export const ROOMY_FLOOR = 80;

/**
 * The floor height a taller building is drawn at, in pixels. Everything on a floor still
 * reads at this size, and it keeps the game's tallest building — 21 floors — to a screen and
 * a half of scrolling rather than three screens.
 */
export const COMPACT_FLOOR = 54;

/**
 * From this many floors up, a building is drawn at {@link COMPACT_FLOOR}. The game's levels
 * run 3 to 9 floors and then 12, 13 and 21, so the split falls in a gap: no level sits near
 * enough to the line for a floor added or removed to resize the whole building.
 */
export const TALL_FLOOR_COUNT = 10;

/** Below this, a floor is too short for its call lamps to stack; see {@link BuildingLayout.density}. */
const DENSE_FLOOR_THRESHOLD = 58;

/** How much shorter the cabin is than the floor it stands on, in pixels. */
const CAR_INSET = 8;

/** Whether a floor's call lamps and floor number have room to stack ("full"), or must pack tighter ("compact"). */
type BuildingDensity = "full" | "compact";

/** What the building is built from. */
interface BuildingLayoutInput {
  /** How many floors the world has (`world.floors.length`). */
  readonly floorCount: number;
}

/** The building's computed geometry: everything the DOM-wiring step needs to paint it. */
interface BuildingLayout {
  /** Every floor's height in pixels — one value, since a building draws all its floors alike. */
  readonly floorHeight: number;
  /** The building's total height in pixels — the top of the topmost floor. */
  readonly totalHeight: number;
  /** The elevator cabin's height in pixels. One value for every car, sized to the floor. */
  readonly carHeight: number;
  /** Whether floors have room to lay out generously ("full") or must pack tighter ("compact"). */
  readonly density: BuildingDensity;
}

/** Computes the building's geometry from the number of floors it has. */
export function layoutBuilding(input: BuildingLayoutInput): BuildingLayout {
  const floorCount = Math.max(0, input.floorCount);
  const floorHeight = floorCount >= TALL_FLOOR_COUNT ? COMPACT_FLOOR : ROOMY_FLOOR;

  return {
    floorHeight,
    totalHeight: floorHeight * floorCount,
    carHeight: floorHeight - CAR_INSET,
    density: floorHeight >= DENSE_FLOOR_THRESHOLD ? "full" : "compact",
  };
}
