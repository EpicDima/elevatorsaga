import { describe, expect, it } from "vitest";

import { lockChallengeTiles } from "./level-lock.ts";
import { listChallenges } from "#entities/challenge/index.ts";
import { requireUserCountWithinTime, type Challenge } from "#game/challenges.ts";

/**
 * Builds `count` fixture challenges, ordinary in every way this module does
 * not read from.
 *
 * @param count - How many to build.
 * @returns The fixture array.
 */
function fixtureChallenges(count: number): readonly Challenge[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
  }));
}

describe("lockChallengeTiles", () => {
  it("never locks the first challenge", () => {
    const [first] = lockChallengeTiles(listChallenges(fixtureChallenges(3)), new Map());

    expect(first?.locked).toBe(false);
  });

  it("locks every later, non-demo challenge when nothing has been cleared", () => {
    // A fixture's last entry is always flagged demo (listChallenges' own
    // rule) and so is always unlocked -- padding by one keeps the entries
    // under test here away from that position.
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(4)), new Map());

    expect(tiles.slice(0, 3).map((tile) => tile.locked)).toEqual([false, true, true]);
  });

  it("opens the next challenge once the one before it has any tier on record", () => {
    const tiles = lockChallengeTiles(
      listChallenges(fixtureChallenges(4)),
      new Map([[0, "bronze"]]),
    );

    expect(tiles.slice(0, 3).map((tile) => tile.locked)).toEqual([false, false, true]);
  });

  it("does not open a challenge two ahead of the furthest clear", () => {
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(5)), new Map([[0, "gold"]]));

    expect(tiles.slice(0, 4).map((tile) => tile.locked)).toEqual([false, false, true, true]);
  });

  it("opens every non-demo challenge once every one before it is cleared", () => {
    const tiles = lockChallengeTiles(
      listChallenges(fixtureChallenges(4)),
      new Map<number, "bronze">([
        [0, "bronze"],
        [1, "bronze"],
        [2, "bronze"],
      ]),
    );

    expect(tiles.slice(0, 3).every((tile) => !tile.locked)).toBe(true);
  });

  it("never locks the demo, whatever has or has not been cleared before it", () => {
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(3)), new Map());

    expect(tiles.at(-1)?.demo).toBe(true);
    expect(tiles.at(-1)?.locked).toBe(false);
  });
});
