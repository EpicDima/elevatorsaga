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

/** The gap between scenarios in a report line. */
const COLUMN_GAP = "\u00a0\u00a0\u00a0";

/**
 * A program that drives every elevator through every floor, so different
 * seeds produce different wait times.
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
  readonly posted: FitnessWorkerRequest[] = [];
  terminateCount = 0;

  postMessage(message: FitnessWorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  reply(result: FitnessSuiteResult): void {
    this.onmessage?.({ data: result } as MessageEvent<FitnessSuiteResult>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

/** Builds an averaged run; omitting avgWaitTime marks nothing recorded. */
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
  // Resets locale for tests that call setLocale on this module's own instance;
  // worker tests reset the module registry themselves.
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
    // Invalid code is rejected before any world is simulated, keeping this test fast.
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
    const fallback = await runFitnessSuite(DRIVING_PROGRAM, { preferWorker: false });

    expect(fallback).toEqual(doFitnessSuite(DRIVING_PROGRAM, fitnessSeeds.slice(0, 2)));
    expect(fallback).not.toEqual(doFitnessSuite(DRIVING_PROGRAM, fitnessSeeds.slice(0, 1)));
    // Guards against the shipped list shrinking to 2, which would make the
    // fallback silently the whole suite.
    expect(fitnessSeeds.length).toBeGreaterThan(2);
  }, 30_000);
});

describe("the fitness worker entry point", () => {
  it("scores the request on the shipped seeds and posts the result back", async () => {
    // Runs the full seed suite twice, which is slow enough to need its own timeout.
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
      // No init function, so the suite fails fast; only the language matters here.
      workerSelf.onmessage?.({
        data: { code: "var x = 1;", locale: "ru" },
      } as MessageEvent<FitnessWorkerRequest>);
      // A non-default locale loads its chunk asynchronously, so the reply
      // arrives a tick after the request.
      await vi.waitFor(() => {
        expect(posted).toHaveLength(1);
      });
    } finally {
      vi.unstubAllGlobals();
      // Drops the fresh module graph; leaving it would leak this locale to
      // the next dynamic import.
      vi.resetModules();
    }

    // The player's own error, not a translated scenario name.
    expect(posted).toEqual([{ error: "Error: В коде должна быть функция init" }]);
  });

  it("falls back to the default language rather than dying on a locale it does not know", async () => {
    // The request crosses a structured clone; an unrecognized locale must
    // not reach `Intl` and throw out of `onmessage`.
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
    // Not run through the `seconds` helper, which fixes decimals rather than significant digits.
    expect(describeFitnessResults([run("A", 0.05), run("B", 0)])).toBe(
      `Fitness avg delivery times: A: 0.0500s${COLUMN_GAP}B: 0.00s`,
    );
  });

  it("writes the numbers and the frame the way the page's language does", () => {
    // Scenario names come through as already-rendered data; only the frame
    // and numbers are localized here.
    setLocale("ru");

    expect(
      describeFitnessResults([run("Маленький сценарий", 12.3456), run("Большой сценарий")]),
    ).toBe(
      `Эффективность, среднее время доставки: Маленький сценарий: 12,3${NBSP}с` +
        `${COLUMN_GAP}Большой сценарий: ?`,
    );
  });
});
