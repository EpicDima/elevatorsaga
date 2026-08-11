/**
 * The claim the whole learning track rests on, measured rather than asserted:
 * every task's answer wins, and every task's starting code loses wherever a
 * threshold exists that can make it lose — see {@link STARTING_CODE_WINS} for
 * the one place none does.
 *
 * A task in {@link "./tutorial.ts"!tutorialTasks} is a promise about the
 * simulation — "this mistake cannot pass, this fix can" — and nothing but the
 * simulation can keep it. Spawn timing, elevator acceleration, boarding, the
 * wait clock and the thresholds in {@link "./challenges.ts"!challenges} all
 * feed into it, and every one of them is somebody's legitimate next commit. The
 * failure this file exists to catch is quiet: the physics shifts by a few
 * percent, a task the player is told is impossible starts passing, and the only
 * symptom is that the lesson has become a lie. Nothing else in the suite would
 * notice.
 *
 * **The harness is the application, not the benchmark.** Each run is a real
 * {@link "./world.ts"!World} at the real seed, driven by a real
 * {@link "./world-controller.ts"!WorldController} at the step `src/main.ts`
 * uses, through a real {@link "./frame-requester.ts"!createFrameRequester}, with
 * the condition evaluated on every `stats_changed` and the run stopped at the
 * first non-null verdict — which is `App.#startRun`, line for line. The fitness
 * benchmark in {@link "./fitness.ts"!fitnessSuite} would have been the shorter
 * road and the wrong one: it runs a fixed number of seconds and never consults
 * a condition, so it can say how well a program did but not whether it won, and
 * "did it win" is the entire question here.
 *
 * **Ten seeds, not one.** A task proven on its pinned seed alone is a task
 * proven against one stream of passengers; the pin exists so the player's run is
 * reproducible, not so the measurement can be cheap. The other nine are the
 * plan's: `1`–`6` and three that exercise the string half of
 * {@link "./random.ts"!RandomSeed}. The whole file is some 330 runs of at most a
 * few simulated minutes each and takes well under a second, so there is nothing
 * to be saved by trimming the list.
 *
 * **With margin.** A task whose answer scrapes past with three seconds to spare
 * is a task that will break, and it should be retuned now rather than discovered
 * later, so the margin is asserted rather than left to the next reader to
 * measure. {@link judgeWithClockShift} explains how that is done without this
 * file having to know what any particular threshold is.
 */

import { describe, expect, it } from "vitest";

import type { ChallengeCondition, ChallengeWorldStats } from "./challenges.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { tutorialTasks, type TutorialTask } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorldController } from "./world-controller.ts";
import { createWorld } from "./world.ts";

/** Largest simulated step the world is advanced by at once; `src/main.ts`'s value. */
const SIMULATION_STEP_SECONDS = 1.0 / 60.0;

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/**
 * Simulated seconds after which an undecided run is called a broken task.
 *
 * Not a time limit on the tasks — every condition here resolves on its own well
 * inside it — but a bound on the loop that drives them: a condition that never
 * resolves would otherwise spin the test runner for good, with no output, which
 * is the least debuggable way for a suite to fail.
 */
const MAX_SIMULATED_SECONDS = 240.0;

/**
 * The seeds every task is measured on, besides its own.
 *
 * Six numbers and three strings, because {@link RandomSeed} accepts both and
 * they take different paths into the generator: a number is hashed as its
 * decimal spelling, a string as itself.
 */
const EXTRA_SEEDS: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6, "abc", "xyz", "42a"];

/**
 * Seconds of margin a task is required to hold, on both sides.
 *
 * Three is not a derived number; it is roughly a fifth of the shortest budget
 * any task is judged on, which is enough that a physics change big enough to
 * cross it is a change somebody meant to make. The measured margins are far
 * wider — the tightest of the seven ordinary tasks is task 6, which clears by
 * 11.33 seconds on seed 5, and task 7 is next at 11.75 on seed 4 — so this
 * bound is a tripwire, not a target.
 *
 * It said 6.6 seconds until that was re-measured and found to belong to nothing
 * in the file: it was task 5's worst margin back when its wait limit was 26
 * (6.55 seconds on seed 3), and the limit moved to 37 without the sentence
 * following it. Quoted with the task and the seed now, because a bare number
 * here is exactly what went stale — a margin no longer attached to the run that
 * produced it cannot be re-checked, only believed.
 */
const MARGIN_SECONDS = 3.0;

/**
 * The margin task 8 is held to instead, and the reason it is smaller.
 *
 * Task 8 is played in challenge 1's building because being challenge 1 is the
 * point of it — the graduation task is the game's own first challenge — and at
 * 0.3 passengers a second the fifteenth passenger does not exist before about
 * 46.7 seconds of the 60 available. The slack is arithmetic, not programming:
 * no program can widen it, and every way of widening the building widens it by
 * no longer being challenge 1. The answer clears by 1.8 seconds on its slowest
 * measured seed, so the bar is set just under that, and the smallness is
 * recorded here rather than hidden by lowering the bound for all eight.
 */
const TIGHT_MARGIN_SECONDS = 1.5;

/** Tasks whose margin is structurally limited; see {@link TIGHT_MARGIN_SECONDS}. */
const TIGHT_MARGIN_TASK_IDS: ReadonlySet<string> = new Set(["tutorial-8"]);

/**
 * A clock shift no condition built on time or waiting can ignore.
 *
 * Used to prove the margin assertions are still assertions; see the test that
 * spends it.
 */
const ABSURD_SHIFT_SECONDS = 1000.0;

/**
 * Seeds on which a task's starting code is measured to *win*, by task.
 *
 * Task 5 is the only entry, and it is the only task that could have one: it is
 * judged on waiting rather than on throughput, and on four hundred seeds the
 * ranges overlap. The nine-floor sweep's best run delivers all fifteen having
 * made nobody wait longer than 25.03 s, while the answer's worst makes somebody
 * wait 35.88 s, so no wait limit both accepts every answer and rejects every
 * sweep — the task's own entry in {@link "./tutorial.ts"!tutorialTasks} works
 * through the numbers. Its limit of 37 is the end of that trade the track
 * chose: never reject the answer, and let the sweep through on the seeds where
 * it happens to do well. `42a` is such a seed — 15 delivered, worst wait
 * 32.28 s — and the pinned seed, the only one anybody plays, is not.
 *
 * Recorded rather than tolerated, because `toBe(true)` here is as strict as the
 * `toBe(false)` it replaces: if the sweep stops winning this seed, or starts
 * winning another, this file says so and somebody looks at why. It serves the
 * margin test too, since grace can only ever turn a loss into a win.
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
 * Judges a world's statistics with both clocks moved by a fixed amount.
 *
 * The trick this file's margin assertions rest on. A condition is a black box —
 * `evaluate` is all there is, and the threshold inside it is not readable — so
 * "won with three seconds to spare" cannot be computed by comparing numbers.
 * Shifting the clocks measures it instead, and does so for any condition built
 * out of elapsed time or waiting time, without knowing which of the two it uses
 * or what it compares against.
 *
 * Both directions are sound, and both are one-way:
 *
 * - **Stricter (`shift > 0`).** The run is judged as though it were `shift`
 *   seconds further along than it is. If it still wins, then it reached the
 *   required count while the true clock read at most `limit - shift`, and the
 *   longest true wait was at most `limit - shift` — so it also wins unshifted,
 *   with `shift` seconds in hand.
 * - **More lenient (`shift < 0`).** The run is given `|shift|` extra seconds
 *   before the clocks are believed. If it still loses, the count was not reached
 *   even by `limit + |shift|`, so it loses unshifted too.
 *
 * The tests therefore assert something strictly stronger than "the answer wins
 * and the starting code loses", and the plain statement follows.
 *
 * @param condition - The bar being applied.
 * @param stats - The world's true statistics.
 * @param shiftSeconds - Added to both clocks; positive is harsher.
 * @returns The verdict, or `null` while undecided.
 */
function judgeWithClockShift(
  condition: ChallengeCondition,
  stats: ChallengeWorldStats,
  shiftSeconds: number,
): boolean | null {
  return condition.evaluate({
    // Clamped at zero because a negative clock is not a lenient world, it is a
    // nonsensical one, and `requireUserCountWithMaxWaitTime` would read it as a
    // run in which nobody has ever waited.
    elapsedTime: Math.max(0, stats.elapsedTime + shiftSeconds),
    transportedCounter: stats.transportedCounter,
    maxWaitTime: Math.max(0, stats.maxWaitTime + shiftSeconds),
    moveCount: stats.moveCount,
  });
}

/**
 * Plays one program in one task's building on one seed, and reports the verdict.
 *
 * @param task - The task supplying the building, the bar and the seed's role.
 * @param code - The player program to run, as the player would be given it.
 * @param seed - The passengers to run against.
 * @param shiftSeconds - Handicap applied to both clocks; see
 * {@link judgeWithClockShift}. Zero plays the task exactly as the player does.
 * @returns What the run came to.
 * @throws When the program throws, or when the run reaches
 * {@link MAX_SIMULATED_SECONDS} undecided.
 */
function playTask(
  task: TutorialTask,
  code: string,
  seed: RandomSeed,
  shiftSeconds: number,
): RunOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(task.options, seed);
  const worldController = createWorldController(SIMULATION_STEP_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // One object rather than two `let` bindings: both are written from inside
  // callbacks, which the compiler's flow analysis does not follow, so a plain
  // local would still be narrowed to `null` at the loop below and the comparison
  // reported as constant. A property read cannot be narrowed across the calls
  // that drive the run, which is exactly the honesty wanted here.
  const run: { verdict: boolean | null; userCodeError: unknown } = {
    verdict: null,
    userCodeError: null,
  };

  // A program that throws is neither a win nor a loss, and silently reading it
  // as a loss is how a task could keep "passing" on a broken answer: the
  // controller pauses the world and the run would simply stop advancing.
  worldController.on("usercode_error", (e) => {
    run.userCodeError ??= e;
  });

  world.on("stats_changed", () => {
    if (run.verdict !== null) {
      return;
    }
    const status = judgeWithClockShift(task.condition, world, shiftSeconds);
    if (status === null) {
      return;
    }
    run.verdict = status;
    // Exactly what the app does when a challenge resolves: freeze the world so
    // nothing after the deciding moment can change the numbers being read.
    world.challengeEnded = true;
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
    throw new Error(`${task.id}: the program threw at seed ${String(seed)}`, {
      cause: run.userCodeError,
    });
  }
  if (run.verdict === null) {
    throw new Error(
      `${task.id}: the run was still undecided after ${String(MAX_SIMULATED_SECONDS)} ` +
        `simulated seconds at seed ${String(seed)}, so the task decides nothing`,
    );
  }
  return {
    verdict: run.verdict,
    elapsedTime: world.elapsedTime,
    transportedCounter: world.transportedCounter,
    maxWaitTime: world.maxWaitTime,
  };
}

/**
 * Every seed a task is measured on: its own first, then the shared nine.
 *
 * @param task - The task.
 * @returns The seeds.
 */
function seedsFor(task: TutorialTask): readonly RandomSeed[] {
  return [task.seed, ...EXTRA_SEEDS];
}

/**
 * The margin a task is required to clear by.
 *
 * @param task - The task.
 * @returns Seconds of margin.
 */
function marginFor(task: TutorialTask): number {
  return TIGHT_MARGIN_TASK_IDS.has(task.id) ? TIGHT_MARGIN_SECONDS : MARGIN_SECONDS;
}

/**
 * The verdict the starting code was measured to reach on a seed.
 *
 * @param task - The task.
 * @param seed - The seed being played.
 * @returns `true` where the win is recorded in {@link STARTING_CODE_WINS}.
 */
function startingCodeWins(task: TutorialTask, seed: RandomSeed): boolean {
  return STARTING_CODE_WINS.get(task.id)?.has(String(seed)) ?? false;
}

/**
 * A run, spelled out for a failure message.
 *
 * The numbers are the ones needed to retune the task without re-running
 * anything: whoever reads this failure wants to know how far off it was, not
 * merely that it was.
 *
 * @param seed - The seed the run used.
 * @param outcome - What the run came to.
 * @returns A one-line description.
 */
function describeRun(seed: RandomSeed, outcome: RunOutcome): string {
  return (
    `seed ${String(seed)}: decided at ${outcome.elapsedTime.toFixed(1)}s ` +
    `with ${String(outcome.transportedCounter)} delivered ` +
    `and a worst wait of ${outcome.maxWaitTime.toFixed(1)}s`
  );
}

for (const task of tutorialTasks) {
  describe(`Learning track task ${task.id}`, () => {
    it("cannot be passed by the program the player is given, except where recorded", () => {
      for (const seed of seedsFor(task)) {
        const outcome = playTask(task, task.startingCode, seed, 0);
        const recorded = startingCodeWins(task, seed);
        expect(
          outcome.verdict,
          recorded
            ? `${task.id} starting code no longer wins a seed it is recorded as winning, so ` +
                `STARTING_CODE_WINS is out of date — ${describeRun(seed, outcome)}`
            : `${task.id} starting code unexpectedly won — ${describeRun(seed, outcome)}`,
        ).toBe(recorded);
      }
    });

    it("is passed by the reference answer", () => {
      for (const seed of seedsFor(task)) {
        const outcome = playTask(task, task.solutionCode, seed, 0);
        expect(
          outcome.verdict,
          `${task.id} answer unexpectedly lost — ${describeRun(seed, outcome)}`,
        ).toBe(true);
      }
    });

    it("cannot be passed by the starting code with seconds to spare, except where recorded", () => {
      // The starting code losing by a hair would mean the task teaches by
      // accident: a slightly faster elevator, or a seed nobody measured, and the
      // mistake starts passing.
      const margin = marginFor(task);
      for (const seed of seedsFor(task)) {
        const outcome = playTask(task, task.startingCode, seed, -margin);
        const recorded = startingCodeWins(task, seed);
        expect(
          outcome.verdict,
          recorded
            ? `${task.id} starting code no longer wins a seed it is recorded as winning, and ` +
                `grace cannot take a win away — ${describeRun(seed, outcome)}`
            : `${task.id} starting code won when given ${String(margin)}s of grace — ` +
                describeRun(seed, outcome),
        ).toBe(recorded);
      }
    });

    it("is passed by the reference answer with seconds to spare", () => {
      const margin = marginFor(task);
      for (const seed of seedsFor(task)) {
        const outcome = playTask(task, task.solutionCode, seed, margin);
        expect(
          outcome.verdict,
          `${task.id} answer had less than ${String(margin)}s of margin — ` +
            describeRun(seed, outcome),
        ).toBe(true);
      }
    });

    it("is judged by a bar the margin can actually move", () => {
      // Guards the two tests above from quietly becoming duplicates of the two
      // before them. They measure margin by shifting the clocks, which does
      // nothing to a condition that reads neither of them --
      // `requireUserCountWithinMoves` is one, and it is as plausible a bar for a
      // future task as any. Were that to happen the margin tests would still
      // pass, and would be measuring nothing at all. A shift no threshold on
      // either clock can survive has to lose; if it wins, the shift is inert.
      const outcome = playTask(task, task.solutionCode, task.seed, ABSURD_SHIFT_SECONDS);
      expect(
        outcome.verdict,
        `${task.id}: the answer still won with ${String(ABSURD_SHIFT_SECONDS)}s added to both ` +
          `clocks, so this task's condition ignores them and its margin is unmeasured`,
      ).toBe(false);
    });
  });
}
