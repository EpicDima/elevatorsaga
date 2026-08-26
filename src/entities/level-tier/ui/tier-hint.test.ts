import { describe, expect, it } from "vitest";

import { nextTierHint } from "./tier-hint.ts";
import type { LevelWorldStats } from "#game/levels.ts";
import type { LevelTierRequirements, TierPredicate } from "#game/level-tiers.ts";
import {
  WINNING_IS_GOLD,
  atLeastAvgLoadFactorOnMove,
  requireAll,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
} from "#game/level-tiers.ts";

/** A finished run: quick enough, but slow to deliver and running its cars half empty. */
const FINISHED: LevelWorldStats = {
  elapsedTime: 51,
  transportedCounter: 42,
  maxWaitTime: 23.44,
  moveCount: 61,
  transportedPerSec: 0.587,
  avgLoadFactorOnMove: 0.313,
  avgWaitTime: 12.68,
  maxPickupTime: 9.21,
  avgPickupTime: 4.06,
  avgRideTime: 8.62,
  stopCount: 37,
  avgPeoplePerStop: 1.135,
};

/** Silver asks one thing of {@link FINISHED} that it missed; gold asks two. */
const TIERS: LevelTierRequirements = {
  silver: underMaxWaitTime(21),
  gold: requireAll(underMaxWaitTime(21), atLeastAvgLoadFactorOnMove(0.5)),
};

describe("nextTierHint", () => {
  it("says nothing for a level that grades nothing, where every win is already gold", () => {
    expect(nextTierHint(WINNING_IS_GOLD, "gold", FINISHED)).toBe("");
  });

  it("says nothing to a run that already has every star", () => {
    expect(nextTierHint(TIERS, "gold", FINISHED)).toBe("");
  });

  it("names the silver bar and where a bronze run actually finished", () => {
    expect(nextTierHint(TIERS, "bronze", FINISHED)).toBe(
      "For silver: deliver everyone within " +
        "<span class='emphasis-color'>21.0</span> seconds (now 23.4s)",
    );
  });

  it("names the gold bar once silver is held", () => {
    expect(nextTierHint(TIERS, "silver", FINISHED)).toBe(
      "For gold: deliver everyone within " +
        "<span class='emphasis-color'>21.0</span> seconds (now 23.4s) and " +
        "elevators run 50% full or more (now 31%)",
    );
  });

  it("leaves out the requirements the run did clear", () => {
    const tiers: LevelTierRequirements = {
      silver: requireAll(underElapsedTime(60), underMoveCount(80), underMaxWaitTime(21)),
      gold: underMaxWaitTime(5),
    };
    expect(nextTierHint(tiers, "bronze", FINISHED)).toBe(
      "For silver: deliver everyone within " +
        "<span class='emphasis-color'>21.0</span> seconds (now 23.4s)",
    );
  });

  it("says nothing when a tier was missed on something it does not advertise", () => {
    // A predicate may test more than the requirements it publishes; listing
    // nothing here would wrongly promise that clearing nothing earns the star.
    const opaque: TierPredicate = Object.assign(() => false, {
      requirements: underElapsedTime(60).requirements,
    });
    expect(nextTierHint({ silver: opaque, gold: opaque }, "bronze", FINISHED)).toBe("");
  });
});
