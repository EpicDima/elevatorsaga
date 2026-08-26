/**
 * The main goal bar's own meters, one per figure a level's bronze condition
 * reads. Deliberately thin: gathers only the numbers a meter needs to draw
 * itself; which CSS state it shows is decided by the `ui/` layer at draw time.
 */

import { requirementMet, requirementProgress } from "#entities/level-tier/index.ts";
import type { TierRequirementInfo } from "#entities/level-tier/index.ts";
import type { LevelWorldStats } from "#entities/level/index.ts";

/** One meter's worth of live figures for a single requirement. */
export interface GoalMeterView {
  /** The figure, direction and bar this meter reads. */
  readonly requirement: TierRequirementInfo;
  /** The live value of {@link requirement}'s own field. */
  readonly current: number;
  /** How full the meter's bar is, from {@link requirementProgress}. */
  readonly progress: number;
  /** Whether the run currently sits on the passing side of {@link requirement}. */
  readonly met: boolean;
}

/** Builds one {@link GoalMeterView} per requirement, in the order given (already the display order a goal bar wants). */
export function buildGoalMeters(
  requirements: readonly TierRequirementInfo[],
  world: LevelWorldStats,
): readonly GoalMeterView[] {
  return requirements.map((requirement) => ({
    requirement,
    current: world[requirement.field],
    progress: requirementProgress(requirement, world),
    met: requirementMet(requirement, world),
  }));
}
