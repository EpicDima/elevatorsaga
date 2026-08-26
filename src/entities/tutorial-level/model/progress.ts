/** Tracks which learning-track levels this browser has cleared; the track itself locks nothing. */

import type { LevelTier } from "#game/level-tiers.ts";

/**
 * The medal a cleared track level wears. Its levels carry `WINNING_IS_GOLD`, so
 * every win on one is gold and this store only has to hold the flag.
 */
export const TUTORIAL_CLEARED_TIER: LevelTier = "gold";

/** Storage key for cleared tutorial levels; changing it discards players' saved progress. */
export const TUTORIAL_PROGRESS_STORAGE_KEY = "develevateTutorialProgress";

/**
 * Reads the identifiers of the levels this browser has cleared.
 * Ids, not a furthest-level number: the track locks nothing, so a player can
 * clear level 6 directly without 1-5 ever being played.
 */
export function readClearedTutorialLevels(storage: Storage): ReadonlySet<string> {
  let stored: string | null;
  try {
    stored = storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY);
  } catch {
    // A browser that refuses storage should still let the player play.
    return new Set();
  }
  if (stored === null || stored === "") {
    return new Set();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed)) {
    return new Set();
  }
  return new Set(parsed.filter((id: unknown): id is string => typeof id === "string" && id !== ""));
}

/**
 * Remembers that a level has been cleared. Ids unknown to this build are
 * preserved rather than dropped, so a cached older build never erases a
 * newer build's progress.
 */
export function recordClearedTutorialLevel(storage: Storage, levelId: string): void {
  const cleared = readClearedTutorialLevels(storage);
  if (cleared.has(levelId)) {
    // Already there; skip the redundant write.
    return;
  }
  try {
    storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify([...cleared, levelId]));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
