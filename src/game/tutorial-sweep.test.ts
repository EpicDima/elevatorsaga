/**
 * The tail `tutorial-solutions.test.ts` cannot see: four hundred seeds, and the
 * win counts written down to the run.
 *
 * Ten seeds decide whether a task works. They cannot decide how *often* it
 * works, and for the two tasks judged on waiting that is the number that
 * matters: task 5's limit was 26 for as long as it was measured on ten seeds,
 * and on four hundred it rejected the task's own answer twenty-two times, a
 * player in eighteen being told their correct program had failed. Nothing in
 * the fast suite noticed, because on its ten seeds the answer clears 26 with
 * eleven seconds to spare. A distribution is what was wrong, so a distribution
 * is what is asserted here.
 *
 * **Exact counts, not bounds.** `toBe(76)` rather than `toBeLessThan(100)`,
 * everywhere, including the count that is not 400. An improvement is as much a
 * report of a changed engine as a regression is, and a bound would swallow it —
 * a sweep that suddenly wins twice as often has learnt nothing, the physics has
 * moved, and this file exists to be the place that says so. The cost is that
 * these numbers have to be re-measured whenever the simulation legitimately
 * changes, which is the intended cost.
 *
 * **These four hundred are not evidence, they are a tripwire.** `t0`…`t199` and
 * `u0`…`u199` were unseen while `docs/tutorial-plan.md` fitted the thresholds on
 * `s0`…`s199` — but tasks 5 and 6 were then re-tuned against these very seeds,
 * so their counts below are in-sample and prove nothing about a limit's
 * generality. The out-of-sample check for the two limits that moved is `v0`…
 * `v199` and `w0`…`w199`, quoted where they were spent, in the table in
 * {@link "./tutorial.ts"!tutorialTasks}. What this file guarantees is narrower
 * and still worth having: these programs, on these seeds, still come out to
 * these numbers.
 *
 * **Its own loop, not the fast suite's.** The harness below is that file's
 * `playTask` with the clock shifting taken out, deliberately: the slow run
 * asserts nothing about margin. Task 8's margin on its worst win is under a
 * second and on seed `t165` it is negative, so a margin assertion over four
 * hundred seeds could only be either vacuous or false. Margin is a thing the
 * ten seeds check, where it is meaningful; a verdict is the only thing that
 * survives being counted.
 *
 * Three tasks of the eight, and the three are not arbitrary: 5 and 6 are the
 * only ones whose bar measures a maximum rather than a sum, which is what gives
 * them a tail to hide in, and 8 is the only one whose answer genuinely loses a
 * seed. The other five are decided by delivery counts with margins the ten
 * seeds measure honestly. About 3200 runs and some two seconds, which is inside
 * what this suite already spends, so it is not put behind a flag: a test that
 * runs on request is a test that runs after the breakage has shipped.
 */

import { describe, expect, it } from "vitest";

import { challenges, type ChallengeCondition } from "./challenges.ts";
import { createFrameRequester } from "./frame-requester.ts";
import type { RandomSeed } from "./random.ts";
import { tutorialTasks, type TutorialTask } from "./tutorial.ts";
import { getCodeObjFromCode } from "./user-code.ts";
import { createWorldController } from "./world-controller.ts";
import { createWorld, type WorldOptions } from "./world.ts";

/** Largest simulated step the world is advanced by at once; `src/main.ts`'s value. */
const SIMULATION_STEP_SECONDS = 1.0 / 60.0;

/** Milliseconds per frame, at the rate most displays run at. */
const FRAME_MILLISECONDS = 1000.0 / 60.0;

/** Simulated seconds after which an undecided run is called a broken task. */
const MAX_SIMULATED_SECONDS = 240.0;

/** Seeds per named set. */
const SET_SIZE = 200;

/**
 * The four hundred seeds every count below is over, in order.
 *
 * Generated rather than listed because the generator *is* the definition — two
 * prefixes and a counter, which is what `docs/tutorial-plan.md` measured and
 * what anybody re-measuring has to reproduce exactly. Strings rather than
 * numbers so they take the string path into
 * {@link "./random.ts"!createRandomSource}, and two prefixes rather than one
 * because `t0`…`t399` would be one set where the plan spent two.
 */
const SWEEP_SEEDS: readonly RandomSeed[] = ["t", "u"].flatMap((prefix) =>
  Array.from({ length: SET_SIZE }, (_unused, index) => `${prefix}${String(index)}`),
);

/**
 * A three-floor sweep: the dumbest program that could be called a solution.
 *
 * Here rather than in the task table because no player is ever shown it. It is
 * evidence about task 8's *building* — see the test that spends it — and the
 * table is for the two programs the task is played with.
 */
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
 *
 * `App.#startRun` line for line, as the fast suite's harness is: a real world at
 * the real seed, a real controller at the real step, the condition consulted on
 * every `stats_changed` and the world frozen at the first verdict.
 *
 * @param options - The building.
 * @param condition - The bar.
 * @param code - The player program.
 * @param seed - The passengers.
 * @returns `true` when the run was won.
 * @throws When the program throws, or the run is undecided after
 * {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(
  options: WorldOptions,
  condition: ChallengeCondition,
  code: string,
  seed: RandomSeed,
): boolean {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(options, seed);
  const worldController = createWorldController(SIMULATION_STEP_SECONDS);
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property rather than two locals, for the reason the fast suite's harness
  // gives: these are written from inside callbacks the compiler's flow analysis
  // does not follow, and a local would be narrowed to `null` at the loop below.
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
function sweep(options: WorldOptions, condition: ChallengeCondition, code: string): SweepResult {
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
 * The task with this identifier.
 *
 * @param id - The identifier.
 * @returns The task.
 * @throws When the track has no such task.
 */
function taskById(id: string): TutorialTask {
  const task = tutorialTasks.find((candidate) => candidate.id === id);
  if (task === undefined) {
    throw new Error(`the learning track has no task ${id}`);
  }
  return task;
}

/**
 * A run count, with the seeds that lost it named.
 *
 * Failure messages here are read by somebody deciding whether a number moved
 * for a good reason, and the count alone does not tell them: 399 with a
 * different seed lost is a different event from 398.
 *
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

describe("Learning track task tutorial-5 over four hundred seeds", () => {
  const task = taskById("tutorial-5");

  it("never rejects its own answer", () => {
    // The whole reason the limit is 37. At 26 this was 378, and the twenty-two
    // it lost are the failure a learner cannot debug: the program they were
    // shown as the answer, failing. Seed t61 was the worst of them, stopping
    // the correct program at 7 of the 15 delivered.
    const result = sweep(task.options, task.condition, task.solutionCode);
    expect(result.wins, describeSweep("tutorial-5 answer", result)).toBe(400);
  });

  it("is passed by the nine-floor sweep on the seeds that suit it, and no others", () => {
    // The price of the sentence above, paid knowingly: at 26 the sweep won one
    // of the four hundred, and at 37 it wins 76. No limit avoids both errors —
    // the sweep's best run leaves nobody waiting longer than 25.03 s while the
    // answer's worst leaves somebody waiting 35.88 s — so the count is written
    // down rather than wished away. It rising is not automatically a bug; it
    // moving at all is something to look at.
    const result = sweep(task.options, task.condition, task.startingCode);
    expect(result.wins, describeSweep("tutorial-5 starting code", result)).toBe(76);
  });
});

describe("Learning track task tutorial-6 over four hundred seeds", () => {
  const task = taskById("tutorial-6");

  it("never rejects its own answer", () => {
    // At the old limit of 25 this was 399: seed u59 threw out the correct
    // program with 14 of the 15 delivered and a worst wait of 25.02 s. The ten
    // fixed seeds could not see it and cannot see it now, which is what this
    // file is for.
    const result = sweep(task.options, task.condition, task.solutionCode);
    expect(result.wins, describeSweep("tutorial-6 answer", result)).toBe(400);
  });

  it("is passed by the lying indicators three times in four hundred", () => {
    // Three, at every limit from 26 to 30 — the same three seeds throughout,
    // which is what made 28 a shelf to stand in the middle of rather than a
    // point to balance on.
    const result = sweep(task.options, task.condition, task.startingCode);
    expect(result.wins, describeSweep("tutorial-6 starting code", result)).toBe(3);
  });
});

describe("Learning track task tutorial-8 over four hundred seeds", () => {
  const task = taskById("tutorial-8");

  it("loses one seed with its own answer, and it is challenge 1 that loses it", () => {
    // 399, and the missing one is not a defect of the task. At 0.3 passengers a
    // second the fifteenth does not exist before t ≈ 46.7 s of the 60 available,
    // and on seed t165 the answer has 14 out by the bar with the last arriving
    // some ten seconds later. This is the number to leave alone: task 8's
    // building and bar are challenge 1's, deliberately and by identity, so
    // anything that would lift 399 to 400 does it by making the graduation task
    // no longer the game's own first challenge — which is the one thing it is
    // for. The next test makes that concrete rather than asserting it.
    const result = sweep(task.options, task.condition, task.solutionCode);
    expect(result.wins, describeSweep("tutorial-8 answer", result)).toBe(399);
    expect(result.losingSeeds).toEqual(["t165"]);
  });

  it("loses exactly that seed when the same program is played as challenge 1", () => {
    // The claim above, measured: the same answer, over the same four hundred
    // seeds, in the building and against the bar taken from challenges.ts
    // rather than from the task table. Same 399, same seed. A future editor who
    // "fixes" task 8 will find they have only moved it away from the challenge
    // it is meant to rehearse.
    const challenge = challenges[0];
    if (challenge === undefined) {
      throw new Error("the game has no challenges");
    }
    const result = sweep(challenge.options, challenge.condition, task.solutionCode);
    expect(result.wins, describeSweep("challenge 1 with task 8's answer", result)).toBe(399);
    expect(result.losingSeeds).toEqual(["t165"]);
  });

  it("is not passed once by the empty program the player is given", () => {
    // The other end of the track's widest gap: an empty `init` moves nothing,
    // so no seed and no budget can rescue it.
    const result = sweep(task.options, task.condition, task.startingCode);
    expect(result.wins, describeSweep("tutorial-8 starting code", result)).toBe(0);
  });

  it("is passed on every seed by a program that only sweeps the three floors", () => {
    // Where the missing seed really lives. A car that drives 0-1-2 for ever,
    // knowing nothing about who is waiting, wins all four hundred on this
    // building — including t165 — while the answer wins 399. The bar is low
    // enough that being *thorough* beats being *responsive* here, which is a
    // fact about challenge 1's building rather than about either program, and
    // it is the reason task 8 is a rehearsal rather than a lesson: the thing it
    // teaches is that the player can now write the answer unaided.
    const result = sweep(task.options, task.condition, BLIND_SWEEP);
    expect(result.wins, describeSweep("a blind three-floor sweep", result)).toBe(400);
  });
});
