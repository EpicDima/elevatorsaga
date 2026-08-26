import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  createSandboxLevel,
  requireSandbox,
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinMovesWithMaxWaitTime,
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type LevelWorldStats,
  type SandboxOptions,
} from "./levels.ts";

/** A world in which nothing at all has happened yet. */
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

/** A sandbox building the specs vary one field of at a time. */
const SANDBOX: SandboxOptions = {
  floorCount: 20,
  elevatorCount: 2,
  elevatorCapacities: [4],
  spawnRate: 1.5,
};

/** The statistics a condition reads, made mutable so specs can nudge them. */
type MutableWorldStats = { -readonly [K in keyof LevelWorldStats]: LevelWorldStats[K] };

describe("Level requirements", () => {
  let fakeWorld: MutableWorldStats;

  beforeEach(() => {
    fakeWorld = {
      elapsedTime: 0.0,
      transportedCounter: 0,
      maxWaitTime: 0.0,
      moveCount: 0,
      transportedPerSec: 0.0,
      avgLoadFactorOnMove: 0.0,
      avgWaitTime: 0.0,
      maxPickupTime: 0.0,
      avgPickupTime: 0.0,
      avgRideTime: 0.0,
      stopCount: 0,
      avgPeoplePerStop: 0.0,
    };
  });

  describe("requireUserCountWithinTime", () => {
    it("evaluates correctly", () => {
      const levelReq = requireUserCountWithinTime(10, 5.0);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.elapsedTime = 5.1;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.elapsedTime = 4.9;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
    });

    it("describes itself", () => {
      expect(requireUserCountWithinTime(15, 60).description).toBe(
        "Transport <span class='emphasis-color'>15</span> people in " +
          "<span class='emphasis-color'>60</span> seconds or less",
      );
    });

    it("exposes the same figures as structured requirements, for a goal bar to meter", () => {
      expect(requireUserCountWithinTime(15, 60).requirements).toEqual([
        { field: "transportedCounter", comparison: "atLeast", threshold: 15 },
        { field: "elapsedTime", comparison: "atMost", threshold: 60 },
      ]);
    });
  });

  describe("requireUserCountWithMaxWaitTime", () => {
    it("evaluates correctly", () => {
      const levelReq = requireUserCountWithMaxWaitTime(10, 4.0);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.maxWaitTime = 4.5;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.maxWaitTime = 3.9;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
    });

    it("describes itself with one decimal of the limit", () => {
      expect(requireUserCountWithMaxWaitTime(50, 21).description).toBe(
        "Transport <span class='emphasis-color'>50</span> people and let no one take more than " +
          "<span class='emphasis-color'>21.0</span> seconds to be delivered",
      );
    });

    it("exposes the same figures as structured requirements, for a goal bar to meter", () => {
      expect(requireUserCountWithMaxWaitTime(50, 21).requirements).toEqual([
        { field: "transportedCounter", comparison: "atLeast", threshold: 50 },
        { field: "maxWaitTime", comparison: "atMost", threshold: 21 },
      ]);
    });
  });

  describe("requireUserCountWithinMoves", () => {
    it("evaluates correctly", () => {
      const levelReq = requireUserCountWithinMoves(10, 20);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.moveCount = 21;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.moveCount = 20;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
    });

    it("counts the move limit itself as a win", () => {
      const levelReq = requireUserCountWithinMoves(10, 20);
      fakeWorld.moveCount = 20;
      fakeWorld.transportedCounter = 10;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
    });

    it("describes itself", () => {
      expect(requireUserCountWithinMoves(40, 60).description).toBe(
        "Transport <span class='emphasis-color'>40</span> people using " +
          "<span class='emphasis-color'>60</span> elevator moves or less",
      );
    });

    it("exposes the same figures as structured requirements, for a goal bar to meter", () => {
      expect(requireUserCountWithinMoves(40, 60).requirements).toEqual([
        { field: "transportedCounter", comparison: "atLeast", threshold: 40 },
        { field: "moveCount", comparison: "atMost", threshold: 60 },
      ]);
    });
  });

  describe("requireUserCountWithinTimeWithMaxWaitTime", () => {
    it("evaluates correctly", () => {
      const levelReq = requireUserCountWithinTimeWithMaxWaitTime(10, 5.0, 4.0);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.elapsedTime = 5.1;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.elapsedTime = 4.9;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
      fakeWorld.maxWaitTime = 4.1;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
    });

    it("describes itself, grouping the digits of the numbers it is counting", () => {
      // Grouped via Intl.NumberFormat, not string-built: the same number
      // renders as `2,675` in English and `2 675` in Russian.
      expect(requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45).description).toBe(
        "Transport <span class='emphasis-color'>2,675</span> people in " +
          "<span class='emphasis-color'>1,800</span> seconds or less and let no one take more " +
          "than <span class='emphasis-color'>45.0</span> seconds to be delivered",
      );
    });

    it("exposes the same figures as structured requirements, for a goal bar to meter", () => {
      expect(requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45).requirements).toEqual([
        { field: "transportedCounter", comparison: "atLeast", threshold: 2675 },
        { field: "elapsedTime", comparison: "atMost", threshold: 1800 },
        { field: "maxWaitTime", comparison: "atMost", threshold: 45 },
      ]);
    });
  });

  describe("requireUserCountWithinMovesWithMaxWaitTime", () => {
    it("evaluates correctly", () => {
      const levelReq = requireUserCountWithinMovesWithMaxWaitTime(10, 20, 4.0);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.moveCount = 21;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.moveCount = 19;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
      fakeWorld.maxWaitTime = 4.1;
      expect(levelReq.evaluate(fakeWorld)).toBe(false);
    });

    it("decides as soon as either limit is reached, not when the crowd is delivered", () => {
      // A run that has spent its moves or overrun the wait limit is lost
      // regardless of how many passengers are still incoming.
      const levelReq = requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30);
      expect(levelReq.evaluate({ ...fakeWorld, moveCount: 450 })).toBe(false);
      expect(levelReq.evaluate({ ...fakeWorld, maxWaitTime: 30 })).toBe(false);
      expect(levelReq.evaluate({ ...fakeWorld, moveCount: 449, maxWaitTime: 29.9 })).toBe(null);
    });

    it("counts both limits themselves as a win", () => {
      const levelReq = requireUserCountWithinMovesWithMaxWaitTime(10, 20, 4.0);
      fakeWorld.moveCount = 20;
      fakeWorld.maxWaitTime = 4.0;
      fakeWorld.transportedCounter = 10;
      expect(levelReq.evaluate(fakeWorld)).toBe(true);
    });

    it("describes itself", () => {
      expect(requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30).description).toBe(
        "Transport <span class='emphasis-color'>100</span> people using " +
          "<span class='emphasis-color'>450</span> elevator moves or less and let no one take " +
          "more than <span class='emphasis-color'>30.0</span> seconds to be delivered",
      );
    });

    it("exposes the same figures as structured requirements, for a goal bar to meter", () => {
      expect(requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30).requirements).toEqual([
        { field: "transportedCounter", comparison: "atLeast", threshold: 100 },
        { field: "moveCount", comparison: "atMost", threshold: 450 },
        { field: "maxWaitTime", comparison: "atMost", threshold: 30 },
      ]);
    });
  });

  describe("requireSandbox", () => {
    it("never resolves, whatever the run does", () => {
      const levelReq = requireSandbox(SANDBOX);
      expect(levelReq.evaluate(fakeWorld)).toBe(null);
      for (const stats of [
        { ...NOTHING_HAPPENED, elapsedTime: 1e9 },
        { ...NOTHING_HAPPENED, transportedCounter: 1e9 },
        {
          elapsedTime: 1e9,
          transportedCounter: 1e9,
          maxWaitTime: 1e9,
          moveCount: 1e9,
          transportedPerSec: 1e9,
          avgLoadFactorOnMove: 1e9,
          avgWaitTime: 1e9,
          maxPickupTime: 1e9,
          avgPickupTime: 1e9,
          avgRideTime: 1e9,
          stopCount: 1e9,
          avgPeoplePerStop: 1e9,
        },
      ]) {
        Object.assign(fakeWorld, stats);
        expect(levelReq.evaluate(fakeWorld), JSON.stringify(stats)).toBe(null);
      }
    });

    it("states the parameters in effect, since the url they came from is off screen", () => {
      expect(requireSandbox(SANDBOX).description).toBe(
        "Sandbox: <span class='emphasis-color'>20</span> floors, " +
          "<span class='emphasis-color'>2</span> elevators of capacity " +
          "<span class='emphasis-color'>4</span>, " +
          "<span class='emphasis-color'>1.5</span> people per second. " +
          "No goal, so the run never ends",
      );
    });

    it("lists every capacity, because the world cycles them over the cars", () => {
      expect(requireSandbox({ ...SANDBOX, elevatorCapacities: [6, 9] }).description).toContain(
        "of capacities <span class='emphasis-color'>6</span> and " +
          "<span class='emphasis-color'>9</span>",
      );
      expect(requireSandbox({ ...SANDBOX, elevatorCapacities: [4, 6, 9] }).description).toContain(
        "of capacities <span class='emphasis-color'>4</span>, " +
          "<span class='emphasis-color'>6</span>, and " +
          "<span class='emphasis-color'>9</span>",
      );
    });

    it("counts a single elevator in the singular", () => {
      expect(requireSandbox({ ...SANDBOX, elevatorCount: 1 }).description).toContain(
        "<span class='emphasis-color'>1</span> elevator of",
      );
    });

    it("reports a spawn rate to the last digit it was given", () => {
      // Intl.NumberFormat rounds to three decimals by default, which would
      // print 0.0625 and 9.9999 as indistinguishable from other rates
      // entirely; the format used here must not round.
      expect(requireSandbox({ ...SANDBOX, spawnRate: 0.0625 }).description).toContain(
        "<span class='emphasis-color'>0.0625</span> people per second",
      );
      expect(requireSandbox({ ...SANDBOX, spawnRate: 9.9999 }).description).toContain(
        "<span class='emphasis-color'>9.9999</span> people per second",
      );
      expect(requireSandbox({ ...SANDBOX, spawnRate: 1.0004 }).description).toContain(
        "<span class='emphasis-color'>1.0004</span> people per second",
      );
    });

    it("reports a spawn rate the router clamped, not the one that was asked for", () => {
      // A hash that asked for spawnrate=100000 actually runs at 10; this bar
      // is where the player finds out.
      expect(requireSandbox({ ...SANDBOX, spawnRate: 10 }).description).toContain(
        "<span class='emphasis-color'>10</span> people per second",
      );
    });

    it("has nothing to meter", () => {
      expect(requireSandbox(SANDBOX).requirements).toEqual([]);
    });
  });
});

describe("createSandboxLevel", () => {
  it("asks the world for exactly the shape it was given", () => {
    expect(createSandboxLevel({ ...SANDBOX, elevatorCapacities: [6, 9] }).options).toEqual({
      floorCount: 20,
      elevatorCount: 2,
      elevatorCapacities: [6, 9],
      spawnRate: 1.5,
    });
  });

  it("describes the same building it asks the world for", () => {
    // The bar is the only place a sandbox player sees what they're running,
    // so its numbers must match the ones the world was built from.
    const level = createSandboxLevel({ ...SANDBOX, floorCount: 31, spawnRate: 2.25 });
    expect(level.options.floorCount).toBe(31);
    expect(level.options.spawnRate).toBe(2.25);
    expect(level.condition.description).toContain(
      "Sandbox: <span class='emphasis-color'>31</span> floors",
    );
    expect(level.condition.description).toContain(
      "<span class='emphasis-color'>2.25</span> people per second",
    );
    expect(level.condition.evaluate({ ...NOTHING_HAPPENED, transportedCounter: 1e9 })).toBe(null);
  });

  it("copies the capacities, so the world cannot write back into the route", () => {
    const capacities = [6, 9];
    const options = createSandboxLevel({ ...SANDBOX, elevatorCapacities: capacities }).options;
    options.elevatorCapacities?.push(99);
    expect(capacities).toEqual([6, 9]);
  });
});

describe("the language a description comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("declines every noun the sentence counts", () => {
    // Russian declines each noun by its exact numeral form, not just its
    // value: 2 and 2.0 take different endings, so the catalog is handed the
    // number together with how it's spelled.
    setLocale("ru");

    expect(requireUserCountWithinTimeWithMaxWaitTime(23, 30, 2).description).toBe(
      "Перевезите <span class='emphasis-color'>23</span> пассажира за " +
        "<span class='emphasis-color'>30</span> секунд или быстрее, и пусть доставка каждого " +
        "не длится дольше <span class='emphasis-color'>2,0</span> секунды",
    );
  });

  it("declines the nouns of the moves-and-wait sentence too", () => {
    // Covers all three declined nouns in one sentence: 100 and 450 take the
    // Russian "many" form, while the fractional wait limit takes "other" and
    // a different ending.
    setLocale("ru");

    expect(requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30).description).toBe(
      "Перевезите <span class='emphasis-color'>100</span> пассажиров, уложившись в " +
        "<span class='emphasis-color'>450</span> перемещений, и пусть доставка каждого " +
        "не длится дольше <span class='emphasis-color'>30,0</span> секунды",
    );
  });

  it("agrees the sandbox nouns that decline with the numbers in front of them", () => {
    // Five separately declined pieces in one sentence; «вместимостью»
    // (capacity) doesn't decline in Russian, so the English spec above is
    // what actually catches it being counted wrong.
    setLocale("ru");

    expect(requireSandbox(SANDBOX).description).toBe(
      "Песочница: <span class='emphasis-color'>20</span> этажей, " +
        "<span class='emphasis-color'>2</span> лифта вместимостью " +
        "<span class='emphasis-color'>4</span>, " +
        "<span class='emphasis-color'>1,5</span> пассажира в секунду. " +
        "Цели нет, поэтому симуляция никогда не закончится",
    );
  });

  it("separates the capacities with a word rather than a comma", () => {
    // Russian uses a comma as the decimal separator, so a comma-joined list
    // of capacities would read as more decimals a few words before an actual
    // one; the conjunction disambiguates them.
    setLocale("ru");

    expect(requireSandbox({ ...SANDBOX, elevatorCapacities: [6, 9] }).description).toContain(
      "вместимостью <span class='emphasis-color'>6</span> и " +
        "<span class='emphasis-color'>9</span>, " +
        "<span class='emphasis-color'>1,5</span> пассажира в секунду",
    );
  });

  it("counts the noun by the digits the rate is printed with", () => {
    // A rate of 1.0004 must stay «1,0004 пассажира»: rounding it to 1 would
    // also flip which noun form is grammatically correct.
    setLocale("ru");

    expect(requireSandbox({ ...SANDBOX, spawnRate: 1.0004 }).description).toContain(
      "<span class='emphasis-color'>1,0004</span> пассажира в секунду",
    );
    expect(requireSandbox({ ...SANDBOX, spawnRate: 1 }).description).toContain(
      "<span class='emphasis-color'>1</span> пассажир в секунду",
    );
  });
});
