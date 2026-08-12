/**
 * The command's side of the thread the suite runs in, driven without a thread.
 *
 * `bench.test.ts` hands {@link runBench} a fake `runSuite`, so everything this
 * file is about is stubbed out there; `bench.cli.test.ts` runs the real thread
 * in a real process, which proves the thing works but can only ask it questions
 * a shell can ask. Between the two sits the part that decides what a thread is
 * told, what is done with what it says, and what is done when it says nothing --
 * and each of those has a way of failing that leaves both of those files green.
 *
 * So `node:worker_threads` is mocked, as in `bench-worker.test.ts`, and the
 * thread is a fake this file drives by hand: it records the request it was
 * given, hands its events over on demand, and counts the times it was
 * terminated. That makes the deadline testable in milliseconds of fake time
 * rather than in seconds of a real core, and makes "the thread was stopped"
 * something to assert rather than something to believe.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FitnessSuiteResult } from "../game/fitness.ts";
import { DEFAULT_LOCALE, seconds, translateIn } from "../i18n/index.ts";
import type { BenchWorkerRequest } from "./bench-worker.ts";
import { DEFAULT_TIMEOUT_MS, runSuiteInWorker, type BenchOptions } from "./bench.ts";

/** The part of a worker thread the command uses, plus what the tests drive it with. */
interface FakeThread {
  /** The entry file it was pointed at. */
  readonly url: URL;
  /** What it was sent. */
  readonly workerData: BenchWorkerRequest;
  /** How many times it was terminated. */
  readonly terminations: number;
  /**
   * Hands an event to whatever the command registered for it.
   *
   * @param event - The event name.
   * @param payload - What to hand over.
   */
  emit: (event: string, payload: unknown) => void;
}

/** Every thread the command started, in order. */
const threads = vi.hoisted((): { started: FakeThread[] } => ({ started: [] }));

vi.mock("node:worker_threads", () => {
  /** A thread that does nothing until a test tells it to. */
  class FakeWorker implements FakeThread {
    readonly url: URL;
    readonly workerData: BenchWorkerRequest;
    // Piped to standard error by the command, which is a stream question
    // `bench.cli.test.ts` answers with a real process; here they only have to
    // exist.
    readonly stdout = { pipe: (): void => undefined };
    readonly stderr = { pipe: (): void => undefined };
    readonly handlers = new Map<string, (payload: unknown) => void>();
    terminations = 0;

    constructor(url: URL, options: { workerData: BenchWorkerRequest }) {
      this.url = url;
      this.workerData = options.workerData;
      threads.started.push(this);
    }

    /**
     * Registers an event handler, as `Worker` does.
     *
     * @param event - The event name.
     * @param handler - What to call.
     */
    on(event: string, handler: (payload: unknown) => void): void {
      this.handlers.set(event, handler);
    }

    /**
     * Hands an event over.
     *
     * @param event - The event name.
     * @param payload - What to hand over.
     * @throws {Error} When nothing is listening, which is the failure this fake
     * exists to catch.
     */
    emit(event: string, payload: unknown): void {
      const handler = this.handlers.get(event);
      if (handler === undefined) {
        throw new Error(`The command is not listening for ${event}.`);
      }
      handler(payload);
    }

    /**
     * Counts a shutdown.
     *
     * @returns The exit code, as the real one does.
     */
    terminate(): Promise<number> {
      this.terminations += 1;
      return Promise.resolve(0);
    }
  }

  // The command asks this before deciding whether being loaded means being run.
  // False is the truth for a mocked thread module, and it is also what keeps
  // importing the module under test from running the command.
  return { isMainThread: false, Worker: FakeWorker };
});

/** A program, as text. Never executed here: the thread that would run it is a fake. */
const CODE = `{ init: function () {}, update: function () {} }`;

/** What the thread posts back. Empty because the subject is the delivery, not the numbers. */
const SCORED: FitnessSuiteResult = [];

/** A request, as {@link runBench} would have parsed it. */
const OPTIONS: BenchOptions = {
  programPath: "solution.js",
  seeds: ["1"],
  locale: DEFAULT_LOCALE,
  json: false,
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

/**
 * The thread the command started, failing the test if it started none.
 *
 * @returns The one and only thread.
 */
function startedThread(): FakeThread {
  expect(threads.started).toHaveLength(1);
  const [thread] = threads.started;
  if (thread === undefined) {
    throw new Error("The command started no thread.");
  }
  return thread;
}

beforeEach(() => {
  threads.started.length = 0;
  // The deadline is a minute by default, and a test that waited it out would be
  // a test nobody runs.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("running the suite in a thread", () => {
  it("hands the thread the program, the seeds and the language to report in", async () => {
    // Why `BenchWorkerRequest` carries a locale at all: a thread is a second
    // instance of every module, with an active locale of its own that starts at
    // the default however the command set its own. Drop the language from the
    // request and `--locale ru` reports Russian everywhere except the scenario
    // names, which are rendered inside the thread -- a report half in each
    // language, from a command that was told once.
    const running = runSuiteInWorker(CODE, { ...OPTIONS, locale: "ru", seeds: ["7", "rush-hour"] });

    const thread = startedThread();
    expect(thread.url.href).toMatch(/\/bench-worker\.ts$/);
    expect(thread.workerData).toEqual({
      code: CODE,
      seeds: ["7", "rush-hour"],
      locale: "ru",
    });

    thread.emit("message", SCORED);
    await expect(running).resolves.toBe(SCORED);
  });

  it("stops the thread and its timer as soon as the answer is in", async () => {
    // Two leaks in one line of the implementation. A thread that is not
    // terminated goes on holding a core -- the command exits anyway, so nothing
    // in a shell would show it, but `runSuiteInWorker` is also what a script
    // that scores a directory of programs would call in a loop. A timer that is
    // not cleared keeps the process alive for the rest of the deadline, which is
    // a benchmark that prints its report and then sits there for a minute.
    const running = runSuiteInWorker(CODE, OPTIONS);
    const thread = startedThread();

    thread.emit("message", SCORED);
    await running;

    expect(thread.terminations).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops a thread that has run out of time, and says so", async () => {
    // The whole reason the suite runs in a thread: a program that will not
    // finish cannot be stopped from inside the language, so the deadline has to
    // reach it from outside. The sentence is rendered here rather than in the
    // thread for the same reason -- a thread that has missed its deadline is not
    // going to answer a question about wording.
    const running = runSuiteInWorker(CODE, { ...OPTIONS, timeoutMs: 5000 });
    const thread = startedThread();

    await vi.advanceTimersByTimeAsync(5000);

    await expect(running).resolves.toEqual({
      error: translateIn(DEFAULT_LOCALE, "fitness.workerTimeout", { seconds: seconds(5) }),
    });
    expect(thread.terminations).toBe(1);
  });

  it("reports the first answer only, however many arrive", async () => {
    // Terminating a thread makes it exit, and the exit handler answers as well:
    // every deadline is therefore two answers racing, and the second of them
    // would overwrite a report that had already been decided.
    const running = runSuiteInWorker(CODE, { ...OPTIONS, timeoutMs: 5000 });
    const thread = startedThread();

    thread.emit("message", SCORED);
    thread.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(running).resolves.toBe(SCORED);
    expect(thread.terminations).toBe(1);
  });
});
