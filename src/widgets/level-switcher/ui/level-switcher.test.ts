// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { levelSwitcherTemplate, presentLevelSwitcher } from "./level-switcher.ts";
import type { LevelSwitcherOptions } from "./level-switcher.ts";
import type { LevelLinkTarget, LevelMenuInput } from "../model/level-menu.ts";
import type { ChallengeTier } from "#entities/challenge-tier/index.ts";
import { requireUserCountWithinTime, type Challenge } from "#game/challenges.ts";
import { tutorialTasks } from "#game/tutorial.ts";
import { requireElement } from "#shared/lib/dom.ts";

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
      return `#challenge=${String(target.number)}`;
    }
    case "tutorial": {
      return `#challenge=${target.taskId}`;
    }
    case "sandbox": {
      return "#challenge=sandbox";
    }
  }
}

function baseInput(overrides: Partial<LevelMenuInput> = {}): LevelMenuInput {
  return {
    challenges: fixtureChallenges(4),
    tutorialTasks,
    bestTiers: new Map<number, ChallengeTier>(),
    clearedTutorialTasks: new Set(),
    selection: { kind: "challenge", index: 0 },
    buildHref: stubHref,
    ...overrides,
  };
}

/**
 * Builds a mounted `.task` shell and options a test can point at a fresh
 * {@link LevelMenuInput} before calling `presenter.update()`.
 *
 * @param overrides - Fields to replace on the base fixture input.
 * @returns The mounted parent and the options {@link presentLevelSwitcher}
 * reads from.
 */
function setUp(overrides: Partial<LevelMenuInput> = {}): {
  parent: HTMLElement;
  options: LevelSwitcherOptions;
} {
  const parent = document.createElement("div");
  parent.innerHTML = levelSwitcherTemplate();
  document.body.append(parent);
  const input = baseInput(overrides);
  return { parent, options: { getInput: () => input } };
}

describe("levelSwitcherTemplate", () => {
  it("draws the inert shell: two step buttons, a closed trigger, and an empty menu", () => {
    const parent = document.createElement("div");
    parent.innerHTML = levelSwitcherTemplate();

    expect(parent.querySelector(".task-prev")).not.toBeNull();
    expect(parent.querySelector(".task-next")).not.toBeNull();
    const taskOpen = requireElement(".task-open", parent);
    expect(taskOpen.getAttribute("aria-haspopup")).toBe("true");
    expect(taskOpen.getAttribute("aria-expanded")).toBe("false");
    expect(requireElement(".taskmenu", parent).hasAttribute("hidden")).toBe(true);
    expect(requireElement(".taskblocks", parent).children).toHaveLength(0);
  });
});

describe("presentLevelSwitcher", () => {
  it("opens and closes the popover from its trigger", () => {
    const { parent, options } = setUp();
    presentLevelSwitcher(parent, options);
    const taskOpen = requireElement(".task-open", parent);
    const taskMenu = requireElement(".taskmenu", parent);

    taskOpen.click();
    expect(taskMenu.hidden).toBe(false);
    expect(taskOpen.getAttribute("aria-expanded")).toBe("true");

    taskOpen.click();
    expect(taskMenu.hidden).toBe(true);
    expect(taskOpen.getAttribute("aria-expanded")).toBe("false");
  });

  it("fills the three blocks in order: tutorial, challenges, sandbox", () => {
    const { parent, options } = setUp();
    presentLevelSwitcher(parent, options);

    const captions = [...parent.querySelectorAll(".taskblock .cap")].map((el) => el.textContent);
    expect(captions).toEqual(["Learning track", "Challenges", "Sandbox"]);
  });

  it("renders an open challenge tile as a real link and a locked one as a disabled button", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(5),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, challengeBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(challengeBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles.map((tile) => tile.tagName)).toEqual(["A", "BUTTON", "BUTTON", "BUTTON", "A"]);
    expect(tiles[1]?.hasAttribute("disabled")).toBe(true);
    expect(tiles[1]?.getAttribute("href")).toBeNull();
    expect(tiles[0]?.getAttribute("href")).toBe("#challenge=1");
  });

  it("marks the current tile with aria-current and writes its name into the trigger", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(4),
      // Unlocks tile index 1, so this exercises an ordinary open-and-current
      // tile rather than the locked-and-current edge case (which has its own
      // dedicated coverage in "marks a locked-and-current tile as current
      // too" below).
      bestTiers: new Map<number, ChallengeTier>([[0, "bronze"]]),
      selection: { kind: "challenge", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const [, challengeBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(challengeBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles[1]?.getAttribute("aria-current")).toBe("page");
    expect(tiles[1]?.classList.contains("is-current")).toBe(true);
    expect(requireElement(".task-name", parent).textContent).toBe("Challenge 2");
  });

  it("marks a locked-and-current tile as current too, on its disabled button", () => {
    // Empty bestTiers locks every challenge past the first (see
    // features/switch-level's lockChallengeTiles), so tile index 1 here is
    // both locked and, per selection below, the one actually being played —
    // reachable via a direct link to a challenge never unlocked through the
    // switcher itself.
    const { parent, options } = setUp({
      challenges: fixtureChallenges(4),
      selection: { kind: "challenge", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const [, challengeBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(challengeBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles[1]?.tagName).toBe("BUTTON");
    expect(tiles[1]?.hasAttribute("disabled")).toBe(true);
    expect(tiles[1]?.getAttribute("aria-current")).toBe("page");
    expect(tiles[1]?.classList.contains("is-locked")).toBe(true);
    expect(tiles[1]?.classList.contains("is-current")).toBe(true);
    expect(requireElement(".task-name", parent).textContent).toBe("Challenge 2, locked");
  });

  it("labels a cleared tutorial tile as completed", () => {
    const [firstTask] = tutorialTasks;
    const { parent, options } = setUp({
      selection: { kind: "tutorial", index: 0 },
      clearedTutorialTasks: new Set(firstTask === undefined ? [] : [firstTask.id]),
    });
    presentLevelSwitcher(parent, options);
    const [tutorialBlock] = parent.querySelectorAll(".taskblock");
    const firstTile = tutorialBlock?.querySelector(".tasklink");

    expect(firstTile?.getAttribute("aria-label")).toBe("Tutorial task 1, completed");
  });

  it("labels the sandbox tile and links it through buildHref", () => {
    const { parent, options } = setUp({ selection: { kind: "sandbox" } });
    presentLevelSwitcher(parent, options);
    const [, , sandboxBlock] = parent.querySelectorAll(".taskblock");
    const tile = sandboxBlock?.querySelector(".tasklink");

    expect(tile?.tagName).toBe("A");
    expect(tile?.textContent).toBe("Sandbox");
    expect(tile?.getAttribute("href")).toBe("#challenge=sandbox");
  });

  it("closes the popover when a tile is clicked", () => {
    const { parent, options } = setUp();
    presentLevelSwitcher(parent, options);
    const taskOpen = requireElement(".task-open", parent);
    const taskMenu = requireElement(".taskmenu", parent);
    taskOpen.click();
    expect(taskMenu.hidden).toBe(false);

    requireElement(".tasklink", parent).click();

    expect(taskMenu.hidden).toBe(true);
  });

  it("disables the previous button on a block's first open tile and the next button on its last", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(3),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const taskPrev = requireElement(".task-prev", parent);
    const taskNext = requireElement(".task-next", parent);

    expect(taskPrev.hasAttribute("disabled")).toBe(true);
    expect(taskNext.hasAttribute("disabled")).toBe(false);
  });

  it("steps next to the nearest open tile, skipping locked challenges, and navigates on click", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(5),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

    // Challenges 2-4 (indices 1-3) are locked with no tier on record, so
    // "next" from challenge 1 skips straight to the demo tile at index 4.
    expect(taskNext.hasAttribute("disabled")).toBe(false);
    taskNext.click();

    expect(parent.ownerDocument.defaultView?.location.hash).toBe("#challenge=5");
  });

  it("scopes stepping to the current tile's own block", () => {
    const { parent, options } = setUp({
      tutorialTasks: tutorialTasks.slice(0, 2),
      selection: { kind: "tutorial", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

    // Last tile of the tutorial block: stepping "next" must not cross into
    // the challenges block.
    expect(taskNext.hasAttribute("disabled")).toBe(true);
  });
});
