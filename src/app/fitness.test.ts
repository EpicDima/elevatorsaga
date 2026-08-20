import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  doFitnessSuite,
  fitnessSeeds,
  type AveragedFitnessRun,
  type FitnessSuiteResult,
} from "../game/fitness.ts";
import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import { describeFitnessResults, runFitnessSuite, type FitnessWorkerLike } from "./fitness.ts";
import type { FitnessWorkerRequest, FitnessWorkerResponse } from "./fitness-worker.ts";

/** The space Russian typography wants between a number and its unit. */
const NBSP = "\u00a0";

/** Three of them, which is what the report puts between one scenario and the next. */
const COLUMN_GAP = "\u00a0\u00a0\u00a0";

/**
 * A program that actually drives the elevators, as source rather than an object.
 *
 * The benchmark measures wait times, and code that never moves an elevator scores
 * every seed identically -- nobody is ever delivered -- which would let a test
 * about seeds pass without the seeds doing anything. This sweeps every elevator
 * through every floor, so different traffic produces different numbers.
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

/** A worker stand-in whose replies the test drives. */
class FakeWorker implements FitnessWorkerLike {
  onmessage: ((event: MessageEvent<FitnessSuiteResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  /** Everything that was posted to this worker. */
  readonly posted: FitnessWorkerRequest[] = [];
  /** How often the worker was shut down. */
  terminateCount = 0;

  postMessage(message: FitnessWorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  /**
   * Replies with a suite result.
   *
   * @param result - What the worker computed.
   */
  reply(result: FitnessSuiteResult): void {
    this.onmessage?.({ data: result } as MessageEvent<FitnessSuiteResult>);
  }

  /**
   * Fails the way a broken worker would.
   *
   * @param message - The error message of the event.
   */
  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

/**
 * Builds an averaged run for the given scenario.
 *
 * @param description - The scenario name.
 * @param avgWaitTime - The averaged wait time, if any was recorded.
 * @returns The run.
 */
function run(description: string, avgWaitTime?: number): AveragedFitnessRun {
  return {
    options: { description, floorCount: 4, elevatorCount: 2 },
    result: avgWaitTime === undefined ? {} : { avgWaitTime },
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  // For the tests that set a language on this file's own module instance to see
  // what the main thread does with it -- the locale is module state and would
  // otherwise be inherited by every test after them. The worker tests are not
  // why: those reset the module registry and set the language on a graph of
  // their own, which is the point of them, and clean it up themselves.
  setLocale(DEFAULT_LOCALE);
});

describe("runFitnessSuite in a worker", () => {
  it("hands the player code to the worker and resolves with its answer", async () => {
    const worker = new FakeWorker();
    const results = [run("Small scenario", 12.5)];

    const suite = runFitnessSuite("var x = 1;", { createWorker: () => worker });
    expect(worker.posted).toEqual([{ code: "var x = 1;", locale: "en" }]);
    worker.reply(results);

    await expect(suite).resolves.toEqual(results);
  });

  it("tells the worker which language to report in", async () => {
    // A worker is a second module instance with its own active locale, and
    // nothing this page does to its own reaches it. Without this the report
    // would name its scenarios -- and quote the player's own error -- in
    // English on a Russian page, while the main-thread fallback of the very
    // same function answered in Russian.
    const worker = new FakeWorker();
    setLocale("ru");

    const suite = runFitnessSuite("var x = 1;", { createWorker: () => worker });
    expect(worker.posted).toEqual([{ code: "var x = 1;", locale: "ru" }]);
    worker.reply([]);

    await suite;
  });

  it("shuts the worker down once the result is in", async () => {
    const worker = new FakeWorker();

    const suite = runFitnessSuite("code", { createWorker: () => worker });
    worker.reply([]);
    await suite;

    expect(worker.terminateCount).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it("reports a broken worker instead of hanging forever", async () => {
    const worker = new FakeWorker();

    const suite = runFitnessSuite("code", { createWorker: () => worker });
    worker.fail("Boom");

    await expect(suite).resolves.toEqual({ error: "Boom" });
    expect(worker.terminateCount).toBe(1);
  });

  it("still reports something when the error event carries no message", async () => {
    const worker = new FakeWorker();

    const suite = runFitnessSuite("code", { createWorker: () => worker });
    worker.fail("");

    await expect(suite).resolves.toEqual({ error: "The fitness worker failed" });
  });

  it("ignores a second reply from the worker", async () => {
    const worker = new FakeWorker();
    const first = [run("Small scenario", 1)];

    const suite = runFitnessSuite("code", { createWorker: () => worker });
    const { onmessage } = worker;
    worker.reply(first);
    onmessage?.({ data: [run("Small scenario", 99)] } as MessageEvent<FitnessSuiteResult>);

    await expect(suite).resolves.toEqual(first);
  });

  describe("when the player program never returns", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      return () => {
        vi.useRealTimers();
      };
    });

    it("gives up on the worker and stops it", async () => {
      // A `while (true)` in update() posts no message and raises no error, so
      // the promise used to hang and the worker used to spin a core until the
      // tab was closed -- once per call, since nothing terminated it either.
      const worker = new FakeWorker();

      const suite = runFitnessSuite("while (true) {}", {
        createWorker: () => worker,
        timeoutMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(1000);

      await expect(suite).resolves.toEqual({
        error:
          "The fitness worker did not finish within 1s and was stopped. " +
          "Does your program have a loop that never ends?",
      });
      expect(worker.terminateCount).toBe(1);
      expect(worker.onmessage).toBeNull();
      expect(worker.onerror).toBeNull();
    });

    it("gives up in the language the page is in", async () => {
      // The one sentence in the report that is not the worker's to write: a
      // worker that has not answered in a minute is one that never will, so
      // this side has to say it, in this side's language.
      const worker = new FakeWorker();
      setLocale("ru");

      const suite = runFitnessSuite("while (true) {}", {
        createWorker: () => worker,
        timeoutMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(1000);

      await expect(suite).resolves.toEqual({
        error:
          `Воркер оценки эффективности не закончил работу за 1${NBSP}с и был остановлен. ` +
          "Нет ли в вашей программе бесконечного цикла?",
      });
    });

    it("waits for the whole timeout before giving up", async () => {
      const worker = new FakeWorker();
      const settled = vi.fn();

      const suite = runFitnessSuite("code", { createWorker: () => worker, timeoutMs: 1000 });
      void suite.then(settled);
      await vi.advanceTimersByTimeAsync(999);

      expect(settled).not.toHaveBeenCalled();
      expect(worker.terminateCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1);
      await suite;
      expect(settled).toHaveBeenCalledTimes(1);
    });

    it("does not fire the timeout for a worker that answered in time", async () => {
      const worker = new FakeWorker();
      const results = [run("Small scenario", 3)];

      const suite = runFitnessSuite("code", { createWorker: () => worker, timeoutMs: 1000 });
      worker.reply(results);
      await vi.advanceTimersByTimeAsync(5000);

      await expect(suite).resolves.toEqual(results);
      expect(worker.terminateCount).toBe(1);
    });
  });
});

describe("runFitnessSuite without a worker", () => {
  it("runs on the main thread when the worker cannot be created", async () => {
    // Code that cannot be compiled is rejected before any world is simulated,
    // which keeps this exercise of the fallback path fast.
    const suite = runFitnessSuite("{}", {
      createWorker: () => {
        throw new Error("Workers are not available");
      },
    });

    await expect(suite).resolves.toEqual({ error: "Error: Code must contain an init function" });
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not even try a worker when asked not to", async () => {
    const createWorker = vi.fn(() => new FakeWorker());

    await runFitnessSuite("{}", { preferWorker: false, createWorker });

    expect(createWorker).not.toHaveBeenCalled();
  });

  it("scores the fallback on the first of the shipped seeds", async () => {
    // The fallback runs fewer buildings than the worker, because it freezes the
    // page while it does -- but it takes them off the front of the same list
    // rather than choosing its own, so it measures a subset of the same
    // buildings and is reproducible in the same way. This pins both the prefix
    // and the count it stops at, which is a deliberate choice rather than a
    // detail.
    //
    // Timed out on GitHub at the five-second default, and carries its own for
    // the same reason the worker case below does: pinning what the fallback
    // scores means scoring it twice over by hand as well, fifteen simulated
    // buildings between them. That is 0.3 s uninstrumented and between 1.9 s
    // and 3.6 s under coverage depending on what shares the machine -- so what
    // the default was measuring is a runner's spare capacity, not this module.
    const fallback = await runFitnessSuite(DRIVING_PROGRAM, { preferWorker: false });

    expect(fallback).toEqual(doFitnessSuite(DRIVING_PROGRAM, fitnessSeeds.slice(0, 2)));
    expect(fallback).not.toEqual(doFitnessSuite(DRIVING_PROGRAM, fitnessSeeds.slice(0, 1)));
    // Without this the assertion above would still hold if the shipped list were
    // shortened to two, and the fallback would silently have become the whole
    // suite -- the one thing it must not be, since it runs on the main thread.
    expect(fitnessSeeds.length).toBeGreaterThan(2);
  }, 30_000);
});

describe("the fitness worker entry point", () => {
  it("scores the request on the shipped seeds and posts the result back", async () => {
    // The path every report a player sees actually takes, and the only thing
    // keeping it on the shipped seeds is that the worker passes none of its own.
    // Nothing else can hold it to that: the module is pulled in by the bundler
    // through `new URL(...)` and imported by no other source file, so a seed
    // list quietly added here would change every score in the game and break
    // no other test. Driven through a stand-in `self`, which is the whole of
    // the environment the module touches.
    //
    // The slowest case in the suite, and it earns its own timeout: it runs the
    // whole six-seed suite twice over, which is some two and a half seconds
    // under coverage on an idle machine and more than the five-second default
    // allows on a busy one. A timeout here would report a loaded machine rather
    // than a broken worker.
    const posted: FitnessWorkerResponse[] = [];
    const workerSelf = {
      onmessage: null as ((event: MessageEvent<FitnessWorkerRequest>) => void) | null,
      postMessage: (message: FitnessWorkerResponse): void => {
        posted.push(message);
      },
    };

    vi.stubGlobal("self", workerSelf);
    try {
      await import("./fitness-worker.ts");
      workerSelf.onmessage?.({
        data: { code: DRIVING_PROGRAM, locale: "en" },
      } as MessageEvent<FitnessWorkerRequest>);
    } finally {
      // Globals outlive the test; `vi.restoreAllMocks` does not undo a stub.
      vi.unstubAllGlobals();
    }

    expect(posted).toEqual([doFitnessSuite(DRIVING_PROGRAM, [...fitnessSeeds])]);
  }, 30_000);

  it("answers in the language the request asked for", async () => {
    // The whole point of putting a locale in the request. A worker is a second
    // module instance: its `src/i18n` is not the page's, its active locale
    // starts at the default however the page is written, and nothing the page
    // does reaches it. `vi.resetModules()` below stands in for that -- the
    // module graph the import pulls in is a fresh one, with its own untouched
    // locale -- and it is also what makes the import run the module body again
    // rather than serving the registry copy the test above already loaded,
    // which is where `self.onmessage` is assigned.
    const posted: FitnessWorkerResponse[] = [];
    const workerSelf = {
      onmessage: null as ((event: MessageEvent<FitnessWorkerRequest>) => void) | null,
      postMessage: (message: FitnessWorkerResponse): void => {
        posted.push(message);
      },
    };

    vi.resetModules();
    vi.stubGlobal("self", workerSelf);
    try {
      await import("./fitness-worker.ts");
      // A program with no init function, so the suite gives up before it
      // simulates anything: what is under test is which language the answer
      // comes back in, and a real benchmark run costs seconds.
      workerSelf.onmessage?.({
        data: { code: "var x = 1;", locale: "ru" },
      } as MessageEvent<FitnessWorkerRequest>);
      // Inside the stub, and awaited, because a language other than the default
      // is a chunk the worker has to fetch before it can name anything: this
      // reply arrives a tick or two after the request rather than in it. The
      // request above is the last thing that happens synchronously; everything
      // this test is about happens in `loadLocale`'s wake, with `self` still
      // standing in for the worker's own.
      await vi.waitFor(() => {
        expect(posted).toHaveLength(1);
      });
    } finally {
      vi.unstubAllGlobals();
      // And drop the fresh graph again. It is the copy that was just told to
      // speak Russian, and leaving it in the registry would hand it to the next
      // dynamic import in this file with its locale already set -- which no
      // `setLocale` in an `afterEach` could put back, since the instance that
      // `afterEach` holds is a different one.
      vi.resetModules();
    }

    // Not merely a Russian scenario name: this is the player's own error, which
    // has no identifier to send home in place of it, and is the half that
    // translating the reply on the main thread could not have reached.
    expect(posted).toEqual([{ error: "Error: В коде должна быть функция init" }]);
  });

  it("falls back to the default language rather than dying on a locale it does not know", async () => {
    // The request crosses a structured clone, so its type is a promise rather
    // than a guarantee: a stale bundle posting the bare string this used to
    // take, or a hand-written `postMessage`, gets here with no usable locale.
    // Left unchecked that tag reaches `Intl`, throws out of `onmessage`, and
    // the player reads a browser error where the fitness line goes.
    const posted: FitnessWorkerResponse[] = [];
    const workerSelf = {
      onmessage: null as ((event: MessageEvent<FitnessWorkerRequest>) => void) | null,
      postMessage: (message: FitnessWorkerResponse): void => {
        posted.push(message);
      },
    };

    vi.resetModules();
    vi.stubGlobal("self", workerSelf);
    try {
      await import("./fitness-worker.ts");
      workerSelf.onmessage?.({
        data: { code: "var x = 1;", locale: "kl" },
      } as unknown as MessageEvent<FitnessWorkerRequest>);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }

    expect(posted).toEqual([{ error: "Error: Code must contain an init function" }]);
  });
});

describe("describeFitnessResults", () => {
  it("lists the average delivery time of every scenario", () => {
    expect(describeFitnessResults([run("Small scenario", 12.3456), run("Large scenario", 7)])).toBe(
      "Fitness avg delivery times: Small scenario: 12.3s\u00a0\u00a0\u00a0Large scenario: 7.00s",
    );
  });

  it("marks a scenario that recorded nothing", () => {
    expect(describeFitnessResults([run("Small scenario")])).toBe(
      "Fitness avg delivery times: Small scenario: ?",
    );
  });

  it("reports the error instead when the suite failed", () => {
    expect(describeFitnessResults({ error: "TypeError: nope" })).toBe(
      "Could not compute fitness due to error: TypeError: nope",
    );
  });

  it("keeps three significant digits, which is what the line has always shown", () => {
    // The reason the wait time is not put through the `seconds` helper: that
    // one fixes decimals rather than significant digits, and would print these
    // as `0.1s` and `0.0s`, losing the difference between them.
    expect(describeFitnessResults([run("A", 0.05), run("B", 0)])).toBe(
      `Fitness avg delivery times: A: 0.0500s${COLUMN_GAP}B: 0.00s`,
    );
  });

  it("writes the numbers and the frame the way the page's language does", () => {
    // The scenario names arrive already rendered -- whichever thread ran the
    // suite rendered them -- so they are passed through as data; the frame and
    // the numbers are this side's, and both move. Note the space Russian puts
    // before the unit: it is a non-breaking one, so a wait time cannot be split
    // across a line break.
    setLocale("ru");

    expect(
      describeFitnessResults([run("Маленький сценарий", 12.3456), run("Большой сценарий")]),
    ).toBe(
      `Эффективность, среднее время доставки: Маленький сценарий: 12,3${NBSP}с` +
        `${COLUMN_GAP}Большой сценарий: ?`,
    );
  });
});
