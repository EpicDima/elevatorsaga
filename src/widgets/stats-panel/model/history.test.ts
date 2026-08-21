import { describe, expect, it } from "vitest";

import { createStatsHistory, SPARK_FLOOR, SPARK_POINTS, sparklinePoints } from "./history.ts";
import type { StatsHistoryKey } from "./history.ts";

const ALL_ZERO: Readonly<Record<StatsHistoryKey, number>> = {
  avgWaitTime: 0,
  maxWaitTime: 0,
  avgLoadFactorOnMove: 0,
  transportedPerSec: 0,
  transportedCounter: 0,
  avgPickupTime: 0,
  avgRideTime: 0,
  avgPeoplePerStop: 0,
  waitingNow: 0,
  aboardNow: 0,
};

describe("SPARK_FLOOR", () => {
  it("states every floor in its own key's units, avgLoadFactorOnMove as a 0..1 fraction", () => {
    expect(SPARK_FLOOR).toEqual({
      avgWaitTime: 10,
      maxWaitTime: 10,
      avgLoadFactorOnMove: 0.4,
      transportedPerSec: 0.2,
      transportedCounter: 10,
      avgPickupTime: 10,
      avgRideTime: 10,
      avgPeoplePerStop: 1,
      waitingNow: 6,
      aboardNow: 4,
    });
  });
});

describe("createStatsHistory", () => {
  it("starts every key empty", () => {
    const history = createStatsHistory();
    for (const key of Object.keys(SPARK_FLOOR) as StatsHistoryKey[]) {
      expect(history.samples(key)).toEqual([]);
    }
  });

  it("records the first push regardless of `now`", () => {
    const history = createStatsHistory();
    expect(history.push(0, { ...ALL_ZERO, avgWaitTime: 5 })).toBe(true);
    expect(history.samples("avgWaitTime")).toEqual([5]);
  });

  it("throttles a second push within 200ms of the last accepted one", () => {
    const history = createStatsHistory();
    history.push(1000, { ...ALL_ZERO, avgWaitTime: 1 });
    expect(history.push(1199, { ...ALL_ZERO, avgWaitTime: 2 })).toBe(false);
    expect(history.samples("avgWaitTime")).toEqual([1]);
  });

  it("accepts a push exactly 200ms after the last accepted one", () => {
    const history = createStatsHistory();
    history.push(1000, { ...ALL_ZERO, avgWaitTime: 1 });
    expect(history.push(1200, { ...ALL_ZERO, avgWaitTime: 2 })).toBe(true);
    expect(history.samples("avgWaitTime")).toEqual([1, 2]);
  });

  it("keeps every key's series independent", () => {
    const history = createStatsHistory();
    history.push(0, { ...ALL_ZERO, avgWaitTime: 5, aboardNow: 3 });
    expect(history.samples("avgWaitTime")).toEqual([5]);
    expect(history.samples("aboardNow")).toEqual([3]);
    expect(history.samples("maxWaitTime")).toEqual([0]);
  });

  it("caps a series at SPARK_POINTS, dropping the oldest sample first", () => {
    const history = createStatsHistory();
    for (let i = 0; i < SPARK_POINTS + 10; i++) {
      history.push(i * 1000, { ...ALL_ZERO, avgWaitTime: i });
    }
    const samples = history.samples("avgWaitTime");
    expect(samples).toHaveLength(SPARK_POINTS);
    expect(samples[0]).toBe(10);
    expect(samples[samples.length - 1]).toBe(SPARK_POINTS + 9);
  });

  it("reset clears every series and forgets the last push time, so the next push always records", () => {
    const history = createStatsHistory();
    history.push(1000, { ...ALL_ZERO, avgWaitTime: 5 });
    history.reset();
    expect(history.samples("avgWaitTime")).toEqual([]);
    expect(history.push(1001, { ...ALL_ZERO, avgWaitTime: 9 })).toBe(true);
    expect(history.samples("avgWaitTime")).toEqual([9]);
  });
});

describe("sparklinePoints", () => {
  it("is empty for an empty series", () => {
    expect(sparklinePoints([], 10)).toBe("");
  });

  it("places a single point at x=0 without dividing by zero", () => {
    expect(sparklinePoints([5], 10)).toBe("0.0,8.5");
  });

  it("scales against the floor when every sample is under it", () => {
    // top = floor = 10, so a value of 5 sits at y = 15 - (5/10)*13 = 8.5
    expect(sparklinePoints([0, 5, 10], 10)).toBe("0.0,15.0 50.0,8.5 100.0,2.0");
  });

  it("scales against the series' own peak once it exceeds the floor", () => {
    // top = 20 (the peak), not the floor of 10
    expect(sparklinePoints([0, 20], 10)).toBe("0.0,15.0 100.0,2.0");
  });

  it("spreads x evenly across the series regardless of series length", () => {
    const points = sparklinePoints([1, 1, 1, 1, 1], 10);
    const xs = points.split(" ").map((pair) => Number(pair.split(",")[0]));
    expect(xs).toEqual([0, 25, 50, 75, 100]);
  });
});
