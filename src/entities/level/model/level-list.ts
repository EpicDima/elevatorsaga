/**
 * The numbered levels, shaped for a level switcher to draw as a row of
 * tiles.
 *
 * `#game/levels.ts`'s own `Level` has no `id` or `name` — a
 * level's identity is its position in the array, the same rule
 * {@link "#pages/game/index.ts"!App} already follows everywhere it reads a
 * level index off the URL. This module exists so a second place does not
 * reinvent that rule slightly differently: {@link listLevels} is the one
 * function that turns "index into the levels array" into "what a tile
 * shows."
 *
 * There was a second thing a summary carried until 2026-08-20 — `demo`, true
 * for the last entry, which used to be an endless level with no win condition.
 * That level is gone (see `#game/levels.ts`'s `requireSandbox`), so every
 * entry of the array is now a numbered level and the flag had nothing left
 * to distinguish.
 */

import type { Level } from "#game/levels.ts";

/** What a level-switcher tile needs to know about one level. */
export interface LevelSummary {
  /** The level's index into the array it was listed from. */
  readonly index: number;
  /** The 1-based number a player sees, `index + 1`. */
  readonly number: number;
}

/**
 * Builds one summary per level, in playing order.
 *
 * @param levels - The levels to summarise, in playing order —
 * ordinarily `#game/levels.ts`'s own `levels`, taken as a parameter
 * rather than imported directly so this stays testable against a small
 * fixture instead of the real 19-entry table.
 * @returns One summary per entry of `levels`.
 */
export function listLevels(levels: readonly Level[]): readonly LevelSummary[] {
  return levels.map((_level, index) => ({
    index,
    number: index + 1,
  }));
}
