/**
 * The benchmark suite, run from a terminal.
 *
 * The simulation has been headless all along — {@link doFitnessSuite} draws
 * nothing, `createFrameRequester` turns the clock by hand, and
 * `determinism.test.ts` shows a seed reproduces its passengers whatever the
 * frame timing does — but the only way to reach it was a browser tab, because
 * the page's report goes through a web worker (`src/app/fitness.ts`) and a
 * worker needs a page. This is the command that was missing. It reads a program
 * from a file, runs it over the same three buildings on the same seed list the
 * game scores with, and prints what it scored.
 *
 * That opens three doors at once: a program can be written by another program
 * and measured without a browser, two strategies can be held against the same
 * buildings from a shell loop, and a repository of solutions can be scored in
 * CI. The same numbers are what a distribution would have to be built from, so
 * anything that wants to say "you are here" among other players' results starts
 * here too.
 *
 * ## What it prints
 *
 * The report goes to standard output, in both modes, whether the program ran or
 * threw: a program that fails is a *result* — the thing being measured did
 * something — and only the exit code separates it from one that did not. What
 * goes to standard error is everything else: this tool failing to do its job,
 * and every line the run itself printed. The engine logs whatever a program
 * threw with `console.log`, and a program being debugged prints far more than
 * that; on a page both go to a console nobody is parsing, but here standard
 * output is the report, and one stray line through it is a `--json` that no
 * longer parses. See {@link withRunOutputOnStandardError}.
 *
 * The columns are named with the keys of {@link FitnessResult} rather than with
 * prose, and are not translated. Two reasons, and they are the same reason. The
 * text table and `--json` then name the same things, so nobody needs a glossary
 * to move between the mode a human reads and the mode a script parses. And the
 * metrics are whatever {@link makeAverageResult} averaged — it iterates the
 * properties the first run happened to have, exactly as the legacy `_.forOwn`
 * did — so a column heading here can only be an identifier that came out of the
 * simulation, not a sentence somebody wrote for a fixed list of three. The one
 * piece of prose in the output is the scenario name, which comes from the
 * catalogue and so follows `--locale`.
 *
 * Every figure in the table is printed to three decimals, one rule for every
 * column, because a per-metric rule would be a table of names in a report whose
 * names are not known in advance. `--json` keeps the numbers exactly as the
 * simulation produced them, since whatever reads it can round for itself and
 * cannot recover what was thrown away. Both are reproducible to the byte: the
 * seeds fix the buildings, so re-running the same program prints the same
 * report, which is what makes this usable as a check in CI.
 *
 * ## Exit codes
 *
 * `0` the program ran and was scored, `1` the program threw or would not
 * compile — the report says what it threw — and `2` this tool was asked for
 * something it could not do.
 */

import { Console } from "node:console";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  doFitnessSuite,
  fitnessSeeds,
  type AveragedFitnessRun,
  type FitnessSuiteResult,
} from "../game/fitness.ts";
import type { RandomSeed } from "../game/random.ts";
import {
  DEFAULT_LOCALE,
  isLocale,
  loadLocale,
  LOCALES,
  setLocale,
  type Locale,
} from "../i18n/index.ts";

/** The program ran and was scored. */
export const EXIT_OK = 0;
/** The player's program threw, or would not compile. */
export const EXIT_PROGRAM_FAILED = 1;
/** The arguments were unusable, or the program file could not be read. */
export const EXIT_USAGE = 2;

/** How many decimals every figure in the report is printed to. */
const DECIMALS = 3;

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
}

/** What the command line asked for. */
export type BenchRequest =
  /** `--help`, or nothing at all: print the usage and stop. */
  | { readonly kind: "help" }
  /** A run, with everything it needs. */
  | { readonly kind: "run"; readonly options: BenchOptions };

/**
 * An argument this tool cannot act on, phrased for whoever typed it.
 *
 * A class rather than a string so that {@link runBench} can tell a bad argument
 * — which the usage text answers — from a defect in this module, which it must
 * not swallow.
 */
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
  ${String(EXIT_PROGRAM_FAILED)}  the program threw, or would not compile
  ${String(EXIT_USAGE)}  the arguments were unusable, or the file could not be read
`;

/**
 * Reads the value of an option that takes one.
 *
 * Both spellings are accepted, `--seeds=1,2` and `--seeds 1,2`, because both
 * are what people type.
 *
 * The separated spelling will not swallow something that looks like another
 * option. `--seeds --json` is a typo with a plausible reading -- score the seed
 * called `--json` -- and taking it produces a run on one nonsense building, in
 * table mode, exiting 0: three wrong answers and no complaint. A seed really can
 * be called `-1`, since seeds are hashed strings rather than numbers, so this is
 * refused rather than forbidden and the message says how to insist.
 *
 * @param name - The option, as written, for the message if there is no value.
 * @param inline - The text after `=`, if the argument carried one.
 * @param next - The following argument, which is the value if `inline` is not.
 * @returns The value.
 * @throws {BenchUsageError} When the option was given no value, or was given the
 * next option as its value.
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
 * Splits a `--seeds` list.
 *
 * The seeds stay strings, as they do in the address bar (see `resolveSeed` in
 * `src/app/router.ts`): `createRandomSource` hashes `String(seed)`, so `5` and
 * `"5"` are the same building, and keeping them as typed means a seed is
 * reported back exactly as it was given.
 *
 * @param value - The comma-separated list.
 * @returns The seeds, in the order they were written.
 * @throws {BenchUsageError} When the list has an empty entry, which is a typed
 * comma rather than a seed anybody meant.
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
 * @param value - What was typed.
 * @returns The locale.
 * @throws {BenchUsageError} When no such catalogue exists.
 */
function parseLocale(value: string): Locale {
  if (!isLocale(value)) {
    throw new BenchUsageError(`Unknown locale: ${value}. Known: ${LOCALES.join(", ")}`);
  }
  return value;
}

/**
 * Takes an argument as the program to benchmark.
 *
 * Written as a function of what was named before rather than as an assignment
 * in two places, so that naming two programs is refused by one sentence
 * wherever the second one came from -- before the `--` or after it.
 *
 * @param current - The program named so far, if any.
 * @param argument - The path, as written.
 * @returns The program to benchmark.
 * @throws {BenchUsageError} When a program was already named.
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
 * Every way of misreading an argument list is refused rather than guessed at,
 * because the thing being run is a measurement: a run on the wrong seeds still
 * prints a report full of plausible numbers, and nothing downstream can tell it
 * from the run that was asked for.
 *
 * @param argv - The arguments, without the node binary and this script.
 * @returns What was asked for.
 * @throws {BenchUsageError} When an argument is unknown, repeated, missing a
 * value, given a value it does not take, or when more than one program was
 * named.
 */
export function parseBenchArgs(argv: readonly string[]): BenchRequest {
  let programPath: string | undefined = undefined;
  let seeds: readonly RandomSeed[] = fitnessSeeds;
  let locale: Locale = DEFAULT_LOCALE;
  let json = false;
  // Set by `--`, after which nothing is read as an option -- the one way to
  // benchmark a file whose name begins with a dash.
  let optionsEnded = false;
  const given = new Set<string>();

  /**
   * Refuses an option that has already been given.
   *
   * `--seeds 1 --seeds 2` has two readings, the first wins and the last wins,
   * and both are guesses about what somebody meant -- usually a shell loop that
   * appended an argument the base command already carried. Silently scoring one
   * of the two lists is the failure worth avoiding, because the report says
   * which seeds it used and nobody re-reads that line.
   *
   * @param name - The option, as written.
   * @throws {BenchUsageError} When it was given before.
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
  return { kind: "run", options: { programPath, seeds, locale, json } };
}

/**
 * A figure, as every figure in the report is printed.
 *
 * @param value - The averaged metric.
 * @returns Its text.
 */
function formatValue(value: number): string {
  return value.toFixed(DECIMALS);
}

/**
 * The metric names, in the order the simulation produced them.
 *
 * Taken from the runs rather than written out, because {@link makeAverageResult}
 * averages whatever properties the result had: a scenario whose statistics never
 * changed contributes none, and a metric added to the simulation later appears
 * here without this file being touched.
 *
 * @param runs - The scored scenarios.
 * @returns Every metric any of them reported, first seen first.
 */
function metricNames(runs: readonly AveragedFitnessRun[]): readonly string[] {
  const names = new Set<string>();
  for (const run of runs) {
    for (const name of Object.keys(run.result)) {
      names.add(name);
    }
  }
  return [...names];
}

/**
 * Lays the scored scenarios out as a table.
 *
 * @param runs - The scored scenarios.
 * @returns The table, one line per scenario under one heading line.
 */
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
  // The scenario name is text and the figures are numbers, so the first column
  // reads down its left edge and the rest down their right, which is where the
  // decimal points line up.
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

/**
 * Renders the outcome of a run.
 *
 * @param result - What {@link doFitnessSuite} reported.
 * @param options - What was asked for, which the report repeats back: a score
 * means nothing without the buildings it was measured on.
 * @returns The report, ending in a newline.
 */
export function formatReport(result: FitnessSuiteResult, options: BenchOptions): string {
  const seeds = options.seeds.map(String);
  if (options.json) {
    const report = Array.isArray(result)
      ? {
          program: options.programPath,
          seeds,
          locale: options.locale,
          // The whole of the scenario, spread rather than picked field by
          // field: a report has to say which building produced a number, and a
          // hand-written list of fields silently stops saying so the first time
          // one is added. `elevatorCapacities` was already such a field --
          // present on two of the three scenarios, absent from a list of four.
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

/** Everything {@link runBench} does that is not computing the answer. */
export interface BenchIo {
  /**
   * Reads the program to benchmark.
   *
   * @param path - The file named on the command line.
   * @returns Its text.
   */
  readonly readFile: (path: string) => Promise<string>;
  /**
   * Writes the report.
   *
   * @param text - What to write to standard output.
   */
  readonly write: (text: string) => void;
  /**
   * Writes a failure of this tool, as opposed to of the program it was given.
   *
   * @param text - What to write to standard error.
   */
  readonly writeError: (text: string) => void;
}

/**
 * Describes a caught value the way a shell user needs to see it.
 *
 * @param error - Whatever was thrown.
 * @returns Its message, or its string form if it has none.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs something with everything it prints moved to standard error.
 *
 * Most of `console` writes to standard output in Node, and two things print
 * during a run: the engine, which logs a program's error and its stack
 * (`handleUserCodeError` in `world-controller.ts`), and the player's program,
 * which is free to print whatever it likes and generally does. Neither is unwanted — a stack trace is the most useful thing a bot
 * author gets out of a failed run — but neither belongs in the report. Moved
 * rather than silenced: it all still arrives, on the stream diagnostics arrive
 * on, and `2>/dev/null` is there for anyone who wants the report alone.
 *
 * The whole console is replaced rather than the three obvious methods being
 * patched, and that is the point of the function. `console.dir`, `console.table`
 * and `console.group` do not go through `console.log` -- they write to the
 * stdout stream the console was built around -- so patching `log`, `info` and
 * `debug` leaves several open doors into the report, and which method uses which
 * stream is Node's business to change, not this file's to track. A console built
 * on `process.stderr` for both streams has no door: everything a run prints,
 * including whatever Node adds to the class next, lands on standard error.
 *
 * The replacement keeps Node's own formatting, `%s` substitution, `dir` depth
 * and table drawing, because it is Node's `Console` -- only the streams differ.
 * The original goes back afterwards even if the run throws.
 *
 * @param run - What to run.
 * @returns Whatever `run` returned.
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

/**
 * Runs the command.
 *
 * Takes its input and output as a parameter rather than reaching for `process`,
 * so the whole command — parsing, the run, the report, the exit code — is
 * exercised by the tests without a subprocess and without capturing a stream.
 *
 * @param argv - The arguments, without the node binary and this script.
 * @param io - Where the program is read from and the report is written to.
 * @returns The exit code; see this module's documentation for what each means.
 */
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

  // Before the suite runs, because the scenario names are rendered inside it --
  // `fitnessChallenges` calls `t` at the start of every suite, which is exactly
  // late enough for this. `loadLocale` never rejects: a catalogue that cannot be
  // read leaves the report in English rather than taking the run down.
  await loadLocale(options.locale);
  setLocale(options.locale);

  const result = withRunOutputOnStandardError(() => doFitnessSuite(code, options.seeds));
  io.write(formatReport(result, options));
  return Array.isArray(result) ? EXIT_OK : EXIT_PROGRAM_FAILED;
}

/** Standard input, output and error, for the real command. */
const NODE_IO: BenchIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (text) => {
    process.stdout.write(text);
  },
  writeError: (text) => {
    process.stderr.write(text);
  },
};

/**
 * Where a path really leads, or `undefined` if it leads nowhere.
 *
 * @param path - The path to resolve.
 * @returns The path with every link and `..` taken out of it.
 */
function realPathOrNothing(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    // `node -e '...' something` puts a word that is not a file in argv[1], and
    // failing to be a file is an answer to the question being asked here, not an
    // error to take the process down with at import time.
    return undefined;
  }
}

// Only when this file is what node was pointed at, so that importing it -- which
// is how it is tested -- runs nothing. `import.meta.main` would say this in one
// word and is not available on the Node 22 this package still supports, so the
// question is asked the portable way: argv[1] is the script node was given.
//
// Both sides are resolved through their symbolic links before being compared,
// which is what makes the comparison the same question Node answered when it
// loaded the module: `import.meta.url` is always the real file, because Node
// resolves an entry point's links unless `--preserve-symlinks-main` says
// otherwise, while argv[1] is whatever was typed. Every way of installing a
// command -- `npm link`, a `bin` entry, a `node_modules/.bin` shim -- points at
// it through a link, so comparing the two unresolved makes the command a
// silence that exits 0.
const entryPoint = process.argv[1];
const entryPath = entryPoint === undefined ? undefined : realPathOrNothing(entryPoint);
if (entryPath !== undefined && entryPath === realPathOrNothing(fileURLToPath(import.meta.url))) {
  process.exitCode = await runBench(process.argv.slice(2), NODE_IO);
}
