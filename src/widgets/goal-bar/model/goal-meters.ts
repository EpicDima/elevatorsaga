/**
 * The main goal bar's own meters — one per figure a level's bronze
 * condition actually reads, ported from `design/ui-mockup.html`'s
 * `renderGoals()`/`drawGoals()`. The mockup builds one `.meter` per entry of
 * `world.goals`; production's equivalent structured list is a
 * `LevelCondition`'s own {@link TierRequirementInfo} array, so a caller
 * passes `level.condition.requirements` straight through rather than this
 * module reaching into `entities/level` itself for it.
 *
 * Deliberately thin: this only gathers the numbers a meter needs to draw
 * itself (the live figure, how full its bar is, whether it currently holds).
 * Which CSS state a meter shows — `is-done` for the one at-least figure (the
 * delivery target), `is-near`/`is-late` for an at-most one — is a rendering
 * decision the `ui/` layer makes from {@link GoalMeterView.progress}/`.met`
 * at draw time, the same way `drawGoals()` computes its own classes inline
 * from `share` rather than from a pre-baked state field.
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

/**
 * Builds one {@link GoalMeterView} per requirement, in the order given —
 * already the display order a goal bar wants, since
 * `entities/level`/`LevelCondition.requirements` list the delivery
 * target first and its limit(s) after, top to bottom the same way the mockup's
 * own double-reverse (`slice().reverse()` then `prepend` each) nets out to.
 *
 * @param requirements - A level's own requirement list, e.g. its
 * `condition.requirements`.
 * @param world - The run's current statistics.
 * @returns One view per requirement, same order.
 */
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
