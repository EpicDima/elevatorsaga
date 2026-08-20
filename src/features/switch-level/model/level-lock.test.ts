import { describe, expect, it } from "vitest";

import { isChallengeLocked, lockChallengeTiles } from "./level-lock.ts";
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

describe("isChallengeLocked", () => {
  it("leaves the first challenge open to a browser that has cleared nothing", () => {
    expect(isChallengeLocked(0, new Map())).toBe(false);
  });

  it("shuts a challenge whose predecessor has never been finished", () => {
    expect(isChallengeLocked(1, new Map())).toBe(true);
    expect(isChallengeLocked(17, new Map())).toBe(true);
  });

  it("opens a challenge on any tier at all recorded for the one before it", () => {
    expect(isChallengeLocked(1, new Map([[0, "bronze"]]))).toBe(false);
    expect(isChallengeLocked(1, new Map([[0, "gold"]]))).toBe(false);
  });

  it("reads only the record immediately before the challenge asked about", () => {
    // The record a browser hands over is not necessarily a run of clears from
    // the first challenge: it may predate the locking rule, when every
    // challenge was reachable from the row, or have been edited by hand. Each
    // index is answered on its own, so a lone clear opens exactly one door.
    const sparse = new Map<number, "gold">([[5, "gold"]]);

    expect(isChallengeLocked(6, sparse)).toBe(false);
    expect(isChallengeLocked(5, sparse)).toBe(true);
    expect(isChallengeLocked(7, sparse)).toBe(true);
  });

  it("answers the same question the tiles are drawn from", () => {
    // The rule has one copy, and this is what says so: whatever the switcher
    // draws shut is what an address is refused for.
    const bestTiers = new Map<number, "silver">([[0, "silver"]]);
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(4)), bestTiers);

    expect(tiles.map((tile) => tile.locked)).toEqual(
      tiles.map((tile) => isChallengeLocked(tile.index, bestTiers)),
    );
  });
});

describe("lockChallengeTiles", () => {
  it("never locks the first challenge", () => {
    const [first] = lockChallengeTiles(listChallenges(fixtureChallenges(3)), new Map());

    expect(first?.locked).toBe(false);
  });

  it("locks every later challenge when nothing has been cleared", () => {
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(3)), new Map());

    expect(tiles.map((tile) => tile.locked)).toEqual([false, true, true]);
  });

  it("opens the next challenge once the one before it has any tier on record", () => {
    const tiles = lockChallengeTiles(
      listChallenges(fixtureChallenges(3)),
      new Map([[0, "bronze"]]),
    );

    expect(tiles.map((tile) => tile.locked)).toEqual([false, false, true]);
  });

  it("does not open a challenge two ahead of the furthest clear", () => {
    const tiles = lockChallengeTiles(listChallenges(fixtureChallenges(4)), new Map([[0, "gold"]]));

    expect(tiles.map((tile) => tile.locked)).toEqual([false, false, true, true]);
  });

  it("opens every challenge once every one before it is cleared", () => {
    const tiles = lockChallengeTiles(
      listChallenges(fixtureChallenges(4)),
      new Map<number, "bronze">([
        [0, "bronze"],
        [1, "bronze"],
        [2, "bronze"],
      ]),
    );

    expect(tiles.every((tile) => !tile.locked)).toBe(true);
  });

  it("holds the last challenge to the same rule as the rest", () => {
    // It used to be the one exception: the list ended in an endless demo with
    // no win condition, which nothing could ever unlock and so was never
    // locked. The demo is gone, and the last entry is now a challenge like
    // any other -- shut until the one before it has been finished.
    const shut = lockChallengeTiles(listChallenges(fixtureChallenges(3)), new Map());
    expect(shut.at(-1)?.locked).toBe(true);

    const open = lockChallengeTiles(
      listChallenges(fixtureChallenges(3)),
      new Map<number, "bronze">([
        [0, "bronze"],
        [1, "bronze"],
      ]),
    );
    expect(open.at(-1)?.locked).toBe(false);
  });
});
