import { describe, expect, it, vi } from "vitest";

import type { LevelWorldStats } from "./levels.ts";
import {
  WINNING_IS_GOLD,
  atLeastAvgLoadFactorOnMove,
  atLeastTransportedPerSec,
  evaluateLevelTier,
  hasTierLadder,
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
  underStopCount,
  type LevelTierRequirements,
  type TierPredicate,
} from "./level-tiers.ts";

/** Builds a bare `TierPredicate` stub that reads no field, for tests exercising `requireAll`/`evaluateLevelTier`'s own logic. */
function stubPredicate(result: boolean): TierPredicate {
  return Object.assign(() => result, { requirements: [] });
}

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

describe("underElapsedTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underElapsedTime(60);
    expect(predicate({ ...NOTHING_HAPPENED, elapsedTime: 60 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, elapsedTime: 60.0001 })).toBe(false);
  });

  it("describes itself as an at-most requirement on elapsedTime", () => {
    expect(underElapsedTime(60).requirements).toEqual([
      { field: "elapsedTime", comparison: "atMost", threshold: 60 },
    ]);
  });
});

describe("underMaxWaitTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underMaxWaitTime(20);
    expect(predicate({ ...NOTHING_HAPPENED, maxWaitTime: 20 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, maxWaitTime: 20.0001 })).toBe(false);
  });

  it("describes itself as an at-most requirement on maxWaitTime", () => {
    expect(underMaxWaitTime(20).requirements).toEqual([
      { field: "maxWaitTime", comparison: "atMost", threshold: 20 },
    ]);
  });
});

describe("underMoveCount", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underMoveCount(450);
    expect(predicate({ ...NOTHING_HAPPENED, moveCount: 450 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, moveCount: 451 })).toBe(false);
  });

  it("describes itself as an at-most requirement on moveCount", () => {
    expect(underMoveCount(450).requirements).toEqual([
      { field: "moveCount", comparison: "atMost", threshold: 450 },
    ]);
  });
});

describe("underAvgWaitTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underAvgWaitTime(15);
    expect(predicate({ ...NOTHING_HAPPENED, avgWaitTime: 15 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, avgWaitTime: 15.0001 })).toBe(false);
  });

  it("describes itself as an at-most requirement on avgWaitTime", () => {
    expect(underAvgWaitTime(15).requirements).toEqual([
      { field: "avgWaitTime", comparison: "atMost", threshold: 15 },
    ]);
  });
});

describe("underStopCount", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underStopCount(200);
    expect(predicate({ ...NOTHING_HAPPENED, stopCount: 200 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, stopCount: 201 })).toBe(false);
  });

  it("describes itself as an at-most requirement on stopCount", () => {
    expect(underStopCount(200).requirements).toEqual([
      { field: "stopCount", comparison: "atMost", threshold: 200 },
    ]);
  });
});

describe("atLeastAvgLoadFactorOnMove", () => {
  it("passes at the minimum and fails just under it", () => {
    const predicate = atLeastAvgLoadFactorOnMove(0.5);
    expect(predicate({ ...NOTHING_HAPPENED, avgLoadFactorOnMove: 0.5 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, avgLoadFactorOnMove: 0.4999 })).toBe(false);
  });

  it("describes itself as an at-least requirement on avgLoadFactorOnMove", () => {
    expect(atLeastAvgLoadFactorOnMove(0.5).requirements).toEqual([
      { field: "avgLoadFactorOnMove", comparison: "atLeast", threshold: 0.5 },
    ]);
  });
});

describe("atLeastTransportedPerSec", () => {
  it("passes at the minimum and fails just under it", () => {
    const predicate = atLeastTransportedPerSec(1.5);
    expect(predicate({ ...NOTHING_HAPPENED, transportedPerSec: 1.5 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, transportedPerSec: 1.4999 })).toBe(false);
  });

  it("describes itself as an at-least requirement on transportedPerSec", () => {
    expect(atLeastTransportedPerSec(1.5).requirements).toEqual([
      { field: "transportedPerSec", comparison: "atLeast", threshold: 1.5 },
    ]);
  });
});

describe("requireAll", () => {
  it("holds only when every predicate holds", () => {
    const alwaysTrue = stubPredicate(true);
    const alwaysFalse = stubPredicate(false);
    expect(requireAll(alwaysTrue, alwaysTrue)(NOTHING_HAPPENED)).toBe(true);
    expect(requireAll(alwaysTrue, alwaysFalse)(NOTHING_HAPPENED)).toBe(false);
    expect(requireAll(alwaysFalse, alwaysTrue)(NOTHING_HAPPENED)).toBe(false);
  });

  it("holds vacuously for no predicates at all", () => {
    expect(requireAll()(NOTHING_HAPPENED)).toBe(true);
  });

  it("concatenates its predicates' requirements in order", () => {
    expect(requireAll(underMaxWaitTime(20), underMoveCount(450)).requirements).toEqual([
      { field: "maxWaitTime", comparison: "atMost", threshold: 20 },
      { field: "moveCount", comparison: "atMost", threshold: 450 },
    ]);
  });

  it("short-circuits, the same way Array.prototype.every does", () => {
    // A predicate after the first failure must never be called.
    const failsFirst = Object.assign(
      vi.fn(() => false),
      { requirements: [] },
    );
    const wouldThrow = Object.assign(
      vi.fn(() => {
        throw new Error("must not be called once an earlier predicate has already failed");
      }),
      { requirements: [] },
    );
    expect(requireAll(failsFirst, wouldThrow)(NOTHING_HAPPENED)).toBe(false);
    expect(failsFirst).toHaveBeenCalledOnce();
    expect(wouldThrow).not.toHaveBeenCalled();
  });
});

describe("WINNING_IS_GOLD", () => {
  it("holds both its bars for any run at all, and advertises no requirement to draw", () => {
    const overshot = { ...NOTHING_HAPPENED, elapsedTime: 1e9, maxWaitTime: 1e9 };
    expect(WINNING_IS_GOLD.silver(overshot)).toBe(true);
    expect(WINNING_IS_GOLD.gold(overshot)).toBe(true);
    expect(WINNING_IS_GOLD.silver.requirements).toEqual([]);
    expect(WINNING_IS_GOLD.gold.requirements).toEqual([]);
  });
});

describe("hasTierLadder", () => {
  it("is false for the vacuous set, where clearing the level is the whole achievement", () => {
    expect(hasTierLadder(WINNING_IS_GOLD)).toBe(false);
  });

  it("is true as soon as either bar names a figure of its own", () => {
    expect(hasTierLadder({ silver: underMaxWaitTime(20), gold: requireAll() })).toBe(true);
    expect(hasTierLadder({ silver: requireAll(), gold: underMoveCount(450) })).toBe(true);
  });
});

describe("evaluateLevelTier", () => {
  it("is null on a loss, whatever the statistics and requirements say", () => {
    const tiers: LevelTierRequirements = {
      silver: stubPredicate(true),
      gold: stubPredicate(true),
    };
    expect(evaluateLevelTier(false, NOTHING_HAPPENED, tiers)).toBe(null);
    expect(
      evaluateLevelTier(false, { ...NOTHING_HAPPENED, elapsedTime: 1e9 }, WINNING_IS_GOLD),
    ).toBe(null);
  });

  it("is gold on a win when the level grades nothing beyond its own bar", () => {
    expect(evaluateLevelTier(true, NOTHING_HAPPENED, WINNING_IS_GOLD)).toBe("gold");
  });

  it("is bronze on a win that clears neither requirement", () => {
    const tiers: LevelTierRequirements = {
      silver: stubPredicate(false),
      gold: stubPredicate(false),
    };
    expect(evaluateLevelTier(true, NOTHING_HAPPENED, tiers)).toBe("bronze");
  });

  it("is silver on a win that clears silver but not gold", () => {
    const tiers: LevelTierRequirements = {
      silver: stubPredicate(true),
      gold: stubPredicate(false),
    };
    expect(evaluateLevelTier(true, NOTHING_HAPPENED, tiers)).toBe("silver");
  });

  it("is gold on a win that clears gold, checked ahead of silver", () => {
    const tiers: LevelTierRequirements = {
      // Gold does not imply silver here on purpose.
      silver: stubPredicate(false),
      gold: stubPredicate(true),
    };
    expect(evaluateLevelTier(true, NOTHING_HAPPENED, tiers)).toBe("gold");
  });

  it("uses real predicate factories at their boundary, not stub closures", () => {
    const tiers: LevelTierRequirements = {
      silver: underMaxWaitTime(20),
      gold: requireAll(underMaxWaitTime(20), underMoveCount(450)),
    };
    // Clears neither: waited too long for silver at all.
    expect(
      evaluateLevelTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 25, moveCount: 100 }, tiers),
    ).toBe("bronze");
    // Clears silver's wait bar, but gold also wants the move budget, which
    // this run overspent.
    expect(
      evaluateLevelTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 20, moveCount: 500 }, tiers),
    ).toBe("silver");
    // Clears both of gold's requirements at once.
    expect(
      evaluateLevelTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 20, moveCount: 450 }, tiers),
    ).toBe("gold");
  });
});
