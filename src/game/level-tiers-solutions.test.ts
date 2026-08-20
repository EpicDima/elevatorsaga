/**
 * What {@link "./levels.ts"!levels}' `tiers` fields actually award, measured
 * against two real programs on a fixed set of seeds, recorded exactly rather than
 * asserted in the abstract.
 *
 * Every threshold in `levels.ts` was set from the *distribution* of two
 * hundred calibration runs, not from a worst case: silver is roughly the median
 * of a competent program's wins, gold a stricter point in whichever program's
 * distribution turned out stricter on that axis. A median is a promise about a
 * population, not about any one run in it, so there is no reason to expect a
 * single fixed seed to land on the winning side of it, and no version of "the
 * reference program reaches gold on every seed" or "the naive one never does"
 * that the calibration ever claimed. What this file checks instead is narrower
 * and does not drift: on this fixed set of seeds, with today's physics and
 * today's thresholds, each program lands on exactly this tier. A change to
 * either would move at least one row, and the failure says which.
 *
 * **Two programs, not one.** {@link DEV_TEST_CODE} is the naive nearest-car
 * dispatcher that re-scores every call from scratch, and {@link GOOD_CODE_BALANCED} / {@link GOOD_CODE_MOVE_CONSCIOUS}
 * are the collective-control dispatcher `level-reference-code.ts` builds for
 * calibration. Neither is "the good one" across the board: the calibration in
 * `levels.ts` picked whichever of the two was empirically stricter on each
 * level's own axis, and on a good few levels that turned out to be
 * `DEV_TEST_CODE` -- a naive program that re-decides on every call is often
 * better at avoiding one long wait than a sweep that is still on its way across
 * the building. This file's table reflects that; it does not expect one program
 * to win a fight the calibration didn't ask it to win.
 *
 * **Ten seeds, fixed.** No numbered level in `levels.ts` has a single
 * pinned seed of its own the way a `tutorialLevels` entry does, so `0` is picked
 * once here to serve as the suite's own stand-in for "the seed everybody
 * plays," and reused across all nineteen levels. The other nine are the same
 * `1`-`6` and three strings `tutorial-solutions.test.ts` uses, for the same
 * reason: a seed is either a number or a string, per {@link RandomSeed}, and the
 * two are hashed differently on the way into the generator.
 *
 * **Three levels are all "lost."** Levels 17, 18 and 19 have no `tiers`
 * field at all -- across the same two hundred calibration seeds neither
 * reference program ever won bronze there, so there was no distribution to read
 * a threshold from. Their rows below are complete columns of `"lost"` rather
 * than being left out, so that a change to the world's physics that makes
 * either program suddenly start winning one of them is caught here, same as any
 * other row would be.
 *
 * **Level 10 is a fourth, thinner case.** It does have a `tiers` field --
 * GOOD_CODE_BALANCED wins its bronze about seven times in a thousand seeds, see
 * `levels.ts` -- but that is rare enough that none of the ten fixed seeds
 * below happen to be among the wins either, for either program. Its row is
 * still a full column of `"lost"`, and for the same reason as the three above:
 * a program that starts winning this level on one of these ten seeds is
 * exactly what this file exists to notice.
 */

import { describe, expect, it } from "vitest";

import type { Level } from "./levels.ts";
import { levels } from "./levels.ts";
import { GOOD_CODE_BALANCED, GOOD_CODE_MOVE_CONSCIOUS } from "./level-reference-code.ts";
import { evaluateLevelTier } from "./level-tiers.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld } from "./world.ts";
import { DEV_TEST_CODE } from "../ui/default-code.ts";

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/**
 * Simulated seconds after which an undecided run is treated as broken.
 *
 * Not a limit any level here is actually judged against -- every condition
 * below resolves well inside it -- but a bound on the loop that drives a run,
 * so that a condition which stopped resolving fails loudly instead of spinning
 * the test runner forever.
 */
const MAX_SIMULATED_SECONDS = 2000.0;

/** This suite's own stand-in for "the seed everybody plays"; see the file doc. */
const OWN_SEED: RandomSeed = 0;

/** The same nine extra seeds `tutorial-solutions.test.ts` measures against. */
const EXTRA_SEEDS: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6, "abc", "xyz", "42a"];

/** Every seed this file measures, `OWN_SEED` first. */
const SEEDS: readonly RandomSeed[] = [OWN_SEED, ...EXTRA_SEEDS];

/**
 * The tier one run reached, `"lost"` standing in for {@link evaluateLevelTier}'s
 * `null` -- a run that never won bronze at all.
 */
type TierOutcome = "gold" | "silver" | "bronze" | "lost";

/**
 * Plays one program in one level's building on one seed, and reports the
 * exact tier it reached.
 *
 * Mirrors the harness `tutorial-solutions.test.ts` drives its own runs with:
 * a real {@link "./world.ts"!World} at the given seed, a real
 * {@link "./world-controller.ts"!WorldController} at the app's own tick, the
 * condition consulted on every `stats_changed`, and the run stopped at the
 * first non-null verdict.
 *
 * @param level - Supplies the building, the condition and the tiers.
 * @param code - The program to run.
 * @param seed - The passengers to run against.
 * @returns The tier the run reached, or `"lost"` when bronze itself was not won.
 * @throws When the run is still undecided after {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(level: Level, code: string, seed: RandomSeed): TierOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property on an object, not a plain `let`, for the same reason
  // `tutorial-solutions.test.ts`'s `playLevel` uses one: both reads below happen
  // outside the callback that writes it, past where the compiler's flow
  // analysis follows, so a plain local would be narrowed to `null` at the loop
  // and the comparisons reported as always true.
  const run: { verdict: boolean | null } = { verdict: null };
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
  while (run.verdict === null && world.elapsedTime < MAX_SIMULATED_SECONDS) {
    frameRequester.trigger();
  }
  if (run.verdict === null) {
    throw new Error(
      `run was still undecided after ${String(MAX_SIMULATED_SECONDS)} simulated ` +
        `seconds at seed ${String(seed)}, so this case decides nothing`,
    );
  }
  return evaluateLevelTier(run.verdict, world, level.tiers) ?? "lost";
}

/** One level's recorded outcome, on every seed in {@link SEEDS}, in that order. */
interface LevelTierCase {
  /** The level's number as the player sees it -- one-based. */
  readonly levelNumber: number;
  /** The collective-control reference program measured alongside `DEV_TEST_CODE`. */
  readonly goodCode: string;
  /** `goodCode`'s name, for failure messages. */
  readonly goodLabel: string;
  /** `DEV_TEST_CODE`'s recorded tier at each of {@link SEEDS}. */
  readonly devOutcomes: readonly TierOutcome[];
  /** `goodCode`'s recorded tier at each of {@link SEEDS}. */
  readonly goodOutcomes: readonly TierOutcome[];
}

// Recorded once, by running every case below against the real engine at every
// seed in `SEEDS` and reading off what actually happened -- not a guess, and
// not the worst or best case, just what these ten seeds produced today.
//
// Column order throughout is SEEDS' own: 0, 1, 2, 3, 4, 5, 6, "abc", "xyz", "42a".
const CASES: readonly LevelTierCase[] = [
  {
    levelNumber: 1,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "gold",
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "gold",
    ],
    goodOutcomes: [
      "gold",
      "bronze",
      "silver",
      "bronze",
      "bronze",
      "gold",
      "bronze",
      "gold",
      "silver",
      "bronze",
    ],
  },
  {
    levelNumber: 2,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["gold", "lost", "gold", "bronze", "gold", "lost", "lost", "lost", "gold", "lost"],
    goodOutcomes: [
      "lost",
      "bronze",
      "bronze",
      "lost",
      "bronze",
      "lost",
      "bronze",
      "bronze",
      "gold",
      "lost",
    ],
  },
  {
    levelNumber: 3,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "gold",
      "lost",
      "bronze",
      "lost",
      "bronze",
      "silver",
      "bronze",
      "silver",
      "gold",
      "bronze",
    ],
    goodOutcomes: [
      "bronze",
      "bronze",
      "silver",
      "gold",
      "silver",
      "lost",
      "lost",
      "bronze",
      "silver",
      "gold",
    ],
  },
  {
    levelNumber: 4,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "lost",
      "lost",
      "gold",
      "bronze",
      "gold",
      "bronze",
      "bronze",
      "gold",
      "bronze",
      "lost",
    ],
    goodOutcomes: [
      "silver",
      "lost",
      "gold",
      "silver",
      "lost",
      "gold",
      "gold",
      "gold",
      "gold",
      "gold",
    ],
  },
  {
    // Bronze itself is rare for both programs here -- 27 wins in 200 for
    // DEV_TEST_CODE, 8 for GOOD_CODE_BALANCED (see `levels.ts`) -- and on
    // this fixed set of ten seeds that rarity shows up as nine straight losses
    // apiece, with DEV_TEST_CODE's single silver on seed `3` the only case
    // that isn't `"lost"`.
    levelNumber: 5,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "silver", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // Silver's move-count bar loosened by one move on recalibration (see
    // levels.ts, where the nearest-car dispatcher's 18-win sample turned
    // out too thin), which is why GOOD_CODE_MOVE_CONSCIOUS reaches silver
    // rather than bronze on seed `42a` below -- its move count of 58 clears
    // the new bar of 58 but not the old one of 57.
    levelNumber: 6,
    goodCode: GOOD_CODE_MOVE_CONSCIOUS,
    goodLabel: "GOOD_CODE_MOVE_CONSCIOUS",
    devOutcomes: [
      "lost",
      "lost",
      "silver",
      "lost",
      "lost",
      "lost",
      "silver",
      "lost",
      "lost",
      "lost",
    ],
    goodOutcomes: [
      "silver",
      "silver",
      "silver",
      "silver",
      "lost",
      "lost",
      "silver",
      "lost",
      "lost",
      "silver",
    ],
  },
  {
    levelNumber: 7,
    goodCode: GOOD_CODE_MOVE_CONSCIOUS,
    goodLabel: "GOOD_CODE_MOVE_CONSCIOUS",
    devOutcomes: [
      "silver",
      "lost",
      "lost",
      "gold",
      "silver",
      "lost",
      "silver",
      "lost",
      "lost",
      "lost",
    ],
    goodOutcomes: [
      "lost",
      "lost",
      "lost",
      "silver",
      "silver",
      "lost",
      "silver",
      "lost",
      "silver",
      "lost",
    ],
  },
  {
    levelNumber: 8,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "silver",
      "gold",
      "gold",
      "silver",
      "bronze",
      "bronze",
      "silver",
      "bronze",
      "silver",
      "gold",
    ],
    goodOutcomes: [
      "lost",
      "bronze",
      "bronze",
      "lost",
      "bronze",
      "bronze",
      "bronze",
      "lost",
      "lost",
      "bronze",
    ],
  },
  {
    levelNumber: 9,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "bronze",
      "bronze",
      "bronze",
      "bronze",
      "lost",
      "bronze",
      "silver",
      "gold",
      "silver",
      "gold",
    ],
    goodOutcomes: [
      "bronze",
      "lost",
      "lost",
      "lost",
      "bronze",
      "gold",
      "lost",
      "lost",
      "bronze",
      "lost",
    ],
  },
  {
    // Has a `tiers` field now -- see `levels.ts` -- but GOOD_CODE_BALANCED
    // only wins this level's bronze about seven times in a thousand seeds,
    // and none of these ten fixed seeds land on one of those wins either, for
    // either program.
    levelNumber: 10,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // GOOD_CODE_BALANCED wins this level's bronze only twice in two
    // hundred calibration seeds; on this fixed set it wins exactly one of
    // them. The tiers are read from DEV_TEST_CODE's distribution instead (see
    // `levels.ts`), which is why it is the one reaching gold here.
    levelNumber: 11,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "lost",
      "bronze",
      "gold",
      "gold",
      "gold",
      "lost",
      "silver",
      "bronze",
      "gold",
      "gold",
    ],
    goodOutcomes: [
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "bronze",
      "lost",
      "lost",
      "lost",
      "lost",
    ],
  },
  {
    // GOOD_CODE_BALANCED never wins this level's bronze across two hundred
    // calibration seeds, and none of these ten is an exception either.
    levelNumber: 12,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "lost",
      "bronze",
      "silver",
      "bronze",
      "bronze",
      "lost",
      "silver",
      "lost",
      "gold",
      "lost",
    ],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // Bronze was thin for DEV_TEST_CODE here too -- 14 wins in 200 -- and its
    // tiers have since been recalibrated against a much larger sample (see
    // levels.ts), which is why seed `xyz` reaches gold below rather than
    // silver: its worst wait of 13.79s clears the new gold bar of 13.9 but
    // not the old one of 13.7. GOOD_CODE_BALANCED never wins it at all.
    levelNumber: 13,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "bronze", "lost", "lost", "lost", "lost", "lost", "gold", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    levelNumber: 14,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "lost",
      "lost",
      "lost",
      "lost",
      "bronze",
      "lost",
      "lost",
      "lost",
      "bronze",
      "lost",
    ],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // GOOD_CODE_BALANCED wins this level's bronze only 4 times in two
    // hundred calibration seeds; on this fixed set, only once.
    levelNumber: 15,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "bronze",
      "bronze",
      "bronze",
      "gold",
      "bronze",
      "lost",
      "gold",
      "silver",
      "bronze",
      "lost",
    ],
    goodOutcomes: [
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "bronze",
      "lost",
    ],
  },
  {
    levelNumber: 16,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "silver",
      "gold",
      "bronze",
      "silver",
      "bronze",
      "silver",
      "silver",
      "bronze",
      "silver",
      "silver",
    ],
    goodOutcomes: [
      "silver",
      "bronze",
      "bronze",
      "silver",
      "silver",
      "silver",
      "silver",
      "lost",
      "bronze",
      "gold",
    ],
  },
  {
    // No `tiers` field -- see `levels.ts`. Neither program wins bronze
    // even once across two hundred calibration seeds.
    levelNumber: 17,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field -- see `levels.ts`. The largest building in the
    // list, and neither program wins its bronze even once across two hundred
    // calibration seeds.
    levelNumber: 18,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field -- see `levels.ts`, and see its comment for why:
    // the twenty-seed measurement that set this level's own bronze limit
    // used a different program than either of this file's two references, and
    // across two hundred later seeds neither reference wins its bronze even
    // once.
    levelNumber: 19,
    goodCode: GOOD_CODE_MOVE_CONSCIOUS,
    goodLabel: "GOOD_CODE_MOVE_CONSCIOUS",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
];

for (const testCase of CASES) {
  describe(`Level ${String(testCase.levelNumber)} tiers`, () => {
    it("awards DEV_TEST_CODE and the reference dispatcher exactly the recorded tier on every measured seed", () => {
      const level = levels[testCase.levelNumber - 1];
      if (level === undefined) {
        throw new Error(`no level numbered ${String(testCase.levelNumber)}`);
      }
      for (const [index, seed] of SEEDS.entries()) {
        const devOutcome = playRun(level, DEV_TEST_CODE, seed);
        expect(
          devOutcome,
          `level ${String(testCase.levelNumber)}, DEV_TEST_CODE, seed ${String(seed)}`,
        ).toBe(testCase.devOutcomes[index]);

        const goodOutcome = playRun(level, testCase.goodCode, seed);
        expect(
          goodOutcome,
          `level ${String(testCase.levelNumber)}, ${testCase.goodLabel}, seed ${String(seed)}`,
        ).toBe(testCase.goodOutcomes[index]);
      }
    });
  });
}
