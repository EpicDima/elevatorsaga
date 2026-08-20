/**
 * The numbered challenges, shaped for a level switcher to draw as a row of
 * tiles.
 *
 * `#game/challenges.ts`'s own `Challenge` has no `id` or `name` — a
 * challenge's identity is its position in the array, the same rule
 * {@link "#pages/game/index.ts"!App} already follows everywhere it reads a
 * challenge index off the URL. This module exists so a second place does not
 * reinvent that rule slightly differently: {@link listChallenges} is the one
 * function that turns "index into the challenges array" into "what a tile
 * shows."
 *
 * There was a second thing a summary carried until 2026-08-20 — `demo`, true
 * for the last entry, which used to be an endless level with no win condition.
 * That level is gone (see `#game/challenges.ts`'s `requireSandbox`), so every
 * entry of the array is now a numbered challenge and the flag had nothing left
 * to distinguish.
 */

import type { Challenge } from "#game/challenges.ts";

/** What a level-switcher tile needs to know about one challenge. */
export interface ChallengeSummary {
  /** The challenge's index into the array it was listed from. */
  readonly index: number;
  /** The 1-based number a player sees, `index + 1`. */
  readonly number: number;
}

/**
 * Builds one summary per challenge, in playing order.
 *
 * @param challenges - The challenges to summarise, in playing order —
 * ordinarily `#game/challenges.ts`'s own `challenges`, taken as a parameter
 * rather than imported directly so this stays testable against a small
 * fixture instead of the real 19-entry table.
 * @returns One summary per entry of `challenges`.
 */
export function listChallenges(challenges: readonly Challenge[]): readonly ChallengeSummary[] {
  return challenges.map((_challenge, index) => ({
    index,
    number: index + 1,
  }));
}
