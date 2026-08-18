import { describe, expect, it } from "vitest";

import { buildTierRows } from "./tier-rows.ts";
import type { Challenge, ChallengeWorldStats } from "#entities/challenge/index.ts";
import { atLeastAvgLoadFactorOnMove, requireAll, underElapsedTime } from "#game/challenge-tiers.ts";
import { requireUserCountWithinTime } from "#game/challenges.ts";

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

const CHALLENGE: Challenge = {
  options: {},
  condition: requireUserCountWithinTime(10, 60),
  tiers: {
    silver: underElapsedTime(50),
    gold: requireAll(underElapsedTime(40), atLeastAvgLoadFactorOnMove(0.5)),
  },
};

const BRONZE_ONLY_CHALLENGE: Challenge = {
  options: {},
  condition: requireUserCountWithinTime(5, 30),
};

const NOTHING_TO_METER_CHALLENGE: Challenge = {
  options: {},
  condition: {
    description: "",
    evaluate: () => null,
    requirements: [],
  },
};

describe("buildTierRows", () => {
  it("is empty for a challenge with nothing to meter, regardless of verdict", () => {
    expect(buildTierRows(NOTHING_TO_METER_CHALLENGE, NOTHING_HAPPENED, null)).toEqual([]);
    expect(buildTierRows(NOTHING_TO_METER_CHALLENGE, NOTHING_HAPPENED, true)).toEqual([]);
  });

  it("builds only a bronze row for a challenge with no silver/gold requirements", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 5, elapsedTime: 20 };
    const rows = buildTierRows(BRONZE_ONLY_CHALLENGE, world, true);
    expect(rows.map((row) => row.tier)).toEqual(["bronze"]);
    expect(rows[0]?.state).toBe("held");
  });

  it("reads every row as pending while the run is still undecided, and never flags an unmet at-least requirement as a miss", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 4, elapsedTime: 30 };
    const rows = buildTierRows(CHALLENGE, world, null);
    expect(rows.map((row) => row.state)).toEqual(["pending", "pending", "pending"]);

    const [bronze] = rows;
    const [delivered, underTime] = bronze?.requirements ?? [];
    expect(delivered).toEqual({
      requirement: { field: "transportedCounter", comparison: "atLeast", threshold: 10 },
      current: 4,
      progress: 0.4,
      miss: false,
    });
    expect(underTime).toEqual({
      requirement: { field: "elapsedTime", comparison: "atMost", threshold: 60 },
      current: 30,
      progress: 0.5,
      miss: false,
    });
  });

  it("flags a live run's already-blown at-most requirement as a miss before the run ends", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 4, elapsedTime: 45 };
    const rows = buildTierRows(CHALLENGE, world, null);
    const [, silver, gold] = rows;
    // 45 is over gold's own 40-second bar but not silver's 50-second one.
    expect(silver?.requirements[0]?.miss).toBe(false);
    expect(gold?.requirements[0]?.miss).toBe(true);
  });

  it("holds bronze and silver but not gold once a run has ended between the two", () => {
    const world = {
      ...NOTHING_HAPPENED,
      transportedCounter: 12,
      elapsedTime: 45,
      avgLoadFactorOnMove: 0.3,
    };
    const rows = buildTierRows(CHALLENGE, world, true);
    expect(rows.map((row) => [row.tier, row.state])).toEqual([
      ["bronze", "held"],
      ["silver", "held"],
      ["gold", "lost"],
    ]);

    const [, , gold] = rows;
    expect(gold?.requirements).toEqual([
      {
        requirement: { field: "elapsedTime", comparison: "atMost", threshold: 40 },
        current: 45,
        progress: 1,
        miss: true,
      },
      {
        requirement: { field: "avgLoadFactorOnMove", comparison: "atLeast", threshold: 0.5 },
        current: 0.3,
        progress: 0.6,
        miss: true,
      },
    ]);
  });

  it("marks every row lost, bronze included, once a run has ended without winning", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 3, elapsedTime: 70 };
    const rows = buildTierRows(CHALLENGE, world, false);
    expect(rows.map((row) => row.state)).toEqual(["lost", "lost", "lost"]);
  });
});
