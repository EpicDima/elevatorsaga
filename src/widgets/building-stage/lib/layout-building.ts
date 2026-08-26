/**
 * Computes the building's responsive geometry: floor heights, shaft widths, and whether a
 * cabin is roomy enough to draw riders as figures rather than a bare count. Pure arithmetic —
 * the stage is sized down to {@link MIN_FLOOR} and {@link MIN_SHAFT} before it scrolls instead.
 */

/** The shortest a floor may be squeezed to, in pixels, before the stage scrolls instead. */
export const MIN_FLOOR = 54;

/** The narrowest a shaft may be squeezed to, in pixels, before a cabin has no room left for a count like "7/10". */
export const MIN_SHAFT = 46;

/** Below this, a floor is too short for its call lamps to stack; see {@link density}. */
const DENSE_FLOOR_THRESHOLD = 58;

/** How wide the corridor between the floor numbers and the shafts is, in pixels. */
const CORRIDOR = 170;

/** Whether a floor's call lamps and floor number have room to stack ("full"), or must pack tighter ("compact"). */
type BuildingDensity = "full" | "compact";

/** What the building is asked to fit into, and what it is built from. */
interface BuildingLayoutInput {
  /** The stage's available height in pixels (`stage.clientHeight`). */
  readonly stageHeight: number;
  /** The stage's available width in pixels (`stage.clientWidth`). */
  readonly stageWidth: number;
  /** The floor-number column's measured width in pixels; `0` falls back to `84`. */
  readonly levelsWidth: number;
  /** Each floor's weight, bottom to top (index 0 = the bottom floor); a taller floor gets a larger share of height. */
  readonly floorWeights: readonly number[];
  /** Each elevator's rider capacity, in the same order as every other per-elevator field. */
  readonly capacities: readonly number[];
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
  /** Each shaft's width in pixels, in `capacities` order. */
  readonly shaftWidths: readonly number[];
  /** The gap between adjacent shafts in pixels. */
  readonly shaftGap: number;
  /** The combined width of every shaft plus the gaps between them, in pixels. */
  readonly shaftsWidth: number;
  /** The building's total width in pixels: floor numbers, corridor, shafts and their trailing margin. */
  readonly buildingWidth: number;
  /** How much of the corridor a passenger walks before reaching a shaft, in pixels. */
  readonly queueRoom: number;
  /** Whether each elevator's cabin is too narrow to draw riders as figures and shows a bare count instead. */
  readonly counted: readonly boolean[];
}

/** Holds a value inside `[low, high]`. */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Computes the building's geometry for the room it has been given. */
export function layoutBuilding(input: BuildingLayoutInput): BuildingLayout {
  const { stageHeight, stageWidth, floorWeights, capacities } = input;
  const levelsWidth = input.levelsWidth || 84;

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

  // Every shaft's wanted width is scaled down together, never independently, to keep
  // their relative difference, until either they fit or the narrowest hits MIN_SHAFT.
  const gap = capacities.length > 5 ? 7 : 12;
  const cars = capacities.map((capacity) => ({
    capacity,
    wanted: clamp(34, 24 + capacity * 8, 116) + 7,
  }));
  const free = Math.max(120, stageWidth - 32 - levelsWidth - CORRIDOR - 22);
  const asked = cars.reduce((total, car) => total + car.wanted, 0) + gap * (cars.length - 1);
  const floorScale = Math.max(...cars.map((car) => MIN_SHAFT / car.wanted));
  const scale = clamp(Math.min(1, floorScale), free / asked, 1);
  // Narrower once shafts are scaled down, so a compressed building still reads as
  // separate shafts rather than one strip.
  const shaftGap = scale < 1 ? 5 : gap;

  // The order lane (7px) and the cabin's own edges eat into the shaft's width; what's
  // left is room for rider figures, each scaled to the car's height.
  const riderWidth = Math.round(clamp(8, carHeight - 22, 16) * 0.55) + 1;
  const shafts = cars.map((car) => {
    const width = Math.round(car.wanted * scale);
    const inner = width - 12 - 7;
    return { width, counted: car.capacity * riderWidth > inner };
  });
  const shaftWidths = shafts.map((shaft) => shaft.width);
  const counted = shafts.map((shaft) => shaft.counted);

  const shaftsWidth =
    shaftWidths.reduce((total, width) => total + width, 0) + shaftGap * (shaftWidths.length - 1);
  const buildingWidth = levelsWidth + CORRIDOR + shaftsWidth + 22;
  // The corridor minus the margin the queue's own figures need.
  const queueRoom = Math.max(60, CORRIDOR - 18);

  return {
    floorHeights,
    floorBottoms,
    totalHeight,
    shortestFloor,
    carHeight,
    density,
    shaftWidths,
    shaftGap,
    shaftsWidth,
    buildingWidth,
    queueRoom,
    counted,
  };
}
