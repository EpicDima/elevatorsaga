/**
 * How close a live run is to a tier it has not earned yet.
 *
 * {@link "#game/level-tiers.ts"!evaluateLevelTier} only ever answers
 * pass or fail, and only once a run has already ended — exactly right for a
 * verdict, and not enough for a goal bar that has to show a fill percentage
 * while the run is still going. This module adds that percentage, computed
 * straight from a {@link TierRequirementInfo}'s own `field`/`comparison`/
 * `threshold` and a live {@link LevelWorldStats} snapshot — `World`
 * itself, structurally, since nothing in `#game` builds a separate snapshot
 * object for this. No new table of thresholds exists here to drift from the
 * one `level-tiers.ts` actually enforces.
 */

import type { LevelWorldStats } from "#game/levels.ts";
import type { TierRequirementInfo } from "#game/level-tiers.ts";

/**
 * How full a live run has made one requirement's own bar, as a fraction from
 * 0 (a fresh run, nothing spent or earned yet) to 1 (the threshold reached
 * or blown).
 *
 * The same `current / threshold` reading for both directions: a fill bar has
 * to mean the same thing here as it does in the meter above it, or a player
 * would have to relearn what "full" means every time they open the card. For
 * an at-least requirement (higher is better — load factor, delivery rate) that
 * reading is already the intuitive one: empty at nothing earned, full once the
 * bar is reached. For an at-most requirement (lower is better — elapsed time,
 * wait times, move count, stop count) it reads as a budget: empty at nothing
 * spent, full once the limit is reached, and it stays full rather than
 * draining back down if the run keeps going past it. The bar is not a live
 * pass/fail verdict — star-lighting deliberately does not use this fraction —
 * only a record of how much of the allowance is gone.
 *
 * @param requirement - The field, direction and bar to measure against.
 * @param world - The run's current statistics.
 * @returns The fraction, clamped to `[0, 1]`.
 */
export function requirementProgress(
  requirement: TierRequirementInfo,
  world: LevelWorldStats,
): number {
  const current = world[requirement.field];
  return Math.min(1, Math.max(0, current / requirement.threshold));
}

/**
 * Whether a live run currently sits on the passing side of one requirement —
 * not how full its bar is (that is {@link requirementProgress}), the plain
 * pass/fail answer for one requirement at a time.
 * The same direction check {@link "#game/level-tiers.ts"!TierPredicate}'s
 * own internal `tierPredicate` factory already builds into a composed
 * predicate, exposed here one requirement at a time: a goal bar needs this
 * for a single figure (a budget already blown, a bronze target not yet
 * reached) independently of whichever other requirements share its tier.
 *
 * @param requirement - The field, direction and bar to test.
 * @param world - The run's current statistics.
 * @returns Whether `field` currently sits at or past `threshold`, on the
 * required side.
 */
export function requirementMet(requirement: TierRequirementInfo, world: LevelWorldStats): boolean {
  const current = world[requirement.field];
  return requirement.comparison === "atMost"
    ? current <= requirement.threshold
    : current >= requirement.threshold;
}

/**
 * How far a live run has come toward clearing every requirement in a set, as
 * a single fraction.
 *
 * The minimum of the individual fractions, not their average — every
 * requirement in the set has to hold at once (this is what
 * {@link "#game/level-tiers.ts"!requireAll} builds), so the set as a
 * whole is only as far along as its least-advanced requirement. A fill bar
 * built on an average would show progress a run has not actually earned:
 * one requirement sitting at 100% and another at 0% is not "50% of the way
 * to gold," it is a requirement not yet touched at all.
 *
 * @param requirements - The requirement set to measure against, e.g. a
 * `LevelTierRequirements.silver` or `.gold` predicate's own
 * `.requirements`.
 * @param world - The run's current statistics.
 * @returns The fraction, clamped to `[0, 1]`; `1` for an empty set, the same
 * vacuous "every one of zero conditions holds" answer `requireAll` itself
 * gives.
 */
export function requirementSetProgress(
  requirements: readonly TierRequirementInfo[],
  world: LevelWorldStats,
): number {
  if (requirements.length === 0) {
    return 1;
  }
  return Math.min(...requirements.map((requirement) => requirementProgress(requirement, world)));
}
