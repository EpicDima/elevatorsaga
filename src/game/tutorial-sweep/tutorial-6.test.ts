/** Learning track level tutorial-6 over the four hundred seeds of `./test-helpers.ts`. */

import { describe, expect, it } from "vitest";

import { describeSweep, levelById, sweep, SWEEP_TIMEOUT_MS } from "./test-helpers.ts";

describe("Learning track level tutorial-6 over four hundred seeds", () => {
  const level = levelById("tutorial-6");

  it(
    "never rejects its own answer",
    () => {
      // The ten fixed seeds in the fast suite can't see a rare rejection like
      // this; that's what these sweeps are for.
      const result = sweep(level.options, level.condition, level.solutionCode);
      expect(result.wins, describeSweep("tutorial-6 answer", result)).toBe(400);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    "is passed by the lying indicators three times in four hundred",
    () => {
      const result = sweep(level.options, level.condition, level.startingCode);
      expect(result.wins, describeSweep("tutorial-6 starting code", result)).toBe(3);
    },
    SWEEP_TIMEOUT_MS,
  );
});
