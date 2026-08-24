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
 * **Four programs, chosen for what they disagree about**, and two more on the
 * levels where four are not enough.
 * - The level's own `startingCode`, which is the only one of them a player ever
 *   sees. Sometimes it is the round-robin dispatcher that sends one car to one
 *   call and is meant to lose, sometimes the sweep the level is about improving
 *   on, and on the levels that open with the previous level's answer it is that
 *   answer.
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
 * - {@link DISPATCH_CODE}, the booking dispatcher that also sends the car it
 *   booked, recorded on `sky-11` alone and for the same reason. It is `sky-12`'s
 *   starter, so that level's own row is already that run; in a building with
 *   call buttons it never books anything and never hears the event it is built
 *   on.
 * - {@link NEAREST_CODE}, the same dispatcher choosing the nearest car with room
 *   rather than the next one in turn, recorded on `sky-12` alone. It is
 *   `sky-13`'s starter.
 * - {@link GROUPING_CODE} and {@link BATCHING_CODE}, the two answers the last two
 *   levels are asking for, recorded on those levels. No level ships either --
 *   `sky-13` is the block's last -- so alone among the programs here they are
 *   written out below instead of read off a starter.
 *
 * {@link GOOD_CODE_BALANCED} earns its place twice over. It is not the winner
 * here: it takes gold on `sky-3` and `sky-5` and only silver on `sky-7`, where
 * the plain sweep takes gold, and on `sky-4` it clears the budget by nine moves
 * where the sweep clears it by fifty-three. Both of those are levels whose whole
 * subject is a habit the reference dispatcher happens to have, so a row where it
 * comes second is the level working, not the reference program failing.
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
 * by it would quietly measure its neighbor the day one is inserted.
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
 * Read from the catalog rather than written out again, so that the program
 * this file certifies as a win is the same text a player is handed. Reading it
 * once at module load is safe in a way it would not be in `skyscraper.ts`: the
 * locale is whatever the suite starts in, and `catalog.test.ts` holds every
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
 * Booking and then sending the car that was booked: `sky-12`'s shipped starter.
 *
 * The repair for `sky-11`, read off the level that ships it for
 * {@link ZONE_SWEEP_CODE}'s reason. `sky-11` is the one level of the block where
 * all four standard programs land on the same tier — they all deliver nobody,
 * the starter because it books without sending and the other three because a
 * building with no call buttons never raises the events they listen for — so
 * without this column the row would record a level that measures nothing.
 */
const DISPATCH_CODE = levelById("sky-12").startingCode;

/**
 * The same booking dispatcher sending the nearest car with room rather than the
 * next one in turn: `sky-13`'s shipped starter.
 *
 * Recorded on `sky-12` alone, read off the level that ships it for
 * {@link ZONE_SWEEP_CODE}'s reason. It differs from that level's own starter in
 * one thing only -- which car gets the booking -- so the two cells side by side
 * are the measurement of how much of `sky-12` is the choice of car.
 */
const NEAREST_CODE = levelById("sky-13").startingCode;

/**
 * Booking one car for every journey a floor is waiting on, and weighing what a
 * car already owes against how far away it is.
 *
 * The answer `sky-12` is asking for, and the first program here that treats a
 * floor's book as a whole rather than one line of it at a time: a car sent for
 * somebody going to the eighth floor takes everybody else on that floor going
 * to the eighth floor, at no extra stop and no extra move. `BUSY_PENALTY` is
 * what keeps that from piling the whole building onto whichever car happens to
 * be closest -- three floors of detour is what one stop already promised is
 * worth.
 *
 * Written out here rather than read off a level because no level ships it.
 * `sky-12` is answered by it and `sky-13` opens with the program it beats, so
 * there is nowhere in the game this text could be read from.
 */
const GROUPING_CODE = `{
    init: function(elevators, floors) {
        // How much a stop already booked counts against a car, in floors.
        const BUSY_PENALTY = 3;

        function insertStop(elevator, floorNum) {
            if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
                return;
            }
            const queue = elevator.destinationQueue.slice();
            if (queue.indexOf(floorNum) === -1) {
                queue.push(floorNum);
            }
            const here = elevator.currentFloor();
            queue.sort(function(a, b) {
                return Math.abs(a - here) - Math.abs(b - here);
            });
            elevator.destinationQueue = queue;
            elevator.checkDestinationQueue();
        }

        // Books one car for every journey this floor is waiting on.
        function fill(elevator, floorNum) {
            let taken = false;
            floors[floorNum].pendingDestinations().forEach(function(pending) {
                if (elevator.takeRequest(floorNum, pending.floorNum)) {
                    taken = true;
                }
            });
            if (taken) {
                insertStop(elevator, floorNum);
            }
            return taken;
        }

        function busiestFloor() {
            let best = null;
            let bestWaiting = 0;
            floors.forEach(function(floor) {
                let waiting = 0;
                floor.pendingDestinations().forEach(function(pending) {
                    waiting += pending.waiting;
                });
                if (waiting > bestWaiting) {
                    bestWaiting = waiting;
                    best = floor.floorNum();
                }
            });
            return best;
        }

        function nearestWithRoom(floorNum) {
            let best = null;
            elevators.forEach(function(elevator) {
                if (elevator.loadFactor() > 0.7) {
                    return;
                }
                const cost = elevator.destinationQueue.length * BUSY_PENALTY
                    + Math.abs(elevator.currentFloor() - floorNum);
                if (best === null || cost < best.cost) {
                    best = { elevator: elevator, cost: cost };
                }
            });
            return best === null ? null : best.elevator;
        }

        floors.forEach(function(floor) {
            floor.on("destination_requested", function() {
                const elevator = nearestWithRoom(floor.floorNum());
                if (elevator !== null) {
                    fill(elevator, floor.floorNum());
                }
            });
        });

        elevators.forEach(function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                insertStop(elevator, floorNum);
            });
            elevator.on("stopped_at_floor", function(floorNum) {
                fill(elevator, floorNum);
            });
            elevator.on("idle", function() {
                const floorNum = busiestFloor();
                if (floorNum !== null) {
                    fill(elevator, floorNum);
                } else if (elevator.currentFloor() !== 0) {
                    elevator.goToFloor(0);
                }
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`;

/**
 * Filling one car at the lobby before it is sent anywhere, and sending it up
 * through everything aboard in one sweep.
 *
 * The answer `sky-13` is asking for, and it is {@link GROUPING_CODE} taken one
 * step further: grouping answers a floor's book one arrival at a time, this
 * waits for the book to be worth answering. Two rules do it. One car loads at a
 * time, so a queue of ten does not become four cars carrying two or three each;
 * and the car that is loading keeps its doors open until it is full or until
 * `WINDOW_SECONDS` runs out, so what it leaves with is a group bound for
 * neighboring floors rather than whoever happened to walk in first.
 *
 * Both halves are paid for. A car standing with its doors open is a car not
 * carrying anybody, which is why the window is the number this program would be
 * tuned by, and why `sky-13` asks for an average wait as well as a move budget:
 * shorten the window and the moves come back, lengthen it and somebody is still
 * standing in the lobby when the run ends.
 *
 * Written out here for {@link GROUPING_CODE}'s reason.
 */
const BATCHING_CODE = `{
    init: function(elevators, floors) {
        // Seconds a car holds the lobby before it leaves with what it has.
        const WINDOW_SECONDS = 8;

        // Per car: the lobby journeys it has booked, and how long it has held.
        const booked = elevators.map(function() { return []; });
        const held = elevators.map(function() { return 0; });

        function isBooked(floorNum) {
            return booked.some(function(list) { return list.indexOf(floorNum) !== -1; });
        }

        function room(elevator) {
            return Math.round((1 - elevator.loadFactor()) * elevator.maxPassengerCount());
        }

        // Books every lobby journey that still fits, skipping any another car took.
        function book(elevator, index) {
            let free = room(elevator);
            floors[0].pendingDestinations().forEach(function(pending) {
                if (free <= 0 || isBooked(pending.floorNum)) {
                    return;
                }
                if (elevator.takeRequest(0, pending.floorNum)) {
                    booked[index].push(pending.floorNum);
                    free -= pending.waiting;
                }
            });
        }

        // Sends the car up through everything aboard, lowest floor first.
        function depart(elevator, index) {
            const stops = elevator.getPressedFloors().slice().sort(function(a, b) {
                return a - b;
            });
            booked[index] = [];
            held[index] = 0;
            if (stops.length > 0) {
                elevator.destinationQueue = stops;
                elevator.checkDestinationQueue();
            }
        }

        function waitingAtLobby(elevator) {
            return elevator.destinationQueue.length === 0
                && elevator.currentFloor() === 0
                && elevator.destinationDirection() === "stopped";
        }

        elevators.forEach(function(elevator) {
            elevator.on("idle", function() {
                if (elevator.currentFloor() !== 0) {
                    elevator.goToFloor(0);
                }
            });
        });

        // One car loads at a time, so it fills instead of splitting the queue.
        let loading = -1;
        this.tick = function(dt) {
            if (loading === -1 || !waitingAtLobby(elevators[loading])) {
                loading = -1;
                elevators.forEach(function(elevator, index) {
                    if (loading === -1 && waitingAtLobby(elevator)) {
                        loading = index;
                    }
                });
            }
            if (loading === -1) {
                return;
            }
            const elevator = elevators[loading];
            book(elevator, loading);
            held[loading] += dt;
            if (elevator.loadFactor() >= 0.9 || held[loading] > WINDOW_SECONDS) {
                depart(elevator, loading);
            }
        };
    },
    update: function(dt, elevators, floors) {
        this.tick(dt);
    }
}`;

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
  /**
   * What {@link DISPATCH_CODE} reached, on the level where that says something
   * the other four columns cannot.
   *
   * Omitted everywhere else, for {@link zone}'s reasons: on `sky-12` it is the
   * `starter` column under another name, and in a building with call buttons it
   * is a program that never acts.
   */
  readonly dispatch?: TierOutcome;
  /**
   * What {@link NEAREST_CODE} reached, on `sky-12`, whose silver it is.
   *
   * Omitted everywhere else, for {@link zone}'s reasons: on `sky-13` it is the
   * `starter` column under another name.
   */
  readonly nearest?: TierOutcome;
  /**
   * What {@link GROUPING_CODE} reached.
   *
   * Recorded on the two levels it says something about: `sky-12`, whose gold it
   * is, and `sky-13`, where the program that won the level before is not enough
   * and lands on bronze. Two cells rather than one because the second is what
   * makes the last level a level rather than a bigger copy of the one before.
   */
  readonly group?: TierOutcome;
  /**
   * What {@link BATCHING_CODE} reached, on `sky-13`, whose gold it is.
   *
   * Omitted on `sky-11`, whose lobby nobody ever waits in: a program that books
   * there and nowhere else has nothing to do, and it does nothing -- measured
   * with nobody delivered and not one floor crossed. Omitted on `sky-12` for the
   * ordinary reason instead. There it books, sends, and still loses, spending
   * 134 moves on 45 people under a bar that lets nobody wait eighty seconds, so
   * its cell would be a fourth `lost` in a row that already has three.
   */
  readonly batch?: TierOutcome;
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
// `sky-8` carries a fifth cell, and it needs one because its `starter` and
// `sweep` cells are both `lost` and both for the same reason -- they are the
// same program. Nothing else in the row would show what repairs the level, and
// "the sweep loses" is a thing this file says about levels whose answer is
// something else entirely. `zone` is the missing half: the same sweep with
// `servedFloors()` in front of the choice, taking bronze where the unfiltered
// one leaves a floor calling into an empty building.
//
// `sky-11` carries a sixth for the same argument taken further: all four of its
// standard cells are `lost`, so `dispatch` is the only cell in the row that
// distinguishes a program from a program.
//
// `sky-12` and `sky-13` carry extra cells for a third reason, and it is about
// the thresholds rather than the programs. Three of the four standard cells are
// `lost` on both, so the levels' silver and gold would be bars nothing here ever
// clears -- numbers claimed and never met. The extra columns are the programs
// that meet them, and every rung of both ladders is now a run in this table:
// `sky-12` is bronze by its own starter, silver by the nearest car, gold by
// grouping; `sky-13` is bronze by its own starter and by grouping, gold by
// filling a car before sending it. Nothing lands exactly on `sky-13`'s silver,
// which is the ordinary case here rather than a gap -- `sky-3`, `sky-5`,
// `sky-7`, `sky-9` and `sky-10` each have such a rung too, because a program
// good enough for one rung is usually good enough for the one above it.
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
  { id: "sky-11", starter: "lost", sweep: "lost", dev: "lost", good: "lost", dispatch: "bronze" },
  {
    id: "sky-12",
    starter: "bronze",
    sweep: "lost",
    dev: "lost",
    good: "lost",
    nearest: "silver",
    group: "gold",
  },
  {
    id: "sky-13",
    starter: "bronze",
    sweep: "lost",
    dev: "lost",
    good: "lost",
    group: "bronze",
    batch: "gold",
  },
];

describe("the recorded table", () => {
  it("measures every level of the block, in the order they are played", () => {
    // A level added without a row would otherwise be a level with no measured
    // threshold at all, which is the one thing this file exists to prevent.
    expect(CASES.map((testCase) => testCase.id)).toEqual(skyscraperLevels.map((level) => level.id));
  });

  it("records a level that tells its programs apart", () => {
    // Not a restatement of the rows: a level where every program measured lands
    // on the same tier is a level that measures nothing about the program, and
    // copying a row from its neighbor would pass every other check in this file.
    // The optional columns count too: on `sky-11`, whose four standard cells are
    // all `lost`, they are the whole of what the row distinguishes.
    for (const testCase of CASES) {
      const reached = new Set(
        [
          testCase.starter,
          testCase.sweep,
          testCase.dev,
          testCase.good,
          testCase.zone,
          testCase.dispatch,
          testCase.nearest,
          testCase.group,
          testCase.batch,
        ].filter((tier) => tier !== undefined),
      );
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

      // Only where the row asks for it. Running either specialist on every level
      // would cost simulations to record columns of duplicates.
      if (testCase.zone !== undefined) {
        expect(playRun(level, ZONE_SWEEP_CODE), `${testCase.id}, ZONE_SWEEP_CODE`).toBe(
          testCase.zone,
        );
      }
      if (testCase.dispatch !== undefined) {
        expect(playRun(level, DISPATCH_CODE), `${testCase.id}, DISPATCH_CODE`).toBe(
          testCase.dispatch,
        );
      }
      if (testCase.nearest !== undefined) {
        expect(playRun(level, NEAREST_CODE), `${testCase.id}, NEAREST_CODE`).toBe(testCase.nearest);
      }
      if (testCase.group !== undefined) {
        expect(playRun(level, GROUPING_CODE), `${testCase.id}, GROUPING_CODE`).toBe(testCase.group);
      }
      if (testCase.batch !== undefined) {
        expect(playRun(level, BATCHING_CODE), `${testCase.id}, BATCHING_CODE`).toBe(testCase.batch);
      }
    });
  });
}
