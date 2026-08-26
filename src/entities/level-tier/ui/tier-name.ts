import type { LevelTier } from "#game/level-tiers.ts";
import type { MessageKey } from "#i18n/index.ts";

/** Catalog keys for a tier's display name, shared so every caller names a medal the same way. */
export const TIER_NAME_KEY = {
  bronze: "game.goalBar.tier.bronze",
  silver: "game.goalBar.tier.silver",
  gold: "game.goalBar.tier.gold",
} as const satisfies Readonly<Record<LevelTier, MessageKey>>;
