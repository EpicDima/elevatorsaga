import { afterEach, describe, expect, it, vi } from "vitest";

import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import {
  calculateFitness,
  doFitnessSuite,
  fitnessChallenges,
  fitnessSeeds,
  makeAverageResult,
  requireNothing,
  type AveragedFitnessRun,
  type FitnessChallenge,
  type FitnessChallengeOptions,
  type FitnessRun,
  type FitnessSuiteResult,
} from "./fitness.ts";
import { at } from "./test-helpers.ts";
import { World } from "./world.ts";
import type { UserCodeObject } from "./world-controller.ts";

const options: FitnessChallengeOptions = {
  description: "Tiny scenario",
  floorCount: 3,
  elevatorCount: 1,
  spawnRate: 0.6,
};

const challenge: FitnessChallenge = { options, condition: requireNothing() };

/**
 * Player code that does nothing at all.
 *
 * @returns A valid but inert code object.
 */
function inertCodeObj(): UserCodeObject {
  return {
    init(): void {
      // Nothing.
    },
    update(): void {
      // Nothing.
    },
  };
}

/**
 * Player code that sweeps the lone elevator up and down, so that the scenario
 * actually delivers somebody and its metrics say something.
 *
 * @returns A code object that drives the elevators.
 */
function drivingCodeObj(): UserCodeObject {
  return {
    init(elevators): void {
      const elevator = at(elevators, 0);
      elevator.on("idle", () => {
        elevator.goToFloor(0);
        elevator.goToFloor(1);
        elevator.goToFloor(2);
      });
    },
    update(): void {
      // Nothing.
    },
  };
}

/**
 * Player source that sweeps every elevator through the whole building.
 *
 * A *string*, because {@link doFitnessSuite} compiles what the player typed, and
 * a driving program rather than an inert one because the metrics of a program
 * that never moves a car are all zero whatever building it is put in — which
 * would make every comparison below trivially true.
 */
const SWEEPING_PROGRAM = `{
  init: function (elevators, floors) {
    elevators.forEach(function (elevator) {
      elevator.on("idle", function () {
        for (var floor = 0; floor < floors.length; floor++) {
          elevator.goToFloor(floor);
        }
      });
    });
  },
  update: function (dt, elevators, floors) {}
}`;

/**
 * Reads the averaged runs out of a suite result, failing if it errored.
 *
 * Narrows the union, so a test can index the results without a cast; a suite
 * that reports an error where a test expected numbers has failed regardless of
 * what the assertion after it would have said.
 *
 * @param result - What the suite reported.
 * @returns The averaged runs.
 */
function expectRuns(result: FitnessSuiteResult): AveragedFitnessRun[] {
  if (!Array.isArray(result)) {
    throw new Error(`Fitness suite failed: ${result.error}`);
  }
  return result;
}

/**
 * Reads an averaged metric that the scenario is expected to have reported.
 *
 * @param result - One scenario's averaged metrics.
 * @param property - The metric to read.
 * @returns Its value.
 * @throws {Error} When the scenario reported no such metric.
 */
function propertyOf(result: Record<string, number>, property: string): number {
  const value = result[property];
  if (value === undefined) {
    throw new Error(`Averaged result has no ${property}`);
  }
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  setLocale(DEFAULT_LOCALE);
});

describe("requireNothing", () => {
  it("never resolves", () => {
    const condition = requireNothing();
    expect(condition.description).toBe("No requirement");
    expect(
      condition.evaluate({
        elapsedTime: 1e9,
        transportedCounter: 1e9,
        maxWaitTime: 1e9,
        moveCount: 1e9,
      }),
    ).toBe(null);
  });
});

describe("fitnessChallenges", () => {
  it("keeps the three legacy scenarios", () => {
    // The buildings written out, not just their names: they are the benchmark
    // itself, they are what makes two scores comparable, and now that this is a
    // function rather than a constant they are rebuilt on every call.
    expect(fitnessChallenges().map((c) => c.options)).toEqual([
      { description: "Small scenario", floorCount: 4, elevatorCount: 2, spawnRate: 0.6 },
      {
        description: "Medium scenario",
        floorCount: 6,
        elevatorCount: 3,
        spawnRate: 1.5,
        elevatorCapacities: [5],
      },
      {
        description: "Large scenario",
        floorCount: 18,
        elevatorCount: 6,
        spawnRate: 1.9,
        elevatorCapacities: [8],
      },
    ]);
  });

  it("changes only the names when the language changes", () => {
    // A report scored in one language has to be comparable with a report scored
    // in another, so the language may reach the descriptions and nothing else.
    // What the buildings are is the test above's job; this one only holds one
    // call against another, so a `t()` where a spawn rate goes would show up.
    const buildings = (): unknown[] =>
      fitnessChallenges().map((c) => ({ ...c.options, description: "" }));
    const english = buildings();

    setLocale("ru");

    expect(buildings()).toEqual(english);
  });

  it("names its scenarios in the language asked for, not the one it was imported in", () => {
    // The trap this function exists to avoid: as a module constant the three
    // names were rendered when the module was first imported, which is before
    // anything has chosen a locale, so every report would have been English.
    setLocale("ru");

    expect(fitnessChallenges().map((c) => c.options.description)).toEqual([
      "Маленький сценарий",
      "Средний сценарий",
      "Большой сценарий",
    ]);
  });
});

describe("calculateFitness", () => {
  it("reports metrics for code that never throws", () => {
    const result = calculateFitness(challenge, inertCodeObj(), 1000.0 / 60.0, 200);

    expect(result.error).toBeUndefined();
    expect(typeof result.transportedPerSec).toBe("number");
    expect(typeof result.avgWaitTime).toBe("number");
    expect(typeof result.transportedCount).toBe("number");
    expect(typeof result.avgLoadFactorOnMove).toBe("number");
  });

  it("transports nobody when the code never moves an elevator", () => {
    const result = calculateFitness(challenge, inertCodeObj(), 1000.0 / 60.0, 200);
    expect(result.transportedCount).toBe(0);
    // A program that never moves a car divides no load by no moves. `toBe(0)`
    // and not `toBeCloseTo`, because NaN would satisfy neither but only this
    // says so: a report is what a benchmark run is judged on, and a metric that
    // arrives as NaN is worse than one that is missing.
    expect(result.avgLoadFactorOnMove).toBe(0);
  });

  it("delivers passengers when the code actually drives the elevators", () => {
    const result = calculateFitness(challenge, drivingCodeObj(), 1000.0 / 60.0, 3000);

    expect(result.error).toBeUndefined();
    expect(result.transportedCount).toBeGreaterThan(0);
  });

  it("scores the same code against the same passengers when given a seed", () => {
    // What a seed is for here: two solutions can be compared over identical
    // traffic, and a score that came out surprising can be looked at again.
    const codeObj = drivingCodeObj();

    const first = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");
    const second = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");

    expect(first.transportedCount).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("gives a different seed a different score", () => {
    const codeObj = drivingCodeObj();

    const first = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");
    const other = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 3000, "other-seed");

    expect(other).not.toEqual(first);
  });

  it("records the error when the code throws", () => {
    const boom = new Error("boom");
    const codeObj: UserCodeObject = {
      init(): void {
        throw boom;
      },
      update(): void {
        // Nothing.
      },
    };

    const result = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 200);

    expect(result.error).toBe(boom);
    expect(result.transportedCount).toBe(0);
  });

  it("caps a long frame at the substepping limit", () => {
    // The controller's dtMax is a number of simulated *seconds*, but
    // calculateFitness handed it stepSize, which is milliseconds. With the
    // shipped 1000/60 that made the limit 16.7 simulated seconds instead of
    // 0.0167, so the clamp that exists to stop one long frame being swallowed
    // whole never engaged.
    const dts: number[] = [];
    const codeObj: UserCodeObject = {
      init(): void {
        // Nothing.
      },
      update(dt): void {
        dts.push(dt);
      },
    };

    calculateFitness(challenge, codeObj, 1000.0, 3);

    // One second of real time per frame, clamped to three times the step.
    expect(dts.length).toBeGreaterThan(0);
    for (const dt of dts) {
      expect(dt).toBeCloseTo(3.0 / 60.0, 12);
    }
  });

  it("advances the world exactly once per frame at the suite's own step size", () => {
    // Pins the numbers the benchmark actually runs with: at 1000/60 ms per
    // frame the clamp is inert and every frame is one whole simulation step.
    //
    // This used to assert only the dt handed to player code, which is why it
    // stayed green while the substep loop was quietly taking a second,
    // ~7e-18 second world.update() on most frames — a whole extra world tick,
    // re-running arrival snapping and the statistics recalculation.
    const dts: number[] = [];
    const worldUpdate = vi.spyOn(World.prototype, "update");
    const codeObj: UserCodeObject = {
      init(): void {
        // Nothing.
      },
      update(dt): void {
        dts.push(dt);
      },
    };

    calculateFitness(challenge, codeObj, 1000.0 / 60.0, 21);

    // 21 frames, the first of which only records the timestamp.
    expect(dts).toHaveLength(20);
    for (const dt of dts) {
      expect(dt).toBeCloseTo(1.0 / 60.0, 12);
    }

    const steps = worldUpdate.mock.calls.map((call) => call[0]);
    expect(steps).toHaveLength(dts.length);
    for (const step of steps) {
      expect(step).toBeCloseTo(1.0 / 60.0, 12);
    }
    expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(
      dts.reduce((a, b) => a + b, 0),
      12,
    );
  });

  it("stops simulating as soon as the code throws", () => {
    const boom = new Error("boom");
    let updateCalls = 0;
    const codeObj: UserCodeObject = {
      init(): void {
        // Nothing.
      },
      update(): void {
        updateCalls++;
        if (updateCalls === 3) {
          throw boom;
        }
      },
    };

    const result = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 500);

    expect(result.error).toBe(boom);
    expect(updateCalls).toBe(3);
  });
});

describe("makeAverageResult", () => {
  it("averages every property of the first run across all runs", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 1, avgWaitTime: 10, transportedCount: 4 } },
      { options, result: { transportedPerSec: 3, avgWaitTime: 20, transportedCount: 6 } },
    ];

    expect(makeAverageResult(runs)).toEqual({
      options,
      result: { transportedPerSec: 2, avgWaitTime: 15, transportedCount: 5 },
    });
  });

  it("keeps the options of the first run", () => {
    const other: FitnessChallengeOptions = { ...options, description: "Other" };
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 1 } },
      { options: other, result: { transportedPerSec: 2 } },
    ];

    expect(makeAverageResult(runs).options).toBe(options);
  });

  it("takes the property list from the first run only", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 2 } },
      { options, result: { transportedPerSec: 4, avgWaitTime: 99 } },
    ];

    expect(makeAverageResult(runs).result).toEqual({ transportedPerSec: 3 });
  });

  it("yields NaN for a property a later run is missing", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 2, avgWaitTime: 5 } },
      { options, result: { transportedPerSec: 4 } },
    ];

    expect(makeAverageResult(runs).result["avgWaitTime"]).toBeNaN();
  });

  it("averages a single run to itself", () => {
    const runs: FitnessRun[] = [{ options, result: { transportedPerSec: 7 } }];
    expect(makeAverageResult(runs).result).toEqual({ transportedPerSec: 7 });
  });

  it("rejects an empty run list", () => {
    expect(() => makeAverageResult([])).toThrow(RangeError);
  });
});

describe("fitnessSeeds", () => {
  it("names several distinct buildings", () => {
    // More than one, or a single unlucky building decides the score; and no
    // repeats, since a seed listed twice spends a run re-measuring a building
    // that has already been measured and then counts it twice in the average.
    expect(fitnessSeeds.length).toBeGreaterThan(1);
    expect(new Set(fitnessSeeds).size).toBe(fitnessSeeds.length);
  });
});

describe("doFitnessSuite", () => {
  it("reports code that does not compile as an error", () => {
    const result = doFitnessSuite("{update: function() {}}");
    expect(result).toEqual({ error: "Error: Code must contain an init function" });
  });

  it("reports a syntax error as an error", () => {
    const result = doFitnessSuite("{init: function(} }");
    expect("error" in result).toBe(true);
  });

  it.each([
    ["0", "0"],
    ["null", "null"],
    ["undefined", "undefined"],
    ["false", "false"],
    ['""', ""],
    ["NaN", "NaN"],
  ])("reports a program that threw %s as an error", (thrown, reported) => {
    // Every one of these was scored as a successful run, because the test that
    // decided it was the truthiness of the thrown value. The report then
    // carried the thrown value as a metric -- `error: 0` averaged alongside the
    // transport rate -- and the benchmark command exited 0, so a script scoring
    // a directory of programs wrote the failure down as a measurement.
    expect(
      doFitnessSuite(`{init: function () { throw ${thrown}; }, update: function () {} }`),
    ).toEqual({ error: reported });
  });

  it("reports the error in the language the suite is running in", () => {
    // Which is why the worker is told the locale rather than sending scenario
    // identifiers home: this string is `String()` of whatever was thrown, so
    // there is no identifier to send in its place, and it is rendered here --
    // wherever "here" happens to be -- or not at all.
    setLocale("ru");

    expect(doFitnessSuite("{update: function() {}}")).toEqual({
      error: "Error: В коде должна быть функция init",
    });
  });

  it("scores the same program the same way twice", () => {
    // The whole point of naming the seeds. Unseeded, the benchmark handed back
    // different numbers for the same program on every invocation, so a change
    // that made a program better and a change that made it luckier looked
    // exactly alike.
    const first = doFitnessSuite(SWEEPING_PROGRAM, [101, 102]);
    const second = doFitnessSuite(SWEEPING_PROGRAM, [101, 102]);

    expect(expectRuns(first)[0]?.result["avgWaitTime"]).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("scores it differently on different buildings", () => {
    // The other half of the same claim: the numbers follow the seed list, so
    // they are reproducible because the buildings are pinned and not because
    // the benchmark has stopped being sensitive to which buildings it ran.
    const first = doFitnessSuite(SWEEPING_PROGRAM, [101]);
    const other = doFitnessSuite(SWEEPING_PROGRAM, [202]);

    expect(other).not.toEqual(first);
  });

  it("averages over every seed rather than reporting the last one", () => {
    // A list of two, scored one at a time and then together: every averaged
    // property of the pair has to be the mean of the two singles. Reporting
    // only the last run -- the shape of mistake this guards against -- would
    // equal the second and differ from the first, and both are checked here.
    const first = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [101]));
    const second = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [202]));
    const both = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [101, 202]));

    expect(both).toHaveLength(fitnessChallenges().length);
    for (const [index, run] of both.entries()) {
      const firstResult = at(first, index).result;
      const secondResult = at(second, index).result;
      expect(run.options.description).toBe(at(first, index).options.description);
      for (const [property, value] of Object.entries(run.result)) {
        const mean = (propertyOf(firstResult, property) + propertyOf(secondResult, property)) / 2;
        expect(value).toBeCloseTo(mean, 12);
      }
      expect(run.result).not.toEqual(secondResult);
      expect(run.result).not.toEqual(firstResult);
    }
  });

  it("rejects an empty seed list instead of reporting an empty score", () => {
    // There is nothing to average over no runs, and the honest answers are a
    // throw or an empty result list; an empty list would reach
    // describeFitnessResults and print "Fitness avg delivery times:" with nothing
    // after it, which reads like a program that scored badly rather than like a
    // caller that asked for no measurement. This costs no simulation, so it is
    // also the cheapest test in the file.
    expect(() => doFitnessSuite(SWEEPING_PROGRAM, [])).toThrow(RangeError);
  });

  it("runs the shipped seed list when it is given none", () => {
    // The path the worker takes: it posts nothing but the player's source, so
    // whether the report a player sees is reproducible rests entirely on the
    // default being the constant everyone can read.
    const shipped = doFitnessSuite(SWEEPING_PROGRAM, [...fitnessSeeds]);

    expect(doFitnessSuite(SWEEPING_PROGRAM)).toEqual(shipped);
  });
});
