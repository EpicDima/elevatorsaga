/**
 * Checks three learning-track levels against 400 seeds, since ten aren't
 * enough to see how often a max-based bar accepts or rejects a program.
 * Counts are asserted exactly, not as bounds — a bound would hide either a
 * regression or an improvement in the underlying simulation.
 */

import { describe, expect, it } from "vitest";

import { levels, type LevelCondition } from "./levels.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { tutorialLevels, type TutorialLevel } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld, type WorldOptions } from "./world.ts";

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/** Simulated seconds after which an undecided run is treated as broken, so a stuck test fails loudly. */
const MAX_SIMULATED_SECONDS = 240.0;

/** Seeds per named set. */
const SET_SIZE = 200;

/**
 * The four hundred seeds every count below is over, in order.
 * Generated, not listed, so re-measuring reproduces the exact same seeds; two prefixes rather than one range, so the counts below are provably over two independent sets.
 */
const SWEEP_SEEDS: readonly RandomSeed[] = ["t", "u"].flatMap((prefix) =>
  Array.from({ length: SET_SIZE }, (_unused, index) => `${prefix}${String(index)}`),
);

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

/** How a program fared over {@link SWEEP_SEEDS}. */
interface SweepResult {
  /** Seeds on which the condition was satisfied. */
  readonly wins: number;
  /** The seeds it was not, spelled as they are written. */
  readonly losingSeeds: readonly string[];
}

/**
 * Plays one program in one building on one seed, and reports the verdict.
 * @param options - The building.
 * @param condition - The bar.
 * @param code - The player program.
 * @param seed - The passengers.
 * @returns `true` when the run was won.
 * @throws When the program throws, or the run never resolves.
 */
function playRun(
  options: WorldOptions,
  condition: LevelCondition,
  code: string,
  seed: RandomSeed,
): boolean {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property, not two `let` bindings: both are written inside callbacks the
  // compiler's flow analysis doesn't follow, so a plain local would still be
  // narrowed to `null` here.
  const run: { verdict: boolean | null; userCodeError: unknown } = {
    verdict: null,
    userCodeError: null,
  };

  worldController.on("usercode_error", (e) => {
    run.userCodeError ??= e;
  });

  world.on("stats_changed", () => {
    if (run.verdict !== null) {
      return;
    }
    const status = condition.evaluate(world);
    if (status === null) {
      return;
    }
    run.verdict = status;
    world.levelEnded = true;
    worldController.setPaused(true);
  });

  worldController.start(world, codeObj, frameRequester.register, true);
  while (
    run.verdict === null &&
    run.userCodeError === null &&
    world.elapsedTime < MAX_SIMULATED_SECONDS
  ) {
    frameRequester.trigger();
  }

  if (run.userCodeError !== null) {
    throw new Error(`the program threw at seed ${String(seed)}`, { cause: run.userCodeError });
  }
  if (run.verdict === null) {
    throw new Error(
      `the run was still undecided after ${String(MAX_SIMULATED_SECONDS)} simulated seconds ` +
        `at seed ${String(seed)}`,
    );
  }
  return run.verdict;
}

/**
 * Plays a program over every seed of the sweep.
 *
 * @param options - The building.
 * @param condition - The bar.
 * @param code - The player program.
 * @returns How it fared.
 */
function sweep(options: WorldOptions, condition: LevelCondition, code: string): SweepResult {
  const losingSeeds: string[] = [];
  let wins = 0;
  for (const seed of SWEEP_SEEDS) {
    if (playRun(options, condition, code, seed)) {
      wins++;
    } else {
      losingSeeds.push(String(seed));
    }
  }
  return { wins, losingSeeds };
}

/**
 * The level with this identifier.
 * @throws When the track has no such level.
 */
function levelById(id: string): TutorialLevel {
  const level = tutorialLevels.find((candidate) => candidate.id === id);
  if (level === undefined) {
    throw new Error(`the learning track has no level ${id}`);
  }
  return level;
}

/**
 * A run count, with the seeds that lost it named.
 * The same count with a different seed lost is a different event, which the number alone can't say.
 * @param label - Names the program.
 * @param result - What the sweep came to.
 * @returns A one-line description.
 */
function describeSweep(label: string, result: SweepResult): string {
  const lost = result.losingSeeds.slice(0, 10).join(", ");
  return (
    `${label} won ${String(result.wins)} of ${String(SWEEP_SEEDS.length)}; lost ` +
    `[${lost}${result.losingSeeds.length > 10 ? ", …" : ""}]`
  );
}

/**
 * How long one sweep is allowed to take.
 * Generous on purpose: each case is already slow enough that CI parallelism and coverage instrumentation can blow past the default timeout, turning a slow pass into a false failure.
 */
const SWEEP_TIMEOUT_MS = 30_000;

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

describe("Learning track level tutorial-6 over four hundred seeds", () => {
  const level = levelById("tutorial-6");

  it(
    "never rejects its own answer",
    () => {
      // The ten fixed seeds in the fast suite can't see a rare rejection like
      // this; that's what this file is for.
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
      const levelOne = levels[0];
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
