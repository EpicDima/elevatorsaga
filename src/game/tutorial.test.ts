/**
 * The learning-track table is a table: eight entries, buildings the game can
 * actually construct, identifiers and seeds that stay put, programs that parse.
 *
 * Everything here is about the *shape* of {@link "./tutorial.ts"!tutorialTasks}.
 * Whether a task teaches anything — whether its starting code really loses and
 * its answer really wins — is not decidable by reading the table, so it is not
 * attempted here; `tutorial-solutions.test.ts` runs the simulation and measures
 * it. The division matters because these checks are fast and total (every task,
 * every field) while that one is slow and empirical, and mixing them would hide
 * a typo behind a two-second simulation.
 *
 * The one exception is {@link expectConditionIsReachable}, which does look at a
 * bar: not to judge a program, but to catch a threshold that no program could
 * ever meet because the passengers to satisfy it have not been born yet.
 *
 * Every check over a program is made in every language. The two programs of a
 * task are messages — their `//` comments are written to the player, so they are
 * translated, and only they are — which means a task hands out one program per
 * locale and a suite that read the default one would be leaving the other
 * unchecked. `src/i18n/catalogue.test.ts` holds the code identical across
 * locales; what is left to this file is that each of those programs still
 * parses and is still written the way the track's programs are written, since a
 * translated comment is a line like any other and can be too long, indented
 * wrongly, or end a template literal early.
 *
 * The other thing a message key costs is the tie between a program and its task.
 * The compiler asks whether a key exists and never whether it was written under
 * the right entry, so the sixteen programs are held apart here instead: no two
 * tasks may hand out one starting program, and no two may share an answer beyond
 * the one copy the track is built on.
 */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Level, LevelWorldStats } from "./levels.ts";
import { tutorialTasks, type TutorialTask } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";

afterEach(() => {
  // Every spec below that names a language leaves it named, and the table
  // answers in whatever language was set last.
  setLocale(DEFAULT_LOCALE);
});

/**
 * The buildings the rest of the game is willing to construct.
 *
 * A restatement of `SANDBOX_LIMITS` in src/pages/game/model/route.ts, which is not
 * exported; duplicated on purpose rather than reached for, because the point of the
 * check is not "the sandbox agrees" but "this building is inside the range the
 * renderer, the physics and the address bar are all exercised over". A tutorial
 * building outside it would be one nothing else in the game can produce, which
 * is the definition of untested ground — and it is ground a *teaching* task can
 * least afford, since the player is being told the run is the lesson.
 */
const BUILDING_LIMITS = {
  /** Two is the fewest floors an elevator can have somewhere to go. */
  floorCount: { min: 2, max: 60 },
  /** One is the fewest cars a building can be served by. */
  elevatorCount: { min: 1, max: 12 },
  /** Passengers one car holds. */
  elevatorCapacity: { min: 1, max: 30 },
  /** Passengers per simulated second. */
  spawnRate: { min: 0.01, max: 10 },
} as const;

/**
 * What a seed may look like.
 *
 * Mirrors `SEED_PATTERN` and `SEED_MAX_LENGTH` in src/pages/game/model/route.ts. A
 * tutorial seed is pinned in this table rather than typed into the address bar, but a
 * link to a task is a thing people share, and a seed that cannot survive a
 * round trip through `location.hash` byte for byte hands the recipient a
 * different building — the one failure mode a pinned seed exists to prevent.
 */
const URL_SAFE_SEED = /^[\w.-]+$/;

/** Longest seed the address bar accepts. */
const SEED_MAX_LENGTH = 64;

/** Indentation step of the player-facing programs, in spaces. */
const INDENT_WIDTH = 4;

/**
 * Longest line a player-facing program may contain.
 *
 * The same width the repository's own sources are formatted to, for the same
 * reason applied to a narrower pane: the editor sits beside the building, and a
 * line that wraps in it is a line the player reads twice.
 */
const MAX_CODE_LINE_LENGTH = 100;

/** Deliveries the reachability probe will simulate before giving up. */
const REACHABILITY_PROBE_LIMIT = 1000;

/** A world in which nothing has happened yet. */
const NOTHING_HAPPENED: LevelWorldStats = {
  elapsedTime: 0,
  transportedCounter: 0,
  maxWaitTime: 0,
  moveCount: 0,
  transportedPerSec: 0,
  avgLoadFactorOnMove: 0,
  avgWaitTime: 0,
  maxPickupTime: 0,
  avgPickupTime: 0,
  avgRideTime: 0,
  stopCount: 0,
  avgPeoplePerStop: 0,
};

/**
 * Asserts a bar could be cleared by a program better than any that can exist.
 *
 * The bound is the spawn rate. Passengers appear one every `1 / spawnRate`
 * seconds, so no program has delivered more than *k* of them by the time the
 * *k*th arrives. The probe hands the condition that trajectory — *k* delivered
 * at `k / spawnRate` seconds, with a waiting time of zero — which is a program
 * that teleports every passenger the instant they arrive. If even that loses,
 * the task is arithmetically unwinnable and the threshold is a typo.
 *
 * Deliberately a loose bound, and loose in two directions. Real deliveries cost
 * travel time, so passing says only "not impossible", never "achievable" — the
 * achievable half is what `tutorial-solutions.test.ts` measures by running the
 * answer. And the trajectory lags the engine by one spawn interval:
 * {@link "./world.ts"!World} starts its spawn clock full, so the first
 * passenger appears at once and the *k*th at about `(k - 1) / spawnRate`. Both
 * errors point the same way — this probe can be too strict, never too lenient —
 * which is the only direction a sanity check is allowed to be wrong in.
 *
 * Against a condition made of waiting time the zero is doing all the work, and
 * the probe degenerates to "the required count is finite". That is deliberate:
 * any non-zero wait it could assume would be a guess about how far the car has
 * to drive, and a guess is the one thing a bound like this must not contain.
 *
 * @param task - The task whose condition is probed.
 */
function expectConditionIsReachable(task: TutorialTask): void {
  const spawnRate = task.options.spawnRate ?? 0;
  expect(spawnRate).toBeGreaterThan(0);
  for (let delivered = 1; delivered <= REACHABILITY_PROBE_LIMIT; delivered++) {
    const verdict = task.condition.evaluate({
      ...NOTHING_HAPPENED,
      elapsedTime: delivered / spawnRate,
      transportedCounter: delivered,
      maxWaitTime: 0,
      moveCount: delivered,
    });
    if (verdict !== null) {
      expect(verdict).toBe(true);
      return;
    }
  }
  expect.fail(
    `${task.id}: the condition was still undecided after ${String(REACHABILITY_PROBE_LIMIT)} ` +
      `instant deliveries, so nothing can be concluded about whether it can be met`,
  );
}

/**
 * Asserts a program is written the way the game's other player-facing code is.
 *
 * These strings are read far more often than they are run: they are the first
 * JavaScript most players see of this API, and they sit next to
 * the program {@link "../ui/default-code.ts"!defaultCode} returns, in the same
 * editor. Four-space indentation, spaces rather than tabs and no trailing blanks
 * are what `editor.defaultCode.code` establishes; a task that arrives formatted
 * differently makes the track look like it came from somewhere else.
 *
 * @param label - Identifies the program in failure messages.
 * @param code - The program.
 */
function expectPlayerCodeStyle(label: string, code: string): void {
  expect(code.startsWith("{"), `${label}: must be an object literal`).toBe(true);
  expect(code.endsWith("}"), `${label}: must be an object literal`).toBe(true);
  expect(code, `${label}: must declare init the way the starter program does`).toContain(
    "init: function(elevators, floors) {",
  );
  expect(code, `${label}: must declare update the way the starter program does`).toContain(
    "update: function(dt, elevators, floors) {",
  );
  for (const [index, line] of code.split("\n").entries()) {
    const where = `${label}, line ${String(index + 1)}`;
    expect(line, `${where}: no tabs`).not.toContain("\t");
    expect(line, `${where}: no trailing whitespace`).toBe(line.trimEnd());
    expect(
      line.length,
      `${where}: shorter than ${String(MAX_CODE_LINE_LENGTH)} columns`,
    ).toBeLessThanOrEqual(MAX_CODE_LINE_LENGTH);
    const indent = line.length - line.trimStart().length;
    expect(indent % INDENT_WIDTH, `${where}: indented in steps of ${String(INDENT_WIDTH)}`).toBe(0);
  }
}

/**
 * A program with its `//` comments taken out.
 *
 * The same reduction `src/i18n/catalogue.test.ts` makes, spelled again here
 * rather than shared: that file asks whether two catalogue entries hold the same
 * code, this one asks whether a *task* hands out the same code whichever
 * language it is asked in, and a helper imported across that line would tie the
 * two questions together for no gain.
 *
 * @param code - A player-facing program.
 * @returns The same program with every comment stripped.
 */
function withoutComments(code: string): string {
  return code
    .split("\n")
    .map((line) => line.replace(/\s*\/\/.*$/, ""))
    .join("\n");
}

/**
 * The tasks that hand out one and the same program, grouped by that program.
 *
 * Every program on the track is reached through a message key written out by
 * hand in the entry that uses it, and a key names no task: the compiler is asked
 * whether `tutorial.task4.solutionCode.code` exists, never whether it belongs to
 * the task it was written under. A key that slipped a row still compiles, still
 * renders, still parses and still reads like a program, so the one thing left
 * that can tell is the text — and a slipped key shows up as two tasks holding
 * the same text, since the program it borrowed is still being handed out by its
 * owner as well.
 *
 * @param programOf - Which of a task's two programs to look at.
 * @returns One group of task ids per program that more than one task hands out,
 * in the order the track plays them; empty when every task's program is its own.
 */
function tasksSharingAProgram(
  programOf: (task: TutorialTask) => string,
): readonly (readonly string[])[] {
  const byProgram = new Map<string, string[]>();
  for (const task of tutorialTasks) {
    const program = programOf(task);
    const sharing = byProgram.get(program);
    if (sharing === undefined) {
      byProgram.set(program, [task.id]);
    } else {
      sharing.push(task.id);
    }
  }
  return [...byProgram.values()].filter((group) => group.length > 1);
}

describe("Learning track table", () => {
  it("has the eight tasks the track is built around", () => {
    expect(tutorialTasks).toHaveLength(8);
  });

  it("identifies its tasks by position-independent names, in order", () => {
    expect(tutorialTasks.map((task) => task.id)).toEqual([
      "tutorial-1",
      "tutorial-2",
      "tutorial-3",
      "tutorial-4",
      "tutorial-5",
      "tutorial-6",
      "tutorial-7",
      "tutorial-8",
    ]);
  });

  it("gives every task passengers of its own", () => {
    // Two tasks sharing a seed would share a passenger stream, which is not
    // wrong so much as wasteful of the one thing that makes the measurements
    // independent: a physics change that happens to be kind to one stream would
    // then be kind to two tasks at once, and the suite would notice less.
    //
    // Compared as text because that is how a seed is consumed: every stream
    // goes through `String(seed)` in {@link "./random.ts"!createRandomSource},
    // so the number 1 and the string "1" are one passenger stream wearing two
    // types, and a set of the raw values would count them as two.
    const seeds = tutorialTasks.map((task) => String(task.seed));
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("answers the last task with the one before it, in every language", () => {
    // Task 8 asks for nothing new, so its answer is task 7's, word for word.
    // The two are separate messages rather than one shared string, which is
    // deliberate: every task owning the same eight keys is what lets
    // `docs/i18n-inventory.md` cover the track by a shape and a translator meet
    // no exception. What a copy costs is drift, and this is what pays for it —
    // in both languages, since a comment added to one of them would part them
    // just as surely as a changed line.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(tutorialTasks.at(-1)?.solutionCode, locale).toBe(tutorialTasks.at(-2)?.solutionCode);
    }
  });

  it("fills every task's editor with a program no other task hands out, in every language", () => {
    // The mistake each task is built around is its own, so two tasks handed the
    // same program means one of them is not being taught what its entry says it
    // is. The way that happens is a key: the programs are messages, every one of
    // the sixteen keys is written out by hand under the task it belongs to, and
    // nothing about `tutorial.task4.startingCode.code` says which entry it may
    // be written under. A row that borrowed its neighbour's key is a task that
    // fills the editor with the neighbour's program — which compiles, renders,
    // parses, and passes every other check in this file, because it is a
    // perfectly good program. It is just not this task's.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(
        tasksSharingAProgram((task) => task.startingCode),
        locale,
      ).toEqual([]);
    }
  });

  it("answers every task with a program no other task is answered by, save the last, in every language", () => {
    // The same argument for the other half of each entry, and it is the half
    // where a slipped key is worst: the answer is shown to a player who has
    // given up, and an answer belonging to another task would clear neither the
    // task it is shown under nor any suspicion that the track is broken.
    //
    // One pair is deliberately the same program and is measured here rather
    // than excused: task 8's answer is task 7's, word for word, which the spec
    // above states as an equality and this one states as the *only* equality
    // there is. Written out as the pair rather than as a count, so that the day
    // the copy moves the failure names the two tasks that ended up sharing.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(
        tasksSharingAProgram((task) => task.solutionCode),
        locale,
      ).toEqual([["tutorial-7", "tutorial-8"]]);
    }
  });
});

for (const task of tutorialTasks) {
  describe(`Learning track task ${task.id}`, () => {
    it("is playable by the machinery that runs a level", () => {
      // Assignability is the actual assertion, and it is checked by tsc rather
      // than at runtime: if TutorialTask ever stops being a Level, this line
      // stops compiling and the app can no longer hand a task to `startRun`.
      const level: Level = task;
      expect(level.condition.description).not.toBe("");
    });

    it("is played in a building the game can construct", () => {
      const options = task.options;
      const floorCount = options.floorCount ?? 0;
      expect(floorCount).toBeGreaterThanOrEqual(BUILDING_LIMITS.floorCount.min);
      expect(floorCount).toBeLessThanOrEqual(BUILDING_LIMITS.floorCount.max);
      expect(Number.isInteger(floorCount)).toBe(true);

      const elevatorCount = options.elevatorCount ?? 0;
      expect(elevatorCount).toBeGreaterThanOrEqual(BUILDING_LIMITS.elevatorCount.min);
      expect(elevatorCount).toBeLessThanOrEqual(BUILDING_LIMITS.elevatorCount.max);
      expect(Number.isInteger(elevatorCount)).toBe(true);

      const spawnRate = options.spawnRate ?? 0;
      expect(spawnRate).toBeGreaterThanOrEqual(BUILDING_LIMITS.spawnRate.min);
      expect(spawnRate).toBeLessThanOrEqual(BUILDING_LIMITS.spawnRate.max);

      // Every task so far runs on the default four-passenger car, so this loop
      // is empty today. It is here because the day a task sets capacities is
      // the day the value arrives without anyone thinking about the range.
      for (const capacity of options.elevatorCapacities ?? []) {
        expect(capacity).toBeGreaterThanOrEqual(BUILDING_LIMITS.elevatorCapacity.min);
        expect(capacity).toBeLessThanOrEqual(BUILDING_LIMITS.elevatorCapacity.max);
        expect(Number.isInteger(capacity)).toBe(true);
      }
    });

    it("is pinned to a seed a shared link can carry", () => {
      const seed = String(task.seed);
      expect(seed).toMatch(URL_SAFE_SEED);
      expect(seed.length).toBeLessThanOrEqual(SEED_MAX_LENGTH);
    });

    it("sets a bar that decides nothing before the run has begun", () => {
      // A condition that has already made up its mind at t = 0 would end the
      // run on its first statistics update, before the player's program has
      // moved anything.
      expect(task.condition.evaluate(NOTHING_HAPPENED)).toBe(null);
    });

    it("sets a bar the building can in principle clear", () => {
      expectConditionIsReachable(task);
    });

    it("hands the player a program that differs from the answer", () => {
      // Not a formality: the mistake is the task. A starting program equal to
      // its answer is a task with nothing to find, and it would still pass the
      // solutions test's "the answer wins" half.
      expect(task.startingCode).not.toBe(task.solutionCode);
    });

    it("hands the player two programs that run, in every language", () => {
      // A comment is prose, and prose is translated: a translation carrying a
      // backtick, a `${` or a stray line break would not be a blemish on the
      // program, it would be the end of it. The player it stops is the one
      // reading the track in that language, so every language is parsed.
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const [label, code] of [
          ["starting code", task.startingCode],
          ["solution", task.solutionCode],
        ] as const) {
          const codeObj = getCodeObjFromCode(code);
          expect(typeof codeObj.init, `${task.id} ${label} in ${locale}: init`).toBe("function");
          expect(typeof codeObj.update, `${task.id} ${label} in ${locale}: update`).toBe(
            "function",
          );
        }
      }
    });

    it("hands the player two programs written like the starter program, in every language", () => {
      // Indentation, tabs, trailing space and line length are properties of the
      // text rather than of the code, so a translated comment can break any of
      // them while leaving a program that runs perfectly well and reads like it
      // came from somewhere else.
      for (const locale of LOCALES) {
        setLocale(locale);
        expectPlayerCodeStyle(`${task.id} starting code in ${locale}`, task.startingCode);
        expectPlayerCodeStyle(`${task.id} solution in ${locale}`, task.solutionCode);
      }
    });

    it("renders its programs in the language they are read in", () => {
      // The two fields are getters over message keys, which is the whole of what
      // makes the track translatable: read at import time — as a field would be
      // — both programs would freeze in whatever language was active while this
      // module was being evaluated, and that is no language at all, since the
      // table is built before anything has chosen one.
      //
      // The other half of the statement is what stays the same. Only the
      // comments are translated, so the code with its comments stripped must be
      // the same text in both languages, and a program that has comments must
      // not be the same text with them.
      setLocale(DEFAULT_LOCALE);
      const english = { start: task.startingCode, answer: task.solutionCode };
      setLocale("ru");
      const russian = { start: task.startingCode, answer: task.solutionCode };
      for (const [label, before, after] of [
        ["starting code", english.start, russian.start],
        ["solution", english.answer, russian.answer],
      ] as const) {
        expect(withoutComments(after), `${task.id} ${label}: the code was translated too`).toBe(
          withoutComments(before),
        );
        if (before.includes("//")) {
          expect(after, `${task.id} ${label}: the comments were left in English`).not.toBe(before);
        }
      }
    });
  });
}
