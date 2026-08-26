/**
 * Golden values: what {@link "./levels.ts"!levels}' `tiers` fields actually
 * award to two reference programs, recorded from real runs on ten fixed
 * seeds rather than asserted in the abstract. A change to physics or
 * thresholds should move exactly the rows it's supposed to; this file says which.
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

/** Simulated-second bound on a run, so an undecided condition fails loudly instead of spinning the test runner forever. */
const MAX_SIMULATED_SECONDS = 2000.0;

/** This suite's own stand-in for "the seed everybody plays." */
const OWN_SEED: RandomSeed = 0;

/** The same nine extra seeds `tutorial-solutions.test.ts` measures against. */
const EXTRA_SEEDS: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6, "abc", "xyz", "42a"];

/** Every seed this file measures, `OWN_SEED` first. */
const SEEDS: readonly RandomSeed[] = [OWN_SEED, ...EXTRA_SEEDS];

/** The tier one run reached, `"lost"` standing in for {@link evaluateLevelTier}'s `null`. */
type TierOutcome = "gold" | "silver" | "bronze" | "lost";

/**
 * Plays one program in one level's building on one seed, and reports the tier it reached.
 *
 * @throws When the run is still undecided after {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(level: Level, code: string, seed: RandomSeed): TierOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  // Nothing draws these runs; the verdict comes from `stats_changed`.
  worldController.updatesDisplay = false;
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // An object property, not a plain `let`: both reads below are outside the
  // callback that writes it, past where flow analysis follows, so a plain
  // local would narrow to `null` and the comparisons would be flagged as always true.
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

// Recorded from real runs against the engine, not a guess. Column order
// matches SEEDS: 0, 1, 2, 3, 4, 5, 6, "abc", "xyz", "42a".
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
    levelNumber: 5,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "silver", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
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
    levelNumber: 10,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
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
    // No `tiers` field: every outcome below is a loss by construction.
    levelNumber: 17,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field: every outcome below is a loss by construction.
    levelNumber: 18,
    goodCode: GOOD_CODE_BALANCED,
    goodLabel: "GOOD_CODE_BALANCED",
    devOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
    goodOutcomes: ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  },
  {
    // No `tiers` field: every outcome below is a loss by construction.
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
