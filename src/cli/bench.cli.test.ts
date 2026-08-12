/**
 * The benchmark as an actual command, in an actual subprocess.
 *
 * `bench.test.ts` calls {@link runBench} with its streams handed to it, which is
 * the right way to test what the command *decides* -- and it cannot see any of
 * what makes it a command. Four things live outside that boundary and are
 * exercised here or nowhere: the entry guard that decides whether being
 * imported means running, the exit code a shell reads, the real file descriptor
 * a pipe is attached to, and Node stripping the types off a `.ts` file it was
 * pointed at. Each of them has a way of failing that leaves every in-process
 * test green: a guard that never matches makes the command print nothing and
 * succeed, and output that reaches standard output through a path the tests do
 * not model makes `--json` unparseable only once it is piped.
 *
 * The cost is a process per case, so there are few of them and they run the
 * shortest suite the tool can be asked for.
 */

import { spawn } from "node:child_process";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

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

/** What a finished process left behind. */
interface Ran {
  /** What the shell would see. */
  readonly code: number;
  /** Standard output, which is the report and nothing else. */
  readonly out: string;
  /** Standard error, which is everything else. */
  readonly err: string;
}

/**
 * Runs the command.
 *
 * @param args - The arguments after the script.
 * @param script - The path to point node at; the command itself by default.
 * @returns What it printed, and the code it exited with.
 */
async function bench(args: readonly string[], script: string = BENCH): Promise<Ran> {
  const child = spawn(process.execPath, [script, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    // A safety net rather than part of any assertion: a command that hangs
    // should fail the case that asked for it, not outlive the test run.
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
    // What `npm link`, a `bin` entry and every `node_modules/.bin` shim do. Node
    // resolves the module to the file the link points at, so `import.meta.url`
    // is the real path while `argv[1]` is the link -- and an entry guard that
    // compares the two without resolving the link decides this process is
    // merely importing the module. Nothing then runs, nothing is printed, and
    // the command exits 0: a silence that a CI check reading the exit code
    // would pass.
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
    // The proof the in-process test cannot give: two file descriptors, and the
    // report parsing after a program has printed through the console methods
    // that write to standard output without going through `console.log`.
    const program = join(scratch, "chatty.js");
    await writeFile(
      program,
      `{
        init: function () {
          console.log("logged");
          console.dir({ inspected: true });
          console.table([{ tabulated: 1 }]);
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
  });

  it("stops when the report is printed, whatever the program left running", async () => {
    // `setInterval` in `init` is an ordinary thing for a program to do and it
    // holds Node's event loop open forever. The whole report was printed and
    // the command then sat there: in a shell loop scoring one program after
    // another, the second one never starts.
    const program = join(scratch, "timer.js");
    await writeFile(
      program,
      `{ init: function () { setInterval(function () {}, 1000); }, update: function () {} }`,
      "utf8",
    );

    const ran = await bench([program, "--seeds", "1", "--json"]);

    expect(ran.code).toBe(EXIT_OK);
    // Parsed rather than merely non-empty: the exit has to happen after the
    // pipe has taken the last chunk, and a truncated report is the way that
    // goes wrong.
    expect(JSON.parse(ran.out)).toMatchObject({ program });
  }, 15_000);

  it("tells a program that threw apart from arguments it could not use", async () => {
    // The two failure codes, as literals rather than as the constants the
    // implementation happens to export: a script deciding what to do with a
    // failed run reads the number, and changing it is a breaking change however
    // the constant is spelled.
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
