/**
 * Which tier this browser has already earned on each numbered level.
 *
 * The mockup's own `best` map (`design/ui-mockup.html`) never lets a record
 * regress — clearing a level bronze twice, or gold and then only bronze
 * on a later run, must never erase the gold already on the books. That is
 * this module's one piece of real logic: a write is applied only when the
 * new tier outranks whatever is already stored.
 *
 * Follows `#entities/tutorial-level/model/progress.ts`'s established
 * conventions for this kind of record exactly: a `develevate`-prefixed key,
 * an injectable `Storage`, and everything unreadable — a refused read, a
 * corrupt value, an unknown tier string — treated as "nothing recorded,"
 * never surfaced as an error, since no run depends on this and the next win
 * rewrites the key with a clean value.
 */

import { LEVEL_TIERS, type LevelTier } from "#game/level-tiers.ts";

/**
 * Where each level's best-earned tier is remembered between visits.
 *
 * Spelled the way the game spelled a level when the key was first written.
 * A key is not a name anybody reads: renaming it would say nothing to a
 * player and would lose every tier the browsers that already hold one have
 * earned, so it stays as it is.
 */
export const LEVEL_TIER_STORAGE_KEY = "develevateChallengeTiers";

/**
 * Where a tier ranks among the others, worst to best — the same order
 * {@link "#game/level-tiers.ts"!LEVEL_TIERS} already lists them in,
 * read as ranks so two tiers can be compared instead of just named.
 *
 * @param tier - The tier to rank.
 * @returns Its index into {@link LEVEL_TIERS}: higher is better.
 */
function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Reads the best tier recorded for each level.
 *
 * @param storage - Where the record is remembered.
 * @returns Level index to its best tier, for every level with a
 * recorded win. Indices this build no longer has a level for are kept in
 * the map, same as {@link "#entities/tutorial-level/model/progress.ts"!readClearedTutorialLevels}
 * keeps unknown identifiers — a caller filters against its own level
 * list, this module does not decide what still exists.
 */
export function readBestLevelTiers(storage: Storage): ReadonlyMap<number, LevelTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(LEVEL_TIER_STORAGE_KEY);
  } catch {
    // Safari in private mode throws from `localStorage.getItem`, and a
    // player whose browser refuses storage should still be able to play.
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

/**
 * Records a tier earned on a level, if it is better than what is already
 * stored.
 *
 * A store that refuses the write is not an error here and nothing is
 * announced, the same treatment
 * {@link "#entities/tutorial-level/model/progress.ts"!recordClearedTutorialLevel}
 * gives a refused write: the run the player is in the middle of does not
 * depend on this succeeding.
 *
 * @param storage - Where the record is remembered.
 * @param levelIndex - Which level was just won.
 * @param tier - The tier that run earned.
 */
export function recordLevelTier(storage: Storage, levelIndex: number, tier: LevelTier): void {
  const current = readBestLevelTiers(storage);
  const existing = current.get(levelIndex);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good -- writing again would rewrite the key on
    // every replay of a level already cleared at this tier or better,
    // for no change at all.
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
