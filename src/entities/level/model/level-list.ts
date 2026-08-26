/** Shapes the numbered levels for a level switcher to draw as a row of tiles; a level's identity is its position in the array. */

import type { Level } from "#game/levels.ts";

/** What a level-switcher tile needs to know about one level. */
export interface LevelSummary {
  /** The level's index into the array it was listed from. */
  readonly index: number;
  /** The 1-based number a player sees, `index + 1`. */
  readonly number: number;
}

/** Builds one summary per level, in playing order. Takes the level list as a parameter so tests can pass a small fixture. */
export function listLevels(levels: readonly Level[]): readonly LevelSummary[] {
  return levels.map((_level, index) => ({
    index,
    number: index + 1,
  }));
}
