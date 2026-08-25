/**
 * What a tier is called, for a sentence that has to name one.
 *
 * Here rather than in either widget that reads it, for the reason
 * {@link "./requirement-text.ts"!tierRequirementText} is: naming a tier is
 * tier vocabulary, and two widgets reading one table is what keeps the goal
 * bar's trigger and the level switcher's tiles saying the same word for the
 * same medal.
 */

import type { LevelTier } from "#game/level-tiers.ts";
import type { MessageKey } from "#i18n/index.ts";

/** A tier's own display name. */
export const TIER_NAME_KEY = {
  bronze: "game.goalBar.tier.bronze",
  silver: "game.goalBar.tier.silver",
  gold: "game.goalBar.tier.gold",
} as const satisfies Readonly<Record<LevelTier, MessageKey>>;
