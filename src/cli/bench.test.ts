import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { doFitnessSuite, fitnessSeeds, type AveragedFitnessRun } from "../game/fitness.ts";
import { setLocale, translateIn, DEFAULT_LOCALE } from "../i18n/index.ts";
import {
  formatReport,
  parseBenchArgs,
  runBench,
  withRunOutputOnStandardError,
  BenchUsageError,
  EXIT_OK,
  EXIT_PROGRAM_FAILED,
  EXIT_USAGE,
  USAGE,
  type BenchIo,
  type BenchOptions,
} from "./bench.ts";

/**
 * A program that actually delivers people.
 *
 * The report is made of numbers the simulation produced, and a program that
 * never moves an elevator produces zeroes on every seed -- which would let a
 * test about columns pass while the columns held nothing.
 */
const DRIVING_PROGRAM = `{
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

/** One seed, because a test that only needs numbers should not run six worlds. */
const ONE_SEED = ["7"];

/** Standard output and standard error, recorded rather than written. */
interface Streams {
  /** The report. */
  out: string;
  /** Everything else. */
  err: string;
}

/**
 * Builds the pair {@link runBench} writes through.
 *
 * @param files - The files that exist, by path; anything else fails to open.
 * @returns The streams, and the io that writes into them.
 */
function streams(files: Readonly<Record<string, string>> = {}): {
  streams: Streams;
  io: BenchIo;
} {
  const recorded: Streams = { out: "", err: "" };
  return {
    streams: recorded,
    io: {
      readFile: (path) => {
        const contents = files[path];
        return contents === undefined
          ? Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`))
          : Promise.resolve(contents);
      },
      write: (text) => {
        recorded.out += text;
      },
      writeError: (text) => {
        recorded.err += text;
      },
    },
  };
}

/**
 * Options for the report formatter.
 *
 * @param overrides - What this test cares about.
 * @returns The options.
 */
function options(overrides: Partial<BenchOptions> = {}): BenchOptions {
  return { programPath: "solution.js", seeds: ["1", "2"], locale: "en", json: false, ...overrides };
}

/**
 * Builds a scored scenario.
 *
 * @param description - The scenario name.
 * @param result - Its averaged metrics.
 * @returns The run.
 */
function run(description: string, result: Record<string, number>): AveragedFitnessRun {
  return {
    options: { description, floorCount: 4, elevatorCount: 2 },
    result,
  };
}

afterEach(() => {
  // The active locale is module state, and `--locale ru` sets it for good.
  setLocale(DEFAULT_LOCALE);
  // Console spies otherwise outlive the test that installed them, and the next
  // `vi.spyOn` of the same method hands back the one already there -- with
  // everything an earlier test made it record still in it.
  vi.restoreAllMocks();
});

describe("reading the command line", () => {
  it("takes the program and scores it on the buildings the game uses", () => {
    // The default is the shipped list rather than a list of its own, which is
    // what makes a number from this command comparable with a number from the
    // page: the same seeds are the same passengers on the same floors.
    expect(parseBenchArgs(["solution.js"])).toEqual({
      kind: "run",
      options: {
        programPath: "solution.js",
        seeds: fitnessSeeds,
        locale: DEFAULT_LOCALE,
        json: false,
      },
    });
  });

  it("reads an option whether it is written with a space or with an equals sign", () => {
    expect(parseBenchArgs(["solution.js", "--seeds", "3,4", "--locale", "ru"])).toEqual(
      parseBenchArgs(["--seeds=3,4", "--locale=ru", "solution.js"]),
    );
  });

  it("keeps a seed exactly as it was typed", () => {
    // `createRandomSource` hashes `String(seed)`, so a label is as good a seed as
    // a number and reproduces just as exactly; reporting it back as it was
    // written is what lets somebody re-run a result they were sent.
    const request = parseBenchArgs(["solution.js", "--seeds", "rush-hour, 7 ,003"]);

    expect(request).toEqual({
      kind: "run",
      options: {
        programPath: "solution.js",
        seeds: ["rush-hour", "7", "003"],
        locale: DEFAULT_LOCALE,
        json: false,
      },
    });
  });

  it("refuses a seed list with a hole in it", () => {
    // `--seeds 1,,2` is a typing slip, and an empty seed is still a seed as far
    // as the hash is concerned -- it would silently score a fourth building.
    expect(() => parseBenchArgs(["solution.js", "--seeds", "1,,2"])).toThrow(BenchUsageError);
  });

  it("refuses a language this build has no catalogue for", () => {
    expect(() => parseBenchArgs(["solution.js", "--locale", "kl"])).toThrow(/Unknown locale: kl/);
  });

  it("refuses an option it does not know instead of treating it as a file name", () => {
    expect(() => parseBenchArgs(["solution.js", "--runs=5"])).toThrow(/Unknown option: --runs=5/);
  });

  it("refuses an option that was given no value", () => {
    expect(() => parseBenchArgs(["solution.js", "--seeds"])).toThrow(/--seeds needs a value/);
  });

  it("refuses a second program rather than quietly benchmarking one of them", () => {
    expect(() => parseBenchArgs(["a.js", "b.js"])).toThrow(/a\.js and b\.js/);
  });

  it("refuses options with no program to apply them to", () => {
    expect(() => parseBenchArgs(["--json"])).toThrow(/No program file given/);
  });

  it("answers with the usage when asked, wherever the question comes in the line", () => {
    expect(parseBenchArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseBenchArgs(["solution.js", "-h"])).toEqual({ kind: "help" });
    // Somebody finding out what this is.
    expect(parseBenchArgs([])).toEqual({ kind: "help" });
  });
});

describe("the report", () => {
  it("names every metric the run reported and lines the figures up under it", () => {
    const report = formatReport(
      [
        run("Small scenario", {
          transportedPerSec: 0.5,
          avgWaitTime: 12.3456,
          transportedCount: 108,
        }),
        run("Large scenario", { transportedPerSec: 0.25, avgWaitTime: 7, transportedCount: 54 }),
      ],
      options(),
    );

    expect(report).toBe(
      "program: solution.js\n" +
        "seeds:   1, 2\n" +
        "locale:  en\n" +
        "\n" +
        "scenario        transportedPerSec  avgWaitTime  transportedCount\n" +
        "Small scenario              0.500       12.346           108.000\n" +
        "Large scenario              0.250        7.000            54.000\n",
    );
  });

  it("takes its columns from the run rather than from a list written here", () => {
    // `makeAverageResult` averages whatever properties the result carried, so a
    // metric added to the simulation has to appear without this file being
    // edited, and a scenario whose statistics never changed has to leave its
    // cells empty rather than print a zero it never measured.
    const report = formatReport(
      [run("Quiet scenario", {}), run("Busy scenario", { energyUsed: 3.5 })],
      options(),
    );

    expect(report).toContain("scenario        energyUsed\n");
    expect(report).toContain("Quiet scenario\n");
    expect(report).toContain("Busy scenario        3.500\n");
  });

  it("says what the program threw instead of a table of nothing", () => {
    expect(formatReport({ error: "TypeError: nope" }, options())).toBe(
      "program: solution.js\nseeds:   1, 2\nlocale:  en\n\nerror: TypeError: nope\n",
    );
  });

  it("gives a machine the numbers it measured, not the numbers it printed", () => {
    // The table rounds so that columns line up; JSON must not, because whatever
    // reads it can round for itself and cannot recover what was thrown away.
    const parsed: unknown = JSON.parse(
      formatReport(
        [run("Small scenario", { avgWaitTime: 12.345678901234 })],
        options({ json: true, seeds: ["rush-hour"] }),
      ),
    );

    expect(parsed).toEqual({
      program: "solution.js",
      seeds: ["rush-hour"],
      locale: "en",
      scenarios: [
        {
          description: "Small scenario",
          floorCount: 4,
          elevatorCount: 2,
          result: { avgWaitTime: 12.345678901234 },
        },
      ],
    });
  });

  it("says which building produced a number, whatever a building is made of", () => {
    // Two of the three shipped scenarios carry `elevatorCapacities`, which a
    // hand-written list of fields dropped -- and would go on dropping for every
    // world option added after it. The scenario is passed through whole instead.
    const scored = {
      options: {
        description: "Medium scenario",
        floorCount: 6,
        elevatorCount: 3,
        spawnRate: 1.5,
        elevatorCapacities: [5],
      },
      result: { avgWaitTime: 1 },
    };

    const parsed = JSON.parse(formatReport([scored], options({ json: true }))) as {
      scenarios: unknown;
    };

    expect(parsed.scenarios).toEqual([{ ...scored.options, result: scored.result }]);
  });

  it("reports a failure as JSON too, so nothing has to parse two shapes", () => {
    const parsed: unknown = JSON.parse(
      formatReport({ error: "TypeError: nope" }, options({ json: true })),
    );

    expect(parsed).toEqual({
      program: "solution.js",
      seeds: ["1", "2"],
      locale: "en",
      error: "TypeError: nope",
    });
  });

  it("writes the seeds back the same way whichever mode it is in", () => {
    // The default list is numbers and a typed list is strings; a report that
    // showed the difference would be inviting somebody to think the two are
    // different buildings, which -- `String(seed)` -- they are not.
    const parsed = JSON.parse(formatReport([], options({ json: true, seeds: fitnessSeeds }))) as {
      seeds: unknown;
    };

    expect(parsed.seeds).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});

describe("running the command", () => {
  beforeEach(() => {
    // The engine logs a failed program, and a program is free to print; both are
    // deliberately kept out of the report and would otherwise land in the test
    // output instead.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("scores the program and reports what the suite measured", async () => {
    const { streams: recorded, io } = streams({ "solution.js": DRIVING_PROGRAM });

    const code = await runBench(["solution.js", "--seeds", ONE_SEED.join(",")], io);

    expect(code).toBe(EXIT_OK);
    expect(recorded.err).toBe("");
    expect(recorded.out).toBe(
      formatReport(doFitnessSuite(DRIVING_PROGRAM, ONE_SEED), {
        programPath: "solution.js",
        seeds: ONE_SEED,
        locale: DEFAULT_LOCALE,
        json: false,
      }),
    );
  });

  it("prints the same numbers every time it is asked", async () => {
    // The whole reason for the seed list: a score that moved between runs could
    // not be a CI check, and two programs could not be told apart from a luckier
    // draw.
    const first = streams({ "solution.js": DRIVING_PROGRAM });
    const second = streams({ "solution.js": DRIVING_PROGRAM });

    await runBench(["solution.js", "--seeds", "3", "--json"], first.io);
    await runBench(["--json", "--seeds=3", "solution.js"], second.io);

    expect(second.streams.out).toBe(first.streams.out);
  });

  it("names the scenarios in the language it was asked for", async () => {
    const { streams: recorded, io } = streams({ "solution.js": DRIVING_PROGRAM });

    await runBench(["solution.js", "--seeds", "7", "--locale", "ru"], io);

    expect(recorded.out).toContain(translateIn("ru", "fitness.scenario.small"));
  });

  it("keeps everything the run printed out of the report", async () => {
    // A program being debugged prints, and the engine prints a failed program's
    // stack. On a page both go to a console nobody parses; here standard output
    // is the report, and one stray line through it is a `--json` that no longer
    // parses.
    const chatty = `{
      init: function () { console.log("thinking about it"); throw new Error("boom"); },
      update: function () {}
    }`;
    const { streams: recorded, io } = streams({ "solution.js": chatty });

    const code = await runBench(["solution.js", "--seeds", "7", "--json"], io);

    expect(code).toBe(EXIT_PROGRAM_FAILED);
    expect(JSON.parse(recorded.out)).toEqual({
      program: "solution.js",
      seeds: ["7"],
      locale: "en",
      error: "Error: boom",
    });
    expect(console.error).toHaveBeenCalledWith("thinking about it");
  });

  it("puts the console back the way it found it", async () => {
    const original = console.log;
    const { io } = streams({ "solution.js": "{ init: function () {}, update: function () {} }" });

    await runBench(["solution.js", "--seeds", "7"], io);

    expect(console.log).toBe(original);
  });

  it("says which file it could not read, and reports nothing at all", async () => {
    const { streams: recorded, io } = streams();

    const code = await runBench(["missing.js"], io);

    expect(code).toBe(EXIT_USAGE);
    expect(recorded.out).toBe("");
    expect(recorded.err).toContain("Could not read missing.js:");
    expect(recorded.err).toContain("ENOENT");
  });

  it("answers a bad argument with the usage, on the stream diagnostics go to", async () => {
    const { streams: recorded, io } = streams({ "solution.js": DRIVING_PROGRAM });

    const code = await runBench(["solution.js", "--locale", "kl"], io);

    expect(code).toBe(EXIT_USAGE);
    expect(recorded.out).toBe("");
    expect(recorded.err).toBe(`Unknown locale: kl. Known: en, ru\n\n${USAGE}`);
  });

  it("prints the usage on request, as a result rather than as a complaint", async () => {
    const { streams: recorded, io } = streams();

    const code = await runBench(["--help"], io);

    expect(code).toBe(EXIT_OK);
    expect(recorded.out).toBe(USAGE);
    expect(recorded.err).toBe("");
  });
});

describe("moving a run's output off standard output", () => {
  it("hands back what the run returned and restores the console even when it throws", () => {
    const before = { log: console.log, info: console.info, debug: console.debug };

    expect(withRunOutputOnStandardError(() => 42)).toBe(42);
    expect(() =>
      withRunOutputOnStandardError(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(console.log).toBe(before.log);
    expect(console.info).toBe(before.info);
    expect(console.debug).toBe(before.debug);
  });

  it("reroutes every stream that would otherwise land in the report", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    withRunOutputOnStandardError(() => {
      console.log("log");
      console.info("info");
      console.debug("debug");
    });

    expect(errors.mock.calls).toEqual([["log"], ["info"], ["debug"]]);
  });

  it("leaves the streams that already go to standard error alone", () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const before = console.warn;

    withRunOutputOnStandardError(() => {
      expect(console.warn).toBe(before);
    });

    expect(warnings).not.toHaveBeenCalled();
  });
});
