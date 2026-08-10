import { beforeEach, describe, expect, it } from "vitest";

import {
  challenges,
  createSandboxChallenge,
  requireDemo,
  requireSandbox,
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type ChallengeWorldStats,
  type SandboxOptions,
} from "./challenges.ts";

/** A world in which nothing at all has happened yet. */
const NOTHING_HAPPENED: ChallengeWorldStats = {
  elapsedTime: 0,
  transportedCounter: 0,
  maxWaitTime: 0,
  moveCount: 0,
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
    fakeWorld = { elapsedTime: 0.0, transportedCounter: 0, maxWaitTime: 0.0, moveCount: 0 };
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

    it("describes itself with one decimal of wait time", () => {
      expect(requireUserCountWithMaxWaitTime(50, 21).description).toBe(
        "Transport <span class='emphasis-color'>50</span> people and let no one wait more than " +
          "<span class='emphasis-color'>21.0</span> seconds",
      );
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

    it("describes itself", () => {
      expect(requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45).description).toBe(
        "Transport <span class='emphasis-color'>2675</span> people in " +
          "<span class='emphasis-color'>1800</span> seconds or less and let no one wait more than " +
          "<span class='emphasis-color'>45.0</span> seconds",
      );
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
  });

  describe("requireSandbox", () => {
    it("never resolves, whatever the run does", () => {
      const challengeReq = requireSandbox(SANDBOX);
      expect(challengeReq.evaluate(fakeWorld)).toBe(null);
      for (const stats of [
        { elapsedTime: 1e9, transportedCounter: 0, maxWaitTime: 0, moveCount: 0 },
        { elapsedTime: 0, transportedCounter: 1e9, maxWaitTime: 0, moveCount: 0 },
        { elapsedTime: 1e9, transportedCounter: 1e9, maxWaitTime: 1e9, moveCount: 1e9 },
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
        "of capacities <span class='emphasis-color'>6</span>, " +
          "<span class='emphasis-color'>9</span>",
      );
    });

    it("counts a single elevator in the singular", () => {
      expect(requireSandbox({ ...SANDBOX, elevatorCount: 1 }).description).toContain(
        "<span class='emphasis-color'>1</span> elevator of",
      );
    });

    it("reports a spawn rate the router clamped, not the one that was asked for", () => {
      // The whole point of putting the numbers in the bar: a hash that said
      // spawnrate=100000 runs at 10, and this is where the player finds out.
      expect(requireSandbox({ ...SANDBOX, spawnRate: 10 }).description).toContain(
        "<span class='emphasis-color'>10</span> people per second",
      );
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
    expect(challenges).toHaveLength(19);
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
