/**
 * How much to shrink the real building horizontally to fit the stage.
 *
 * `layoutBuilding()`'s own `shaftWidths` are sized off the mockup's `wanted`
 * formula (`clamp(34, 24 + capacity * 8, 116) + 7`), which has nothing to do
 * with a real elevator's width — the engine draws a car at `capacity * 10`
 * (`src/game/elevator.ts`'s `width = maxUsers * 10`). Widget 6b renders real
 * `entities/elevator` cars whose in-car floor buttons and door indicators are
 * laid out against that real width, so shrinking them by the mockup's ratio
 * would draw a car narrower or wider than its own contents expect. This module
 * computes the one uniform `scaleX` that fits the *real* cars into the room
 * `layoutBuilding()` left for shafts, keeping every car's proportions exactly
 * the engine's own — never remapped to the mockup's curve. See the "Единый
 * глобальный масштаб" decision this widget was built against.
 *
 * The clamp shape below — free space over natural width, floored by whatever
 * keeps the narrowest car at {@link MIN_SHAFT}, ceilinged at 1 — is carried
 * over from `layoutBuilding()`'s own horizontal pass unchanged; only the
 * widths and the free-space budget it is applied to are real rather than
 * wanted.
 *
 * Pure geometry, like `layout-building.ts` and `smart-position.ts`: plain
 * numbers in, plain numbers out, so it runs the same under Node as it will
 * once wired to real elevators.
 */

import { CORRIDOR, MIN_SHAFT } from "./layout-building.ts";

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
  /** The car height `layoutBuilding()` computed for the same stage, driving the rider-figure threshold. */
  readonly carHeight: number;
  /** Every elevator in the world, left to right. */
  readonly elevators: readonly ShaftScaleElevator[];
}

/** The uniform horizontal scale, and which cars are too narrow at it to draw riders as figures. */
export interface ShaftScale {
  /** The factor every car's real `worldX`/`width` is multiplied by to fit the stage. */
  readonly scaleX: number;
  /**
   * Whether each car is too narrow, once scaled, to draw its riders as
   * figures and must show a bare count instead — in `elevators` order.
   */
  readonly counted: readonly boolean[];
}

/**
 * Computes the uniform horizontal scale for the real building, and which cars
 * are too narrow at that scale to draw riders as figures.
 *
 * @param input - The stage's width, the floor-number column's width, the car
 * height, and every real elevator's own geometry.
 * @returns The scale and the per-car counted flags.
 */
export function computeShaftScale(input: ShaftScaleInput): ShaftScale {
  const { stageWidth, levelsWidth, carHeight, elevators } = input;
  if (elevators.length === 0) {
    return { scaleX: 1, counted: [] };
  }

  const free = Math.max(120, stageWidth - 32 - levelsWidth - CORRIDOR - 22);
  const first = requireAt(elevators, 0);
  const last = requireAt(elevators, elevators.length - 1);
  const naturalWidth = last.worldX + last.width - first.worldX;
  const minShaftScale = Math.max(...elevators.map((elevator) => MIN_SHAFT / elevator.width));
  const scaleX = clamp(Math.min(1, minShaftScale), free / naturalWidth, 1);

  // Same rider-figure threshold as layoutBuilding()'s own: the order-lane
  // (7px) and the cabin's edges (12px) eat into the shaft's rendered width,
  // and what's left has to fit one rider glyph per seat.
  const riderWidth = Math.round(clamp(8, carHeight - 22, 16) * 0.55) + 1;
  const counted = elevators.map((elevator) => {
    const renderedWidth = elevator.width * scaleX;
    const inner = renderedWidth - 12 - 7;
    return elevator.capacity * riderWidth > inner;
  });

  return { scaleX, counted };
}
