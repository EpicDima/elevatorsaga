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
 * same minute — and what the two say is meant to match: the same program scored
 * here and scored there should come back with the same report, a failing one
 * included. The insides cannot match, because the runtimes do not. A thread here
 * can run out of memory, be ended by a program calling `process.exit`, and die
 * on a rejection a browser worker would merely log; each of those is answered on
 * this side, and the answer chosen is whatever keeps the two reports the same.
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

/** The command's end of the port, narrowed once so the function below can use it. */
const port = parentPort;

// Before the suite runs, because the scenario names are rendered inside it, and
// awaited because a catalogue other than English is a chunk of its own that has
// to be fetched first. This is the point in the thread where waiting is
// possible: `t` is synchronous everywhere below it.
await loadLocale(request.locale);
setLocale(request.locale);

/** What the run produced, once it has produced it. */
let result: FitnessSuiteResult | undefined = undefined;

/** Whether the answer has been handed over, since several paths hand it over. */
let posted = false;

/**
 * Hands the command the report, once there is one and once only.
 *
 * Called by the two listeners below as well as by the last line of this file, so
 * both guards are load-bearing. Doing nothing while the run is still on the
 * stack is the point of the second one: what a failing program has to be
 * answered with is the report the run is in the middle of producing, and this
 * file's last line is where it gets handed over.
 *
 * The listeners are not taken off afterwards, which they were at first. A
 * program that leaves one failure behind usually leaves several — `init` runs
 * once per scenario — and taking the listeners off after the first restores
 * Node's default for the rest, so the second one ends the thread. A thread that
 * ended and a message in flight are two answers racing on different channels,
 * and the parent believing the wrong one is an intermittent exit 2 with the
 * report already written. Leaving them on costs a listener that a thread about
 * to be terminated will never be asked for again.
 */
function postResult(): void {
  if (posted || result === undefined) {
    return;
  }
  posted = true;
  port.postMessage(result);
}

// From here on, a failure the player's program leaves behind it must not cost
// the measurement being made.
//
// `doFitnessSuite` catches what a program throws, but it can only catch what is
// thrown at it, and not everything a program starts is finished when it returns:
// an `async init`, a promise nobody caught, a `queueMicrotask` that throws, all
// fail on a turn of the event loop the run is not on. In a worker such a failure
// is an uncaught exception, an uncaught exception ends the thread, and the
// parent reads a thread that ended as this tool being broken. That was a program
// with an `await` in it scoring the benchmark itself as broken: no report, exit
// 2, and a script scoring a directory of solutions stopping on the first one.
//
// Listening is what prevents it, since Node's default for both of these is to
// end the thread and a listener replaces the default. The answer is the report
// the run produced, because that is the answer: the buildings were scored, and
// the page -- where an unhandled rejection does not stop a worker -- scores the
// same program the same way. Only the run's own output is lost, and only if the
// failure beats the flush.
//
// Above the run, so that the window covers everything the program is able to
// schedule, from the first line of `init` onwards. Below the module's own
// loading, though: a failure raised while this file is still finding its
// imports is this tool broken, and the parent's business to report as such.
// Between the two, a failure arriving before the run has produced anything is
// left alone by {@link postResult} -- there is no report to hand over, and a
// thread with nothing to say is what the parent's deadline is for.
process.on("uncaughtException", postResult);
process.on("unhandledRejection", postResult);

// Everything the run prints goes to standard error, exactly as it did when the
// command ran the suite itself. The parent redirects this thread's streams as
// well, so this is not the only thing standing between a player's `console.log`
// and a `--json` report that no longer parses -- but it is what keeps a run
// printing where a run has always printed, whoever is listening.
result = withRunOutputOnStandardError(() => doFitnessSuite(request.code, request.seeds));

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
//
// It does nothing for a program that never finishes, which is the run whose
// output would be most worth having. This line is below the run, so a run that
// does not return never reaches it: the parent times the thread out, terminates
// it, and the lines the program logged on its way into the loop go with it. All
// that arrives is the first write, and all the report says is which deadline was
// missed. Nothing here can fix that -- every way out of a thread but one needs a
// turn of the event loop, and the exception is a synchronous write to a
// descriptor, which is a different bargain: it would block this thread on a
// stalled reader and can fail outright on a pipe Node has set non-blocking.
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
