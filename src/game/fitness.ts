/**
 * Headless benchmark suite: runs player code through a few scenarios on a fixed
 * list of seeds, without drawing anything, and averages the results.
 *
 * Ported from the logic half of the legacy `fitness.js`. The web-worker wiring
 * that used to live here (`fitnessSuite` and `fitnessworker.js`) is now
 * `src/app/fitness.ts` and `src/app/fitness-worker.ts`; {@link doFitnessSuite}
 * is called from both — from `self.onmessage` in `src/app/fitness-worker.ts`
 * inside the worker, and from `runFitnessSuite` in `src/app/fitness.ts` on the
 * main thread when a worker cannot be spawned.
 */

import { t } from "../i18n/index.ts";
import type { ChallengeCondition } from "./challenges.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorld, type WorldOptions } from "./world.ts";
import { createWorldController, type UserCodeObject } from "./world-controller.ts";

/** World options for a fitness scenario, with a label for the report. */
export interface FitnessChallengeOptions extends WorldOptions {
  /**
   * Scenario name shown in the results, already rendered.
   *
   * Text rather than a message key, because it is rendered where the suite runs
   * and not where its report is printed: see {@link fitnessChallenges} and the
   * note on `FitnessWorkerRequest` in `src/app/fitness-worker.ts`.
   */
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
  /** Mean spawn-to-delivery time of delivered passengers, the ride included. */
  avgWaitTime?: number;
  /**
   * Mean spawn-to-boarding time: the part of the above spent on a floor.
   *
   * Its two companions on the world -- `maxWaitTime` and `maxPickupTime` -- are
   * deliberately left out. {@link makeAverageResult} averages every property it
   * finds across the seeds, and the mean of six maxima is neither a maximum nor
   * a typical figure: it would read in the report as "the worst wait" while
   * being nothing of the kind. A report of means stays a report of means; the
   * worst case is a thing to watch a single run for, and the game's own
   * statistics panel shows it there.
   */
  avgPickupTime?: number;
  /** Passengers delivered. */
  transportedCount?: number;
  /** How full the cars were, averaged over every floor they crossed. */
  avgLoadFactorOnMove?: number;
};

/** One scenario's outcome. */
export interface FitnessRun {
  /** The scenario that produced it. */
  readonly options: FitnessChallengeOptions;
  /** The metrics gathered. */
  readonly result: FitnessResult;
}

/** One scenario's outcome, averaged over every seed the suite ran it on. */
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

/**
 * The scenarios every benchmark run goes through.
 *
 * A function rather than the constant this was, because the three names are
 * messages and a constant renders them when this module is imported — before
 * `main.ts` has a body to run, and so before anything has chosen a locale. The
 * buildings themselves have not moved: the floor counts, elevator counts and
 * spawn rates below are the same three scenarios the benchmark has always used,
 * and they are still written out in one readable place. Only the moment the
 * names are rendered has changed, from import time to the start of a suite,
 * which is late enough for whoever chose a language to have chosen it: inside
 * the worker that is the {@link "../i18n/index.ts"!setLocale} its request
 * carries, and on the main thread it is whatever the page has set by then --
 * which is now a real language rather than always English, since
 * `applyPreferredLocale` resolves one before `main.ts` builds anything and the
 * picker can change it afterwards. A constant would have frozen the names at
 * import time, in the one language nobody had chosen yet.
 *
 * The name is deliberately the constant's: what other modules mean when they
 * refer to this is the list of buildings, which is unchanged, and only the way
 * it is obtained has moved.
 *
 * @returns The three scenarios, in the order the report lists them.
 */
export function fitnessChallenges(): readonly FitnessChallenge[] {
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
 * The buildings every benchmark run is scored on, one world per seed.
 *
 * The benchmark used to leave every world unseeded, so the same program scored
 * differently on every invocation and two programs could not be told apart from
 * a luckier draw. Naming the seeds fixes both: the buildings are reproducible,
 * and two programs measured against this list met the same passengers, arriving
 * at the same second, on the same floors. Reproducible *buildings* rather than
 * reproducible scores, strictly — a program that calls `Math.random` itself
 * decides differently on identical traffic, and nothing here can seed that — but
 * the half that used to vary on its own no longer does.
 *
 * Written out here rather than generated, and exported rather than kept private,
 * because a number nobody can see is a number nobody can check: someone
 * comparing two scores has to be able to read which buildings they were compared
 * on, and someone who suspects the list of flattering one strategy has to be
 * able to change it in one obvious place — the same reason
 * {@link fitnessChallenges} spells its three buildings out.
 *
 * The values themselves are arbitrary and are meant to be. What matters is that
 * there are several of them, so one unlucky building cannot decide a score, and
 * that they never change on their own. Nor do they need to be spread out:
 * {@link "./random.ts"!createRandomSource} hashes a seed before use, so `1` and
 * `2` start unrelated streams rather than neighbouring ones.
 *
 * Six of them, which is exactly the run count the worker used to pass, so a
 * report costs what it always did: this list is where that cost is decided, and
 * lengthening it lengthens every benchmark the game runs.
 */
export const fitnessSeeds: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6];

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
 * @param seed - Seed for the world's randomness, which is what makes two
 * measurements of the same program comparable: the same seed is the same
 * passengers, arriving at the same second, on the same floors.
 * {@link doFitnessSuite} passes one from {@link fitnessSeeds} for every run it
 * makes. Omitted, the world generates its own, and the run is then reproducible
 * only after the fact, from the seed it recorded on `world.seed`.
 * @returns The metrics, or an object carrying the error the code threw.
 */
export function calculateFitness(
  challenge: FitnessChallenge,
  codeObj: UserCodeObject,
  stepSize: number,
  stepsToSimulate: number,
  seed?: RandomSeed,
): FitnessResult {
  // The controller takes seconds; the frame requester takes milliseconds. The
  // legacy code passed stepSize to both (fitness.js:17,22), so the substepping
  // limit was three orders of magnitude too large and never engaged.
  const controller = createWorldController(SIMULATION_STEP_SECONDS);
  const result: FitnessResult = {};

  const world = createWorld(challenge.options, seed);
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
 * Benchmarks player code over every scenario, once per seed.
 *
 * The legacy suite took a number of runs and left every world unseeded, so the
 * scenario list was walked `runCount` times over a building nobody could name
 * afterwards — a fresh one per scenario, `runCount` times the scenario count of
 * them in all, none of them repeatable. The count is now the seed list's length: it
 * still averages several runs, but which runs is written down, so re-running the
 * same program reproduces the same numbers and two programs can be held against
 * the same buildings.
 *
 * @param codeStr - The source the player typed.
 * @param seeds - One world seed per run of the scenario list; the results are
 * averaged over all of them. Defaults to {@link fitnessSeeds}, which is what
 * both callers use, and is a parameter so that a caller who wants a shorter
 * report (see `FALLBACK_SEED_COUNT` in src/app/fitness.ts) or a second opinion
 * on other buildings can ask for one without editing the constant everyone else
 * is being scored against.
 * @returns The averaged results, or an object carrying the error message.
 * @throws {RangeError} When `seeds` is empty, since there is then nothing to
 * average; the legacy code threw a `TypeError` from the same spot for a
 * `runCount` below one.
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
  // Boxed, and not the thrown value itself, because every value is a value a
  // program can throw: `null` and `undefined` are the two this has to survive,
  // and either of them as a sentinel would read as "nothing went wrong".
  let failure: { readonly thrown: unknown } | undefined = undefined;

  // Once, not once per seed: every run has to be scored on the same three
  // buildings, and `makeAverageResult` keeps the options object of the first
  // run it is given, so the report would otherwise name its scenarios from an
  // object built during a different pass over the same list.
  const challenges = fitnessChallenges();

  const testruns: FitnessRun[][] = [];
  for (const seed of seeds) {
    const results: FitnessRun[] = [];
    for (const challenge of challenges) {
      // Every scenario of one run takes the same seed, which does not make the
      // three the same run over again: each draws that one stream against its
      // own floor count and spawn rate, so the same values become different
      // passengers heading for different floors, and more or fewer of them. It
      // does correlate them -- three scenarios starting from an identical
      // stream see related first arrivals -- which is a reason to average across
      // seeds, as this does, rather than to read one scenario on its own. One
      // seed per run is also what makes a report quotable -- "seed 3" names a
      // whole row of the results rather than one cell of it.
      const fitness = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 12000, seed);
      // The legacy code kept iterating the remaining scenarios after a failure
      // and only bailed out afterwards, which is preserved. Its truthiness test
      // is not: `throw 0`, `throw null` and `throw ""` all failed that test, so
      // the scenario was scored as if it had run and `error` went into the
      // averaging as another number -- a report of `error: 0` beside the
      // transport rate, and a benchmark exiting as though the program had been
      // measured. What decides it is whether the run set the property, not what
      // it set it to.
      if (Object.hasOwn(fitness, "error")) {
        failure = { thrown: fitness.error };
        continue;
      }
      results.push({ options: challenge.options, result: fitness });
    }
    if (failure !== undefined) {
      continue;
    }
    testruns.push(results);
  }
  if (failure !== undefined) {
    return { error: stringifyError(failure.thrown) };
  }

  // Now do averaging over all properties for each challenge's test runs
  const firstRun = requireAt(testruns, 0);
  return firstRun.map((_unused, n) => makeAverageResult(testruns.map((tr) => requireAt(tr, n))));
}
