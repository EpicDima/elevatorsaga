import { describe, expect, it } from "vitest";

import { buildLevelMenu, type LevelLinkTarget, type LevelMenuInput } from "./level-menu.ts";
import { TUTORIAL_CLEARED_TIER } from "#entities/tutorial-level/model/progress.ts";
import { WINNING_IS_GOLD } from "#game/level-tiers.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";
import type { Chapter2Level } from "#game/chapter2.ts";
import { tutorialLevels } from "#game/tutorial.ts";

function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
    tiers: WINNING_IS_GOLD,
  }));
}

/** Stand-in chapter two levels, built directly rather than imported like `tutorialLevels`. */
function fixtureChapter2Levels(count: number): readonly Chapter2Level[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `chapter2-${String(index + 1)}`,
    options: {},
    condition: requireUserCountWithinTime(5, 60),
    tiers: WINNING_IS_GOLD,
    seed: index + 1,
    startingCode: "",
    title: `Chapter 2 level ${String(index + 1)}`,
    briefing: "",
  }));
}

/** Renders a {@link LevelLinkTarget} into a URL a test can assert on directly. */
function stubHref(target: LevelLinkTarget): string {
  switch (target.kind) {
    case "chapter1": {
      return `#level=${String(target.number)}`;
    }
    case "tutorial": {
      return `#level=${target.levelId}`;
    }
    case "chapter2": {
      return `#level=${target.levelId}`;
    }
    case "sandbox": {
      return "#level=sandbox";
    }
  }
}

function baseInput(overrides: Partial<LevelMenuInput> = {}): LevelMenuInput {
  return {
    chapter1Levels: fixtureLevels(4),
    tutorialLevels,
    chapter2Levels: fixtureChapter2Levels(3),
    bestChapter1Tiers: new Map(),
    clearedTutorialLevels: new Set(),
    bestChapter2Tiers: new Map(),
    selection: { kind: "sandbox" },
    buildHref: stubHref,
    ...overrides,
  };
}

describe("buildLevelMenu", () => {
  it("returns the tutorial, levels, chapter two and other blocks in that order", () => {
    const blocks = buildLevelMenu(baseInput());

    // Named `other`, not `sandbox`: the block and its one tile carry different
    // on-screen captions, so they need different ids here too.
    expect(blocks.map((block) => block.id)).toEqual(["tutorial", "chapter1", "chapter2", "other"]);
  });

  it("numbers tutorial tiles from one and links each to its level id", () => {
    const [tutorialBlock] = buildLevelMenu(baseInput());
    const [firstLevel] = tutorialLevels;

    expect(tutorialBlock?.tiles).toHaveLength(tutorialLevels.length);
    expect(tutorialBlock?.tiles[0]).toMatchObject({
      kind: "tutorial",
      index: 0,
      number: 1,
      href: `#level=${firstLevel?.id ?? ""}`,
    });
  });

  it("gives a tutorial tile gold once its level id is in the cleared set, and nothing before", () => {
    const [firstLevel] = tutorialLevels;
    const [tutorialBlock] = buildLevelMenu(
      baseInput({
        clearedTutorialLevels: new Set(firstLevel === undefined ? [] : [firstLevel.id]),
      }),
    );

    expect(tutorialBlock?.tiles[0]).toMatchObject({ tier: TUTORIAL_CLEARED_TIER });
    expect(tutorialBlock?.tiles[1]).toMatchObject({ tier: undefined });
  });

  it("hands out gold and no other medal, whichever track levels are cleared", () => {
    // The track grades nothing, so a tile can only ever be blank or full.
    const [tutorialBlock] = buildLevelMenu(
      baseInput({ clearedTutorialLevels: new Set(tutorialLevels.map((level) => level.id)) }),
    );

    expect(tutorialBlock?.tiles.map((tile) => tile.kind === "tutorial" && tile.tier)).toEqual(
      tutorialLevels.map(() => "gold"),
    );
  });

  it("marks the tutorial tile at the selected index current, and no other", () => {
    const [tutorialBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "tutorial", index: 2 } }),
    );
    const tiles = tutorialBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual(tiles.map((_tile, index) => index === 2));
  });

  it("numbers level tiles from one and links by number", () => {
    const [, levelBlock] = buildLevelMenu(baseInput({ chapter1Levels: fixtureLevels(4) }));
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => (tile.kind === "chapter1" ? tile.number : null))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(tiles[0]?.href).toBe("#level=1");
  });

  it("opens every level tile, whatever is on record", () => {
    const [, levelBlock] = buildLevelMenu(
      baseInput({ chapter1Levels: fixtureLevels(5), bestChapter1Tiers: new Map([[0, "bronze"]]) }),
    );

    expect(levelBlock?.tiles).toHaveLength(5);
    expect(levelBlock?.tiles.every((tile) => tile.kind === "chapter1")).toBe(true);
  });

  it("carries a level tile's best tier through, undefined when never cleared", () => {
    const [, levelBlock] = buildLevelMenu(
      baseInput({ chapter1Levels: fixtureLevels(3), bestChapter1Tiers: new Map([[0, "gold"]]) }),
    );
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles[0]).toMatchObject({ tier: "gold" });
    expect(tiles[1]).toMatchObject({ tier: undefined });
  });

  it("marks the level tile at the selected index current, and no other", () => {
    const [, levelBlock] = buildLevelMenu(
      baseInput({
        chapter1Levels: fixtureLevels(4),
        bestChapter1Tiers: new Map([
          [0, "bronze"],
          [1, "bronze"],
        ]),
        selection: { kind: "chapter1", index: 1 },
      }),
    );
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual([false, true, false, false]);
  });

  it("numbers chapter two tiles on from the last numbered level and links each to its level id", () => {
    // Linked by id, not position, so inserting a level later doesn't hand
    // someone's bookmark to its neighbor.
    const [, , chapter2Block] = buildLevelMenu(
      baseInput({ chapter1Levels: fixtureLevels(4), chapter2Levels: fixtureChapter2Levels(3) }),
    );
    const tiles = chapter2Block?.tiles ?? [];

    expect(tiles).toHaveLength(3);
    // Four numbered levels, so chapter two opens at five rather than at one.
    expect(tiles.map((tile) => (tile.kind === "chapter2" ? tile.number : null))).toEqual([5, 6, 7]);
    expect(tiles.map((tile) => tile.href)).toEqual([
      "#level=chapter2-1",
      "#level=chapter2-2",
      "#level=chapter2-3",
    ]);
  });

  it("carries a chapter two tile's best tier through, undefined when never cleared", () => {
    // Keyed by the level's id, not its position; the two tier records don't
    // share keys.
    const [, , chapter2Block] = buildLevelMenu(
      baseInput({
        chapter2Levels: fixtureChapter2Levels(3),
        bestChapter2Tiers: new Map([["chapter2-2", "gold"]]),
      }),
    );
    const tiles = chapter2Block?.tiles ?? [];

    expect(tiles[0]).toMatchObject({ tier: undefined });
    expect(tiles[1]).toMatchObject({ tier: "gold" });
    expect(tiles[2]).toMatchObject({ tier: undefined });
  });

  it("reads the chapter two tiers from their own record and not the numbered one", () => {
    // The maps are keyed differently on purpose, by position vs. by id, so
    // neither may reach into the other's block.
    const [, levelBlock, chapter2Block] = buildLevelMenu(
      baseInput({
        chapter1Levels: fixtureLevels(2),
        chapter2Levels: fixtureChapter2Levels(2),
        bestChapter1Tiers: new Map([[0, "bronze"]]),
        bestChapter2Tiers: new Map([["chapter2-2", "silver"]]),
      }),
    );

    expect(levelBlock?.tiles.map((tile) => (tile.kind === "chapter1" ? tile.tier : null))).toEqual([
      "bronze",
      undefined,
    ]);
    expect(
      chapter2Block?.tiles.map((tile) => (tile.kind === "chapter2" ? tile.tier : null)),
    ).toEqual([undefined, "silver"]);
  });

  it("marks the chapter two tile at the selected index current, and no other", () => {
    const [, , chapter2Block] = buildLevelMenu(
      baseInput({
        chapter2Levels: fixtureChapter2Levels(3),
        selection: { kind: "chapter2", index: 1 },
      }),
    );
    const tiles = chapter2Block?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual([false, true, false]);
  });

  it("keeps a chapter two selection out of the block that shares its numbering", () => {
    // Both blocks number tiles from one, so `kind`, not the index alone, says which block a selection belongs to.
    const [, levelBlock, chapter2Block] = buildLevelMenu(
      baseInput({
        chapter1Levels: fixtureLevels(3),
        chapter2Levels: fixtureChapter2Levels(3),
        selection: { kind: "chapter2", index: 0 },
      }),
    );

    expect(levelBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(chapter2Block?.tiles[0]?.current).toBe(true);
  });

  it("offers exactly one always-open sandbox tile, linked through buildHref", () => {
    const [, , , sandboxBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "chapter1", index: 0 } }),
    );

    expect(sandboxBlock?.tiles).toEqual([
      { kind: "sandbox", current: false, href: "#level=sandbox" },
    ]);
  });

  it("marks the sandbox tile current only when the selection names it", () => {
    const [, , , sandboxBlock] = buildLevelMenu(baseInput({ selection: { kind: "sandbox" } }));

    expect(sandboxBlock?.tiles[0]).toMatchObject({ current: true });
  });

  it("marks no tile current when the selection names a level outside the list", () => {
    const [tutorialBlock, levelBlock, chapter2Block, sandboxBlock] = buildLevelMenu(
      baseInput({ chapter1Levels: fixtureLevels(3), selection: { kind: "chapter1", index: 9 } }),
    );

    expect(levelBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(tutorialBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(chapter2Block?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(sandboxBlock?.tiles[0]?.current).toBe(false);
  });
});
