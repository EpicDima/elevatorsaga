/**
 * The Skyscraper table is a table: ids that survive being written down,
 * buildings the game can actually construct, bars that decide nothing before a
 * run has begun and can still be cleared, and three messages per level that
 * arrive in the language they are read in.
 *
 * Everything here is about the *shape* of
 * {@link "./skyscraper.ts"!skyscraperLevels}. Whether a level is worth playing
 * — whether the move budget in its comment is the one a run actually measures —
 * is not decidable by reading the table and is not attempted here; that is a
 * simulation's job, the way `tutorial-solutions.test.ts` does it for the
 * learning track. The division is the one that file draws: these checks are
 * fast and total, that one is slow and empirical, and mixing them hides a typo
 * behind a two-second simulation.
 *
 * Written as a loop over the table rather than as a set of specs about `sky-1`,
 * because this block is the part of the game that is expected to grow. A level
 * added tomorrow arrives with its id, its building, its bar and its three
 * messages already checked, instead of arriving with a note asking somebody to
 * write these specs again by hand — which is the kind of note that gets skipped
 * on the level where it would have mattered.
 *
 * Every message is read in every language, and that is not thoroughness — it is
 * the whole of what `title`, `briefing` and `startingCode` being getters is for.
 * A field there would be rendered while the module is being imported, before
 * anything has chosen a language, and would answer in that one language for the
 * rest of the session. What that failure looks like from outside is the English
 * and the Russian text being one and the same string, so that is what is
 * asserted here, rather than only that each of them is non-empty: a frozen
 * getter passes "non-empty" perfectly.
 */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Level, LevelWorldStats } from "./levels.ts";
import { skyscraperLevels, type SkyscraperLevel } from "./skyscraper.ts";
import { at } from "./test-helpers.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorld } from "./world.ts";

afterEach(() => {
  // Every spec below that names a language leaves it named, and the table
  // answers in whatever language was set last.
  setLocale(DEFAULT_LOCALE);
});

/**
 * What an id of this block looks like.
 *
 * The block's own shape rather than a general "some string": `sky-` is what the
 * address bar carries, what a saved program is filed under and what
 * `entities/skyscraper-level`'s medals are keyed by, and an id that arrived
 * spelled some other way would be a level whose stored progress belongs to
 * nobody.
 */
const SKYSCRAPER_ID = /^sky-\d+$/;

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
 * The same probe `tutorial.test.ts` runs over the learning track, spelled again
 * here rather than shared: it is written against that file's level type, and a
 * helper reaching across the two tables would tie a check about this block to a
 * change made for that one. What it does is worth repeating exactly, because it
 * catches the one mistake a table of hand-measured thresholds is prone to — a
 * number that no program could ever meet because the passengers to satisfy it
 * have not been born yet.
 *
 * The bound is the spawn rate. Passengers appear one every `1 / spawnRate`
 * seconds, so no program has delivered more than *k* of them by the time the
 * *k*th arrives. The probe hands the condition that trajectory — *k* delivered
 * at `k / spawnRate` seconds, one move spent per delivery and nobody kept
 * waiting — which is a program no player can write. If even that loses, the
 * threshold is a typo.
 *
 * Deliberately loose, and therefore one-directional: passing says "not
 * impossible", never "achievable". The move budget is where it is loosest, and
 * this is the first block to be judged on one — a car climbing eleven floors
 * spends eleven moves to deliver whoever is on it, so one move per passenger is
 * cheaper than the building allows. That is the right way round for a sanity
 * check on a *hand-measured* budget: what it is here to catch is a budget of 17
 * where 170 was meant, not a budget that is merely tight.
 *
 * @param level - The level whose condition is probed.
 */
function expectConditionIsReachable(level: SkyscraperLevel): void {
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

describe("Skyscraper block table", () => {
  it("has levels to play at all", () => {
    // The loop below is the whole of this file, and a loop over an empty table
    // is a green suite that checked nothing. This is the line that fails on the
    // day the table is emptied by an editing accident rather than by a decision.
    expect(skyscraperLevels.length).toBeGreaterThan(0);
  });

  it("identifies its levels by names no two of them share", () => {
    // A level is addressed by its id everywhere it has to survive being written
    // down -- the address bar, the saved program, the medal on record -- so two
    // entries answering to one name is two levels sharing a bookmark and a
    // medal, and the one that loads is whichever the reader looks up first.
    const ids = skyscraperLevels.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(skyscraperLevels)("Skyscraper level $id", (level) => {
  it("is named the way the block's ids are spelled", () => {
    expect(level.id).toMatch(SKYSCRAPER_ID);
  });

  it("is playable by the machinery that runs a level", () => {
    // Assignability is the actual assertion, and it is checked by tsc rather
    // than at runtime: `SkyscraperLevel` is deliberately its own type rather
    // than an extension of `Level`, so this line is what holds the two shapes
    // together. If it ever stops compiling, an entry here can no longer be
    // handed to the code that starts a run.
    const asLevel: Level = level;
    expect(asLevel.condition.description).not.toBe("");
  });

  it("is played in a building the game can construct", () => {
    // Not a restatement of the table: `createWorld` is where the numbers in
    // `options` become floors and cars, and a building that comes out a
    // different size from the one that was measured is a building whose
    // thresholds mean nothing.
    const world = createWorld(level.options, level.seed);

    expect(world.floors).toHaveLength(level.options.floorCount ?? 0);
    expect(world.elevators).toHaveLength(level.options.elevatorCount ?? 0);

    // This is the first block whose levels set capacities at all, and the world
    // cycles the list over the cars, so one capacity in the table means that
    // capacity in every car. A level that quietly got the default four-
    // passenger car instead is a different building from the measured one.
    const capacities = level.options.elevatorCapacities ?? [];
    if (capacities.length > 0) {
      expect(world.elevators.map((elevator) => elevator.maxUsers)).toEqual(
        world.elevators.map((_unused, index) => at(capacities, index % capacities.length)),
      );
    }
  });

  it("sets a bar that decides nothing before the run has begun", () => {
    // A condition that has already made up its mind at t = 0 would end the run
    // on its first statistics update, before the player's program has moved
    // anything.
    expect(level.condition.evaluate(NOTHING_HAPPENED)).toBe(null);
  });

  it("sets a bar the building can in principle clear", () => {
    // Two halves of one promise: the bar names something to reach -- the goal
    // meter has figures to draw and the run can end -- and the figures are not
    // arithmetically out of reach.
    expect(level.condition.requirements.length).toBeGreaterThan(0);
    expectConditionIsReachable(level);
  });

  it("names itself, says what it is about and fills the editor, in every language", () => {
    // All three are getters over message keys, and a key written under the
    // wrong entry, a key deleted from one catalogue, or a getter that stopped
    // reading the catalogue at all shows up here as an empty string -- in
    // whichever language it happened in, which is why every one is asked.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(level.title.length, `${level.id} title in ${locale}`).toBeGreaterThan(0);
      expect(level.briefing.length, `${level.id} briefing in ${locale}`).toBeGreaterThan(0);
      expect(level.startingCode.length, `${level.id} starting code in ${locale}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("renders its card in the language it is read in", () => {
    // The spec the getters exist for. Read as fields, the two would freeze in
    // whatever language was active while this module was being evaluated -- and
    // that is no language at all, since the table is built before anything has
    // chosen one. The failure is silent by construction: a frozen title is a
    // perfectly good title, in one language, forever. What gives it away is
    // being the *same* title in both.
    //
    // `startingCode` is not held to this. Only the comments in a program are
    // translated, so a starter written without one is legitimately the same
    // text in both languages; where a translation of it goes wrong is by
    // ceasing to be a program, which the spec below is what catches.
    setLocale(DEFAULT_LOCALE);
    const english = { title: level.title, briefing: level.briefing };
    setLocale("ru");
    const russian = { title: level.title, briefing: level.briefing };

    expect(russian.title, `${level.id}: the title was left in ${DEFAULT_LOCALE}`).not.toBe(
      english.title,
    );
    expect(russian.briefing, `${level.id}: the briefing was left in ${DEFAULT_LOCALE}`).not.toBe(
      english.briefing,
    );
  });

  it("opens the editor with a program that runs, in every language", () => {
    // A comment is prose, and prose is translated: a translation carrying a
    // backtick, a `${` or a stray line break would not be a blemish on the
    // program, it would be the end of it -- and the player it stops is the one
    // reading the level in that language, so every language is parsed.
    for (const locale of LOCALES) {
      setLocale(locale);
      const codeObj = getCodeObjFromCode(level.startingCode);
      expect(typeof codeObj.init, `${level.id} starting code in ${locale}: init`).toBe("function");
      expect(typeof codeObj.update, `${level.id} starting code in ${locale}: update`).toBe(
        "function",
      );
    }
  });
});
