import { describe, expect, it } from "vitest";

import { buildLevelMenu, type LevelLinkTarget, type LevelMenuInput } from "./level-menu.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";
import type { SkyscraperLevel } from "#game/skyscraper.ts";
import { tutorialLevels } from "#game/tutorial.ts";

function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
  }));
}

/**
 * Stand-in Skyscraper levels, built like {@link fixtureLevels} rather than
 * imported like `tutorialLevels`.
 *
 * The block is the one still being written — it holds a single level today —
 * so a menu assembled from the real table could not say anything about a
 * second tile: which one a selection marks current, or which one a tier is
 * keyed to. Only `id` is read here, and it is spelled the way the shipped
 * entries are, since it is what `buildHref` and `bestSkyscraperTiers` are
 * keyed by.
 *
 * @param count - How many levels the block should hold.
 * @returns That many levels, `sky-1` upwards.
 */
function fixtureSkyscraperLevels(count: number): readonly SkyscraperLevel[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `sky-${String(index + 1)}`,
    options: {},
    condition: requireUserCountWithinTime(5, 60),
    seed: index + 1,
    startingCode: "",
    title: `Sky ${String(index + 1)}`,
    briefing: "",
  }));
}

/** Renders a {@link LevelLinkTarget} into a URL a test can assert on directly. */
function stubHref(target: LevelLinkTarget): string {
  switch (target.kind) {
    case "level": {
      return `#level=${String(target.number)}`;
    }
    case "tutorial": {
      return `#level=${target.levelId}`;
    }
    case "skyscraper": {
      return `#level=${target.levelId}`;
    }
    case "sandbox": {
      return "#level=sandbox";
    }
  }
}

function baseInput(overrides: Partial<LevelMenuInput> = {}): LevelMenuInput {
  return {
    levels: fixtureLevels(4),
    tutorialLevels,
    skyscraperLevels: fixtureSkyscraperLevels(3),
    bestTiers: new Map(),
    clearedTutorialLevels: new Set(),
    bestSkyscraperTiers: new Map(),
    selection: { kind: "sandbox" },
    buildHref: stubHref,
    ...overrides,
  };
}

describe("buildLevelMenu", () => {
  it("returns the tutorial, levels, skyscraper and other blocks in that order", () => {
    const blocks = buildLevelMenu(baseInput());

    // The last is `other` and not `sandbox` even though the sandbox is the
    // only tile in it -- the block and its one tile are captioned with two
    // different words on screen, so they have two different names here.
    //
    // `skyscraper` comes after `levels` and not before, which is the whole of
    // what the order promises: the numbered nineteen are the original game and
    // the tiles a returning player reaches for, so a block wedged above them
    // would move every one of them.
    expect(blocks.map((block) => block.id)).toEqual(["tutorial", "levels", "skyscraper", "other"]);
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

  it("marks a tutorial tile cleared once its level id is in the cleared set", () => {
    const [firstLevel] = tutorialLevels;
    const [tutorialBlock] = buildLevelMenu(
      baseInput({
        clearedTutorialLevels: new Set(firstLevel === undefined ? [] : [firstLevel.id]),
      }),
    );

    expect(tutorialBlock?.tiles[0]).toMatchObject({ cleared: true });
    expect(tutorialBlock?.tiles[1]).toMatchObject({ cleared: false });
  });

  it("marks the tutorial tile at the selected index current, and no other", () => {
    const [tutorialBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "tutorial", index: 2 } }),
    );
    const tiles = tutorialBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual(tiles.map((_tile, index) => index === 2));
  });

  it("numbers level tiles from one and links by number", () => {
    const [, levelBlock] = buildLevelMenu(baseInput({ levels: fixtureLevels(4) }));
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => (tile.kind === "level" ? tile.number : null))).toEqual([1, 2, 3, 4]);
    expect(tiles[0]?.href).toBe("#level=1");
  });

  it("opens every level tile, whatever is on record", () => {
    // Levels used to shut until the one before them had any tier on record.
    // Nothing does now, in this block or any other, so a browser that has
    // cleared nothing gets the same five open tiles as one that has cleared
    // them all -- the record is read for the badge alone.
    const [, levelBlock] = buildLevelMenu(
      baseInput({ levels: fixtureLevels(5), bestTiers: new Map([[0, "bronze"]]) }),
    );

    expect(levelBlock?.tiles).toHaveLength(5);
    expect(levelBlock?.tiles.every((tile) => tile.kind === "level")).toBe(true);
  });

  it("carries a level tile's best tier through, undefined when never cleared", () => {
    const [, levelBlock] = buildLevelMenu(
      baseInput({ levels: fixtureLevels(3), bestTiers: new Map([[0, "gold"]]) }),
    );
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles[0]).toMatchObject({ tier: "gold" });
    expect(tiles[1]).toMatchObject({ tier: undefined });
  });

  it("marks the level tile at the selected index current, and no other", () => {
    const [, levelBlock] = buildLevelMenu(
      baseInput({
        levels: fixtureLevels(4),
        bestTiers: new Map([
          [0, "bronze"],
          [1, "bronze"],
        ]),
        selection: { kind: "level", index: 1 },
      }),
    );
    const tiles = levelBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual([false, true, false, false]);
  });

  it("numbers skyscraper tiles from one and links each to its level id", () => {
    // Linked by id and not by position, the way a lesson is: the block is the
    // one still being written, so a level inserted into the middle of it must
    // not hand somebody's bookmark to its neighbour.
    const [, , skyscraperBlock] = buildLevelMenu(
      baseInput({ skyscraperLevels: fixtureSkyscraperLevels(3) }),
    );
    const tiles = skyscraperBlock?.tiles ?? [];

    expect(tiles).toHaveLength(3);
    expect(tiles.map((tile) => (tile.kind === "skyscraper" ? tile.number : null))).toEqual([
      1, 2, 3,
    ]);
    expect(tiles.map((tile) => tile.href)).toEqual([
      "#level=sky-1",
      "#level=sky-2",
      "#level=sky-3",
    ]);
  });

  it("carries a skyscraper tile's best tier through, undefined when never cleared", () => {
    // Keyed by the level's id, not by its position: the two tier records are
    // two storage keys that know nothing about each other, and this is the one
    // a Skyscraper level's medal is written to.
    const [, , skyscraperBlock] = buildLevelMenu(
      baseInput({
        skyscraperLevels: fixtureSkyscraperLevels(3),
        bestSkyscraperTiers: new Map([["sky-2", "gold"]]),
      }),
    );
    const tiles = skyscraperBlock?.tiles ?? [];

    expect(tiles[0]).toMatchObject({ tier: undefined });
    expect(tiles[1]).toMatchObject({ tier: "gold" });
    expect(tiles[2]).toMatchObject({ tier: undefined });
  });

  it("reads the skyscraper tiers from their own record and not the numbered one", () => {
    // The two maps are keyed differently on purpose -- a numbered level by its
    // position, a Skyscraper level by its id -- so a bronze on level 1 must not
    // light up `sky-1`, and neither may reach into the other's block.
    const [, levelBlock, skyscraperBlock] = buildLevelMenu(
      baseInput({
        levels: fixtureLevels(2),
        skyscraperLevels: fixtureSkyscraperLevels(2),
        bestTiers: new Map([[0, "bronze"]]),
        bestSkyscraperTiers: new Map([["sky-2", "silver"]]),
      }),
    );

    expect(levelBlock?.tiles.map((tile) => (tile.kind === "level" ? tile.tier : null))).toEqual([
      "bronze",
      undefined,
    ]);
    expect(
      skyscraperBlock?.tiles.map((tile) => (tile.kind === "skyscraper" ? tile.tier : null)),
    ).toEqual([undefined, "silver"]);
  });

  it("marks the skyscraper tile at the selected index current, and no other", () => {
    const [, , skyscraperBlock] = buildLevelMenu(
      baseInput({
        skyscraperLevels: fixtureSkyscraperLevels(3),
        selection: { kind: "skyscraper", index: 1 },
      }),
    );
    const tiles = skyscraperBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual([false, true, false]);
  });

  it("keeps a skyscraper selection out of the block that shares its numbering", () => {
    // Both blocks number their tiles from one, so an index alone does not say
    // which block it belongs to. `kind` is what does.
    const [, levelBlock, skyscraperBlock] = buildLevelMenu(
      baseInput({
        levels: fixtureLevels(3),
        skyscraperLevels: fixtureSkyscraperLevels(3),
        selection: { kind: "skyscraper", index: 0 },
      }),
    );

    expect(levelBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(skyscraperBlock?.tiles[0]?.current).toBe(true);
  });

  it("offers exactly one always-open sandbox tile, linked through buildHref", () => {
    const [, , , sandboxBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "level", index: 0 } }),
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
    const [tutorialBlock, levelBlock, skyscraperBlock, sandboxBlock] = buildLevelMenu(
      baseInput({ levels: fixtureLevels(3), selection: { kind: "level", index: 9 } }),
    );

    expect(levelBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(tutorialBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(skyscraperBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(sandboxBlock?.tiles[0]?.current).toBe(false);
  });
});
