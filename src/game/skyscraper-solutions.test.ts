/**
 * What every Skyscraper level actually awards, measured against four real
 * programs and recorded exactly rather than asserted in the abstract.
 *
 * This is the empirical half of the pair `skyscraper.test.ts` describes: that
 * file checks the table's shape and is fast and total, this one plays the
 * levels and is slow. The thresholds in `skyscraper.ts` are claims about runs,
 * and the only thing that can check a claim about a run is a run.
 *
 * **One seed, not ten.** `level-tiers-solutions.test.ts` measures the numbered
 * levels across ten seeds because none of them pins one; every level here pins
 * its own, and `SkyscraperLevel.seed` explains why. So a row below is not a
 * sample of a distribution — it is *the* run, the same one every player of that
 * level gets, and a bar set from it is a bar with no luck in it at all.
 *
 * **Four programs, chosen for what they disagree about**, and a fifth on the one
 * level where four are not enough.
 * - The level's own `startingCode`, which is the only one of them a player ever
 *   sees. On five of the ten levels it is the round-robin dispatcher that sends
 *   one car to one call and is meant to lose; on three it is the sweep, and the
 *   level is about improving on it; on the last two it is the zone-aware sweep,
 *   which is `sky-8`'s answer handed over as where `sky-9` and `sky-10` begin.
 * - {@link SWEEP_CODE}, the repair every demonstrating level is pointing at,
 *   taken from `sky-3`'s own starter rather than written again here. One sweep
 *   in the repository, and it is the one the player is handed.
 * - {@link DEV_TEST_CODE}, the naive nearest-car dispatcher the editor's own
 *   default is built from — a second opinion on "what a first attempt does",
 *   arrived at by a different route than the block's starters.
 * - {@link GOOD_CODE_BALANCED}, the collective-control dispatcher
 *   `level-reference-code.ts` builds for calibration, standing in for a good
 *   answer that knows nothing about this block's profiles.
 * - {@link ZONE_SWEEP_CODE}, the sweep with `servedFloors()` in front of the
 *   choice of car, recorded on `sky-8` alone. Everywhere else it would be a run
 *   already in the table: `sky-9` and `sky-10` ship it, so their `starter` cell
 *   is that run, and in an unzoned building the filter matches every car and the
 *   program is {@link SWEEP_CODE} to the character.
 *
 * That last one earns its place twice over. It is not the winner here: it takes
 * gold on `sky-3` and `sky-5` and only silver on `sky-7`, where the plain sweep
 * takes gold, and on `sky-4` it clears the budget by nine moves where the sweep
 * clears it by fifty-three. Both of those are levels whose whole subject is a
 * habit `GOOD_CODE_BALANCED` happens to have, so a row where it comes second is
 * the level working, not the reference program failing.
 *
 * **What a failure here means.** Every row is what the engine produced on the
 * day it was recorded. A change to the physics, to a threshold, or to a shipped
 * starter moves at least one cell, and the message says which level, which
 * program and which tier. That is the point: these levels have no decade of
 * published solutions to notice for them.
 */

import { describe, expect, it } from "vitest";

import { evaluateLevelTier } from "./level-tiers.ts";
import { GOOD_CODE_BALANCED } from "./level-reference-code.ts";
import { createFrameRequester } from "./frame-requester.ts";
import { skyscraperLevels, type SkyscraperLevel } from "./skyscraper.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld } from "./world.ts";
import { DEV_TEST_CODE } from "../ui/default-code.ts";

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/**
 * Simulated seconds after which an undecided run is treated as broken.
 *
 * Not a limit any level here is judged against — every condition below resolves
 * well inside it — but a bound on the loop that drives a run, so that a
 * condition which stopped resolving fails loudly instead of spinning the test
 * runner forever.
 */
const MAX_SIMULATED_SECONDS = 2000.0;

/**
 * The tier one run reached, `"lost"` standing in for
 * {@link evaluateLevelTier}'s `null` — a run that never won bronze at all.
 */
type TierOutcome = "gold" | "silver" | "bronze" | "lost";

/**
 * Looks up one level of the block by id.
 *
 * By id rather than by position for {@link SkyscraperLevel}'s own reason: the
 * position is the thing about a level expected to change, and a fixture indexed
 * by it would quietly measure its neighbour the day one is inserted.
 *
 * @param id - The level's `id`, as it appears in `skyscraperLevels`.
 * @returns The level with that id.
 * @throws When no level carries the id — a row for a level that no longer
 * exists is a row measuring nothing.
 */
function levelById(id: string): SkyscraperLevel {
  const level = skyscraperLevels.find((candidate) => candidate.id === id);
  if (level === undefined) {
    throw new Error(`no Skyscraper level with id ${id}`);
  }
  return level;
}

/**
 * The repair the demonstrating levels point at: `sky-3`'s shipped starter.
 *
 * Read from the catalogue rather than written out again, so that the program
 * this file certifies as a win is the same text a player is handed. Reading it
 * once at module load is safe in a way it would not be in `skyscraper.ts`: the
 * locale is whatever the suite starts in, and `catalogue.test.ts` holds every
 * `.code` value byte-identical across languages apart from its comments, so
 * there is no language in which this program runs differently.
 */
const SWEEP_CODE = levelById("sky-3").startingCode;

/**
 * The same sweep, taught to skip cars that do not serve the floor calling:
 * `sky-9`'s shipped starter.
 *
 * Read off a level for {@link SWEEP_CODE}'s reason and one more. `sky-9` and
 * `sky-10` open with this program, so the text certified here as the repair for
 * `sky-8` is not merely the same idea as the one they are handed -- it is the
 * same string, and a change to either level's starter that broke the zoning
 * moves a cell in `sky-8`'s row as well as in its own.
 */
const ZONE_SWEEP_CODE = levelById("sky-9").startingCode;

/**
 * Plays one program in one level's building, at the level's own seed, and
 * reports the exact tier it reached.
 *
 * Mirrors the harness `level-tiers-solutions.test.ts` drives its runs with: a
 * real {@link "./world.ts"!World}, a real
 * {@link "./world-controller.ts"!WorldController} at the app's own tick, the
 * condition consulted on every `stats_changed`, and the run stopped at the
 * first non-null verdict.
 *
 * @param level - Supplies the building, the seed, the condition and the tiers.
 * @param code - The program to run.
 * @returns The tier the run reached, or `"lost"` when bronze was not won.
 * @throws When the run is still undecided after {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(level: SkyscraperLevel, code: string): TierOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, level.seed);
  const worldController = createWorldController(TICK_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property on an object, not a plain `let`, for the reason
  // `level-tiers-solutions.test.ts` gives for the same shape: both reads below
  // happen outside the callback that writes it, past where the compiler's flow
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
      `${level.id} was still undecided after ${String(MAX_SIMULATED_SECONDS)} ` +
        `simulated seconds, so this case decides nothing`,
    );
  }
  return evaluateLevelTier(run.verdict, world, level.tiers) ?? "lost";
}

/** One level's recorded outcome for each of the four programs. */
interface SkyscraperCase {
  /** The level this row measures, by `id`. */
  readonly id: string;
  /** What the level's own `startingCode` reached. */
  readonly starter: TierOutcome;
  /** What {@link SWEEP_CODE} reached. */
  readonly sweep: TierOutcome;
  /** What {@link DEV_TEST_CODE} reached. */
  readonly dev: TierOutcome;
  /** What {@link GOOD_CODE_BALANCED} reached. */
  readonly good: TierOutcome;
  /**
   * What {@link ZONE_SWEEP_CODE} reached, on the level where that says something
   * the other four columns cannot.
   *
   * Omitted everywhere else, and omitted rather than repeated: on `sky-9` and
   * `sky-10` it is the `starter` column under another name, and on an unzoned
   * level it is the `sweep` column under another name.
   */
  readonly zone?: TierOutcome;
}

// Recorded by running each case against the real engine at the level's own
// pinned seed and reading off what happened -- not a guess, and not a best or
// worst case, because a pinned seed has neither.
//
// `sky-3` and `sky-5` ship the sweep as their starter, so their `starter` and
// `sweep` cells are the same run twice. Both are still spelled out: the day one
// of them is given a starter of its own, the row that stops agreeing with
// itself is the one that should fail.
//
// `sky-8` is the row with a fifth cell, and it needs one because its `starter`
// and `sweep` cells are both `lost` and both for the same reason -- they are the
// same program. Nothing else in the row would show what repairs the level, and
// "the sweep loses" is a thing this file says about levels whose answer is
// something else entirely. `zone` is the missing half: the same sweep with
// `servedFloors()` in front of the choice, taking bronze where the unfiltered
// one leaves a floor calling into an empty building.
const CASES: readonly SkyscraperCase[] = [
  { id: "sky-1", starter: "lost", sweep: "bronze", dev: "lost", good: "bronze" },
  { id: "sky-2", starter: "lost", sweep: "bronze", dev: "lost", good: "bronze" },
  { id: "sky-3", starter: "silver", sweep: "silver", dev: "lost", good: "gold" },
  { id: "sky-4", starter: "lost", sweep: "bronze", dev: "lost", good: "bronze" },
  { id: "sky-5", starter: "bronze", sweep: "bronze", dev: "lost", good: "gold" },
  { id: "sky-6", starter: "lost", sweep: "bronze", dev: "lost", good: "bronze" },
  { id: "sky-7", starter: "lost", sweep: "gold", dev: "lost", good: "silver" },
  { id: "sky-8", starter: "lost", sweep: "lost", dev: "lost", good: "bronze", zone: "bronze" },
  { id: "sky-9", starter: "bronze", sweep: "lost", dev: "lost", good: "gold" },
  { id: "sky-10", starter: "silver", sweep: "lost", dev: "lost", good: "gold" },
];

describe("the recorded table", () => {
  it("measures every level of the block, in the order they are played", () => {
    // A level added without a row would otherwise be a level with no measured
    // threshold at all, which is the one thing this file exists to prevent.
    expect(CASES.map((testCase) => testCase.id)).toEqual(skyscraperLevels.map((level) => level.id));
  });

  it("records a level that tells its four programs apart", () => {
    // Not a restatement of the rows: a level where all four land on the same
    // tier is a level that measures nothing about the program, and copying a
    // row from its neighbour would pass every other check in this file.
    for (const testCase of CASES) {
      const reached = new Set([testCase.starter, testCase.sweep, testCase.dev, testCase.good]);
      expect(reached.size, `${testCase.id} awards every program the same tier`).toBeGreaterThan(1);
    }
  });
});

for (const testCase of CASES) {
  describe(testCase.id, () => {
    it("awards each measured program exactly the recorded tier", () => {
      const level = levelById(testCase.id);

      expect(playRun(level, level.startingCode), `${testCase.id}, its own startingCode`).toBe(
        testCase.starter,
      );
      expect(playRun(level, SWEEP_CODE), `${testCase.id}, SWEEP_CODE`).toBe(testCase.sweep);
      expect(playRun(level, DEV_TEST_CODE), `${testCase.id}, DEV_TEST_CODE`).toBe(testCase.dev);
      expect(playRun(level, GOOD_CODE_BALANCED), `${testCase.id}, GOOD_CODE_BALANCED`).toBe(
        testCase.good,
      );

      // Only where the row asks for it. Running the zone-aware sweep on every
      // level would cost ten simulations to record two columns of duplicates.
      if (testCase.zone !== undefined) {
        expect(playRun(level, ZONE_SWEEP_CODE), `${testCase.id}, ZONE_SWEEP_CODE`).toBe(
          testCase.zone,
        );
      }
    });
  });
}
