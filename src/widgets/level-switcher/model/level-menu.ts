/**
 * What the level-switcher popover offers to open, grouped into blocks.
 *
 * A pure data-shaping step, deliberately without any DOM or player-facing
 * text: it composes {@link "#entities/level/index.ts"!listLevels}'s
 * ordering and {@link "#entities/level-tier/index.ts"} 's best-tier record
 * for the "Уровни" block; {@link "#game/tutorial.ts"!tutorialLevels} and
 * the caller's cleared-level record for the "Обучение" block; and a single
 * tile for free play. Every string a player reads — labels, tooltips,
 * accessible names — is built later, in this widget's own `ui/` layer, the
 * same division `listLevels` already keeps.
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
import type { TutorialLevel } from "#game/tutorial.ts";

/** What is being played right now, if any tile in this menu names it. */
export type LevelSelection =
  | { readonly kind: "level"; readonly index: number }
  | { readonly kind: "tutorial"; readonly index: number }
  | { readonly kind: "sandbox" };

/**
 * What a tile links to, for a caller's own `buildHref` to turn into a URL.
 *
 * Shaped after the three ways `src/pages/game/model/route.ts` reads the
 * `level` parameter: a one-based number, a level's own id (already
 * `tutorial-N`), or {@link "#pages/game/model/route.ts"!SANDBOX_LEVEL}.
 */
export type LevelLinkTarget =
  | { readonly kind: "level"; readonly number: number }
  | { readonly kind: "tutorial"; readonly levelId: string }
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

/** The single tile of the free-play block. */
export interface SandboxMenuTile {
  readonly kind: "sandbox";
  readonly current: boolean;
  readonly href: string;
}

/** One tile of the level-switcher menu, whichever block it belongs to. */
export type LevelMenuTile = NumberedMenuTile | TutorialMenuTile | SandboxMenuTile;

/**
 * One named group of tiles.
 *
 * The third id is `other` and not `sandbox`, though free play is the only
 * tile in it: the block is captioned «Остальное» / "Other" — everything that
 * is neither a lesson nor a numbered level — where the tile inside it is
 * captioned «Песочница» / "Sandbox". Two different words on screen, so two
 * different names here rather than one standing for both.
 */
export interface LevelMenuBlock {
  readonly id: "tutorial" | "levels" | "other";
  readonly tiles: readonly LevelMenuTile[];
}

/** Everything {@link buildLevelMenu} needs to assemble the menu. */
export interface LevelMenuInput {
  /** The numbered levels, in playing order — {@link "#game/levels.ts"!levels}. */
  readonly levels: readonly Level[];
  /** The learning track, in playing order — {@link "#game/tutorial.ts"!tutorialLevels}. */
  readonly tutorialLevels: readonly TutorialLevel[];
  /** This browser's best-recorded tier per level index. */
  readonly bestTiers: ReadonlyMap<number, LevelTier>;
  /** This browser's cleared learning-track level ids. */
  readonly clearedTutorialLevels: ReadonlySet<string>;
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
 * Groups every level this menu offers into its three blocks, in the order
 * they are shown: learning track, then numbered levels, then everything
 * else — which today is free play, and only free play.
 *
 * Three fixed calls rather than a config-driven loop over a block list: the
 * blocks differ in what they are built from and in what a tile of each
 * carries, so a registry here would need a case per block anyway. Adding a
 * fourth block later is one more function and one more line in the returned
 * array, not a redesign.
 *
 * @param input - What to show and, for each tile, where it links.
 * @returns The three blocks, in display order.
 */
export function buildLevelMenu(input: LevelMenuInput): readonly LevelMenuBlock[] {
  return [buildTutorialBlock(input), buildLevelBlock(input), buildOtherBlock(input)];
}
