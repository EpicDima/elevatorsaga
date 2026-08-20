import { describe, expect, it } from "vitest";

import { buildLevelMenu, type LevelLinkTarget, type LevelMenuInput } from "./level-menu.ts";
import { requireUserCountWithinTime, type Challenge } from "#game/challenges.ts";
import { tutorialTasks } from "#game/tutorial.ts";

function fixtureChallenges(count: number): readonly Challenge[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
  }));
}

/** Renders a {@link LevelLinkTarget} into a URL a test can assert on directly. */
function stubHref(target: LevelLinkTarget): string {
  switch (target.kind) {
    case "challenge": {
      return `#level=${String(target.number)}`;
    }
    case "tutorial": {
      return `#level=${target.taskId}`;
    }
    case "sandbox": {
      return "#level=sandbox";
    }
  }
}

function baseInput(overrides: Partial<LevelMenuInput> = {}): LevelMenuInput {
  return {
    challenges: fixtureChallenges(4),
    tutorialTasks,
    bestTiers: new Map(),
    clearedTutorialTasks: new Set(),
    selection: { kind: "sandbox" },
    buildHref: stubHref,
    ...overrides,
  };
}

describe("buildLevelMenu", () => {
  it("returns the tutorial, challenges and other blocks in that order", () => {
    const blocks = buildLevelMenu(baseInput());

    // The third is `other` and not `sandbox` even though the sandbox is the
    // only tile in it -- the block and its one tile are captioned with two
    // different words on screen, so they have two different names here.
    expect(blocks.map((block) => block.id)).toEqual(["tutorial", "challenges", "other"]);
  });

  it("numbers tutorial tiles from one and links each to its task id", () => {
    const [tutorialBlock] = buildLevelMenu(baseInput());
    const [firstTask] = tutorialTasks;

    expect(tutorialBlock?.tiles).toHaveLength(tutorialTasks.length);
    expect(tutorialBlock?.tiles[0]).toMatchObject({
      kind: "tutorial",
      index: 0,
      number: 1,
      href: `#level=${firstTask?.id ?? ""}`,
    });
  });

  it("marks a tutorial tile cleared once its task id is in the cleared set", () => {
    const [firstTask] = tutorialTasks;
    const [tutorialBlock] = buildLevelMenu(
      baseInput({ clearedTutorialTasks: new Set(firstTask === undefined ? [] : [firstTask.id]) }),
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

  it("numbers challenge tiles from one and links by number", () => {
    const [, challengeBlock] = buildLevelMenu(baseInput({ challenges: fixtureChallenges(4) }));
    const tiles = challengeBlock?.tiles ?? [];

    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => (tile.kind === "challenge" ? tile.number : null))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(tiles[0]?.href).toBe("#level=1");
  });

  it("locks a challenge tile until the one before it has any tier on record", () => {
    const [, challengeBlock] = buildLevelMenu(
      baseInput({ challenges: fixtureChallenges(5), bestTiers: new Map([[0, "bronze"]]) }),
    );
    const tiles = challengeBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.kind === "challenge" && tile.locked)).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("carries a challenge tile's best tier through, undefined when never cleared", () => {
    const [, challengeBlock] = buildLevelMenu(
      baseInput({ challenges: fixtureChallenges(3), bestTiers: new Map([[0, "gold"]]) }),
    );
    const tiles = challengeBlock?.tiles ?? [];

    expect(tiles[0]).toMatchObject({ tier: "gold" });
    expect(tiles[1]).toMatchObject({ tier: undefined });
  });

  it("marks the challenge tile at the selected index current, and no other", () => {
    const [, challengeBlock] = buildLevelMenu(
      baseInput({
        challenges: fixtureChallenges(4),
        bestTiers: new Map([
          [0, "bronze"],
          [1, "bronze"],
        ]),
        selection: { kind: "challenge", index: 1 },
      }),
    );
    const tiles = challengeBlock?.tiles ?? [];

    expect(tiles.map((tile) => tile.current)).toEqual([false, true, false, false]);
  });

  it("offers exactly one always-open sandbox tile, linked through buildHref", () => {
    const [, , sandboxBlock] = buildLevelMenu(
      baseInput({ selection: { kind: "challenge", index: 0 } }),
    );

    expect(sandboxBlock?.tiles).toEqual([
      { kind: "sandbox", current: false, href: "#level=sandbox" },
    ]);
  });

  it("marks the sandbox tile current only when the selection names it", () => {
    const [, , sandboxBlock] = buildLevelMenu(baseInput({ selection: { kind: "sandbox" } }));

    expect(sandboxBlock?.tiles[0]).toMatchObject({ current: true });
  });

  it("marks no tile current when the selection names a challenge outside the list", () => {
    const [tutorialBlock, challengeBlock, sandboxBlock] = buildLevelMenu(
      baseInput({ challenges: fixtureChallenges(3), selection: { kind: "challenge", index: 9 } }),
    );

    expect(challengeBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(tutorialBlock?.tiles.every((tile) => !tile.current)).toBe(true);
    expect(sandboxBlock?.tiles[0]?.current).toBe(false);
  });
});
