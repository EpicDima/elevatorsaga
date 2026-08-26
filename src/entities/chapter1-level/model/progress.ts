/** Tracks the best medal earned per chapter one level, keyed by the level's index in its own storage key. */

import { LEVEL_TIERS, type LevelTier } from "#game/level-tiers.ts";

/** Storage key for chapter one medals; the legacy spelling is kept, since renaming it discards players' saved progress. */
export const CHAPTER1_TIER_STORAGE_KEY = "develevateChallengeTiers";

/** Returns a tier's rank; higher is better. */
function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Reads the best medal recorded for each chapter one level.
 * Unknown indices are returned as-is; callers filter against their own level list.
 */
export function readBestChapter1Tiers(storage: Storage): ReadonlyMap<number, LevelTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(CHAPTER1_TIER_STORAGE_KEY);
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

/** Records a medal earned on a chapter one level, if it is better than what is already stored. */
export function recordChapter1Tier(storage: Storage, chapter1Index: number, tier: LevelTier): void {
  const current = readBestChapter1Tiers(storage);
  const existing = current.get(chapter1Index);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good; skip the redundant write.
    return;
  }
  const record: Record<number, LevelTier> = {};
  for (const [index, storedTier] of current) {
    record[index] = storedTier;
  }
  record[chapter1Index] = tier;
  try {
    storage.setItem(CHAPTER1_TIER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
