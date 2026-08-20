import { describe, expect, it } from "vitest";

import { tierRequirementNow, tierRequirementText } from "./requirement-text.ts";
import type { ChallengeWorldStats } from "#game/challenges.ts";
import type { TierRequirementInfo } from "#game/challenge-tiers.ts";

/** A finished run, with a different figure in every field so none can stand in for another. */
const FINISHED: ChallengeWorldStats = {
  elapsedTime: 71.5,
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

/**
 * A requirement over one field, with the bar and direction the field's own
 * sentence is written for.
 *
 * @param field - The figure the requirement reads.
 * @param threshold - The bar it sets.
 * @returns The requirement.
 */
function asking(field: keyof ChallengeWorldStats, threshold: number): TierRequirementInfo {
  return { field, comparison: "atMost", threshold };
}

describe("tierRequirementText", () => {
  it("names the bar, with the figure in the span the game paints numbers with", () => {
    expect(tierRequirementText(asking("avgWaitTime", 21))).toBe(
      "average delivery no later than <span class='emphasis-color'>21.0</span> seconds",
    );
  });

  it("counts what it names, so a bar of one does not read as a plural", () => {
    expect(tierRequirementText(asking("transportedCounter", 1))).toBe(
      "transport <span class='emphasis-color'>1</span> person",
    );
    expect(tierRequirementText(asking("transportedCounter", 15))).toBe(
      "transport <span class='emphasis-color'>15</span> people",
    );
  });

  it("writes a fraction as the percentage a player reads it as", () => {
    expect(tierRequirementText(asking("avgLoadFactorOnMove", 0.5))).toBe(
      "elevators run 50% full or more",
    );
  });

  it("has a sentence for every figure a challenge can meter", () => {
    // The table is keyed by `keyof ChallengeWorldStats`, so a field added to
    // the statistics without an entry here is a compile error rather than
    // something this could catch. What it does catch is an entry that throws
    // or comes back empty -- a `t()` key renamed out from under one of them,
    // for instance, which type-checks perfectly.
    for (const field of Object.keys(FINISHED) as (keyof ChallengeWorldStats)[]) {
      expect(tierRequirementText(asking(field, 1)), field).not.toBe("");
    }
  });
});

describe("tierRequirementNow", () => {
  it("reads the run's own figure for the field the requirement names", () => {
    expect(tierRequirementNow(asking("avgWaitTime", 21), FINISHED)).toBe("12.7s");
    expect(tierRequirementNow(asking("moveCount", 60), FINISHED)).toBe("61");
  });

  it("rounds each field the way its own bar is written", () => {
    // The point of the pair being two functions over one requirement: the
    // figure and the bar it is read against have to agree on their decimals,
    // or a run misses "no later than 21.0 seconds" by "now 21s".
    expect(tierRequirementNow(asking("elapsedTime", 60), FINISHED)).toBe("72s");
    expect(tierRequirementNow(asking("avgLoadFactorOnMove", 0.5), FINISHED)).toBe("31%");
    expect(tierRequirementNow(asking("transportedPerSec", 0.6), FINISHED)).toBe("0.59");
  });

  it("has a figure for every field a challenge can meter", () => {
    for (const field of Object.keys(FINISHED) as (keyof ChallengeWorldStats)[]) {
      expect(tierRequirementNow(asking(field, 1), FINISHED), field).not.toBe("");
    }
  });
});
