import { beforeEach, describe, expect, it } from "vitest";

import {
  challenges,
  requireDemo,
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type ChallengeWorldStats,
} from "./challenges.ts";

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
