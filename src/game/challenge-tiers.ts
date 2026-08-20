/**
 * Bronze, silver and gold: the achievement layer on top of win/lose.
 *
 * Every challenge in {@link "./challenges.ts"!challenges} already has a bar —
 * {@link "./challenges.ts"!ChallengeCondition.evaluate} says won or lost, and
 * that is the whole of what a run has ever meant. This module adds a second,
 * strictly additive question, asked only once a run has already been won:
 * *how well*. It cannot change the answer to the first question, only add
 * detail to a "yes."
 *
 * Pure and dependency-free on purpose — the only import is a type, never a
 * value, so this module carries no engine, no i18n, and no notion of a live
 * `World`. What it operates on is a {@link "./challenges.ts"!ChallengeWorldStats}
 * snapshot, the same shape a condition is judged against, which is what lets
 * every function here be tested with a plain object literal and no simulated
 * run at all.
 */

import type { ChallengeWorldStats } from "./challenges.ts";

/** One rank a cleared challenge can be awarded. */
export type ChallengeTier = "bronze" | "silver" | "gold";

/** Every tier, worst to best. */
export const CHALLENGE_TIERS: readonly ChallengeTier[] = ["bronze", "silver", "gold"];

/**
 * A single pass/fail test over a challenge's final statistics.
 *
 * Deliberately narrower than {@link "./challenges.ts"!ChallengeCondition.evaluate},
 * whose `boolean | null` exists to let a run keep going while the outcome is
 * still undecided — a condition is consulted on every `stats_changed`, mid-run,
 * and has to be able to say "not yet." A tier predicate is never asked that
 * question: {@link evaluateChallengeTier} only ever calls one after the run has
 * already ended and produced a verdict, against the one, final `world` that
 * verdict was read from. There is no "still counting" state for a plain
 * `(world) => boolean` to fail to express, so it does not have one, and a
 * predicate can be exercised directly against a synthetic fixture without
 * standing up a world or driving a clock through it.
 *
 * Beyond that call signature, every predicate this module builds also carries
 * a {@link TierRequirementInfo.requirements} array describing the figure(s) it
 * reads — this is what lets a UI (a goal bar's live progress fill, a tier
 * popover's per-requirement row) show *how close* a run is to a bar, without
 * this module exposing a second, parallel table of the same thresholds that
 * could drift from the predicates actually enforced.
 */
export type TierPredicate = ((world: ChallengeWorldStats) => boolean) & {
  readonly requirements: readonly TierRequirementInfo[];
};

/** Which way a {@link TierRequirementInfo.threshold} bounds the figure it reads. */
export type TierRequirementComparison = "atMost" | "atLeast";

/**
 * One fact a {@link TierPredicate} tests, inspectable independently of calling
 * the predicate — the figure it reads, which way the bar runs, and the bar
 * itself. A UI computes a progress fraction from this plus a live
 * {@link ChallengeWorldStats} snapshot; this module has no notion of "how
 * close," only "did it pass," so the fraction math lives elsewhere.
 */
export interface TierRequirementInfo {
  /** The {@link ChallengeWorldStats} figure this requirement reads. */
  readonly field: keyof ChallengeWorldStats;
  /** Whether `field` must stay at or under `threshold`, or reach it or above. */
  readonly comparison: TierRequirementComparison;
  /** The bar `field` must clear. */
  readonly threshold: number;
}

/** The silver and gold bars a challenge asks a winning run to clear. */
export interface ChallengeTierRequirements {
  /** Must hold for the run to be rated silver or better. */
  readonly silver: TierPredicate;
  /** Must hold for the run to be rated gold. */
  readonly gold: TierPredicate;
}

/**
 * Builds a predicate that reads one {@link ChallengeWorldStats} field against
 * one threshold, and attaches the {@link TierRequirementInfo} describing it —
 * the one place that pairing is written, so every factory below stays a
 * one-line call instead of a hand-rolled closure plus a hand-rolled metadata
 * literal that could disagree with it.
 *
 * @param field - The figure to read.
 * @param comparison - Which way `threshold` bounds `field`.
 * @param threshold - The bar `field` must clear.
 * @returns The predicate.
 */
function tierPredicate(
  field: keyof ChallengeWorldStats,
  comparison: TierRequirementComparison,
  threshold: number,
): TierPredicate {
  const test = (world: ChallengeWorldStats): boolean =>
    comparison === "atMost" ? world[field] <= threshold : world[field] >= threshold;
  return Object.assign(test, { requirements: [{ field, comparison, threshold }] });
}

/**
 * Requires a run to have finished within a time limit.
 *
 * @param limitSeconds - Highest {@link ChallengeWorldStats.elapsedTime} allowed.
 * @returns The predicate.
 */
export function underElapsedTime(limitSeconds: number): TierPredicate {
  return tierPredicate("elapsedTime", "atMost", limitSeconds);
}

/**
 * Requires no passenger to have waited longer than a limit.
 *
 * @param limitSeconds - Highest {@link ChallengeWorldStats.maxWaitTime} allowed.
 * @returns The predicate.
 */
export function underMaxWaitTime(limitSeconds: number): TierPredicate {
  return tierPredicate("maxWaitTime", "atMost", limitSeconds);
}

/**
 * Requires a run to have spent no more than a move budget.
 *
 * @param limitMoves - Highest {@link ChallengeWorldStats.moveCount} allowed.
 * @returns The predicate.
 */
export function underMoveCount(limitMoves: number): TierPredicate {
  return tierPredicate("moveCount", "atMost", limitMoves);
}

/**
 * Requires the mean wait to have stayed under a limit.
 *
 * @param limitSeconds - Highest {@link ChallengeWorldStats.avgWaitTime} allowed.
 * @returns The predicate.
 */
export function underAvgWaitTime(limitSeconds: number): TierPredicate {
  return tierPredicate("avgWaitTime", "atMost", limitSeconds);
}

/**
 * Requires a run to have opened doors no more than a limit's worth of times.
 *
 * @param limitStops - Highest {@link ChallengeWorldStats.stopCount} allowed.
 * @returns The predicate.
 */
export function underStopCount(limitStops: number): TierPredicate {
  return tierPredicate("stopCount", "atMost", limitStops);
}

/**
 * Requires the cars to have carried at least this much of a load, on average.
 *
 * @param minFactor - Lowest {@link ChallengeWorldStats.avgLoadFactorOnMove} allowed.
 * @returns The predicate.
 */
export function atLeastAvgLoadFactorOnMove(minFactor: number): TierPredicate {
  return tierPredicate("avgLoadFactorOnMove", "atLeast", minFactor);
}

/**
 * Requires a sustained delivery rate of at least this many passengers a second.
 *
 * @param minRate - Lowest {@link ChallengeWorldStats.transportedPerSec} allowed.
 * @returns The predicate.
 */
export function atLeastTransportedPerSec(minRate: number): TierPredicate {
  return tierPredicate("transportedPerSec", "atLeast", minRate);
}

/**
 * Combines predicates so every one of them has to hold.
 *
 * What a challenge whose gold tier tightens more than one axis at once is
 * built out of — the per-challenge table this module's design was written
 * against has several such challenges, where gold means a stricter limit on
 * one existing axis *and* a bar on a metric no condition reads today, so that
 * a program cannot buy gold on one axis by spending the other freely.
 *
 * @param predicates - The predicates that must all pass. An empty list yields
 * a predicate that is always true, `Array.prototype.every`'s own answer for
 * "every one of zero conditions holds" — nothing in this module calls it with
 * zero predicates, but there is no reason to special-case an empty combinator
 * when `.every` already does the right thing with one.
 * @returns A predicate that holds exactly when all of `predicates` do, whose
 * `requirements` list every one of `predicates`' requirements in order.
 */
export function requireAll(...predicates: readonly TierPredicate[]): TierPredicate {
  const test = (world: ChallengeWorldStats): boolean =>
    predicates.every((predicate) => predicate(world));
  return Object.assign(test, {
    requirements: predicates.flatMap((predicate) => predicate.requirements),
  });
}

/**
 * Decides the tier a finished run earned.
 *
 * @param won - The verdict {@link "./challenges.ts"!ChallengeCondition.evaluate}
 * already reached for this run. Taken as a parameter rather than recomputed
 * here, and that is not a convenience — it is the whole safety argument this
 * function rests on. A condition's threshold lives inside a closure this
 * module never sees, so there is no second copy of "won" for this function to
 * compute and no way for the two to disagree: whatever the condition already
 * decided is what a tier can be built on top of, and nothing else. It is
 * structurally impossible for this function to award a tier on a loss, or to
 * change whether a run counts as won, because it never touches the question
 * of winning at all.
 * @param world - The run's final statistics, the same snapshot `won` was
 * decided from.
 * @param tiers - The challenge's silver/gold requirements, or `undefined` for
 * a challenge that has none.
 * @returns `null` when `won` is `false` — there is no tier for a loss, only a
 * verdict. `"bronze"` when `won` is `true` and either `tiers` is `undefined`
 * (today's challenges, and the sandbox, which never had anything more to
 * say than win/lose) or neither `tiers.silver` nor `tiers.gold` holds.
 * `"silver"` or `"gold"` when the corresponding requirement holds, gold
 * checked first since it is the stricter of the two and a run clearing gold
 * has necessarily cleared silver's bar as well for every requirement this
 * module builds — though nothing here enforces that a `tiers` value supplied
 * from outside actually nests that way, which is why gold is tried first
 * rather than assumed to imply it.
 */
export function evaluateChallengeTier(
  won: boolean,
  world: ChallengeWorldStats,
  tiers: ChallengeTierRequirements | undefined,
): ChallengeTier | null {
  if (!won) {
    return null;
  }
  if (tiers === undefined) {
    return "bronze";
  }
  if (tiers.gold(world)) {
    return "gold";
  }
  if (tiers.silver(world)) {
    return "silver";
  }
  return "bronze";
}
