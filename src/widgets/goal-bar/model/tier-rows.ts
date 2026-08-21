/**
 * The tier popover's own rows — bronze, and silver/gold when a level has them.
 *
 * A row's held/lost state is read off
 * {@link "#entities/level-tier/index.ts"!evaluateLevelTier}'s one verdict
 * rather than re-derived from the requirements here. Deriving bronze/silver/
 * gold pass-fail a second time would be exactly the "parallel table that could
 * drift" `#game/level-tiers.ts`'s own doc comment on {@link TierPredicate}
 * warns against.
 *
 * A row's checkmark or cross is gated on the run being over, not on a live
 * pass/fail reading: a run "passing" a silver requirement on its first tick,
 * before anything has happened, would light silver green for a reason that has
 * nothing to do with the player's own effort. {@link buildTierRows}'s `verdict`
 * parameter is `null` for exactly as long as
 * {@link "#entities/level/index.ts"!LevelCondition.evaluate} itself says so
 * (still undecided), and every row reads `"pending"` for that whole stretch
 * regardless of where the run's own figures currently sit.
 */

import {
  LEVEL_TIERS,
  evaluateLevelTier,
  requirementMet,
  requirementProgress,
} from "#entities/level-tier/index.ts";
import type { LevelTier, TierRequirementInfo } from "#entities/level-tier/index.ts";
import type { Level, LevelWorldStats } from "#entities/level/index.ts";

/** One requirement's own line inside a tier row. */
export interface TierRequirementRow {
  /** The figure, direction and bar this line reads. */
  readonly requirement: TierRequirementInfo;
  /** The live value of {@link requirement}'s own field. */
  readonly current: number;
  /** How full this line's own bar is, from `requirementProgress`. */
  readonly progress: number;
  /**
   * Whether this line should read as broken. While the run is still live,
   * only an at-most requirement already past its bar counts — an at-least one
   * not yet reached is simply not there yet, not a failure: ten of a hundred
   * passengers delivered is the middle of a run, not a loss. Once the run has
   * ended, any unmet requirement counts, in either direction.
   */
  readonly miss: boolean;
}

/** Whether a run has earned, missed, or not yet decided a tier row. */
export type TierRowState = "held" | "lost" | "pending";

/** One tier's own row in the popover. */
export interface TierRow {
  /** Which tier this row is for. */
  readonly tier: LevelTier;
  /** This tier's own requirements, each with its live figures. */
  readonly requirements: readonly TierRequirementRow[];
  /** Whether the run has earned this tier, missed it, or not decided yet. */
  readonly state: TierRowState;
}

function buildRequirementRow(
  requirement: TierRequirementInfo,
  world: LevelWorldStats,
  finished: boolean,
): TierRequirementRow {
  const met = requirementMet(requirement, world);
  return {
    requirement,
    current: world[requirement.field],
    progress: requirementProgress(requirement, world),
    miss: finished ? !met : requirement.comparison === "atMost" && !met,
  };
}

function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Builds the popover's rows for one level: always bronze, plus
 * silver/gold when the level has them (see
 * {@link "#entities/level-tier/index.ts"!evaluateLevelTier}'s own
 * doc comment on a `tiers === undefined` level — bronze is the only tier
 * such a level has). Empty when the level has nothing to meter at all — the
 * sandbox tile's own `requireSandbox` condition never resolves and carries
 * `requirements: []`, so there are no rewards to draw.
 *
 * @param level - The level being played.
 * @param world - The run's current statistics.
 * @param verdict - The same tri-state
 * {@link "#entities/level/index.ts"!LevelCondition.evaluate} itself
 * returns: `null` while still undecided, `true`/`false` once the run has
 * ended. Taken as a parameter rather than recomputed here for the same
 * reason {@link evaluateLevelTier} takes its own `won` as a parameter —
 * a caller may fold in run-driving policy this module has no business
 * knowing about (an instant run's own timeout, for one), and there must be
 * only one place that decides a run is over.
 * @returns One row per tier this level has anything to say about, bronze
 * first.
 */
export function buildTierRows(
  level: Level,
  world: LevelWorldStats,
  verdict: boolean | null,
): readonly TierRow[] {
  if (level.condition.requirements.length === 0) {
    return [];
  }

  const finished = verdict !== null;
  const earnedTier = verdict === null ? null : evaluateLevelTier(verdict, world, level.tiers);
  const rowState = (tier: LevelTier): TierRowState => {
    if (!finished) {
      return "pending";
    }
    return earnedTier !== null && tierRank(tier) <= tierRank(earnedTier) ? "held" : "lost";
  };
  const row = (tier: LevelTier, requirements: readonly TierRequirementInfo[]): TierRow => ({
    tier,
    requirements: requirements.map((requirement) =>
      buildRequirementRow(requirement, world, finished),
    ),
    state: rowState(tier),
  });

  const rows: TierRow[] = [row("bronze", level.condition.requirements)];
  if (level.tiers !== undefined) {
    rows.push(row("silver", level.tiers.silver.requirements));
    rows.push(row("gold", level.tiers.gold.requirements));
  }
  return rows;
}
