/**
 * Headless benchmark suite: runs player code through a few scenarios without
 * drawing anything and averages the results.
 *
 * Ported from the logic half of the legacy `fitness.js`. The web-worker wiring
 * that used to live here (`fitnessSuite` and `fitnessworker.js`) is now
 * `src/app/fitness.ts` and `src/app/fitness-worker.ts`; {@link doFitnessSuite}
 * is called from both (`src/app/fitness-worker.ts:25` inside the worker, and
 * `src/app/fitness.ts:84` on the main thread when a worker cannot be spawned).
 */

import type { ChallengeCondition } from "./challenges.ts";
import { createFrameRequester } from "./frame-requester.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorld, type WorldOptions } from "./world.ts";
import { createWorldController, type UserCodeObject } from "./world-controller.ts";

/** World options for a fitness scenario, with a label for the report. */
export interface FitnessChallengeOptions extends WorldOptions {
  /** Scenario name shown in the results. */
  description: string;
}

/** One headless benchmark scenario. */
export interface FitnessChallenge {
  /** World options the scenario runs with. */
  readonly options: FitnessChallengeOptions;
  /** Unused by the benchmark, kept to mirror the challenge shape. */
  readonly condition: ChallengeCondition;
}

/**
 * Metrics gathered from a single simulation.
 *
 * Declared as a type alias rather than an interface so it keeps the implicit
 * index signature {@link makeAverageResult} needs to iterate it generically,
 * the way the legacy `_.forOwn` did.
 */
export type FitnessResult = {
  /** Whatever the player code threw, if anything. */
  error?: unknown;
  /** Passengers delivered per simulated second. */
  transportedPerSec?: number;
  /** Mean wait time of delivered passengers. */
  avgWaitTime?: number;
  /** Passengers delivered. */
  transportedCount?: number;
};

/** One scenario's outcome. */
export interface FitnessRun {
  /** The scenario that produced it. */
  readonly options: FitnessChallengeOptions;
  /** The metrics gathered. */
  readonly result: FitnessResult;
}

/** One scenario's outcome, averaged over several runs. */
export interface AveragedFitnessRun {
  /** The scenario that produced it. */
  readonly options: FitnessChallengeOptions;
  /** The averaged metrics, keyed as in {@link FitnessResult}. */
  readonly result: Record<string, number>;
}

/** What {@link doFitnessSuite} reports back. */
export type FitnessSuiteResult = AveragedFitnessRun[] | { error: string };

/**
 * A condition that never resolves; the benchmark scenarios cannot be lost.
 *
 * @returns The condition.
 */
export function requireNothing(): ChallengeCondition {
  return {
    description: "No requirement",
    evaluate(): boolean | null {
      return null;
    },
  };
}

/** The scenarios every benchmark run goes through. */
export const fitnessChallenges: readonly FitnessChallenge[] = [
  {
    options: { description: "Small scenario", floorCount: 4, elevatorCount: 2, spawnRate: 0.6 },
    condition: requireNothing(),
  },
  {
    options: {
      description: "Medium scenario",
      floorCount: 6,
      elevatorCount: 3,
      spawnRate: 1.5,
      elevatorCapacities: [5],
    },
    condition: requireNothing(),
  },
  {
    options: {
      description: "Large scenario",
      floorCount: 18,
      elevatorCount: 6,
      spawnRate: 1.9,
      elevatorCapacities: [8],
    },
    condition: requireNothing(),
  },
];

/**
 * Largest simulated step the world is advanced by at once, in seconds.
 *
 * The same value `app.js:142` gives the real game's controller, so the
 * benchmark simulates the same physics the player is scored on.
 */
const SIMULATION_STEP_SECONDS = 1.0 / 60.0;

/**
 * Reads an array element that is known to exist.
 *
 * @param arr - Array to read.
 * @param index - Index to read.
 * @returns The element at `index`.
 * @throws {RangeError} When there is no element at `index`.
 */
function requireAt<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new RangeError(`Missing fitness result at index ${String(index)}`);
  }
  return value;
}

/**
 * Stringifies a thrown value the way the legacy `"" + e` did.
 *
 * @param value - The thrown value.
 * @returns Its string form.
 */
function stringifyError(value: unknown): string {
  return String(value);
}

/**
 * Runs one scenario headlessly and reports its metrics.
 *
 * @param challenge - The scenario to run.
 * @param codeObj - The player's code object.
 * @param stepSize - Milliseconds per simulated frame.
 * @param stepsToSimulate - Number of frames to run, at most.
 * @returns The metrics, or an object carrying the error the code threw.
 */
export function calculateFitness(
  challenge: FitnessChallenge,
  codeObj: UserCodeObject,
  stepSize: number,
  stepsToSimulate: number,
): FitnessResult {
  // The controller takes seconds; the frame requester takes milliseconds. The
  // legacy code passed stepSize to both (fitness.js:17,22), so the substepping
  // limit was three orders of magnitude too large and never engaged.
  const controller = createWorldController(SIMULATION_STEP_SECONDS);
  const result: FitnessResult = {};

  const world = createWorld(challenge.options);
  const frameRequester = createFrameRequester(stepSize);

  controller.on("usercode_error", (e) => {
    result.error = e;
  });
  world.on("stats_changed", () => {
    result.transportedPerSec = world.transportedPerSec;
    result.avgWaitTime = world.avgWaitTime;
    result.transportedCount = world.transportedCounter;
  });

  controller.start(world, codeObj, frameRequester.register, true);

  for (let stepCount = 0; stepCount < stepsToSimulate && !controller.isPaused; stepCount++) {
    frameRequester.trigger();
  }
  return result;
}

/**
 * Averages the same scenario across several runs, property by property.
 *
 * The property list comes from the first run, matching the legacy `_.forOwn`,
 * and values are coerced with `Number` exactly as `_.sum` did, so a
 * non-numeric property averages to `NaN`.
 *
 * @param results - The same scenario's outcome from each run.
 * @returns The scenario with its averaged metrics.
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
 * Benchmarks player code over every scenario, `runCount` times each.
 *
 * @param codeStr - The source the player typed.
 * @param runCount - How many times to run the whole scenario list.
 * @returns The averaged results, or an object carrying the error message.
 * @throws {RangeError} When `runCount` is less than one; the legacy code threw
 * a `TypeError` from the same spot.
 */
export function doFitnessSuite(codeStr: string, runCount: number): FitnessSuiteResult {
  let codeObj: UserCodeObject;
  try {
    codeObj = getCodeObjFromCode(codeStr);
  } catch (e) {
    return { error: stringifyError(e) };
  }
  console.log("Fitness testing code", codeObj);
  let error: unknown = null;

  const testruns: FitnessRun[][] = [];
  for (let run = 0; run < runCount; run++) {
    const results: FitnessRun[] = [];
    for (const challenge of fitnessChallenges) {
      const fitness = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 12000);
      // The legacy code kept iterating the remaining scenarios after a failure
      // and only bailed out afterwards; that is preserved, as is the
      // truthiness test, which ignores a falsy thrown value.
      if (fitness.error) {
        error = fitness.error;
        continue;
      }
      results.push({ options: challenge.options, result: fitness });
    }
    if (error !== null) {
      continue;
    }
    testruns.push(results);
  }
  if (error !== null) {
    return { error: stringifyError(error) };
  }

  // Now do averaging over all properties for each challenge's test runs
  const firstRun = requireAt(testruns, 0);
  return firstRun.map((_unused, n) => makeAverageResult(testruns.map((tr) => requireAt(tr, n))));
}
