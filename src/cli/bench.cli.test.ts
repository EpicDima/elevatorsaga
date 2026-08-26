/** The benchmark as an actual command, in an actual subprocess: what `bench.test.ts` cannot see by calling {@link runBench} directly. */

import { spawn } from "node:child_process";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { seconds, translateIn } from "../i18n/index.ts";
import { EXIT_OK, EXIT_PROGRAM_FAILED, EXIT_USAGE } from "./bench.ts";

/** The command, as a path node can be pointed at. */
const BENCH = fileURLToPath(new URL("./bench.ts", import.meta.url));

/** A program that delivers people, so the report holds numbers. */
const DRIVING_PROGRAM = `{
  init: function (elevators, floors) {
    elevators.forEach(function (elevator) {
      elevator.on("idle", function () {
        for (var floor = 0; floor < floors.length; floor++) {
          elevator.goToFloor(floor);
        }
      });
    });
  },
  update: function () {}
}`;

/** The driving program with one more statement run at the top of `init`. */
function driving(firstLine: string): string {
  return DRIVING_PROGRAM.replace("elevators.forEach", `${firstLine}\n    elevators.forEach`);
}

/** What a finished process left behind. */
interface Ran {
  /** What the shell would see. */
  readonly code: number;
  /** Standard output, which is the report and nothing else. */
  readonly out: string;
  /** Standard error, which is everything else. */
  readonly err: string;
}

/** Runs the command. */
async function bench(args: readonly string[], script: string = BENCH): Promise<Ran> {
  const child = spawn(process.execPath, [script, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    // A safety net: a command that hangs should fail the case, not the test run.
    timeout: 10_000,
  });
  let out = "";
  let err = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (out += chunk));
  child.stderr.on("data", (chunk: string) => (err += chunk));
  return await new Promise<Ran>((settle, fail) => {
    child.on("error", fail);
    // `close` rather than `exit`: the process can be gone while the pipes still
    // hold what it wrote, and a report read half-way is worse than no report.
    child.on("close", (code) => {
      settle({ code: code ?? -1, out, err });
    });
  });
}

/**
 * Runs the command with a reader that takes the report slowly, so a report
 * bigger than a pipe's 64KB buffer is written in pieces rather than one go.
 */
async function benchThroughSlowReader(args: readonly string[]): Promise<Ran> {
  const child = spawn(process.execPath, [BENCH, ...args], {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 20_000,
  });
  const chunks: Buffer[] = [];
  const slow = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk);
      setTimeout(done, 25);
    },
  });
  child.stdout.pipe(slow);
  const code = await new Promise<number>((settle, fail) => {
    child.on("error", fail);
    child.on("close", (status) => {
      settle(status ?? -1);
    });
  });
  // The child exiting does not mean the reader is done with its last chunk.
  await new Promise<void>((done) => {
    slow.on("finish", done).on("close", done);
  });
  return { code, out: Buffer.concat(chunks).toString("utf8"), err: "" };
}

describe("the benchmark as a command", () => {
  /** A directory of this suite's own, for the files the cases point node at. */
  let scratch: string;

  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), "elevatorsaga-bench-"));
  });

  it("prints the usage when asked, and exits as a success", async () => {
    const ran = await bench(["--help"]);

    expect(ran.code).toBe(EXIT_OK);
    expect(ran.out).toContain("Usage: node src/cli/bench.ts");
    expect(ran.err).toBe("");
  });

  it("runs when node is pointed at a link to it rather than at the file", async () => {
    // What `npm link`, a `bin` entry and every `node_modules/.bin` shim do.
    const link = join(scratch, "bench-link.ts");
    await symlink(BENCH, link);

    const ran = await bench(["--help"], link);

    expect(ran.out).toContain("Usage: node src/cli/bench.ts");
    expect(ran.code).toBe(EXIT_OK);
  });

  it("scores a program through a real pipe and exits as a success", async () => {
    const program = join(scratch, "driving.js");
    await writeFile(program, DRIVING_PROGRAM, "utf8");

    const ran = await bench([program, "--seeds", "1", "--json"]);

    expect(ran.code).toBe(EXIT_OK);
    const report = JSON.parse(ran.out) as { scenarios: { result: { transportedCount: number } }[] };
    expect(report.scenarios).toHaveLength(3);
    for (const scenario of report.scenarios) {
      expect(scenario.result.transportedCount).toBeGreaterThan(0);
    }
  });

  it("keeps what the run printed out of the report, whatever it printed with", async () => {
    // Only a subprocess can prove the last line: a program writing straight to
    // the descriptor bypasses the console entirely, so only the parent taking
    // the worker's real streams keeps it out of the report.
    const program = join(scratch, "chatty.js");
    await writeFile(
      program,
      `{
        init: function () {
          console.log("logged");
          console.dir({ inspected: true });
          console.table([{ tabulated: 1 }]);
          process.stdout.write("written straight to the descriptor\\n");
        },
        update: function () {}
      }`,
      "utf8",
    );

    const ran = await bench([program, "--seeds", "1", "--json"]);

    expect(ran.code).toBe(EXIT_OK);
    expect(() => JSON.parse(ran.out) as unknown).not.toThrow();
    expect(ran.err).toContain("logged");
    expect(ran.err).toContain("inspected");
    expect(ran.err).toContain("tabulated");
    expect(ran.err).toContain("written straight to the descriptor");
  });

  it("stops when the report is printed, whatever the program left running", async () => {
    // `setInterval` in `init` holds Node's event loop open forever.
    const program = join(scratch, "timer.js");
    await writeFile(
      program,
      `{ init: function () { setInterval(function () {}, 1000); }, update: function () {} }`,
      "utf8",
    );

    const ran = await bench([program, "--seeds", "1", "--json"]);

    expect(ran.code).toBe(EXIT_OK);
    // Parsed rather than merely non-empty, since a truncated report is the failure mode.
    expect(JSON.parse(ran.out)).toMatchObject({ program });
  }, 15_000);

  it("hands over a report larger than a pipe before it exits", async () => {
    // A pipe takes 64KB before the writer must wait, so a report bigger than
    // that is written in pieces; `process.exit` with a piece still queued
    // would drop it. The error message is what makes the report this big.
    const message = "x".repeat(100_000);
    const program = join(scratch, "verbose-failure.js");
    await writeFile(
      program,
      `{ init: function () { throw new Error("${message}"); }, update: function () {} }`,
      "utf8",
    );

    const ran = await benchThroughSlowReader([program, "--seeds", "1", "--json"]);

    // Asserted so the case fails loudly if the report ever shrinks below the pipe's limit.
    expect(ran.out.length).toBeGreaterThan(65_536);
    expect(ran.code).toBe(EXIT_PROGRAM_FAILED);
    expect(JSON.parse(ran.out)).toMatchObject({ program, error: `Error: ${message}` });
  }, 30_000);

  it("stops a program that will not stop, and reports it as the program failing", async () => {
    // `while (true)` can't be interrupted from inside the language, so this is
    // the one failure mode the worker's deadline exists to stop.
    const program = join(scratch, "spinning.js");
    await writeFile(program, `{ init: function () { while (true) {} }, update: function () {} }`);

    // Locale is asserted here rather than in a second run, since a thread that
    // missed its deadline never renders the report's language itself.
    const ran = await bench([program, "--seeds", "1", "--timeout", "1", "--locale=ru", "--json"]);

    expect(ran.code).toBe(EXIT_PROGRAM_FAILED);
    expect(JSON.parse(ran.out)).toEqual({
      program,
      seeds: ["1"],
      locale: "ru",
      error: translateIn("ru", "fitness.workerTimeout", { seconds: seconds(1) }),
    });
  }, 15_000);

  it("answers for a program that ends the thread out from under the report", async () => {
    // `process.exit()` reaches a real process inside the worker and ends the
    // thread with no message and no error for the command to report.
    const program = join(scratch, "exiting.js");
    await writeFile(program, `{ init: function () { process.exit(0); }, update: function () {} }`);

    const ran = await bench([program, "--seeds", "1", "--json"]);

    expect(ran.code).toBe(EXIT_PROGRAM_FAILED);
    expect(JSON.parse(ran.out)).toMatchObject({
      error: translateIn("en", "fitness.workerFailed"),
    });
  });

  it("scores a program that left a failure behind it, rather than blaming this tool", async () => {
    // Covers both doors a late failure arrives through: an uncaught exception
    // and an unhandled rejection, after `doFitnessSuite` already has its result.
    // This demonstrates the fix, not guards it -- the listener count in
    // `bench-worker.test.ts` is what actually fails if it regresses.
    const asyncThrow = join(scratch, "async-throw.js");
    await writeFile(
      asyncThrow,
      driving(`(async function () { throw new Error("from an async function"); })();`),
      "utf8",
    );
    const strayRejection = join(scratch, "stray-rejection.js");
    await writeFile(
      strayRejection,
      driving(`Promise.reject(new Error("nobody caught this"));`),
      "utf8",
    );

    for (const program of [asyncThrow, strayRejection]) {
      const ran = await bench([program, "--seeds", "1", "--json"]);

      expect(ran.code, `${program}\n${ran.err}`).toBe(EXIT_OK);
      const report = JSON.parse(ran.out) as {
        scenarios: { result: { transportedCount: number } }[];
      };
      expect(report.scenarios, program).toHaveLength(3);
      for (const scenario of report.scenarios) {
        expect(scenario.result.transportedCount, program).toBeGreaterThan(0);
      }
    }
  }, 30_000);

  it("says it could not run when a program breaks the run itself", async () => {
    // Poisoning `Array.prototype.push` breaks the suite itself, not the
    // program: the throw is outside the `try` that turns a program's own
    // failure into a report, so there is no report and this exits 2 (a tool
    // failure) rather than 1 (a scored, failing program).
    const poisoning = join(scratch, "poisoning.js");
    await writeFile(
      poisoning,
      `Array.prototype.push = function () { throw new Error("poisoned push"); };\n({ init: function () {}, update: function () {} })`,
      "utf8",
    );

    const ran = await bench([poisoning, "--seeds", "1", "--json"]);

    expect(ran.code, ran.err).toBe(EXIT_USAGE);
    // A `--json` reader gets nothing rather than a report that would parse and be wrong.
    expect(ran.out).toBe("");
    expect(ran.err).toContain("The benchmark could not be run");
    expect(ran.err).toContain("poisoned push");
  }, 15_000);

  it("tells a program that threw apart from arguments it could not use", async () => {
    // Codes are asserted as literals too, since a script consuming them reads the number.
    const throwing = join(scratch, "throwing.js");
    await writeFile(
      throwing,
      `{ init: function () { throw new Error("boom"); }, update: function () {} }`,
      "utf8",
    );

    const failed = await bench([throwing, "--seeds", "1", "--json"]);
    const misused = await bench(["--seeds"]);

    expect(failed.code).toBe(1);
    expect(failed.code).toBe(EXIT_PROGRAM_FAILED);
    expect(JSON.parse(failed.out)).toMatchObject({ error: "Error: boom" });
    expect(misused.code).toBe(2);
    expect(misused.code).toBe(EXIT_USAGE);
    expect(misused.out).toBe("");
    expect(misused.err).toContain("--seeds needs a value.");
  });
});
