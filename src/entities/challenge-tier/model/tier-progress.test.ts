import { describe, expect, it } from "vitest";

import { requirementProgress, requirementSetProgress } from "./tier-progress.ts";
import type { ChallengeWorldStats } from "#game/challenges.ts";
import type { TierRequirementInfo } from "#game/challenge-tiers.ts";

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

const UNDER_60_SECONDS: TierRequirementInfo = {
  field: "elapsedTime",
  comparison: "atMost",
  threshold: 60,
};

const AT_LEAST_HALF_LOADED: TierRequirementInfo = {
  field: "avgLoadFactorOnMove",
  comparison: "atLeast",
  threshold: 0.5,
};

describe("requirementProgress", () => {
  describe("an at-most requirement", () => {
    it("reads empty on a fresh run, nothing spent yet", () => {
      expect(requirementProgress(UNDER_60_SECONDS, { ...NOTHING_HAPPENED, elapsedTime: 0 })).toBe(
        0,
      );
    });

    it("fills in step with how much of the budget is spent", () => {
      expect(requirementProgress(UNDER_60_SECONDS, { ...NOTHING_HAPPENED, elapsedTime: 30 })).toBe(
        0.5,
      );
    });

    it("is full once the figure has reached the threshold", () => {
      expect(requirementProgress(UNDER_60_SECONDS, { ...NOTHING_HAPPENED, elapsedTime: 60 })).toBe(
        1,
      );
    });

    it("stays full rather than climbing past 1 once the threshold is blown", () => {
      expect(requirementProgress(UNDER_60_SECONDS, { ...NOTHING_HAPPENED, elapsedTime: 120 })).toBe(
        1,
      );
    });
  });

  describe("an at-least requirement", () => {
    it("reads empty on a fresh run, nothing earned yet", () => {
      expect(
        requirementProgress(AT_LEAST_HALF_LOADED, { ...NOTHING_HAPPENED, avgLoadFactorOnMove: 0 }),
      ).toBe(0);
    });

    it("grows toward the threshold", () => {
      expect(
        requirementProgress(AT_LEAST_HALF_LOADED, {
          ...NOTHING_HAPPENED,
          avgLoadFactorOnMove: 0.25,
        }),
      ).toBe(0.5);
    });

    it("is full once the figure has reached the threshold", () => {
      expect(
        requirementProgress(AT_LEAST_HALF_LOADED, {
          ...NOTHING_HAPPENED,
          avgLoadFactorOnMove: 0.5,
        }),
      ).toBe(1);
    });

    it("stays full rather than climbing past 1 once past the threshold", () => {
      expect(
        requirementProgress(AT_LEAST_HALF_LOADED, {
          ...NOTHING_HAPPENED,
          avgLoadFactorOnMove: 1,
        }),
      ).toBe(1);
    });
  });
});

describe("requirementSetProgress", () => {
  it("holds vacuously at 1 for an empty set, mirroring requireAll's own vacuous truth", () => {
    expect(requirementSetProgress([], NOTHING_HAPPENED)).toBe(1);
  });

  it("is the one requirement's own progress for a set of one", () => {
    expect(
      requirementSetProgress([UNDER_60_SECONDS], { ...NOTHING_HAPPENED, elapsedTime: 30 }),
    ).toBe(0.5);
  });

  it("takes the least-advanced requirement, not the average", () => {
    // elapsedTime's own fraction is 0.5 (half the time budget spent);
    // avgLoadFactorOnMove's is already 1 (its own threshold fully reached).
    // The set is only as far along as elapsedTime, not their average of 0.75.
    const world = { ...NOTHING_HAPPENED, elapsedTime: 30, avgLoadFactorOnMove: 0.5 };
    expect(requirementSetProgress([UNDER_60_SECONDS, AT_LEAST_HALF_LOADED], world)).toBe(0.5);
  });
});
