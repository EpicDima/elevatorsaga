import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Elevator } from "./elevator.ts";
import type { ElevatorInterface } from "./elevator-interface.ts";
import { Floor } from "./floor.ts";
import {
  createRandomSource,
  generateRandomSeed,
  type RandomSeed,
  type RandomSource,
} from "./random.ts";
import { at, scriptedRandom } from "./test-helpers.ts";
import { User } from "./user.ts";
import type { ControllableWorld } from "./world-controller.ts";
import {
  World,
  createElevators,
  createFloors,
  createRandomUser,
  createWorld,
  spawnUserRandomly,
} from "./world.ts";

/**
 * Collects every user a world spawns.
 *
 * @param world - World to watch.
 * @returns The array the world's spawns are appended to.
 */
function collectUsers(world: World): User[] {
  const users: User[] = [];
  world.on("new_user", (user) => {
    users.push(user);
  });
  return users;
}

/**
 * A stream stuck at zero, which sends every draw to the bottom of its range.
 *
 * For a spawn that means the lightest passenger, starting in the lobby and
 * heading for floor 1.
 */
const ALWAYS_ZERO: RandomSource = () => 0;

/**
 * A three-floor building whose passengers all appear in the lobby.
 *
 * For the wait-before-pickup cases, which need a passenger who is actually left
 * standing: {@link ALWAYS_ZERO} puts every spawn in the lobby heading for floor
 * 1, and the third floor exists so the caller can legally send the one car away
 * from them. The spawn rate is the caller's because it decides how many
 * passengers there are — the accumulator starts above its own threshold, so the
 * first passenger appears on the first frame whatever it is set to, and the
 * next one `1 / rate` seconds later.
 *
 * @param spawnRate - Passengers per second.
 * @returns The world.
 */
function waitingWorld(spawnRate: number): World {
  return createWorld({ spawnRate, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
}

/**
 * A walk-off stream that fails the test if anybody draws from it.
 *
 * Every passenger built below is left standing on a floor, so none of them ever
 * reaches a destination and none of them needs a walk-off duration. Handing
 * them a stream that throws rather than a harmless one turns "the walk-off draw
 * moved to spawn time" — which would put a timing-shiftable draw back into the
 * sequence a seed replays — from an invisible change into a failing test.
 */
const WALK_OFF_UNUSED: RandomSource = () => {
  throw new Error("A passenger drew a walk-off duration without having been delivered");
};

/**
 * Wraps a stream so the test can see what was taken from it.
 *
 * @param random - Stream to wrap.
 * @returns The wrapper and the list it appends every drawn value to.
 */
function recordDraws(random: RandomSource): { random: RandomSource; values: number[] } {
  const values: number[] = [];
  return {
    random: (): number => {
      const value = random();
      values.push(value);
      return value;
    },
    values,
  };
}

/** Spawns one update() may make before the test calls the loop runaway. */
const RUNAWAY_SPAWN_LIMIT = 10_000;

/**
 * Advances a world whose spawn loop might not terminate, failing if it does not.
 *
 * A runaway spawn loop is a synchronous `while` inside one call, so vitest's
 * per-test timeout cannot interrupt it: a regression would wedge the entire test
 * run with no output rather than fail one test, which is the worst way for a
 * guard against hanging to report that it has stopped working. The world
 * dispatches `new_user` with `trigger`, which lets a handler's exception
 * propagate, so throwing from one is the only lever a test has to break out of
 * that loop from the inside.
 *
 * The limit is far above any legitimate frame these tests ask for: the busiest is
 * 123.456 passengers a second over a five-second step, some six hundred spawns,
 * and the rates this helper mainly exists for spawn nobody at all.
 *
 * @param world - World to advance.
 * @param dt - Simulated seconds to advance by.
 * @throws {Error} When one update spawns more than {@link RUNAWAY_SPAWN_LIMIT}.
 */
function updateWithoutRunawaySpawning(world: World, dt: number): void {
  let spawns = 0;
  const countSpawn = (): void => {
    spawns += 1;
    if (spawns > RUNAWAY_SPAWN_LIMIT) {
      throw new Error(
        `Spawn loop did not terminate: over ${String(RUNAWAY_SPAWN_LIMIT)} passengers in one update`,
      );
    }
  };
  world.on("new_user", countSpawn);
  try {
    world.update(dt);
  } finally {
    world.off("new_user", countSpawn);
  }
}

/**
 * Counts the spawns the unguarded spawn loop made, frame by frame.
 *
 * A transcription of `World.update`'s arithmetic as it stood before the rate was
 * resolved at construction, the `1.001 / spawnRate` head start included, so that
 * the guarded engine can be held against the exact sequence of doubles it used
 * to produce. Any drift in the timing of a rate the guard passes through shows
 * up as a different count on the frame it first happens.
 *
 * @param spawnRate - Passengers per second.
 * @param steps - Simulated seconds each frame advances by.
 * @returns The running spawn total after each frame.
 */
function unguardedSpawnCounts(spawnRate: number, steps: readonly number[]): number[] {
  let elapsedSinceSpawn = 1.001 / spawnRate;
  let spawns = 0;
  return steps.map((dt) => {
    elapsedSinceSpawn += dt;
    while (elapsedSinceSpawn > 1.0 / spawnRate) {
      elapsedSinceSpawn -= 1.0 / spawnRate;
      spawns += 1;
    }
    return spawns;
  });
}

/**
 * Builds a world with exactly one user waiting on floor 0.
 *
 * The world's randomness is pinned to zero so the spawn lands on floor 0
 * heading up, and the elevator is parked at the top so it neither re-arrives
 * nor picks the user up on its own.
 *
 * @returns The world and its lone user.
 */
function createWorldWithWaitingUser(): { world: World; user: User } {
  const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
  at(world.elevators, 0).setFloorPosition(2);
  const spawned = collectUsers(world);
  world.update(0.1);
  return { world, user: at(spawned, 0) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createFloors", () => {
  it("numbers floors from the bottom up", () => {
    const floors = createFloors(4, 50, () => undefined);
    expect(floors).toHaveLength(4);
    expect(floors.map((f) => f.floorNum())).toEqual([0, 1, 2, 3]);
  });

  it("stacks floors downward so the top floor sits at y 0", () => {
    const floors = createFloors(4, 50, () => undefined);
    expect(floors.map((f) => f.yPosition)).toEqual([150, 100, 50, 0]);
  });

  it("hands the error handler to every floor", () => {
    const errorHandler = vi.fn();
    const boom = new Error("boom");
    const floors = createFloors(2, 50, errorHandler);
    at(floors, 1).on("up_button_pressed", () => {
      throw boom;
    });
    at(floors, 1).pressUpButton();
    expect(errorHandler).toHaveBeenCalledWith(boom);
  });
});

describe("createElevators", () => {
  it("lays elevators out left to right, parked at floor 0", () => {
    const elevators = createElevators(2, 4, 50);
    expect(elevators).toHaveLength(2);
    expect(at(elevators, 0).x).toBe(200.0);
    // 20 units of spacing plus the first elevator's own width (capacity * 10).
    expect(at(elevators, 1).x).toBe(200.0 + 20 + 40);
    expect(elevators.every((e) => e.currentFloor === 0)).toBe(true);
  });

  it("defaults to a capacity of four", () => {
    const elevators = createElevators(1, 4, 50);
    expect(at(elevators, 0).maxUsers).toBe(4);
  });

  it("cycles the capacity list when it is shorter than the elevator count", () => {
    const elevators = createElevators(5, 4, 50, [2, 3]);
    expect(elevators.map((e) => e.maxUsers)).toEqual([2, 3, 2, 3, 2]);
  });

  it("gives each elevator the building's floor count and height", () => {
    const elevators = createElevators(1, 6, 40);
    const elevator = at(elevators, 0);
    expect(elevator.getYPosOfFloor(0)).toBe((6 - 1) * 40);
    expect(elevator.getYPosOfFloor(5)).toBe(0);
  });

  it("parks the elevators without counting that as a move", () => {
    // Issues #117 and #20: sliding the elevator into its shaft before placing
    // it on floor 0 made the very first state change look like a floor change,
    // so every elevator was born having already "moved" once.
    const elevators = createElevators(3, 4, 50);
    expect(elevators.map((e) => e.moveCount)).toEqual([0, 0, 0]);
  });

  it("puts the elevators at the bottom floor's y position", () => {
    // Pins the geometry, so the ordering fix above cannot quietly move an
    // elevator: y is the bottom floor of a 4 floor, 50 unit building.
    const elevators = createElevators(2, 4, 50);
    expect(elevators.map((e) => e.y)).toEqual([150, 150]);
    expect(elevators.map((e) => e.x)).toEqual([200.0, 200.0 + 20 + 40]);
  });

  it("hands every elevator the stream their boarding slots come from", () => {
    // Without it they would fall back to the unseeded default and a replay
    // would put its passengers in different corners of the same cars. The
    // value sits at the top of the offset's range, so each scan starts on the
    // last slot - and the unseeded default is watched as well, since one car in
    // four would land on that slot by chance anyway.
    const global = vi.spyOn(Math, "random");
    const elevators = createElevators(2, 4, 50, [4], () => 0.99);
    for (const elevator of elevators) {
      expect(elevator.userEntering({ weight: 70 })).toEqual(at(elevator.userSlots, 3).pos);
    }
    expect(global).not.toHaveBeenCalled();
  });
});

describe("createRandomUser", () => {
  it("gives every user a weight between 55 and 100 and an appearance", () => {
    const random = createRandomSource("createRandomUser");
    for (let i = 0; i < 200; ++i) {
      const user = createRandomUser(random, WALK_OFF_UNUSED);
      expect(user.weight).toBeGreaterThanOrEqual(55);
      expect(user.weight).toBeLessThanOrEqual(100);
      expect(["child", "female", "male"]).toContain(user.displayType);
    }
  });

  it("makes a child when the one-in-41 roll comes up", () => {
    const user = createRandomUser(ALWAYS_ZERO, WALK_OFF_UNUSED);
    expect(user.weight).toBe(55);
    expect(user.displayType).toBe("child");
  });

  it("makes a female when the child roll misses and the gender roll is 0", () => {
    const random = scriptedRandom([
      0, // weight
      0.5, // child roll: misses
      0, // gender roll
    ]);
    expect(createRandomUser(random, WALK_OFF_UNUSED).displayType).toBe("female");
  });

  it("makes a male otherwise", () => {
    const user = createRandomUser(() => 0.99, WALK_OFF_UNUSED);
    expect(user.weight).toBe(100);
    expect(user.displayType).toBe("male");
  });

  it("draws weight, then the child roll, then the gender roll, and nothing else", () => {
    // The number of draws and their order are part of what a seed reproduces,
    // so they are pinned rather than left to a reading of the function.
    // `legacy-1.x:world.js:32-36` drew them this way; each value below is one
    // only its own consumer reacts to, so a reordering shows up in the result.
    const draws = recordDraws(scriptedRandom([0.99, 0.5, 0]));
    const user = createRandomUser(draws.random, WALK_OFF_UNUSED);
    expect(draws.values).toEqual([0.99, 0.5, 0]);
    expect(user.weight).toBe(100);
    expect(user.displayType).toBe("female");
  });
});

describe("spawnUserRandomly", () => {
  it("always picks a real floor and a destination that is somewhere else", () => {
    const floorCount = 5;
    const floors = createFloors(floorCount, 50, () => undefined);
    const random = createRandomSource("spawnUserRandomly");
    for (let i = 0; i < 500; ++i) {
      const user = spawnUserRandomly(floorCount, 50, floors, random, WALK_OFF_UNUSED);
      expect(user.currentFloor).toBeGreaterThanOrEqual(0);
      expect(user.currentFloor).toBeLessThan(floorCount);
      expect(user.destinationFloor).toBeGreaterThanOrEqual(0);
      expect(user.destinationFloor).toBeLessThan(floorCount);
      expect(user.destinationFloor).not.toBe(user.currentFloor);
    }
  });

  it("puts the user on their floor and presses the matching call button", () => {
    const floors = createFloors(3, 50, () => undefined);
    const user = spawnUserRandomly(3, 50, floors, ALWAYS_ZERO, WALK_OFF_UNUSED);

    expect(user.currentFloor).toBe(0);
    expect(user.destinationFloor).toBe(1);
    expect(user.x).toBe(105);
    expect(user.y).toBe(at(floors, 0).getSpawnPosY());
    expect(at(floors, 0).buttonStates.up).toBe("activated");
    expect(at(floors, 0).buttonStates.down).toBe("");
  });

  it("sends users above the lobby down to it by default", () => {
    const random = scriptedRandom([
      0, // weight
      0.5, // child roll
      0.5, // gender roll
      0, // spawn x offset
      0.9, // "start in the lobby?" roll: no
      0.9, // floor roll
      0.5, // "not going to the lobby?" roll: no
    ]);
    const floors = createFloors(3, 50, () => undefined);
    const user = spawnUserRandomly(3, 50, floors, random, WALK_OFF_UNUSED);

    expect(user.currentFloor).toBe(2);
    expect(user.destinationFloor).toBe(0);
    expect(at(floors, 2).buttonStates.down).toBe("activated");
  });

  it("spends one draw fewer on a passenger who starts in the lobby", () => {
    // The short-circuit in `legacy-1.x:world.js:47`: the origin floor is only
    // drawn for a passenger who is not starting in the lobby. How many draws a
    // spawn costs decides what every later spawn of the same run sees, so it is
    // pinned here rather than inferred.
    const floors = createFloors(3, 50, () => undefined);

    const fromLobby = recordDraws(scriptedRandom([0, 0.5, 0.5, 0, 0 /* lobby */, 0.5]));
    expect(spawnUserRandomly(3, 50, floors, fromLobby.random, WALK_OFF_UNUSED).currentFloor).toBe(
      0,
    );
    expect(fromLobby.values).toHaveLength(6);

    const fromAbove = recordDraws(scriptedRandom([0, 0.5, 0.5, 0, 0.9 /* not lobby */, 0.9, 0.5]));
    expect(spawnUserRandomly(3, 50, floors, fromAbove.random, WALK_OFF_UNUSED).currentFloor).toBe(
      2,
    );
    expect(fromAbove.values).toHaveLength(7);
  });
});

describe("World", () => {
  it("builds the default building", () => {
    const world = createWorld();
    expect(world.floorHeight).toBe(50);
    expect(world.floors).toHaveLength(4);
    expect(world.elevators).toHaveLength(2);
    expect(world.elevatorInterfaces).toHaveLength(2);
    expect(world.users).toEqual([]);
    expect(world.challengeEnded).toBe(false);
  });

  it("honours the challenge options", () => {
    const world = createWorld({
      floorHeight: 40,
      floorCount: 6,
      elevatorCount: 3,
      elevatorCapacities: [5, 8],
      spawnRate: 2,
    });
    expect(world.floorHeight).toBe(40);
    expect(world.floors).toHaveLength(6);
    expect(world.elevators).toHaveLength(3);
    expect(world.elevators.map((e) => e.maxUsers)).toEqual([5, 8, 5]);
  });

  it("starts every statistic at zero", () => {
    const world = createWorld();
    expect(world.transportedCounter).toBe(0);
    expect(world.transportedPerSec).toBe(0.0);
    expect(world.moveCount).toBe(0);
    expect(world.elapsedTime).toBe(0.0);
    expect(world.maxWaitTime).toBe(0.0);
    expect(world.avgWaitTime).toBe(0.0);
  });

  describe("spawning", () => {
    it("spawns a user on the very first update", () => {
      const world = createWorld({ spawnRate: 0.5 });
      const spawned = collectUsers(world);
      world.update(0.1);
      expect(world.users).toHaveLength(1);
      expect(spawned).toHaveLength(1);
      expect(world.users).toEqual(spawned);
    });

    it("then spawns at the configured rate", () => {
      const world = createWorld({ spawnRate: 0.5 });
      world.update(0.1);
      world.update(1.8);
      expect(world.users).toHaveLength(1);
      world.update(0.2);
      expect(world.users).toHaveLength(2);
    });

    it("catches up when a single step covers several spawn intervals", () => {
      const world = createWorld({ spawnRate: 1 });
      world.update(5.0);
      expect(world.users).toHaveLength(6);
    });

    it("stamps each user with the world time they appeared at", () => {
      const world = createWorld({ spawnRate: 0.5 });
      const spawned = collectUsers(world);
      world.update(0.1);
      expect(at(spawned, 0).spawnTimestamp).toBeCloseTo(0.1, 10);
    });

    describe("a rate that is not a rate", () => {
      // The spawn loop subtracts `1 / spawnRate` until the accumulated time is
      // no longer greater than it, which only ends while that interval is a
      // positive number: a negative rate makes it negative, so every iteration
      // moves the accumulator further from the threshold, and an infinite rate
      // makes it zero, so the accumulator does not move at all. Either way one
      // call to update() never returns, and since that is a plain synchronous
      // loop there is no error, no stack and no next frame -- the tab freezes
      // and the game merely looks broken.

      // Every rate in this block that is not a rate is reported to the console
      // by design, so the block silences it. The two tests that care about the
      // warning assert on the mock; the rest have nothing to say about it, and
      // leaving four warnings in the output of a passing suite only teaches the
      // reader to skip past output that is sometimes worth reading.
      beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
      });

      it("does not hang, and spawns nobody, for a negative rate", () => {
        const world = createWorld({ spawnRate: -2 }, "negative-rate");
        const spawned = collectUsers(world);

        updateWithoutRunawaySpawning(world, 10);

        expect(spawned).toEqual([]);
        expect(world.users).toEqual([]);
      });

      it("spawns nobody for a rate of zero, which is what zero asks for", () => {
        const world = createWorld({ spawnRate: 0 }, "zero-rate");
        const spawned = collectUsers(world);

        updateWithoutRunawaySpawning(world, 10);

        expect(spawned).toEqual([]);
      });

      it("does not hang, and spawns nobody, for a NaN rate", () => {
        const world = createWorld({ spawnRate: Number.NaN }, "nan-rate");
        const spawned = collectUsers(world);

        updateWithoutRunawaySpawning(world, 10);

        expect(spawned).toEqual([]);
      });

      it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "does not hang, and spawns nobody, for a rate of %s",
        (spawnRate) => {
          // Positive but unrunnable, and the one case a `spawnRate > 0` test
          // would have let through: `1 / Infinity` is `+0` and `1 / -Infinity`
          // is `-0`, so the subtraction leaves the accumulator exactly where it
          // was and the loop never reaches its own exit.
          const world = createWorld({ spawnRate }, "infinite-rate");
          const spawned = collectUsers(world);

          updateWithoutRunawaySpawning(world, 10);

          expect(spawned).toEqual([]);
        },
      );

      it("keeps going, and says so once, rather than throwing", () => {
        // The house rule for a value the engine cannot use: report it and carry
        // on. Throwing from the constructor would abort createWorld, and the
        // app calls that while starting a run, so a single bad option would
        // leave the page with no building at all.
        const world = createWorld({ spawnRate: -2, floorCount: 3, elevatorCount: 1 }, "reported");
        // Through the bounded helper like every other test here: this one runs
        // a rate that used to hang too, so a regression must fail it rather
        // than take the test run down with it.
        updateWithoutRunawaySpawning(world, 0.1);

        expect(console.warn).toHaveBeenCalledTimes(1);
        // Names the value, so the reader of the console knows which option to
        // go and look at rather than only that something was wrong.
        expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).toContain("-2");
        expect(world.elapsedTime).toBeCloseTo(0.1, 10);
      });

      it("stays quiet about a rate of zero", () => {
        // Zero is a coherent request -- an empty building is a thing a test or
        // a demo may well want -- and it already gets exactly what it asked
        // for, so there is nothing to report.
        createWorld({ spawnRate: 0 });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    it("leaves the spawn timing of every positive rate exactly as it was", () => {
      // The point of the guard is that it changes nothing for a rate that is
      // one. Held against a transcription of the unguarded loop rather than
      // against counts worked out by hand, so the comparison is over the exact
      // float arithmetic -- including the 1.001 head start and the accumulator
      // that carries across frames -- and not over a rounded idea of it.
      const steps = [0.1, 1.8, 0.2, 5.0, ...Array.from({ length: 120 }, () => 1.0 / 60.0)];

      for (const spawnRate of [0.001, 0.01, 0.5, 0.6, 1, 1.9, 3, 10, 123.456]) {
        const world = createWorld({ spawnRate, floorCount: 3, elevatorCount: 1 }, "timing");
        const spawned = collectUsers(world);

        // Bounded like the tests above even though every rate here is one the
        // loop finishes on, so that adding an extreme rate to the list -- the
        // obvious next edit to this test -- fails it instead of wedging the
        // whole run. Costs one handler registration per frame.
        const counts = steps.map((dt) => {
          updateWithoutRunawaySpawning(world, dt);
          return spawned.length;
        });

        expect(counts).toEqual(unguardedSpawnCounts(spawnRate, steps));
      }
    });
  });

  describe("update", () => {
    it("accumulates elapsed time", () => {
      const world = createWorld({ spawnRate: 0.001 });
      world.update(0.25);
      world.update(0.25);
      expect(world.elapsedTime).toBeCloseTo(0.5, 10);
    });

    it("recalculates the statistics on every single frame", () => {
      const world = createWorld({ spawnRate: 0.001 });
      const statsChanged = vi.fn();
      world.on("stats_changed", statsChanged);
      world.update(0.1);
      world.update(0.1);
      world.update(0.1);
      expect(statsChanged).toHaveBeenCalledTimes(3);
    });

    it("reports no elevator moves before anything has moved", () => {
      // Issues #117 and #20: `moveCount` is what the "elevator moves" challenges
      // are scored on, so a world whose elevators have not gone anywhere had to
      // report zero. It reported one move per elevator on the first frame.
      const world = createWorld({ spawnRate: 0.001, floorCount: 4, elevatorCount: 2 });
      world.update(0.1);
      expect(world.moveCount).toBe(0);
    });

    it("sums the move counts of all elevators", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 2 });
      at(world.elevators, 0).moveCount = 3;
      at(world.elevators, 1).moveCount = 4;
      world.update(0.1);
      expect(world.moveCount).toBe(7);
    });

    it("averages the load its elevators carried over the floors they crossed", () => {
      // Set on the elevators directly, the way the move-count case above does:
      // what is under test is the division, and driving real passengers into
      // real cars to arrive at a chosen numerator would test the boarding code
      // instead. Four crossings carrying 2.0 between them and one carrying
      // nothing is 2.0 over 5 moves.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 2 });
      at(world.elevators, 0).moveCount = 4;
      at(world.elevators, 0).loadFactorSumOnMove = 2.0;
      at(world.elevators, 1).moveCount = 1;
      at(world.elevators, 1).loadFactorSumOnMove = 0;
      world.update(0.1);
      expect(world.avgLoadFactorOnMove).toBeCloseTo(0.4, 10);
    });

    it("reports no load rather than NaN while nothing has moved", () => {
      // A building whose cars have not moved yet is an ordinary state that
      // lasts as long as the player leaves it alone, so the zero denominator
      // here is reached in normal play rather than only at start-up -- and an
      // unguarded division would put NaN in the statistics panel.
      const world = createWorld({ spawnRate: 0.001, floorCount: 4, elevatorCount: 2 });
      world.update(0.1);
      expect(world.moveCount).toBe(0);
      expect(world.avgLoadFactorOnMove).toBe(0);
    });

    it("stops the wait for a car at the moment a car takes them", () => {
      // The split upstream #52, #77 and PR #82 all ask for, in one assertion:
      // `maxWaitTime` is the whole commute and keeps running while a passenger
      // rides, `maxPickupTime` is the part they spent standing on a floor and
      // stops the moment they are taken. One second waiting, five riding.
      //
      // The car is sent to the top first, and that is what makes the wait
      // exist at all: a passenger who spawns in the lobby beside a standing
      // car is picked up on the frame they appear on, and waits zero seconds --
      // correctly, but there is nothing to measure in it.
      const world = waitingWorld(0.05);
      const spawned = collectUsers(world);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(1.0);
      const user = at(spawned, 0);
      expect(user.pickupTimestamp).toBeNull();
      expect(world.maxPickupTime).toBeCloseTo(1.0, 10);

      user.trigger("entered_elevator", at(world.elevators, 0));
      world.update(5.0);

      expect(world.maxPickupTime).toBeCloseTo(1.0, 10);
      expect(world.maxWaitTime).toBeCloseTo(6.0, 10);
    });

    it("averages the wait for a car over the passengers a car came for", () => {
      // Over boardings and not over deliveries, which are different sets: a
      // passenger riding in a car has been picked up and has not been
      // delivered. At one passenger every two seconds, the first waits one
      // second and the second waits three, for a mean of two.
      const world = waitingWorld(0.5);
      const spawned = collectUsers(world);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(1.0);
      at(spawned, 0).trigger("entered_elevator", at(world.elevators, 0));
      expect(world.avgPickupTime).toBeCloseTo(1.0, 10);

      world.update(1.0);
      world.update(3.0);
      at(spawned, 1).trigger("entered_elevator", at(world.elevators, 0));

      expect(world.avgPickupTime).toBeCloseTo(2.0, 10);
      expect(world.maxPickupTime).toBeCloseTo(3.0, 10);
    });

    it("counts the last frame of a wait that a car really ends", () => {
      // What the boarding handler adds over the per-frame sweep, which is the
      // one thing the two tests above cannot tell apart because they board
      // their passengers by hand between frames. A car that arrives inside
      // update() takes its passenger after the clock has already been advanced,
      // and the sweep that runs afterwards skips anybody already picked up --
      // so that last frame of waiting is recorded at the boarding or nowhere.
      //
      // `avgPickupTime` is the second reading of the same moment and is written
      // only there, so over a single boarding the two figures are the same
      // subtraction. Exact equality rather than toBeCloseTo: a maximum left to
      // the sweep alone would be short by exactly one frame, and rounding it
      // away is how that would go unnoticed.
      const world = waitingWorld(0.05);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(1.0);
      expect(world.avgPickupTime).toBe(0);

      at(world.elevators, 0).goToFloor(0);
      for (let frame = 0; frame < 600 && world.avgPickupTime === 0; frame++) {
        world.update(1.0 / 60.0);
      }

      expect(world.avgPickupTime).toBeGreaterThan(1.0);
      expect(world.maxPickupTime).toBe(world.avgPickupTime);
    });

    it("goes on counting the wait of a passenger nobody ever comes for", () => {
      // The case that makes this statistic worth having, and the reason it is
      // not derived from boardings alone. A passenger left standing has no
      // boarding moment, so a figure built only out of boardings would never
      // mention them: the run would report a healthy average with somebody
      // still on the floor they spawned on.
      const world = waitingWorld(0.05);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(10.0);
      expect(world.avgPickupTime).toBe(0);
      expect(world.maxPickupTime).toBeCloseTo(10.0, 10);
    });

    it("tracks the longest wait of any user still in the world", () => {
      const world = createWorld({ spawnRate: 0.5 });
      world.update(0.1);
      world.update(1.0);
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);
    });

    it("stops extending the longest wait once a passenger has been delivered", () => {
      // A delivered passenger spends another 1 to 1.5 simulated seconds walking
      // off to the right before the world drops them, and stays in world.users
      // for all of it. Those seconds were still being folded into maxWaitTime
      // every frame, so the worst wait the player is scored on included time
      // spent walking away after the journey had already ended.
      const world = createWorld({ spawnRate: 0.5, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);

      // What User.handleExit does on arrival: flag the walk-off and announce it.
      const user = at(spawned, 0);
      user.done = true;
      user.trigger("exited_elevator", at(world.elevators, 0));
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);

      world.update(1.0);

      expect(world.users).toContain(user);
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);
    });

    it("still extends the longest wait for passengers who are still waiting", () => {
      // Guards the fix above from over-reaching: only the delivered passenger is
      // excluded, everyone still in the building keeps accruing wait time.
      const world = createWorld({ spawnRate: 1, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);
      const delivered = at(spawned, 0);
      delivered.done = true;
      delivered.trigger("exited_elevator", at(world.elevators, 0));

      world.update(1.0);

      expect(world.users.length).toBeGreaterThan(1);
      // The second passenger appeared at t = 1.1 and is still waiting at 2.1.
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);
      world.update(1.0);
      expect(world.maxWaitTime).toBeCloseTo(2.0, 10);
    });

    it("says which passenger the longest wait belongs to", () => {
      // Upstream #135: the panel reports a longest wait and the player has no
      // way to tell whose it is. `users` is in spawn order, so the answer is
      // the first one still in the building -- and only that one.
      const world = createWorld({ spawnRate: 1, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);

      expect(spawned.length).toBeGreaterThan(1);
      expect(world.users.filter((user) => user.waitingLongest)).toEqual([at(spawned, 0)]);
    });

    it("hands the flag on when that passenger is delivered", () => {
      // The wait the panel reports is the wait in progress, so the moment the
      // worst of them steps out the mark has to move to whoever is now worst.
      const world = createWorld({ spawnRate: 1, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);
      const delivered = at(spawned, 0);
      delivered.done = true;
      delivered.trigger("exited_elevator", at(world.elevators, 0));

      world.update(1.0);

      expect(delivered.waitingLongest).toBe(false);
      expect(world.users).toContain(delivered);
      expect(at(spawned, 1).waitingLongest).toBe(true);
    });

    it("marks nobody while everybody left in the world is walking off", () => {
      // A delivered passenger stays in `users` for another second and a half,
      // and their wait has stopped being reported, so nothing may be marked --
      // not the last one to arrive, and not the last one to be marked either.
      const world = createWorld({ spawnRate: 0.5, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);
      const only = at(spawned, 0);
      expect(only.waitingLongest).toBe(true);

      only.done = true;
      only.trigger("exited_elevator", at(world.elevators, 0));
      world.update(0.1);

      expect(world.users).toContain(only);
      expect(world.users.some((user) => user.waitingLongest)).toBe(false);
    });

    it("announces the handover, because the passengers it moves between are still", () => {
      // The passenger who has waited longest is, by definition, the one least
      // likely to be moving, and a presenter only redraws what announces
      // itself. A handover must cost one announcement each way and no more,
      // however many frames pass on either side of it.
      const world = createWorld({ spawnRate: 1, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);
      const first = at(spawned, 0);
      const second = at(spawned, 1);
      const firstRedraws = vi.fn();
      const secondRedraws = vi.fn();
      first.on("new_display_state", firstRedraws);
      second.on("new_display_state", secondRedraws);

      world.update(1.0);
      world.update(1.0);
      expect(firstRedraws).not.toHaveBeenCalled();
      expect(secondRedraws).not.toHaveBeenCalled();

      first.done = true;
      first.trigger("exited_elevator", at(world.elevators, 0));
      world.update(1.0);

      expect(firstRedraws).toHaveBeenCalledTimes(1);
      expect(secondRedraws).toHaveBeenCalledTimes(1);
      world.update(1.0);
      expect(secondRedraws).toHaveBeenCalledTimes(1);
    });

    it("drops users that have flagged themselves for removal", () => {
      const world = createWorld({ spawnRate: 0.5 });
      const spawned = collectUsers(world);
      world.update(0.1);
      at(spawned, 0).removeMe = true;
      world.update(0.1);
      expect(world.users).toHaveLength(0);
    });

    it("counts transported users and averages their wait times", () => {
      const world = createWorld({ spawnRate: 0.5, floorCount: 2, elevatorCount: 1 });
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);
      at(spawned, 0).trigger("exited_elevator", at(world.elevators, 0));

      expect(world.transportedCounter).toBe(1);
      expect(world.avgWaitTime).toBeCloseTo(1.0, 10);
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);
      expect(world.transportedPerSec).toBeCloseTo(1 / 1.1, 10);
    });
  });

  describe("elevator availability", () => {
    it("clears the call buttons of the floor an elevator arrives at", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const elevator = at(world.elevators, 0);
      const floor = at(world.floors, 0);
      elevator.setFloorPosition(0);
      floor.pressUpButton();
      expect(floor.buttonStates.up).toBe("activated");

      elevator.trigger("entrance_available", elevator);

      expect(floor.buttonStates.up).toBe("");
    });

    it("offers the elevator to users waiting on that floor", () => {
      const { world, user } = createWorldWithWaitingUser();
      expect(user.currentFloor).toBe(0);
      expect(user.parent).toBeNull();

      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(0);
      const entered = vi.fn();
      user.on("entered_elevator", entered);

      elevator.trigger("entrance_available", elevator);

      expect(entered).toHaveBeenCalledTimes(1);
      expect(user.parent).toBe(elevator);
    });

    it("leaves users on other floors alone", () => {
      const { world, user } = createWorldWithWaitingUser();
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      const entered = vi.fn();
      user.on("entered_elevator", entered);

      elevator.trigger("entrance_available", elevator);

      expect(entered).not.toHaveBeenCalled();
    });

    it("lets a user board an elevator already parked at their floor", () => {
      // The user's own call button press re-arrives the idle elevator standing
      // at floor 0, so they board within the very update that spawned them.
      const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
      const spawned = collectUsers(world);

      world.update(0.1);

      expect(at(spawned, 0).parent).toBe(at(world.elevators, 0));
    });
  });

  describe("indicator changes", () => {
    /**
     * Builds a world whose lone elevator is parked at floor 0 with only the
     * down indicator lit, and one passenger waiting there to travel up.
     *
     * @returns The world, its elevator, its facade and the waiting passenger.
     */
    function createWorldWithRefusedUser(): {
      world: World;
      elevator: Elevator;
      elevInterface: ElevatorInterface;
      user: User;
    } {
      const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
      const elevator = at(world.elevators, 0);
      const elevInterface = at(world.elevatorInterfaces, 0);
      elevInterface.goingUpIndicator(false);
      const spawned = collectUsers(world);
      world.update(0.1);
      return { world, elevator, elevInterface, user: at(spawned, 0) };
    }

    it("picks up a refused passenger once the matching indicator is lit", () => {
      // Issues #59, #74, #98: the elevator stands empty at the passenger's
      // floor with the wrong indicator lit, so it never takes them.
      const { elevator, elevInterface, user } = createWorldWithRefusedUser();
      expect(user.currentFloor).toBe(0);
      expect(user.destinationFloor).toBe(1);
      expect(user.parent).toBe(null);

      elevInterface.goingUpIndicator(true);

      expect(user.parent).toBe(elevator);
    });

    it("clears the call button of the floor the elevator is standing at", () => {
      // The other half of the re-offer. `entrance_available` is what
      // world.js:128 bound handleElevAvailability to, so the floor is
      // reconsidered exactly as on a real arrival - not just the passengers.
      // Solutions that track pending calls from buttonStates or from the
      // button events see the call answered.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const elevInterface = at(world.elevatorInterfaces, 0);
      at(world.elevators, 0).setFloorPosition(1);
      elevInterface.goingUpIndicator(false);
      const floor = at(world.floors, 1);
      floor.pressUpButton();
      expect(floor.buttonStates.up).toBe("activated");

      elevInterface.goingUpIndicator(true);

      expect(floor.buttonStates.up).toBe("");
    });

    it("costs nothing when player code rewrites the indicators every frame", () => {
      // The re-offer is wired to indicatorstate_change, and every
      // entrance_available makes the world sweep every floor and every user
      // looking for someone to board. Player code that simply assigns the
      // indicators once per frame - the obvious way to write directional
      // service - used to pay for a full sweep on each of those frames.
      const { world, elevInterface } = createWorldWithRefusedUser();
      const sweep = vi.spyOn(Floor.prototype, "elevatorAvailable");

      for (let frame = 0; frame < 100; frame++) {
        elevInterface.goingUpIndicator(false);
        elevInterface.goingDownIndicator(true);
        world.update(1.0 / 60.0);
      }

      expect(sweep).not.toHaveBeenCalled();
    });

    it("stays put while a passenger the re-offer let in is still walking in", () => {
      // Upstream issue #105 ("Elevator moves while passengers enter"). Every
      // legacy boarding path was covered by the one second dwell the facade
      // installs from `stopped` (`interfaces.js:64`, `elevator.wait(1, ...)`),
      // which outlasts the one second a passenger takes to walk in
      // (`user.js:67`). The re-offer is a boarding path the legacy code did not
      // have, so without its own dwell the car can accept a passenger and drive
      // off in the very same frame, dragging them through the shaft.
      const { world, elevator, elevInterface, user } = createWorldWithRefusedUser();
      const parkedY = elevator.y;

      elevInterface.goingUpIndicator(true);
      expect(user.parent).toBe(elevator);
      expect(user.isBusy()).toBe(true);
      // The player's update() would typically ask for the next floor in the
      // same frame that flipped the indicator.
      elevInterface.goToFloor(2);

      world.update(1.0 / 60.0);
      expect(elevator.y).toBe(parkedY);

      for (let frame = 0; frame < 120 && user.isBusy(); frame++) {
        world.update(1.0 / 60.0);
        if (user.isBusy()) {
          expect(elevator.y).toBe(parkedY);
        }
      }

      // The dwell is a delay, not a cancellation: the queued trip still happens.
      expect(user.isBusy()).toBe(false);
      expect(user.parent).toBe(elevator);
      world.update(1.0 / 60.0);
      expect(elevator.isMoving).toBe(true);
    });

    it("leaves the statistics and the destination queue untouched", () => {
      const { world, elevator, elevInterface } = createWorldWithRefusedUser();
      const elevatorMoveCount = elevator.moveCount;
      const worldMoveCount = world.moveCount;
      const stopped = vi.fn();
      const stoppedAtFloor = vi.fn();
      const floorButtonsChanged = vi.fn();
      elevator.on("stopped", stopped);
      elevator.on("stopped_at_floor", stoppedAtFloor);
      elevator.on("floor_buttons_changed", floorButtonsChanged);

      elevInterface.goingUpIndicator(true);
      // Short enough that the boarding passenger has not walked in yet, so any
      // event seen here came from the indicator flip.
      world.update(0.05);

      expect(elevator.moveCount).toBe(elevatorMoveCount);
      expect(world.moveCount).toBe(worldMoveCount);
      expect(elevInterface.destinationQueue).toEqual([]);
      expect(elevator.isMoving).toBe(false);
      expect(stopped).not.toHaveBeenCalled();
      expect(stoppedAtFloor).not.toHaveBeenCalled();
      expect(floorButtonsChanged).not.toHaveBeenCalled();
    });
  });

  describe("floorInterfaces", () => {
    it("builds one facade per floor and keeps the real floors to itself", () => {
      // Issue #3: player code used to be handed the real Floor objects.
      const world = createWorld({ spawnRate: 0.001, floorCount: 4, elevatorCount: 1 });
      expect(world.floorInterfaces).toHaveLength(4);
      expect(world.floorInterfaces.map((f) => f.floorNum())).toEqual([0, 1, 2, 3]);
      for (const facade of world.floorInterfaces) {
        expect(world.floors).not.toContain(facade);
      }
    });

    it("reuses the same facades instead of rebuilding them every frame", () => {
      // Player code stores handlers on these, so they have to be stable.
      // Compared by identity: two facades over the same floor are structurally
      // equal, so toEqual would pass even if the world rebuilt them all.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const before = [...world.floorInterfaces];
      world.update(0.1);
      world.update(0.1);
      expect(world.floorInterfaces).toHaveLength(before.length);
      for (const [index, facade] of before.entries()) {
        expect(world.floorInterfaces[index]).toBe(facade);
      }
    });

    it("forwards a floor's button presses to its facade", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const pressed = vi.fn();
      at(world.floorInterfaces, 1).on("up_button_pressed", pressed);

      at(world.floors, 1).pressUpButton();

      expect(pressed).toHaveBeenCalledWith(at(world.floorInterfaces, 1));
    });

    it("runs the world's own floor handlers before player code", () => {
      // The world re-arrives a standing elevator on a button press. That has to
      // have happened by the time player code sees the event, exactly as when
      // player code registered directly on the Floor after the world did.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      at(world.elevators, 0).setFloorPosition(1);
      let queueWhenNotified: number[] = [];
      at(world.floorInterfaces, 1).on("up_button_pressed", () => {
        queueWhenNotified = [...at(world.elevatorInterfaces, 0).destinationQueue];
      });

      at(world.floors, 1).pressUpButton();

      expect(queueWhenNotified).toEqual([1]);
    });

    it("routes exceptions thrown by facade handlers to usercode_error", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const boom = new Error("boom");
      const errors = vi.fn();
      world.on("usercode_error", errors);
      at(world.floorInterfaces, 1).on("up_button_pressed", () => {
        throw boom;
      });

      at(world.floors, 1).pressUpButton();

      expect(errors).toHaveBeenCalledWith(boom);
    });
  });

  describe("refused passengers", () => {
    it("keeps the call button lit when the indicators change mid-arrival", () => {
      // Issue #110. The world notifies the floor of an arriving elevator before
      // it notifies the passengers standing on it, and the floor clears every
      // call button the elevator's indicators currently advertise. Player code
      // routinely retargets an elevator from a floor button handler, and those
      // handlers fire from inside this very dispatch - here, from the re-press
      // of a passenger who could not fit. The passengers offered after that
      // point see the new indicators, and the one whose direction is no longer
      // served was turned away without pressing their button again, leaving the
      // floor looking as though nobody was waiting on it.
      const world = createWorld(
        {
          spawnRate: 0.001,
          floorCount: 3,
          elevatorCount: 1,
          elevatorCapacities: [1],
        },
        ALWAYS_ZERO,
      );
      const elevator = at(world.elevators, 0);
      const floor = at(world.floors, 1);
      elevator.setFloorPosition(1);
      elevator.userEntering({ weight: 70 });

      // Two passengers on floor 1 heading in opposite directions.
      const goingDown = new User(70);
      goingDown.appearOnFloor(floor, 0);
      const goingUp = new User(70);
      goingUp.appearOnFloor(floor, 2);
      world.users.push(goingDown, goingUp);

      // Typical player code: retarget the elevator when a call comes in.
      floor.on("down_button_pressed", () => {
        elevator.goingUpIndicator = false;
      });

      elevator.trigger("entrance_available", elevator);

      // The full elevator turned the first passenger away and they re-pressed,
      // which switched the elevator to down only; the second was then refused
      // for direction with their button already cleared.
      expect(goingDown.parent).toBe(null);
      expect(goingUp.parent).toBe(null);
      expect(floor.buttonStates.down).toBe("activated");
      expect(floor.buttonStates.up).toBe("activated");
    });

    it("routes the re-press through button repressing, as any other call is", () => {
      // The rest of the #110 claim: the re-press is a real call, so it reaches
      // World.handleButtonRepressing and a suitable elevator standing at the
      // floor is re-arrived by it. Same setup as above, plus a second elevator
      // parked there that serves the direction the first one just stopped
      // serving.
      const world = createWorld(
        {
          spawnRate: 0.001,
          floorCount: 3,
          elevatorCount: 2,
          elevatorCapacities: [1, 4],
        },
        ALWAYS_ZERO,
      );
      const full = at(world.elevators, 0);
      const spare = at(world.elevators, 1);
      const floor = at(world.floors, 1);
      full.setFloorPosition(1);
      // Kept off the floor until the passengers are in place, so their own
      // call presses do not re-arrive it before the dispatch under test.
      spare.setFloorPosition(2);
      spare.goingDownIndicator = false;
      full.userEntering({ weight: 70 });

      const goingDown = new User(70);
      goingDown.appearOnFloor(floor, 0);
      const goingUp = new User(70);
      goingUp.appearOnFloor(floor, 2);
      world.users.push(goingDown, goingUp);

      floor.on("down_button_pressed", () => {
        full.goingUpIndicator = false;
      });
      spare.setFloorPosition(1);
      expect(at(world.elevatorInterfaces, 1).destinationQueue).toEqual([]);

      full.trigger("entrance_available", full);

      expect(goingUp.parent).toBe(null);
      expect(at(world.elevatorInterfaces, 1).destinationQueue).toEqual([1]);
    });

    it("dispatches the re-press even though it nests inside the call that caused it", () => {
      // Floor is an Observable, not a PlayerObservable, so it has no
      // re-entrancy guard - deliberately, and this is the path that needs it to
      // stay that way. The nested dispatch here carries the same event name and
      // the same floor as the one still in flight, so a per-event guard would
      // swallow it exactly.
      //
      // The chain: a down call arrives; player code answers it by lighting the
      // down indicator; that re-offers the entrance (38e7390); the first
      // passenger fills the capacity-1 car; the second cannot fit and presses
      // the button again, from inside the outer down_button_pressed.
      //
      // What a guard would cost is the nested World.handleButtonRepressing,
      // which is the whole mechanism by which a passenger who was turned away
      // gets a standing car re-offered to them. It re-offers nothing in this
      // particular case - the car is full - but the dispatch has to reach the
      // world's handler all the same, so the count below is of dispatches, not
      // of outcomes.
      //
      // It used to be counted off the world's stream instead, because the
      // handler draws a randomInt(0, elevatorCount - 1) before it looks and a
      // dropped draw would shift every later spawn. That draw now comes from
      // the world's derived button-repress stream, so the second assertion is
      // the one that says so: the press storm below takes nothing at all from
      // the stream the passengers come out of.
      const random = vi.fn(() => 0);
      const world = createWorld(
        {
          spawnRate: 0.001,
          floorCount: 3,
          elevatorCount: 1,
          elevatorCapacities: [1],
        },
        random,
      );
      const elevator = at(world.elevators, 0);
      const elevInterface = at(world.elevatorInterfaces, 0);
      const floor = at(world.floors, 1);
      elevator.setFloorPosition(1);
      elevInterface.goingUpIndicator(false);
      elevInterface.goingDownIndicator(false);

      // Two passengers on floor 1, both heading down; the first in the world's
      // list is the one who gets the single seat.
      const first = new User(70);
      const second = new User(70);
      world.users.push(first, second);
      first.appearOnFloor(floor, 0);
      second.appearOnFloor(floor, 0);
      // Clear the call the way an arriving elevator would, so the press below
      // is a fresh one that really dispatches.
      floor.elevatorAvailable({ goingUpIndicator: false, goingDownIndicator: true });
      expect(floor.buttonStates.down).toBe("");

      // Typical player code: serve the direction that was called for.
      const seen: unknown[] = [];
      at(world.floorInterfaces, 1).on("down_button_pressed", (pressed) => {
        seen.push(pressed);
        elevInterface.goingDownIndicator(true);
      });

      // Counted off the Floor rather than off a facade: this is the event the
      // world's own handler is subscribed to, so one dispatch here is one
      // handleButtonRepressing.
      let dispatches = 0;
      floor.on("down_button_pressed", () => {
        dispatches++;
      });

      random.mockClear();
      floor.pressDownButton();

      expect(first.parent).toBe(elevator);
      expect(second.parent).toBe(null);
      expect(floor.buttonStates.down).toBe("activated");
      // One dispatch for each handleButtonRepressing - the outer one and the
      // nested one. Guarding Floor would leave one.
      expect(dispatches).toBe(2);
      // And neither of them, nor the two boarding slots the same press storm
      // draws, came out of the world's own stream. That is what makes the
      // count above a question about dispatching rather than about replay.
      expect(random).not.toHaveBeenCalled();
      // Player code still sees the call once: the facade the event is forwarded
      // to is a PlayerObservable, and its guard absorbs the nested forward.
      // That is the split - the world's own handler runs, the player's does
      // not - and it is why the guard cannot simply be moved down onto Floor.
      expect(seen).toEqual([at(world.floorInterfaces, 1)]);
    });
  });

  describe("stopping en route", () => {
    /**
     * Sets up the building from upstream issue #124.
     *
     * One passenger stands on floor 1 wanting to go down, the car is parked on
     * floor 2, and its indicators advertise exactly the direction that
     * passenger wants — so nothing about the passenger, the call or the
     * signage can be what turns them away.
     *
     * @returns The world, the elevator, its facade and the waiting passenger.
     */
    function createWorldWithPassengerOnTheWay(): {
      world: World;
      elevator: Elevator;
      elevInterface: ElevatorInterface;
      waiting: User;
    } {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
      const elevator = at(world.elevators, 0);
      const elevInterface = at(world.elevatorInterfaces, 0);
      elevator.setFloorPosition(2);
      elevInterface.goingUpIndicator(false);
      elevInterface.goingDownIndicator(true);
      const waiting = new User(70);
      waiting.appearOnFloor(at(world.floors, 1), 0);
      world.users.push(waiting);
      return { world, elevator, elevInterface, waiting };
    }

    /**
     * Runs the world long enough for the car to travel and come to rest.
     *
     * @param world - The world to advance.
     */
    function run(world: World): void {
      for (let frame = 0; frame < 600; frame++) {
        world.update(1.0 / 60.0);
      }
    }

    it("leaves a passenger standing when stop() halts the car between floors", () => {
      // Upstream issue #124, "User doesn't enter the elevator when it stops
      // enroute": the reporter stops the car from a passing_floor handler and
      // expects the passenger on that floor to board. This reproduces it, and
      // it is not a defect - it is what stop() is. The car is travelling at
      // speed when the handler runs, so the nearest position it can physically
      // reach is the one it would coast to, which is past the floor. Boarding
      // is offered on arrival at a floor, and the car never arrives at one.
      const { world, elevator, elevInterface, waiting } = createWorldWithPassengerOnTheWay();
      const passed: [number, string][] = [];
      elevInterface.on("passing_floor", (floorNum, direction) => {
        passed.push([floorNum, direction]);
        elevInterface.stop();
      });

      elevInterface.goToFloor(0);
      run(world);

      expect(passed).toEqual([[1, "down"]]);
      expect(elevator.isMoving).toBe(false);
      // Below the floor it was asked to stop at, and not level with anything.
      expect(elevator.getExactCurrentFloor()).toBeLessThan(1);
      expect(elevator.isOnAFloor()).toBe(false);
      expect(waiting.parent).toBe(null);
    });

    it("boards that same passenger when the car is sent to their floor", () => {
      // The other half of the #124 answer, and the reason the first test is
      // about position and nothing else: same building, same passenger, same
      // indicators, one line different. What the reporter wanted is spelled
      // goToFloor.
      const { world, elevator, elevInterface, waiting } = createWorldWithPassengerOnTheWay();

      elevInterface.goToFloor(1);
      run(world);

      expect(elevator.isOnAFloor()).toBe(true);
      expect(waiting.parent).toBe(elevator);
    });
  });

  describe("button repressing", () => {
    it("re-arrives an idle elevator standing at the floor whose button was pressed", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);

      at(world.floors, 1).pressUpButton();

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([1]);
    });

    it("ignores elevators whose indicator points the other way", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      elevator.goingDownIndicator = false;

      at(world.floors, 1).pressDownButton();

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("ignores elevators standing at another floor", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      at(world.elevators, 0).setFloorPosition(2);

      at(world.floors, 1).pressUpButton();

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("re-arrives at most one elevator", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 3 });
      for (const elevator of world.elevators) {
        elevator.setFloorPosition(1);
      }

      at(world.floors, 1).pressUpButton();

      const queued = world.elevatorInterfaces.filter((i) => i.destinationQueue.length > 0);
      expect(queued).toHaveLength(1);
    });
  });

  describe("player code errors", () => {
    it("forwards errors thrown by floor event handlers", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const boom = new Error("boom");
      const reported = vi.fn();
      world.on("usercode_error", reported);
      at(world.floors, 0).on("up_button_pressed", () => {
        throw boom;
      });

      at(world.floors, 0).pressUpButton();

      expect(reported).toHaveBeenCalledWith(boom);
    });

    it("forwards errors thrown by elevator interface event handlers", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const boom = new Error("boom");
      const reported = vi.fn();
      world.on("usercode_error", reported);
      at(world.elevatorInterfaces, 0).on("idle", () => {
        throw boom;
      });

      world.init();

      expect(reported).toHaveBeenCalledWith(boom);
    });

    it("reports every failure of one dispatch, in handler order", () => {
      // What per-handler isolation actually buys. WorldController pauses on
      // the first usercode_error, so no *later* dispatch happens at all; the
      // isolation only ever spans the dispatch that is already running. Within
      // it, though, handlers after the thrower still run and each failure is
      // reported separately.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const first = new Error("first");
      const second = new Error("second");
      const third = vi.fn();
      const reported = vi.fn();
      world.on("usercode_error", reported);
      const facade = at(world.floorInterfaces, 0);
      facade.on("up_button_pressed", () => {
        throw first;
      });
      facade.on("up_button_pressed", () => {
        throw second;
      });
      facade.on("up_button_pressed", third);

      at(world.floors, 0).pressUpButton();

      expect(reported.mock.calls).toEqual([[first], [second]]);
      expect(third).toHaveBeenCalledTimes(1);
    });
  });

  describe("init", () => {
    it("makes every idle elevator announce itself", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 2 });
      const idle = vi.fn();
      for (const elevatorInterface of world.elevatorInterfaces) {
        elevatorInterface.on("idle", idle);
      }

      world.init();

      expect(idle).toHaveBeenCalledTimes(2);
    });
  });

  describe("unWind", () => {
    it("ends the challenge and empties the world", () => {
      const world = createWorld({ spawnRate: 0.5 });
      world.update(0.1);

      world.unWind();

      expect(world.challengeEnded).toBe(true);
      expect(world.elevators).toEqual([]);
      expect(world.elevatorInterfaces).toEqual([]);
      expect(world.users).toEqual([]);
      expect(world.floors).toEqual([]);
      expect(world.floorInterfaces).toEqual([]);
    });

    it("gives each collection its own empty array", () => {
      const world = createWorld();
      world.unWind();
      world.users.push(createRandomUser(ALWAYS_ZERO, WALK_OFF_UNUSED));
      expect(world.floors).toHaveLength(0);
      expect(world.elevators).toHaveLength(0);
    });

    it("drops every subscription", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const floor = at(world.floors, 0);
      const elevatorInterface = at(world.elevatorInterfaces, 0);
      const buttonPressed = vi.fn();
      const idle = vi.fn();
      const floorInterface = at(world.floorInterfaces, 0);
      const facadePressed = vi.fn();
      floor.on("up_button_pressed", buttonPressed);
      floorInterface.on("up_button_pressed", facadePressed);
      elevatorInterface.on("idle", idle);

      world.unWind();
      floor.pressUpButton();
      elevatorInterface.checkDestinationQueue();

      expect(buttonPressed).not.toHaveBeenCalled();
      expect(facadePressed).not.toHaveBeenCalled();
      expect(idle).not.toHaveBeenCalled();
    });
  });

  describe("updateDisplayPositions", () => {
    it("refreshes the cached draw positions of elevators and users", () => {
      const { world, user } = createWorldWithWaitingUser();
      const elevator = at(world.elevators, 0);
      elevator.moveTo(123, 456);
      user.moveTo(11, 22);

      world.updateDisplayPositions();

      expect(elevator.worldX).toBe(123);
      expect(elevator.worldY).toBe(456);
      expect(user.worldX).toBe(11);
      expect(user.worldY).toBe(22);
    });
  });

  it("satisfies the contract WorldController drives it through", () => {
    // The assignment is the assertion: `ControllableWorld` is declared
    // structurally in `world-controller.ts` to keep the two modules acyclic,
    // so nothing would otherwise check that `World` still fits it.
    const controllable: ControllableWorld = createWorld();
    expect(controllable.floorInterfaces).toHaveLength(4);
    expect(controllable.challengeEnded).toBe(false);
  });
});

/** One passenger's arrival, as anything watching the world can see it. */
interface SpawnTrace {
  /** World time the passenger appeared at. */
  spawnTimestamp: number;
  /** Floor they appeared on. */
  currentFloor: number;
  /** Floor they asked for. */
  destinationFloor: number;
  /** Their weight. */
  weight: number;
  /** How they are drawn. */
  displayType: string | undefined;
}

/** The statistics a run ended on. */
interface RunStats {
  /** Passengers delivered. */
  transportedCounter: number;
  /** Passengers delivered per simulated second. */
  transportedPerSec: number;
  /** Mean wait time of delivered passengers. */
  avgWaitTime: number;
  /** Longest anybody waited. */
  maxWaitTime: number;
  /** Total floor changes across all elevators. */
  moveCount: number;
}

/** Everything an observer of a whole run can see of it. */
interface RunTrace {
  /** Every passenger the run spawned, in order. */
  spawns: SpawnTrace[];
  /**
   * The slot every boarding passenger was put in, in boarding order.
   *
   * Recorded as `<elevator index>:<slot index>`. The one thing in the trace the
   * elevators' own stream decides, and the only way to see that stream at all
   * from outside: nothing else the simulation reports changes with it.
   */
  boardingSlots: string[];
  /** The statistics the run ended on. */
  stats: RunStats;
  /** How many passengers were still in the building at the end. */
  usersLeft: number;
}

/** Simulated seconds per frame, as the real game and the fitness suite run it. */
const TRACE_STEP_SECONDS = 1.0 / 60.0;

/** Frames a traced run simulates: one minute of game time. */
const TRACE_FRAMES = 3600;

/**
 * Runs a world for a fixed minute and records what an observer would see.
 *
 * The elevators are driven by the simplest strategy that actually delivers
 * anybody - sweep up, wrap at the top - so the trace covers boarding, exits and
 * the statistics as well as the spawns themselves, and the slot each passenger
 * ends up in on top of that: the two streams a seed drives are both visible
 * here, which is what lets one seed be held to reproducing the whole run.
 *
 * @param random - Seed or stream to build the world with.
 * @returns The trace, and the world it came from.
 */
function traceRun(random?: RandomSeed | RandomSource): { trace: RunTrace; world: World } {
  const floorCount = 4;
  const world = createWorld({ floorCount, elevatorCount: 2, spawnRate: 1.2 }, random);
  const spawns: SpawnTrace[] = [];
  const boardingSlots: string[] = [];
  world.on("new_user", (user) => {
    spawns.push({
      spawnTimestamp: user.spawnTimestamp,
      currentFloor: user.currentFloor,
      destinationFloor: user.destinationFloor,
      weight: user.weight,
      displayType: user.displayType,
    });
    user.on("entered_elevator", (elevator) => {
      const slot = elevator.userSlots.findIndex((occupied) => occupied.user === user);
      boardingSlots.push(`${String(world.elevators.indexOf(elevator))}:${String(slot)}`);
    });
  });
  for (const elevatorInterface of world.elevatorInterfaces) {
    elevatorInterface.on("idle", () => {
      elevatorInterface.goToFloor((elevatorInterface.currentFloor() + 1) % floorCount);
    });
  }
  world.init();
  for (let frame = 0; frame < TRACE_FRAMES; frame++) {
    world.update(TRACE_STEP_SECONDS);
  }
  return {
    world,
    trace: {
      spawns,
      boardingSlots,
      stats: {
        transportedCounter: world.transportedCounter,
        transportedPerSec: world.transportedPerSec,
        avgWaitTime: world.avgWaitTime,
        maxWaitTime: world.maxWaitTime,
        moveCount: world.moveCount,
      },
      usersLeft: world.users.length,
    },
  };
}

describe("seeded runs", () => {
  it("replays a run exactly from the same seed", () => {
    // The whole point of the exercise: a failed run, a surprising score or a
    // divergence from the legacy engine can be looked at again.
    const first = traceRun("rush-hour").trace;
    const second = traceRun("rush-hour").trace;

    expect(first.spawns.length).toBeGreaterThan(50);
    expect(first.stats.transportedCounter).toBeGreaterThan(10);
    expect(second).toEqual(first);
  });

  it("gives different seeds different runs", () => {
    const first = traceRun("rush-hour").trace;
    const other = traceRun("quiet-afternoon").trace;

    expect(other.spawns).not.toEqual(first.spawns);
    expect(other.stats).not.toEqual(first.stats);
    expect(other.boardingSlots).not.toEqual(first.boardingSlots);
  });

  it("stands every passenger in the same slot on a replay of the same seed", () => {
    // The last draw in the engine that a seed did not account for. It decides
    // nothing but where a passenger is drawn inside the car, so nothing else in
    // the trace moves when it changes - which is exactly why it needs saying
    // separately that it, too, comes back the same.
    const first = traceRun("rush-hour").trace.boardingSlots;
    const second = traceRun("rush-hour").trace.boardingSlots;

    expect(first.length).toBeGreaterThan(20);
    // Otherwise a car that always handed out slot 0 would pass this untouched.
    expect(new Set(first).size).toBeGreaterThan(2);
    expect(second).toEqual(first);
  });

  it("reaches the unseeded Math.random nowhere once it has its seed", () => {
    // The guarantee with the caveat gone: a seeded run makes every draw it
    // makes from a stream the seed determines, so there is nothing left in it
    // for a replay to get wrong. Worth stating as a whole-run property rather
    // than trusting to the absence of a call, because a new call site is
    // exactly the kind of thing that gets added without anybody noticing.
    const global = vi.spyOn(Math, "random").mockReturnValue(0);
    const trace = traceRun("rush-hour").trace;

    expect(trace.spawns.length).toBeGreaterThan(50);
    expect(trace.boardingSlots.length).toBeGreaterThan(20);
    expect(global).not.toHaveBeenCalled();
  });

  it("keeps boarding out of the stream the simulation runs on", () => {
    // Why the elevators get a stream of their own rather than the world's: the
    // world spawns its passengers from its stream, so a slot draw landing in it
    // would shift every later spawn, and every seed anybody has already written
    // down would quietly start replaying a different run. Boarding is also the
    // kind of draw that comes and goes as the rendering changes, which is
    // precisely what must never reach that sequence.
    const random = vi.fn(() => 0);
    const world = createWorld({ floorCount: 3, elevatorCount: 1 }, random);
    const elevator = at(world.elevators, 0);
    const user = new User(70, random);
    world.users.push(user);
    user.appearOnFloor(at(world.floors, 1), 2);
    elevator.setFloorPosition(1);

    random.mockClear();
    const global = vi.spyOn(Math, "random");
    elevator.trigger("entrance_available", elevator);

    // The passenger did board, so a slot was drawn - from neither of these.
    expect(user.parent).toBe(elevator);
    expect(random).not.toHaveBeenCalled();
    expect(global).not.toHaveBeenCalled();
  });

  it("keeps button repressing out of the stream the simulation runs on", () => {
    // The same argument as boarding slots, for the offset the re-offer sweep
    // starts at. A press happens when a passenger a car turned away tries
    // again, which is a moment the elevators decide and the frame clock moves,
    // so a draw taken here used to walk the spawn stream forward by an amount
    // that depended on how the frames fell.
    const random = vi.fn(() => 0);
    const world = createWorld({ floorCount: 3, elevatorCount: 2, spawnRate: 0.001 }, random);
    for (const elevator of world.elevators) {
      elevator.setFloorPosition(1);
    }

    random.mockClear();
    const global = vi.spyOn(Math, "random");
    at(world.floors, 1).pressUpButton();

    // The sweep ran and re-offered the floor, so an offset was drawn - from
    // neither of these.
    expect(world.elevatorInterfaces.some((e) => e.destinationQueue.length > 0)).toBe(true);
    expect(random).not.toHaveBeenCalled();
    expect(global).not.toHaveBeenCalled();
  });

  it("draws the re-offered elevator from a stream the seed reproduces", () => {
    // The other half: keeping the offset out of the spawn stream would be no
    // improvement if it stopped being replayable on the way out. Four cars all
    // standing at the pressed floor and all willing to take it, so the one that
    // ends up with the destination is exactly the offset the sweep drew.
    const chooseElevator = (seed: RandomSeed): number => {
      const world = createWorld({ floorCount: 3, elevatorCount: 4, spawnRate: 0.001 }, seed);
      for (const elevator of world.elevators) {
        elevator.setFloorPosition(1);
      }
      at(world.floors, 1).pressUpButton();
      return world.elevatorInterfaces.findIndex((e) => e.destinationQueue.length > 0);
    };
    const seeds: readonly RandomSeed[] = [1, 2, 3, 4, 5, 6, 7, 8];

    const chosen = seeds.map(chooseElevator);

    // Every press was answered, the answer really is drawn rather than always
    // the first car, and asking the same seeds again gives the same answers.
    expect(chosen).not.toContain(-1);
    expect(new Set(chosen).size).toBeGreaterThan(1);
    expect(seeds.map(chooseElevator)).toEqual(chosen);
  });

  it("keeps a delivered passenger's walk-off out of the stream that spawned them", () => {
    // The third of the three, and the one that fires latest: the duration is
    // drawn when a passenger steps out, which needs the player's program to
    // have sent a car to the right floor and the car to have braked onto it.
    // Nothing in a run is further from being decided by the seed alone.
    const floorCount = 3;
    const random = vi.fn(createRandomSource("walk-off-isolation"));
    // A rate this low spawns exactly one passenger, on the first frame - the
    // accumulator starts one thousandth of an interval past the threshold - and
    // then nobody for the next thousand seconds, so any draw seen after the
    // first frame is a draw the delivery made.
    const world = createWorld({ floorCount, elevatorCount: 1, spawnRate: 0.001 }, random);
    let delivered = 0;
    world.on("new_user", (user) => {
      user.on("exited_elevator", () => {
        delivered++;
      });
    });
    for (const elevatorInterface of world.elevatorInterfaces) {
      elevatorInterface.on("idle", () => {
        elevatorInterface.goToFloor((elevatorInterface.currentFloor() + 1) % floorCount);
      });
    }
    world.init();
    world.update(TRACE_STEP_SECONDS);
    expect(world.users).toHaveLength(1);

    random.mockClear();
    const global = vi.spyOn(Math, "random");
    for (let frame = 0; frame < TRACE_FRAMES && delivered === 0; frame++) {
      world.update(TRACE_STEP_SECONDS);
    }

    // The walk-off duration is drawn inside the same update that delivered
    // them, so by the time the loop stops the draw has been taken.
    expect(delivered).toBe(1);
    expect(random).not.toHaveBeenCalled();
    expect(global).not.toHaveBeenCalled();
  });

  it("makes a run nobody seeded replayable after the fact", () => {
    // A run is only ever known to be worth repeating once it has gone wrong, so
    // an unseeded world still records the seed it generated for itself.
    const original = traceRun();
    const seed = original.world.seed;
    if (seed === null) {
      throw new Error("an unseeded world must still record the seed it generated");
    }
    expect(typeof seed).toBe("number");

    expect(traceRun(seed).trace).toEqual(original.trace);
  });

  it("records the seed it was handed, whatever its shape", () => {
    expect(createWorld({}, "issue-61").seed).toBe("issue-61");
    expect(createWorld({}, 1234).seed).toBe(1234);
  });

  it("treats a number and its string form as the same seed", () => {
    // Seeds are hashed from their string form, so a seed that made the round
    // trip through a URL or an input field still replays its run.
    expect(traceRun(1234).trace).toEqual(traceRun("1234").trace);
  });

  it("reports no seed when a ready-made stream was injected", () => {
    // Nothing to record, and nothing to hide: whoever built the stream can
    // rebuild it. Only tests do this.
    expect(createWorld({}, ALWAYS_ZERO).seed).toBeNull();
  });

  it("generates a fresh seed for every unseeded world", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => createWorld().seed));
    expect(seeds.size).toBe(50);
  });

  it("draws its generated seeds from the whole 32 bit range", () => {
    const seed = generateRandomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
