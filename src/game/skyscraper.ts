/** Skyscraper block: levels modeled on real elevator dispatch strategies, each played on a pinned seed. */

import { t } from "../i18n/index.ts";
import {
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinMovesWithMaxWaitTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type LevelCondition,
} from "./levels.ts";
import {
  WINNING_IS_GOLD,
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
  type LevelTierRequirements,
} from "./level-tiers.ts";
import type { RandomSeed } from "./random.ts";
import type { WorldOptions } from "./world.ts";

/** One level of the Skyscraper block. */
export interface SkyscraperLevel {
  /** Stable identifier used for the address bar, saved programs, and medal records; not the array index. */
  readonly id: string;
  /** The building the level is played in. */
  readonly options: WorldOptions;
  /** The bar that decides the run, built with the level constructors. */
  readonly condition: LevelCondition;
  /** Silver and gold on top of the win/lose {@link condition}; `WINNING_IS_GOLD` on the demo levels, where clearing is the whole achievement. */
  readonly tiers: LevelTierRequirements;
  /** The seed this level is played on, pinned unlike levels 1-19. */
  readonly seed: RandomSeed;
  /** The program the editor opens with; required here since every level tests a mechanic the numbered levels don't. */
  readonly startingCode: string;
  /** Intro card for a level that introduces a new mechanic; omitted otherwise. */
  readonly card?: SkyscraperCard;
}

/** The name and the paragraph of a level that introduces something new. */
export interface SkyscraperCard {
  readonly title: string;
  /** The level's briefing paragraph, as catalog markup. */
  readonly briefing: string;
}

/**
 * Every level of the Skyscraper block, in the order they are played.
 *
 * `startingCode` and `card` are getters so they render in the active locale
 * when read, not frozen in whichever locale was active at import time.
 */
export const skyscraperLevels: readonly SkyscraperLevel[] = [
  /** Opening level: tall enough that a wasted trip costs far more than a wasted seat. */
  {
    id: "sky-1",
    options: { floorCount: 12, elevatorCount: 3, spawnRate: 1.2, elevatorCapacities: [8] },
    condition: requireUserCountWithinMoves(40, 170),
    tiers: WINNING_IS_GOLD,
    seed: 4,
    get startingCode(): string {
      return t("skyscraper.sky1.startingCode.code");
    },
  },
  /** Introduces the up-peak traffic profile: every passenger starts in the lobby going up. */
  {
    id: "sky-2",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 1.0,
      elevatorCapacities: [6],
      trafficProfile: "up-peak",
    },
    condition: requireUserCountWithinMoves(20, 60),
    tiers: WINNING_IS_GOLD,
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky2.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky2.title"),
        briefing: t("skyscraper.sky2.briefing.html"),
      };
    },
  },
  /**
   * Up-peak at scale, first level with medals. Gold needs both a move count and
   * an average wait time, since moves alone would reward holding every car in
   * the lobby until it fills.
   */
  {
    id: "sky-3",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [10],
      trafficProfile: "up-peak",
    },
    condition: requireUserCountWithinMoves(80, 300),
    tiers: {
      silver: underMoveCount(250),
      gold: requireAll(underMoveCount(220), underAvgWaitTime(17)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky3.startingCode.code");
    },
  },
  /** Introduces the down-peak traffic profile: the lobby is everyone's destination, not their origin. */
  {
    id: "sky-4",
    options: {
      floorCount: 12,
      elevatorCount: 2,
      spawnRate: 1.3,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
    },
    condition: requireUserCountWithinMoves(25, 125),
    tiers: WINNING_IS_GOLD,
    seed: 2,
    get startingCode(): string {
      return t("skyscraper.sky4.startingCode.code");
    },
  },
  /**
   * Down-peak at scale, scored on elapsed time and longest wait rather than
   * moves: a car that fills and skips a floor wastes no moves but still fails
   * that passenger.
   */
  {
    id: "sky-5",
    options: {
      floorCount: 14,
      elevatorCount: 3,
      spawnRate: 1.7,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
    },
    condition: requireUserCountWithinTimeWithMaxWaitTime(55, 80, 75),
    tiers: {
      silver: underElapsedTime(72),
      gold: requireAll(underElapsedTime(68), underMaxWaitTime(63)),
    },
    seed: 1,
    get startingCode(): string {
      return t("skyscraper.sky5.startingCode.code");
    },
  },
  /** Introduces the "lunch" traffic profile: demand runs both to and from the lobby in the same run. */
  {
    id: "sky-6",
    options: {
      floorCount: 9,
      elevatorCount: 2,
      spawnRate: 1.0,
      elevatorCapacities: [5],
      trafficProfile: "lunch",
    },
    condition: requireUserCountWithinMoves(20, 56),
    tiers: WINNING_IS_GOLD,
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky6.startingCode.code");
    },
  },
  /** Last traffic-profile level: "lunch" at scale, scored on moves with a wait cap on silver. */
  {
    id: "sky-7",
    options: {
      floorCount: 12,
      elevatorCount: 3,
      spawnRate: 1.4,
      elevatorCapacities: [8],
      trafficProfile: "lunch",
    },
    condition: requireUserCountWithinMoves(60, 210),
    tiers: {
      silver: requireAll(underMoveCount(190), underMaxWaitTime(70)),
      gold: underMoveCount(150),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky7.startingCode.code");
    },
  },
  /**
   * Introduces zoning: one car serves floors 0-4, the other 0 and 5-9. A call
   * lamp only lights once, so a car that ignores a floor never clears it and
   * that floor is stranded for the rest of the run. Scored on wait time, not
   * moves, since a stranded run stops moving rather than losing outright.
   */
  {
    id: "sky-8",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 0.8,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8, 9],
      ],
    },
    condition: requireUserCountWithMaxWaitTime(20, 35),
    tiers: WINNING_IS_GOLD,
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky8.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky8.title"),
        briefing: t("skyscraper.sky8.briefing.html"),
      };
    },
  },
  /**
   * Two zoned banks at scale, down-peak so calls originate upstairs where the
   * zones matter; under up-peak every call would come from the lobby, which
   * both banks serve, and the mechanic would be invisible.
   */
  {
    id: "sky-9",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [8],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [0, 8, 9, 10, 11, 12, 13, 14, 15],
      ],
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(60, 310, 85),
    tiers: {
      silver: underMaxWaitTime(70),
      gold: requireAll(underMaxWaitTime(65), underAvgWaitTime(16)),
    },
    seed: 2,
    get startingCode(): string {
      return t("skyscraper.sky9.startingCode.code");
    },
  },
  /**
   * Last zoned level, with overlapping banks: floors 6-8 are served by both, so
   * always favoring one bank for them creates an avoidable queue.
   */
  {
    id: "sky-10",
    options: {
      floorCount: 15,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [8],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [0, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      ],
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(60, 300, 75),
    tiers: {
      silver: underMaxWaitTime(60),
      gold: requireAll(underMoveCount(250), underAvgWaitTime(18)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky10.startingCode.code");
    },
  },
  /**
   * Introduces destination dispatch: no call buttons, so `takeRequest` is the
   * only way a passenger boards, and they board only the car booked for them.
   * Booking a journey without sending the car reads like progress but leaves
   * everyone waiting forever.
   */
  {
    id: "sky-11",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 0.8,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
      destinationDispatch: true,
    },
    condition: requireUserCountWithMaxWaitTime(20, 45),
    tiers: WINNING_IS_GOLD,
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky11.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky11.title"),
        briefing: t("skyscraper.sky11.briefing.html"),
      };
    },
  },
  /** Destination dispatch at scale: with delivery guaranteed, which car answers each call decides the score. */
  {
    id: "sky-12",
    options: {
      floorCount: 14,
      elevatorCount: 3,
      spawnRate: 1.4,
      elevatorCapacities: [8],
      trafficProfile: "lunch",
      destinationDispatch: true,
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(50, 330, 80),
    tiers: {
      silver: underMoveCount(200),
      gold: requireAll(underMoveCount(130), underAvgWaitTime(22)),
    },
    seed: 1,
    get startingCode(): string {
      return t("skyscraper.sky12.startingCode.code");
    },
  },
  /**
   * Last skyscraper level: up-peak destination dispatch, where every journey
   * starts at the lobby, so one car can be booked for several passengers going
   * the same way instead of one at a time.
   */
  {
    id: "sky-13",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [10],
      trafficProfile: "up-peak",
      destinationDispatch: true,
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(80, 340, 90),
    tiers: {
      silver: underMoveCount(170),
      gold: requireAll(underMoveCount(140), underAvgWaitTime(28)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky13.startingCode.code");
    },
  },
];
