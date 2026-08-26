/**
 * What a run still owes the next star, in one sentence — the `.verdict-more`
 * line on the verdict card. Names every unmet requirement with both the bar
 * and where the run finished, and says nothing once there is nothing left to earn.
 */

import type { LevelWorldStats } from "#game/levels.ts";
import type { LevelTier, LevelTierRequirements } from "#game/level-tiers.ts";
import { formatList, t } from "#i18n/index.ts";

import { requirementMet } from "../model/tier-progress.ts";
import { tierRequirementNow, tierRequirementText } from "./requirement-text.ts";

/**
 * The sentence naming what a run needs for its next star, as trusted markup,
 * or `""` when there is nothing to hint at: already gold, or a predicate that
 * failed without missing any of its advertised requirements.
 */
export function nextTierHint(
  tiers: LevelTierRequirements,
  earned: LevelTier,
  world: LevelWorldStats,
): string {
  if (earned === "gold") {
    return "";
  }
  // LEVEL_TIERS also holds bronze, which has no entry in LevelTierRequirements.
  const next = earned === "bronze" ? "silver" : "gold";
  const missed = tiers[next].requirements.filter(
    (requirement) => !requirementMet(requirement, world),
  );
  if (missed.length === 0) {
    return "";
  }
  const needs = formatList(
    missed.map((requirement) =>
      t("game.feedback.more.need.html", {
        req: tierRequirementText(requirement),
        now: tierRequirementNow(requirement, world),
      }),
    ),
  );
  return next === "gold"
    ? t("game.feedback.more.gold.html", { needs })
    : t("game.feedback.more.silver.html", { needs });
}
