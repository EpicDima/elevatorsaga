/**
 * How close a live run is to a tier it has not earned yet.
 *
 * {@link "#game/challenge-tiers.ts"!evaluateChallengeTier} only ever answers
 * pass or fail, and only once a run has already ended — exactly right for a
 * verdict, and not enough for a goal bar that has to show a fill percentage
 * while the run is still going. This module adds that percentage, computed
 * straight from a {@link TierRequirementInfo}'s own `field`/`comparison`/
 * `threshold` and a live {@link ChallengeWorldStats} snapshot — `World`
 * itself, structurally, since nothing in `#game` builds a separate snapshot
 * object for this. No new table of thresholds exists here to drift from the
 * one `challenge-tiers.ts` actually enforces.
 */

import type { ChallengeWorldStats } from "#game/challenges.ts";
import type { TierRequirementInfo } from "#game/challenge-tiers.ts";

/**
 * A live figure is never let closer to "done" than this from a zero
 * denominator — an at-most requirement's fraction divides by the current
 * figure, and a run that has not moved a single passenger yet must not
 * produce `Infinity` or `NaN`.
 */
const MIN_DENOMINATOR = 1e-9;

/**
 * How far a live run has come toward clearing one requirement, as a fraction
 * from 0 (nothing done) to 1 (already cleared).
 *
 * An at-most requirement (lower is better — elapsed time, wait times, move
 * count, stop count) reads 1 once the live figure has fallen to the
 * threshold or below, and shrinks toward 0 as the figure grows past it. An
 * at-least requirement (higher is better — load factor, delivery rate) is
 * the mirror: 1 once the figure has climbed to the threshold or above.
 *
 * @param requirement - The field, direction and bar to measure against.
 * @param world - The run's current statistics.
 * @returns The fraction, clamped to `[0, 1]`.
 */
export function requirementProgress(
  requirement: TierRequirementInfo,
  world: ChallengeWorldStats,
): number {
  const current = world[requirement.field];
  const fraction =
    requirement.comparison === "atMost"
      ? requirement.threshold / Math.max(current, MIN_DENOMINATOR)
      : current / requirement.threshold;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * How far a live run has come toward clearing every requirement in a set, as
 * a single fraction.
 *
 * The minimum of the individual fractions, not their average — every
 * requirement in the set has to hold at once (this is what
 * {@link "#game/challenge-tiers.ts"!requireAll} builds), so the set as a
 * whole is only as far along as its least-advanced requirement. A fill bar
 * built on an average would show progress a run has not actually earned:
 * one requirement sitting at 100% and another at 0% is not "50% of the way
 * to gold," it is a requirement not yet touched at all.
 *
 * @param requirements - The requirement set to measure against, e.g. a
 * `ChallengeTierRequirements.silver` or `.gold` predicate's own
 * `.requirements`.
 * @param world - The run's current statistics.
 * @returns The fraction, clamped to `[0, 1]`; `1` for an empty set, the same
 * vacuous "every one of zero conditions holds" answer `requireAll` itself
 * gives.
 */
export function requirementSetProgress(
  requirements: readonly TierRequirementInfo[],
  world: ChallengeWorldStats,
): number {
  if (requirements.length === 0) {
    return 1;
  }
  return Math.min(...requirements.map((requirement) => requirementProgress(requirement, world)));
}
