/** Command-line benchmark runner: scores a player program on the buildings and seeds the game's fitness report uses. */

import { Console } from "node:console";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isMainThread, Worker } from "node:worker_threads";

import { fitnessSeeds, type AveragedFitnessRun, type FitnessSuiteResult } from "../game/fitness.ts";
import type { RandomSeed } from "../game/random.ts";
import {
  DEFAULT_LOCALE,
  isLocale,
  loadLocale,
  LOCALES,
  seconds,
  setLocale,
  t,
  type Locale,
} from "../i18n/index.ts";
import type { BenchWorkerRequest } from "./bench-worker.ts";

/** The program ran and was scored. */
export const EXIT_OK = 0;
/** The player's program threw, or would not compile. */
export const EXIT_PROGRAM_FAILED = 1;
/** This tool could not do the job: bad arguments, an unreadable file, or an internal failure. */
export const EXIT_USAGE = 2;

/** How many decimals every figure in the report is printed to. */
const DECIMALS = 3;

/**
 * Default deadline for a program to finish, in milliseconds.
 *
 * Must match `WORKER_TIMEOUT_MS` in `src/app/fitness.ts`, which a test asserts.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Longest deadline this command accepts, in seconds.
 *
 * `setTimeout` silently truncates a delay past a signed 32-bit ms count to 1ms,
 * so this caps at the largest value that still fits.
 */
const MAX_TIMEOUT_SECONDS = 2_147_483;

/** What to benchmark, and how to report it. */
export interface BenchOptions {
  /** The file holding the player's program. */
  readonly programPath: string;
  /** The buildings to score it on, one run of the scenario list per seed. */
  readonly seeds: readonly RandomSeed[];
  /** The language the scenario names are reported in. */
  readonly locale: Locale;
  /** Whether to print JSON rather than a table. */
  readonly json: boolean;
  /** How long the program gets to finish before it is stopped, in milliseconds. */
  readonly timeoutMs: number;
}

/** What the command line asked for. */
export type BenchRequest =
  /** `--help`, or nothing at all: print the usage and stop. */
  | { readonly kind: "help" }
  /** A run, with everything it needs. */
  | { readonly kind: "run"; readonly options: BenchOptions };

/** A bad argument, distinct from an internal bug so {@link runBench} can catch it and print usage. */
export class BenchUsageError extends Error {}

/** What `--help` prints, and what a usage error is printed above. */
export const USAGE = `Usage: node src/cli/bench.ts <program.js> [options]

Runs a player program through the benchmark suite and prints what it scored:
the same three buildings, on the same seeds, that the game's own fitness report
measures.

Arguments:
  <program.js>       File holding the program, in the form the editor takes:
                     an object literal with init() and update().

Options:
  --seeds <list>     Comma-separated seeds to score on: the scenario list is
                     run once per seed and the results averaged. A seed is
                     hashed, so 7 and rush-hour are equally valid and equally
                     reproducible. Default: ${fitnessSeeds.join(",")}
  --locale <tag>     Language for the scenario names, one of ${LOCALES.join(", ")}.
                     Default: ${DEFAULT_LOCALE}
  --timeout <secs>   Whole seconds the program gets to finish in before it is
                     stopped and reported as having run out of time, 1 to
                     ${String(MAX_TIMEOUT_SECONDS)}, which is as long as a timer can be asked to
                     wait. Raise it for a long seed list or a slow machine;
                     there is no way to switch it off, because a benchmark that
                     never returns is what it is here to prevent.
                     Default: ${String(DEFAULT_TIMEOUT_MS / 1000)}
  --json             Print the report as JSON instead of as a table.
  -h, --help         Print this text.
  --                 End of options: what follows is the program file, whatever
                     it is called.

No option may be given twice, and an option that takes a value will not take the
next option as one -- write --seeds=-1 for a seed that begins with a dash.

The report goes to standard output. Everything the run itself printed goes to
standard error, so a program that logs cannot corrupt the report.

Exit codes:
  ${String(EXIT_OK)}  the program ran and was scored
  ${String(EXIT_PROGRAM_FAILED)}  the program threw, would not compile, or ran out of time
  ${String(EXIT_USAGE)}  the arguments were unusable, the file could not be read, or this
     tool broke -- in which case nothing has been measured about the program
`;

/**
 * Reads the value of an option that takes one, as `--x=v` or `--x v`.
 *
 * Refuses a `next` that looks like another option (starts with `-`), since
 * `--seeds --json` would otherwise silently score a bogus seed and exit 0.
 *
 * @throws {BenchUsageError} If no value is given, or `next` looks like an option.
 */
function optionValue(name: string, inline: string | undefined, next: string | undefined): string {
  if (inline !== undefined) {
    if (inline === "") {
      throw new BenchUsageError(`${name} needs a value.`);
    }
    return inline;
  }
  if (next === undefined || next === "") {
    throw new BenchUsageError(`${name} needs a value.`);
  }
  if (next.startsWith("-")) {
    throw new BenchUsageError(
      `${name} needs a value, and ${next} looks like another option. ` +
        `Write ${name}=${next} if it really is the value.`,
    );
  }
  return next;
}

/**
 * Splits a `--seeds` list; seeds stay strings, since `5` and `"5"` hash to the
 * same building and keeping them as typed reports a seed back exactly as given.
 *
 * @throws {BenchUsageError} If the list has an empty entry.
 */
function parseSeeds(value: string): readonly RandomSeed[] {
  const seeds = value.split(",").map((seed) => seed.trim());
  if (seeds.some((seed) => seed === "")) {
    throw new BenchUsageError(`--seeds has an empty entry: ${value}`);
  }
  return seeds;
}

/**
 * Checks that a `--locale` names a language this build has.
 *
 * @throws {BenchUsageError} If no such catalog exists.
 */
function parseLocale(value: string): Locale {
  if (!isLocale(value)) {
    throw new BenchUsageError(`Unknown locale: ${value}. Known: ${LOCALES.join(", ")}`);
  }
  return value;
}

/**
 * Reads a `--timeout` as a number of milliseconds.
 *
 * Matched against a digits-only regex rather than handed to `Number`, since
 * `Number` also accepts hex, exponents and padding a benchmark deadline should not.
 *
 * @throws {BenchUsageError} If it is not a whole number of seconds from 1 to
 * {@link MAX_TIMEOUT_SECONDS}.
 */
function parseTimeout(value: string): number {
  const asSeconds = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!(asSeconds >= 1 && asSeconds <= MAX_TIMEOUT_SECONDS)) {
    throw new BenchUsageError(
      `--timeout takes a whole number of seconds, 1 to ${String(MAX_TIMEOUT_SECONDS)}; got ${value}.`,
    );
  }
  return asSeconds * 1000;
}

/**
 * Takes an argument as the program to benchmark.
 *
 * @throws {BenchUsageError} If a program was already named.
 */
function onlyProgram(current: string | undefined, argument: string): string {
  if (current !== undefined) {
    throw new BenchUsageError(
      `Only one program can be benchmarked at a time; got ${current} and ${argument}.`,
    );
  }
  return argument;
}

/**
 * Reads the command line.
 *
 * @throws {BenchUsageError} If an argument is unknown, repeated, missing a
 * value it needs, given a value it does not take, or a second program is named.
 */
export function parseBenchArgs(argv: readonly string[]): BenchRequest {
  let programPath: string | undefined = undefined;
  let seeds: readonly RandomSeed[] = fitnessSeeds;
  let locale: Locale = DEFAULT_LOCALE;
  let json = false;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  // Set by `--`, after which nothing is read as an option.
  let optionsEnded = false;
  const given = new Set<string>();

  /**
   * Refuses an option that has already been given.
   *
   * @throws {BenchUsageError} If it was given before.
   */
  const takeOnce = (name: string): void => {
    if (given.has(name)) {
      throw new BenchUsageError(`${name} was given more than once.`);
    }
    given.add(name);
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? "";
    if (optionsEnded) {
      programPath = onlyProgram(programPath, argument);
      continue;
    }
    if (argument === "--") {
      optionsEnded = true;
      continue;
    }
    if (argument === "-h" || argument === "--help") {
      return { kind: "help" };
    }
    const separator = argument.indexOf("=");
    const name =
      argument.startsWith("--") && separator !== -1 ? argument.slice(0, separator) : argument;
    const inline = separator === -1 ? undefined : argument.slice(separator + 1);
    switch (name) {
      case "--seeds":
        takeOnce(name);
        seeds = parseSeeds(optionValue(name, inline, argv[index + 1]));
        if (inline === undefined) index++;
        break;
      case "--locale":
        takeOnce(name);
        locale = parseLocale(optionValue(name, inline, argv[index + 1]));
        if (inline === undefined) index++;
        break;
      case "--timeout":
        takeOnce(name);
        timeoutMs = parseTimeout(optionValue(name, inline, argv[index + 1]));
        if (inline === undefined) index++;
        break;
      case "--json":
        takeOnce(name);
        // `--json=false` reads as switching JSON off and would switch it on.
        if (inline !== undefined) {
          throw new BenchUsageError(`${name} takes no value, but was given ${inline}.`);
        }
        json = true;
        break;
      default:
        if (argument.startsWith("-")) {
          throw new BenchUsageError(`Unknown option: ${argument}`);
        }
        programPath = onlyProgram(programPath, argument);
    }
  }

  // Called with nothing at all, which is somebody finding out what this is.
  if (programPath === undefined && argv.length === 0) {
    return { kind: "help" };
  }
  if (programPath === undefined) {
    throw new BenchUsageError("No program file given.");
  }
  return { kind: "run", options: { programPath, seeds, locale, json, timeoutMs } };
}

/** A figure, as every figure in the report is printed. */
function formatValue(value: number): string {
  return value.toFixed(DECIMALS);
}

/** Every metric any scenario reported, first seen first. */
function metricNames(runs: readonly AveragedFitnessRun[]): readonly string[] {
  const names = new Set<string>();
  for (const run of runs) {
    for (const name of Object.keys(run.result)) {
      names.add(name);
    }
  }
  return [...names];
}

/** Lays the scored scenarios out as a table, one line per scenario under a heading. */
function formatTable(runs: readonly AveragedFitnessRun[]): string {
  const metrics = metricNames(runs);
  const header = ["scenario", ...metrics];
  const rows = runs.map((run) => [
    run.options.description,
    ...metrics.map((metric) => {
      const value = run.result[metric];
      return value === undefined ? "" : formatValue(value);
    }),
  ]);
  const widths = header.map((heading, column) =>
    Math.max(heading.length, ...rows.map((row) => (row[column] ?? "").length)),
  );
  // Left-aligns the scenario name column, right-aligns the numeric columns.
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, column) => {
        const width = widths[column] ?? 0;
        return column === 0 ? cell.padEnd(width) : cell.padStart(width);
      })
      .join("  ")
      .trimEnd();
  return [line(header), ...rows.map(line)].join("\n") + "\n";
}

/** Renders the outcome of a run, ending in a newline. */
export function formatReport(result: FitnessSuiteResult, options: BenchOptions): string {
  const seeds = options.seeds.map(String);
  if (options.json) {
    const report = Array.isArray(result)
      ? {
          program: options.programPath,
          seeds,
          locale: options.locale,
          // Spread rather than picked field by field, so a world option added
          // later is not silently dropped from the report.
          scenarios: result.map((run) => ({ ...run.options, result: run.result })),
        }
      : { program: options.programPath, seeds, locale: options.locale, error: result.error };
    return JSON.stringify(report, undefined, 2) + "\n";
  }
  const heading = `program: ${options.programPath}\nseeds:   ${seeds.join(", ")}\nlocale:  ${options.locale}\n`;
  if (!Array.isArray(result)) {
    return `${heading}\nerror: ${result.error}\n`;
  }
  return `${heading}\n${formatTable(result)}`;
}

/** Everything {@link runBench} reaches outside itself, swappable for testing. */
export interface BenchIo {
  /** Reads the program to benchmark. */
  readonly readFile: (path: string) => Promise<string>;
  /**
   * Runs the benchmark suite over the program.
   *
   * A program that failed is a result, not a rejection; a rejection means the
   * run never happened, which is this tool's failure rather than the program's.
   */
  readonly runSuite: (code: string, options: BenchOptions) => Promise<FitnessSuiteResult>;
  /** Writes the report to standard output. */
  readonly write: (text: string) => void;
  /** Writes a failure of this tool, as opposed to of the program it was given. */
  readonly writeError: (text: string) => void;
}

/** Describes a caught value: its message, or its string form if it has none. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether a thread died because the program in it ran out of memory. */
function isOutOfMemory(error: unknown): boolean {
  return (
    error instanceof Error && (error as { code?: unknown }).code === "ERR_WORKER_OUT_OF_MEMORY"
  );
}

/**
 * Runs something with everything it prints moved to standard error, so the
 * report on standard output stays parseable.
 *
 * Replaces the whole console rather than patching `log`/`info`/`debug`, since
 * `console.dir`, `console.table` and `console.group` write to stdout directly
 * without going through `log`. Restores the original console even if `run` throws.
 */
export function withRunOutputOnStandardError<T>(run: () => T): T {
  const original = globalThis.console;
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
  try {
    return run();
  } finally {
    globalThis.console = original;
  }
}

/** Runs the command, taking input and output as a parameter so it is testable without a subprocess. */
export async function runBench(argv: readonly string[], io: BenchIo): Promise<number> {
  let request: BenchRequest;
  try {
    request = parseBenchArgs(argv);
  } catch (error: unknown) {
    if (!(error instanceof BenchUsageError)) {
      throw error;
    }
    io.writeError(`${error.message}\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (request.kind === "help") {
    io.write(USAGE);
    return EXIT_OK;
  }

  const { options } = request;
  let code: string;
  try {
    code = await io.readFile(options.programPath);
  } catch (error: unknown) {
    io.writeError(`Could not read ${options.programPath}: ${describeError(error)}\n`);
    return EXIT_USAGE;
  }

  // `loadLocale` never rejects: an unreadable catalog leaves the report in English.
  await loadLocale(options.locale);
  setLocale(options.locale);

  let result: FitnessSuiteResult;
  try {
    result = await io.runSuite(code, options);
  } catch (error: unknown) {
    // Not a result: the run never happened, so nothing is printed as if it had.
    io.writeError(`The benchmark could not be run: ${describeError(error)}\n`);
    return EXIT_USAGE;
  }
  io.write(formatReport(result, options));
  return Array.isArray(result) ? EXIT_OK : EXIT_PROGRAM_FAILED;
}

/**
 * Runs the suite in a thread, and stops the thread if it runs out of time.
 *
 * A timeout resolves as a failed-program result ({@link EXIT_PROGRAM_FAILED}),
 * not a rejection; rejection is reserved for this tool itself being broken.
 * Always settles.
 */
export function runSuiteInWorker(code: string, options: BenchOptions): Promise<FitnessSuiteResult> {
  const request: BenchWorkerRequest = { code, seeds: options.seeds, locale: options.locale };
  return new Promise<FitnessSuiteResult>((resolve, reject) => {
    const worker = new Worker(new URL("./bench-worker.ts", import.meta.url), {
      workerData: request,
      // Taken rather than left to Node, which would forward them to this
      // process's own streams: inside a worker `process.stdout` is real, and a
      // program writing to it directly would land in the middle of a `--json` report.
      stdout: true,
      stderr: true,
    });
    // `end: false`, or the first of the two to finish closes standard error
    // for the rest of the command.
    worker.stdout.pipe(process.stderr, { end: false });
    worker.stderr.pipe(process.stderr, { end: false });

    let settled = false;
    /**
     * Shuts the thread and its timer down, for the first answer only.
     *
     * Guarded because several answers race by design: terminating the thread
     * on the deadline makes it exit, so every answer is followed by a second one.
     *
     * @returns Whether this answer was the first, and so the one to report.
     */
    const stop = (): boolean => {
      if (settled) {
        return false;
      }
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      return true;
    };
    /** Reports what the run came to. */
    const finish = (result: FitnessSuiteResult): void => {
      if (stop()) {
        resolve(result);
      }
    };
    /** Gives up, as this tool failing rather than the program failing. */
    const abandon = (error: unknown): void => {
      if (stop()) {
        reject(error instanceof Error ? error : new Error(describeError(error)));
      }
    };
    // Rendered on this side, not in the thread: a thread that has not answered
    // in time is not going to answer a question about wording either.
    const timer = setTimeout(() => {
      finish({
        error: t("fitness.workerTimeout", { seconds: seconds(options.timeoutMs / 1000) }),
      });
    }, options.timeoutMs);
    worker.on("message", (result: FitnessSuiteResult) => {
      finish(result);
    });
    // The thread posts a result for whatever the program does, so an error here
    // means the thread itself is broken (this tool's fault) — except out-of-memory,
    // which is the program's doing and is reported as a result like any other.
    worker.on("error", (error: unknown) => {
      if (isOutOfMemory(error)) {
        finish({ error: t("fitness.workerOutOfMemory") });
        return;
      }
      abandon(error);
    });
    // `process.exit()` inside the worker ends the thread with no message and no
    // error, so without this the command would wait out the full deadline.
    worker.on("exit", () => {
      finish({ error: t("fitness.workerFailed") });
    });
  });
}

/** Standard input, output and error, for the real command. */
const NODE_IO: BenchIo = {
  readFile: (path) => readFile(path, "utf8"),
  runSuite: runSuiteInWorker,
  write: (text) => {
    process.stdout.write(text);
  },
  writeError: (text) => {
    process.stderr.write(text);
  },
};

/** Where a path really leads, with links and `..` resolved, or `undefined` if it leads nowhere. */
function realPathOrNothing(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

// Runs only when this file is what node was pointed at (resolved through
// symlinks, since `npm link`/`bin` shims point here through one), and only on
// the main thread, so a worker importing this module cannot re-run the command.
const entryPoint = process.argv[1];
const entryPath = entryPoint === undefined ? undefined : realPathOrNothing(entryPoint);
if (
  isMainThread &&
  entryPath !== undefined &&
  entryPath === realPathOrNothing(fileURLToPath(import.meta.url))
) {
  const status = await runBench(process.argv.slice(2), NODE_IO);
  // Exits explicitly, since a stray `setInterval` in a player's program would
  // otherwise hold the event loop open forever. Flushes both streams first: an
  // empty write's callback cannot run before a queued report chunk's has, and
  // without it a report larger than a pipe's buffer could exit truncated.
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
  process.exit(status);
}
