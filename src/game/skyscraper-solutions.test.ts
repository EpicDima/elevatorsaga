/**
 * Plays each Skyscraper level, at its own pinned seed, against several
 * reference programs and asserts the exact tier each one reaches.
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

/** Simulated seconds after which an undecided run is treated as broken, so a stuck test fails loudly. */
const MAX_SIMULATED_SECONDS = 2000.0;

/** The tier one run reached; `"lost"` stands in for {@link evaluateLevelTier}'s `null`. */
type TierOutcome = "gold" | "silver" | "bronze" | "lost";

/** Looks up one level of the block by id, not by array position; throws if none matches. */
function levelById(id: string): SkyscraperLevel {
  const level = skyscraperLevels.find((candidate) => candidate.id === id);
  if (level === undefined) {
    throw new Error(`no Skyscraper level with id ${id}`);
  }
  return level;
}

/** The repair every demonstrating level points at: `sky-3`'s shipped starter. */
const SWEEP_CODE = levelById("sky-3").startingCode;

/** The same sweep, taught to skip cars that don't serve the calling floor: `sky-9`'s shipped starter. */
const ZONE_SWEEP_CODE = levelById("sky-9").startingCode;

/** Books and then sends the booked car: `sky-12`'s shipped starter, and the repair for `sky-11`. */
const DISPATCH_CODE = levelById("sky-12").startingCode;

/** The same booking dispatcher sending the nearest car with room instead of the next in turn: `sky-13`'s shipped starter. */
const NEAREST_CODE = levelById("sky-13").startingCode;

/**
 * Books one car for every journey a floor is waiting on, weighing what a car
 * already owes against how far away it is. The answer `sky-12` asks for; no
 * level ships it, so it is written out here instead of read off a starter.
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
 * Fills one car at the lobby, then sends it up through everything aboard in
 * one sweep once it's full or `WINDOW_SECONDS` runs out. The answer `sky-13`
 * asks for; written out here for {@link GROUPING_CODE}'s reason.
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
 * Plays one program in a level's building at its pinned seed.
 * @returns The tier reached, or `"lost"` when the level was never cleared at all.
 * @throws When the run is still undecided after {@link MAX_SIMULATED_SECONDS}.
 */
function playRun(level: SkyscraperLevel, code: string): TierOutcome {
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, level.seed);
  const worldController = createWorldController(TICK_SECONDS);
  // Nothing draws these runs; the verdict comes from `stats_changed`.
  worldController.updatesDisplay = false;
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  // A property, not a plain `let`: both reads below happen outside the
  // callback that writes it, past where flow analysis narrows a local to `null`.
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
  /** What {@link ZONE_SWEEP_CODE} reached, recorded only on `sky-8`. */
  readonly zone?: TierOutcome;
  /** What {@link DISPATCH_CODE} reached, recorded only on `sky-11`. */
  readonly dispatch?: TierOutcome;
  /** What {@link NEAREST_CODE} reached, recorded only on `sky-12`. */
  readonly nearest?: TierOutcome;
  /** What {@link GROUPING_CODE} reached, recorded on `sky-12` and `sky-13`. */
  readonly group?: TierOutcome;
  /** What {@link BATCHING_CODE} reached, recorded only on `sky-13`. */
  readonly batch?: TierOutcome;
}

// Recorded by running each case against the real engine at the level's own
// pinned seed. Extra columns appear only where the four standard programs
// can't tell two tiers apart, so every silver/gold rung has a run backing it.
// The demo levels grade nothing, so their every win reads gold.
const CASES: readonly SkyscraperCase[] = [
  { id: "sky-1", starter: "lost", sweep: "gold", dev: "lost", good: "gold" },
  { id: "sky-2", starter: "lost", sweep: "gold", dev: "lost", good: "gold" },
  { id: "sky-3", starter: "silver", sweep: "silver", dev: "lost", good: "gold" },
  { id: "sky-4", starter: "lost", sweep: "gold", dev: "lost", good: "gold" },
  { id: "sky-5", starter: "bronze", sweep: "bronze", dev: "lost", good: "gold" },
  { id: "sky-6", starter: "lost", sweep: "gold", dev: "lost", good: "gold" },
  { id: "sky-7", starter: "lost", sweep: "gold", dev: "lost", good: "silver" },
  { id: "sky-8", starter: "lost", sweep: "lost", dev: "lost", good: "gold", zone: "gold" },
  { id: "sky-9", starter: "bronze", sweep: "lost", dev: "lost", good: "gold" },
  { id: "sky-10", starter: "silver", sweep: "lost", dev: "lost", good: "gold" },
  { id: "sky-11", starter: "lost", sweep: "lost", dev: "lost", good: "lost", dispatch: "gold" },
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
    expect(CASES.map((testCase) => testCase.id)).toEqual(skyscraperLevels.map((level) => level.id));
  });

  it("records a level that tells its programs apart", () => {
    // A level where every measured program lands on the same tier measures
    // nothing; optional columns count too, since some rows rely on them alone.
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

      // Only where the row asks for it, to avoid running duplicate simulations.
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
