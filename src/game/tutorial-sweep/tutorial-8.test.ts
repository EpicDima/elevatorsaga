/** Learning track level tutorial-8 over the four hundred seeds of `./test-helpers.ts`. */

import { describe, expect, it } from "vitest";

import { chapter1Levels } from "../chapter1.ts";
import { describeSweep, levelById, sweep, SWEEP_TIMEOUT_MS } from "./test-helpers.ts";

/** A three-floor sweep: the dumbest program that could be called a solution. Not in the level table since no player is ever shown it. */
const BLIND_SWEEP = `{
    init: function(elevators, floors) {
        var elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
            elevator.goToFloor(1);
            elevator.goToFloor(2);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`;

describe("Learning track level tutorial-8 over four hundred seeds", () => {
  const level = levelById("tutorial-8");

  it(
    "loses one seed with its own answer, and it is level 1 that loses it",
    () => {
      // Not a defect: level 8 reuses level 1's building and bar by design, so
      // this missing seed is arithmetic, not a bug. The next test confirms it
      // by replaying the same answer as level 1 itself.
      const result = sweep(level.options, level.condition, level.solutionCode);
      expect(result.wins, describeSweep("tutorial-8 answer", result)).toBe(399);
      expect(result.losingSeeds).toEqual(["t165"]);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "loses exactly that seed when the same program is played as level 1",
    () => {
      // Confirms the claim above: replays the same answer against level 1's
      // own building and bar. A future "fix" to level 8 would just be moving
      // it away from the level it rehearses.
      const levelOne = chapter1Levels[0];
      if (levelOne === undefined) {
        throw new Error("the game has no levels");
      }
      const result = sweep(levelOne.options, levelOne.condition, level.solutionCode);
      expect(result.wins, describeSweep("level 1 with level 8's answer", result)).toBe(399);
      expect(result.losingSeeds).toEqual(["t165"]);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "is not passed once by the empty program the player is given",
    () => {
      // An empty `init` moves nothing, so no seed can rescue it.
      const result = sweep(level.options, level.condition, level.startingCode);
      expect(result.wins, describeSweep("tutorial-8 starting code", result)).toBe(0);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "is passed on every seed by a program that only sweeps the three floors",
    () => {
      // A dumb, tireless sweep clears every seed here, including the one the
      // real answer misses: the bar rewards thoroughness over responsiveness
      // in this particular building.
      const result = sweep(level.options, level.condition, BLIND_SWEEP);
      expect(result.wins, describeSweep("a blind three-floor sweep", result)).toBe(400);
    },
    SWEEP_TIMEOUT_MS,
  );
});
