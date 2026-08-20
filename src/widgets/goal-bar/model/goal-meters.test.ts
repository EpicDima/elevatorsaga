import { describe, expect, it } from "vitest";

import { buildGoalMeters } from "./goal-meters.ts";
import type { LevelWorldStats } from "#entities/level/index.ts";
import type { TierRequirementInfo } from "#entities/level-tier/index.ts";

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

const DELIVER_10: TierRequirementInfo = {
  field: "transportedCounter",
  comparison: "atLeast",
  threshold: 10,
};

const UNDER_60_SECONDS: TierRequirementInfo = {
  field: "elapsedTime",
  comparison: "atMost",
  threshold: 60,
};

describe("buildGoalMeters", () => {
  it("is empty for a level with nothing to meter", () => {
    expect(buildGoalMeters([], NOTHING_HAPPENED)).toEqual([]);
  });

  it("keeps the requirements' own order", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 4, elapsedTime: 30 };
    const views = buildGoalMeters([DELIVER_10, UNDER_60_SECONDS], world);
    expect(views.map((view) => view.requirement)).toEqual([DELIVER_10, UNDER_60_SECONDS]);
  });

  it("reads the live figure, the fill fraction and the pass/fail state for an at-least requirement", () => {
    const world = { ...NOTHING_HAPPENED, transportedCounter: 4 };
    const [view] = buildGoalMeters([DELIVER_10], world);
    expect(view).toEqual({ requirement: DELIVER_10, current: 4, progress: 0.4, met: false });
  });

  it("reads the same three figures for an at-most requirement, met once it clears the bar", () => {
    const world = { ...NOTHING_HAPPENED, elapsedTime: 60 };
    const [view] = buildGoalMeters([UNDER_60_SECONDS], world);
    expect(view).toEqual({ requirement: UNDER_60_SECONDS, current: 60, progress: 1, met: true });
  });

  it("still fills to 1 and stays unmet past an at-most requirement's own bar", () => {
    const world = { ...NOTHING_HAPPENED, elapsedTime: 90 };
    const [view] = buildGoalMeters([UNDER_60_SECONDS], world);
    expect(view).toEqual({ requirement: UNDER_60_SECONDS, current: 90, progress: 1, met: false });
  });
});
