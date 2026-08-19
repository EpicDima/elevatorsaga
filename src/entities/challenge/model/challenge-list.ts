/**
 * The numbered challenges, shaped for a level switcher to draw as a row of
 * tiles.
 *
 * `#game/challenges.ts`'s own `Challenge` has no `id` or `name` — a
 * challenge's identity is its position in the array, the same rule
 * {@link "#pages/game/index.ts"!App.#challengeLinks} already follows for today's
 * challenge row. This module exists so a second place does not reinvent that
 * rule slightly differently: {@link listChallenges} is the one function that
 * turns "index into the challenges array" into "what a tile shows,"
 * mirroring `#challengeLinks`'s own `num`/`demo` logic exactly.
 */

import type { Challenge } from "#game/challenges.ts";

/** What a level-switcher tile needs to know about one challenge. */
export interface ChallengeSummary {
  /** The challenge's index into the array it was listed from. */
  readonly index: number;
  /** The 1-based number a player sees, `index + 1`. */
  readonly number: number;
  /**
   * Whether this is the endless demo — no win condition, so it is labelled
   * rather than numbered and never locked. The last entry of the array,
   * the same rule `#challengeLinks` uses.
   */
  readonly demo: boolean;
}

/**
 * Builds one summary per challenge, in playing order.
 *
 * @param challenges - The challenges to summarise, in playing order —
 * ordinarily `#game/challenges.ts`'s own `challenges`, taken as a parameter
 * rather than imported directly so this stays testable against a small
 * fixture instead of the real 20-entry table.
 * @returns One summary per entry of `challenges`.
 */
export function listChallenges(challenges: readonly Challenge[]): readonly ChallengeSummary[] {
  const lastIndex = challenges.length - 1;
  return challenges.map((_challenge, index) => ({
    index,
    number: index + 1,
    demo: index === lastIndex,
  }));
}
