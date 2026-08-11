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

import { doFitnessSuite, fitnessSeeds, type FitnessSuiteResult } from "../game/fitness.ts";
import { getLocale, quantity, seconds, t, type Quantity } from "../i18n/index.ts";
import type { FitnessWorkerRequest } from "./fitness-worker.ts";

/**
 * Seeds the suite is run on when it has to run on the main thread.
 *
 * Deliberately fewer than the worker's: fewer buildings average worse, but the
 * page is frozen for the whole time, so it has to stay short.
 *
 * The first few of {@link fitnessSeeds} rather than seeds of its own, so that the
 * buildings it measures are a subset of the full run's rather than a separate set
 * nobody else uses. The number it prints is still not the worker's: an average
 * over two of these seeds is a different number from an average over six, and
 * {@link describeFitnessResults} prints both as the same line, so a fallback
 * report is comparable with another fallback report and not with a worker one.
 * Living with that is the trade the fallback already was — the alternative is
 * freezing the page for the full suite — and taking the prefix at least keeps the
 * two from disagreeing about which buildings exist.
 */
const FALLBACK_SEED_COUNT = 2;

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
   * Sends the player's source to the worker, with the language to report in.
   *
   * @param message - The source to benchmark, and the active locale.
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
  return Promise.resolve(doFitnessSuite(codeStr, fitnessSeeds.slice(0, FALLBACK_SEED_COUNT)));
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
        // Rendered on this side, not in the worker: a worker that has not
        // answered in a minute is one that is never going to, so there is
        // nobody there to ask for the sentence. A deadline of a thousand
        // seconds or more now reads `1,000s` where it used to read `1000s`;
        // the shipped one is sixty and only a test passes another.
        error: t("fitness.workerTimeout", { seconds: seconds(Math.round(timeoutMs / 1000)) }),
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
    // The locale travels with the source because the worker is a second module
    // instance and cannot see the one this page set; see the note on
    // {@link "./fitness-worker.ts"!FitnessWorkerRequest} for why the language
    // goes out with the request rather than the scenario names coming back as
    // identifiers.
    worker.postMessage({ code: codeStr, locale: getLocale() });
  });
}

/**
 * Turns a worker error event into something readable.
 *
 * @param event - The error event.
 * @returns The message to report.
 */
function describeWorkerError(event: ErrorEvent): string {
  return event.message === "" ? t("fitness.workerFailed") : event.message;
}

/**
 * An average wait time, as the report prints it.
 *
 * Three significant digits, which is what `toPrecision(3)` gave and what this
 * has to keep giving: 12.3456 is `12.3s` and 7 is `7.00s`, in English, exactly
 * as before. {@link "../i18n/index.ts"!seconds} is the obvious helper and is not
 * usable here, because it fixes the number of *decimals* rather than of
 * significant digits, so it would round 7 to `7.0s` and change a number on
 * screen — the one thing routing this through the catalogue is not allowed to
 * do. The unit options are its, so English still gets a bare `s` and Russian
 * gets ` с` with the non-breaking space its typography asks for.
 *
 * A wait time above 999 seconds does move: `toPrecision(3)` rendered it as
 * `1.23e+3s`, and `Intl` renders `1,230s`. Exponential notation in a wait time
 * was not a deliberate format, and no benchmark scenario runs long enough to
 * produce one.
 *
 * @param waitTime - The averaged wait time, in seconds.
 * @returns The number and its unit, ready to be interpolated into a message.
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
 *
 * Plain text rather than markup, because it ends up in `textContent`: the
 * scenario descriptions are data and the error is whatever the player's program
 * threw.
 *
 * Both of those arrive already in the player's language — the scenario names and
 * the error alike are rendered wherever the suite ran, which is the worker for a
 * real report and this thread for the fallback. Only the frame around them is put
 * on here.
 *
 * Which means a language switch during a run leaves one line half-translated:
 * the names were rendered at the locale the request went out with, and the frame
 * at whichever is active when the answer comes back. Not worth carrying a locale
 * home in the response to fix — a benchmark is a few seconds, a switch during one
 * is rare, and the next run is written entirely in the new language.
 *
 * @param results - What {@link runFitnessSuite} resolved with.
 * @returns The message to display.
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
  // Non-breaking spaces, as in the legacy `&nbsp&nbsp&nbsp` separator, so the
  // columns survive HTML whitespace collapsing.
  return t("fitness.results", { results: waitTimes.join("\u00a0\u00a0\u00a0") });
}
