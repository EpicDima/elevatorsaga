/**
 * What {@link "./challenges.ts"!challenges}' `tiers` fields actually award, measured
 * against two real programs on a fixed set of seeds, recorded exactly rather than
 * asserted in the abstract.
 *
 * Every threshold in `challenges.ts` was set from the *distribution* of two
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
 * **Two programs, not one.** {@link DEV_TEST_CODE} is the editor's placeholder
 * program -- a naive nearest-car dispatcher that re-scores every call from
 * scratch -- and {@link GOOD_CODE_BALANCED} / {@link GOOD_CODE_MOVE_CONSCIOUS}
 * are the collective-control dispatcher `challenge-reference-code.ts` builds for
 * calibration. Neither is "the good one" across the board: the calibration in
 * `challenges.ts` picked whichever of the two was empirically stricter on each
 * challenge's own axis, and on a good few challenges that turned out to be
 * `DEV_TEST_CODE` -- a naive program that re-decides on every call is often
 * better at avoiding one long wait than a sweep that is still on its way across
 * the building. This file's table reflects that; it does not expect one program
 * to win a fight the calibration didn't ask it to win.
 *
 * **Ten seeds, fixed.** No numbered challenge in `challenges.ts` has a single
 * pinned seed of its own the way a `tutorialTasks` entry does, so `0` is picked
 * once here to serve as the suite's own stand-in for "the seed everybody
 * plays," and reused across all nineteen challenges. The other nine are the same
 * `1`-`6` and three strings `tutorial-solutions.test.ts` uses, for the same
 * reason: a seed is either a number or a string, per {@link RandomSeed}, and the
 * two are hashed differently on the way into the generator.
 *
 * **Four challenges are all "lost."** Challenges 10, 17, 18 and 19 have no
 * `tiers` field at all -- across the same two hundred calibration seeds neither
 * reference program ever won bronze there, so there was no distribution to read
 * a threshold from. Their rows below are complete columns of `"lost"` rather
 * than being left out, so that a change to the world's physics that makes
 * either program suddenly start winning one of them is caught here, same as any
 * other row would be.
 */

import { describe, expect, it } from "vitest";

import type { Challenge } from "./challenges.ts";
import { challenges } from "./challenges.ts";
import { GOOD_CODE_BALANCED, GOOD_CODE_MOVE_CONSCIOUS } from "./challenge-reference-code.ts";
import { evaluateChallengeTier } from "./challenge-tiers.ts";
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
 * Not a limit any challenge here is actually judged against -- every condition
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
 * The tier one run reached, `"lost"` standing in for {@link evaluateChallengeTier}'s
 * `null` -- a run that never won bronze at all.
 */
type TierOutcome = "gold" | "silver" | "bronze" | "lost";

/**
 * Plays one program in one challenge's building on one seed, and reports the
 * exact tier it reached.
 *
 * Mirrors the harness `tutorial-solutions.test.ts` drives its own runs with:
 * a real {@link "./world.ts"!World} at the given seed, a real
 * {@link "./world-controller.ts"!WorldController} at the app's own tick, the
 * condition consulted on every `stats_changed`, and the run stopped at the
 * first non-null verdict.
 *
 * @param challenge - Supplies the building, the condition and the tiers.
 * @param code - The program to run.
 * @param seed - The passengers to run against.
 * @returns The tier the run reached, or `"lost"` when bronze itself was not won.
 * @throws When the run is still undecided after {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(challenge: Challenge, code: string, seed: RandomSeed): TierOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(challenge.options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property on an object, not a plain `let`, for the same reason
  // `tutorial-solutions.test.ts`'s `playTask` uses one: both reads below happen
  // outside the callback that writes it, past where the compiler's flow
  // analysis follows, so a plain local would be narrowed to `null` at the loop
  // and the comparisons reported as always true.
  const run: { verdict: boolean | null } = { verdict: null };
  world.on("stats_changed", () => {
    if (run.verdict !== null) {
      return;
    }
    const status = challenge.condition.evaluate(world);
    if (status === null) {
      return;
    }
    run.verdict = status;
    world.challengeEnded = true;
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
  return evaluateChallengeTier(run.verdict, world, challenge.tiers) ?? "lost";
}

/** One challenge's recorded outcome, on every seed in {@link SEEDS}, in that order. */
interface ChallengeTierCase {
  /** The challenge's number as the player sees it -- one-based. */
  readonly challengeNumber: number;
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
const CASES: readonly ChallengeTierCase[] = [
  {
    challengeNumber: 1,
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
    challengeNumber: 2,
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
    challengeNumber: 3,
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
    challengeNumber: 4,
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
    // DEV_TEST_CODE, 8 for GOOD_CODE_BALANCED (see `challenges.ts`) -- and on
    // this fixed set of ten seeds that rarity shows up as nine straight losses
    // apiece, with DEV_TEST_CODE's single silver on seed `3` the only case
    // that isn't `"lost"`.
    challengeNumber: 5,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "silver", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    challengeNumber: 6,
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
      "bronze",
    ],
  },
  {
    challengeNumber: 7,
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
    challengeNumber: 8,
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
    challengeNumber: 9,
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
    // No `tiers` field -- see `challenges.ts`. Neither program won bronze even
    // once across two hundred calibration seeds, and none of these ten seeds
    // are an exception.
    challengeNumber: 10,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // GOOD_CODE_BALANCED wins this challenge's bronze only twice in two
    // hundred calibration seeds; on this fixed set it wins exactly one of
    // them. The tiers are read from DEV_TEST_CODE's distribution instead (see
    // `challenges.ts`), which is why it is the one reaching gold here.
    challengeNumber: 11,
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
    // GOOD_CODE_BALANCED never wins this challenge's bronze across two hundred
    // calibration seeds, and none of these ten is an exception either.
    challengeNumber: 12,
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
    // Bronze is thin for DEV_TEST_CODE too here -- 14 wins in 200 -- and
    // GOOD_CODE_BALANCED never wins it at all.
    challengeNumber: 13,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: [
      "lost",
      "lost",
      "bronze",
      "lost",
      "lost",
      "lost",
      "lost",
      "lost",
      "silver",
      "lost",
    ],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    challengeNumber: 14,
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
    // GOOD_CODE_BALANCED wins this challenge's bronze only 4 times in two
    // hundred calibration seeds; on this fixed set, only once.
    challengeNumber: 15,
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
    challengeNumber: 16,
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
    // No `tiers` field -- see `challenges.ts`. Neither program wins bronze
    // even once across two hundred calibration seeds.
    challengeNumber: 17,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field -- see `challenges.ts`. The largest building in the
    // list, and neither program wins its bronze even once across two hundred
    // calibration seeds.
    challengeNumber: 18,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field -- see `challenges.ts`, and see its comment for why:
    // the twenty-seed measurement that set this challenge's own bronze limit
    // used a different program than either of this file's two references, and
    // across two hundred later seeds neither reference wins its bronze even
    // once.
    challengeNumber: 19,
    goodCode: GOOD_CODE_MOVE_CONSCIOUS,
    goodLabel: "GOOD_CODE_MOVE_CONSCIOUS",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
];

for (const testCase of CASES) {
  describe(`Challenge ${String(testCase.challengeNumber)} tiers`, () => {
    it("awards DEV_TEST_CODE and the reference dispatcher exactly the recorded tier on every measured seed", () => {
      const challenge = challenges[testCase.challengeNumber - 1];
      if (challenge === undefined) {
        throw new Error(`no challenge numbered ${String(testCase.challengeNumber)}`);
      }
      for (const [index, seed] of SEEDS.entries()) {
        const devOutcome = playRun(challenge, DEV_TEST_CODE, seed);
        expect(
          devOutcome,
          `challenge ${String(testCase.challengeNumber)}, DEV_TEST_CODE, seed ${String(seed)}`,
        ).toBe(testCase.devOutcomes[index]);

        const goodOutcome = playRun(challenge, testCase.goodCode, seed);
        expect(
          goodOutcome,
          `challenge ${String(testCase.challengeNumber)}, ${testCase.goodLabel}, seed ${String(seed)}`,
        ).toBe(testCase.goodOutcomes[index]);
      }
    });
  });
}
