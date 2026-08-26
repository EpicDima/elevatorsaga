/**
 * Computes the building's responsive vertical geometry: floor heights, the cabin height keyed
 * to them, and whether a floor has room to lay its parts out generously. Pure arithmetic —
 * the stage is sized down to {@link MIN_FLOOR} before it scrolls instead.
 */

/** The shortest a floor may be squeezed to, in pixels, before the stage scrolls instead. */
export const MIN_FLOOR = 54;

/** Below this, a floor is too short for its call lamps to stack; see {@link density}. */
const DENSE_FLOOR_THRESHOLD = 58;

/** Whether a floor's call lamps and floor number have room to stack ("full"), or must pack tighter ("compact"). */
type BuildingDensity = "full" | "compact";

/** What the building is asked to fit into, and what it is built from. */
interface BuildingLayoutInput {
  /** The stage's available height in pixels (`stage.clientHeight`). */
  readonly stageHeight: number;
  /** Each floor's weight, bottom to top (index 0 = the bottom floor); a taller floor gets a larger share of height. */
  readonly floorWeights: readonly number[];
}

/** The building's computed geometry: everything the DOM-wiring step needs to paint it. */
interface BuildingLayout {
  /** Each floor's height in pixels, bottom to top (index 0 = the bottom floor). */
  readonly floorHeights: readonly number[];
  /** Each floor's offset from the building's bottom in pixels, bottom to top. */
  readonly floorBottoms: readonly number[];
  /** The building's total height in pixels — the top of the tallest floor. */
  readonly totalHeight: number;
  /** The shortest floor's height in pixels, the value every floor and the car height are keyed to. */
  readonly shortestFloor: number;
  /** The elevator cabin's height in pixels. One value for every car, sized to the shortest floor. */
  readonly carHeight: number;
  /** Whether floors have room to lay out generously ("full") or must pack tighter ("compact"). */
  readonly density: BuildingDensity;
}

/** Holds a value inside `[low, high]`. */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Computes the building's geometry for the room it has been given. */
export function layoutBuilding(input: BuildingLayoutInput): BuildingLayout {
  const { stageHeight, floorWeights } = input;

  // Floor heights round the running cumulative sum, not each floor in isolation, so
  // rounding error never accumulates into stray pixels of extra building height.
  const weightSum = floorWeights.reduce((total, weight) => total + weight, 0);
  // Subtracts the stage's own padding (18px top and bottom) plus its border, or a
  // building sized to fit exactly still opens an empty vertical scrollbar.
  const room = Math.max(160, stageHeight - 36 - 2);
  const unit = clamp(MIN_FLOOR, room / weightSum, 96);

  const floorHeights: number[] = [];
  const floorBottoms: number[] = [];
  let exact = 0;
  let stack = 0;
  for (const weight of floorWeights) {
    exact += unit * weight;
    const top = Math.round(exact);
    floorBottoms.push(stack);
    floorHeights.push(top - stack);
    stack = top;
  }
  const totalHeight = stack;
  const shortestFloor = Math.min(...floorHeights);

  // One elevator height for the whole building, sized to the shortest floor.
  const carHeight = Math.max(16, shortestFloor - 8);
  const density: BuildingDensity = shortestFloor >= DENSE_FLOOR_THRESHOLD ? "full" : "compact";

  return { floorHeights, floorBottoms, totalHeight, shortestFloor, carHeight, density };
}
