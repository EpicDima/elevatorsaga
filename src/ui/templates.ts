/**
 * Accessible-name label helpers and the seed link's data shape.
 * Call `t` inside each function, never at module scope — a module-scope constant would freeze in whatever locale was active at import time.
 */

import { t } from "../i18n/index.ts";

/**
 * Accessible name for a floor's "call up" button.
 * A function, not a literal, so the initial draw and a later relabel can never use different text for the same key.
 */
export function floorCallUpLabel(level: number): string {
  return t("game.floor.callUp", { floor: level });
}

/** Accessible name for a floor's "call down" button; see {@link floorCallUpLabel} for why this is a function. */
export function floorCallDownLabel(level: number): string {
  return t("game.floor.callDown", { floor: level });
}

/**
 * Accessible name for one elevator car; see {@link floorCallUpLabel} for why this is a function.
 * `index` is zero-based, matching the car's subscript in the player's own `elevators` array.
 */
export function elevatorLabel(index: number): string {
  return t("game.elevator.label", { number: index });
}

/** Accessible name for one in-car floor button; see {@link floorCallUpLabel} for why this is a function. */
export function elevatorFloorButtonLabel(floorNum: number): string {
  return t("game.elevator.floorButton", { floor: floorNum });
}

/** The seed of the run in progress, and where the line's link goes. */
export interface SeedLinkData {
  /** The seed itself, exactly as it appears in the URL. */
  readonly seed: string;
  /**
   * A hash URL naming this run outright, including the seed and every other current param (level, speed, etc.).
   * Still set even when navigating to it would be a no-op — it's also what the console prints as the run's address.
   */
  readonly url: string;
}
