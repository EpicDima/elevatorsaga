/**
 * What the level-switcher popover offers to open, grouped into blocks.
 *
 * A pure data-shaping step, deliberately without any DOM or player-facing
 * text: it composes {@link "#entities/level/index.ts"!listLevels}'s
 * ordering and {@link "#entities/level-tier/index.ts"} 's best-tier record
 * for the "Уровни" block; {@link "#game/tutorial.ts"!tutorialLevels} and
 * the caller's cleared-level record for the "Обучение" block;
 * {@link "#game/skyscraper.ts"!skyscraperLevels} and its own best-tier record
 * for the «Небоскрёб» block; and a single tile for free play. Every string a
 * player reads — labels, tooltips, accessible names — is built later, in this
 * widget's own `ui/` layer, the same division `listLevels` already keeps.
 *
 * Every tile here is open. Nothing in this menu is ever refused, in any
 * block: the numbered levels used to shut until the one before them was
 * cleared, and that rule is gone — the learning track's own documented "the
 * track locks nothing" (see
 * {@link "#entities/tutorial-level/model/progress.ts"}) is now the whole
 * game's rule. A best tier is still read, but only to draw a badge.
 *
 * Building a real URL is not this module's job either: even now that
 * `createParamsUrl` is reachable — it lives in `src/shared/lib/route-query.ts`,
 * not behind any boundary rule this widget cannot cross — nothing here holds
 * the *current* query to build one from; that stays app state, owned above
 * this module. So a caller supplies `buildHref`, and this module only ever
 * describes *what* a tile links to, through {@link LevelLinkTarget}, never the
 * link itself.
 */

import { listLevels, type Level } from "#entities/level/index.ts";
import type { LevelTier } from "#entities/level-tier/index.ts";
import type { SkyscraperLevel } from "#game/skyscraper.ts";
import type { TutorialLevel } from "#game/tutorial.ts";

/** What is being played right now, if any tile in this menu names it. */
export type LevelSelection =
  | { readonly kind: "level"; readonly index: number }
  | { readonly kind: "tutorial"; readonly index: number }
  | { readonly kind: "skyscraper"; readonly index: number }
  | { readonly kind: "sandbox" };

/**
 * What a tile links to, for a caller's own `buildHref` to turn into a URL.
 *
 * Shaped after the four ways `src/pages/game/model/route.ts` reads the
 * `level` parameter: a one-based number, a level's own id (already `tutorial-N`
 * or `sky-N`), or {@link "#pages/game/model/route.ts"!SANDBOX_LEVEL}.
 *
 * The track and the Skyscraper block both link by id and are still two
 * variants rather than one `{ kind: "namedLevel"; levelId }`. The id is not the
 * only thing a caller does with the answer: `App.#levelHref` builds the same
 * URL for both today, but a block is also what decides which run a route starts
 * and which record a win is written to, and collapsing the two here would put
 * that decision back on parsing the id's prefix at every call site.
 */
export type LevelLinkTarget =
  | { readonly kind: "level"; readonly number: number }
  | { readonly kind: "tutorial"; readonly levelId: string }
  | { readonly kind: "skyscraper"; readonly levelId: string }
  | { readonly kind: "sandbox" };

/** One tile of the "Уровни" block. */
export interface NumberedMenuTile {
  readonly kind: "level";
  readonly index: number;
  readonly number: number;
  readonly current: boolean;
  /** This browser's best-recorded tier, or `undefined` if never cleared. */
  readonly tier: LevelTier | undefined;
  readonly href: string;
}

/** One tile of the "Обучение" block. */
export interface TutorialMenuTile {
  readonly kind: "tutorial";
  readonly index: number;
  readonly number: number;
  readonly current: boolean;
  readonly cleared: boolean;
  readonly href: string;
}

/**
 * One tile of the «Небоскрёб» block.
 *
 * Carries a `tier` like a numbered level rather than a `cleared` flag like a
 * lesson, because the block holds both kinds of level and this is the field
 * that covers both: a scored level records the medal it earned, and a short
 * demonstrating level — one that declares no `tiers` — records bronze on a win,
 * which is what "cleared" means for it. One field, one badge, no second way of
 * saying the same thing.
 */
export interface SkyscraperMenuTile {
  readonly kind: "skyscraper";
  readonly index: number;
  readonly number: number;
  readonly current: boolean;
  /** This browser's best-recorded tier, or `undefined` if never cleared. */
  readonly tier: LevelTier | undefined;
  readonly href: string;
}

/** The single tile of the free-play block. */
export interface SandboxMenuTile {
  readonly kind: "sandbox";
  readonly current: boolean;
  readonly href: string;
}

/** One tile of the level-switcher menu, whichever block it belongs to. */
export type LevelMenuTile =
  NumberedMenuTile | TutorialMenuTile | SkyscraperMenuTile | SandboxMenuTile;

/**
 * One named group of tiles.
 *
 * The last id is `other` and not `sandbox`, though free play is the only
 * tile in it: the block is captioned «Остальное» / "Other" — everything that
 * is neither a lesson nor a level of either numbered block — where the tile
 * inside it is captioned «Песочница» / "Sandbox". Two different words on
 * screen, so two different names here rather than one standing for both.
 */
export interface LevelMenuBlock {
  readonly id: "tutorial" | "levels" | "skyscraper" | "other";
  readonly tiles: readonly LevelMenuTile[];
}

/** Everything {@link buildLevelMenu} needs to assemble the menu. */
export interface LevelMenuInput {
  /** The numbered levels, in playing order — {@link "#game/levels.ts"!levels}. */
  readonly levels: readonly Level[];
  /** The learning track, in playing order — {@link "#game/tutorial.ts"!tutorialLevels}. */
  readonly tutorialLevels: readonly TutorialLevel[];
  /**
   * The Skyscraper block, in playing order —
   * {@link "#game/skyscraper.ts"!skyscraperLevels}.
   */
  readonly skyscraperLevels: readonly SkyscraperLevel[];
  /** This browser's best-recorded tier per level index. */
  readonly bestTiers: ReadonlyMap<number, LevelTier>;
  /** This browser's cleared learning-track level ids. */
  readonly clearedTutorialLevels: ReadonlySet<string>;
  /**
   * This browser's best-recorded tier per Skyscraper level id.
   *
   * A second map rather than more rows in {@link LevelMenuInput.bestTiers},
   * because the two are keyed differently on purpose — a numbered level by its
   * position, a Skyscraper level by its id — and they come from two storage
   * keys that know nothing about each other.
   */
  readonly bestSkyscraperTiers: ReadonlyMap<string, LevelTier>;
  /** What is being played right now, if anything this menu offers is. */
  readonly selection: LevelSelection;
  /** Turns a tile's {@link LevelLinkTarget} into the URL it links to. */
  readonly buildHref: (target: LevelLinkTarget) => string;
}

function buildTutorialBlock(input: LevelMenuInput): LevelMenuBlock {
  return {
    id: "tutorial",
    tiles: input.tutorialLevels.map((level, index) => ({
      kind: "tutorial",
      index,
      number: index + 1,
      current: input.selection.kind === "tutorial" && input.selection.index === index,
      cleared: input.clearedTutorialLevels.has(level.id),
      href: input.buildHref({ kind: "tutorial", levelId: level.id }),
    })),
  };
}

function buildLevelBlock(input: LevelMenuInput): LevelMenuBlock {
  return {
    id: "levels",
    tiles: listLevels(input.levels).map((summary) => ({
      kind: "level",
      index: summary.index,
      number: summary.number,
      current: input.selection.kind === "level" && input.selection.index === summary.index,
      tier: input.bestTiers.get(summary.index),
      href: input.buildHref({ kind: "level", number: summary.number }),
    })),
  };
}

function buildSkyscraperBlock(input: LevelMenuInput): LevelMenuBlock {
  return {
    id: "skyscraper",
    tiles: input.skyscraperLevels.map((level, index) => ({
      kind: "skyscraper",
      index,
      number: index + 1,
      current: input.selection.kind === "skyscraper" && input.selection.index === index,
      tier: input.bestSkyscraperTiers.get(level.id),
      href: input.buildHref({ kind: "skyscraper", levelId: level.id }),
    })),
  };
}

function buildOtherBlock(input: LevelMenuInput): LevelMenuBlock {
  return {
    id: "other",
    tiles: [
      {
        kind: "sandbox",
        current: input.selection.kind === "sandbox",
        href: input.buildHref({ kind: "sandbox" }),
      },
    ],
  };
}

/**
 * Groups every level this menu offers into its four blocks, in the order
 * they are shown: learning track, then numbered levels, then the Skyscraper
 * block, then everything else — which today is free play, and only free play.
 *
 * Four fixed calls rather than a config-driven loop over a block list: the
 * blocks differ in what they are built from and in what a tile of each
 * carries, so a registry here would need a case per block anyway. The
 * Skyscraper block was the fourth, and it cost exactly what this comment used
 * to promise a fourth block would — one more function and one more line here.
 *
 * The Skyscraper block sits after the numbered levels rather than before them
 * because it is the part of the game a player reaches last: the numbered
 * nineteen are the original game and the ones a returning player is looking
 * for, and a new block wedged above them would move every tile they know.
 *
 * @param input - What to show and, for each tile, where it links.
 * @returns The four blocks, in display order.
 */
export function buildLevelMenu(input: LevelMenuInput): readonly LevelMenuBlock[] {
  return [
    buildTutorialBlock(input),
    buildLevelBlock(input),
    buildSkyscraperBlock(input),
    buildOtherBlock(input),
  ];
}
