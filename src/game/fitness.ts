/**
 * Headless benchmark suite: runs player code through fixed scenarios and
 * seeds, without drawing anything, and averages the results.
 */

import { t } from "../i18n/index.ts";
import type { LevelCondition } from "./levels.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorld, type WorldOptions } from "./world.ts";
import { TICK_SECONDS, createWorldController, type UserCodeObject } from "./world-controller.ts";

/** World options for a fitness scenario, with a label for the report. */
export interface FitnessLevelOptions extends WorldOptions {
  /** Scenario name shown in the results, already rendered text (not a message key). */
  description: string;
}

/** One headless benchmark scenario. */
export interface FitnessLevel {
  readonly options: FitnessLevelOptions;
  /** Unused by the benchmark, kept to mirror the level shape. */
  readonly condition: LevelCondition;
}

/** Metrics gathered from a single simulation. */
export type FitnessResult = {
  /** Whatever the player code threw, if anything. */
  error?: unknown;
  /** Passengers delivered per simulated second. */
  transportedPerSec?: number;
  /** Mean spawn-to-delivery time of delivered passengers, the ride included. */
  avgWaitTime?: number;
  /**
   * Mean spawn-to-boarding time. `maxWaitTime` and `maxPickupTime` are
   * deliberately omitted: averaging maxima across seeds gives neither a
   * maximum nor a typical figure.
   */
  avgPickupTime?: number;
  /** Passengers delivered. */
  transportedCount?: number;
  /** How full the cars were, averaged over every floor they crossed. */
  avgLoadFactorOnMove?: number;
};

/** One scenario's outcome. */
export interface FitnessRun {
  readonly options: FitnessLevelOptions;
  readonly result: FitnessResult;
}

/** One scenario's outcome, averaged over every seed the suite ran it on. */
export interface AveragedFitnessRun {
  readonly options: FitnessLevelOptions;
  /** Averaged metrics, keyed as in {@link FitnessResult}. */
  readonly result: Record<string, number>;
}

/** What {@link doFitnessSuite} reports back. */
export type FitnessSuiteResult = AveragedFitnessRun[] | { error: string };

/** A condition that never resolves; the benchmark scenarios cannot be lost. */
export function requireNothing(): LevelCondition {
  return {
    description: "No requirement",
    evaluate(): boolean | null {
      return null;
    },
    requirements: [],
  };
}

/**
 * The three benchmark scenarios, in report order. A function rather than a
 * constant so the scenario names are localized at call time, not frozen at
 * module import time.
 */
export function fitnessLevels(): readonly FitnessLevel[] {
  return [
    {
      options: {
        description: t("fitness.scenario.small"),
        floorCount: 4,
        elevatorCount: 2,
        spawnRate: 0.6,
      },
      condition: requireNothing(),
    },
    {
      options: {
        description: t("fitness.scenario.medium"),
        floorCount: 6,
        elevatorCount: 3,
        spawnRate: 1.5,
        elevatorCapacities: [5],
      },
      condition: requireNothing(),
    },
    {
      options: {
        description: t("fitness.scenario.large"),
        floorCount: 18,
        elevatorCount: 6,
        spawnRate: 1.9,
        elevatorCapacities: [8],
      },
      condition: requireNothing(),
    },
  ];
}

/**
 * Seeds for the worlds every benchmark run is scored on. Fixed so two
 * programs measured against this list meet the same passengers; changing the
 * list or its length changes every benchmark's cost and results.
 */
export const fitnessSeeds: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6];

/** Simulated seconds per scenario; divided by {@link TICK_SECONDS} for the tick count. */
const BENCHMARK_SECONDS = 200;

/** Reads `arr[index]`, throwing a {@link RangeError} if it doesn't exist. */
function requireAt<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new RangeError(`Missing fitness result at index ${String(index)}`);
  }
  return value;
}

function stringifyError(value: unknown): string {
  return String(value);
}

/**
 * Runs one scenario headlessly and returns its metrics, or the error the code
 * threw. Two runs with the same `seed` see the same passengers, so they are
 * comparable.
 */
export function calculateFitness(
  level: FitnessLevel,
  codeObj: UserCodeObject,
  stepSize: number,
  stepsToSimulate: number,
  seed?: RandomSeed,
): FitnessResult {
  // TICK_SECONDS is seconds; stepSize (below) is milliseconds.
  const controller = createWorldController(TICK_SECONDS);
  // Nothing draws a scored run, and the figures below come from `stats_changed`,
  // which a tick raises whether or not the display is kept current.
  controller.updatesDisplay = false;
  const result: FitnessResult = {};

  const world = createWorld(level.options, seed);
  const frameRequester = createFrameRequester(stepSize);

  controller.on("usercode_error", (e) => {
    result.error = e;
  });
  world.on("stats_changed", () => {
    result.transportedPerSec = world.transportedPerSec;
    result.avgWaitTime = world.avgWaitTime;
    result.avgPickupTime = world.avgPickupTime;
    result.transportedCount = world.transportedCounter;
    result.avgLoadFactorOnMove = world.avgLoadFactorOnMove;
  });

  controller.start(world, codeObj, frameRequester.register, true);

  for (let stepCount = 0; stepCount < stepsToSimulate && !controller.isPaused; stepCount++) {
    frameRequester.trigger();
  }
  return result;
}

/**
 * Averages the same scenario's results across runs, property by property. A
 * non-numeric property averages to `NaN`.
 *
 * @throws {RangeError} When `results` is empty.
 */
export function makeAverageResult(results: readonly FitnessRun[]): AveragedFitnessRun {
  const first = requireAt(results, 0);
  const averagedResult: Record<string, number> = {};
  for (const resultProperty of Object.keys(first.result)) {
    const sum = results.reduce((acc, run) => {
      const record: Record<string, unknown> = run.result;
      return acc + Number(record[resultProperty]);
    }, 0);
    averagedResult[resultProperty] = sum / results.length;
  }
  return { options: first.options, result: averagedResult };
}

/**
 * Benchmarks player code across every scenario, once per seed, and averages
 * the results. `seeds` defaults to {@link fitnessSeeds}.
 *
 * @throws {RangeError} When `seeds` is empty.
 */
export function doFitnessSuite(
  codeStr: string,
  seeds: readonly RandomSeed[] = fitnessSeeds,
): FitnessSuiteResult {
  let codeObj: UserCodeObject;
  try {
    codeObj = getCodeObjFromCode(codeStr);
  } catch (e) {
    return { error: stringifyError(e) };
  }
  // Boxed rather than bare, since `undefined` is itself a value a program can throw.
  let failure: { readonly thrown: unknown } | undefined = undefined;

  // Computed once so every seed scores the same three scenario objects.
  const levels = fitnessLevels();

  const testruns: FitnessRun[][] = [];
  for (const seed of seeds) {
    const results: FitnessRun[] = [];
    for (const level of levels) {
      const fitness = calculateFitness(
        level,
        codeObj,
        1000 * TICK_SECONDS,
        BENCHMARK_SECONDS / TICK_SECONDS,
        seed,
      );
      // Checks whether `error` was set, not its truthiness — a falsy throw
      // (`0`, `null`, `""`) still has to count as a failure.
      if (Object.hasOwn(fitness, "error")) {
        failure = { thrown: fitness.error };
        continue;
      }
      results.push({ options: level.options, result: fitness });
    }
    if (failure !== undefined) {
      continue;
    }
    testruns.push(results);
  }
  if (failure !== undefined) {
    return { error: stringifyError(failure.thrown) };
  }

  const firstRun = requireAt(testruns, 0);
  return firstRun.map((_unused, n) => makeAverageResult(testruns.map((tr) => requireAt(tr, n))));
}
