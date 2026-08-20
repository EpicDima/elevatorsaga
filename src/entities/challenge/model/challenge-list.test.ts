import { describe, expect, it } from "vitest";

import { listChallenges } from "./challenge-list.ts";
import { requireUserCountWithinTime, type Challenge } from "#game/challenges.ts";

/**
 * Builds a fixture challenge, minimal beyond what {@link listChallenges}
 * itself reads from — its own condition and options are never inspected by
 * the function under test.
 *
 * @returns The fixture.
 */
function fixtureChallenge(): Challenge {
  return { options: {}, condition: requireUserCountWithinTime(5, 60) };
}

describe("listChallenges", () => {
  it("numbers challenges from 1, following the array's own order", () => {
    const summaries = listChallenges([fixtureChallenge(), fixtureChallenge(), fixtureChallenge()]);

    expect(summaries.map((summary) => summary.number)).toEqual([1, 2, 3]);
    expect(summaries.map((summary) => summary.index)).toEqual([0, 1, 2]);
  });

  it("says of a challenge only where it sits and what it is called", () => {
    // Every entry is a numbered challenge now that the endless demo is gone,
    // so a summary has nothing left to carry beyond the two ways of naming
    // the same position.
    const summaries = listChallenges([fixtureChallenge()]);

    expect(summaries).toEqual([{ index: 0, number: 1 }]);
  });

  it("treats the last entry like every other one", () => {
    const summaries = listChallenges([fixtureChallenge(), fixtureChallenge(), fixtureChallenge()]);

    expect(summaries).toEqual([
      { index: 0, number: 1 },
      { index: 1, number: 2 },
      { index: 2, number: 3 },
    ]);
  });

  it("summarises nothing for an empty list", () => {
    expect(listChallenges([])).toEqual([]);
  });
});
