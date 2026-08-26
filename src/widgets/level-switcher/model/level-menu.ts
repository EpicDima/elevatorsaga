/**
 * What the level-switcher popover offers to open, grouped into blocks — pure data shaping,
 * no DOM or player-facing text. Every tile here is open; a best tier is read only to draw a badge.
 */

import { listLevels, type Level } from "#entities/level/index.ts";
import type { LevelTier } from "#entities/level-tier/index.ts";
import { TUTORIAL_CLEARED_TIER } from "#entities/tutorial-level/model/progress.ts";
import type { Chapter2Level } from "#game/chapter2.ts";
import type { TutorialLevel } from "#game/tutorial.ts";

/** What is being played right now, if any tile in this menu names it. */
export type LevelSelection =
  | { readonly kind: "chapter1"; readonly index: number }
  | { readonly kind: "tutorial"; readonly index: number }
  | { readonly kind: "chapter2"; readonly index: number }
  | { readonly kind: "sandbox" };

/**
 * What a tile links to, for the caller's own `buildHref` to turn into a URL.
 * Track and chapter two stay separate variants, though both link by id: which block a tile
 * belongs to also decides which run a route starts and which record a win is written to.
 */
export type LevelLinkTarget =
  | { readonly kind: "chapter1"; readonly number: number }
  | { readonly kind: "tutorial"; readonly levelId: string }
  | { readonly kind: "chapter2"; readonly levelId: string }
  | { readonly kind: "sandbox" };

/** One tile of chapter one. */
export interface Chapter1MenuTile {
  readonly kind: "chapter1";
  readonly index: number;
  readonly number: number;
  readonly current: boolean;
  /** This browser's best-recorded tier, or `undefined` if never cleared. */
  readonly tier: LevelTier | undefined;
  readonly href: string;
}

/** One tile of the learning block. */
export interface TutorialMenuTile {
  readonly kind: "tutorial";
  readonly index: number;
  readonly number: number;
  readonly current: boolean;
  /** Set once cleared; the track grades nothing, so gold is the only medal it hands out. */
  readonly tier: LevelTier | undefined;
  readonly href: string;
}

/** One tile of chapter two. */
export interface Chapter2MenuTile {
  readonly kind: "chapter2";
  readonly index: number;
  /** Continues chapter one's numbering: the first tile here is level `chapter1Levels.length + 1`. */
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
  Chapter1MenuTile | TutorialMenuTile | Chapter2MenuTile | SandboxMenuTile;

/** Named group of tiles; the last block's id is `other`, not `sandbox`, since the block and its one tile have different captions. */
export interface LevelMenuBlock {
  readonly id: "tutorial" | "chapter1" | "chapter2" | "other";
  readonly tiles: readonly LevelMenuTile[];
}

/** Everything {@link buildLevelMenu} needs to assemble the menu. */
export interface LevelMenuInput {
  /** Chapter one's levels, in playing order — {@link "#game/chapter1.ts"!chapter1Levels}. */
  readonly chapter1Levels: readonly Level[];
  /** The learning track, in playing order — {@link "#game/tutorial.ts"!tutorialLevels}. */
  readonly tutorialLevels: readonly TutorialLevel[];
  /** Chapter two's levels, in playing order — {@link "#game/chapter2.ts"!chapter2Levels}. */
  readonly chapter2Levels: readonly Chapter2Level[];
  /** This browser's best-recorded tier per chapter one level index. */
  readonly bestChapter1Tiers: ReadonlyMap<number, LevelTier>;
  /** This browser's cleared learning-track level ids. */
  readonly clearedTutorialLevels: ReadonlySet<string>;
  /**
   * This browser's best-recorded tier per chapter two level id. A second map, not more rows
   * in {@link LevelMenuInput.bestChapter1Tiers}: the two are keyed differently and come from separate storage.
   */
  readonly bestChapter2Tiers: ReadonlyMap<string, LevelTier>;
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
      tier: input.clearedTutorialLevels.has(level.id) ? TUTORIAL_CLEARED_TIER : undefined,
      href: input.buildHref({ kind: "tutorial", levelId: level.id }),
    })),
  };
}

function buildChapter1Block(input: LevelMenuInput): LevelMenuBlock {
  return {
    id: "chapter1",
    tiles: listLevels(input.chapter1Levels).map((summary) => ({
      kind: "chapter1",
      index: summary.index,
      number: summary.number,
      current: input.selection.kind === "chapter1" && input.selection.index === summary.index,
      tier: input.bestChapter1Tiers.get(summary.index),
      href: input.buildHref({ kind: "chapter1", number: summary.number }),
    })),
  };
}

function buildChapter2Block(input: LevelMenuInput): LevelMenuBlock {
  const chapterOneLength = input.chapter1Levels.length;
  return {
    id: "chapter2",
    tiles: input.chapter2Levels.map((level, index) => ({
      kind: "chapter2",
      index,
      // Chapter two carries on chapter one's count, so no two tiles in the menu
      // are called level {number}; `index` still addresses `chapter2Levels`.
      number: chapterOneLength + index + 1,
      current: input.selection.kind === "chapter2" && input.selection.index === index,
      tier: input.bestChapter2Tiers.get(level.id),
      href: input.buildHref({ kind: "chapter2", levelId: level.id }),
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
    buildChapter1Block(input),
    buildChapter2Block(input),
    buildOtherBlock(input),
  ];
}
