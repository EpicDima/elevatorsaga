/**
 * The app bar's level switcher: `design/ui-mockup.html`'s `.task` — a
 * current-level button that opens a popover of every level, plus a step
 * button either side of it. Ports `renderLevelMenu`, `neighbour` and
 * `updateLevelNav`, sitting on `#widgets/level-switcher/model/level-menu.ts`'s
 * {@link buildLevelMenu} for what to draw rather than the fixture the mockup
 * reads from.
 *
 * Follows `run-controls.ts`'s template-plus-presenter shape, not
 * `app-bar.ts`'s injected-labels one: the row there redraws five buttons
 * that never change which five they are, where this one's tiles gain, lose
 * and swap `current`/`cleared`/`tier` on every run that ends — so
 * {@link presentLevelSwitcher}'s `update()` reruns `buildLevelMenu` and
 * every `t()` call in it, the same as a language change would need anyway.
 *
 * Every tile is a real `<a href>`, because every level is open: the numbered
 * ones used to stay shut until the level before them was cleared, drawn as a
 * `<button disabled>` since an `<a>` has no true disabled state to fake. That
 * rule is gone, and one tag now covers every tile in every block.
 *
 * The grid is still rebuilt from scratch on every `update()`, unlike
 * `run-controls.ts`'s five buttons, which are only ever relabelled — matching
 * `design/ui-mockup.html`'s own `taskBlocks.innerHTML = ...`. A tile's
 * `href`, name, tier and current-ness all move together, and the set itself
 * grows when a block does, so rebuilding stays the honest read even now that
 * the tag never changes under it.
 *
 * Mounted live from `src/pages/game/index.ts` since Phase 12.2. A tile's
 * tier is carried both as a bare `data-tier` attribute on the tile itself,
 * for whatever styling a later CSS pass gives the tile as a whole, and as
 * `entities/level-tier`'s own
 * {@link tierBadgeMarkup} badge, for the stars a player actually reads —
 * every level tile gets one, dim stars included at zero earned,
 * matching `design/ui-mockup.html`'s `renderLevelMenu`.
 */

import {
  buildLevelMenu,
  type LevelMenuBlock,
  type LevelMenuInput,
  type LevelMenuTile,
} from "../model/level-menu.ts";
import { tierBadgeMarkup } from "#entities/level-tier/index.ts";
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
 * The root's class is `task`, not `level`, and that is load-bearing rather
 * than a leftover: every class in here is `level-switcher.css`'s, copied from
 * `design/ui-mockup.html` §3, and the root's own rule is what makes this
 * widget work at all. `.task` is the `position: relative` that `.taskmenu`'s
 * `position: absolute` measures its `top`/`left` from, and the `display: flex`
 * that lays the trigger and its two chevrons out as a row. Renaming it to
 * `level` — which the «уровень» sweep did, and this is the repair — costs
 * both: the chevrons stack into a column that the app bar clips away, and the
 * popover falls back to the initial containing block and opens a full page
 * below the fold, where clicking the trigger looks like it does nothing at
 * all. `level` is also already spoken for twice over — the goal bar's own
 * mount in `index.html` and every floor `floorTemplate` draws — so the sweep
 * did not just unstyle this root, it dropped it into two other widgets'
 * namespace. `level-switcher.test.ts` pins the root against a second
 * sweep, and `e2e/level-switcher.spec.ts` pins the popover's position on
 * screen against any other cause.
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
   * the tier a level earned, which levels are cleared and what is
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
   * Called after anything that could have moved any of that: a level
   * cleared, a tutorial level cleared, a run started elsewhere, a language
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
 * outside the level list.
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
 * Where a step button goes: the neighbouring tile in the current tile's own
 * block.
 *
 * Scoped to one block on purpose — stepping from the last tutorial level
 * straight into level one would cross two different kinds of level in
 * one press, which is not what either step button's arrow promises.
 *
 * The walk is a loop rather than a single index because it used to skip
 * locked tiles. Nothing is skipped now, so it stops on the first tile it
 * reaches; kept as a loop because the bounds check it already does is what
 * answers the end of a block, and an index arithmetic rewrite would have to
 * restate it.
 *
 * @param blocks - The menu to step within.
 * @param step - `-1` for the previous tile, `1` for the next.
 * @returns The neighbour's `href`, or `undefined` if there is none — nothing
 * is current, or the current tile is its block's first or last.
 */
function stepHref(blocks: readonly LevelMenuBlock[], step: -1 | 1): string | undefined {
  const block = blocks.find((candidate) => candidate.tiles.some((tile) => tile.current));
  if (block === undefined) {
    return undefined;
  }
  const from = block.tiles.findIndex((tile) => tile.current);
  for (let index = from + step; index >= 0 && index < block.tiles.length; index += step) {
    const tile = block.tiles[index];
    if (tile !== undefined) {
      return tile.href;
    }
  }
  return undefined;
}

/**
 * The text a tile shows in the grid — brief, since the accessible name in
 * {@link tileAccessibleName} carries the rest, the same split
 * `levelLinkTemplate` already draws between a nav link's visible label
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
    case "level": {
      return String(tile.number);
    }
    case "skyscraper": {
      return String(tile.number);
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * The name assistive technology reads for a tile — what {@link tileText}
 * shows plus whatever it left out: which level this is, and whether it is
 * cleared.
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
    case "level": {
      return t("game.level.nav.link", { number: tile.number });
    }
    case "skyscraper": {
      return t("game.levelSwitcher.skyscraperTileLabel", { number: tile.number });
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
 * borrow. That name is written for a tile in a grid, where ", completed" is
 * the tile's whole point, and the trigger is 118px wide —
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
 * menu still says whether it is cleared, which is where a player looks for
 * that.
 *
 * @param tile - The current tile.
 * @returns Its plain name.
 */
function tileTriggerName(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return t("game.levelSwitcher.tutorialTriggerLabel", { number: tile.number });
    }
    case "level": {
      return t("game.level.nav.link", { number: tile.number });
    }
    case "skyscraper": {
      return t("game.levelSwitcher.skyscraperTriggerLabel", { number: tile.number });
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * The tile markup: a real `<a href>`, always — see this module's own comment
 * for why there is no second tag any more.
 *
 * `aria-current` marks whichever tile
 * {@link "../model/level-menu.ts"!LevelMenuInput}'s `selection` names, whoever
 * chose it and by whatever route.
 *
 * @param tile - Tile to draw.
 * @returns The tile's markup.
 */
function tileTemplate(tile: LevelMenuTile): string {
  const text = tileText(tile);
  const name = tileAccessibleName(tile);
  const current = tile.current ? raw(' aria-current="page"') : raw("");
  // The two blocks of numbered levels are the medalled ones, and the badge is
  // drawn for every tile of both — empty stars for a level never cleared, which
  // is what makes the row read as a set of five slots to fill rather than as
  // marks appearing out of nowhere. Asked once, because the answer decides
  // three separate things below and asking it three times was already how the
  // `data-tier` attribute and the badge came to disagree about `undefined`.
  const medalled = tile.kind === "level" || tile.kind === "skyscraper";
  const earned = medalled ? tile.tier : undefined;
  const done = earned !== undefined || (tile.kind === "tutorial" && tile.cleared);
  const classes = [
    "tasklink",
    tile.kind === "sandbox" ? "is-free" : "",
    tile.current ? "is-current" : done ? "is-done" : "",
  ]
    .filter((className) => className !== "")
    .join(" ");
  const tier = earned === undefined ? raw("") : raw(` data-tier="${earned}"`);
  const badge = medalled ? raw(tierBadgeMarkup(earned)) : raw("");
  return markup`<a class="${classes}" href="${tile.href}" aria-label="${name}"${current}${tier}>${text}${badge}</a>`;
}

/**
 * A block's caption. The first two are `tutorial.panel.label` and
 * `game.level.nav.label`, rather than a second pair of "Levels"/"Tutorial"
 * strings a translator would have to keep in step with those. Both are named
 * after something that has since stopped saying them — the lesson card was
 * renamed after the level it teaches, and the row of level links went into this
 * popover — so this file is the only reader either of them has left.
 *
 * The Skyscraper block does get a string of its own rather than borrowing one:
 * its levels are described in the catalogue level by level, and no message
 * there names the block as a whole.
 *
 * The last has a string of its own too, and does not reuse the sandbox tile's:
 * captioning a block with the name of the single tile in it says the same
 * word twice and promises the block will only ever hold that one thing. It
 * says "Other" instead — what is left once the lessons and the two blocks of
 * numbered levels are accounted for.
 *
 * @param id - Block to caption.
 * @returns Its caption.
 */
function blockCaption(id: LevelMenuBlock["id"]): string {
  switch (id) {
    case "tutorial": {
      return t("tutorial.panel.label");
    }
    case "levels": {
      return t("game.level.nav.label");
    }
    case "skyscraper": {
      return t("game.levelSwitcher.skyscraperBlockLabel");
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
      // the same problem, and the same fix, as `presentLevel`'s own
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
      // same close-before-`setWorld` order `renderLevelMenu`'s own click
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
