/**
 * Which of the numbered challenges a player may open right now.
 *
 * Ported from `design/ui-mockup.html`'s own sequential locking (its
 * `CHALLENGES_IDS` comment: "order used to decide what is already open") —
 * a real behavior change from today's production, where every challenge is
 * reachable from the row regardless of what came before. Deliberately
 * narrow: this is the "Уровни" block's own rule, decided separately from
 * `#entities/tutorial-task/model/progress.ts`'s block, which keeps its
 * documented "the track locks nothing" behavior unchanged.
 *
 * Composes two entities rather than living in either: {@link
 * "#entities/challenge/index.ts"!ChallengeSummary} for the row's order and
 * {@link "#entities/challenge-tier/index.ts"!ChallengeTier} records for what
 * has actually been cleared. Cross-entity rules like this one are feature-
 * layer work, not something either entity should reach into the other for.
 */

import type { ChallengeSummary } from "#entities/challenge/index.ts";
import type { ChallengeTier } from "#entities/challenge-tier/index.ts";

/** A level-switcher tile, with whether it can be opened right now. */
export interface LevelTile extends ChallengeSummary {
  /** Whether this tile refuses a player who tries to open it. */
  readonly locked: boolean;
}

/**
 * Decides which tiles are locked.
 *
 * The first challenge is always open, since there is nothing before it to
 * clear. Every challenge after it is open once the one immediately before it
 * has a tier on record — any tier, bronze included, since this is a gate on
 * having *finished* the previous challenge, not on how well. The endless
 * demo is never locked, whatever its position: it has no win condition
 * ({@link "#game/challenges.ts"!requireDemo}), so a rule built on "cleared"
 * can never open it, and it is not meant to be gated in the first place.
 *
 * @param summaries - The challenges to lock, in playing order —
 * {@link "#entities/challenge/index.ts"!listChallenges}'s own output.
 * @param bestTiers - This browser's best-recorded tier per challenge index,
 * {@link "#entities/challenge-tier/index.ts"!readBestChallengeTiers}'s own
 * output. Only presence in this map is read, not which tier.
 * @returns One tile per entry of `summaries`, each with its `locked` state
 * added.
 */
export function lockChallengeTiles(
  summaries: readonly ChallengeSummary[],
  bestTiers: ReadonlyMap<number, ChallengeTier>,
): readonly LevelTile[] {
  return summaries.map((summary) => ({
    ...summary,
    locked: summary.demo ? false : summary.index > 0 && !bestTiers.has(summary.index - 1),
  }));
}
