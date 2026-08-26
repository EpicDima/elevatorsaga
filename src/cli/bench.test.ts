import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKER_TIMEOUT_MS } from "../app/fitness.ts";
import {
  doFitnessSuite,
  fitnessSeeds,
  type AveragedFitnessRun,
  type FitnessSuiteResult,
} from "../game/fitness.ts";
import { seconds, setLocale, translateIn, DEFAULT_LOCALE } from "../i18n/index.ts";
import {
  formatReport,
  parseBenchArgs,
  runBench,
  runSuiteInWorker,
  withRunOutputOnStandardError,
  BenchUsageError,
  DEFAULT_TIMEOUT_MS,
  EXIT_OK,
  EXIT_PROGRAM_FAILED,
  EXIT_USAGE,
  USAGE,
  type BenchIo,
  type BenchOptions,
} from "./bench.ts";

/** A program that actually delivers people, so the report holds numbers rather than zeroes. */
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

/** Runs the suite on this thread rather than in the worker {@link runBench} normally uses. */
function runSuiteHere(code: string, benchOptions: BenchOptions): Promise<FitnessSuiteResult> {
  return Promise.resolve(
    withRunOutputOnStandardError(() => doFitnessSuite(code, benchOptions.seeds)),
  );
}

/** Builds the pair {@link runBench} writes through. */
function streams(
  files: Readonly<Record<string, string>> = {},
  runSuite: BenchIo["runSuite"] = runSuiteHere,
): {
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
      runSuite,
      write: (text) => {
        recorded.out += text;
      },
      writeError: (text) => {
        recorded.err += text;
      },
    },
  };
}

function options(overrides: Partial<BenchOptions> = {}): BenchOptions {
  return {
    programPath: "solution.js",
    seeds: ["1", "2"],
    locale: "en",
    json: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...overrides,
  };
}

/** The guide that shows a player a benchmark run and the numbers it produces. */
const GUIDE_PATH = fileURLToPath(new URL("../../docs/writing-solutions.md", import.meta.url));

/**
 * The worked example from the guide, paired the way a reader pairs it: the report is found by the
 * program it names, and the program is the fenced js block directly above it.
 *
 * @throws If the guide no longer shows both, since then nothing is being checked.
 */
function guideBenchmark(): { program: string; report: string } {
  const guide = readFileSync(GUIDE_PATH, "utf8");
  const reported = /```\n(program: sweep\.js\n[\s\S]*?)```/.exec(guide);
  const report = reported?.[1];
  if (reported === null || report === undefined) {
    throw new Error("docs/writing-solutions.md prints no benchmark report for sweep.js");
  }
  const program = [...guide.slice(0, reported.index).matchAll(/```js\n([\s\S]*?)```/g)].at(-1)?.[1];
  if (program === undefined) {
    throw new Error("docs/writing-solutions.md shows no program above sweep.js's report");
  }
  return { program, report };
}

/** Builds a scored scenario. */
function run(description: string, result: Record<string, number>): AveragedFitnessRun {
  return {
    options: { description, floorCount: 4, elevatorCount: 2 },
    result,
  };
}

/** Silences a real stream and records what was written to it, since a run prints through a console of the command's own making. */
function recordStream(stream: NodeJS.WriteStream): () => string {
  const written = vi.spyOn(stream, "write").mockImplementation((...args: unknown[]) => {
    // A stream must call back or `console.log` would hang waiting for it.
    const callback = args.find((argument) => typeof argument === "function");
    if (callback !== undefined) {
      (callback as () => void)();
    }
    return true;
  });
  return () => written.mock.calls.map(([chunk]) => String(chunk)).join("");
}

afterEach(() => {
  // `--locale ru` sets the active locale for the module, not just for its own test.
  setLocale(DEFAULT_LOCALE);
  // Console spies otherwise outlive the test that installed them.
  vi.restoreAllMocks();
});

describe("reading the command line", () => {
  it("takes the program and scores it on the buildings the game uses", () => {
    // The default seed list is the shipped one, so a score is comparable with the page's.
    expect(parseBenchArgs(["solution.js"])).toEqual({
      kind: "run",
      options: {
        programPath: "solution.js",
        seeds: fitnessSeeds,
        locale: DEFAULT_LOCALE,
        json: false,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    });
  });

  it("reads an option whether it is written with a space or with an equals sign", () => {
    expect(parseBenchArgs(["solution.js", "--seeds", "3,4", "--locale", "ru"])).toEqual(
      parseBenchArgs(["--seeds=3,4", "--locale=ru", "solution.js"]),
    );
  });

  it("keeps a seed exactly as it was typed", () => {
    // `createRandomSource` hashes `String(seed)`, so a label reproduces as exactly as a number.
    const request = parseBenchArgs(["solution.js", "--seeds", "rush-hour, 7 ,003"]);

    expect(request).toEqual({
      kind: "run",
      options: {
        programPath: "solution.js",
        seeds: ["rush-hour", "7", "003"],
        locale: DEFAULT_LOCALE,
        json: false,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    });
  });

  it("refuses a seed list with a hole in it", () => {
    // An empty seed still hashes to a building, so `1,,2` would silently score a fourth one.
    expect(() => parseBenchArgs(["solution.js", "--seeds", "1,,2"])).toThrow(BenchUsageError);
  });

  it("gives the program the same minute the page gives it, unless told otherwise", () => {
    // Asserted against the page's own constant so the two cannot drift apart unnoticed.
    expect(DEFAULT_TIMEOUT_MS).toBe(WORKER_TIMEOUT_MS);
    expect(parseBenchArgs(["solution.js"])).toMatchObject({
      options: { timeoutMs: DEFAULT_TIMEOUT_MS },
    });
    expect(parseBenchArgs(["solution.js", "--timeout", "5"])).toMatchObject({
      options: { timeoutMs: 5000 },
    });
  });

  it("refuses a deadline that is not a whole number of seconds it could wait", () => {
    // The last three are numbers JavaScript reads happily but this option does not: a hex 16, an exponent, and a padded 5, which `Number.isInteger` accepts.
    for (const value of ["60s", "abc", "1.5", "0", "-1", "Infinity", "", "0x10", "1e3", " 5 "]) {
      expect(() => parseBenchArgs(["solution.js", `--timeout=${value}`])).toThrow(BenchUsageError);
    }
    expect(() => parseBenchArgs(["solution.js", "--timeout", "60s"])).toThrow(
      /--timeout takes a whole number of seconds, 1 to 2147483; got 60s\./,
    );
  });

  it("refuses a deadline longer than a timer can be asked to wait", () => {
    // `setTimeout` holds its delay in a signed 32-bit integer of milliseconds and rewrites anything longer to 1, so a 24.9-day deadline would fire at once.
    const largest = parseBenchArgs(["solution.js", "--timeout=2147483"]);
    expect(largest).toMatchObject({ kind: "run", options: { timeoutMs: 2_147_483_000 } });
    // `NaN` fails the comparison below rather than passing it vacuously.
    const largestMs = largest.kind === "run" ? largest.options.timeoutMs : Number.NaN;
    expect(largestMs).toBeLessThanOrEqual(2 ** 31 - 1);
    for (const value of ["2147484", "3000000", "9007199254740991"]) {
      expect(() => parseBenchArgs(["solution.js", `--timeout=${value}`])).toThrow(
        /--timeout takes a whole number of seconds, 1 to 2147483/,
      );
    }
  });

  it("refuses a language this build has no catalog for", () => {
    expect(() => parseBenchArgs(["solution.js", "--locale", "kl"])).toThrow(/Unknown locale: kl/);
  });

  it("refuses an option it does not know instead of treating it as a file name", () => {
    expect(() => parseBenchArgs(["solution.js", "--runs=5"])).toThrow(/Unknown option: --runs=5/);
  });

  it("refuses an option that was given no value", () => {
    expect(() => parseBenchArgs(["solution.js", "--seeds"])).toThrow(/--seeds needs a value/);
  });

  it("refuses to read the next option as the value of this one", () => {
    // Taken as a value, `--seeds --json` would silently score one nonsense building; a dash-prefixed seed is legitimate, so the refusal explains how to insist.
    expect(() => parseBenchArgs(["solution.js", "--seeds", "--json"])).toThrow(
      /--seeds needs a value, and --json looks like another option\. Write --seeds=--json/,
    );
    expect(parseBenchArgs(["solution.js", "--seeds=-1"])).toMatchObject({
      options: { seeds: ["-1"] },
    });
  });

  it("refuses an option that was given twice, however each one was spelled", () => {
    // Either reading -- first wins, last wins -- is a guess that could score a building nobody asked for.
    expect(() => parseBenchArgs(["a.js", "--seeds", "1", "--seeds", "2"])).toThrow(
      /--seeds was given more than once/,
    );
    expect(() => parseBenchArgs(["a.js", "--seeds=1", "--seeds", "2"])).toThrow(BenchUsageError);
    expect(() => parseBenchArgs(["a.js", "--locale=en", "--locale=ru"])).toThrow(BenchUsageError);
    expect(() => parseBenchArgs(["a.js", "--json", "--json"])).toThrow(/--json was given more/);
  });

  it("refuses a value for the option that has none", () => {
    // `--json=false` reads like switching JSON off but would switch it on.
    expect(() => parseBenchArgs(["a.js", "--json=false"])).toThrow(
      /--json takes no value, but was given false/,
    );
  });

  it("benchmarks a file whose name begins with a dash when told where options end", () => {
    expect(parseBenchArgs(["--json", "--", "--strange-name.js"])).toEqual({
      kind: "run",
      options: {
        programPath: "--strange-name.js",
        seeds: fitnessSeeds,
        locale: DEFAULT_LOCALE,
        json: true,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    });
    // Everything after `--` is a file name, even words that are options before it.
    expect(parseBenchArgs(["--", "-h"])).toMatchObject({ options: { programPath: "-h" } });
    expect(() => parseBenchArgs(["--", "a.js", "--json"])).toThrow(/a\.js and --json/);
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
    // `makeAverageResult` averages whatever properties the result carried, so a new simulation metric appears here without this file changing.
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
    // The table rounds so that columns line up; JSON must not, since whatever reads it can round for itself but cannot recover what was thrown away.
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
    // A hand-written list of fields would drop any world option added later (like `elevatorCapacities`), so the scenario is passed through whole instead.
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
    // The default list is numbers and a typed list is strings; showing the difference would wrongly suggest the two are different buildings.
    const parsed = JSON.parse(formatReport([], options({ json: true, seeds: fitnessSeeds }))) as {
      seeds: unknown;
    };

    expect(parsed.seeds).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("prints what the guide says it prints, figure for figure", () => {
    // The guide hands a player a program and the report it scores, and promises the same numbers
    // on any machine. Nothing else reads that table, so without this every figure in it goes
    // stale the first time the simulation is touched -- which is how all fifteen once did.
    const { program, report } = guideBenchmark();
    setLocale("en");

    const scored = doFitnessSuite(program, fitnessSeeds);

    expect(formatReport(scored, options({ programPath: "sweep.js", seeds: fitnessSeeds }))).toBe(
      report,
    );
  });
});

describe("running the command", () => {
  /** Everything a run printed, which lands on the real standard error. */
  let printed: () => string;

  beforeEach(() => {
    // The engine logs a failed program, and a program is free to print; both are deliberately kept out of the report and would otherwise land in the test output.
    printed = recordStream(process.stderr);
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
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }),
    );
  });

  it("prints the same numbers every time it is asked", async () => {
    // The whole reason for the seed list: a score that moved between runs could not be a CI check, and two programs could not be told apart from a luckier draw.
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
    // A program being debugged prints, and the engine prints a failed program's stack; standard output here is the report, so one stray line is a `--json` that no longer parses.
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
    expect(printed()).toContain("thinking about it");
  });

  it("puts the console back the way it found it", async () => {
    const original = globalThis.console;
    const { io } = streams({ "solution.js": "{ init: function () {}, update: function () {} }" });

    await runBench(["solution.js", "--seeds", "7"], io);

    expect(globalThis.console).toBe(original);
  });

  it("says this tool broke rather than blaming a program it never ran", async () => {
    // A broken benchmark -- a thread that will not start, a syntax error in the module -- fails identically for every program, so reporting it as a broken program would wrongly fail a whole directory of good solutions.
    const { streams: recorded, io } = streams({ "solution.js": DRIVING_PROGRAM }, () =>
      Promise.reject(new SyntaxError("Expression expected")),
    );

    const code = await runBench(["solution.js", "--seeds", "7"], io);

    expect(code).toBe(EXIT_USAGE);
    expect(recorded.out).toBe("");
    expect(recorded.err).toBe("The benchmark could not be run: Expression expected\n");
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

describe("running the suite where it can be stopped", () => {
  /** Builds bench options with a deadline short enough to wait for. */
  function toRun(overrides: Partial<BenchOptions> = {}): BenchOptions {
    return options({ seeds: ONE_SEED, timeoutMs: 2000, ...overrides });
  }

  beforeEach(() => {
    // A real thread prints through real streams, and a failed program's stack would land in the test output.
    recordStream(process.stderr);
  });

  it("hands back what the thread measured, which is what running it here gives", async () => {
    // A thread is where the run happens, not something the run is measured against: the same program and seed must produce the same numbers here.
    const measured = await runSuiteInWorker(DRIVING_PROGRAM, toRun());

    expect(measured).toEqual(
      withRunOutputOnStandardError(() => doFitnessSuite(DRIVING_PROGRAM, ONE_SEED)),
    );
  }, 30_000);

  it("stops a program that will not stop and says how long it waited", async () => {
    // Nothing inside the language can interrupt `while (true)`, and a run of it here would have taken the test process with it rather than failing this case.
    const measured = await runSuiteInWorker(
      `{ init: function () { while (true) {} }, update: function () {} }`,
      toRun({ timeoutMs: 1000 }),
    );

    expect(measured).toEqual({
      error: translateIn("en", "fitness.workerTimeout", { seconds: seconds(1) }),
    });
  }, 30_000);

  it("answers for a thread that ends without answering", async () => {
    // `process.exit()` ends the thread with no message and nothing to report, so an unanswered run looks just like the deadline's own failure mode.
    const measured = await runSuiteInWorker(
      `{ init: function () { process.exit(0); }, update: function () {} }`,
      toRun(),
    );

    expect(measured).toEqual({ error: translateIn("en", "fitness.workerFailed") });
  }, 30_000);
});

describe("moving a run's output off standard output", () => {
  /** Watches both real streams a console can reach. */
  function watchStreams(): { out: () => string; err: () => string } {
    return { out: recordStream(process.stdout), err: recordStream(process.stderr) };
  }

  it("hands back what the run returned and restores the console even when it throws", () => {
    const before = globalThis.console;

    expect(withRunOutputOnStandardError(() => 42)).toBe(42);
    expect(() =>
      withRunOutputOnStandardError(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(globalThis.console).toBe(before);
  });

  it("leaves nothing a run prints on standard output", () => {
    const watched = watchStreams();

    withRunOutputOnStandardError(() => {
      // Console methods beyond `log` -- `dir`, `table`, `group`, `count` -- also write to standard output, and one reaching the report is a `--json` that no longer parses.
      console.log("logged");
      console.info("informed");
      console.debug("debugged");
      console.dir({ inspected: true });
      console.table([{ tabulated: 1 }]);
      console.group("grouped");
      console.groupEnd();
      console.count("counted");
      console.trace("traced");
      console.warn("warned");
      console.error("failed");
    });

    expect(watched.out()).toBe("");
    const printed = watched.err();
    for (const line of [
      "logged",
      "informed",
      "debugged",
      "inspected",
      "tabulated",
      "grouped",
      "counted",
      "traced",
      "warned",
      "failed",
    ]) {
      expect(printed).toContain(line);
    }
  });

  it("keeps writing the report to standard output while a run is under way", () => {
    const watched = watchStreams();

    withRunOutputOnStandardError(() => {
      // What `runBench` does with the result: the io writes the report through the stream directly, and swapping the console must not touch it.
      process.stdout.write("the report");
    });

    expect(watched.out()).toBe("the report");
  });

  it("puts the console back where it found it, whoever swapped it first", () => {
    // The engine logs through whatever `globalThis.console` is at the time, so restoring by identity rather than reassigning is what keeps a surrounding spy alive.
    const swapped = { ...console };
    const before = globalThis.console;
    globalThis.console = swapped;
    try {
      withRunOutputOnStandardError(() => undefined);
      expect(globalThis.console).toBe(swapped);
    } finally {
      globalThis.console = before;
    }
  });
});
