/**
 * How much to shrink the real building horizontally to fit the stage.
 *
 * `layoutBuilding()`'s own `shaftWidths` are sized off the mockup's `wanted`
 * formula (`clamp(34, 24 + capacity * 8, 116) + 7`), which has nothing to do
 * with a real elevator's width — the engine draws a car at `capacity * 10`
 * (`src/game/elevator.ts`'s `width = maxUsers * 10`). `entities/elevator`
 * renders real cars at real coordinates, with real passengers walking to them
 * along the same axis, so shrinking them by the mockup's ratio would put a
 * shaft where nobody is standing. This module computes the one uniform
 * `scaleX` that fits the *real* building into the room the stage has, keeping
 * every car's proportions exactly the engine's own — never remapped to the
 * mockup's curve. See the "Единый глобальный масштаб" decision this widget was
 * built against.
 *
 * The clamp shape below — free space over natural width, floored by whatever
 * keeps the narrowest car readable, ceilinged at 1 — is carried over from
 * `layoutBuilding()`'s own horizontal pass. Two things differ. The corridor is
 * not a fixed budget subtracted before the fit (`layoutBuilding()`'s
 * `CORRIDOR`), it is part of the span being scaled: the engine puts the first
 * car at world x 200 and spawns passengers at 105-145, all on one axis, so
 * scaling the shafts without the corridor they walk down would leave a queue
 * standing in a shaft. And the floor is {@link MIN_CAR} rather than that
 * module's `MIN_SHAFT`, for the reason that constant's own comment gives.
 *
 * Pure geometry, like `layout-building.ts` and `smart-position.ts`: plain
 * numbers in, plain numbers out, so it runs the same under Node as it does
 * against a live world.
 */

/**
 * The narrowest a car may be drawn, in pixels — unless it is already narrower
 * than this at full size, in which case it is never shrunk at all.
 *
 * `layout-building.ts`'s own `MIN_SHAFT` cannot be reused here, and reusing it
 * was a bug worth naming: 46 is a floor on the mockup's *drawn* shaft widths
 * (`clamp(34, 24 + capacity * 8, 116) + 7`, so 66px at capacity 4), while a
 * real car is `capacity * 10` — 40px at capacity 4, which is the capacity most
 * of the shipped levels use. A floor of 46 on a car that is 40 wide asks
 * for a scale above 1, which clamps the whole building to 1 and quietly turned
 * the horizontal fit off everywhere: a building 10% too wide scrolled sideways
 * rather than shrinking 10%.
 *
 * Thirty is where the mockup's own compact car stops working: `.car-top` draws
 * an arrow, a floor number and a second arrow between 4px paddings, which at
 * `data-density="compact"` is 9 + 10 + 9 + 8 = 36px of content in a car whose
 * padding box is the shaft's width less 12 — so a 30px car is the last one
 * whose top bar still reads as a top bar rather than a smear.
 */
export const MIN_CAR = 30;

/**
 * How much room is left to the right of the rightmost shaft, in pixels.
 *
 * The mockup's own trailing margin is 22px, and 22px is all a drawing needs.
 * A delivered passenger here walks another 100 world units past the seat they
 * rode in before the simulation removes them (`EXIT_WALK_DISTANCE` in
 * `src/game/user.ts`), and `.building` clips its own overflow, so at 22px they
 * would be sliced in half by the building's edge a fifth of the way into that
 * walk. This much room, together with the fade `.user.leaving` carries, gets
 * them out of sight before the edge does it for them; reserving the whole
 * 100px would be a wide empty strip down the side of every building instead.
 */
export const TRAILING_ROOM = 44;

/**
 * How much of the 20 world units the engine leaves between two cars belongs to
 * each car's own shaft, per side.
 *
 * `src/game/world.ts` advances `currentX` by `ELEVATOR_SPACING + width` for
 * every elevator, so between two neighbouring cars there are exactly 20 world
 * units of nothing. The mockup draws a shaft as a wall around its car with an
 * order strip inside the left wall, which is room the car itself does not have
 * — so it is taken from that gap: 8 units either side leaves 4 between two
 * shafts, which is the seam the mockup gets from its `gap` and the last thing
 * that still reads as two separate shafts rather than one wide one.
 */
const SHAFT_PAD_WORLD = 8;

/**
 * The narrowest that pad may be drawn, in pixels.
 *
 * The order strip lives inside it and a strip thinner than this is a line, not
 * a track for marks to sit on. Two pixels is also small enough that it never
 * eats the seam: the gap between two shafts is `20 * scaleX - 2 * pad`, and the
 * floor {@link MIN_CAR} puts on `scaleX` keeps that positive.
 */
const MIN_SHAFT_PAD = 2;

/**
 * How wide one shaft's wall is on either side of its car, in whole pixels.
 *
 * Whole pixels because {@link SHAFT_PAD_WORLD} is what the shaft's left edge is
 * shifted by *and* what the car is inset by inside it, and a fractional pad
 * would round differently in those two places — which would put the drawn car a
 * hair off the world coordinate its own passengers walk to.
 *
 * @param scaleX - The building's horizontal scale.
 * @returns The pad in pixels.
 */
export function shaftPadPx(scaleX: number): number {
  return Math.max(MIN_SHAFT_PAD, Math.round(SHAFT_PAD_WORLD * scaleX));
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
 * Reads an array element known to exist, without a non-null assertion.
 *
 * @param arr - Array to read from.
 * @param index - Index known to be in bounds.
 * @returns The element at `index`.
 * @throws {Error} When `index` is somehow out of bounds.
 */
function requireAt<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Index ${String(index)} out of bounds`);
  }
  return value;
}

/** One real elevator's geometry, as `src/game/elevator.ts` actually built it. */
export interface ShaftScaleElevator {
  /** The car's left edge in world units (`elevator.worldX`). */
  readonly worldX: number;
  /** The car's real width in world units (`elevator.width`, i.e. `capacity * 10`). */
  readonly width: number;
  /** The car's rider capacity (`elevator.maxUsers`). */
  readonly capacity: number;
}

/** What {@link computeShaftScale} needs in order to size the real building. */
export interface ShaftScaleInput {
  /** The stage's available width in pixels (`stage.clientWidth`). */
  readonly stageWidth: number;
  /** The floor-number column's measured width in pixels, as fed to `layoutBuilding()`. */
  readonly levelsWidth: number;
  /** Every elevator in the world, left to right. */
  readonly elevators: readonly ShaftScaleElevator[];
}

/** The uniform horizontal scale the whole building is drawn at. */
export interface ShaftScale {
  /** The factor every world x coordinate — cars, seats, passengers — is multiplied by to fit the stage. */
  readonly scaleX: number;
}

/**
 * Computes the uniform horizontal scale for the real building.
 *
 * @param input - The stage's width, the floor-number column's width, and every
 * real elevator's own geometry.
 * @returns The scale.
 */
export function computeShaftScale(input: ShaftScaleInput): ShaftScale {
  const { stageWidth, levelsWidth, elevators } = input;
  if (elevators.length === 0) {
    return { scaleX: 1 };
  }

  const free = Math.max(120, stageWidth - 32 - levelsWidth - TRAILING_ROOM);
  const last = requireAt(elevators, elevators.length - 1);
  // From world x 0, not from the first car: the corridor left of it is drawn
  // at the same scale, because the queue standing in it walks to that car.
  const naturalWidth = last.worldX + last.width;
  // Per car, and only ever a floor: `Math.min(1, ...)` is what keeps a car that
  // is already narrower than MIN_CAR at full size from demanding to be *grown*.
  // The widest of those floors wins, because one scale draws every shaft.
  const minShaftScale = Math.max(
    ...elevators.map((elevator) => Math.min(1, MIN_CAR / elevator.width)),
  );
  const scaleX = clamp(minShaftScale, free / naturalWidth, 1);

  return { scaleX };
}
