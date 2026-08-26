/** Worker thread the benchmark command runs a player's program in, so a program that never returns can be stopped from outside. */

import { parentPort, workerData } from "node:worker_threads";

import { doFitnessSuite, type FitnessSuiteResult } from "../game/fitness.ts";
import type { RandomSeed } from "../game/random.ts";
import { loadLocale, setLocale, type Locale } from "../i18n/index.ts";
// Imported for one function; its entry guard sees this file's own argv[1] and
// so never runs the command itself.
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
   * Sent rather than discovered: a worker has its own module state, so it does
   * not inherit the command's active locale.
   */
  readonly locale: Locale;
}

/** What the command asked for. */
const request = workerData as BenchWorkerRequest;

if (parentPort === null) {
  // Reached only if node is pointed at this file directly rather than through the command.
  throw new Error("src/cli/bench-worker.ts is a worker entry point; run src/cli/bench.ts instead.");
}

/** The command's end of the port, narrowed once so the function below can use it. */
const port = parentPort;

// Last await in this file; `t` is synchronous everywhere below it.
await loadLocale(request.locale);
setLocale(request.locale);

/** What the run produced, once it has produced it. */
let result: FitnessSuiteResult | undefined = undefined;

/** Whether the answer has been handed over, since several paths hand it over. */
let posted = false;

/**
 * Hands the command the report, once there is one and once only.
 *
 * Guarded because {@link answerFailure} can call this multiple times: `init`
 * runs once per scenario, so a program that fails this way usually fails it
 * several times.
 */
function postResult(): void {
  if (posted || result === undefined) {
    return;
  }
  posted = true;
  port.postMessage(result);
}

/**
 * Answers a failure the run left behind it, or gets out of the way of one that
 * is not the run's to answer.
 *
 * These listeners stay attached after the first failure; removing them would
 * let a second one end the thread while a posted message is still in flight. If
 * there is no result yet, the failure is this tool's own and is rethrown to Node.
 */
function answerFailure(thrown: unknown): void {
  if (result === undefined) {
    process.off("uncaughtException", answerFailure);
    process.off("unhandledRejection", answerFailure);
    throw thrown;
  }
  postResult();
}

// Catches what `doFitnessSuite` cannot: an `async init` or uncaught promise
// failing on a later turn of the event loop. Without these, Node's default ends
// the thread and the parent reports this tool as broken instead.
process.on("uncaughtException", answerFailure);
process.on("unhandledRejection", answerFailure);

result = withRunOutputOnStandardError(() => doFitnessSuite(request.code, request.seeds));

// A worker's streams go to the parent through a port, which needs a turn of the
// event loop that a synchronous run never takes on its own; without this flush,
// queued output is lost once the result is posted and the thread is stopped.
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

postResult();
