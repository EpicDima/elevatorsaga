/**
 * The tier popover's own rows: bronze/silver/gold for a graded level, and a
 * lone gold row for one that only asks to be cleared. A row reads `"pending"`
 * until the run ends, never a live pass/fail, so meeting a requirement in the
 * first tick can't light it green early.
 */

import {
  LEVEL_TIERS,
  evaluateLevelTier,
  hasTierLadder,
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
   * Whether this line reads as broken. While the run is live, only an
   * at-most requirement past its bar counts; an at-least one not yet
   * reached is mid-run, not a failure. Ended, any unmet requirement counts.
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
 * Builds the popover's rows for one level: bronze first, then silver and gold,
 * or a single gold row carrying the level's own bar where clearing it is the
 * whole achievement, or none at all for a level with nothing to meter (the
 * sandbox tile). `verdict` is `null` while undecided; taken as a parameter
 * rather than recomputed, since only one caller may decide a run is over.
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

  if (!hasTierLadder(level.tiers)) {
    return [row("gold", level.condition.requirements)];
  }
  return [
    row("bronze", level.condition.requirements),
    row("silver", level.tiers.silver.requirements),
    row("gold", level.tiers.gold.requirements),
  ];
}
