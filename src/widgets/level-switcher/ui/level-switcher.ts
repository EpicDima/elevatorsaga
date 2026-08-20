/**
 * The app bar's level switcher: `design/ui-mockup.html`'s `.task` — a
 * current-level button that opens a popover of every level, plus a step
 * button either side of it. Ports `renderTaskMenu`, `neighbour` and
 * `updateTaskNav`, sitting on `#widgets/level-switcher/model/level-menu.ts`'s
 * {@link buildLevelMenu} for what to draw rather than the fixture the mockup
 * reads from.
 *
 * Follows `run-controls.ts`'s template-plus-presenter shape, not
 * `app-bar.ts`'s injected-labels one: the row there redraws five buttons
 * that never change which five they are, where this one's tiles gain, lose
 * and swap `locked`/`current`/`cleared`/`tier` on every run that ends — so
 * {@link presentLevelSwitcher}'s `update()` reruns `buildLevelMenu` and
 * every `t()` call in it, the same as a language change would need anyway.
 *
 * The tile grid is rebuilt from scratch on every `update()`, unlike
 * `run-controls.ts`'s five buttons, which are only ever relabelled. A
 * challenge tile is a real, non-navigable `<button disabled>` while locked
 * and a real `<a href>` once it opens — two different elements, not one
 * patched in place, for the reason `level-menu.ts`'s module comment gives
 * for building `href` at all: an `<a>` has no true disabled state, so a
 * locked tile that stayed an anchor would need to fake one. Rebuilding
 * matches `design/ui-mockup.html`'s own `taskBlocks.innerHTML = ...`, the
 * one place this port keeps the mockup's approach rather than
 * `run-controls.ts`'s patch-in-place — a fixed set of tiles that only ever
 * change tag as well as content is the case that pattern does not cover.
 *
 * Mounted live from `src/pages/game/index.ts` since Phase 12.2. A tile's
 * tier is carried both as a bare `data-tier` attribute on the tile itself,
 * for whatever styling a later CSS pass gives the tile as a whole, and as
 * `entities/challenge-tier`'s own
 * {@link tierBadgeMarkup} badge, for the stars a player actually reads —
 * every open challenge tile gets one, dim stars included at zero earned,
 * matching `design/ui-mockup.html`'s `renderTaskMenu`.
 */

import {
  buildLevelMenu,
  type LevelMenuBlock,
  type LevelMenuInput,
  type LevelMenuTile,
} from "../model/level-menu.ts";
import { tierBadgeMarkup } from "#entities/challenge-tier/index.ts";
import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { createDisclosure } from "#shared/ui/disclosure.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderFragment } from "#shared/ui/markup.ts";

/**
 * The switcher's inert skeleton: a step button either side of the trigger,
 * and an empty popover for {@link LevelSwitcherPresenter.update} to fill.
 *
 * Ships with no text at all, the same choice `runButtonsTemplate` makes and
 * for the same reason — see this module's own comment.
 *
 * The two chevrons are the one exception, and they are not text: `#i-left`
 * and `#i-right`, exactly as `design/ui-mockup.html`'s own `#taskPrev` and
 * `#taskNext` draw them. A step button is a glyph and an `aria-label` with
 * nothing else in it, so drawing the glyph here rather than in `update()`
 * costs nothing to redraw — the label is what changes with the language,
 * and the presenter already sets that.
 *
 * @returns The switcher markup, ready for `presentLevelSwitcher`.
 */
export function levelSwitcherTemplate(): string {
  return markup`<div class="task"><button type="button" class="task-prev">${raw(spriteIconMarkup("left"))}</button><button type="button" class="task-open" aria-haspopup="true" aria-expanded="false"><b class="task-name"></b></button><button type="button" class="task-next">${raw(spriteIconMarkup("right"))}</button><div class="taskmenu" hidden><div class="taskblocks"></div></div></div>`;
}

/** What the switcher needs in order to draw and redraw itself. */
export interface LevelSwitcherOptions {
  /**
   * Builds a fresh {@link LevelMenuInput}, read anew by every `update()` —
   * the tier a challenge earned, which tasks are cleared and what is
   * currently selected all move between one run and the next.
   */
  readonly getInput: () => LevelMenuInput;
}

/** The drawn switcher. */
export interface LevelSwitcherPresenter {
  /**
   * Rebuilds the tile grid from a fresh {@link LevelMenuInput}, relabels the
   * trigger and the two step buttons, and points the step buttons at the
   * nearest open tile either side of the current one.
   *
   * Called after anything that could have moved any of that: a challenge
   * cleared, a tutorial task cleared, a run started elsewhere, a language
   * change — the same list `RunControlsPresenter.update`'s own comment
   * gives, once for this row instead of that one.
   */
  update(): void;
}

/**
 * Finds the tile a player is told is "current" in whichever block holds it.
 *
 * @param blocks - The menu to search.
 * @returns The current tile, or `undefined` if the selection names nothing
 * in this menu — `buildLevelMenu`'s own documented case for a selection
 * outside the challenge list.
 */
function currentTile(blocks: readonly LevelMenuBlock[]): LevelMenuTile | undefined {
  for (const block of blocks) {
    const found = block.tiles.find((tile) => tile.current);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * Whether a tile can be stepped to — every tile but a locked challenge.
 *
 * @param tile - Tile to test.
 * @returns Whether {@link stepHref} may return it.
 */
function isOpenTile(tile: LevelMenuTile): boolean {
  return tile.kind !== "challenge" || !tile.locked;
}

/**
 * Where a step button goes: the nearest open tile in the current tile's own
 * block, stepping outward from it.
 *
 * Scoped to one block on purpose — stepping from the last tutorial task
 * straight into challenge one would cross two different kinds of level in
 * one press, which is not what either step button's arrow promises.
 *
 * @param blocks - The menu to step within.
 * @param step - `-1` for the previous tile, `1` for the next.
 * @returns The neighbour's `href`, or `undefined` if there is none — nothing
 * is current, or every tile that way is locked.
 */
function stepHref(blocks: readonly LevelMenuBlock[], step: -1 | 1): string | undefined {
  const block = blocks.find((candidate) => candidate.tiles.some((tile) => tile.current));
  if (block === undefined) {
    return undefined;
  }
  const from = block.tiles.findIndex((tile) => tile.current);
  for (let index = from + step; index >= 0 && index < block.tiles.length; index += step) {
    const tile = block.tiles[index];
    if (tile !== undefined && isOpenTile(tile)) {
      return tile.href;
    }
  }
  return undefined;
}

/**
 * The text a tile shows in the grid — brief, since the accessible name in
 * {@link tileAccessibleName} carries the rest, the same split
 * `challengeLinkTemplate` already draws between a nav link's visible label
 * and its `aria-label`.
 *
 * @param tile - Tile to draw.
 * @returns Its visible text.
 */
function tileText(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return String(tile.number);
    }
    case "challenge": {
      return String(tile.number);
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * The name assistive technology reads for a tile — what {@link tileText}
 * shows plus whatever it left out: which task this is, whether it is
 * cleared, whether it is locked and why.
 *
 * @param tile - Tile to name.
 * @returns Its accessible name.
 */
function tileAccessibleName(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return tile.cleared
        ? t("game.levelSwitcher.tutorialTileClearedLabel", { number: tile.number })
        : t("game.levelSwitcher.tutorialTileLabel", { number: tile.number });
    }
    case "challenge": {
      if (tile.locked) {
        return t("game.levelSwitcher.challengeTileLockedLabel", { number: tile.number });
      }
      return t("game.challenge.nav.link", { number: tile.number });
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * The name the trigger shows for the level being played: what the level is
 * called, and nothing else.
 *
 * Deliberately not {@link tileAccessibleName}, which the trigger used to
 * borrow. That name is written for a tile in a grid, where ", completed" and
 * ", locked" are the tile's whole point, and the trigger is 118px wide —
 * `design/ui-mockup.html` sizes `.task-open` for the longest thing it ever
 * puts there, and every world in that file is named `Уровень {n}` with no
 * state on the end. Borrowed onto the trigger those names overflow: measured
 * in Chromium, «Учебный уровень 1» wants 136px of the 96px inside the button,
 * so the whole learning track read «Учебный уро...» in Russian, and a cleared
 * level truncated in English too.
 *
 * Widening the button was the other way out and was not taken: the width is
 * the mockup's, the row it sits in is already tight at 1040px, and a control
 * that resizes as you step through levels is its own kind of wrong. What was
 * borrowed was the wrong string, so this is the right one — the tile in the
 * menu still says whether it is cleared or locked, which is where a player
 * looks for that.
 *
 * @param tile - The current tile.
 * @returns Its plain name.
 */
function tileTriggerName(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return t("game.levelSwitcher.tutorialTriggerLabel", { number: tile.number });
    }
    case "challenge": {
      return t("game.challenge.nav.link", { number: tile.number });
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * The tile markup: a real `<a href>` once a tile is open, a real,
 * non-navigable `<button disabled>` while a challenge tile is locked — see
 * this module's own comment for why a locked tile is never an anchor.
 *
 * `aria-current` is written either way, on the disabled button as much as on
 * the anchor. A direct link used to be able to select a locked challenge as
 * `current`, and cannot any more: `src/pages/game/model/route.ts` asks the
 * same question of an address that this widget asks of a tile, and answers a
 * level nobody has unlocked with the furthest one they have. But
 * {@link "../model/level-menu.ts"!LevelMenuInput}'s `selection` still names
 * whatever is actually being played, whoever chose it and by whatever route,
 * and the promise that it is never a locked level is the router's rather than
 * this widget's — so the mark goes on the tile that is current, and a state
 * this module cannot rule out is a state it can still draw.
 *
 * @param tile - Tile to draw.
 * @returns The tile's markup.
 */
function tileTemplate(tile: LevelMenuTile): string {
  const text = tileText(tile);
  const name = tileAccessibleName(tile);
  const current = tile.current ? raw(' aria-current="page"') : raw("");
  if (tile.kind === "challenge" && tile.locked) {
    const lockedClasses = tile.current ? "tasklink is-locked is-current" : "tasklink is-locked";
    return markup`<button type="button" class="${lockedClasses}" aria-label="${name}"${current} disabled>${text}</button>`;
  }
  const done =
    (tile.kind === "challenge" && tile.tier !== undefined) ||
    (tile.kind === "tutorial" && tile.cleared);
  const classes = [
    "tasklink",
    tile.kind === "sandbox" ? "is-free" : "",
    tile.current ? "is-current" : done ? "is-done" : "",
  ]
    .filter((className) => className !== "")
    .join(" ");
  const tier =
    tile.kind === "challenge" && tile.tier !== undefined
      ? raw(` data-tier="${tile.tier}"`)
      : raw("");
  const badge = tile.kind === "challenge" ? raw(tierBadgeMarkup(tile.tier)) : raw("");
  return markup`<a class="${classes}" href="${tile.href}" aria-label="${name}"${current}${tier}>${text}${badge}</a>`;
}

/**
 * A block's caption. The first two reuse the labels the nav row and the
 * tutorial panel already carry, rather than a second pair of
 * "Levels"/"Tutorial" strings a translator would have to keep in step with
 * those.
 *
 * The third has a string of its own, and does not reuse the sandbox tile's:
 * captioning a block with the name of the single tile in it says the same
 * word twice and promises the block will only ever hold that one thing. It
 * says "Other" instead — what is left once the lessons and the numbered
 * levels are accounted for.
 *
 * @param id - Block to caption.
 * @returns Its caption.
 */
function blockCaption(id: LevelMenuBlock["id"]): string {
  switch (id) {
    case "tutorial": {
      return t("tutorial.panel.label");
    }
    case "challenges": {
      return t("game.challenge.nav.label");
    }
    case "other": {
      return t("game.levelSwitcher.otherBlockLabel");
    }
  }
}

/**
 * One block's markup: its caption and its grid of tiles.
 *
 * @param block - Block to draw.
 * @returns The block's markup.
 */
function blockTemplate(block: LevelMenuBlock): string {
  const tiles = block.tiles.map((tile) => tileTemplate(tile)).join("");
  return markup`<div class="taskblock"><span class="cap">${blockCaption(block.id)}</span><div class="taskmenu-grid">${raw(tiles)}</div></div>`;
}

/**
 * Draws the switcher and wires it up.
 *
 * Called once, from wherever mounts this widget, and never again — every
 * redraw after the first goes through the returned presenter's `update()`.
 *
 * @param parent - The element {@link levelSwitcherTemplate}'s markup was
 * written into.
 * @param options - Where to read the menu from.
 * @returns The presenter, already drawn.
 */
export function presentLevelSwitcher(
  parent: HTMLElement,
  options: LevelSwitcherOptions,
): LevelSwitcherPresenter {
  const taskPrev = requireElement(".task-prev", parent);
  const taskOpen = requireElement(".task-open", parent);
  const taskName = requireElement(".task-name", parent);
  const taskNext = requireElement(".task-next", parent);
  const taskMenu = requireElement(".taskmenu", parent);
  const taskBlocks = requireElement(".taskblocks", parent);

  const disclosure = createDisclosure(taskOpen, taskMenu);

  let latestBlocks: readonly LevelMenuBlock[] = [];

  function goTo(href: string | undefined): void {
    if (href !== undefined) {
      taskOpen.ownerDocument.defaultView?.location.assign(href);
    }
  }

  taskPrev.addEventListener("click", () => {
    goTo(stepHref(latestBlocks, -1));
  });
  taskNext.addEventListener("click", () => {
    goTo(stepHref(latestBlocks, 1));
  });

  const presenter: LevelSwitcherPresenter = {
    update(): void {
      const blocks = buildLevelMenu(options.getInput());
      latestBlocks = blocks;

      // The grid is rebuilt from scratch below, which would otherwise drop
      // keyboard focus to <body> out from under a player tabbing through it —
      // the same problem, and the same fix, as `presentChallenge`'s own
      // navigation row in what was `src/ui/presenters.ts`: the tile that
      // replaces the one that was focused is the one in the same position,
      // so position is what is restored rather than the deleted node itself.
      const focusedTileIndex = queryAll(".tasklink", taskBlocks).findIndex(
        (tile) => tile === document.activeElement,
      );

      taskBlocks.replaceChildren(
        renderFragment(blocks.map((block) => blockTemplate(block)).join("")),
      );
      // A tile that navigates should not leave its menu open behind it — the
      // same close-before-`setWorld` order `renderTaskMenu`'s own click
      // handler keeps.
      for (const tile of queryAll(".tasklink", taskBlocks)) {
        tile.addEventListener("click", () => {
          disclosure.close();
        });
      }
      const focusedTile = queryAll(".tasklink", taskBlocks)[focusedTileIndex];
      if (focusedTile !== undefined) {
        focusedTile.focus();
      }

      const current = currentTile(blocks);
      taskName.textContent = current === undefined ? "" : tileTriggerName(current);

      const prevHref = stepHref(blocks, -1);
      const nextHref = stepHref(blocks, 1);
      taskPrev.setAttribute("aria-label", t("game.levelSwitcher.prevLabel"));
      taskNext.setAttribute("aria-label", t("game.levelSwitcher.nextLabel"));
      taskPrev.toggleAttribute("disabled", prevHref === undefined);
      taskNext.toggleAttribute("disabled", nextHref === undefined);
    },
  };
  presenter.update();
  return presenter;
}
