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
 *
 * Two callers ask the question now, and that is why {@link isChallengeLocked}
 * is a function of its own rather than a line inside {@link
 * lockChallengeTiles}: the switcher asks it of every tile, to know which to
 * draw shut, and `src/pages/game/model/route.ts` asks it of one index, to know
 * whether an address may open what it names. A locking rule with two copies is
 * a rule with two answers, and the second copy would be the one nobody
 * remembers to change.
 */

import type { ChallengeSummary } from "#entities/challenge/index.ts";
import type { ChallengeTier } from "#entities/challenge-tier/index.ts";

/** A level-switcher tile, with whether it can be opened right now. */
export interface LevelTile extends ChallengeSummary {
  /** Whether this tile refuses a player who tries to open it. */
  readonly locked: boolean;
}

/**
 * Whether one challenge refuses a player who tries to open it.
 *
 * The whole rule, and the only copy of it. The first challenge is always open,
 * since there is nothing before it to clear. Every challenge after it is open
 * once the one immediately before it has a tier on record — any tier, bronze
 * included, since this is a gate on having *finished* the previous challenge,
 * not on how well.
 *
 * One exception used to sit in the middle of that: the last entry was an
 * endless demo with no win condition, which a rule built on "cleared" could
 * never have opened, so it was never locked. The demo is gone as of
 * 2026-08-20 — free play says the same thing better — and with it the
 * exception, so the rule above is now the whole rule.
 *
 * Deliberately says nothing about how many challenges exist: an index past the
 * end is somebody else's refusal, and answering "locked" for it here would be
 * this rule inventing an opinion about a challenge that is not there. The
 * router bounds the number before it asks.
 *
 * The record it reads is a browser's, so it can be anything — hand-edited,
 * carried over from before this rule existed, or simply sparse, since every
 * challenge used to be reachable from the row. Nothing here assumes it is a
 * run of cleared challenges from the first: each index is answered from the
 * one record immediately before it, so a record of `{5: gold}` alone opens
 * challenge 7 and leaves 2 through 6 shut.
 *
 * @param index - Zero-based index of the challenge being opened.
 * @param bestTiers - This browser's best-recorded tier per challenge index,
 * {@link "#entities/challenge-tier/index.ts"!readBestChallengeTiers}'s own
 * output. Only presence in this map is read, not which tier.
 * @returns Whether the challenge is still locked.
 */
export function isChallengeLocked(
  index: number,
  bestTiers: ReadonlyMap<number, ChallengeTier>,
): boolean {
  return index > 0 && !bestTiers.has(index - 1);
}

/**
 * Decides which tiles are locked.
 *
 * @param summaries - The challenges to lock, in playing order —
 * {@link "#entities/challenge/index.ts"!listChallenges}'s own output.
 * @param bestTiers - This browser's best-recorded tier per challenge index,
 * as {@link isChallengeLocked} reads it.
 * @returns One tile per entry of `summaries`, each with its `locked` state
 * added.
 */
export function lockChallengeTiles(
  summaries: readonly ChallengeSummary[],
  bestTiers: ReadonlyMap<number, ChallengeTier>,
): readonly LevelTile[] {
  return summaries.map((summary) => ({
    ...summary,
    locked: isChallengeLocked(summary.index, bestTiers),
  }));
}
