/** Proves each learning-track level's answer wins and its starting code loses, across seeds and locales. */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, setLocale, type Locale } from "../i18n/index.ts";
import type { LevelCondition, LevelWorldStats } from "./levels.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { tutorialLevels, type TutorialLevel } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld } from "./world.ts";

afterEach(() => {
  // Resets the locale so later specs don't inherit whichever language ran last.
  setLocale(DEFAULT_LOCALE);
});

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/** Simulated seconds after which an undecided run is treated as broken, so a stuck test fails loudly. */
const MAX_SIMULATED_SECONDS = 240.0;

/** The seeds every level is measured on, besides its own: numbers and strings both, since each hashes differently into the generator. */
const EXTRA_SEEDS: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6, "abc", "xyz", "42a"];

/** Seconds of margin a level is required to clear by, in both directions: a tripwire, not a tight bound. */
const MARGIN_SECONDS = 3.0;

/**
 * The smaller margin level 8 is held to instead of {@link MARGIN_SECONDS}.
 * Level 8 replays level 1's building, whose passenger rate leaves little slack before the timer runs out; no program can widen it.
 */
const TIGHT_MARGIN_SECONDS = 1.5;

/** Levels held to {@link TIGHT_MARGIN_SECONDS} instead of the usual margin. */
const TIGHT_MARGIN_LEVEL_IDS: ReadonlySet<string> = new Set(["tutorial-8"]);

/** A clock shift large enough that no time- or wait-based condition can ignore it. */
const ABSURD_SHIFT_SECONDS = 1000.0;

/**
 * Seeds on which a level's starting code is measured to win, by level id.
 * Only tutorial-5 has an entry: it grades on waiting time rather than throughput, and on some seeds the starting sweep happens to clear the wait limit.
 */
const STARTING_CODE_WINS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["tutorial-5", new Set(["42a"])],
]);

/** What one run came to. */
interface RunOutcome {
  /** The condition's verdict: `true` won, `false` lost. */
  readonly verdict: boolean;
  /** Simulated seconds at the moment it was decided. */
  readonly elapsedTime: number;
  /** Passengers delivered by then. */
  readonly transportedCounter: number;
  /** Longest anyone had waited by then. */
  readonly maxWaitTime: number;
}

/**
 * Judges a world's statistics with both clocks shifted by a fixed amount, to measure margin without reading the condition's own threshold.
 * @param condition - The bar being applied.
 * @param stats - The world's true statistics.
 * @param shiftSeconds - Added to both clocks; positive is harsher.
 * @returns The verdict, or `null` while undecided.
 */
function judgeWithClockShift(
  condition: LevelCondition,
  stats: LevelWorldStats,
  shiftSeconds: number,
): boolean | null {
  return condition.evaluate({
    // Only the two clocks are shifted; other fields pass through unchanged.
    ...stats,
    // Clamped at zero: a negative clock would read as nobody ever having waited.
    elapsedTime: Math.max(0, stats.elapsedTime + shiftSeconds),
    maxWaitTime: Math.max(0, stats.maxWaitTime + shiftSeconds),
  });
}

/**
 * Plays one program in one level's building on one seed, and reports the verdict.
 * @param level - The level supplying the building, the bar, and the seed's role.
 * @param code - The player program to run.
 * @param seed - The passengers to run against.
 * @param shiftSeconds - Handicap applied to both clocks; zero plays the level as the player does.
 * @param locale - The language `code` was read in, used only in failure messages.
 * @returns What the run came to.
 * @throws When the program throws, or the run never resolves.
 */
function playLevel(
  level: TutorialLevel,
  code: string,
  seed: RandomSeed,
  shiftSeconds: number,
  locale: Locale,
): RunOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, seed);
  const worldController = createWorldController(TICK_SECONDS);
  // Nothing draws these runs; the verdict comes from `stats_changed`.
  worldController.updatesDisplay = false;
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property, not two `let` bindings: both are written inside callbacks the
  // compiler's flow analysis doesn't follow, so a plain local would still be
  // narrowed to `null` here.
  const run: { verdict: boolean | null; userCodeError: unknown } = {
    verdict: null,
    userCodeError: null,
  };

  // A throw is neither a win nor a loss; reading it as a loss would let a
  // level "pass" on a broken answer.
  worldController.on("usercode_error", (e) => {
    run.userCodeError ??= e;
  });

  world.on("stats_changed", () => {
    if (run.verdict !== null) {
      return;
    }
    const status = judgeWithClockShift(level.condition, world, shiftSeconds);
    if (status === null) {
      return;
    }
    run.verdict = status;
    // What the app itself does when a level resolves, so later ticks can't change the numbers being read.
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
    throw new Error(`${level.id}: the ${locale} program threw at seed ${String(seed)}`, {
      cause: run.userCodeError,
    });
  }
  if (run.verdict === null) {
    throw new Error(
      `${level.id}: the ${locale} run was still undecided after ` +
        `${String(MAX_SIMULATED_SECONDS)} simulated seconds at seed ${String(seed)}, ` +
        `so the level decides nothing`,
    );
  }
  return {
    verdict: run.verdict,
    elapsedTime: world.elapsedTime,
    transportedCounter: world.transportedCounter,
    maxWaitTime: world.maxWaitTime,
  };
}

/** Every seed a level is measured on: its own seed first, then the shared extras. */
function seedsFor(level: TutorialLevel): readonly RandomSeed[] {
  return [level.seed, ...EXTRA_SEEDS];
}

/** The margin a level is required to clear by. */
function marginFor(level: TutorialLevel): number {
  return TIGHT_MARGIN_LEVEL_IDS.has(level.id) ? TIGHT_MARGIN_SECONDS : MARGIN_SECONDS;
}

/** Whether this level's starting code is recorded as winning on this seed. */
function startingCodeWins(level: TutorialLevel, seed: RandomSeed): boolean {
  return STARTING_CODE_WINS.get(level.id)?.has(String(seed)) ?? false;
}

/**
 * A run, spelled out for a failure message.
 * A level that fails in one language but not another points to a translation bug, not a level that needs retuning.
 */
function describeRun(locale: Locale, seed: RandomSeed, outcome: RunOutcome): string {
  return (
    `${locale}, seed ${String(seed)}: decided at ${outcome.elapsedTime.toFixed(1)}s ` +
    `with ${String(outcome.transportedCounter)} delivered ` +
    `and a worst wait of ${outcome.maxWaitTime.toFixed(1)}s`
  );
}

for (const level of tutorialLevels) {
  describe(`Learning track level ${level.id}`, () => {
    it("cannot be passed by the program the player is given, except where recorded, in every language", () => {
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const seed of seedsFor(level)) {
          const outcome = playLevel(level, level.startingCode, seed, 0, locale);
          const recorded = startingCodeWins(level, seed);
          expect(
            outcome.verdict,
            recorded
              ? `${level.id} starting code no longer wins a seed it is recorded as winning, so ` +
                  `STARTING_CODE_WINS is out of date — ${describeRun(locale, seed, outcome)}`
              : `${level.id} starting code unexpectedly won — ${describeRun(locale, seed, outcome)}`,
          ).toBe(recorded);
        }
      }
    });

    it("is passed by the reference answer, in every language", () => {
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const seed of seedsFor(level)) {
          const outcome = playLevel(level, level.solutionCode, seed, 0, locale);
          expect(
            outcome.verdict,
            `${level.id} answer unexpectedly lost — ${describeRun(locale, seed, outcome)}`,
          ).toBe(true);
        }
      }
    });

    it("cannot be passed by the starting code with seconds to spare, except where recorded, in every language", () => {
      // A near-miss loss here would mean the level teaches by accident: a
      // slightly faster elevator or an unmeasured seed, and the mistake starts passing.
      const margin = marginFor(level);
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const seed of seedsFor(level)) {
          const outcome = playLevel(level, level.startingCode, seed, -margin, locale);
          const recorded = startingCodeWins(level, seed);
          expect(
            outcome.verdict,
            recorded
              ? `${level.id} starting code no longer wins a seed it is recorded as winning, and ` +
                  `grace cannot take a win away — ${describeRun(locale, seed, outcome)}`
              : `${level.id} starting code won when given ${String(margin)}s of grace — ` +
                  describeRun(locale, seed, outcome),
          ).toBe(recorded);
        }
      }
    });

    it("is passed by the reference answer with seconds to spare, in every language", () => {
      const margin = marginFor(level);
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const seed of seedsFor(level)) {
          const outcome = playLevel(level, level.solutionCode, seed, margin, locale);
          expect(
            outcome.verdict,
            `${level.id} answer had less than ${String(margin)}s of margin — ` +
              describeRun(locale, seed, outcome),
          ).toBe(true);
        }
      }
    });

    it("is judged by a bar the margin can actually move", () => {
      // Guards the margin tests above from silently measuring nothing: a
      // condition that ignores both clocks should still lose to this shift.
      // One language only, since the condition itself doesn't depend on the catalog.
      const outcome = playLevel(
        level,
        level.solutionCode,
        level.seed,
        ABSURD_SHIFT_SECONDS,
        DEFAULT_LOCALE,
      );
      expect(
        outcome.verdict,
        `${level.id}: the answer still won with ${String(ABSURD_SHIFT_SECONDS)}s added to both ` +
          `clocks, so this level's condition ignores them and its margin is unmeasured`,
      ).toBe(false);
    });
  });
}
