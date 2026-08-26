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

/** Stand-in Skyscraper levels, built directly rather than imported like `tutorialLevels`. */
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

    // Named `other`, not `sandbox`: the block and its one tile carry different
    // on-screen captions, so they need different ids here too.
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
    // Linked by id, not position, so inserting a level later doesn't hand
    // someone's bookmark to its neighbor.
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
    // Keyed by the level's id, not its position; the two tier records don't
    // share keys.
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
    // The maps are keyed differently on purpose, by position vs. by id, so
    // neither may reach into the other's block.
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
    // Both blocks number tiles from one, so `kind`, not the index alone, says which block a selection belongs to.
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
