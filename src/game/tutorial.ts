/**
 * Tutorial track: eight levels, each a building tuned so one particular wrong
 * program loses and one particular right program wins with room to spare.
 * `tutorial-solutions.test.ts` replays both on ten seeds to hold the gap.
 */

import { t } from "../i18n/index.ts";
import {
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinTime,
  type LevelCondition,
} from "./levels.ts";
import { WINNING_IS_GOLD, type LevelTierRequirements } from "./level-tiers.ts";
import type { RandomSeed } from "./random.ts";
import type { WorldOptions } from "./world.ts";

/**
 * One level: a building, a bar, the starting program, and the solution.
 * `solutionCode` doubles as the last hint and the fixture the solutions test
 * replays, so the two can never drift apart.
 */
export interface TutorialLevel {
  /** Stable identifier used for the address bar, saved programs, and progress; not the array index. */
  readonly id: string;
  /** The building the level is played in. */
  readonly options: WorldOptions;
  /** The bar that decides the run, built with the level constructors. */
  readonly condition: LevelCondition;
  /** Always `WINNING_IS_GOLD`: the track grades nothing, and its progress is a cleared flag rather than a medal. Present so a track level stays a {@link "./levels.ts"!Level}. */
  readonly tiers: LevelTierRequirements;
  /** The seed the mistake reliably loses and the fix reliably wins on; played until the player picks one of their own. */
  readonly seed: RandomSeed;
  /** The program the editor opens with; contains the mistake to find. */
  readonly startingCode: string;
  /** The program that wins; shown as the last hint. */
  readonly solutionCode: string;
}

/**
 * Every level of the learning track, in the order they are played.
 *
 * `startingCode` and `solutionCode` are getters so they render in the active
 * locale when read, not frozen in whichever locale was active at import time.
 */
export const tutorialLevels: readonly TutorialLevel[] = [
  /** Level 1: the elevator only ever visits one of the two floors, so it delivers nobody. */
  {
    id: "tutorial-1",
    options: { floorCount: 2, elevatorCount: 1, spawnRate: 0.5 },
    condition: requireUserCountWithinTime(10, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-1",
    get startingCode(): string {
      return t("tutorial.level1.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level1.solutionCode.code");
    },
  },
  /** Level 2: no event handlers are registered, so nothing ever happens. */
  {
    id: "tutorial-2",
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.5 },
    condition: requireUserCountWithinTime(15, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-2",
    get startingCode(): string {
      return t("tutorial.level2.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level2.solutionCode.code");
    },
  },
  /** Level 3: passengers board but the car never listens to their floor requests. */
  {
    id: "tutorial-3",
    options: { floorCount: 4, elevatorCount: 1, spawnRate: 0.6 },
    condition: requireUserCountWithinTime(15, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-3",
    get startingCode(): string {
      return t("tutorial.level3.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level3.solutionCode.code");
    },
  },
  /** Level 4: `destinationQueue` is filled but the car is never told to act on it. */
  {
    id: "tutorial-4",
    options: { floorCount: 4, elevatorCount: 1, spawnRate: 0.8 },
    condition: requireUserCountWithinTime(15, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-4",
    get startingCode(): string {
      return t("tutorial.level4.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level4.solutionCode.code");
    },
  },
  /**
   * Level 5: a working sweep, slow because most stops are empty; scored on wait
   * time since a wasted stop costs whoever is still waiting. The sweep also
   * wins on one of ten measured seeds, a recorded exception in the solutions test.
   */
  {
    id: "tutorial-5",
    options: { floorCount: 9, elevatorCount: 1, spawnRate: 0.2 },
    condition: requireUserCountWithMaxWaitTime(15, 37),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-5",
    get startingCode(): string {
      return t("tutorial.level5.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level5.solutionCode.code");
    },
  },
  /** Level 6: direction indicators are hardcoded, so passengers going the other way refuse to board. */
  {
    id: "tutorial-6",
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.25 },
    condition: requireUserCountWithMaxWaitTime(15, 28),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-6",
    get startingCode(): string {
      return t("tutorial.level6.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level6.solutionCode.code");
    },
  },
  /** Level 7: two elevators, one of which is never dispatched. */
  {
    id: "tutorial-7",
    options: { floorCount: 6, elevatorCount: 2, spawnRate: 1.2 },
    condition: requireUserCountWithinTime(28, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-7",
    get startingCode(): string {
      return t("tutorial.level7.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level7.solutionCode.code");
    },
  },
  /**
   * Level 8: an empty program in level 1's building, the graduation exercise.
   * The answer is level 7's solution, kept under this level's own key so every
   * level owns its messages independently; `tutorial.test.ts` holds them equal.
   */
  {
    id: "tutorial-8",
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requireUserCountWithinTime(15, 60),
    tiers: WINNING_IS_GOLD,
    seed: "tutorial-8",
    get startingCode(): string {
      return t("tutorial.level8.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level8.solutionCode.code");
    },
  },
];
