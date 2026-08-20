// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { levelSwitcherTemplate, presentLevelSwitcher } from "./level-switcher.ts";
import type { LevelSwitcherOptions } from "./level-switcher.ts";
import type { LevelLinkTarget, LevelMenuInput } from "../model/level-menu.ts";
import type { ChallengeTier } from "#entities/challenge-tier/index.ts";
import { requireUserCountWithinTime, type Challenge } from "#game/challenges.ts";
import { tutorialTasks } from "#game/tutorial.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { SPRITE_ICONS } from "#shared/ui/icon.ts";

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

  /*
   * The regression this file did not have: both step buttons shipped empty
   * from the day the widget landed. They are styled and sized, they take
   * focus, they carry an `aria-label` and they navigate -- and they drew
   * nothing at all, so the bar showed two blank 32px gaps where the mockup
   * shows a chevron either side of the level's name. Asserted by the path
   * each sprite is actually made of rather than by the class both share,
   * because `ds-icon` is what told the empty buttons apart from nothing:
   * both had it on neither of them.
   */
  it("draws a chevron in each step button, pointing the way it steps", () => {
    const parent = document.createElement("div");
    parent.innerHTML = levelSwitcherTemplate();

    const drawn = (selector: string): string | null =>
      requireElement(`${selector} svg.ds-icon path`, parent).getAttribute("d");

    expect(drawn(".task-prev")).toBe(SPRITE_ICONS.left.shapes[0].attrs.d);
    expect(drawn(".task-next")).toBe(SPRITE_ICONS.right.shapes[0].attrs.d);
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

  it("fills the three blocks in order: tutorial, challenges, other", () => {
    const { parent, options } = setUp();
    presentLevelSwitcher(parent, options);

    const captions = [...parent.querySelectorAll(".taskblock .cap")].map((el) => el.textContent);
    // The third block is captioned "Other" while the one tile inside it is
    // captioned "Sandbox" — see `blockCaption` for why they are not the same
    // word.
    expect(captions).toEqual(["Learning track", "Levels", "Other"]);
    const [, , otherBlock] = parent.querySelectorAll(".taskblock");
    expect(otherBlock?.querySelector(".tasklink")?.textContent).toBe("Sandbox");
  });

  it("renders an open challenge tile as a real link and a locked one as a disabled button", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(5),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, challengeBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(challengeBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles.map((tile) => tile.tagName)).toEqual([
      "A",
      "BUTTON",
      "BUTTON",
      "BUTTON",
      "BUTTON",
    ]);
    expect(tiles[1]?.hasAttribute("disabled")).toBe(true);
    expect(tiles[1]?.getAttribute("href")).toBeNull();
    expect(tiles[0]?.getAttribute("href")).toBe("#challenge=1");
  });

  it("badges every open challenge tile with its tier stars", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(5),
      bestTiers: new Map<number, ChallengeTier>([[0, "silver"]]),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, challengeBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(challengeBlock?.querySelectorAll(".tasklink") ?? [])];

    const litCounts = tiles
      .slice(0, 2)
      .map((tile) => tile.querySelectorAll(".stars .is-on").length);
    expect(litCounts).toEqual([2, 0]);
    // Tiles 2-4 are locked (nothing on record before them) and must carry no
    // badge at all, not merely an unlit one — a dim badge would still read 0
    // lit above and let a regression through unnoticed.
    expect(tiles[2]?.querySelector(".stars")).toBeNull();
    expect(tiles[3]?.querySelector(".stars")).toBeNull();
    expect(tiles[4]?.querySelector(".stars")).toBeNull();
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
    expect(requireElement(".task-name", parent).textContent).toBe("Level 2");
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
    expect(requireElement(".task-name", parent).textContent).toBe("Level 2, locked");
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
    // Every tile of the block open, so what each button reports is where the
    // selection sits and not what is locked past it.
    const cleared = new Map<number, ChallengeTier>([
      [0, "bronze"],
      [1, "bronze"],
    ]);

    const first = setUp({
      challenges: fixtureChallenges(3),
      bestTiers: cleared,
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(first.parent, first.options);

    expect(requireElement(".task-prev", first.parent).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".task-next", first.parent).hasAttribute("disabled")).toBe(false);

    const last = setUp({
      challenges: fixtureChallenges(3),
      bestTiers: cleared,
      selection: { kind: "challenge", index: 2 },
    });
    presentLevelSwitcher(last.parent, last.options);

    expect(requireElement(".task-prev", last.parent).hasAttribute("disabled")).toBe(false);
    expect(requireElement(".task-next", last.parent).hasAttribute("disabled")).toBe(true);
  });

  it("steps next to the nearest open tile, skipping locked challenges, and navigates on click", () => {
    const { parent, options } = setUp({
      challenges: fixtureChallenges(5),
      // Challenge 5 (index 4) is open because the one before it is on record;
      // 2 through 4 are not, since nothing before any of them is. So the only
      // place "next" can go from challenge 1 is past all three of them.
      bestTiers: new Map<number, ChallengeTier>([[3, "bronze"]]),
      selection: { kind: "challenge", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

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

  describe("focus", () => {
    // The same problem, and the same fix, as `presentChallenge`'s own
    // navigation row in what was `src/ui/presenters.ts` — see
    // `level-switcher.ts`'s own comment on `update()` for why position, not
    // node identity, is what gets restored.

    it("keeps focus on the tile at the same position when the grid is rebuilt", () => {
      const { parent, options } = setUp();
      const presenter = presentLevelSwitcher(parent, options);
      const target = requireElement(".tasklink:not([disabled])", parent);
      target.focus();
      const focusedIndex = queryAll(".tasklink", parent).indexOf(target);

      presenter.update();

      const rebuilt = queryAll(".tasklink", parent);
      expect(document.activeElement).toBe(rebuilt[focusedIndex]);
    });

    it("has nowhere to put focus when the rebuild drops the tile that had it", () => {
      let input = baseInput({ challenges: fixtureChallenges(6) });
      const parent = document.createElement("div");
      parent.innerHTML = levelSwitcherTemplate();
      document.body.append(parent);
      const presenter = presentLevelSwitcher(parent, { getInput: () => input });
      const flat = queryAll(".tasklink", parent);
      // The sandbox tile: always last, and always open, so it is always a
      // real, focusable link regardless of the challenge count.
      const sandboxTile = flat[flat.length - 1];
      sandboxTile?.focus();
      expect(document.activeElement).toBe(sandboxTile);

      // Shrinking the challenge block from 6 tiles to 1 moves the sandbox
      // tile several positions earlier, so nothing in the rebuilt grid
      // stands where the focused tile did.
      input = baseInput({ challenges: fixtureChallenges(1) });
      presenter.update();

      expect(document.activeElement).toBe(document.body);
    });

    it("leaves focus alone when nothing inside the menu had it", () => {
      const { parent, options } = setUp();
      const presenter = presentLevelSwitcher(parent, options);
      const elsewhere = document.createElement("textarea");
      document.body.append(elsewhere);
      elsewhere.focus();

      presenter.update();

      expect(document.activeElement).toBe(elsewhere);
    });
  });
});
