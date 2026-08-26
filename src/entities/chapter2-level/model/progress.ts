/** Tracks the best medal earned per chapter two level, keyed by level id in its own storage key. */

import { LEVEL_TIERS, type LevelTier } from "#game/level-tiers.ts";

/** Storage key for chapter two medals; changing it discards players' saved progress. */
export const CHAPTER2_TIER_STORAGE_KEY = "develevateChapter2Tiers";

/** Returns a tier's rank; higher is better. */
function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Reads the best medal recorded for each chapter two level.
 * Unknown ids are returned as-is; callers filter against their own level list.
 */
export function readBestChapter2Tiers(storage: Storage): ReadonlyMap<string, LevelTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(CHAPTER2_TIER_STORAGE_KEY);
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
  const result = new Map<string, LevelTier>();
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "") {
      // Object.entries always yields string keys; the empty string is the one
      // value no level id could ever be.
      continue;
    }
    if (typeof value !== "string" || !LEVEL_TIERS.includes(value as LevelTier)) {
      continue;
    }
    result.set(key, value as LevelTier);
  }
  return result;
}

/**
 * Records a medal earned on a chapter two level, if it is better than what is
 * already stored. Ids unknown to this build are preserved rather than dropped.
 */
export function recordChapter2Tier(storage: Storage, levelId: string, tier: LevelTier): void {
  const current = readBestChapter2Tiers(storage);
  const existing = current.get(levelId);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good; skip the redundant write.
    return;
  }
  const record: Record<string, LevelTier> = {};
  for (const [id, storedTier] of current) {
    record[id] = storedTier;
  }
  record[levelId] = tier;
  try {
    storage.setItem(CHAPTER2_TIER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
