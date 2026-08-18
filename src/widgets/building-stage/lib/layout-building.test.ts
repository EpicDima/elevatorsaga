import { describe, expect, it } from "vitest";

import { layoutBuilding, MIN_FLOOR, MIN_SHAFT } from "./layout-building.ts";

/** A single floor's worth of weight, repeated — the game's own default today. */
function uniformWeights(count: number): number[] {
  return Array.from({ length: count }, () => 1);
}

describe("layoutBuilding", () => {
  it("clamps the per-weight unit up to MIN_FLOOR when the stage can't fit every floor otherwise", () => {
    // room = max(160, 1000-38) = 962; 962/25 = 38.48, below MIN_FLOOR.
    const layout = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(25),
      capacities: [4],
    });
    expect(layout.floorHeights).toEqual(uniformWeights(25).map(() => MIN_FLOOR));
    expect(layout.shortestFloor).toBe(MIN_FLOOR);
    expect(layout.totalHeight).toBe(25 * MIN_FLOOR);
    expect(layout.carHeight).toBe(40);
    expect(layout.density).toBe("compact");
  });

  it("floors the stage's usable room at 160px even when the stage is shorter still", () => {
    // stageHeight-38 = 12, which would give unit = 6 if room weren't floored —
    // floored to 160 instead gives unit = 80, distinct from both bounds.
    const layout = layoutBuilding({
      stageHeight: 50,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(2),
      capacities: [4],
    });
    expect(layout.floorHeights).toEqual([80, 80]);
    expect(layout.totalHeight).toBe(160);
  });

  it("clamps the per-weight unit down to 96 when the stage has room to spare", () => {
    // room = max(160, 2038-38) = 2000; 2000/2 = 1000, above the 96 ceiling.
    const layout = layoutBuilding({
      stageHeight: 2038,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(2),
      capacities: [4],
    });
    expect(layout.floorHeights).toEqual([96, 96]);
    expect(layout.shortestFloor).toBe(96);
    expect(layout.carHeight).toBe(88);
    expect(layout.density).toBe("full");
  });

  it("distributes uneven weights by cumulative rounding, not per-floor rounding", () => {
    // room = max(160, 260-38) = 222; unit = 222/4 = 55.5 (weights sum to 4).
    // Cumulative: 55.5→56, 166.5→167, 222→222, giving heights [56, 111, 55]
    // that sum to exactly 222. Rounding each floor's own 55.5/111/55.5
    // independently would give 56+111+56 = 223, one pixel of drift the
    // cumulative approach exists specifically to avoid.
    const layout = layoutBuilding({
      stageHeight: 260,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: [1, 2, 1],
      capacities: [4],
    });
    expect(layout.floorHeights).toEqual([56, 111, 55]);
    expect(layout.floorBottoms).toEqual([0, 56, 167]);
    expect(layout.totalHeight).toBe(222);
  });

  it("is 'full' density at exactly the 58px threshold", () => {
    // room = 232, weightSum = 4, unit = 58 exactly.
    const layout = layoutBuilding({
      stageHeight: 270,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [4],
    });
    expect(layout.shortestFloor).toBe(58);
    expect(layout.density).toBe("full");
  });

  it("is 'compact' density one pixel below the 58px threshold", () => {
    // room = 228, weightSum = 4, unit = 57 exactly.
    const layout = layoutBuilding({
      stageHeight: 266,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [4],
    });
    expect(layout.shortestFloor).toBe(57);
    expect(layout.density).toBe("compact");
  });

  it("clamps every shaft down to MIN_SHAFT together when six wide cars won't fit", () => {
    // wanted = clamp(34, 24+80, 116)+7 = 111 for each of six capacity-10 cars;
    // asked = 111*6 + 7*5 = 701. A narrow stage clamps free to its 120px
    // floor, so free/asked (~0.17) is pulled up to floorScale (46/111), the
    // scale that puts the narrowest wanted shaft exactly at MIN_SHAFT.
    const layout = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 300,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [10, 10, 10, 10, 10, 10],
    });
    expect(layout.shaftWidths).toEqual([46, 46, 46, 46, 46, 46]);
    expect(layout.shaftWidths.every((width) => width >= MIN_SHAFT)).toBe(true);
    expect(layout.shaftGap).toBe(5);
  });

  it("scales shafts by a ratio strictly between MIN_SHAFT's floor and 1 when compression is moderate", () => {
    // Four capacity-4 cars each want 63px; asked = 63*4 + 12*3 = 288.
    // stageWidth 553 gives free = 553-32-84-170-22 = 245, so scale =
    // 245/288 ≈ 0.8507 — above floorScale (46/63 ≈ 0.730) and below 1, so
    // the free/asked ratio itself is what binds, not either clamp bound.
    const layout = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 553,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [4, 4, 4, 4],
    });
    expect(layout.shaftWidths).toEqual([54, 54, 54, 54]);
    expect(layout.shaftGap).toBe(5);
    expect(layout.shaftsWidth).toBe(231);
    expect(layout.buildingWidth).toBe(507);
  });

  it("gives five elevators a 12px gap and six elevators a 7px gap, all else equal", () => {
    // Capacity-1 cars want 41px each — already under MIN_SHAFT/0.55 scaling
    // room, so floorScale exceeds 1 and every scale clamps to exactly 1
    // regardless of stage width. That isolates the >5-elevator gap rule from
    // any width-driven compression.
    const five = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 2000,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [1, 1, 1, 1, 1],
    });
    const six = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 2000,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [1, 1, 1, 1, 1, 1],
    });
    expect(five.shaftWidths).toEqual([41, 41, 41, 41, 41]);
    expect(five.shaftGap).toBe(12);
    expect(five.shaftsWidth).toBe(253);
    expect(six.shaftWidths).toEqual([41, 41, 41, 41, 41, 41]);
    expect(six.shaftGap).toBe(7);
    expect(six.shaftsWidth).toBe(281);
  });

  it("falls back to a levelsWidth of 84 when the floor-number column hasn't been measured yet", () => {
    const unmeasured = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 1000,
      levelsWidth: 0,
      floorWeights: uniformWeights(4),
      capacities: [4, 4],
    });
    const explicit = layoutBuilding({
      stageHeight: 1000,
      stageWidth: 1000,
      levelsWidth: 84,
      floorWeights: uniformWeights(4),
      capacities: [4, 4],
    });
    expect(unmeasured).toEqual(explicit);
  });

  it("marks a cabin 'counted' only once its capacity no longer fits as rider figures", () => {
    // A tall stage keeps carHeight well above 38, so the rider-width clamp
    // saturates at its own 16px ceiling (riderWidth = round(16*0.55)+1 = 10)
    // in both cases — isolating the capacity/width boundary itself. At
    // capacity 6 the shaft (79px, scale 1) leaves exactly 60px inside, equal
    // to 6*10: not counted, since the comparison is strict. Capacity 7's
    // shaft (87px) leaves 68px against 7*10 = 70: counted.
    const notCounted = layoutBuilding({
      stageHeight: 2000,
      stageWidth: 2000,
      levelsWidth: 84,
      floorWeights: [1],
      capacities: [6],
    });
    const counted = layoutBuilding({
      stageHeight: 2000,
      stageWidth: 2000,
      levelsWidth: 84,
      floorWeights: [1],
      capacities: [7],
    });
    expect(notCounted.carHeight).toBeGreaterThanOrEqual(38);
    expect(notCounted.shaftWidths).toEqual([79]);
    expect(notCounted.counted).toEqual([false]);
    expect(counted.shaftWidths).toEqual([87]);
    expect(counted.counted).toEqual([true]);
  });

  it("lays out the sandbox world from design/ui-mockup.html end to end", () => {
    // design/ui-mockup.html's own FREE_WORLDS sandbox spec: 20 floors, three
    // cars of capacity [3, 3, 5], all floors weighted equally.
    const layout = layoutBuilding({
      stageHeight: 800,
      stageWidth: 900,
      levelsWidth: 0, // unmeasured — also exercises the 84px fallback
      floorWeights: uniformWeights(20),
      capacities: [3, 3, 5],
    });
    // unit = clamp(48, (max(160,762))/20 = 38.1, 96) = 48 (MIN_FLOOR binds).
    expect(layout.floorHeights).toEqual(uniformWeights(20).map(() => 48));
    expect(layout.totalHeight).toBe(960);
    expect(layout.shortestFloor).toBe(48);
    expect(layout.carHeight).toBe(40);
    expect(layout.density).toBe("compact");
    // wanted = [55, 55, 71]; free = 900-32-84-170-22 = 592 comfortably clears
    // asked (205), so scale clamps to 1 and every shaft keeps its wanted size.
    expect(layout.shaftWidths).toEqual([55, 55, 71]);
    expect(layout.shaftGap).toBe(12);
    expect(layout.shaftsWidth).toBe(205);
    expect(layout.buildingWidth).toBe(481);
    expect(layout.queueRoom).toBe(152);
    expect(layout.counted).toEqual([false, false, false]);
  });
});
