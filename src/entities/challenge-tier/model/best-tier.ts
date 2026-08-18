/**
 * Which tier this browser has already earned on each numbered challenge.
 *
 * The mockup's own `best` map (`design/ui-mockup.html`) never lets a record
 * regress — clearing a challenge bronze twice, or gold and then only bronze
 * on a later run, must never erase the gold already on the books. That is
 * this module's one piece of real logic: a write is applied only when the
 * new tier outranks whatever is already stored.
 *
 * Follows `#entities/tutorial-task/model/progress.ts`'s established
 * conventions for this kind of record exactly: a `develevate`-prefixed key,
 * an injectable `Storage`, and everything unreadable — a refused read, a
 * corrupt value, an unknown tier string — treated as "nothing recorded,"
 * never surfaced as an error, since no run depends on this and the next win
 * rewrites the key with a clean value.
 */

import { CHALLENGE_TIERS, type ChallengeTier } from "#game/challenge-tiers.ts";

/** Where each challenge's best-earned tier is remembered between visits. */
export const CHALLENGE_TIER_STORAGE_KEY = "develevateChallengeTiers";

/**
 * Where a tier ranks among the others, worst to best — the same order
 * {@link "#game/challenge-tiers.ts"!CHALLENGE_TIERS} already lists them in,
 * read as ranks so two tiers can be compared instead of just named.
 *
 * @param tier - The tier to rank.
 * @returns Its index into {@link CHALLENGE_TIERS}: higher is better.
 */
function tierRank(tier: ChallengeTier): number {
  return CHALLENGE_TIERS.indexOf(tier);
}

/**
 * Reads the best tier recorded for each challenge.
 *
 * @param storage - Where the record is remembered.
 * @returns Challenge index to its best tier, for every challenge with a
 * recorded win. Indices this build no longer has a challenge for are kept in
 * the map, same as {@link "#entities/tutorial-task/model/progress.ts"!readClearedTutorialTasks}
 * keeps unknown identifiers — a caller filters against its own challenge
 * list, this module does not decide what still exists.
 */
export function readBestChallengeTiers(storage: Storage): ReadonlyMap<number, ChallengeTier> {
  let stored: string | null;
  try {
    stored = storage.getItem(CHALLENGE_TIER_STORAGE_KEY);
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
  const result = new Map<number, ChallengeTier>();
  for (const [key, value] of Object.entries(parsed)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }
    if (typeof value !== "string" || !CHALLENGE_TIERS.includes(value as ChallengeTier)) {
      continue;
    }
    result.set(index, value as ChallengeTier);
  }
  return result;
}

/**
 * Records a tier earned on a challenge, if it is better than what is already
 * stored.
 *
 * A store that refuses the write is not an error here and nothing is
 * announced, the same treatment
 * {@link "#entities/tutorial-task/model/progress.ts"!recordClearedTutorialTask}
 * gives a refused write: the run the player is in the middle of does not
 * depend on this succeeding.
 *
 * @param storage - Where the record is remembered.
 * @param challengeIndex - Which challenge was just won.
 * @param tier - The tier that run earned.
 */
export function recordChallengeTier(
  storage: Storage,
  challengeIndex: number,
  tier: ChallengeTier,
): void {
  const current = readBestChallengeTiers(storage);
  const existing = current.get(challengeIndex);
  if (existing !== undefined && tierRank(existing) >= tierRank(tier)) {
    // Already at least this good -- writing again would rewrite the key on
    // every replay of a challenge already cleared at this tier or better,
    // for no change at all.
    return;
  }
  const record: Record<number, ChallengeTier> = {};
  for (const [index, storedTier] of current) {
    record[index] = storedTier;
  }
  record[challengeIndex] = tier;
  try {
    storage.setItem(CHALLENGE_TIER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}
