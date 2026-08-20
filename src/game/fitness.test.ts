import { afterEach, describe, expect, it, vi } from "vitest";

import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import {
  calculateFitness,
  doFitnessSuite,
  fitnessLevels,
  fitnessSeeds,
  makeAverageResult,
  requireNothing,
  type AveragedFitnessRun,
  type FitnessLevel,
  type FitnessLevelOptions,
  type FitnessRun,
  type FitnessSuiteResult,
} from "./fitness.ts";
import { at } from "./test-helpers.ts";
import { World } from "./world.ts";
import { MAX_TICKS_PER_FRAME, TICK_SECONDS, type UserCodeObject } from "./world-controller.ts";

const options: FitnessLevelOptions = {
  description: "Tiny scenario",
  floorCount: 3,
  elevatorCount: 1,
  spawnRate: 0.6,
};

const level: FitnessLevel = { options, condition: requireNothing() };

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
 * How long one case that actually scores a program is allowed to take.
 *
 * A suite call simulates two hundred seconds of building for each of
 * {@link fitnessLevels}' three scenarios times every seed it was given, so the
 * cases below cost anywhere from six of those to thirty-six. Measured alone and
 * uninstrumented that is a few hundred milliseconds and the five-second default
 * looks like room to spare, but it is not: coverage multiplies the figure some
 * fivefold, vitest runs the files in parallel, and a CI runner shares out two
 * cores. All three at once is what happened -- the widest case here took 674 ms
 * alone, 8.5 s under coverage in a full run, and timed out on GitHub -- and
 * what a timeout then reports is a busy machine rather than a benchmark that
 * has stopped scoring.
 *
 * Deliberately far above the worst measurement rather than just clear of it,
 * for the reason `tutorial-sweep.test.ts`'s sweeps carry the same number: the
 * figure a timeout has to beat is not how long the work takes but how long
 * anyone is willing to wait before being told a test has hung.
 */
const SUITE_TIMEOUT_MS = 30_000;

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
        transportedPerSec: 1e9,
        avgLoadFactorOnMove: 1e9,
        avgWaitTime: 1e9,
        maxPickupTime: 1e9,
        avgPickupTime: 1e9,
        avgRideTime: 1e9,
        stopCount: 1e9,
        avgPeoplePerStop: 1e9,
      }),
    ).toBe(null);
  });
});

describe("fitnessLevels", () => {
  it("keeps the three legacy scenarios", () => {
    // The buildings written out, not just their names: they are the benchmark
    // itself, they are what makes two scores comparable, and now that this is a
    // function rather than a constant they are rebuilt on every call.
    expect(fitnessLevels().map((c) => c.options)).toEqual([
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
      fitnessLevels().map((c) => ({ ...c.options, description: "" }));
    const english = buildings();

    setLocale("ru");

    expect(buildings()).toEqual(english);
  });

  it("names its scenarios in the language asked for, not the one it was imported in", () => {
    // The trap this function exists to avoid: as a module constant the three
    // names were rendered when the module was first imported, which is before
    // anything has chosen a locale, so every report would have been English.
    setLocale("ru");

    expect(fitnessLevels().map((c) => c.options.description)).toEqual([
      "Маленький сценарий",
      "Средний сценарий",
      "Большой сценарий",
    ]);
  });
});

describe("calculateFitness", () => {
  it("reports metrics for code that never throws", () => {
    const result = calculateFitness(level, inertCodeObj(), 1000.0 / 60.0, 200);

    expect(result.error).toBeUndefined();
    expect(typeof result.transportedPerSec).toBe("number");
    expect(typeof result.avgWaitTime).toBe("number");
    expect(typeof result.avgPickupTime).toBe("number");
    expect(typeof result.transportedCount).toBe("number");
    expect(typeof result.avgLoadFactorOnMove).toBe("number");
  });

  it("keeps the world's maxima out of a report of averages", () => {
    const result = calculateFitness(level, drivingCodeObj(), 1000.0 / 60.0, 3000);

    // `makeAverageResult` averages every property it is handed, and the mean of
    // six worst cases is neither a worst case nor a typical one -- it would sit
    // in the report under a name promising a maximum. The world has two of them
    // (`maxWaitTime`, `maxPickupTime`) and neither may be copied across.
    expect(Object.keys(result).filter((property) => property.startsWith("max"))).toEqual([]);
  });

  it("transports nobody when the code never moves an elevator", () => {
    const result = calculateFitness(level, inertCodeObj(), 1000.0 / 60.0, 200);
    expect(result.transportedCount).toBe(0);
    // A program that never moves a car divides no load by no moves. `toBe(0)`
    // and not `toBeCloseTo`, because NaN would satisfy neither but only this
    // says so: a report is what a benchmark run is judged on, and a metric that
    // arrives as NaN is worse than one that is missing.
    expect(result.avgLoadFactorOnMove).toBe(0);
    // The wait before pickup reads zero for a subtler reason, and it is worth
    // saying which: a car nobody drives is still a car standing in the lobby,
    // so a passenger who appears on floor 0 gets in on the frame they spawn on
    // -- the floor button they press re-offers the car that is already there --
    // and every wait the mean is taken over is therefore zero. Exactly two
    // passengers appear in these 200 frames, and `spawnUserRandomly` puts each
    // of them in the lobby two times in three -- half the time floor 0 is
    // chosen outright, and a third of the other half comes back as floor 0 from
    // a three-floor draw. That two thirds is a fact about this level and
    // not about the game: the general figure is `(floors + 1) / (2 * floors)`,
    // which is 5/8 in a four-floor building. So the mean is taken over two
    // boardings in 44% of runs, one in 44%, and none at all in 11%, where it
    // reads zero because nothing was averaged. Measured over 200000 unseeded
    // runs -- 44.41 / 44.52 / 11.07, which is binomial(2, 2/3) to within a
    // chi-square of 0.64 on two degrees of freedom -- and it read zero in every
    // one of them. Everybody who really waited is in `maxPickupTime`, which the
    // test above keeps out of a report of averages.
    expect(result.avgPickupTime).toBe(0);
  });

  it("delivers passengers when the code actually drives the elevators", () => {
    const result = calculateFitness(level, drivingCodeObj(), 1000.0 / 60.0, 3000);

    expect(result.error).toBeUndefined();
    expect(result.transportedCount).toBeGreaterThan(0);
  });

  it("reports a wait for a car that is a part of the whole journey", () => {
    // Seeded, unlike its neighbours, because this one compares two means that
    // are not taken over the same passengers: everybody picked up is in the
    // first and only those delivered are in the second, so at the moment the
    // run is cut off the difference between them is not a ride time but the
    // rides still in progress -- two to four of them, typically, out of some
    // twenty-nine. Measured, that leaves a wide margin and not a narrow one:
    // over 100000 unseeded runs neither assertion below failed once, and the
    // ratio they turn on -- `avgPickupTime / avgWaitTime`, against a threshold
    // of 1 -- had a median of 0.45, a 99th percentile of 0.54, and never once
    // reached 0.68. Quoting the largest value seen would be quoting noise: the
    // maximum of a 2000-run sample lands anywhere between 0.57 and 0.67
    // depending on the sample, which is why an earlier reading of this comment
    // could not be reproduced. So the seed is here for reproducibility -- the
    // same traffic to look at again when a figure surprises somebody -- rather
    // than to keep a coin toss from landing badly. Nor is `"pickup-seed"` a
    // lucky draw: the ratio it produces is 0.53, in the top 2% of that
    // distribution, which is the hard end of it.
    const result = calculateFitness(level, drivingCodeObj(), 1000.0 / 60.0, 3000, "pickup-seed");

    // The point of the split: the report now says how much of the figure a
    // player is judged on was spent standing on a floor rather than riding.
    expect(result.avgPickupTime).toBeGreaterThan(0);
    expect(result.avgPickupTime).toBeLessThan(result.avgWaitTime ?? 0);
  });

  it("scores the same code against the same passengers when given a seed", () => {
    // What a seed is for here: two solutions can be compared over identical
    // traffic, and a score that came out surprising can be looked at again.
    const codeObj = drivingCodeObj();

    const first = calculateFitness(level, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");
    const second = calculateFitness(level, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");

    expect(first.transportedCount).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("gives a different seed a different score", () => {
    const codeObj = drivingCodeObj();

    const first = calculateFitness(level, codeObj, 1000.0 / 60.0, 3000, "fitness-seed");
    const other = calculateFitness(level, codeObj, 1000.0 / 60.0, 3000, "other-seed");

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

    const result = calculateFitness(level, codeObj, 1000.0 / 60.0, 200);

    expect(result.error).toBe(boom);
    expect(result.transportedCount).toBe(0);
  });

  it("caps a very long frame at MAX_TICKS_PER_FRAME ticks", () => {
    // calculateFitness's controller always ticks at TICK_SECONDS, however long
    // a "frame" of the suite's own fake frame requester lasts; the excess
    // beyond MAX_TICKS_PER_FRAME ticks is dropped, not queued, the same as a
    // real browser stall would be.
    const dts: number[] = [];
    const codeObj: UserCodeObject = {
      init(): void {
        // Nothing.
      },
      update(dt): void {
        dts.push(dt);
      },
    };

    // Comfortably past MAX_TICKS_PER_FRAME * TICK_SECONDS = 1 simulated second.
    calculateFitness(level, codeObj, 3_600_000, 2);

    expect(dts).toHaveLength(MAX_TICKS_PER_FRAME);
    for (const dt of dts) {
      expect(dt).toBe(TICK_SECONDS);
    }
  });

  it("advances the world in lockstep with player code, always by TICK_SECONDS", () => {
    // Pins the numbers the benchmark actually runs with: at 1000 * TICK_SECONDS
    // ms per frame, each frame is exactly one tick, so the count below is also
    // a guard against a stray extra or missing world.update() alongside
    // codeObj.update() — the bug the substep loop used to have.
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

    calculateFitness(level, codeObj, 1000 * TICK_SECONDS, 21);

    // 21 frames, the first of which only records the timestamp.
    expect(dts).toHaveLength(20);
    for (const dt of dts) {
      expect(dt).toBe(TICK_SECONDS);
    }

    const steps = worldUpdate.mock.calls.map((call) => call[0]);
    expect(steps).toEqual(dts);
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

    const result = calculateFitness(level, codeObj, 1000.0 / 60.0, 500);

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
    const other: FitnessLevelOptions = { ...options, description: "Other" };
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

  it(
    "scores the same program the same way twice",
    () => {
      // The whole point of naming the seeds. Unseeded, the benchmark handed back
      // different numbers for the same program on every invocation, so a change
      // that made a program better and a change that made it luckier looked
      // exactly alike.
      const first = doFitnessSuite(SWEEPING_PROGRAM, [101, 102]);
      const second = doFitnessSuite(SWEEPING_PROGRAM, [101, 102]);

      expect(expectRuns(first)[0]?.result["avgWaitTime"]).toBeGreaterThan(0);
      expect(second).toEqual(first);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    "scores it differently on different buildings",
    () => {
      // The other half of the same claim: the numbers follow the seed list, so
      // they are reproducible because the buildings are pinned and not because
      // the benchmark has stopped being sensitive to which buildings it ran.
      const first = doFitnessSuite(SWEEPING_PROGRAM, [101]);
      const other = doFitnessSuite(SWEEPING_PROGRAM, [202]);

      expect(other).not.toEqual(first);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    "averages over every seed rather than reporting the last one",
    () => {
      // A list of two, scored one at a time and then together: every averaged
      // property of the pair has to be the mean of the two singles. Reporting
      // only the last run -- the shape of mistake this guards against -- would
      // equal the second and differ from the first, and both are checked here.
      const first = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [101]));
      const second = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [202]));
      const both = expectRuns(doFitnessSuite(SWEEPING_PROGRAM, [101, 202]));

      expect(both).toHaveLength(fitnessLevels().length);
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
    },
    SUITE_TIMEOUT_MS,
  );

  it("rejects an empty seed list instead of reporting an empty score", () => {
    // There is nothing to average over no runs, and the honest answers are a
    // throw or an empty result list; an empty list would reach
    // describeFitnessResults and print "Fitness avg delivery times:" with nothing
    // after it, which reads like a program that scored badly rather than like a
    // caller that asked for no measurement. This costs no simulation, so it is
    // also the cheapest test in the file.
    expect(() => doFitnessSuite(SWEEPING_PROGRAM, [])).toThrow(RangeError);
  });

  it(
    "runs the shipped seed list when it is given none",
    () => {
      // The path the worker takes: it posts nothing but the player's source, so
      // whether the report a player sees is reproducible rests entirely on the
      // default being the constant everyone can read.
      //
      // The widest case in the file: the six shipped seeds scored twice over,
      // which is thirty-six simulated buildings against the six or twelve the
      // cases above it settle for.
      const shipped = doFitnessSuite(SWEEPING_PROGRAM, [...fitnessSeeds]);

      expect(doFitnessSuite(SWEEPING_PROGRAM)).toEqual(shipped);
    },
    SUITE_TIMEOUT_MS,
  );
});
