/**
 * Computes the `scaleX` that fits the real building (engine coordinates, not
 * `layoutBuilding()`'s own drawn shaft widths) into the stage, so cars, seats and passengers
 * stay in the engine's own proportions and can grow past 1 as well as shrink. Only the shaft
 * band is fitted: the corridor left of it is drawn at {@link CORRIDOR_PX} on every level.
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
 * The corridor's drawn width in pixels: the walk between the floor numbers and the first
 * shaft. Held out of the fit so it reads the same on a three-floor level and a skyscraper,
 * where scaling it with the shafts swung it between roughly 160px and 290px. 200px draws the
 * engine's own 200-unit corridor 1:1, near the middle of that old swing.
 */
export const CORRIDOR_PX = 200;

/**
 * The narrowest the corridor may be squeezed to, in pixels, once the cars have already hit
 * {@link MIN_CAR} and something still has to give. Empty walking space is the right thing to
 * give up before the cars are, but a corridor thinner than this stops reading as a walk.
 */
export const MIN_CORRIDOR_PX = 120;

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
 * Held to a whole pixel since a fractional pad would round differently between the shaft's
 * edge shift and the car's inset, misaligning the drawn car from its world coordinate.
 * Rounded down, not to nearest: a pad rounded up eats the seam between two shafts, which at
 * scaleX 0.32 closed it to nothing once the drawn edges were rounded to whole pixels too.
 */
export function shaftPadPx(scaleX: number): number {
  return Math.max(MIN_SHAFT_PAD, Math.floor(SHAFT_PAD_WORLD * scaleX));
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

/** The horizontal scale the shaft band is drawn at, and the corridor beside it. */
export interface ShaftScale {
  /** Multiplies world x past the corridor — cars, seats, riders — to fit the stage. */
  readonly scaleX: number;
  /** The corridor's drawn width in pixels: {@link CORRIDOR_PX} unless the stage is too narrow to hold it. */
  readonly corridorPx: number;
  /** How much of world x the corridor spans: everything left of the first car. */
  readonly corridorWorld: number;
}

/** Computes the horizontal scale for the real building's shaft band. */
export function computeShaftScale(input: ShaftScaleInput): ShaftScale {
  const { stageWidth, levelsWidth, elevators } = input;
  if (elevators.length === 0) {
    return { scaleX: 1, corridorPx: 0, corridorWorld: 0 };
  }

  const first = requireAt(elevators, 0);
  const last = requireAt(elevators, elevators.length - 1);
  const free = Math.max(120, stageWidth - 32 - levelsWidth - TRAILING_ROOM);
  // The corridor takes its pixels off the top, so what the band is fitted into no longer
  // depends on how wide a walk this level's engine coordinates put in front of the cars.
  // From the first car, not world x 0, for the same reason.
  const bandWidth = last.worldX + last.width - first.worldX;
  // Math.min(1, ...) stops a car already narrower than MIN_CAR from demanding to be grown;
  // the widest per-car floor wins, since one scale draws every shaft.
  const minShaftScale = Math.max(
    ...elevators.map((elevator) => Math.min(1, MIN_CAR / elevator.width)),
  );
  const scaleX = clamp(minShaftScale, (free - CORRIDOR_PX) / bandWidth, MAX_ZOOM);
  // Whatever the band left behind, but never more than the corridor asked for. Only the
  // busiest level at the smallest window gets here: once MIN_CAR floors the scale, holding
  // the full corridor anyway would spill the building sideways instead.
  const corridorPx = clamp(MIN_CORRIDOR_PX, free - bandWidth * scaleX, CORRIDOR_PX);

  return { scaleX, corridorPx, corridorWorld: first.worldX };
}
