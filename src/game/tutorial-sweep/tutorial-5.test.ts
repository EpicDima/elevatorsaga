/** Learning track level tutorial-5 over the four hundred seeds of `./test-helpers.ts`. */

import { describe, expect, it } from "vitest";

import { describeSweep, levelById, sweep, SWEEP_TIMEOUT_MS } from "./test-helpers.ts";

describe("Learning track level tutorial-5 over four hundred seeds", () => {
  const level = levelById("tutorial-5");

  it(
    "never rejects its own answer",
    () => {
      // The answer must never lose here: a rejected correct program is a
      // failure a learner has no way to debug.
      const result = sweep(level.options, level.condition, level.solutionCode);
      expect(result.wins, describeSweep("tutorial-5 answer", result)).toBe(400);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "is passed by the nine-floor sweep on the seeds that suit it, and no others",
    () => {
      // No wait limit rejects every sweep run while accepting every answer
      // run, so this count is recorded rather than driven to zero.
      const result = sweep(level.options, level.condition, level.startingCode);
      expect(result.wins, describeSweep("tutorial-5 starting code", result)).toBe(76);
    },
    SWEEP_TIMEOUT_MS,
  );
});
