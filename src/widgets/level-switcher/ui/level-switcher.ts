/**
 * App bar's level switcher: a current-level trigger that opens a popover grid
 * of every level, plus a step button either side of it.
 */

import {
  buildLevelMenu,
  type LevelMenuBlock,
  type LevelMenuInput,
  type LevelMenuTile,
} from "../model/level-menu.ts";
import { TIER_NAME_KEY, tierBadgeMarkup } from "#entities/level-tier/index.ts";
import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { createDisclosure } from "#shared/ui/disclosure.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderFragment } from "#shared/ui/markup.ts";

/**
 * Inert skeleton: step buttons, trigger, and an empty popover for `update()` to fill.
 * The root's class must stay `task` — `level-switcher.css` positions `.taskmenu` relative to it.
 */
export function levelSwitcherTemplate(): string {
  return markup`<div class="task"><button type="button" class="task-prev">${raw(spriteIconMarkup("left"))}</button><button type="button" class="task-open" aria-haspopup="true" aria-expanded="false"><b class="task-name"></b></button><button type="button" class="task-next">${raw(spriteIconMarkup("right"))}</button><div class="taskmenu" hidden><div class="taskblocks"></div></div></div>`;
}

/** What the switcher needs in order to draw and redraw itself. */
export interface LevelSwitcherOptions {
  /** Builds a fresh {@link LevelMenuInput}; called anew on every `update()`. */
  readonly getInput: () => LevelMenuInput;
}

/** The drawn switcher. */
export interface LevelSwitcherPresenter {
  /** Rebuilds the tile grid and relabels the trigger and step buttons. */
  update(): void;
}

/** Finds the tile marked current in the menu, or `undefined` if none is. */
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
 * Neighboring tile's href within the current tile's own block — scoped to one
 * block so stepping never crosses into a different kind of level.
 * @param step - `-1` for the previous tile, `1` for the next.
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

/** Visible tile text: a bare number, since the grid tiles are small squares. */
function tileText(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return String(tile.number);
    }
    case "level": {
      return String(tile.number);
    }
    case "chapter2": {
      return String(tile.number);
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * Accessible name for a tile: level identity plus progress state.
 * Only an earned tier is named — an unearned badge is empty slots, not a fact to announce.
 */
function tileAccessibleName(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return tile.tier === undefined
        ? t("game.levelSwitcher.tutorialTileLabel", { number: tile.number })
        : t("game.levelSwitcher.tutorialTileEarnedLabel", {
            number: tile.number,
            tier: t(TIER_NAME_KEY[tile.tier]),
          });
    }
    // Both chapters share one run of numbers, so a tile of either is named the same way.
    case "level":
    case "chapter2": {
      return tile.tier === undefined
        ? t("game.level.nav.link", { number: tile.number })
        : t("game.levelSwitcher.levelTileEarnedLabel", {
            number: tile.number,
            tier: t(TIER_NAME_KEY[tile.tier]),
          });
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/**
 * Trigger label: just the level's name, deliberately not {@link tileAccessibleName} —
 * the trigger is too narrow for that longer text to fit without truncating.
 */
function tileTriggerName(tile: LevelMenuTile): string {
  switch (tile.kind) {
    case "tutorial": {
      return t("game.levelSwitcher.tutorialTriggerLabel", { number: tile.number });
    }
    case "level":
    case "chapter2": {
      return t("game.level.nav.link", { number: tile.number });
    }
    case "sandbox": {
      return t("game.levelSwitcher.sandboxLabel");
    }
  }
}

/** Tile markup: a real `<a href>`, with `aria-current` on the selected tile. */
function tileTemplate(tile: LevelMenuTile): string {
  const text = tileText(tile);
  const name = tileAccessibleName(tile);
  const current = tile.current ? raw(' aria-current="page"') : raw("");
  // Computed once so `data-tier` and the badge below can't disagree about `undefined`.
  const medalled = tile.kind !== "sandbox";
  const earned = medalled ? tile.tier : undefined;
  const done = earned !== undefined;
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

/** Caption for a block; the two blocks of levels are chapters one and two of the same count. */
function blockCaption(id: LevelMenuBlock["id"]): string {
  switch (id) {
    case "tutorial": {
      return t("game.levelSwitcher.tutorialBlockLabel");
    }
    case "levels": {
      return t("game.levelSwitcher.chapterBlockLabel", { number: 1 });
    }
    case "chapter2": {
      return t("game.levelSwitcher.chapterBlockLabel", { number: 2 });
    }
    case "other": {
      return t("game.levelSwitcher.otherBlockLabel");
    }
  }
}

function blockTemplate(block: LevelMenuBlock): string {
  const tiles = block.tiles.map((tile) => tileTemplate(tile)).join("");
  return markup`<div class="taskblock"><span class="cap">${blockCaption(block.id)}</span><div class="taskmenu-grid">${raw(tiles)}</div></div>`;
}

/** Draws the switcher and wires it up; call once — later redraws go through the returned presenter. */
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

      // Rebuilding the grid below would drop focus to <body>; restore it by position.
      const focusedTileIndex = queryAll(".tasklink", taskBlocks).findIndex(
        (tile) => tile === document.activeElement,
      );

      taskBlocks.replaceChildren(
        renderFragment(blocks.map((block) => blockTemplate(block)).join("")),
      );
      // A tile that navigates should not leave its menu open behind it.
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
