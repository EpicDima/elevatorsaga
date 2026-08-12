/**
 * The thread the benchmark command runs a program in, driven without a thread.
 *
 * `bench-worker.ts` has no exported behaviour: it reads its request from
 * `workerData` when the module is evaluated, runs the suite, and posts the
 * answer back through `parentPort`. So the module *is* the unit, and the way to
 * exercise it is to give it the two things it reaches for and import it -- the
 * same shape `fitness.test.ts` uses on the browser worker it mirrors, with a
 * mocked `node:worker_threads` standing in for that file's stand-in `self`.
 *
 * Worth doing rather than leaving to `bench.cli.test.ts`, which runs the real
 * thread in a real command: a worker is a separate isolate, so nothing that
 * happens inside one is measured by a coverage run, and the parts of this module
 * that only matter when something is wrong -- an unknown locale, being pointed
 * at directly -- would be exercised by nothing at all.
 */

import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { doFitnessSuite, type FitnessSuiteResult } from "../game/fitness.ts";
import { DEFAULT_LOCALE, setLocale, translateIn } from "../i18n/index.ts";
import type { BenchWorkerRequest } from "./bench-worker.ts";

/**
 * What the mocked `node:worker_threads` hands the module under test.
 *
 * `vi.hoisted` because `vi.mock` factories are lifted above the imports and
 * would otherwise close over a binding that does not exist yet.
 */
const thread = vi.hoisted(
  (): {
    workerData: BenchWorkerRequest | undefined;
    parentPort: { postMessage: (message: unknown) => void } | null;
  } => ({
    workerData: undefined,
    parentPort: null,
  }),
);

// Getters rather than values: the module reads both at import time, and each
// case sets them before importing.
vi.mock("node:worker_threads", () => ({
  // The module under test imports `./bench.ts` for one function, and that file
  // reads this to decide whether being loaded means being run. False is the
  // truth here -- this is the worker side -- and it is also what keeps the
  // command from running itself in the middle of a test.
  isMainThread: false,
  // Imported by `./bench.ts` beside `isMainThread`, and never reached from this
  // side: the thread that runs a program does not start threads of its own. A
  // stub that throws says so, rather than quietly standing in for one.
  Worker: function WorkerStub(): never {
    throw new Error("The benchmark worker does not start workers.");
  },
  get workerData(): unknown {
    return thread.workerData;
  },
  get parentPort(): { postMessage: (message: unknown) => void } | null {
    return thread.parentPort;
  },
}));

/** A program that delivers people, so the answer holds numbers rather than zeroes. */
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
  update: function () {}
}`;

/** One seed, because none of this is about how many buildings there are. */
const ONE_SEED = ["1"];

/**
 * Runs the module once with a request in front of it.
 *
 * @param request - What the command would have sent.
 * @returns Everything the module posted back.
 */
async function runWorker(request: BenchWorkerRequest): Promise<FitnessSuiteResult[]> {
  const posted: FitnessSuiteResult[] = [];
  thread.workerData = request;
  thread.parentPort = {
    postMessage: (message: unknown) => {
      posted.push(message as FitnessSuiteResult);
    },
  };
  // Without this the second import in the file is served from the registry and
  // the module body -- which is the whole of the behaviour -- never runs again.
  vi.resetModules();
  await import("./bench-worker.ts");
  return posted;
}

beforeEach(() => {
  // The engine logs a failed program and its stack, and the module deliberately
  // puts everything a run prints on standard error -- which, here, is the test
  // run's own output. Silenced rather than asserted on: what lands on which
  // stream is `bench.test.ts`'s subject, and this file would be reading its own
  // console.
  vi.spyOn(process.stderr, "write").mockImplementation((...args: unknown[]) => {
    // The flush at the end of the module waits for this callback, and a stream
    // that never called it back would hang the import.
    const callback = args.find((argument) => typeof argument === "function");
    if (callback !== undefined) {
      (callback as () => void)();
    }
    return true;
  });
});

afterEach(() => {
  // The module sets the active locale, and this process shares one with it.
  setLocale(DEFAULT_LOCALE);
  thread.workerData = undefined;
  thread.parentPort = null;
  vi.restoreAllMocks();
});

describe("the benchmark worker", () => {
  it("scores the request on the seeds it was given and posts the answer back", async () => {
    const posted = await runWorker({ code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "en" });

    // The same numbers the command would have got by running the suite itself:
    // a thread is where the run happens, not something the run is measured
    // against.
    expect(posted).toEqual([doFitnessSuite(DRIVING_PROGRAM, ONE_SEED)]);
  }, 30_000);

  it("names the scenarios in the language the request carried", async () => {
    // Why the locale travels with the request at all. A worker is a second
    // instance of every module, with an active locale of its own that starts at
    // the default however the command set its own -- so a `--locale ru` run
    // reported English scenario names until the request began saying so.
    const posted = await runWorker({ code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "ru" });

    const [result] = posted;
    expect(Array.isArray(result)).toBe(true);
    expect(Array.isArray(result) ? result[0]?.options.description : undefined).toBe(
      translateIn("ru", "fitness.scenario.small"),
    );
  }, 30_000);

  it("reports a program that threw rather than throwing itself", async () => {
    // A failed program is an answer, and it has to come back through the same
    // door as a good one: a thread that threw would reach the command as a
    // worker error, which is what it says when the *thread* is broken.
    const posted = await runWorker({
      code: `{ init: function () { throw new Error("boom"); }, update: function () {} }`,
      seeds: ONE_SEED,
      locale: "en",
    });

    expect(posted).toEqual([{ error: "Error: boom" }]);
  }, 30_000);

  it("says what it is when it is run as a command instead of as a thread", async () => {
    // `node src/cli/bench-worker.ts` gets no port, and every path below the
    // check ends in posting through one. Without the check the module runs the
    // whole suite and then throws on a null read -- or, worse, is edited into
    // returning quietly, which is a command that exits 0 having reported
    // nothing.
    thread.workerData = { code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "en" };
    thread.parentPort = null;
    vi.resetModules();

    await expect(import("./bench-worker.ts")).rejects.toThrow(/run src\/cli\/bench\.ts instead/);
  });
});
