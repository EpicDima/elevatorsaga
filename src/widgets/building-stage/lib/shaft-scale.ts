/**
 * How much to shrink the real building horizontally to fit the stage.
 *
 * `layoutBuilding()`'s own `shaftWidths` come from a drawing formula
 * (`clamp(34, 24 + capacity * 8, 116) + 7`) that has nothing to do with a real
 * elevator's width — the engine draws a car at `capacity * 10`
 * (`src/game/elevator.ts`'s `width = maxUsers * 10`). `entities/elevator`
 * renders real cars at real coordinates, with real passengers walking to them
 * along the same axis, so shrinking them by that formula's ratio would put a
 * shaft where nobody is standing. This module computes the one uniform `scaleX`
 * that fits the *real* building into the room the stage has — a single global
 * scale, keeping every car's proportions exactly the engine's own.
 *
 * The clamp shape below — free space over natural width, floored by whatever
 * keeps the narrowest car readable — mirrors `layoutBuilding()`'s own
 * horizontal pass. Three things differ. The corridor is not a fixed budget
 * subtracted before the fit (`layoutBuilding()`'s `CORRIDOR`), it is part of
 * the span being scaled: the engine puts the first car at world x 200 and
 * spawns passengers at 105-145, all on one axis, so scaling the shafts without
 * the corridor they walk down would leave a queue standing in a shaft. The
 * floor is {@link MIN_CAR} rather than that module's `MIN_SHAFT`, for the
 * reason that constant's own comment gives. And the ceiling is
 * {@link MAX_ZOOM} rather than 1: this is a fit, not a shrink, and a building
 * with room to spare is drawn larger rather than left as a strip of matchstick
 * cars in the middle of an empty pane.
 *
 * Pure geometry, like `layout-building.ts` and `smart-position.ts`: plain
 * numbers in, plain numbers out, so it runs the same under Node as it does
 * against a live world.
 */

/**
 * The narrowest a car may be drawn, in pixels — unless it is already narrower
 * than this at full size, in which case it is never shrunk at all.
 *
 * `layout-building.ts`'s own `MIN_SHAFT` must not be reused here: 46 is a floor
 * on *drawn* shaft widths (`clamp(34, 24 + capacity * 8, 116) + 7`, so 66px at
 * capacity 4), while a real car is `capacity * 10` — 40px at capacity 4, which
 * is the capacity most of the shipped levels use. A floor of 46 on a car that
 * is 40 wide asks for a scale above 1, which clamps the whole building to 1 and
 * turns the horizontal fit off everywhere: a building 10% too wide would scroll
 * sideways rather than shrink 10%.
 *
 * Thirty is where the compact car stops working: `.car-top` draws an arrow, a
 * floor number and a second arrow between 4px paddings, which at
 * `data-density="compact"` is 9 + 10 + 9 + 8 = 36px of content in a car whose
 * padding box is the shaft's width less 12 — so a 30px car is the last one
 * whose top bar still reads as a top bar rather than a smear.
 */
export const MIN_CAR = 30;

/**
 * The largest a world unit may be drawn, in pixels.
 *
 * The engine's own numbers are small: a car is `capacity * 10` world units, so
 * the capacity most levels ship is a car forty units wide standing in a shaft
 * whose floors are eighty to ninety pixels tall. Drawn one-to-one that is a
 * letterbox on its end — an elevator half as wide as it is tall, in a building
 * that was leaving a third of its pane empty to draw it that way. Nothing about
 * those forty units is a measurement of anything; they are the width the
 * original game happened to draw a car at.
 *
 * So the fit is allowed to grow the building as well as shrink it, up to half
 * again its own units, and every level with the room takes the whole of it. It
 * is one scale over the whole world and not a car-only stretch, which is the
 * point: cars, the seats inside them, the seams between them and the corridor
 * the queue walks down all grow together, so a passenger still walks to exactly
 * the edge of the car they board and the building is the same drawing, larger.
 *
 * Half again and no more. The widest buildings in the game do not fit their
 * pane at 1 as it is — level 18 is 1030px of house — and past 1.5 the levels
 * that do fit start reaching for a scrollbar of their own in exchange for a car
 * nobody asked to be bigger. The clamp below hands each building whichever of
 * the two numbers is smaller, so a level with no room to grow is drawn exactly
 * as it always was.
 */
export const MAX_ZOOM = 1.5;

/**
 * How much room is left to the right of the rightmost shaft, in pixels.
 *
 * A drawing would need 22px. A delivered passenger here walks another 100 world
 * units past the seat they rode in before the simulation removes them
 * (`EXIT_WALK_DISTANCE` in `src/game/user.ts`), and `.building` clips its own
 * overflow, so at 22px they would be sliced in half by the building's edge a
 * fifth of the way into that walk. This much room, together with the fade `.user.leaving` carries, gets
 * them out of sight before the edge does it for them; reserving the whole
 * 100px would be a wide empty strip down the side of every building instead.
 */
export const TRAILING_ROOM = 44;

/**
 * How much of the 20 world units the engine leaves between two cars belongs to
 * each car's own shaft, per side.
 *
 * `src/game/world.ts` advances `currentX` by `ELEVATOR_SPACING + width` for
 * every elevator, so between two neighboring cars there are exactly 20 world
 * units of nothing. A shaft is a wall around its car with an order strip inside
 * the left wall, which is room the car itself does not have — so it is taken
 * from that gap: 8 units either side leaves 4 between two shafts, the narrowest
 * seam that still reads as two separate shafts rather than one wide one.
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
  const scaleX = clamp(minShaftScale, free / naturalWidth, MAX_ZOOM);

  return { scaleX };
}
