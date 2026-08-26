/**
 * Bronze, silver and gold: an achievement layer added on top of a level's own
 * win/lose verdict, judged from a final {@link "./levels.ts"!LevelWorldStats} snapshot.
 */

import type { LevelWorldStats } from "./levels.ts";

/** One rank a cleared level can be awarded. */
export type LevelTier = "bronze" | "silver" | "gold";

/** Every tier, worst to best. */
export const LEVEL_TIERS: readonly LevelTier[] = ["bronze", "silver", "gold"];

/**
 * A pass/fail test over a level's final statistics, run only once a level has
 * already ended in a win. Also carries a {@link TierRequirementInfo.requirements}
 * array describing the figure(s) it reads, so a UI can show progress toward a tier.
 */
export type TierPredicate = ((world: LevelWorldStats) => boolean) & {
  readonly requirements: readonly TierRequirementInfo[];
};

/** Which way a {@link TierRequirementInfo.threshold} bounds the figure it reads. */
export type TierRequirementComparison = "atMost" | "atLeast";

/**
 * One fact a {@link TierPredicate} tests, inspectable without calling the
 * predicate. A UI computes a progress fraction from this plus a live
 * {@link LevelWorldStats} snapshot; this module only says "did it pass."
 */
export interface TierRequirementInfo {
  /** The {@link LevelWorldStats} figure this requirement reads. */
  readonly field: keyof LevelWorldStats;
  /** Whether `field` must stay at or under `threshold`, or reach it or above. */
  readonly comparison: TierRequirementComparison;
  /** The bar `field` must clear. */
  readonly threshold: number;
}

/** The silver and gold bars a level asks a winning run to clear. */
export interface LevelTierRequirements {
  /** Must hold for the run to be rated silver or better. */
  readonly silver: TierPredicate;
  /** Must hold for the run to be rated gold. */
  readonly gold: TierPredicate;
}

/** Builds a predicate reading one {@link LevelWorldStats} field against one threshold, paired with the {@link TierRequirementInfo} describing it. */
function tierPredicate(
  field: keyof LevelWorldStats,
  comparison: TierRequirementComparison,
  threshold: number,
): TierPredicate {
  const test = (world: LevelWorldStats): boolean =>
    comparison === "atMost" ? world[field] <= threshold : world[field] >= threshold;
  return Object.assign(test, { requirements: [{ field, comparison, threshold }] });
}

/** Requires a run to have finished within a time limit. */
export function underElapsedTime(limitSeconds: number): TierPredicate {
  return tierPredicate("elapsedTime", "atMost", limitSeconds);
}

/** Requires no passenger to have waited longer than a limit. */
export function underMaxWaitTime(limitSeconds: number): TierPredicate {
  return tierPredicate("maxWaitTime", "atMost", limitSeconds);
}

/** Requires a run to have spent no more than a move budget. */
export function underMoveCount(limitMoves: number): TierPredicate {
  return tierPredicate("moveCount", "atMost", limitMoves);
}

/** Requires the mean wait to have stayed under a limit. */
export function underAvgWaitTime(limitSeconds: number): TierPredicate {
  return tierPredicate("avgWaitTime", "atMost", limitSeconds);
}

/** Requires a run to have opened doors no more than a limit's worth of times. */
export function underStopCount(limitStops: number): TierPredicate {
  return tierPredicate("stopCount", "atMost", limitStops);
}

/** Requires the cars to have carried at least this much of a load, on average. */
export function atLeastAvgLoadFactorOnMove(minFactor: number): TierPredicate {
  return tierPredicate("avgLoadFactorOnMove", "atLeast", minFactor);
}

/** Requires a sustained delivery rate of at least this many passengers a second. */
export function atLeastTransportedPerSec(minRate: number): TierPredicate {
  return tierPredicate("transportedPerSec", "atLeast", minRate);
}

/**
 * Combines predicates so every one of them has to hold. An empty list yields
 * a predicate that is always true, per `Array.prototype.every`'s own semantics.
 */
export function requireAll(...predicates: readonly TierPredicate[]): TierPredicate {
  const test = (world: LevelWorldStats): boolean =>
    predicates.every((predicate) => predicate(world));
  return Object.assign(test, {
    requirements: predicates.flatMap((predicate) => predicate.requirements),
  });
}

/**
 * Decides the tier a finished run earned. `won` is the verdict a
 * {@link "./levels.ts"!LevelCondition} already reached and is never
 * recomputed here; gold is checked before silver since nothing enforces that `tiers` has gold imply silver.
 *
 * @returns `null` for a loss; otherwise `"bronze"`, `"silver"`, or `"gold"`.
 */
export function evaluateLevelTier(
  won: boolean,
  world: LevelWorldStats,
  tiers: LevelTierRequirements | undefined,
): LevelTier | null {
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
