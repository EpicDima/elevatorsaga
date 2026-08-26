/**
 * What the level-switcher popover offers to open, grouped into blocks — pure data shaping,
 * no DOM or player-facing text. Every tile here is open; a best tier is read only to draw a badge.
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
 * What a tile links to, for the caller's own `buildHref` to turn into a URL.
 * Track and Skyscraper stay separate variants, though both link by id: which block a tile
 * belongs to also decides which run a route starts and which record a win is written to.
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
 * One tile of the «Небоскрёб» block. Carries a `tier` rather than a `cleared` flag: a
 * demo level that grades nothing records gold on a win, so one field covers both cases.
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

/** Named group of tiles; the last block's id is `other`, not `sandbox`, since the block and its one tile have different captions. */
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
  /** Skyscraper block, in playing order — {@link "#game/skyscraper.ts"!skyscraperLevels}. */
  readonly skyscraperLevels: readonly SkyscraperLevel[];
  /** This browser's best-recorded tier per level index. */
  readonly bestTiers: ReadonlyMap<number, LevelTier>;
  /** This browser's cleared learning-track level ids. */
  readonly clearedTutorialLevels: ReadonlySet<string>;
  /**
   * This browser's best-recorded tier per Skyscraper level id. A second map, not more rows
   * in {@link LevelMenuInput.bestTiers}: the two are keyed differently and come from separate storage.
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

/** Groups every level this menu offers into its four blocks, in display order. */
export function buildLevelMenu(input: LevelMenuInput): readonly LevelMenuBlock[] {
  return [
    buildTutorialBlock(input),
    buildLevelBlock(input),
    buildSkyscraperBlock(input),
    buildOtherBlock(input),
  ];
}
