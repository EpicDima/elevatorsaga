/**
 * The building's responsive geometry: how tall each floor is, how wide each
 * shaft is, and whether a cabin is roomy enough to draw its riders as
 * figures rather than a bare count.
 *
 * The building is sized to whatever room the stage gives it, not the other way
 * round. A tall building (many floors, or floors weighted taller than others)
 * compresses its floors down to {@link MIN_FLOOR} before the stage is allowed
 * to scroll; a wide building (many high-capacity elevators) compresses its
 * shafts down to {@link MIN_SHAFT} the same way. Below either floor the stage
 * scrolls instead of compressing further.
 *
 * This module is the pure half — arithmetic only, no DOM reads or writes. The
 * half that measures the stage and paints the result is `ui/building-stage.ts`.
 */

/**
 * The shortest a floor may be squeezed to before the stage scrolls instead.
 *
 * Forty-eight, not thirty-eight: at thirty-eight the two call lamps stopped
 * stacking and fell into a row, floor numbers landed wherever they fit, and
 * the building itself turned into a stack of stripes. Forty-four was enough
 * to put everything back in place, but the floor was still shorter than the
 * button standing on it. A twenty-floor building scrolls more as a result —
 * but a floor stays a floor.
 */
export const MIN_FLOOR = 48;

/**
 * The narrowest a shaft may be squeezed to before the stage scrolls sideways
 * instead of compressing further.
 *
 * Not "as small as it takes" — small enough that a cabin still has room for
 * a count like "7/10": past this point a stretched editor pane turned
 * elevators into matchsticks.
 */
export const MIN_SHAFT = 46;

/** Below this, a floor is too short for its call lamps to stack; see {@link density}. */
const DENSE_FLOOR_THRESHOLD = 58;

/** How wide the corridor between the floor numbers and the shafts is, in pixels. */
export const CORRIDOR = 170;

/** Whether a floor's call lamps and floor number have room to stack ("full"), or must pack tighter ("compact"). */
export type BuildingDensity = "full" | "compact";

/** What the building is asked to fit into, and what it is built from. */
export interface BuildingLayoutInput {
  /** The stage's available height in pixels (`stage.clientHeight`). */
  readonly stageHeight: number;
  /** The stage's available width in pixels (`stage.clientWidth`). */
  readonly stageWidth: number;
  /**
   * The floor-number column's measured width in pixels
   * (`levels.offsetWidth`). `0` — an unmeasured or detached element — falls
   * back to `84`, the width `.levels` is styled at where its floors take calls
   * by direction. A destination-dispatch column is styled wider, so a building
   * laid out from the fallback stands that much narrow until the next pass
   * measures the column it really has.
   */
  readonly levelsWidth: number;
  /**
   * Each floor's weight, bottom to top (`world.weights`, index 0 = the
   * bottom floor). Every level in the game today weighs `1`, but the
   * distribution below supports uneven weights (a taller lobby, say)
   * without any change to this function.
   */
  readonly floorWeights: readonly number[];
  /** Each elevator's rider capacity, in the same order as every other per-elevator field. */
  readonly capacities: readonly number[];
}

/** The building's computed geometry: everything the DOM-wiring step needs to paint it. */
export interface BuildingLayout {
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
  /**
   * Whether each elevator's cabin is too narrow to draw its riders as
   * figures and must show a bare count instead, in `capacities` order.
   */
  readonly counted: readonly boolean[];
}

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
 * Computes the building's geometry for the room it has been given.
 *
 * @param input - The stage's dimensions and the world's floor weights and
 * elevator capacities.
 * @returns The building's full geometry.
 */
export function layoutBuilding(input: BuildingLayoutInput): BuildingLayout {
  const { stageHeight, stageWidth, floorWeights, capacities } = input;
  const levelsWidth = input.levelsWidth || 84;

  // Floor heights: a step per unit of weight, distributed by cumulative sum
  // and rounded once per floor as it is reached — not per floor in
  // isolation. Twenty independent roundings-up would add ten stray pixels
  // of building nobody asked for; rounding the running total instead keeps
  // the total exact.
  const weightSum = floorWeights.reduce((total, weight) => total + weight, 0);
  // The stage's own padding (18px top and bottom) and the building's border
  // are subtracted from its height. Without these two pixels, a building
  // computed to fit exactly still ended up two pixels taller than the
  // stage, opening a vertical scrollbar with nothing to scroll.
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

  // Shaft widths: what each capacity asks for, scaled down together (never
  // independently — the point is to keep their relative difference) until
  // either they fit the corridor's free width or the narrowest one hits
  // MIN_SHAFT, whichever binds first.
  const gap = capacities.length > 5 ? 7 : 12;
  // Capacity and its wanted width travel together from here on, so pairing
  // them keeps every later step index-free — no array is ever read at a
  // position borrowed from a different one.
  const cars = capacities.map((capacity) => ({
    capacity,
    wanted: clamp(34, 24 + capacity * 8, 116) + 7,
  }));
  const free = Math.max(120, stageWidth - 32 - levelsWidth - CORRIDOR - 22);
  const asked = cars.reduce((total, car) => total + car.wanted, 0) + gap * (cars.length - 1);
  const floorScale = Math.max(...cars.map((car) => MIN_SHAFT / car.wanted));
  const scale = clamp(Math.min(1, floorScale), free / asked, 1);
  // A shaft gap of its own once shafts are actually being scaled down —
  // narrower than the roomy default, so a compressed building still reads
  // as separate shafts rather than one strip.
  const shaftGap = scale < 1 ? 5 : gap;

  // Whether a cabin is roomy enough to draw its riders as figures. The
  // order-lane on the left (7px) and the cabin's own edges eat into the
  // shaft's width; what is left is room for figures, each as wide as the
  // rider glyph scaled to the car's height.
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
  // How far a passenger walks from the queue to a shaft — the corridor
  // minus the margin the queue's own figures need.
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
