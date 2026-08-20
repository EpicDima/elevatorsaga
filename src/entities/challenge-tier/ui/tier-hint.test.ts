import { describe, expect, it } from "vitest";

import { nextTierHint } from "./tier-hint.ts";
import type { ChallengeWorldStats } from "#game/challenges.ts";
import type { ChallengeTierRequirements, TierPredicate } from "#game/challenge-tiers.ts";
import {
  atLeastAvgLoadFactorOnMove,
  requireAll,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
} from "#game/challenge-tiers.ts";

/** A finished run: quick enough, but slow to deliver and running its cars half empty. */
const FINISHED: ChallengeWorldStats = {
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
const TIERS: ChallengeTierRequirements = {
  silver: underMaxWaitTime(21),
  gold: requireAll(underMaxWaitTime(21), atLeastAvgLoadFactorOnMove(0.5)),
};

describe("nextTierHint", () => {
  it("says nothing for a challenge with no silver or gold to reach", () => {
    expect(nextTierHint(undefined, "bronze", FINISHED)).toBe("");
  });

  it("says nothing to a run that already has every star", () => {
    // A hint here would be a second helping of congratulation, which is not
    // what the line is for.
    expect(nextTierHint(TIERS, "gold", FINISHED)).toBe("");
  });

  it("names the silver bar and where a bronze run actually finished", () => {
    // Both figures, per the mockup: "«серебро» без «на сколько мимо» — это
    // упрёк, а не подсказка."
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
    // A tier missed on one count of three is not three things to fix, and
    // saying so would bury the one that matters.
    const tiers: ChallengeTierRequirements = {
      silver: requireAll(underElapsedTime(60), underMoveCount(80), underMaxWaitTime(21)),
      gold: underMaxWaitTime(5),
    };
    expect(nextTierHint(tiers, "bronze", FINISHED)).toBe(
      "For silver: deliver everyone within " +
        "<span class='emphasis-color'>21.0</span> seconds (now 23.4s)",
    );
  });

  it("says nothing when a tier was missed on something it does not advertise", () => {
    // A predicate may test more than the requirements it publishes, and a hint
    // listing nothing at all would promise that clearing nothing earns the
    // star. Silence is the honest answer.
    const opaque: TierPredicate = Object.assign(() => false, {
      requirements: underElapsedTime(60).requirements,
    });
    expect(nextTierHint({ silver: opaque, gold: opaque }, "bronze", FINISHED)).toBe("");
  });
});
