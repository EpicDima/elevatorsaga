/**
 * The thread the benchmark command runs a player's program in.
 *
 * It exists for one reason: a program can decline to finish. A `while (true)`
 * in `init`, or an `update` that loops, never returns to the simulation and so
 * never returns to whoever called it — and a run on the main thread is then a
 * command that prints nothing, exits never, and has to be killed from another
 * terminal. Nothing inside the language can interrupt it. A thread can be
 * stopped from outside, so the run goes in one and
 * {@link "./bench.ts"!runSuiteInWorker} holds the stopwatch.
 *
 * This is the same shape the page has used all along — `src/app/fitness-worker.ts`
 * is this file's browser twin, spawned by `src/app/fitness.ts` and given the
 * same minute — so the two ways of asking for a fitness report now fail the same
 * way as well as succeeding the same way.
 *
 * The request arrives as `workerData` rather than as a message, because there is
 * exactly one of them and it is known before the thread starts: a worker built
 * with its work in hand cannot miss it by attaching a listener a tick late.
 */

import { parentPort, workerData } from "node:worker_threads";

import { doFitnessSuite, type FitnessSuiteResult } from "../game/fitness.ts";
import type { RandomSeed } from "../game/random.ts";
import { loadLocale, setLocale, type Locale } from "../i18n/index.ts";
// The command's module, imported for one function and not for its command: the
// entry guard at the bottom of it asks whether node was pointed at that file,
// and in a worker `process.argv[1]` is this file, so importing it here runs
// nothing.
import { withRunOutputOnStandardError } from "./bench.ts";

/** What the command sends the thread it is going to time. */
export interface BenchWorkerRequest {
  /** The program's source, as read from the file named on the command line. */
  readonly code: string;
  /** The buildings to score it on, which is what `--seeds` asked for. */
  readonly seeds: readonly RandomSeed[];
  /**
   * The language to report in.
   *
   * Sent rather than discovered, for the reason the browser worker's request
   * sends it (see {@link "../app/fitness-worker.ts"!FitnessWorkerRequest}): a
   * worker is a second instance of every module, with an active locale of its
   * own, and nothing the command did to its own reaches this one. Without it
   * `--locale ru` would name the scenarios in English, because the thread that
   * renders those names never heard about the option.
   */
  readonly locale: Locale;
}

/** What the command asked for. */
const request = workerData as BenchWorkerRequest;

if (parentPort === null) {
  // Not reachable through the command, which only ever loads this as a worker.
  // Someone pointing node at this file directly gets a sentence rather than a
  // silent success from a suite whose result had nowhere to go.
  throw new Error("src/cli/bench-worker.ts is a worker entry point; run src/cli/bench.ts instead.");
}

// Before the suite runs, because the scenario names are rendered inside it, and
// awaited because a catalogue other than English is a chunk of its own that has
// to be fetched first. This is the point in the thread where waiting is
// possible: `t` is synchronous everywhere below it.
await loadLocale(request.locale);
setLocale(request.locale);

// Everything the run prints goes to standard error, exactly as it did when the
// command ran the suite itself. The parent redirects this thread's streams as
// well, so this is not the only thing standing between a player's `console.log`
// and a `--json` report that no longer parses -- but it is what keeps a run
// printing where a run has always printed, whoever is listening.
const result: FitnessSuiteResult = withRunOutputOnStandardError(() =>
  doFitnessSuite(request.code, request.seeds),
);

// Nothing printed above has actually left this thread yet, and without this line
// almost none of it ever would. A worker's streams are not descriptors: each
// chunk is handed to the parent through a port, and the handing over needs a
// turn of the event loop that a run never takes -- `doFitnessSuite` is
// synchronous from the first line of `init` to the last scenario, so the first
// write goes out and every write after it queues behind a callback that cannot
// run until the run is over. By then the result is posted and the parent has
// stopped the thread, taking the queue with it: a program that printed four
// lines had one of them arrive.
//
// An empty write is enough to ask, because stream writes are ordered -- its
// callback cannot run before the callbacks of everything queued ahead of it.
// The same trick, for the same reason, ends `bench.ts`.
await Promise.all(
  [process.stdout, process.stderr].map(
    (stream) =>
      new Promise<void>((flushed) => {
        stream.write("", () => {
          flushed();
        });
      }),
  ),
);

parentPort.postMessage(result);
