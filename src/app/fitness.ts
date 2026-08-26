/** Runs the fitness benchmark in a worker, with a synchronous fallback. */

import { doFitnessSuite, fitnessSeeds, type FitnessSuiteResult } from "../game/fitness.ts";
import { getLocale, quantity, seconds, t, type Quantity } from "../i18n/index.ts";
import type { FitnessWorkerRequest } from "./fitness-worker.ts";

/**
 * Seeds used when the suite must run on the main thread: a prefix of
 * {@link fitnessSeeds}, kept short since the page freezes for the duration.
 * The resulting average isn't comparable to a worker run's.
 */
const FALLBACK_SEED_COUNT = 2;

/**
 * Milliseconds before the worker is written off. Exported so
 * `src/cli/bench.ts` can use the same deadline for the same suite.
 */
export const WORKER_TIMEOUT_MS = 60_000;

/** The part of a `Worker` the benchmark uses. */
export interface FitnessWorkerLike {
  /** Called with the suite results. */
  onmessage: ((event: MessageEvent<FitnessSuiteResult>) => void) | null;
  /** Called when the worker itself fails. */
  onerror: ((event: ErrorEvent) => void) | null;
  /** Sends the player's source to the worker, with the language to report in. */
  postMessage(message: FitnessWorkerRequest): void;
  /** Shuts the worker down. */
  terminate(): void;
}

/** Creates the worker the benchmark runs in. */
export type FitnessWorkerFactory = () => FitnessWorkerLike;

/**
 * Spawns the bundled fitness worker. The `new URL(..., import.meta.url)`
 * form lets the bundler find the entry and emit it as its own chunk.
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

/** Benchmarks a player program and never rejects. */
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
  return Promise.resolve(doFitnessSuite(codeStr, fitnessSeeds.slice(0, FALLBACK_SEED_COUNT)));
}

/** Creates a worker, reporting rather than throwing if that fails. */
function tryCreateWorker(createWorker: FitnessWorkerFactory): FitnessWorkerLike | null {
  try {
    return createWorker();
  } catch (error: unknown) {
    console.warn("Fitness worker creation failed, running on the main thread instead", error);
    return null;
  }
}

/** Runs the suite in a worker and shuts the worker down afterward. Always settles. */
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
    // A program that never returns leaves the worker silent, so without a
    // deadline the promise would never settle.
    const timer = setTimeout(() => {
      finish({
        // Rendered here since a worker that hasn't answered by now never will.
        error: t("fitness.workerTimeout", { seconds: seconds(Math.round(timeoutMs / 1000)) }),
      });
    }, timeoutMs);
    worker.onmessage = (event): void => {
      finish(event.data);
    };
    // The worker catches player-code errors itself; an error event means the worker broke.
    worker.onerror = (event): void => {
      finish({ error: describeWorkerError(event) });
    };
    // The worker is a separate module instance and can't see this page's
    // locale, so it travels with the request.
    worker.postMessage({ code: codeStr, locale: getLocale() });
  });
}

/** Turns a worker error event into a readable message. */
function describeWorkerError(event: ErrorEvent): string {
  return event.message === "" ? t("fitness.workerFailed") : event.message;
}

/**
 * An average wait time with 3 significant digits (7 -> `7.00s`, not `7.0s`
 * as {@link seconds} would round it).
 */
function waitTimeQuantity(waitTime: number): Quantity {
  return quantity(waitTime, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3,
  });
}

/**
 * Formats suite results as the single line of plain text the page shows.
 * Scenario names and errors are already rendered in the locale the run
 * used, which can differ from the current locale if it changed mid-run.
 */
export function describeFitnessResults(results: FitnessSuiteResult): string {
  if (!Array.isArray(results)) {
    return t("fitness.error", { error: results.error });
  }
  const waitTimes = results.map((run) => {
    const avgWaitTime = run.result["avgWaitTime"];
    const value =
      avgWaitTime === undefined ? t("fitness.unknownValue") : waitTimeQuantity(avgWaitTime);
    return t("fitness.result", { scenario: run.options.description, value });
  });
  // Non-breaking spaces so the columns survive HTML whitespace collapsing.
  return t("fitness.results", { results: waitTimes.join("\u00a0\u00a0\u00a0") });
}
