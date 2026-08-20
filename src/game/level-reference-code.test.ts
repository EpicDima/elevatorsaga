import { describe, expect, it } from "vitest";

import {
  buildGoodDispatcherCode,
  GOOD_CODE_BALANCED,
  GOOD_CODE_MOVE_CONSCIOUS,
} from "./level-reference-code.ts";
import type { Level } from "./levels.ts";
import { levels } from "./levels.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld, type WorldOptions } from "./world.ts";

/**
 * Confirms the two presets are real, loadable programs.
 *
 * Not a simulated run — real runs, against an actual {@link "./world.ts"!World},
 * are further down this file and are about termination rather than score.
 * Scoring a run against a level's actual thresholds is a later
 * calibration commit's job. What belongs here is the same check
 * `user-code.test.ts` runs on every program this codebase hands to
 * {@link "./user-code.ts"!getCodeObjFromCode}: the source parses, and the
 * result has callable `init` and `update` functions, so a syntax mistake in
 * the generated source is caught the moment this file changes rather than the
 * moment a later commit's calibration run tries to execute it.
 */
describe.each([
  ["GOOD_CODE_BALANCED", GOOD_CODE_BALANCED],
  ["GOOD_CODE_MOVE_CONSCIOUS", GOOD_CODE_MOVE_CONSCIOUS],
])("%s", (_name, code) => {
  it("is non-empty source", () => {
    expect(code.trim().length).toBeGreaterThan(0);
  });

  it("parses into an object with callable init and update", () => {
    const codeObj = getCodeObjFromCode(code);
    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
  });

  it("runs init and update against an empty building without throwing", () => {
    const codeObj = getCodeObjFromCode(code);
    expect(() => {
      codeObj.init([], []);
    }).not.toThrow();
    expect(() => {
      codeObj.update(0.1, [], []);
    }).not.toThrow();
  });
});

describe("buildGoodDispatcherCode", () => {
  it("bakes the given load cutoff into the source", () => {
    const code = buildGoodDispatcherCode(0.42);
    expect(code).toContain("0.42");
  });

  it("produces a fresh, independently valid program for each cutoff", () => {
    const strict = getCodeObjFromCode(buildGoodDispatcherCode(0.1));
    const lenient = getCodeObjFromCode(buildGoodDispatcherCode(1));
    expect(typeof strict.init).toBe("function");
    expect(typeof lenient.init).toBe("function");
  });
});

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/** What one uncapped run's raw statistics came to at the moment it stopped. */
interface RawRunResult {
  /** Simulated seconds actually reached; at least the caller's `minSeconds`. */
  readonly elapsedTime: number;
  /** Passengers delivered by then. */
  readonly transportedCounter: number;
  /** Total floor changes across all elevators, by then. */
  readonly moveCount: number;
  /** Door openings across all elevators, by then. */
  readonly stopCount: number;
}

/**
 * Drives a real {@link "./world.ts"!World} for at least `minSeconds`, ignoring
 * whatever the building's own level condition would have decided.
 *
 * The regression test below cares about something a level condition
 * cannot show: whether the simulation keeps making progress long after the
 * point a livelocked run would already be stuck. `requireUserCountWithinTime`
 * and its relatives stop a run the moment `elapsedTime` crosses the
 * level's own limit, which would have quietly reported "lost" at t=60 for
 * the defect this guards against, rather than the frozen, still-running
 * `destinationQueue` the defect actually produced past t=39 and up to the
 * t=400 an independent trace confirmed it never recovered from. Running past
 * every such limit and reading the raw counters directly is what actually
 * distinguishes "a livelocked car" from "a car that legitimately lost."
 *
 * @param options - Building to run.
 * @param code - Player program to run, as `getCodeObjFromCode` loads it.
 * @param seed - Passengers to run against.
 * @param minSeconds - Simulated seconds to drive the world for, at least.
 * @returns The world's raw statistics once `minSeconds` was reached.
 * @throws When the program throws.
 */
function runRawUntil(
  options: WorldOptions,
  code: string,
  seed: RandomSeed,
  minSeconds: number,
): RawRunResult {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);

  let userCodeError: unknown = null;
  worldController.on("usercode_error", (e) => {
    userCodeError ??= e;
  });

  worldController.start(world, codeObj, frameRequester.register, true);
  while (world.elapsedTime < minSeconds && userCodeError === null) {
    frameRequester.trigger();
  }

  if (userCodeError !== null) {
    throw new Error(`the program threw at seed ${String(seed)}`, { cause: userCodeError });
  }

  return {
    elapsedTime: world.elapsedTime,
    transportedCounter: world.transportedCounter,
    moveCount: world.moveCount,
    stopCount: world.stopCount,
  };
}

/**
 * Regression guard for the full-single-car livelock a verification pass found
 * in an earlier version of this file: a car that became full while stopped
 * exactly at the floor a refused passenger kept re-pressing would splice that
 * re-press ahead of an already-queued stop forever, never reaching the queued
 * floor and never delivering another passenger again.
 *
 * Reproduces the exact scenario that was traced: level 1's building
 * (`{floorCount: 3, elevatorCount: 1, spawnRate: 0.3}`, the fifteen-in-sixty
 * bronze bar), {@link GOOD_CODE_BALANCED}, seed `1`, run with the level's
 * own condition set aside so a livelock cannot hide behind "lost at t=60" (see
 * {@link runRawUntil}). Before the fix this froze at `transportedCounter === 8`
 * by t≈39s and never moved again, confirmed by re-tracing to t=400; after it,
 * the single car gets unstuck, finishes delivering, and the counter comfortably
 * clears the level's own target of 15 long before 400 simulated seconds
 * are up.
 */
describe("regression: a full single car does not starve an already-queued stop", () => {
  it("keeps delivering past the point the un-fixed dispatcher froze, and clears the level's target within 400s", () => {
    const level = levels[0];
    if (level === undefined) {
      throw new Error("levels[0] does not exist");
    }
    const result = runRawUntil(level.options, GOOD_CODE_BALANCED, 1, 400);
    expect(result.elapsedTime).toBeGreaterThanOrEqual(400);
    expect(
      result.transportedCounter,
      `only ${String(result.transportedCounter)} delivered by t=${result.elapsedTime.toFixed(1)} ` +
        `(moveCount=${String(result.moveCount)}, stopCount=${String(result.stopCount)}) -- ` +
        `a healthy run clears this level's target of 15 in well under a minute`,
    ).toBeGreaterThanOrEqual(15);
  });
});

/** What one condition-judged run came to. */
interface JudgedRunResult {
  /** The condition's verdict: `true` won, `false` lost, `null` never decided. */
  readonly verdict: boolean | null;
  /** Simulated seconds reached, whether or not a verdict was ever reached. */
  readonly elapsedTime: number;
  /** Passengers delivered by then. */
  readonly transportedCounter: number;
}

/**
 * Plays one program in one level's building on one seed, judged by the
 * level's own condition, and reports what happened rather than asserting
 * anything itself -- the caller decides what a verdict of `null` means.
 *
 * The same shape as `tutorial-solutions.test.ts`'s `playTask`, with one
 * deliberate difference: `playTask` throws when a run is still undecided at
 * its bound, because for a learning-track task an undecided run is always a
 * broken test. Here an undecided run *is* the finding the smoke check below
 * exists to make, so this returns `verdict: null` instead of throwing, and
 * lets the assertion -- with a message describing exactly how far the run
 * got -- be the one place that finding turns into a failure.
 *
 * @param level - Supplies the building and the win/lose bar.
 * @param code - Player program to run.
 * @param seed - Passengers to run against.
 * @param maxSimulatedSeconds - Bound on how long an undecided run is driven
 * before giving up and reporting `verdict: null`.
 * @returns What the run came to.
 * @throws When the program throws.
 */
function playLevel(
  level: Level,
  code: string,
  seed: RandomSeed,
  maxSimulatedSeconds: number,
): JudgedRunResult {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);

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
    const status = level.condition.evaluate(world);
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
    world.elapsedTime < maxSimulatedSeconds
  ) {
    frameRequester.trigger();
  }

  if (run.userCodeError !== null) {
    throw new Error(`the program threw at seed ${String(seed)}`, { cause: run.userCodeError });
  }

  return {
    verdict: run.verdict,
    elapsedTime: world.elapsedTime,
    transportedCounter: world.transportedCounter,
  };
}

/**
 * Real levels the termination smoke check plays, by index into
 * {@link "./levels.ts"!levels}: levels 1, 6, 7 and 19 (one-based,
 * matching how the game numbers them).
 *
 * Not an arbitrary sample. Level 1 is the single-elevator building the
 * regression above reproduces its defect in, where a `loadCutoff` has the
 * least room to be worked around by simply routing a call to a different car.
 * Levels 6, 7 and 19 are judged wholly or partly on `moveCount`
 * (`requireUserCountWithinMoves`, `requireUserCountWithinMovesWithMaxWaitTime`),
 * whose `evaluate` has no `elapsedTime` branch at all -- unlike every
 * time-limited or wait-limited condition in this file, a livelock in one of
 * these buildings would never resolve on its own no matter how long a test
 * let it run, which is exactly the kind of hang this smoke check exists to
 * turn into a prompt, readable test failure instead.
 */
const SMOKE_LEVEL_INDICES: readonly number[] = [0, 5, 6, 18];

/** Seeds the termination smoke check plays each level/preset pair on. */
const SMOKE_SEEDS: readonly RandomSeed[] = [1, 2, 3, 4, 5];

/**
 * Simulated seconds an undecided smoke-check run is allowed before its
 * result counts as a hang.
 *
 * Generous on purpose: every level in {@link SMOKE_LEVEL_INDICES} has
 * a time, move or wait limit of well under 500 simulated seconds baked into
 * its own condition, so a dispatcher that is actually making progress -- win
 * or lose -- reaches a verdict in a small fraction of this bound. What this
 * bound is actually for is turning a genuine livelock into a failed
 * assertion in well under a minute of real test time, rather than a suite
 * that never returns.
 */
const SMOKE_MAX_SIMULATED_SECONDS = 500;

/**
 * Broad termination smoke check: this dispatcher must always reach a
 * decided verdict, never freeze.
 *
 * The regression above is one exact reproduction of one defect; this is the
 * check meant to catch the *class* of bug that defect belonged to, the way
 * `tutorial-sweep.test.ts` catches more than the one seed a tutorial task
 * happened to be measured on. It does not require either preset to *win* --
 * {@link GOOD_CODE_BALANCED} is not calibrated for the move-budget levels
 * here any more than {@link GOOD_CODE_MOVE_CONSCIOUS} is for the others, and
 * losing honestly is not a bug. Only `verdict === null` -- undecided after
 * {@link SMOKE_MAX_SIMULATED_SECONDS} -- is.
 */
describe("termination smoke check across a spread of real levels", () => {
  const presets: ReadonlyMap<string, string> = new Map([
    ["GOOD_CODE_BALANCED", GOOD_CODE_BALANCED],
    ["GOOD_CODE_MOVE_CONSCIOUS", GOOD_CODE_MOVE_CONSCIOUS],
  ]);

  for (const [presetName, code] of presets) {
    for (const levelIndex of SMOKE_LEVEL_INDICES) {
      const level = levels[levelIndex];
      if (level === undefined) {
        throw new Error(`levels[${String(levelIndex)}] does not exist`);
      }

      describe(`${presetName} on level ${String(levelIndex + 1)}`, () => {
        for (const seed of SMOKE_SEEDS) {
          it(`reaches a verdict at seed ${String(seed)}`, () => {
            const result = playLevel(level, code, seed, SMOKE_MAX_SIMULATED_SECONDS);
            expect(
              result.verdict,
              `still undecided after ${String(SMOKE_MAX_SIMULATED_SECONDS)}s ` +
                `(elapsedTime=${result.elapsedTime.toFixed(1)}, ` +
                `transportedCounter=${String(result.transportedCounter)}) -- looks like a livelock`,
            ).not.toBeNull();
          });
        }
      });
    }
  }
});
