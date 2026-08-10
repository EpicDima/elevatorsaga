import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateFitness,
  doFitnessSuite,
  fitnessChallenges,
  makeAverageResult,
  requireNothing,
  type FitnessChallenge,
  type FitnessChallengeOptions,
  type FitnessRun,
} from "./fitness.ts";
import { at } from "./test-helpers.ts";
import type { UserCodeObject } from "./world-controller.ts";

const options: FitnessChallengeOptions = {
  description: "Tiny scenario",
  floorCount: 3,
  elevatorCount: 1,
  spawnRate: 0.6,
};

const challenge: FitnessChallenge = { options, condition: requireNothing() };

/**
 * Player code that does nothing at all.
 *
 * @returns A valid but inert code object.
 */
function inertCodeObj(): UserCodeObject {
  return {
    init(): void {
      // Nothing.
    },
    update(): void {
      // Nothing.
    },
  };
}

// The world and the suite both log; keep the test output readable.
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireNothing", () => {
  it("never resolves", () => {
    const condition = requireNothing();
    expect(condition.description).toBe("No requirement");
    expect(
      condition.evaluate({
        elapsedTime: 1e9,
        transportedCounter: 1e9,
        maxWaitTime: 1e9,
        moveCount: 1e9,
      }),
    ).toBe(null);
  });
});

describe("fitnessChallenges", () => {
  it("keeps the three legacy scenarios", () => {
    expect(fitnessChallenges.map((c) => c.options.description)).toEqual([
      "Small scenario",
      "Medium scenario",
      "Large scenario",
    ]);
  });
});

describe("calculateFitness", () => {
  it("reports metrics for code that never throws", () => {
    const result = calculateFitness(challenge, inertCodeObj(), 1000.0 / 60.0, 200);

    expect(result.error).toBeUndefined();
    expect(typeof result.transportedPerSec).toBe("number");
    expect(typeof result.avgWaitTime).toBe("number");
    expect(typeof result.transportedCount).toBe("number");
  });

  it("transports nobody when the code never moves an elevator", () => {
    const result = calculateFitness(challenge, inertCodeObj(), 1000.0 / 60.0, 200);
    expect(result.transportedCount).toBe(0);
  });

  it("delivers passengers when the code actually drives the elevators", () => {
    const codeObj: UserCodeObject = {
      init(elevators): void {
        const elevator = at(elevators, 0);
        elevator.on("idle", () => {
          elevator.goToFloor(0);
          elevator.goToFloor(1);
          elevator.goToFloor(2);
        });
      },
      update(): void {
        // Nothing.
      },
    };

    const result = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 3000);

    expect(result.error).toBeUndefined();
    expect(result.transportedCount).toBeGreaterThan(0);
  });

  it("records the error when the code throws", () => {
    const boom = new Error("boom");
    const codeObj: UserCodeObject = {
      init(): void {
        throw boom;
      },
      update(): void {
        // Nothing.
      },
    };

    const result = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 200);

    expect(result.error).toBe(boom);
    expect(result.transportedCount).toBe(0);
  });

  it("stops simulating as soon as the code throws", () => {
    const boom = new Error("boom");
    let updateCalls = 0;
    const codeObj: UserCodeObject = {
      init(): void {
        // Nothing.
      },
      update(): void {
        updateCalls++;
        if (updateCalls === 3) {
          throw boom;
        }
      },
    };

    const result = calculateFitness(challenge, codeObj, 1000.0 / 60.0, 500);

    expect(result.error).toBe(boom);
    expect(updateCalls).toBe(3);
  });
});

describe("makeAverageResult", () => {
  it("averages every property of the first run across all runs", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 1, avgWaitTime: 10, transportedCount: 4 } },
      { options, result: { transportedPerSec: 3, avgWaitTime: 20, transportedCount: 6 } },
    ];

    expect(makeAverageResult(runs)).toEqual({
      options,
      result: { transportedPerSec: 2, avgWaitTime: 15, transportedCount: 5 },
    });
  });

  it("keeps the options of the first run", () => {
    const other: FitnessChallengeOptions = { ...options, description: "Other" };
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 1 } },
      { options: other, result: { transportedPerSec: 2 } },
    ];

    expect(makeAverageResult(runs).options).toBe(options);
  });

  it("takes the property list from the first run only", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 2 } },
      { options, result: { transportedPerSec: 4, avgWaitTime: 99 } },
    ];

    expect(makeAverageResult(runs).result).toEqual({ transportedPerSec: 3 });
  });

  it("yields NaN for a property a later run is missing", () => {
    const runs: FitnessRun[] = [
      { options, result: { transportedPerSec: 2, avgWaitTime: 5 } },
      { options, result: { transportedPerSec: 4 } },
    ];

    expect(makeAverageResult(runs).result["avgWaitTime"]).toBeNaN();
  });

  it("averages a single run to itself", () => {
    const runs: FitnessRun[] = [{ options, result: { transportedPerSec: 7 } }];
    expect(makeAverageResult(runs).result).toEqual({ transportedPerSec: 7 });
  });

  it("rejects an empty run list", () => {
    expect(() => makeAverageResult([])).toThrow(RangeError);
  });
});

describe("doFitnessSuite", () => {
  it("reports code that does not compile as an error", () => {
    const result = doFitnessSuite("{update: function() {}}", 1);
    expect(result).toEqual({ error: "Error: Code must contain an init function" });
  });

  it("reports a syntax error as an error", () => {
    const result = doFitnessSuite("{init: function(} }", 1);
    expect("error" in result).toBe(true);
  });
});
