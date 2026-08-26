/** Checks the learning-track table's shape — buildings, ids, seeds, and programs that parse — not whether it teaches. */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Level, LevelWorldStats } from "./levels.ts";
import { tutorialLevels, type TutorialLevel } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";

afterEach(() => {
  // Resets the locale so later specs don't inherit whichever language ran last.
  setLocale(DEFAULT_LOCALE);
});

/**
 * The buildings the rest of the game is willing to construct.
 * Duplicated from the sandbox limits rather than imported, so a tutorial building can't drift outside the range the renderer and physics are actually tested against.
 */
const BUILDING_LIMITS = {
  /** Two is the fewest floors an elevator can have somewhere to go. */
  floorCount: { min: 2, max: 60 },
  elevatorCount: { min: 1, max: 12 },
  elevatorCapacity: { min: 1, max: 30 },
  spawnRate: { min: 0.01, max: 10 },
} as const;

/**
 * What a seed may look like.
 * A pinned seed is still shared as a URL, so it must survive a round trip through `location.hash` byte for byte.
 */
const URL_SAFE_SEED = /^[\w.-]+$/;

/** Longest seed the address bar accepts. */
const SEED_MAX_LENGTH = 64;

/** Indentation step of the player-facing programs, in spaces. */
const INDENT_WIDTH = 4;

/**
 * Longest line a player-facing program may contain.
 * The same width the repo's own sources use: the in-game editor sits in a narrow pane, and a wrapped line is read twice.
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
 * Feeds the condition the fastest trajectory physically possible — every passenger delivered the instant it spawns — so this probe can be too strict but never too lenient.
 * @param level - The level whose condition is probed.
 */
function expectConditionIsReachable(level: TutorialLevel): void {
  const spawnRate = level.options.spawnRate ?? 0;
  expect(spawnRate).toBeGreaterThan(0);
  for (let delivered = 1; delivered <= REACHABILITY_PROBE_LIMIT; delivered++) {
    const verdict = level.condition.evaluate({
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
    `${level.id}: the condition was still undecided after ${String(REACHABILITY_PROBE_LIMIT)} ` +
      `instant deliveries, so nothing can be concluded about whether it can be met`,
  );
}

/**
 * Asserts a program is formatted the way the game's other player-facing code is: four-space indentation, no tabs, no trailing whitespace.
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
 * A program with its `//` comments taken out, so the same code can be compared across languages.
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
 * The levels that hand out one and the same program, grouped by that program.
 * Catches a message key written under the wrong level: the compiler can't tell, but the shared text can.
 * @param programOf - Which of a level's two programs to look at.
 * @returns One group of level ids per shared program; empty when every level's program is its own.
 */
function levelsSharingAProgram(
  programOf: (level: TutorialLevel) => string,
): readonly (readonly string[])[] {
  const byProgram = new Map<string, string[]>();
  for (const level of tutorialLevels) {
    const program = programOf(level);
    const sharing = byProgram.get(program);
    if (sharing === undefined) {
      byProgram.set(program, [level.id]);
    } else {
      sharing.push(level.id);
    }
  }
  return [...byProgram.values()].filter((group) => group.length > 1);
}

describe("Learning track table", () => {
  it("has the eight levels the track is built around", () => {
    expect(tutorialLevels).toHaveLength(8);
  });

  it("identifies its levels by position-independent names, in order", () => {
    expect(tutorialLevels.map((level) => level.id)).toEqual([
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

  it("gives every level passengers of its own", () => {
    // Compared as text: every seed is consumed via String(seed), so the number
    // 1 and the string "1" produce the same passenger stream and must count as
    // one, not two.
    const seeds = tutorialLevels.map((level) => String(level.seed));
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("answers the last level with the one before it, in every language", () => {
    // Kept as two separate messages rather than one shared string, so a
    // comment added to only one translation would go undetected without this check.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(tutorialLevels.at(-1)?.solutionCode, locale).toBe(tutorialLevels.at(-2)?.solutionCode);
    }
  });

  it("fills every level's editor with a program no other level hands out, in every language", () => {
    // Catches a message key copy-pasted under the wrong level: the program
    // still compiles and parses fine, so only a shared text gives it away.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(
        levelsSharingAProgram((level) => level.startingCode),
        locale,
      ).toEqual([]);
    }
  });

  it("answers every level with a program no other level is answered by, save the last, in every language", () => {
    // Same check as above, on answers, where level 7 and 8 sharing one is the
    // only allowed exception.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(
        levelsSharingAProgram((level) => level.solutionCode),
        locale,
      ).toEqual([["tutorial-7", "tutorial-8"]]);
    }
  });
});

for (const level of tutorialLevels) {
  describe(`Learning track level ${level.id}`, () => {
    it("is playable by the machinery that runs a level", () => {
      // The real assertion is that this assigns at all: if TutorialLevel ever
      // stops being a Level, this line stops compiling.
      const asLevel: Level = level;
      expect(asLevel.condition.description).not.toBe("");
    });

    it("is played in a building the game can construct", () => {
      const options = level.options;
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

      // Empty today since every level uses the default car; guards the day a
      // level sets capacities explicitly.
      for (const capacity of options.elevatorCapacities ?? []) {
        expect(capacity).toBeGreaterThanOrEqual(BUILDING_LIMITS.elevatorCapacity.min);
        expect(capacity).toBeLessThanOrEqual(BUILDING_LIMITS.elevatorCapacity.max);
        expect(Number.isInteger(capacity)).toBe(true);
      }
    });

    it("is pinned to a seed a shared link can carry", () => {
      const seed = String(level.seed);
      expect(seed).toMatch(URL_SAFE_SEED);
      expect(seed.length).toBeLessThanOrEqual(SEED_MAX_LENGTH);
    });

    it("sets a bar that decides nothing before the run has begun", () => {
      // A condition already decided at t = 0 would end the run before the
      // player's program has moved anything.
      expect(level.condition.evaluate(NOTHING_HAPPENED)).toBe(null);
    });

    it("sets a bar the building can in principle clear", () => {
      expectConditionIsReachable(level);
    });

    it("hands the player a program that differs from the answer", () => {
      // Not a formality: a starting program equal to its answer is a level
      // with nothing to find.
      expect(level.startingCode).not.toBe(level.solutionCode);
    });

    it("hands the player two programs that run, in every language", () => {
      // A translated comment carrying a stray backtick, `${`, or line break
      // would break the program outright, so every language is parsed here.
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const [label, code] of [
          ["starting code", level.startingCode],
          ["solution", level.solutionCode],
        ] as const) {
          const codeObj = getCodeObjFromCode(code);
          expect(typeof codeObj.init, `${level.id} ${label} in ${locale}: init`).toBe("function");
          expect(typeof codeObj.update, `${level.id} ${label} in ${locale}: update`).toBe(
            "function",
          );
        }
      }
    });

    it("hands the player two programs written like the starter program, in every language", () => {
      // Formatting lives in the comments, so a translation can break style
      // rules while leaving a program that still runs fine.
      for (const locale of LOCALES) {
        setLocale(locale);
        expectPlayerCodeStyle(`${level.id} starting code in ${locale}`, level.startingCode);
        expectPlayerCodeStyle(`${level.id} solution in ${locale}`, level.solutionCode);
      }
    });

    it("renders its programs in the language they are read in", () => {
      // These are getters over message keys, read fresh per locale rather than
      // frozen at import time. Only the comments should differ between
      // languages; the code itself must stay identical.
      setLocale(DEFAULT_LOCALE);
      const english = { start: level.startingCode, answer: level.solutionCode };
      setLocale("ru");
      const russian = { start: level.startingCode, answer: level.solutionCode };
      for (const [label, before, after] of [
        ["starting code", english.start, russian.start],
        ["solution", english.answer, russian.answer],
      ] as const) {
        expect(withoutComments(after), `${level.id} ${label}: the code was translated too`).toBe(
          withoutComments(before),
        );
        if (before.includes("//")) {
          expect(after, `${level.id} ${label}: the comments were left in English`).not.toBe(before);
        }
      }
    });
  });
}
