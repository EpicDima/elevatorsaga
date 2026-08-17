import { describe, expect, it, vi } from "vitest";

import type { ChallengeWorldStats } from "./challenges.ts";
import {
  atLeastAvgLoadFactorOnMove,
  atLeastTransportedPerSec,
  evaluateChallengeTier,
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
  underStopCount,
  type ChallengeTierRequirements,
  type TierPredicate,
} from "./challenge-tiers.ts";

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

describe("underElapsedTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underElapsedTime(60);
    expect(predicate({ ...NOTHING_HAPPENED, elapsedTime: 60 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, elapsedTime: 60.0001 })).toBe(false);
  });
});

describe("underMaxWaitTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underMaxWaitTime(20);
    expect(predicate({ ...NOTHING_HAPPENED, maxWaitTime: 20 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, maxWaitTime: 20.0001 })).toBe(false);
  });
});

describe("underMoveCount", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underMoveCount(450);
    expect(predicate({ ...NOTHING_HAPPENED, moveCount: 450 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, moveCount: 451 })).toBe(false);
  });
});

describe("underAvgWaitTime", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underAvgWaitTime(15);
    expect(predicate({ ...NOTHING_HAPPENED, avgWaitTime: 15 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, avgWaitTime: 15.0001 })).toBe(false);
  });
});

describe("underStopCount", () => {
  it("passes at the limit and fails just past it", () => {
    const predicate = underStopCount(200);
    expect(predicate({ ...NOTHING_HAPPENED, stopCount: 200 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, stopCount: 201 })).toBe(false);
  });
});

describe("atLeastAvgLoadFactorOnMove", () => {
  it("passes at the minimum and fails just under it", () => {
    const predicate = atLeastAvgLoadFactorOnMove(0.5);
    expect(predicate({ ...NOTHING_HAPPENED, avgLoadFactorOnMove: 0.5 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, avgLoadFactorOnMove: 0.4999 })).toBe(false);
  });
});

describe("atLeastTransportedPerSec", () => {
  it("passes at the minimum and fails just under it", () => {
    const predicate = atLeastTransportedPerSec(1.5);
    expect(predicate({ ...NOTHING_HAPPENED, transportedPerSec: 1.5 })).toBe(true);
    expect(predicate({ ...NOTHING_HAPPENED, transportedPerSec: 1.4999 })).toBe(false);
  });
});

describe("requireAll", () => {
  it("holds only when every predicate holds", () => {
    const alwaysTrue: TierPredicate = () => true;
    const alwaysFalse: TierPredicate = () => false;
    expect(requireAll(alwaysTrue, alwaysTrue)(NOTHING_HAPPENED)).toBe(true);
    expect(requireAll(alwaysTrue, alwaysFalse)(NOTHING_HAPPENED)).toBe(false);
    expect(requireAll(alwaysFalse, alwaysTrue)(NOTHING_HAPPENED)).toBe(false);
  });

  it("holds vacuously for no predicates at all", () => {
    expect(requireAll()(NOTHING_HAPPENED)).toBe(true);
  });

  it("short-circuits, the same way Array.prototype.every does", () => {
    // A later predicate that would fail the run on its own must never be
    // asked, once an earlier one has already said no -- proving this combinator
    // is exactly `.every` under the hood rather than something that scores
    // every predicate and only decides at the end.
    const failsFirst = vi.fn(() => false);
    const wouldThrow = vi.fn(() => {
      throw new Error("must not be called once an earlier predicate has already failed");
    });
    expect(requireAll(failsFirst, wouldThrow)(NOTHING_HAPPENED)).toBe(false);
    expect(failsFirst).toHaveBeenCalledOnce();
    expect(wouldThrow).not.toHaveBeenCalled();
  });
});

describe("evaluateChallengeTier", () => {
  it("is null on a loss, whatever the statistics and requirements say", () => {
    const tiers: ChallengeTierRequirements = {
      silver: () => true,
      gold: () => true,
    };
    expect(evaluateChallengeTier(false, NOTHING_HAPPENED, tiers)).toBe(null);
    expect(evaluateChallengeTier(false, { ...NOTHING_HAPPENED, elapsedTime: 1e9 }, undefined)).toBe(
      null,
    );
  });

  it("is bronze on a win when the challenge has no tier requirements", () => {
    expect(evaluateChallengeTier(true, NOTHING_HAPPENED, undefined)).toBe("bronze");
  });

  it("is bronze on a win that clears neither requirement", () => {
    const tiers: ChallengeTierRequirements = {
      silver: () => false,
      gold: () => false,
    };
    expect(evaluateChallengeTier(true, NOTHING_HAPPENED, tiers)).toBe("bronze");
  });

  it("is silver on a win that clears silver but not gold", () => {
    const tiers: ChallengeTierRequirements = {
      silver: () => true,
      gold: () => false,
    };
    expect(evaluateChallengeTier(true, NOTHING_HAPPENED, tiers)).toBe("silver");
  });

  it("is gold on a win that clears gold, checked ahead of silver", () => {
    const tiers: ChallengeTierRequirements = {
      // A `tiers` value from outside this module is not required to nest --
      // gold does not imply silver here on purpose, so that gold winning
      // regardless of silver's answer is a property of the evaluator, not an
      // accident of a well-behaved fixture.
      silver: () => false,
      gold: () => true,
    };
    expect(evaluateChallengeTier(true, NOTHING_HAPPENED, tiers)).toBe("gold");
  });

  it("uses real predicate factories at their boundary, not stub closures", () => {
    const tiers: ChallengeTierRequirements = {
      silver: underMaxWaitTime(20),
      gold: requireAll(underMaxWaitTime(20), underMoveCount(450)),
    };
    // Clears neither: waited too long for silver at all.
    expect(
      evaluateChallengeTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 25, moveCount: 100 }, tiers),
    ).toBe("bronze");
    // Clears silver's wait bar, but gold also wants the move budget, which
    // this run overspent.
    expect(
      evaluateChallengeTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 20, moveCount: 500 }, tiers),
    ).toBe("silver");
    // Clears both of gold's requirements at once.
    expect(
      evaluateChallengeTier(true, { ...NOTHING_HAPPENED, maxWaitTime: 20, moveCount: 450 }, tiers),
    ).toBe("gold");
  });
});
