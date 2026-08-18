import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  challenges,
  createSandboxChallenge,
  requireDemo,
  requireSandbox,
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinMovesWithMaxWaitTime,
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type ChallengeWorldStats,
  type SandboxOptions,
} from "./challenges.ts";
import { at } from "./test-helpers.ts";

/** A world in which nothing at all has happened yet. */
const NOTHING_HAPPENED: ChallengeWorldStats = {
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
type MutableWorldStats = { -readonly [K in keyof ChallengeWorldStats]: ChallengeWorldStats[K] };

describe("Challenge requirements", () => {
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
      const challengeReq = requireUserCountWithinTime(10, 5.0);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.elapsedTime = 5.1;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.elapsedTime = 4.9;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
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
      const challengeReq = requireUserCountWithMaxWaitTime(10, 4.0);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.maxWaitTime = 4.5;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.maxWaitTime = 3.9;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
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
      const challengeReq = requireUserCountWithinMoves(10, 20);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.moveCount = 21;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.moveCount = 20;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
    });

    it("counts the move limit itself as a win", () => {
      const challengeReq = requireUserCountWithinMoves(10, 20);
      fakeWorld.moveCount = 20;
      fakeWorld.transportedCounter = 10;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
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
      const challengeReq = requireUserCountWithinTimeWithMaxWaitTime(10, 5.0, 4.0);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.elapsedTime = 5.1;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.elapsedTime = 4.9;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
      fakeWorld.maxWaitTime = 4.1;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
    });

    it("describes itself, grouping the digits of the numbers it is counting", () => {
      // `2,675` rather than `2675`, because the numbers go through
      // `Intl.NumberFormat` now and that is what it gives for English. The
      // grouping is the improvement, not a side effect: these are quantities a
      // player reads off the bar at a glance, and the same numbers come out as
      // `2 675` in Russian.
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
      const challengeReq = requireUserCountWithinMovesWithMaxWaitTime(10, 20, 4.0);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.moveCount = 21;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.transportedCounter = 11;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
      fakeWorld.moveCount = 19;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
      fakeWorld.maxWaitTime = 4.1;
      expect(challengeReq.evaluate(fakeWorld)).toBe(false);
    });

    it("decides as soon as either limit is reached, not when the crowd is delivered", () => {
      // A run that has already spent its moves, or already left someone
      // undelivered too long, is lost with passengers still to come: the
      // condition has to say so then, because the alternative is a bar that
      // reads "in progress" over a run whose outcome is settled.
      const challengeReq = requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30);
      expect(challengeReq.evaluate({ ...fakeWorld, moveCount: 450 })).toBe(false);
      expect(challengeReq.evaluate({ ...fakeWorld, maxWaitTime: 30 })).toBe(false);
      expect(challengeReq.evaluate({ ...fakeWorld, moveCount: 449, maxWaitTime: 29.9 })).toBe(null);
    });

    it("counts both limits themselves as a win", () => {
      const challengeReq = requireUserCountWithinMovesWithMaxWaitTime(10, 20, 4.0);
      fakeWorld.moveCount = 20;
      fakeWorld.maxWaitTime = 4.0;
      fakeWorld.transportedCounter = 10;
      expect(challengeReq.evaluate(fakeWorld)).toBe(true);
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

  describe("requireDemo", () => {
    it("never resolves", () => {
      const challengeReq = requireDemo();
      expect(challengeReq.description).toBe("Perpetual demo");
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      fakeWorld.elapsedTime = 1e9;
      fakeWorld.transportedCounter = 1e9;
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
    });

    it("has nothing to meter", () => {
      expect(requireDemo().requirements).toEqual([]);
    });
  });

  describe("requireSandbox", () => {
    it("never resolves, whatever the run does", () => {
      const challengeReq = requireSandbox(SANDBOX);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
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
        expect(challengeReq.evaluate(fakeWorld), JSON.stringify(stats)).toBe(null);
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
      // The router accepts any finite rate in [0.01, 10] and does not round it,
      // so all three of these are live URLs. `Intl.NumberFormat` shows three
      // decimals unless told otherwise, which would print 0.063 and 10 -- and
      // 10 is what a rate clamped down from 100000 prints, so two runs nothing
      // alike would be described by one line.
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
      // The whole point of putting the numbers in the bar: a hash that said
      // spawnrate=100000 runs at 10, and this is where the player finds out.
      expect(requireSandbox({ ...SANDBOX, spawnRate: 10 }).description).toContain(
        "<span class='emphasis-color'>10</span> people per second",
      );
    });

    it("has nothing to meter", () => {
      expect(requireSandbox(SANDBOX).requirements).toEqual([]);
    });
  });
});

describe("createSandboxChallenge", () => {
  it("asks the world for exactly the shape it was given", () => {
    expect(createSandboxChallenge({ ...SANDBOX, elevatorCapacities: [6, 9] }).options).toEqual({
      floorCount: 20,
      elevatorCount: 2,
      elevatorCapacities: [6, 9],
      spawnRate: 1.5,
    });
  });

  it("describes the same building it asks the world for", () => {
    // The bar is the only place a sandbox player can see what they are running,
    // so the numbers in it have to be the numbers the world was built from.
    const challenge = createSandboxChallenge({ ...SANDBOX, floorCount: 31, spawnRate: 2.25 });
    expect(challenge.options.floorCount).toBe(31);
    expect(challenge.options.spawnRate).toBe(2.25);
    expect(challenge.condition.description).toContain(
      "Sandbox: <span class='emphasis-color'>31</span> floors",
    );
    expect(challenge.condition.description).toContain(
      "<span class='emphasis-color'>2.25</span> people per second",
    );
    expect(challenge.condition.evaluate({ ...NOTHING_HAPPENED, transportedCounter: 1e9 })).toBe(
      null,
    );
  });

  it("copies the capacities, so the world cannot write back into the route", () => {
    const capacities = [6, 9];
    const options = createSandboxChallenge({ ...SANDBOX, elevatorCapacities: capacities }).options;
    options.elevatorCapacities?.push(99);
    expect(capacities).toEqual([6, 9]);
  });
});

describe("challenges", () => {
  it("keeps the full legacy list, in order", () => {
    expect(challenges).toHaveLength(20);
  });

  it("ends the playable list with the moves-and-wait challenge", () => {
    // Second to last, because the demo is not a challenge and stays where it
    // has always been: the end. The numbers are the ones the reference program
    // was measured against -- a challenge whose limits drifted from the run
    // that sized them is a challenge nobody can be sure is winnable.
    const challenge = challenges.at(-2);
    expect(challenge?.options).toEqual({ floorCount: 8, elevatorCount: 6, spawnRate: 0.9 });
    expect(challenge?.condition.description).toBe(
      "Transport <span class='emphasis-color'>100</span> people using " +
        "<span class='emphasis-color'>450</span> elevator moves or less and let no one take " +
        "more than <span class='emphasis-color'>30.0</span> seconds to be delivered",
    );
  });

  it("gives every challenge a described condition and world options", () => {
    for (const challenge of challenges) {
      expect(challenge.condition.description.length).toBeGreaterThan(0);
      expect(typeof challenge.options.floorCount).toBe("number");
      expect(typeof challenge.options.elevatorCount).toBe("number");
      expect(typeof challenge.options.spawnRate).toBe("number");
    }
  });

  it("ends with the perpetual demo", () => {
    expect(challenges.at(-1)?.condition.description).toBe("Perpetual demo");
  });
});

describe("the language a description comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("declines every noun the sentence counts", () => {
    // Three numbers, three different endings, none of which an English
    // template could have produced by gluing a word onto a number: 23
    // пассажира, 30 секунд, 2,0 секунды. The delivery limit is the interesting one
    // -- it is the same 2 as an integer would be, but written with a tenth it
    // takes a different form of the noun, which is why the catalogue is handed
    // the number together with the way it is spelled.
    setLocale("ru");

    expect(requireUserCountWithinTimeWithMaxWaitTime(23, 30, 2).description).toBe(
      "Перевезите <span class='emphasis-color'>23</span> пассажира за " +
        "<span class='emphasis-color'>30</span> секунд или быстрее, и пусть доставка каждого " +
        "не длится дольше <span class='emphasis-color'>2,0</span> секунды",
    );
  });

  it("declines the nouns of the moves-and-wait sentence too", () => {
    // The one sentence that counts all three of them. 100 and 450 are both
    // `many` in Russian and take «пассажиров» and «перемещений»; the delivery
    // limit is written with a tenth, which is `other`, so it takes «секунды»
    // rather than the «секунд» a bare 30 would have taken.
    setLocale("ru");

    expect(requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30).description).toBe(
      "Перевезите <span class='emphasis-color'>100</span> пассажиров, уложившись в " +
        "<span class='emphasis-color'>450</span> перемещений, и пусть доставка каждого " +
        "не длится дольше <span class='emphasis-color'>30,0</span> секунды",
    );
  });

  it("agrees the sandbox nouns that decline with the numbers in front of them", () => {
    // The sentence the router's numbers land in, assembled out of five
    // separately counted pieces: 20 этажей, 2 лифта, and a rate written 1,5
    // here and 1.5 in English. The fifth, «вместимостью», is the same word in
    // all four Russian forms, so nothing on this line can catch it being
    // counted wrongly -- the English spec above, where the label is "of
    // capacity" or "of capacities", is what does that.
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
    // Russian writes decimals with a comma, so «вместимостью 6, 9» is also how
    // six point nine is written -- in a sentence that goes on to say «1,5
    // пассажира в секунду», which is the same punctuation meaning the other
    // thing two words later. The conjunction is not decoration here; it is what
    // makes the number of elevators in the building readable.
    setLocale("ru");

    expect(requireSandbox({ ...SANDBOX, elevatorCapacities: [6, 9] }).description).toContain(
      "вместимостью <span class='emphasis-color'>6</span> и " +
        "<span class='emphasis-color'>9</span>, " +
        "<span class='emphasis-color'>1,5</span> пассажира в секунду",
    );
  });

  it("counts the noun by the digits the rate is printed with", () => {
    // A rate of 1.0004 is «1,0004 пассажира», not «1 пассажир». Rounding it to
    // three decimals would print «1» and, worse, would then be right to say
    // «пассажир» -- the sentence would be grammatical and about another run.
    setLocale("ru");

    expect(requireSandbox({ ...SANDBOX, spawnRate: 1.0004 }).description).toContain(
      "<span class='emphasis-color'>1,0004</span> пассажира в секунду",
    );
    expect(requireSandbox({ ...SANDBOX, spawnRate: 1 }).description).toContain(
      "<span class='emphasis-color'>1</span> пассажир в секунду",
    );
  });

  it("is settled when the description is read, not when the module was loaded", () => {
    // `challenges` is a module-level constant, built as the page loads and
    // before anybody has chosen a language. A description computed there would
    // be whatever was active at import time for the rest of the session, so
    // every one of them is a getter -- and this is the spec that says so.
    const challenge = at(challenges, 0);
    expect(challenge.condition.description).toContain("Transport");

    setLocale("ru");

    expect(challenge.condition.description).toContain("Перевезите");
  });
});
