import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AveragedFitnessRun, FitnessSuiteResult } from "../game/fitness.ts";
import { describeFitnessResults, runFitnessSuite, type FitnessWorkerLike } from "./fitness.ts";

/** A worker stand-in whose replies the test drives. */
class FakeWorker implements FitnessWorkerLike {
  onmessage: ((event: MessageEvent<FitnessSuiteResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  /** Everything that was posted to this worker. */
  readonly posted: string[] = [];
  /** How often the worker was shut down. */
  terminateCount = 0;

  postMessage(message: string): void {
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

describe("runFitnessSuite in a worker", () => {
  it("hands the player code to the worker and resolves with its answer", async () => {
    const worker = new FakeWorker();
    const results = [run("Small scenario", 12.5)];

    const suite = runFitnessSuite("var x = 1;", { createWorker: () => worker });
    expect(worker.posted).toEqual(["var x = 1;"]);
    worker.reply(results);

    await expect(suite).resolves.toEqual(results);
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
});

describe("describeFitnessResults", () => {
  it("lists the average wait time of every scenario", () => {
    expect(describeFitnessResults([run("Small scenario", 12.3456), run("Large scenario", 7)])).toBe(
      "Fitness avg wait times: Small scenario: 12.3s\u00a0\u00a0\u00a0Large scenario: 7.00s",
    );
  });

  it("marks a scenario that recorded nothing", () => {
    expect(describeFitnessResults([run("Small scenario")])).toBe(
      "Fitness avg wait times: Small scenario: ?",
    );
  });

  it("reports the error instead when the suite failed", () => {
    expect(describeFitnessResults({ error: "TypeError: nope" })).toBe(
      "Could not compute fitness due to error: TypeError: nope",
    );
  });
});
