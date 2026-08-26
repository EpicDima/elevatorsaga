/** Exercises the command's thread-management logic against a fake `Worker`. */

import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FitnessSuiteResult } from "../game/fitness.ts";
import { DEFAULT_LOCALE, loadLocale, seconds, setLocale, translateIn } from "../i18n/index.ts";
import type { BenchWorkerRequest } from "./bench-worker.ts";
import { DEFAULT_TIMEOUT_MS, runSuiteInWorker, type BenchOptions } from "./bench.ts";

/** Where one of the thread's streams was sent, and on what terms. */
interface Piped {
  /** The stream it was handed to. */
  readonly destination: unknown;
  /** The second argument to `pipe`. */
  readonly options: unknown;
}

/** The part of a worker thread the command uses, plus what the tests drive it with. */
interface FakeThread {
  /** The entry file it was pointed at. */
  readonly url: URL;
  /** What it was sent. */
  readonly workerData: BenchWorkerRequest;
  /** Both of its streams being piped somewhere, in the order they were. */
  readonly piped: readonly Piped[];
  readonly terminations: number;
  /** Hands an event to whatever the command registered for it. */
  emit: (event: string, payload: unknown) => void;
}

/** Every thread the command started, in order. */
const threads = vi.hoisted((): { started: FakeThread[] } => ({ started: [] }));

vi.mock("node:worker_threads", () => {
  /** A thread that does nothing until a test tells it to. */
  class FakeWorker implements FakeThread {
    readonly url: URL;
    readonly workerData: BenchWorkerRequest;
    readonly piped: Piped[] = [];
    // These record only the instruction the command gave to pipe, not where the bytes end up -- that needs a real process, which `bench.cli.test.ts` uses.
    readonly stdout = {
      pipe: (destination: unknown, options: unknown): void => {
        this.piped.push({ destination, options });
      },
    };
    readonly stderr = {
      pipe: (destination: unknown, options: unknown): void => {
        this.piped.push({ destination, options });
      },
    };
    readonly handlers = new Map<string, (payload: unknown) => void>();
    terminations = 0;

    constructor(url: URL, options: { workerData: BenchWorkerRequest }) {
      this.url = url;
      this.workerData = options.workerData;
      threads.started.push(this);
    }

    /** Registers an event handler, as `Worker` does. */
    on(event: string, handler: (payload: unknown) => void): void {
      this.handlers.set(event, handler);
    }

    /** Hands an event over, throwing if nothing is listening -- the failure this fake exists to catch. */
    emit(event: string, payload: unknown): void {
      const handler = this.handlers.get(event);
      if (handler === undefined) {
        throw new Error(`The command is not listening for ${event}.`);
      }
      handler(payload);
    }

    /** Counts a shutdown and returns the exit code, as the real one does. */
    terminate(): Promise<number> {
      this.terminations += 1;
      return Promise.resolve(0);
    }
  }

  // The command checks this to decide whether being loaded means being run; false also keeps importing the module under test from running the command.
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

/** The thread the command started, failing the test if it started none. */
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
  // The deadline is a minute by default, and a test that waited it out would be a test nobody runs.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("running the suite in a thread", () => {
  it("hands the thread the program, the seeds and the language to report in", async () => {
    // A thread is a second instance of every module, with its own active locale that starts at the default regardless of the command's.
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

  it("sends both of the thread's streams to standard error, and closes neither", async () => {
    // Standard output is the report, so both streams are piped to standard error instead; `end: false` matters, since a pipe otherwise closes its destination when the source ends.
    const running = runSuiteInWorker(CODE, OPTIONS);
    const thread = startedThread();

    expect(thread.piped).toEqual([
      { destination: process.stderr, options: { end: false } },
      { destination: process.stderr, options: { end: false } },
    ]);

    thread.emit("message", SCORED);
    await running;
  });

  it("stops the thread and its timer as soon as the answer is in", async () => {
    // An unterminated thread holds a core, and an uncleared timer keeps the process alive -- both harmless once but a leak for a script that calls this in a loop.
    const running = runSuiteInWorker(CODE, OPTIONS);
    const thread = startedThread();

    thread.emit("message", SCORED);
    await running;

    expect(thread.terminations).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops a thread that has run out of time, and says so", async () => {
    // A program that will not finish cannot be stopped from inside the language, so the deadline reaches it from outside, and the message is rendered here since a stuck thread cannot answer.
    const running = runSuiteInWorker(CODE, { ...OPTIONS, timeoutMs: 5000 });
    const thread = startedThread();

    await vi.advanceTimersByTimeAsync(5000);

    await expect(running).resolves.toEqual({
      error: translateIn(DEFAULT_LOCALE, "fitness.workerTimeout", { seconds: seconds(5) }),
    });
    expect(thread.terminations).toBe(1);
  });

  it("gives up when the thread itself fails, instead of calling it a failed program", async () => {
    // An error event means the thread itself failed, not the program it was running; rejected rather than reported, since a report is a measurement and nothing was measured.
    const running = runSuiteInWorker(CODE, OPTIONS);
    const thread = startedThread();

    thread.emit("error", new SyntaxError("Expression expected"));

    await expect(running).rejects.toThrow(/Expression expected/);
    expect(thread.terminations).toBe(1);
  });

  it("gives up on a thread that failed with something that is not an error", async () => {
    // `worker.on("error")` passes on whatever was thrown, and it is not always an `Error` -- a bare string would otherwise read as a promise rejected by mistake.
    const running = runSuiteInWorker(CODE, OPTIONS);

    startedThread().emit("error", "the loader gave up");

    await expect(running).rejects.toThrow(/the loader gave up/);
  });

  it("reports a program that exhausted the thread's memory as a failed program", async () => {
    // Out-of-memory is the one thread failure that is the program's own doing, so it is reported as a result rather than as this tool being broken.
    const outOfMemory = Object.assign(
      new Error("Worker terminated due to reaching memory limit: JS heap out of memory"),
      { code: "ERR_WORKER_OUT_OF_MEMORY" },
    );
    const running = runSuiteInWorker(CODE, OPTIONS);

    startedThread().emit("error", outOfMemory);

    // The catalog's own sentence is used instead of Node's, which is a line about heap sizes and always in English regardless of locale.
    await expect(running).resolves.toEqual({
      error: translateIn(DEFAULT_LOCALE, "fitness.workerOutOfMemory"),
    });
  });

  it("says a thread ran out of memory in the language the command was given", async () => {
    // Rendered on this side, like the deadline's sentence, since a thread whose heap is gone cannot be asked for wording.
    await loadLocale("ru");
    setLocale("ru");
    try {
      const running = runSuiteInWorker(CODE, { ...OPTIONS, locale: "ru" });

      startedThread().emit(
        "error",
        Object.assign(new Error("Worker terminated due to reaching memory limit"), {
          code: "ERR_WORKER_OUT_OF_MEMORY",
        }),
      );

      await expect(running).resolves.toEqual({
        error: translateIn("ru", "fitness.workerOutOfMemory"),
      });
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });

  it("reports the first answer only, however many arrive", async () => {
    // Terminating a thread makes it exit, and the exit handler answers as well, so every deadline is two answers racing.
    const running = runSuiteInWorker(CODE, { ...OPTIONS, timeoutMs: 5000 });
    const thread = startedThread();

    thread.emit("message", SCORED);
    thread.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(running).resolves.toBe(SCORED);
    expect(thread.terminations).toBe(1);
  });
});
