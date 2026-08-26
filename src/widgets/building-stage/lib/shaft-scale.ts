/**
 * Computes the single `scaleX` that fits the real building (engine coordinates, not
 * `layoutBuilding()`'s own drawn shaft widths) into the stage, so cars, seats and passengers
 * stay in the engine's own proportions and can grow past 1 as well as shrink.
 */

/**
 * The narrowest a car may be drawn, in pixels, unless it is already narrower than this at
 * full size. Not `layout-building.ts`'s `MIN_SHAFT`: that floors *drawn* shaft widths, not
 * real car width, and reusing it here would force a scale above 1, disabling shrink entirely.
 */
export const MIN_CAR = 30;

/**
 * The most a building may be scaled up, as a multiplier on the engine's own world units.
 * The engine's units are small enough at 1:1 to letterbox a car, so the fit is allowed to
 * grow the whole building rather than only ever shrink it, capped here so it doesn't outgrow the pane.
 */
export const MAX_ZOOM = 1.5;

/**
 * Room to the right of the rightmost shaft, in pixels, so a delivered passenger's exit walk
 * clears the building's clipped edge (helped by the fade `.user.leaving` carries) before
 * being cut off, without reserving the walk's full distance as empty space.
 */
export const TRAILING_ROOM = 44;

/**
 * How much of the 20 world units the engine leaves between two cars belongs to each car's
 * own shaft, per side: 8 either side leaves 4 between shafts, the narrowest seam that still
 * reads as two shafts rather than one wide one.
 */
const SHAFT_PAD_WORLD = 8;

/** The narrowest the pad may be drawn, in pixels; thinner and the order strip is a line, not a track. */
const MIN_SHAFT_PAD = 2;

/**
 * How wide one shaft's wall is on either side of its car, in whole pixels.
 * Rounded to a whole pixel since a fractional pad would round differently between the
 * shaft's edge shift and the car's inset, misaligning the drawn car from its world coordinate.
 */
export function shaftPadPx(scaleX: number): number {
  return Math.max(MIN_SHAFT_PAD, Math.round(SHAFT_PAD_WORLD * scaleX));
}

/** Holds a value inside `[low, high]`. */
function clamp(low: number, value: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Reads an array element known to exist, without a non-null assertion. */
function requireAt<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Index ${String(index)} out of bounds`);
  }
  return value;
}

/** One real elevator's geometry, in world units. */
export interface ShaftScaleElevator {
  /** The car's left edge, in world units. */
  readonly worldX: number;
  /** The car's real width, in world units. */
  readonly width: number;
  readonly capacity: number;
}

/** What {@link computeShaftScale} needs in order to size the real building. */
export interface ShaftScaleInput {
  /** The stage's available width, in pixels. */
  readonly stageWidth: number;
  /** The floor-number column's measured width, in pixels. */
  readonly levelsWidth: number;
  /** Every elevator in the world, left to right. */
  readonly elevators: readonly ShaftScaleElevator[];
}

/** The uniform horizontal scale the whole building is drawn at. */
export interface ShaftScale {
  /** Multiplies every world x coordinate — cars, seats, passengers — to fit the stage. */
  readonly scaleX: number;
}

/** Computes the uniform horizontal scale for the real building. */
export function computeShaftScale(input: ShaftScaleInput): ShaftScale {
  const { stageWidth, levelsWidth, elevators } = input;
  if (elevators.length === 0) {
    return { scaleX: 1 };
  }

  const free = Math.max(120, stageWidth - 32 - levelsWidth - TRAILING_ROOM);
  const last = requireAt(elevators, elevators.length - 1);
  // From world x 0, not the first car: the corridor left of it scales too, since its queue
  // walks to that car.
  const naturalWidth = last.worldX + last.width;
  // Math.min(1, ...) stops a car already narrower than MIN_CAR from demanding to be grown;
  // the widest per-car floor wins, since one scale draws every shaft.
  const minShaftScale = Math.max(
    ...elevators.map((elevator) => Math.min(1, MIN_CAR / elevator.width)),
  );
  const scaleX = clamp(minShaftScale, free / naturalWidth, MAX_ZOOM);

  return { scaleX };
}
