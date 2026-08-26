/** Exercises `bench-worker.ts` by importing it directly, since the module body is the whole unit. */

import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { doFitnessSuite, type FitnessSuiteResult } from "../game/fitness.ts";
import { DEFAULT_LOCALE, setLocale, translateIn } from "../i18n/index.ts";
import type { BenchWorkerRequest } from "./bench-worker.ts";

/** What the mocked `node:worker_threads` hands the module under test; `vi.hoisted` because `vi.mock` factories run before the import they close over exists. */
const thread = vi.hoisted(
  (): {
    workerData: BenchWorkerRequest | undefined;
    parentPort: { postMessage: (message: unknown) => void } | null;
  } => ({
    workerData: undefined,
    parentPort: null,
  }),
);

// Getters rather than values: the module reads both at import time, and each case sets them before importing.
vi.mock("node:worker_threads", () => ({
  // `./bench.ts` reads this to decide whether being loaded means being run; false here also keeps the command from running itself mid-test.
  isMainThread: false,
  // The thread that runs a program never starts threads of its own, so a stub that throws says so rather than quietly standing in for one.
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

/** Runs the module once with a request in front of it. */
async function runWorker(request: BenchWorkerRequest): Promise<FitnessSuiteResult[]> {
  const posted: FitnessSuiteResult[] = [];
  thread.workerData = request;
  thread.parentPort = {
    postMessage: (message: unknown) => {
      posted.push(message as FitnessSuiteResult);
    },
  };
  // Without this the second import is served from the registry, and the module body -- which is the whole of the behavior -- never runs again.
  vi.resetModules();
  await import("./bench-worker.ts");
  return posted;
}

/** Whatever was listening for a failure before a case imported the module. */
let listenersBefore: { uncaughtException: unknown[]; unhandledRejection: unknown[] } = {
  uncaughtException: [],
  unhandledRejection: [],
};

/** Removes the listeners the module under test installed on `process`, so they do not go on swallowing every later failure in this test run. */
function takeOffModuleListeners(): void {
  for (const listener of process.listeners("uncaughtException")) {
    if (!listenersBefore.uncaughtException.includes(listener)) {
      process.off("uncaughtException", listener);
    }
  }
  for (const listener of process.listeners("unhandledRejection")) {
    if (!listenersBefore.unhandledRejection.includes(listener)) {
      process.off("unhandledRejection", listener);
    }
  }
}

beforeEach(() => {
  listenersBefore = {
    uncaughtException: process.listeners("uncaughtException"),
    unhandledRejection: process.listeners("unhandledRejection"),
  };
  // The module puts everything a run prints on standard error, which here is the test run's own output; silenced since what lands on which stream is `bench.test.ts`'s subject.
  vi.spyOn(process.stderr, "write").mockImplementation((...args: unknown[]) => {
    // The flush at the end of the module waits for this callback, and a stream that never called it back would hang the import.
    const callback = args.find((argument) => typeof argument === "function");
    if (callback !== undefined) {
      (callback as () => void)();
    }
    return true;
  });
});

afterEach(() => {
  takeOffModuleListeners();
  // The module sets the active locale, and this process shares one with it.
  setLocale(DEFAULT_LOCALE);
  thread.workerData = undefined;
  thread.parentPort = null;
  vi.restoreAllMocks();
});

describe("the benchmark worker", () => {
  it("scores the request on the seeds it was given and posts the answer back", async () => {
    const posted = await runWorker({ code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "en" });

    // The same numbers the command would have got running the suite itself: a thread is where the run happens, not something the run is measured against.
    expect(posted).toEqual([doFitnessSuite(DRIVING_PROGRAM, ONE_SEED)]);
  }, 30_000);

  it("names the scenarios in the language the request carried", async () => {
    // A worker is a second instance of every module, with its own active locale that starts at the default regardless of the command's.
    const posted = await runWorker({ code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "ru" });

    const [result] = posted;
    expect(Array.isArray(result)).toBe(true);
    expect(Array.isArray(result) ? result[0]?.options.description : undefined).toBe(
      translateIn("ru", "fitness.scenario.small"),
    );
  }, 30_000);

  it("reports a program that threw rather than throwing itself", async () => {
    // A failed program is an answer, and it has to come back through the same door as a good one: a worker error is what it says when the *thread* is broken.
    const posted = await runWorker({
      code: `{ init: function () { throw new Error("boom"); }, update: function () {} }`,
      seeds: ONE_SEED,
      locale: "en",
    });

    expect(posted).toEqual([{ error: "Error: boom" }]);
  }, 30_000);

  it("is still listening for a failure once the answer has been posted", async () => {
    // Taking the listeners off after the first answer looks tidy but is the bug: `init` runs again per scenario, and a later failure would end the thread before the command could read the report.
    const posted = await runWorker({ code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "en" });

    expect(posted).toHaveLength(1);
    expect(process.listeners("uncaughtException")).toHaveLength(
      listenersBefore.uncaughtException.length + 1,
    );
    expect(process.listeners("unhandledRejection")).toHaveLength(
      listenersBefore.unhandledRejection.length + 1,
    );
  }, 30_000);

  it("says what it is when it is run as a command instead of as a thread", async () => {
    // Run directly, the module gets no port, and every path below this check ends in posting through one; without it, a null read throws.
    thread.workerData = { code: DRIVING_PROGRAM, seeds: ONE_SEED, locale: "en" };
    thread.parentPort = null;
    vi.resetModules();

    await expect(import("./bench-worker.ts")).rejects.toThrow(/run src\/cli\/bench\.ts instead/);
  });
});
