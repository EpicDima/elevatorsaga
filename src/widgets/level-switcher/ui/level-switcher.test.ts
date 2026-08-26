// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { levelSwitcherTemplate, presentLevelSwitcher } from "./level-switcher.ts";
import type { LevelSwitcherOptions } from "./level-switcher.ts";
import type { LevelLinkTarget, LevelMenuInput } from "../model/level-menu.ts";
import type { LevelTier } from "#entities/level-tier/index.ts";
import { WINNING_IS_GOLD } from "#game/level-tiers.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";
import type { SkyscraperLevel } from "#game/skyscraper.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { SPRITE_ICONS } from "#shared/ui/icon.ts";

function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
    tiers: WINNING_IS_GOLD,
  }));
}

/** Stand-in Skyscraper levels; only `id` is read, spelled as the shipped entries are. */
function fixtureSkyscraperLevels(count: number): readonly SkyscraperLevel[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `sky-${String(index + 1)}`,
    options: {},
    condition: requireUserCountWithinTime(5, 60),
    tiers: WINNING_IS_GOLD,
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
    skyscraperLevels: fixtureSkyscraperLevels(2),
    bestTiers: new Map<number, LevelTier>(),
    clearedTutorialLevels: new Set(),
    bestSkyscraperTiers: new Map<string, LevelTier>(),
    selection: { kind: "level", index: 0 },
    buildHref: stubHref,
    ...overrides,
  };
}

/** Builds a mounted `.task` shell and options for `presentLevelSwitcher`. */
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

  // Asserts on each icon's path data, not the shared `ds-icon` class, which can't
  // tell a chevron pointing one way from one pointing the other.
  it("draws a chevron in each step button, pointing the way it steps", () => {
    const parent = document.createElement("div");
    parent.innerHTML = levelSwitcherTemplate();

    const drawn = (selector: string): string | null =>
      requireElement(`${selector} svg.ds-icon path`, parent).getAttribute("d");

    expect(drawn(".task-prev")).toBe(SPRITE_ICONS.left.shapes[0].attrs.d);
    expect(drawn(".task-next")).toBe(SPRITE_ICONS.right.shapes[0].attrs.d);
  });

  // Reads the class name out of the stylesheet rather than hard-coding it on
  // both sides, so a root rename that the stylesheet doesn't follow is caught.
  it("roots the widget in the class its own stylesheet positions the popover from", () => {
    const parent = document.createElement("div");
    parent.innerHTML = levelSwitcherTemplate();
    const root = parent.firstElementChild;

    // Read off disk: vitest stubs a CSS import to an empty string, which would
    // make the pattern below match nothing and pass for the wrong reason.
    const stylesheet = readFileSync(
      join(process.cwd(), "src/widgets/level-switcher/ui/level-switcher.css"),
      "utf8",
    );
    const rootRule = /^\.(?<name>[\w-]+)\s*\{[^}]*position:\s*relative[^}]*\}/mu.exec(stylesheet);

    expect(rootRule?.groups?.["name"]).toBe("task");
    expect(root?.className).toBe(rootRule?.groups?.["name"]);
    expect(requireElement(".taskmenu", parent).parentElement).toBe(root);
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

  it("fills the four blocks in order: tutorial, levels, skyscraper, other", () => {
    const { parent, options } = setUp();
    presentLevelSwitcher(parent, options);

    const captions = [...parent.querySelectorAll(".taskblock .cap")].map((el) => el.textContent);
    expect(captions).toEqual(["Learning", "Chapter 1", "Chapter 2", "Other"]);
    const [, , , otherBlock] = parent.querySelectorAll(".taskblock");
    expect(otherBlock?.querySelector(".tasklink")?.textContent).toBe("Sandbox");
  });

  it("renders every level tile as a real link, whatever is on record", () => {
    const { parent, options } = setUp({
      levels: fixtureLevels(5),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, levelBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(levelBlock?.querySelectorAll(".tasklink") ?? [])];

    // Every tile is a real link even with nothing on record; the row is a table
    // of contents, not a progression gate.
    expect(tiles.map((tile) => tile.tagName)).toEqual(["A", "A", "A", "A", "A"]);
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "#level=1",
      "#level=2",
      "#level=3",
      "#level=4",
      "#level=5",
    ]);
    expect(tiles.some((tile) => tile.hasAttribute("disabled"))).toBe(false);
  });

  it("badges every level tile with its tier stars", () => {
    const { parent, options } = setUp({
      levels: fixtureLevels(5),
      bestTiers: new Map<number, LevelTier>([[0, "silver"]]),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, levelBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(levelBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles.map((tile) => tile.querySelectorAll(".stars").length)).toEqual([1, 1, 1, 1, 1]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars .is-on").length)).toEqual([
      2, 0, 0, 0, 0,
    ]);
  });

  it("draws a skyscraper tile as its number, carried on from chapter one", () => {
    // Four numbered levels stand ahead of it in `baseInput`, so this block opens at five.
    const { parent, options } = setUp({ skyscraperLevels: fixtureSkyscraperLevels(3) });
    presentLevelSwitcher(parent, options);
    const [, , skyscraperBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(skyscraperBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles.map((tile) => tile.textContent)).toEqual(["5", "6", "7"]);
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "Level 5",
      "Level 6",
      "Level 7",
    ]);
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "#level=sky-1",
      "#level=sky-2",
      "#level=sky-3",
    ]);
  });

  it("medals a skyscraper tile from its own record, as a numbered level's is", () => {
    const { parent, options } = setUp({
      skyscraperLevels: fixtureSkyscraperLevels(2),
      bestSkyscraperTiers: new Map<string, LevelTier>([["sky-1", "silver"]]),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, , skyscraperBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(skyscraperBlock?.querySelectorAll(".tasklink") ?? [])];

    // `data-tier` is set only where a tier was earned; the badge itself is drawn
    // for every tile of a medalled block, dim stars and all.
    expect(tiles.map((tile) => tile.getAttribute("data-tier"))).toEqual(["silver", null]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars").length)).toEqual([1, 1]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars .is-on").length)).toEqual([2, 0]);
    expect(tiles.map((tile) => tile.classList.contains("is-done"))).toEqual([true, false]);
  });

  it("marks the current tile with aria-current and writes its name into the trigger", () => {
    const { parent, options } = setUp({
      levels: fixtureLevels(4),
      selection: { kind: "level", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const [, levelBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(levelBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles[1]?.getAttribute("aria-current")).toBe("page");
    expect(tiles[1]?.classList.contains("is-current")).toBe(true);
    expect(requireElement(".task-name", parent).textContent).toBe("Level 2");
  });

  it("keeps the trigger to the level's plain name, whatever the tile calls it", () => {
    // The trigger names the level and leaves state to the tile, across all
    // four selection kinds.
    const cleared = tutorialLevels[0];
    const lesson = setUp({
      selection: { kind: "tutorial", index: 0 },
      clearedTutorialLevels: new Set(cleared === undefined ? [] : [cleared.id]),
    });
    presentLevelSwitcher(lesson.parent, lesson.options);
    expect(requireElement(".task-name", lesson.parent).textContent).toBe("Lesson 1");

    const sandbox = setUp({ selection: { kind: "sandbox" } });
    presentLevelSwitcher(sandbox.parent, sandbox.options);
    expect(requireElement(".task-name", sandbox.parent).textContent).toBe("Sandbox");

    const level = setUp({
      levels: fixtureLevels(4),
      selection: { kind: "level", index: 3 },
    });
    presentLevelSwitcher(level.parent, level.options);
    expect(requireElement(".task-name", level.parent).textContent).toBe("Level 4");

    const skyscraper = setUp({
      skyscraperLevels: fixtureSkyscraperLevels(3),
      bestSkyscraperTiers: new Map<string, LevelTier>([["sky-2", "gold"]]),
      selection: { kind: "skyscraper", index: 1 },
    });
    presentLevelSwitcher(skyscraper.parent, skyscraper.options);
    expect(requireElement(".task-name", skyscraper.parent).textContent).toBe("Level 6");
  });

  it("names the gold a cleared tutorial tile holds, and badges it like any other tile", () => {
    const [firstLevel] = tutorialLevels;
    const { parent, options } = setUp({
      selection: { kind: "tutorial", index: 0 },
      clearedTutorialLevels: new Set(firstLevel === undefined ? [] : [firstLevel.id]),
    });
    presentLevelSwitcher(parent, options);
    const [tutorialBlock] = parent.querySelectorAll(".taskblock");
    const [firstTile, secondTile] = [...(tutorialBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(firstTile?.getAttribute("aria-label")).toBe("Tutorial level 1, Gold");
    expect(firstTile?.getAttribute("data-tier")).toBe("gold");
    expect(firstTile?.querySelectorAll(".star.is-on")).toHaveLength(3);
    // An uncleared tile still draws the badge, as empty slots, so the track's
    // tiles line up with the numbered ones rather than standing bare.
    expect(secondTile?.getAttribute("aria-label")).toBe("Tutorial level 2");
    expect(secondTile?.getAttribute("data-tier")).toBe(null);
    expect(secondTile?.querySelectorAll(".star")).toHaveLength(3);
    expect(secondTile?.querySelectorAll(".star.is-on")).toHaveLength(0);
  });

  it("never marks a tile done without the tier its tint is mixed from", () => {
    // `.tasklink.is-done` reads `--tier-tint`, which only a `data-tier` sets;
    // one without the other leaves the rule with nothing to mix.
    const [firstLevel] = tutorialLevels;
    const { parent, options } = setUp({
      levels: fixtureLevels(3),
      skyscraperLevels: fixtureSkyscraperLevels(2),
      bestTiers: new Map<number, LevelTier>([[0, "bronze"]]),
      bestSkyscraperTiers: new Map<string, LevelTier>([["sky-1", "silver"]]),
      clearedTutorialLevels: new Set(firstLevel === undefined ? [] : [firstLevel.id]),
      // Away from all three, so none of them is drawn current instead of done.
      selection: { kind: "sandbox" },
    });
    presentLevelSwitcher(parent, options);

    for (const tile of parent.querySelectorAll(".tasklink.is-done")) {
      expect(tile.getAttribute("data-tier")).not.toBe(null);
    }
    expect(parent.querySelectorAll(".tasklink.is-done")).toHaveLength(3);
  });

  it("names the medal a level tile holds, and says nothing where none is held", () => {
    const { parent, options } = setUp({
      levels: fixtureLevels(4),
      bestTiers: new Map<number, LevelTier>([
        [0, "bronze"],
        [1, "silver"],
        [2, "gold"],
      ]),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const [, levelBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(levelBlock?.querySelectorAll(".tasklink") ?? [])];

    // The stars are `aria-hidden`, so the tier name in the label is the only
    // way a screen reader learns about progress.
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "Level 1, Bronze",
      "Level 2, Silver",
      "Level 3, Gold",
      "Level 4",
    ]);
  });

  it("names the medal a skyscraper tile holds, as a numbered level's is named", () => {
    const { parent, options } = setUp({
      skyscraperLevels: fixtureSkyscraperLevels(2),
      bestSkyscraperTiers: new Map<string, LevelTier>([["sky-1", "gold"]]),
    });
    presentLevelSwitcher(parent, options);
    const [, , skyscraperBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(skyscraperBlock?.querySelectorAll(".tasklink") ?? [])];

    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "Level 5, Gold",
      "Level 6",
    ]);
  });

  it("labels the sandbox tile and links it through buildHref", () => {
    const { parent, options } = setUp({ selection: { kind: "sandbox" } });
    presentLevelSwitcher(parent, options);
    const [, , , sandboxBlock] = parent.querySelectorAll(".taskblock");
    const tile = sandboxBlock?.querySelector(".tasklink");

    expect(tile?.tagName).toBe("A");
    expect(tile?.textContent).toBe("Sandbox");
    expect(tile?.getAttribute("href")).toBe("#level=sandbox");
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

  it("disables the previous button on a block's first tile and the next button on its last", () => {
    const first = setUp({
      levels: fixtureLevels(3),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(first.parent, first.options);

    expect(requireElement(".task-prev", first.parent).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".task-next", first.parent).hasAttribute("disabled")).toBe(false);

    const last = setUp({
      levels: fixtureLevels(3),
      selection: { kind: "level", index: 2 },
    });
    presentLevelSwitcher(last.parent, last.options);

    expect(requireElement(".task-prev", last.parent).hasAttribute("disabled")).toBe(false);
    expect(requireElement(".task-next", last.parent).hasAttribute("disabled")).toBe(true);
  });

  it("steps next to the adjacent tile and navigates on click", () => {
    const { parent, options } = setUp({
      levels: fixtureLevels(5),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

    expect(taskNext.hasAttribute("disabled")).toBe(false);
    taskNext.click();

    expect(parent.ownerDocument.defaultView?.location.hash).toBe("#level=2");
  });

  it("scopes stepping to the current tile's own block", () => {
    const { parent, options } = setUp({
      tutorialLevels: tutorialLevels.slice(0, 2),
      selection: { kind: "tutorial", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

    expect(taskNext.hasAttribute("disabled")).toBe(true);
  });

  it("navigates nowhere when an arrow is pressed with nothing to step to", () => {
    // Not a click a player can make (the button is disabled), but the handler
    // still has to survive a dispatched one.
    const { parent, options } = setUp({
      levels: fixtureLevels(3),
      selection: { kind: "level", index: 0 },
    });
    presentLevelSwitcher(parent, options);
    const view = parent.ownerDocument.defaultView;
    const before = view?.location.href;

    requireElement(".task-prev", parent).dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view?.location.href).toBe(before);
  });

  it("names nothing and steps nowhere when the selection is outside the menu", () => {
    // A selection matching no tile is what the router hands over between one
    // level tearing down and the next building; the widget must not fall back
    // to picking the first tile or throwing.
    const { parent, options } = setUp({
      levels: fixtureLevels(4),
      selection: { kind: "level", index: 99 },
    });
    presentLevelSwitcher(parent, options);

    expect(requireElement(".task-name", parent).textContent).toBe("");
    expect(parent.querySelector(".tasklink[aria-current]")).toBeNull();
    expect(requireElement(".task-prev", parent).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".task-next", parent).hasAttribute("disabled")).toBe(true);
  });

  describe("focus", () => {
    it("keeps focus on the tile at the same position when the grid is rebuilt", () => {
      const { parent, options } = setUp();
      const presenter = presentLevelSwitcher(parent, options);
      const target = requireElement(".tasklink", parent);
      target.focus();
      const focusedIndex = queryAll(".tasklink", parent).indexOf(target);

      presenter.update();

      const rebuilt = queryAll(".tasklink", parent);
      expect(document.activeElement).toBe(rebuilt[focusedIndex]);
    });

    it("has nowhere to put focus when the rebuild drops the tile that had it", () => {
      let input = baseInput({ levels: fixtureLevels(6) });
      const parent = document.createElement("div");
      parent.innerHTML = levelSwitcherTemplate();
      document.body.append(parent);
      const presenter = presentLevelSwitcher(parent, { getInput: () => input });
      const flat = queryAll(".tasklink", parent);
      // The sandbox tile is always last and always a real, focusable link.
      const sandboxTile = flat[flat.length - 1];
      sandboxTile?.focus();
      expect(document.activeElement).toBe(sandboxTile);

      // Shrinking the level block moves the sandbox tile earlier, so nothing
      // in the rebuilt grid stands where the focused tile did.
      input = baseInput({ levels: fixtureLevels(1) });
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
