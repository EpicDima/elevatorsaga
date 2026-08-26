/** Tracks the best tier earned per numbered level; a write only ever raises the recorded tier, never lowers it. */

import { LEVEL_TIERS, type LevelTier } from "#game/level-tiers.ts";

/** Storage key for level tiers; changing it discards players' saved progress. */
export const LEVEL_TIER_STORAGE_KEY = "develevateChallengeTiers";

/** Returns a tier's rank; higher is better. */
function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Reads the best tier recorded for each level.
 * Unknown indices are returned as-is; callers filter against their own level list.
 */
export function readBestLevelTiers(storage: Storage): ReadonlyMap<number, LevelTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(LEVEL_TIER_STORAGE_KEY);
  } catch {
    // A browser that refuses storage should still let the player play.
    return new Map();
  }
  if (stored === null || stored === "") {
    return new Map();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return new Map();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return new Map();
  }
  const result = new Map<number, LevelTier>();
  for (const [key, value] of Object.entries(parsed)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }
    if (typeof value !== "string" || !LEVEL_TIERS.includes(value as LevelTier)) {
      continue;
    }
    result.set(index, value as LevelTier);
  }
  return result;
}

/** Records a tier earned on a level, if it is better than what is already stored. */
export function recordLevelTier(storage: Storage, levelIndex: number, tier: LevelTier): void {
  const current = readBestLevelTiers(storage);
  const existing = current.get(levelIndex);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good; skip the redundant write.
    return;
  }
  const record: Record<number, LevelTier> = {};
  for (const [index, storedTier] of current) {
    record[index] = storedTier;
  }
  record[levelIndex] = tier;
  try {
    storage.setItem(LEVEL_TIER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
