import { describe, expect, it } from "vitest";

import { buildTierRows } from "./tier-rows.ts";
import type { Level, LevelWorldStats } from "#entities/level/index.ts";
import {
  WINNING_IS_GOLD,
  atLeastAvgLoadFactorOnMove,
  requireAll,
  underElapsedTime,
} from "#game/level-tiers.ts";
import { requireUserCountWithinTime } from "#game/levels.ts";

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

const LEVEL: Level = {
  options: {},
  condition: requireUserCountWithinTime(10, 60),
  tiers: {
    silver: underElapsedTime(50),
    gold: requireAll(underElapsedTime(40), atLeastAvgLoadFactorOnMove(0.5)),
  },
};

const GOLD_ON_WIN_LEVEL: Level = {
  options: {},
  condition: requireUserCountWithinTime(5, 30),
  tiers: WINNING_IS_GOLD,
};

const NOTHING_TO_METER_LEVEL: Level = {
  options: {},
  condition: {
    description: "",
    evaluate: () => null,
    requirements: [],
  },
  tiers: WINNING_IS_GOLD,
};

describe("buildTierRows", () => {
  it("is empty for a level with nothing to meter, regardless of verdict", () => {
    expect(buildTierRows(NOTHING_TO_METER_LEVEL, NOTHING_HAPPENED, null)).toEqual([]);
    expect(buildTierRows(NOTHING_TO_METER_LEVEL, NOTHING_HAPPENED, true)).toEqual([]);
  });

  it("builds one gold row, carrying the level's own bar, for a level that grades nothing", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 5, elapsedTime: 20 };
    const rows = buildTierRows(GOLD_ON_WIN_LEVEL, world, true);
    expect(rows.map((row) => row.tier)).toEqual(["gold"]);
    expect(rows[0]?.state).toBe("held");
    expect(rows[0]?.requirements.map((need) => need.requirement)).toEqual(
      GOLD_ON_WIN_LEVEL.condition.requirements,
    );
  });

  it("marks that lone gold row lost once such a level has ended without winning", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 2, elapsedTime: 30 };
    const rows = buildTierRows(GOLD_ON_WIN_LEVEL, world, false);
    expect(rows.map((row) => [row.tier, row.state])).toEqual([["gold", "lost"]]);
  });

  it("reads every row as pending while the run is still undecided, and never flags an unmet at-least requirement as a miss", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 4, elapsedTime: 30 };
    const rows = buildTierRows(LEVEL, world, null);
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
    const rows = buildTierRows(LEVEL, world, null);
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
    const rows = buildTierRows(LEVEL, world, true);
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
    const rows = buildTierRows(LEVEL, world, false);
    expect(rows.map((row) => row.state)).toEqual(["lost", "lost", "lost"]);
  });
});
