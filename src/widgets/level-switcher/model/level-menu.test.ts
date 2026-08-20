import { describe, expect, it } from "vitest";

import { buildLevelMenu, type LevelLinkTarget, type LevelMenuInput } from "./level-menu.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";
import { tutorialLevels } from "#game/tutorial.ts";

function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
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
    case "sandbox": {
      return "#level=sandbox";
    }
  }
}

function baseInput(overrides: Partial<LevelMenuInput> = {}): LevelMenuInput {
  return {
    levels: fixtureLevels(4),
    tutorialLevels,
    bestTiers: new Map(),
    clearedTutorialLevels: new Set(),
    selection: { kind: "sandbox" },
    buildHref: stubHref,
    ...overrides,
  };
}

describe("buildLevelMenu", () => {
  it("returns the tutorial, levels and other blocks in that order", () => {
    const blocks = buildLevelMenu(baseInput());

    // The third is `other` and not `sandbox` even though the sandbox is the
    // only tile in it -- the block and its one tile are captioned with two
    // different words on screen, so they have two different names here.
    expect(blocks.map((block) => block.id)).toEqual(["tutorial", "levels", "other"]);
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

  it("offers exactly one always-open sandbox tile, linked through buildHref", () => {
    const [, , sandboxBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "level", index: 0 } }),
    );

    expect(sandboxBlock?.tiles).toEqual([
      { kind: "sandbox", current: false, href: "#level=sandbox" },
    ]);
  });

  it("marks the sandbox tile current only when the selection names it", () => {
    const [, , sandboxBlock] = buildLevelMenu(baseInput({ selection: { kind: "sandbox" } }));

    expect(sandboxBlock?.tiles[0]).toMatchObject({ current: true });
  });

  it("marks no tile current when the selection names a level outside the list", () => {
    const [tutorialBlock, levelBlock, sandboxBlock] = buildLevelMenu(
      baseInput({ levels: fixtureLevels(3), selection: { kind: "level", index: 9 } }),
    );

    expect(levelBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(tutorialBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(sandboxBlock?.tiles[0]?.current).toBe(false);
  });
});
