import { describe, expect, it } from "vitest";

import { listLevels } from "./level-list.ts";
import { requireUserCountWithinTime, type Level } from "#game/levels.ts";

/** Builds a fixture level; its condition and options are never inspected by {@link listLevels}. */
function fixtureLevel(): Level {
  return { options: {}, condition: requireUserCountWithinTime(5, 60) };
}

describe("listLevels", () => {
  it("numbers levels from 1, following the array's own order", () => {
    const summaries = listLevels([fixtureLevel(), fixtureLevel(), fixtureLevel()]);

    expect(summaries.map((summary) => summary.number)).toEqual([1, 2, 3]);
    expect(summaries.map((summary) => summary.index)).toEqual([0, 1, 2]);
  });

  it("says of a level only where it sits and what it is called", () => {
    const summaries = listLevels([fixtureLevel()]);

    expect(summaries).toEqual([{ index: 0, number: 1 }]);
  });

  it("treats the last entry like every other one", () => {
    const summaries = listLevels([fixtureLevel(), fixtureLevel(), fixtureLevel()]);

    expect(summaries).toEqual([
      { index: 0, number: 1 },
      { index: 1, number: 2 },
      { index: 2, number: 3 },
    ]);
  });

  it("summarizes nothing for an empty list", () => {
    expect(listLevels([])).toEqual([]);
  });
});
