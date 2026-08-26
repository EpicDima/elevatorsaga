/**
 * Plays a learning-track level over four hundred seeds, since ten aren't
 * enough to see how often a max-based bar accepts or rejects a program. The
 * counts the sweeps assert are exact, not bounds — a bound would hide either a
 * regression or an improvement in the underlying simulation.
 *
 * One file per level, sharing this module: together the sweeps are the slowest
 * thing in the suite, and a file is what a worker runs, so three files finish
 * in the time the slowest level takes rather than in the time all three do.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

import { createFrameRequester } from "../frame-requester.ts";
import type { LevelCondition } from "../levels.ts";
import type { RandomSeed } from "../random.ts";
import { tutorialLevels, type TutorialLevel } from "../tutorial.ts";
import { getCodeObjFromCode } from "../user-code.ts";
import { TICK_SECONDS, createWorldController } from "../world-controller.ts";
import { createWorld, type WorldOptions } from "../world.ts";

/**
 * Simulated milliseconds one driven frame advances by. A second, which is the
 * controller's own cap of 100 ticks per frame: the world evolves by ticks, so
 * batching them decides every run exactly as a display's 60 frames a second
 * would, and skips 59 of every 60 display refreshes on the way.
 */
const FRAME_MILLISECONDS = 1000.0;

/** Simulated seconds after which an undecided run is treated as broken, so a stuck test fails loudly. */
const MAX_SIMULATED_SECONDS = 240.0;

/** Seeds per named set. */
const SET_SIZE = 200;

/**
 * The four hundred seeds every count is over, in order.
 * Generated, not listed, so re-measuring reproduces the exact same seeds; two prefixes rather than one range, so the counts are provably over two independent sets.
 */
export const SWEEP_SEEDS: readonly RandomSeed[] = ["t", "u"].flatMap((prefix) =>
  Array.from({ length: SET_SIZE }, (_unused, index) => `${prefix}${String(index)}`),
);

/**
 * How long one sweep is allowed to take.
 * Generous on purpose: each case is already slow enough that CI parallelism and coverage instrumentation can blow past the default timeout, turning a slow pass into a false failure.
 */
export const SWEEP_TIMEOUT_MS = 30_000;

/** How a program fared over {@link SWEEP_SEEDS}. */
export interface SweepResult {
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
export function sweep(options: WorldOptions, condition: LevelCondition, code: string): SweepResult {
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
export function levelById(id: string): TutorialLevel {
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
export function describeSweep(label: string, result: SweepResult): string {
  const lost = result.losingSeeds.slice(0, 10).join(", ");
  return (
    `${label} won ${String(result.wins)} of ${String(SWEEP_SEEDS.length)}; lost ` +
    `[${lost}${result.losingSeeds.length > 10 ? ", …" : ""}]`
  );
}
