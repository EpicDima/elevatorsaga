import { describe, expect, it } from "vitest";

import { isLevelLocked, lockLevelTiles } from "./level-lock.ts";
import { listLevels } from "#entities/level/index.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";

/**
 * Builds `count` fixture levels, ordinary in every way this module does
 * not read from.
 *
 * @param count - How many to build.
 * @returns The fixture array.
 */
function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
  }));
}

describe("isLevelLocked", () => {
  it("leaves the first level open to a browser that has cleared nothing", () => {
    expect(isLevelLocked(0, new Map())).toBe(false);
  });

  it("shuts a level whose predecessor has never been finished", () => {
    expect(isLevelLocked(1, new Map())).toBe(true);
    expect(isLevelLocked(17, new Map())).toBe(true);
  });

  it("opens a level on any tier at all recorded for the one before it", () => {
    expect(isLevelLocked(1, new Map([[0, "bronze"]]))).toBe(false);
    expect(isLevelLocked(1, new Map([[0, "gold"]]))).toBe(false);
  });

  it("reads only the record immediately before the level asked about", () => {
    // The record a browser hands over is not necessarily a run of clears from
    // the first level: it may predate the locking rule, when every
    // level was reachable from the row, or have been edited by hand. Each
    // index is answered on its own, so a lone clear opens exactly one door.
    const sparse = new Map<number, "gold">([[5, "gold"]]);

    expect(isLevelLocked(6, sparse)).toBe(false);
    expect(isLevelLocked(5, sparse)).toBe(true);
    expect(isLevelLocked(7, sparse)).toBe(true);
  });

  it("answers the same question the tiles are drawn from", () => {
    // The rule has one copy, and this is what says so: whatever the switcher
    // draws shut is what an address is refused for.
    const bestTiers = new Map<number, "silver">([[0, "silver"]]);
    const tiles = lockLevelTiles(listLevels(fixtureLevels(4)), bestTiers);

    expect(tiles.map((tile) => tile.locked)).toEqual(
      tiles.map((tile) => isLevelLocked(tile.index, bestTiers)),
    );
  });
});

describe("lockLevelTiles", () => {
  it("never locks the first level", () => {
    const [first] = lockLevelTiles(listLevels(fixtureLevels(3)), new Map());

    expect(first?.locked).toBe(false);
  });

  it("locks every later level when nothing has been cleared", () => {
    const tiles = lockLevelTiles(listLevels(fixtureLevels(3)), new Map());

    expect(tiles.map((tile) => tile.locked)).toEqual([false, true, true]);
  });

  it("opens the next level once the one before it has any tier on record", () => {
    const tiles = lockLevelTiles(listLevels(fixtureLevels(3)), new Map([[0, "bronze"]]));

    expect(tiles.map((tile) => tile.locked)).toEqual([false, false, true]);
  });

  it("does not open a level two ahead of the furthest clear", () => {
    const tiles = lockLevelTiles(listLevels(fixtureLevels(4)), new Map([[0, "gold"]]));

    expect(tiles.map((tile) => tile.locked)).toEqual([false, false, true, true]);
  });

  it("opens every level once every one before it is cleared", () => {
    const tiles = lockLevelTiles(
      listLevels(fixtureLevels(4)),
      new Map<number, "bronze">([
        [0, "bronze"],
        [1, "bronze"],
        [2, "bronze"],
      ]),
    );

    expect(tiles.every((tile) => !tile.locked)).toBe(true);
  });

  it("holds the last level to the same rule as the rest", () => {
    // It used to be the one exception: the list ended in an endless demo with
    // no win condition, which nothing could ever unlock and so was never
    // locked. The demo is gone, and the last entry is now a level like
    // any other -- shut until the one before it has been finished.
    const shut = lockLevelTiles(listLevels(fixtureLevels(3)), new Map());
    expect(shut.at(-1)?.locked).toBe(true);

    const open = lockLevelTiles(
      listLevels(fixtureLevels(3)),
      new Map<number, "bronze">([
        [0, "bronze"],
        [1, "bronze"],
      ]),
    );
    expect(open.at(-1)?.locked).toBe(false);
  });
});
