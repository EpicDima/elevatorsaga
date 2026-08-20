// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { levelSwitcherTemplate, presentLevelSwitcher } from "./level-switcher.ts";
import type { LevelSwitcherOptions } from "./level-switcher.ts";
import type { LevelLinkTarget, LevelMenuInput } from "../model/level-menu.ts";
import type { LevelTier } from "#entities/level-tier/index.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";
import type { SkyscraperLevel } from "#game/skyscraper.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { SPRITE_ICONS } from "#shared/ui/icon.ts";

function fixtureLevels(count: number): readonly Level[] {
  return Array.from({ length: count }, () => ({
    options: {},
    condition: requireUserCountWithinTime(5, 60),
  }));
}

/**
 * Stand-in Skyscraper levels, built rather than imported for the reason
 * `level-menu.test.ts`'s own copy of this helper gives: the shipped block holds
 * one level today, and a grid of one tile cannot say which tile a tier lit or
 * which one the selection marked. Only `id` is read, and it is spelled the way
 * the shipped entries are.
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
    skyscraperLevels: fixtureSkyscraperLevels(2),
    bestTiers: new Map<number, LevelTier>(),
    clearedTutorialLevels: new Set(),
    bestSkyscraperTiers: new Map<string, LevelTier>(),
    selection: { kind: "level", index: 0 },
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

  /*
   * The second regression this file did not have, and the more expensive of
   * the two: the «уровень» sweep renamed the root from `task` to `level`,
   * which no test noticed because every other assertion here reaches for a
   * child by class and every child kept its name. The stylesheet did not
   * follow, and could not -- `.task` is `design/ui-mockup.html`'s own name,
   * cited by that file across the widget -- so the root simply stopped being
   * styled: `display: flex` went, and the trigger and its two chevrons
   * stacked into a column the app bar clipped; `position: relative` went with
   * it, and `.taskmenu`'s `position: absolute` measured `top: calc(100% + 8px)`
   * from the initial containing block instead, opening the popover a page
   * below the fold. On screen that is a switcher with no arrows whose button
   * does nothing at all, which is how it was reported.
   *
   * Read out of the stylesheet rather than hard-coded on both sides, since a
   * literal `"task"` written twice in this file would agree with itself just
   * as happily while the rules that actually lay the widget out named
   * something else.
   */
  it("roots the widget in the class its own stylesheet positions the popover from", () => {
    const parent = document.createElement("div");
    parent.innerHTML = levelSwitcherTemplate();
    const root = parent.firstElementChild;

    // Read off disk rather than imported: vitest stubs a CSS import out to
    // an empty string, `?raw` and all, which would make the pattern below
    // match nothing and the assertion pass for the wrong reason.
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
    // The Skyscraper block is captioned with a string of its own rather than
    // borrowing one, since nothing in the catalogue names the block as a whole.
    // The last block is captioned "Other" while the one tile inside it is
    // captioned "Sandbox" — see `blockCaption` for why they are not the same
    // word.
    expect(captions).toEqual(["Learning track", "Levels", "Skyscraper", "Other"]);
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

    // Nothing on record, and still five anchors: the row is a table of
    // contents, not a gate. A `<button disabled>` here would be a regression
    // back to progression locking.
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

    // A badge on every tile, lit only where a tier is on record: the stars are
    // what the row says instead of a lock, so an unplayed level shows three
    // dim ones rather than nothing at all.
    expect(tiles.map((tile) => tile.querySelectorAll(".stars").length)).toEqual([1, 1, 1, 1, 1]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars .is-on").length)).toEqual([
      2, 0, 0, 0, 0,
    ]);
  });

  it("draws a skyscraper tile as its number, named in full for a screen reader", () => {
    const { parent, options } = setUp({ skyscraperLevels: fixtureSkyscraperLevels(3) });
    presentLevelSwitcher(parent, options);
    const [, , skyscraperBlock] = parent.querySelectorAll(".taskblock");
    const tiles = [...(skyscraperBlock?.querySelectorAll(".tasklink") ?? [])];

    // The visible text is the number alone, as a numbered level's is; the
    // accessible name is where the block it belongs to is said.
    expect(tiles.map((tile) => tile.textContent)).toEqual(["1", "2", "3"]);
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "Skyscraper level 1",
      "Skyscraper level 2",
      "Skyscraper level 3",
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

    // `data-tier` is on the tile only where a tier was actually earned, which
    // is what tells the two apart: the badge itself is drawn for every tile of
    // a medalled block, dim stars and all, so its presence says nothing. Both
    // are read from the one `earned` the template now works out once -- they
    // used to be asked separately, and that is how they came to disagree about
    // `undefined`.
    expect(tiles.map((tile) => tile.getAttribute("data-tier"))).toEqual(["silver", null]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars").length)).toEqual([1, 1]);
    expect(tiles.map((tile) => tile.querySelectorAll(".stars .is-on").length)).toEqual([2, 0]);
    // And the third thing that one answer decides: the tile reads as done.
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
    // Four kinds of tile, one rule: the trigger names the level and leaves
    // its state to the tile. The lesson is the case that forced it -- 118px of
    // button against «Учебный уровень 1», which wants 136px -- and the other
    // three are here so that a later change cannot quietly reintroduce a state
    // suffix through them.
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

    // Not the tile's "Skyscraper level 2" either, and for the same measured
    // reason: the block's own name alone fills the button by the time it
    // reaches ten levels.
    const skyscraper = setUp({
      skyscraperLevels: fixtureSkyscraperLevels(3),
      bestSkyscraperTiers: new Map<string, LevelTier>([["sky-2", "gold"]]),
      selection: { kind: "skyscraper", index: 1 },
    });
    presentLevelSwitcher(skyscraper.parent, skyscraper.options);
    expect(requireElement(".task-name", skyscraper.parent).textContent).toBe("Tower 2");
  });

  it("labels a cleared tutorial tile as completed", () => {
    const [firstLevel] = tutorialLevels;
    const { parent, options } = setUp({
      selection: { kind: "tutorial", index: 0 },
      clearedTutorialLevels: new Set(firstLevel === undefined ? [] : [firstLevel.id]),
    });
    presentLevelSwitcher(parent, options);
    const [tutorialBlock] = parent.querySelectorAll(".taskblock");
    const firstTile = tutorialBlock?.querySelector(".tasklink");

    expect(firstTile?.getAttribute("aria-label")).toBe("Tutorial level 1, completed");
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

    // The very next one, with nothing on record: stepping walks the block in
    // order rather than hunting for the next reachable tile.
    expect(parent.ownerDocument.defaultView?.location.hash).toBe("#level=2");
  });

  it("scopes stepping to the current tile's own block", () => {
    const { parent, options } = setUp({
      tutorialLevels: tutorialLevels.slice(0, 2),
      selection: { kind: "tutorial", index: 1 },
    });
    presentLevelSwitcher(parent, options);
    const taskNext = requireElement(".task-next", parent);

    // Last tile of the tutorial block: stepping "next" must not cross into
    // the levels block.
    expect(taskNext.hasAttribute("disabled")).toBe(true);
  });

  it("names nothing and steps nowhere when the selection is outside the menu", () => {
    // `buildLevelMenu`'s own documented case: a selection that matches no tile
    // at all, which is what the router hands over for the moment between one
    // level being torn down and the next being built. Every question the
    // widget asks about "the current tile" has to answer "there isn't one"
    // rather than pick the first tile or throw -- an empty trigger and two
    // dead arrows, not a switcher that has quietly moved the player.
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
    // The same problem, and the same fix, as `presentLevel`'s own
    // navigation row in what was `src/ui/presenters.ts` — see
    // `level-switcher.ts`'s own comment on `update()` for why position, not
    // node identity, is what gets restored.

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
      // The sandbox tile: always last, and always open, so it is always a
      // real, focusable link regardless of the level count.
      const sandboxTile = flat[flat.length - 1];
      sandboxTile?.focus();
      expect(document.activeElement).toBe(sandboxTile);

      // Shrinking the level block from 6 tiles to 1 moves the sandbox
      // tile several positions earlier, so nothing in the rebuilt grid
      // stands where the focused tile did.
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
