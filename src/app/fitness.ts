/**
 * Host side of the fitness benchmark.
 *
 * Replaces `fitnessSuite` from the legacy `fitness.js`: it spawns the module
 * worker in `fitness-worker.ts`, hands it the player's source and resolves with
 * whatever the worker reports. Running the suite on the main thread would block
 * the page for seconds, so the worker is strongly preferred; the synchronous
 * fallback exists only for environments where a worker cannot be created, which
 * is what the legacy code did too.
 *
 * The legacy version took a callback; this one returns a promise. It also
 * terminates the worker once the result is in, where the legacy code leaked one
 * worker per call.
 */

import { doFitnessSuite, type FitnessSuiteResult } from "../game/fitness.ts";
import type { FitnessWorkerRequest } from "./fitness-worker.ts";

/**
 * Runs of the whole scenario list when the suite has to run on the main thread.
 *
 * Deliberately lower than the worker's count: fewer runs average worse, but the
 * page is frozen for the whole time, so it has to stay short.
 */
const FALLBACK_RUN_COUNT = 2;

/**
 * How long the worker is given before it is written off, in milliseconds.
 *
 * A player program with a `while (true)` in it never returns, and a worker
 * running one never posts a message and never raises an error either: it just
 * spins a core forever. Without this the promise never settles, the page reads
 * "Measuring fitness..." for the rest of the session, and every further call
 * strands another worker. Generous enough that a merely slow program still
 * reports, since the whole suite is several seconds of simulation.
 */
const WORKER_TIMEOUT_MS = 60_000;

/** The part of a `Worker` the benchmark uses. */
export interface FitnessWorkerLike {
  /** Called with the suite results. */
  onmessage: ((event: MessageEvent<FitnessSuiteResult>) => void) | null;
  /** Called when the worker itself fails. */
  onerror: ((event: ErrorEvent) => void) | null;
  /**
   * Sends the player's source to the worker.
   *
   * @param message - The source to benchmark.
   */
  postMessage(message: FitnessWorkerRequest): void;
  /** Shuts the worker down. */
  terminate(): void;
}

/** Creates the worker the benchmark runs in. */
export type FitnessWorkerFactory = () => FitnessWorkerLike;

/**
 * Spawns the bundled fitness worker.
 *
 * The `new URL(..., import.meta.url)` form is what lets the bundler find the
 * worker entry and emit it as its own chunk; the legacy `new Worker(
 * "fitnessworker.js")` relied on the file sitting next to the page.
 *
 * @returns The worker.
 */
function createFitnessWorker(): FitnessWorkerLike {
  return new Worker(new URL("./fitness-worker.ts", import.meta.url), { type: "module" });
}

/** Options accepted by {@link runFitnessSuite}. */
export interface FitnessSuiteOptions {
  /** Whether to use a worker at all; defaults to `true`. */
  readonly preferWorker?: boolean;
  /** How to create the worker; defaults to {@link createFitnessWorker}. */
  readonly createWorker?: FitnessWorkerFactory;
  /** How long to wait for the worker; defaults to {@link WORKER_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
}

/**
 * Benchmarks a player program.
 *
 * @param codeStr - The player's source.
 * @param options - Whether and how to use a worker.
 * @returns The averaged results, or an error report. Never rejects.
 */
export function runFitnessSuite(
  codeStr: string,
  options: FitnessSuiteOptions = {},
): Promise<FitnessSuiteResult> {
  if (options.preferWorker ?? true) {
    const worker = tryCreateWorker(options.createWorker ?? createFitnessWorker);
    if (worker !== null) {
      return runInWorker(worker, codeStr, options.timeoutMs ?? WORKER_TIMEOUT_MS);
    }
  }
  return Promise.resolve(doFitnessSuite(codeStr, FALLBACK_RUN_COUNT));
}

/**
 * Creates a worker, reporting rather than throwing when that is impossible.
 *
 * @param createWorker - The factory to call.
 * @returns The worker, or `null` if it could not be created.
 */
function tryCreateWorker(createWorker: FitnessWorkerFactory): FitnessWorkerLike | null {
  try {
    return createWorker();
  } catch (error: unknown) {
    console.warn("Fitness worker creation failed, running on the main thread instead", error);
    return null;
  }
}

/**
 * Runs the suite in a worker and shuts the worker down afterwards.
 *
 * @param worker - The worker to run in.
 * @param codeStr - The player's source.
 * @param timeoutMs - How long to wait before giving up on the worker.
 * @returns The averaged results, or an error report. Always settles.
 */
function runInWorker(
  worker: FitnessWorkerLike,
  codeStr: string,
  timeoutMs: number,
): Promise<FitnessSuiteResult> {
  return new Promise<FitnessSuiteResult>((resolve) => {
    const finish = (result: FitnessSuiteResult): void => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      resolve(result);
    };
    // A program that never returns -- a `while (true)`, or an update() that
    // loops -- posts nothing and raises nothing, so without a deadline the
    // promise never settles: the page keeps saying "Measuring fitness...", and
    // the worker keeps a core busy for as long as the tab is open.
    const timer = setTimeout(() => {
      finish({
        error: `The fitness worker did not finish within ${String(
          Math.round(timeoutMs / 1000),
        )}s and was stopped. Does your program have a loop that never ends?`,
      });
    }, timeoutMs);
    worker.onmessage = (event): void => {
      finish(event.data);
    };
    // The worker catches everything the player code throws, so an error event
    // means the worker itself broke. The legacy code left the callback hanging
    // forever in that case; reporting it keeps the caller unblocked.
    worker.onerror = (event): void => {
      finish({ error: describeWorkerError(event) });
    };
    worker.postMessage(codeStr);
  });
}

/**
 * Turns a worker error event into something readable.
 *
 * @param event - The error event.
 * @returns The message to report.
 */
function describeWorkerError(event: ErrorEvent): string {
  return event.message === "" ? "The fitness worker failed" : event.message;
}

/**
 * Formats suite results as the single line of plain text the page shows.
 *
 * Plain text rather than markup, because it ends up in `textContent`: the
 * scenario descriptions are data and the error is whatever the player's program
 * threw.
 *
 * @param results - What {@link runFitnessSuite} resolved with.
 * @returns The message to display.
 */
export function describeFitnessResults(results: FitnessSuiteResult): string {
  if (!Array.isArray(results)) {
    return `Could not compute fitness due to error: ${results.error}`;
  }
  const waitTimes = results.map((run) => {
    const avgWaitTime = run.result["avgWaitTime"];
    const value = avgWaitTime === undefined ? "?" : `${avgWaitTime.toPrecision(3)}s`;
    return `${run.options.description}: ${value}`;
  });
  // Non-breaking spaces, as in the legacy `&nbsp&nbsp&nbsp` separator, so the
  // columns survive HTML whitespace collapsing.
  return `Fitness avg wait times: ${waitTimes.join("\u00a0\u00a0\u00a0")}`;
}
