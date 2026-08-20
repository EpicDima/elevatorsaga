/**
 * Which medal this browser has earned on each level of the Skyscraper block.
 *
 * Nothing kept here grants permission to play anything. Level locking was taken
 * out of this game entirely in commit d463c4a, "Open every level to everyone,
 * from the first visit" — `src/features/switch-level/` held that rule and went
 * with it — so the whole of what a record here feeds is the badge the level
 * switcher draws on a tile, and through it the reason a player who comes back
 * tomorrow can see where they have been.
 *
 * Keyed by {@link "#game/skyscraper.ts"!SkyscraperLevel.id} rather than by
 * position, for the reason that type carries an id at all: a level's position
 * is the one thing about it that is expected to change, and a level inserted in
 * the middle of the block must not hand every medal already on record to its
 * neighbour.
 *
 * Its own storage key, and deliberately not the `develevateChallengeTiers` that
 * {@link "#entities/level-tier/model/best-tier.ts"!LEVEL_TIER_STORAGE_KEY}
 * names for the numbered levels. A JSON object takes `"sky-3"` as a key
 * perfectly well, but
 * {@link "#entities/level-tier/model/best-tier.ts"!readBestLevelTiers} reads
 * every key it finds back through `Number(...)` and drops whatever is not a
 * non-negative integer, and
 * {@link "#entities/level-tier/model/best-tier.ts"!recordLevelTier} writes back
 * only what that read returned. Sharing the key would mean each block quietly
 * erasing the other's medals on the next win. Separate blocks, separate keys,
 * and neither read has to know the other exists.
 *
 * A medal per level rather than the cleared/not-cleared set the learning track
 * keeps in
 * {@link "#entities/tutorial-level/model/progress.ts"!readClearedTutorialLevels},
 * because this block mixes short demonstrating levels with scored ones. The
 * scored ones have a silver and a gold worth telling apart, and the level
 * switcher already draws a tile's `data-tier` attribute and its star badge from
 * a `tier` field for free. One code path covers both kinds:
 * {@link "#game/level-tiers.ts"!evaluateLevelTier} called as
 * `evaluateLevelTier(true, world, undefined)` answers `"bronze"`, so a level
 * that declares no `tiers` records bronze on a win — which is exactly what
 * "cleared" means for it. A second `cleared` field beside the medal would only
 * be another spelling of `tier !== undefined`.
 *
 * Everything else here is
 * {@link "#entities/level-tier/model/best-tier.ts"}'s module with the map key
 * changed: an injectable `Storage`, a write applied only when the new medal
 * outranks the stored one, and everything unreadable — a refused read, a
 * corrupt value, an unknown tier string — treated as "nothing recorded", never
 * surfaced as an error, since no run depends on this and the next win rewrites
 * the key with a clean value.
 */

import { LEVEL_TIERS, type LevelTier } from "#game/level-tiers.ts";

/**
 * Where each Skyscraper level's best-earned medal is remembered between visits.
 *
 * `develevate`-prefixed like every key this fork invented: `elevatorCrush*` is
 * an on-disk contract inherited from the game this is a fork of, and a player
 * with both games in one browser profile must not have one read the other's
 * data. A key is not a name anybody reads, so renaming it would say nothing to
 * a player and would lose every medal the browsers that hold one have earned.
 */
export const SKYSCRAPER_TIER_STORAGE_KEY = "develevateSkyscraperTiers";

/**
 * Where a tier ranks among the others, worst to best — the same order
 * {@link "#game/level-tiers.ts"!LEVEL_TIERS} already lists them in, read as
 * ranks so two tiers can be compared instead of just named.
 *
 * @param tier - The tier to rank.
 * @returns Its index into {@link LEVEL_TIERS}: higher is better.
 */
function tierRank(tier: LevelTier): number {
  return LEVEL_TIERS.indexOf(tier);
}

/**
 * Reads the best medal recorded for each Skyscraper level.
 *
 * @param storage - Where the record is remembered.
 * @returns Level id to its best tier, for every level of the block with a
 * recorded win. Ids this build has no level for are kept in the map, the same
 * treatment {@link "#entities/level-tier/model/best-tier.ts"!readBestLevelTiers}
 * gives an index it no longer has a level for: a caller filters against its own
 * level list, and this module does not decide what still exists.
 */
export function readBestSkyscraperTiers(storage: Storage): ReadonlyMap<string, LevelTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(SKYSCRAPER_TIER_STORAGE_KEY);
  } catch {
    // Safari in private mode throws from `localStorage.getItem`, and a player
    // whose browser refuses storage should still be able to play the block.
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
      // The whole of the key filter, where `best-tier.ts` needs a `Number` and
      // an integer test: `Object.entries` hands back string keys and nothing
      // else, whatever the JSON held, so the one thing left that no level's id
      // could ever be is the empty string. There is nothing here for a
      // `typeof` check to catch, unlike the value below.
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
 * Records a medal earned on a Skyscraper level, if it is better than what is
 * already stored.
 *
 * Whatever was already on record is written back alongside it, including ids
 * this build has never heard of, for the reason
 * {@link "#entities/tutorial-level/model/progress.ts"!recordClearedTutorialLevel}
 * keeps its unknown ids: a player who wins a level in a newer deployment and
 * then loads a cached older one must not have that erased by winning `sky-1`,
 * because the older build cannot show the entry and quietly deleting what it
 * cannot show is the one outcome that cannot be undone.
 *
 * A store that refuses the write is not an error here and nothing is announced,
 * the same treatment a refused write gets everywhere else this fork remembers
 * something: the run the player is in the middle of does not depend on this
 * succeeding, and the only consequence is an unbadged tile on the next visit.
 *
 * @param storage - Where the record is remembered.
 * @param levelId - The {@link "#game/skyscraper.ts"!SkyscraperLevel.id} of the
 * level that was just won.
 * @param tier - The tier that run earned.
 */
export function recordSkyscraperTier(storage: Storage, levelId: string, tier: LevelTier): void {
  const current = readBestSkyscraperTiers(storage);
  const existing = current.get(levelId);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good -- writing again would rewrite the key on
    // every replay of a level already cleared at this tier or better, for no
    // change at all.
    return;
  }
  const record: Record<string, LevelTier> = {};
  for (const [id, storedTier] of current) {
    record[id] = storedTier;
  }
  record[levelId] = tier;
  try {
    storage.setItem(SKYSCRAPER_TIER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
