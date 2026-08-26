/** Checks the Skyscraper table's shape — ids, buildings, bars, cards, and localized messages — not whether a level is worth playing. */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Level, LevelWorldStats } from "./levels.ts";
import { skyscraperLevels, type SkyscraperCard, type SkyscraperLevel } from "./skyscraper.ts";
import { at } from "./test-helpers.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorld } from "./world.ts";

afterEach(() => {
  // Resets the locale so later specs don't inherit whichever language ran last.
  setLocale(DEFAULT_LOCALE);
});

/**
 * What an id of this block looks like.
 * Ids double as storage keys, for saved programs and medals, so one spelled differently would be a level whose progress belongs to nobody.
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
 * Feeds the condition the fastest trajectory physically possible — one move per passenger, nobody kept waiting — so this catches a badly mistyped threshold without ever rejecting a valid one.
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

/**
 * Reads the card off a level that is expected to carry one.
 * @param level - A level of the block.
 * @returns Its card, read in whatever language is current.
 * @throws When the level has no card.
 */
function cardOf(level: SkyscraperLevel): SkyscraperCard {
  const card = level.card;
  if (card === undefined) {
    throw new Error(`${level.id} has no briefing card`);
  }
  return card;
}

/**
 * Every journey a level's traffic can ask for, as `[from, to]` pairs.
 * Enumerates what `drawPeakTrip`/`drawMixedTrip` can produce; kept in sync with them by hand.
 * @param level - The level whose traffic is enumerated.
 * @returns Where a passenger can start and where they can be going.
 */
function tripsOfTraffic(level: SkyscraperLevel): (readonly [number, number])[] {
  const floorCount = level.options.floorCount ?? 0;
  const away = Array.from({ length: Math.max(floorCount - 1, 0) }, (_unused, index) => index + 1);
  switch (level.options.trafficProfile ?? "mixed") {
    case "up-peak": {
      return away.map((floor) => [0, floor] as const);
    }
    case "down-peak": {
      return away.map((floor) => [floor, 0] as const);
    }
    case "lunch": {
      return away.flatMap((floor) => [[0, floor] as const, [floor, 0] as const]);
    }
    case "mixed": {
      const floors = Array.from({ length: floorCount }, (_unused, index) => index);
      return floors.flatMap((from) =>
        floors.filter((to) => to !== from).map((to) => [from, to] as const),
      );
    }
  }
}

describe("Skyscraper block table", () => {
  it("has levels to play at all", () => {
    // Guards every other spec here: a loop over an empty table would pass
    // green while checking nothing.
    expect(skyscraperLevels.length).toBeGreaterThan(0);
  });

  it("identifies its levels by names no two of them share", () => {
    // An id is a storage key — for the address bar, saved programs, and
    // medals — so two levels sharing one would share a bookmark and a medal too.
    const ids = skyscraperLevels.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(skyscraperLevels)("Skyscraper level $id", (level) => {
  it("is named the way the block's ids are spelled", () => {
    expect(level.id).toMatch(SKYSCRAPER_ID);
  });

  it("is playable by the machinery that runs a level", () => {
    // The real assertion is that this assigns at all: SkyscraperLevel is
    // deliberately its own type rather than an extension of Level.
    const asLevel: Level = level;
    expect(asLevel.condition.description).not.toBe("");
  });

  it("is played in a building the game can construct", () => {
    // Checks the built world, not just options: createWorld is what actually
    // turns these numbers into floors and cars.
    const world = createWorld(level.options, level.seed);

    expect(world.floors).toHaveLength(level.options.floorCount ?? 0);
    expect(world.elevators).toHaveLength(level.options.elevatorCount ?? 0);

    // The world cycles this list over the cars, so one capacity in the table
    // means that capacity in every car.
    const capacities = level.options.elevatorCapacities ?? [];
    if (capacities.length > 0) {
      expect(world.elevators.map((elevator) => elevator.maxUsers)).toEqual(
        world.elevators.map((_unused, index) => at(capacities, index % capacities.length)),
      );
    }
  });

  it("sets a bar that decides nothing before the run has begun", () => {
    // A condition already decided at t = 0 would end the run before the
    // player's program has moved anything.
    expect(level.condition.evaluate(NOTHING_HAPPENED)).toBe(null);
  });

  it("sets a bar the building can in principle clear", () => {
    // The goal meter needs figures to draw, and those figures must be reachable.
    expect(level.condition.requirements.length).toBeGreaterThan(0);
    expectConditionIsReachable(level);
  });

  it("fills the editor in every language", () => {
    // A missing or misfiled message key shows up as an empty string, in
    // whichever language it happened in.
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(level.startingCode.length, `${level.id} starting code in ${locale}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("opens the editor with a program that runs, in every language", () => {
    // A translated comment carrying a stray backtick, `${`, or line break
    // would break the program outright, so every language is parsed here.
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

describe("the levels that carry a briefing card", () => {
  const carded = skyscraperLevels.filter((level) => level.card !== undefined);

  it("has cards to draw at all", () => {
    // Guards the specs below: most levels having no card is the design, but
    // none having one would be a mistake, not a variant.
    expect(carded.length).toBeGreaterThan(0);
  });

  it.each(carded)("says what $id is about, in every language", (level) => {
    // A missing or misfiled key shows up as an empty string, in whichever
    // language it happened in.
    for (const locale of LOCALES) {
      setLocale(locale);
      const card = cardOf(level);
      expect(card.title.length, `${level.id} title in ${locale}`).toBeGreaterThan(0);
      expect(card.briefing.length, `${level.id} briefing in ${locale}`).toBeGreaterThan(0);
    }
  });

  it.each(carded)("renders $id's card in the language it is read in", (level) => {
    // Cards are getters, read fresh per locale; a frozen field would look
    // identical in both languages and still pass a plain non-empty check.
    // startingCode isn't held to this, since a starter without comments is
    // legitimately identical in both languages.
    setLocale(DEFAULT_LOCALE);
    const english = cardOf(level);
    setLocale("ru");
    const russian = cardOf(level);

    expect(russian.title, `${level.id}: the title was left in ${DEFAULT_LOCALE}`).not.toBe(
      english.title,
    );
    expect(russian.briefing, `${level.id}: the briefing was left in ${DEFAULT_LOCALE}`).not.toBe(
      english.briefing,
    );
  });
});

describe("the buildings whose cars do not all go everywhere", () => {
  const zoned = skyscraperLevels.filter(
    (level) => level.options.elevatorServedFloors !== undefined,
  );

  it("has zoned levels at all", () => {
    // Guards the invariant below: a block that lost all its zones would leave
    // it green while checking nothing.
    expect(zoned.length).toBeGreaterThan(0);
  });

  it.each(zoned)("carries every journey $id's traffic can ask for", (level) => {
    // Catches a zone split that strands a floor: no car ever serving it means
    // the run doesn't lose, it just goes silent. Checked against the built
    // world, since that's what actually cycles the zone list over the cars.
    const world = createWorld(level.options, level.seed);
    const stranded = tripsOfTraffic(level).filter(
      ([from, to]) =>
        !world.elevators.some((elevator) => elevator.serves(from) && elevator.serves(to)),
    );

    expect(stranded, `${level.id}: journeys no single car serves end to end`).toEqual([]);
  });
});
