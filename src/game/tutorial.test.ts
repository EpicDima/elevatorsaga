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
 */

import { describe, expect, it } from "vitest";

import type { Challenge, ChallengeWorldStats } from "./challenges.ts";
import { tutorialTasks, type TutorialTask } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";

/**
 * The buildings the rest of the game is willing to construct.
 *
 * A restatement of `SANDBOX_LIMITS` in src/app/router.ts, which is not exported;
 * duplicated on purpose rather than reached for, because the point of the check
 * is not "the sandbox agrees" but "this building is inside the range the
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
 * Mirrors `SEED_PATTERN` and `SEED_MAX_LENGTH` in src/app/router.ts. A tutorial
 * seed is pinned in this table rather than typed into the address bar, but a
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
const NOTHING_HAPPENED: ChallengeWorldStats = {
  elapsedTime: 0,
  transportedCounter: 0,
  maxWaitTime: 0,
  moveCount: 0,
};

/**
 * Asserts a bar could be cleared by a program better than any that can exist.
 *
 * The bound is the spawn rate. Passengers appear one every `1 / spawnRate`
 * seconds, so at the moment the *k*th of them exists no program has delivered
 * more than *k*, and none has done it in less than `k / spawnRate` seconds. The
 * probe hands the condition exactly that trajectory, with a waiting time of
 * zero, which is a program that teleports each passenger the instant they
 * arrive. If even that loses, the task is arithmetically unwinnable and the
 * threshold is a typo.
 *
 * Deliberately a loose bound: real deliveries cost travel time, so passing this
 * says only "not impossible", never "achievable". The achievable half is what
 * `tutorial-solutions.test.ts` measures by running the answer.
 *
 * @param task - The task whose condition is probed.
 */
function expectConditionIsReachable(task: TutorialTask): void {
  const spawnRate = task.options.spawnRate ?? 0;
  expect(spawnRate).toBeGreaterThan(0);
  for (let delivered = 1; delivered <= REACHABILITY_PROBE_LIMIT; delivered++) {
    const verdict = task.condition.evaluate({
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
 * {@link "../ui/default-code.ts"!DEFAULT_CODE} in the same editor. Four-space
 * indentation, spaces rather than tabs and no trailing blanks are what that file
 * establishes; a task that arrives formatted differently makes the track look
 * like it came from somewhere else.
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
    const seeds = tutorialTasks.map((task) => task.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

for (const task of tutorialTasks) {
  describe(`Learning track task ${task.id}`, () => {
    it("is playable by the machinery that runs a challenge", () => {
      // Assignability is the actual assertion, and it is checked by tsc rather
      // than at runtime: if TutorialTask ever stops being a Challenge, this line
      // stops compiling and the app can no longer hand a task to `startRun`.
      const challenge: Challenge = task;
      expect(challenge.condition.description).not.toBe("");
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

    it("hands the player two programs that run", () => {
      for (const [label, code] of [
        ["starting code", task.startingCode],
        ["solution", task.solutionCode],
      ] as const) {
        const codeObj = getCodeObjFromCode(code);
        expect(typeof codeObj.init, `${task.id} ${label}: init`).toBe("function");
        expect(typeof codeObj.update, `${task.id} ${label}: update`).toBe("function");
      }
    });

    it("hands the player two programs written like the starter program", () => {
      expectPlayerCodeStyle(`${task.id} starting code`, task.startingCode);
      expectPlayerCodeStyle(`${task.id} solution`, task.solutionCode);
    });
  });
}
