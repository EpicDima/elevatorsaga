/** Computes how close a live, still-running level is to a tier's requirements, as a fill fraction. */

import type { LevelWorldStats } from "#game/levels.ts";
import type { TierRequirementInfo } from "#game/level-tiers.ts";

/**
 * How full one requirement's bar is, as a fraction from 0 to 1.
 * For an at-most requirement this reads as a spent budget: it fills as the
 * value rises toward the limit and stays full rather than draining back down
 * if the run keeps going past it.
 */
export function requirementProgress(
  requirement: TierRequirementInfo,
  world: LevelWorldStats,
): number {
  const current = world[requirement.field];
  return Math.min(1, Math.max(0, current / requirement.threshold));
}

/** Whether a live run currently passes one requirement on its own, independent of the fraction in {@link requirementProgress}. */
export function requirementMet(requirement: TierRequirementInfo, world: LevelWorldStats): boolean {
  const current = world[requirement.field];
  return requirement.comparison === "atMost"
    ? current <= requirement.threshold
    : current >= requirement.threshold;
}

/**
 * How far a run has come toward clearing every requirement in a set, as the
 * minimum (not the average) of the individual fractions: one requirement at
 * 100% and another at 0% is not halfway, it's untouched.
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
