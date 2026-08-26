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

/** Collects every user a world spawns. */
function collectUsers(world: World): User[] {
  const users: User[] = [];
  world.on("new_user", (user) => {
    users.push(user);
  });
  return users;
}

/** A stream stuck at zero, which sends every draw to the bottom of its range. */
const ALWAYS_ZERO: RandomSource = () => 0;

/** A three-floor building whose passengers all appear in the lobby; the third floor lets a test send the one car away from a waiting passenger. */
function waitingWorld(spawnRate: number): World {
  return createWorld({ spawnRate, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
}

/**
 * A two-floor building whose one car stands where its passengers appear, so every spawn
 * is picked up on the frame it appears; a delivery in a test is guaranteed to be a real one.
 */
function deliveryWorld(spawnRate: number): World {
  return createWorld({ spawnRate, floorCount: 2, elevatorCount: 1 }, ALWAYS_ZERO);
}

/** A walk-off stream that fails the test if anybody draws from it. */
const WALK_OFF_UNUSED: RandomSource = () => {
  throw new Error("A passenger drew a walk-off duration without having been delivered");
};

/** Wraps a stream so the test can see what was taken from it. */
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
 * Advances a world whose spawn loop might not terminate, failing the test instead of hanging the run.
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
 * Counts the spawns an unguarded loop would make, frame by frame, so the guarded engine's
 * counts can be checked against the exact sequence of doubles that arithmetic produces.
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
 * Builds a world with exactly one user waiting on floor 0; the elevator is parked at the
 * top so it neither re-arrives nor picks the user up on its own.
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

  it("gives every floor call buttons unless the building asked otherwise", () => {
    const floors = createFloors(4, 50, () => undefined);
    expect(floors.map((f) => f.destinationDispatch)).toEqual([false, false, false, false]);
  });

  it("gives every floor a destination panel when the building asked for one", () => {
    const floors = createFloors(4, 50, () => undefined, true);
    expect(floors.map((f) => f.destinationDispatch)).toEqual([true, true, true, true]);
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

  it("leaves every elevator serving every floor when no zones are given", () => {
    const elevators = createElevators(2, 4, 50);
    for (const elevator of elevators) {
      expect([0, 1, 2, 3].every((floor) => elevator.serves(floor))).toBe(true);
    }
  });

  it("cycles the zone list when it is shorter than the elevator count", () => {
    const elevators = createElevators(3, 4, 50, undefined, undefined, [
      [0, 1],
      [0, 2, 3],
    ]);
    expect(elevators.map((e) => [0, 1, 2, 3].filter((floor) => e.serves(floor)))).toEqual([
      [0, 1],
      [0, 2, 3],
      [0, 1],
    ]);
  });

  it("reads an empty zone as every floor", () => {
    const elevators = createElevators(2, 4, 50, undefined, undefined, [[0, 1], []]);
    expect(at(elevators, 0).serves(3)).toBe(false);
    expect(at(elevators, 1).serves(3)).toBe(true);
  });

  it("leaves every elevator serving every floor when the zone list is empty", () => {
    const elevators = createElevators(2, 4, 50, undefined, undefined, []);
    for (const elevator of elevators) {
      expect([0, 1, 2, 3].every((floor) => elevator.serves(floor))).toBe(true);
    }
  });

  it("gives each elevator the building's floor count and height", () => {
    const elevators = createElevators(1, 6, 40);
    const elevator = at(elevators, 0);
    expect(elevator.getYPosOfFloor(0)).toBe((6 - 1) * 40);
    expect(elevator.getYPosOfFloor(5)).toBe(0);
  });

  it("parks the elevators without counting that as a move", () => {
    const elevators = createElevators(3, 4, 50);
    expect(elevators.map((e) => e.moveCount)).toEqual([0, 0, 0]);
  });

  it("puts the elevators at the bottom floor's y position", () => {
    // y is the bottom floor of a 4-floor, 50-unit building.
    const elevators = createElevators(2, 4, 50);
    expect(elevators.map((e) => e.y)).toEqual([150, 150]);
    expect(elevators.map((e) => e.x)).toEqual([200.0, 200.0 + 20 + 40]);
  });

  it("hands every elevator the stream their boarding slots come from", () => {
    // 0.99 puts every scan at the last slot; Math.random is watched too, since
    // one car in four would land there by chance anyway.
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
    // Draw order is pinned: reordering would silently change what a seed reproduces.
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
    // Skips the origin-floor draw when already in the lobby.
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

  it("draws the same whether the profile is omitted or spelled out", () => {
    // Two hundred iterations because a mixed trip's draw count varies by branch, so a
    // wrong count would only show up as a cumulative offset over many draws.
    const floors = createFloors(6, 50, () => undefined);
    const omitted = recordDraws(createRandomSource("profile-parity"));
    const explicit = recordDraws(createRandomSource("profile-parity"));

    for (let i = 0; i < 200; ++i) {
      spawnUserRandomly(6, 50, floors, omitted.random, WALK_OFF_UNUSED);
      spawnUserRandomly(6, 50, floors, explicit.random, WALK_OFF_UNUSED, "mixed");
    }

    expect(explicit.values).toEqual(omitted.values);
    // Guards against both draw lists being empty, which would pass vacuously.
    expect(omitted.values.length).toBeGreaterThanOrEqual(200 * 5);
  });

  it("sends everyone up out of the lobby at the morning peak", () => {
    const floorCount = 6;
    const floors = createFloors(floorCount, 50, () => undefined);
    const random = createRandomSource("up-peak");

    for (let i = 0; i < 300; ++i) {
      const user = spawnUserRandomly(floorCount, 50, floors, random, WALK_OFF_UNUSED, "up-peak");
      expect(user.currentFloor).toBe(0);
      expect(user.destinationFloor).toBeGreaterThan(0);
      expect(user.destinationFloor).toBeLessThan(floorCount);
    }

    for (const floor of floors) {
      expect(floor.buttonStates.down).toBe("");
    }
  });

  it("brings everyone down to the lobby at the evening peak", () => {
    const floorCount = 6;
    const floors = createFloors(floorCount, 50, () => undefined);
    const random = createRandomSource("down-peak");

    for (let i = 0; i < 300; ++i) {
      const user = spawnUserRandomly(floorCount, 50, floors, random, WALK_OFF_UNUSED, "down-peak");
      expect(user.currentFloor).toBeGreaterThan(0);
      expect(user.currentFloor).toBeLessThan(floorCount);
      expect(user.destinationFloor).toBe(0);
    }

    for (const floor of floors) {
      expect(floor.buttonStates.up).toBe("");
    }
  });

  it("runs both ways at lunch, and every trip touches the lobby", () => {
    const floorCount = 6;
    const floors = createFloors(floorCount, 50, () => undefined);
    const random = createRandomSource("lunch");
    let up = 0;
    let down = 0;

    for (let i = 0; i < 300; ++i) {
      const user = spawnUserRandomly(floorCount, 50, floors, random, WALK_OFF_UNUSED, "lunch");
      expect(Math.min(user.currentFloor, user.destinationFloor)).toBe(0);
      expect(Math.max(user.currentFloor, user.destinationFloor)).toBeGreaterThan(0);
      if (user.currentFloor === 0) {
        up += 1;
      } else {
        down += 1;
      }
    }

    // Confirms both directions occur; the checks above alone would pass even
    // if lunch collapsed into one direction.
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });

  it("spends a flat number of draws under a peak, whichever passenger it is", () => {
    // A mixed trip costs two to four draws depending on branches; a peak has
    // no branch, so only the child roll varies the count.
    const floors = createFloors(4, 50, () => undefined);
    // weight, child roll, gender roll, spawn offset; then the trip.
    const adult = [0, 0.5, 0.5, 0];

    const upPeak = recordDraws(scriptedRandom([...adult, 0.5]));
    spawnUserRandomly(4, 50, floors, upPeak.random, WALK_OFF_UNUSED, "up-peak");
    expect(upPeak.values).toHaveLength(5);

    const downPeak = recordDraws(scriptedRandom([...adult, 0.5]));
    spawnUserRandomly(4, 50, floors, downPeak.random, WALK_OFF_UNUSED, "down-peak");
    expect(downPeak.values).toHaveLength(5);

    const lunch = recordDraws(scriptedRandom([...adult, 0.5, 0.5]));
    spawnUserRandomly(4, 50, floors, lunch.random, WALK_OFF_UNUSED, "lunch");
    expect(lunch.values).toHaveLength(6);

    // A child roll skips the gender draw, one fewer.
    const child = recordDraws(scriptedRandom([0, 0 /* child */, 0, 0.5]));
    spawnUserRandomly(4, 50, floors, child.random, WALK_OFF_UNUSED, "up-peak");
    expect(child.values).toHaveLength(4);
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
    expect(world.levelEnded).toBe(false);
  });

  it("honors the level options", () => {
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
      // A negative or infinite rate can make the spawn loop's while never
      // exit, freezing the tab with no error and no stack.
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
          // 1/Infinity and 1/-Infinity both round to zero, so the subtraction
          // never moves the accumulator.
          const world = createWorld({ spawnRate }, "infinite-rate");
          const spawned = collectUsers(world);

          updateWithoutRunawaySpawning(world, 10);

          expect(spawned).toEqual([]);
        },
      );

      it("keeps going, and says so once, rather than throwing", () => {
        const world = createWorld({ spawnRate: -2, floorCount: 3, elevatorCount: 1 }, "reported");
        updateWithoutRunawaySpawning(world, 0.1);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).toContain("-2");
        expect(world.elapsedTime).toBeCloseTo(0.1, 10);
      });

      it("stays quiet about a rate of zero", () => {
        createWorld({ spawnRate: 0 });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    it("leaves the spawn timing of every positive rate exactly as it was", () => {
      const steps = [0.1, 1.8, 0.2, 5.0, ...Array.from({ length: 120 }, () => 1.0 / 60.0)];

      for (const spawnRate of [0.001, 0.01, 0.5, 0.6, 1, 1.9, 3, 10, 123.456]) {
        const world = createWorld({ spawnRate, floorCount: 3, elevatorCount: 1 }, "timing");
        const spawned = collectUsers(world);

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
      // 4 crossings carrying 2.0 total, 1 crossing carrying 0, is 2.0 over 5 moves.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 2 });
      at(world.elevators, 0).moveCount = 4;
      at(world.elevators, 0).loadFactorSumOnMove = 2.0;
      at(world.elevators, 1).moveCount = 1;
      at(world.elevators, 1).loadFactorSumOnMove = 0;
      world.update(0.1);
      expect(world.avgLoadFactorOnMove).toBeCloseTo(0.4, 10);
    });

    it("reports no load rather than NaN while nothing has moved", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 4, elevatorCount: 2 });
      world.update(0.1);
      expect(world.moveCount).toBe(0);
      expect(world.avgLoadFactorOnMove).toBe(0);
    });

    it("sums the stop counts of all elevators", () => {
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 2 });
      world.update(0.1);
      // stopCount is overwritten directly, so any real stop from the update
      // above doesn't matter.
      at(world.elevators, 0).stopCount = 5;
      at(world.elevators, 1).stopCount = 2;
      world.update(0.1);
      expect(world.stopCount).toBe(7);
    });

    it("counts everyone who got in or out against the stops that were made", () => {
      // One boarding and one delivery over four door openings is 0.5. The car is parked at
      // the top, as the wait-for-a-car tests below do, so the passenger boards via this test
      // rather than the simulation, and stopCount is overwritten so the divisor is chosen here.
      const world = waitingWorld(0.5);
      const spawned = collectUsers(world);
      const elevator = at(world.elevators, 0);
      elevator.goToFloor(2);
      world.update(0.1);
      for (let frame = 0; frame < 600 && elevator.isMoving; frame++) {
        world.update(1.0 / 60.0);
      }
      expect(elevator.isMoving).toBe(false);

      elevator.stopCount = 4;
      at(spawned, 0).trigger("entered_elevator", elevator);
      at(spawned, 0).trigger("exited_elevator", elevator);
      world.update(0.1);

      expect(world.stopCount).toBe(4);
      expect(world.avgPeoplePerStop).toBeCloseTo(0.5, 10);
    });

    it("reports nobody per stop rather than NaN before any doors have opened", () => {
      // Same zero-denominator guard as the load factor above.
      const world = waitingWorld(0.001);
      at(world.elevators, 0).setFloorPosition(2);
      world.update(0.1);
      expect(world.stopCount).toBe(0);
      expect(world.avgPeoplePerStop).toBe(0);
    });

    it("averages the ride from the moment of boarding to the moment of delivery", () => {
      // One second waiting, three riding, four total.
      const world = waitingWorld(0.5);
      const spawned = collectUsers(world);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(1.0);
      at(spawned, 0).trigger("entered_elevator", at(world.elevators, 0));
      world.update(3.0);
      at(spawned, 0).trigger("exited_elevator", at(world.elevators, 0));

      expect(world.avgPickupTime).toBeCloseTo(1.0, 10);
      expect(world.avgRideTime).toBeCloseTo(3.0, 10);
      expect(world.avgWaitTime).toBeCloseTo(4.0, 10);
      expect(world.avgPickupTime + world.avgRideTime).toBeCloseTo(world.avgWaitTime, 10);
    });

    it("averages the ride over deliveries, not over boardings", () => {
      // Two board; only the delivered one's 2s counts, not both boardings.
      const world = waitingWorld(0.5);
      const spawned = collectUsers(world);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(2.0);
      at(spawned, 0).trigger("entered_elevator", at(world.elevators, 0));
      at(spawned, 1).trigger("entered_elevator", at(world.elevators, 0));
      world.update(2.0);
      at(spawned, 0).trigger("exited_elevator", at(world.elevators, 0));

      expect(world.transportedCounter).toBe(1);
      expect(world.avgRideTime).toBeCloseTo(2.0, 10);
    });

    it("reads a delivery with no boarding behind it as a ride the whole journey long", () => {
      // No boarding path skips pickupTimestamp, so the fallback treats the whole 2s as ride time.
      const world = waitingWorld(0.5);
      const spawned = collectUsers(world);
      at(world.elevators, 0).goToFloor(2);
      world.update(0.1);
      world.update(2.0);
      const user = at(spawned, 0);
      expect(user.pickupTimestamp).toBeNull();

      user.trigger("exited_elevator", at(world.elevators, 0));

      expect(world.avgRideTime).toBeCloseTo(2.0, 10);
    });

    it("stops the wait for a car at the moment a car takes them", () => {
      // 1s waiting, then 5s riding: maxWaitTime keeps growing through the ride
      // but maxPickupTime stops at boarding.
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
      // One passenger every 2s: first waits 1s, second waits 3s, mean 2.
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
      // A car arriving inside update() boards its passenger after the clock
      // advances, so the last frame is recorded here, not by the per-frame
      // sweep; exact equality catches a max that is short by one frame.
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
      // A never-picked-up passenger has no boarding event, so this stat must
      // update independent of boarding.
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
      // A delivered passenger walks off-screen for another 1-1.5s while still
      // in world.users; that time must not count toward maxWaitTime.
      const world = deliveryWorld(0.5);
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);

      const user = at(spawned, 0);
      user.done = true;
      user.trigger("exited_elevator", at(world.elevators, 0));
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);

      world.update(1.0);

      expect(world.users).toContain(user);
      expect(world.maxWaitTime).toBeCloseTo(1.0, 10);
    });

    it("still extends the longest wait for passengers who are still waiting", () => {
      // Only the delivered passenger is excluded; everyone else keeps
      // accruing wait time.
      const world = deliveryWorld(1);
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
      // users is in spawn order, so the answer is the first one still in the
      // building.
      const world = deliveryWorld(1);
      const spawned = collectUsers(world);
      world.update(0.1);
      world.update(1.0);

      expect(spawned.length).toBeGreaterThan(1);
      expect(world.users.filter((user) => user.waitingLongest)).toEqual([at(spawned, 0)]);
    });

    it("hands the flag on when that passenger is delivered", () => {
      // The mark moves to the new longest waiter the moment the old one is
      // delivered.
      const world = deliveryWorld(1);
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
      // A delivered passenger stays in users for another 1.5s with no wait
      // reported, so nobody should be marked.
      const world = deliveryWorld(0.5);
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
      // The longest-waiting passenger is the one least likely to be moving, so its handover
      // must announce itself; that should cost one announcement each way, however many
      // frames pass on either side of it.
      const world = deliveryWorld(1);
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
      const world = deliveryWorld(0.5);
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
      // The spawn's own call-button press re-arrives the idle elevator, so
      // boarding happens in the same update.
      const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 }, ALWAYS_ZERO);
      const spawned = collectUsers(world);

      world.update(0.1);

      expect(at(spawned, 0).parent).toBe(at(world.elevators, 0));
    });
  });

  describe("indicator changes", () => {
    /** Builds a world with one elevator (down indicator only) and a passenger waiting to go up. */
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
      const { elevator, elevInterface, user } = createWorldWithRefusedUser();
      expect(user.currentFloor).toBe(0);
      expect(user.destinationFloor).toBe(1);
      expect(user.parent).toBe(null);

      elevInterface.goingUpIndicator(true);

      expect(user.parent).toBe(elevator);
    });

    it("clears the call button of the floor the elevator is standing at", () => {
      // The floor's own button state is re-checked too, not just waiting passengers.
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
      // The re-offer is a boarding path with its own one-second dwell, so a
      // car it just filled cannot also depart within the same frame.
      const { world, elevator, elevInterface, user } = createWorldWithRefusedUser();
      const parkedY = elevator.y;

      elevInterface.goingUpIndicator(true);
      expect(user.parent).toBe(elevator);
      expect(user.isBusy()).toBe(true);
      // The player's update() would typically ask for the next floor in the same frame.
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
      const world = createWorld({ spawnRate: 0.001, floorCount: 4, elevatorCount: 1 });
      expect(world.floorInterfaces).toHaveLength(4);
      expect(world.floorInterfaces.map((f) => f.floorNum())).toEqual([0, 1, 2, 3]);
      for (const facade of world.floorInterfaces) {
        expect(world.floors).not.toContain(facade);
      }
    });

    it("reuses the same facades instead of rebuilding them every frame", () => {
      // Compared by identity: structurally equal facades would still pass
      // player code that stored handlers on the originals.
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
      // The floor clears a call button before offering the elevator to waiting passengers, so
      // a handler that retargets the elevator mid-dispatch (e.g. a re-press) can leave a later
      // passenger turned away with their button already cleared.
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

      // The full elevator refuses the first passenger, whose re-press flips
      // the elevator to down-only, so the second is refused with no button lit.
      expect(goingDown.parent).toBe(null);
      expect(goingUp.parent).toBe(null);
      expect(floor.buttonStates.down).toBe("activated");
      expect(floor.buttonStates.up).toBe("activated");
    });

    it("routes the re-press through button repressing, as any other call is", () => {
      // The re-press is a real call, answered by a second elevator serving the
      // direction the first stopped serving.
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
      // Floor has no re-entrancy guard, deliberately: a re-press nested inside the very
      // button-press dispatch that caused it must still reach the world's repress handler,
      // even though the player-facing facade would swallow the same nested event.
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

      // Both passengers want to go down; the first in the list gets the single seat.
      const first = new User(70);
      const second = new User(70);
      world.users.push(first, second);
      first.appearOnFloor(floor, 0);
      second.appearOnFloor(floor, 0);
      // Clears the call so the press below is a fresh dispatch, not a no-op.
      floor.elevatorAvailable({
        goingUpIndicator: false,
        goingDownIndicator: true,
        serves: () => true,
      });
      expect(floor.buttonStates.down).toBe("");

      const seen: unknown[] = [];
      at(world.floorInterfaces, 1).on("down_button_pressed", (pressed) => {
        seen.push(pressed);
        elevInterface.goingDownIndicator(true);
      });

      // Counted on Floor, not the facade: that's what the world's own handler subscribes to.
      let dispatches = 0;
      floor.on("down_button_pressed", () => {
        dispatches++;
      });

      random.mockClear();
      floor.pressDownButton();

      expect(first.parent).toBe(elevator);
      expect(second.parent).toBe(null);
      expect(floor.buttonStates.down).toBe("activated");
      // One dispatch each for the outer and nested press; a re-entrancy guard
      // would leave only one.
      expect(dispatches).toBe(2);
      // Neither draw came from the world's own stream, so this is purely
      // about dispatching, not replay.
      expect(random).not.toHaveBeenCalled();
      // Player code still sees the call once: the facade is a
      // PlayerObservable, whose re-entrancy guard absorbs the nested forward.
      expect(seen).toEqual([at(world.floorInterfaces, 1)]);
    });
  });

  describe("stopping en route", () => {
    /** Builds a world with a passenger on floor 1 wanting to go down, and a matching car parked on floor 2. */
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

    /** Runs the world long enough for the car to travel and come to rest. */
    function run(world: World): void {
      for (let frame = 0; frame < 600; frame++) {
        world.update(1.0 / 60.0);
      }
    }

    it("leaves a passenger standing when stop() halts the car between floors", () => {
      // Stopping mid-flight coasts the car past the floor it was passing, so
      // boarding -- offered only on arrival -- never triggers.
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
      // Same building and passenger; only the destination differs.
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

  describe("assignment repressing", () => {
    /** A destination-dispatch world with one waiting request on floor 1. */
    function createDispatchWorld(elevatorCount: number): World {
      const world = createWorld({
        spawnRate: 0.001,
        floorCount: 3,
        elevatorCount,
        destinationDispatch: true,
      });
      at(world.floors, 1).requestDestination(2);
      return world;
    }

    it("re-arrives the car booked to serve a floor it is already standing at", () => {
      const world = createDispatchWorld(1);
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);

      at(world.floors, 1).assignElevator(2, elevator);

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([1]);
    });

    it("re-arrives the booked car and no other standing there", () => {
      // Unlike the button version, the car is named, so there's no fairness draw to make.
      const world = createDispatchWorld(3);
      for (const elevator of world.elevators) {
        elevator.setFloorPosition(1);
      }

      at(world.floors, 1).assignElevator(2, at(world.elevators, 2));

      expect(world.elevatorInterfaces.map((i) => i.destinationQueue)).toEqual([[], [], [1]]);
    });

    it("ignores a booked car standing at another floor", () => {
      const world = createDispatchWorld(1);
      at(world.elevators, 0).setFloorPosition(2);

      at(world.floors, 1).assignElevator(2, at(world.elevators, 0));

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("ignores a booked car that is full", () => {
      const world = createDispatchWorld(1);
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      for (let i = 0; i < elevator.maxUsers; i++) {
        elevator.userEntering({ weight: 70 });
      }

      at(world.floors, 1).assignElevator(2, elevator);

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("ignores a booked car that is not level with the floor", () => {
      // currentFloor is the floor last arrived at; a car already moving again
      // still reports it, so isOnAFloor must be checked too.
      const world = createDispatchWorld(1);
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      elevator.moveTo(null, elevator.y - 10);

      at(world.floors, 1).assignElevator(2, elevator);

      expect(elevator.currentFloor).toBe(1);
      expect(elevator.isOnAFloor()).toBe(false);
      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("ignores a booked car that is still moving", () => {
      const world = createDispatchWorld(1);
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      elevator.isMoving = true;

      at(world.floors, 1).assignElevator(2, elevator);

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([]);
    });

    it("takes nothing from the world's own generator", () => {
      // Confirms the booking path draws from neither the world's stream nor
      // the global one; the derived button-repress stream is checked below.
      const random = vi.fn(() => 0);
      const world = createWorld(
        { floorCount: 3, elevatorCount: 2, spawnRate: 0.001, destinationDispatch: true },
        random,
      );
      const elevator = at(world.elevators, 0);
      elevator.setFloorPosition(1);
      at(world.floors, 1).requestDestination(2);

      random.mockClear();
      const global = vi.spyOn(Math, "random");
      at(world.floors, 1).assignElevator(2, elevator);

      expect(at(world.elevatorInterfaces, 0).destinationQueue).toEqual([1]);
      expect(random).not.toHaveBeenCalled();
      expect(global).not.toHaveBeenCalled();
    });

    it("leaves the button-repress stream exactly where it found it", () => {
      // A draw here would silently shift every later hall-call choice, since a
      // derived stream answers to no spy -- so it's watched through effect:
      // twenty repressings compared between a run that books first and one that doesn't.
      const repressChoices = (book: boolean): number[] => {
        const world = createWorld(
          { floorCount: 3, elevatorCount: 3, spawnRate: 0.001, destinationDispatch: true },
          "assignment-draw",
        );
        const floor = at(world.floors, 1);
        for (const elevator of world.elevators) {
          elevator.setFloorPosition(1);
          elevator.goingUpIndicator = true;
        }
        floor.requestDestination(2);
        if (book) {
          floor.assignElevator(2, at(world.elevators, 0));
        }

        const offers = world.elevatorInterfaces.map((car) => vi.spyOn(car, "goToFloor"));
        const chosen: number[] = [];
        for (let press = 0; press < 20; press++) {
          // Being re-offered the floor sends a car on its way, taking it out of the running
          // for the next press, so the building is stood back up the same way between
          // presses in both runs, leaving the stream as the only thing that can differ.
          for (const car of world.elevatorInterfaces) {
            car.destinationQueue.length = 0;
          }
          for (const car of world.elevators) {
            car.isMoving = false;
            car.setFloorPosition(1);
          }
          for (const offer of offers) {
            offer.mockClear();
          }
          // A button that is already lit raises nothing, so it is cleared
          // to make each press a fresh call.
          floor.buttonStates.up = "";
          floor.pressUpButton();
          chosen.push(offers.findIndex((offer) => offer.mock.calls.length > 0));
        }
        return chosen;
      };

      const withBooking = repressChoices(true);

      expect(withBooking).not.toContain(-1);
      expect(withBooking).toEqual(repressChoices(false));
    });
  });

  describe("destination dispatch, end to end", () => {
    /** A destination-dispatch building, run for a hundred simulated seconds. */
    function runDispatchWorld(subscribe: (world: World) => void): World {
      const world = createWorld(
        { floorCount: 4, elevatorCount: 2, spawnRate: 2, destinationDispatch: true },
        "dispatch",
      );
      subscribe(world);
      for (let i = 0; i < 2000; i++) {
        world.update(0.05);
      }
      return world;
    }

    it("carries the building when the program books a car for each request", () => {
      // The smallest program the mechanic admits: hand the requests out in
      // turn, and send the car to fetch them and then to where they are going.
      let next = 0;
      const world = runDispatchWorld((built) => {
        for (const floor of built.floors) {
          floor.on("destination_requested", (requestedFloor, destinationFloor) => {
            const index = next % built.elevators.length;
            next += 1;
            requestedFloor.assignElevator(destinationFloor, at(built.elevators, index));
            const car = at(built.elevatorInterfaces, index);
            car.goToFloor(requestedFloor.level);
            car.goToFloor(destinationFloor);
          });
        }
      });

      // Two cars, four floors and a hundred seconds carry ninety-odd people
      // here, so the bar is set just under that rather than at some number a
      // building that mostly stalls could also clear.
      expect(world.transportedCounter).toBeGreaterThan(80);
    });

    it("moves nobody for a program that waits for call buttons", () => {
      // The mechanic cannot be half-solved by a solution written for the other
      // kind of building: nothing here presses anything, so a program listening
      // for hall calls hears silence and its building never moves.
      const pressed = vi.fn();
      const world = runDispatchWorld((built) => {
        for (const floor of built.floors) {
          floor.on("up_button_pressed", pressed);
          floor.on("down_button_pressed", pressed);
        }
      });

      expect(pressed).not.toHaveBeenCalled();
      expect(world.transportedCounter).toBe(0);
      expect(world.users.length).toBeGreaterThan(0);
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
      // WorldController pauses on the first usercode_error, so no later dispatch happens at
      // all; within the dispatch already running, though, handlers after the thrower still
      // run, and each of their failures is reported separately.
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
    it("ends the level and empties the world", () => {
      const world = createWorld({ spawnRate: 0.5 });
      world.update(0.1);

      world.unWind();

      expect(world.levelEnded).toBe(true);
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
    // The assignment is the assertion: `ControllableWorld` is declared structurally to keep
    // the two modules acyclic, so nothing else checks that `World` still fits it.
    const controllable: ControllableWorld = createWorld();
    expect(controllable.floorInterfaces).toHaveLength(4);
    expect(controllable.levelEnded).toBe(false);
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
  /** Mean boarding-to-delivery time of delivered passengers. */
  avgRideTime: number;
  /** Total door openings across all elevators. */
  stopCount: number;
  /** People who got in or out at an average stop. */
  avgPeoplePerStop: number;
}

/** Everything an observer of a whole run can see of it. */
interface RunTrace {
  /** Every passenger the run spawned, in order. */
  spawns: SpawnTrace[];
  /**
   * The slot every boarding passenger was put in, as `<elevator index>:<slot index>`, in
   * boarding order. The only value in the trace the elevators' own stream decides.
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
 * Runs a world for a fixed minute and records what an observer would see. Elevators sweep
 * up and wrap at the top, so the trace covers boarding, exits, statistics and the slot
 * each passenger lands in; the two streams a seed drives are both visible in it.
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
        avgRideTime: world.avgRideTime,
        stopCount: world.stopCount,
        avgPeoplePerStop: world.avgPeoplePerStop,
      },
      usersLeft: world.users.length,
    },
  };
}

describe("seeded runs", () => {
  it("replays a run exactly from the same seed", () => {
    // The whole point of the exercise: a failed run or a surprising score can be looked at again.
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
    // This draw decides nothing but where a passenger lands inside the car, so nothing
    // else in the trace moves when it changes, which is exactly why it needs its own
    // assertion that it, too, replays the same.
    const first = traceRun("rush-hour").trace.boardingSlots;
    const second = traceRun("rush-hour").trace.boardingSlots;

    expect(first.length).toBeGreaterThan(20);
    // Otherwise a car that always handed out slot 0 would pass this untouched.
    expect(new Set(first).size).toBeGreaterThan(2);
    expect(second).toEqual(first);
  });

  it("reaches the unseeded Math.random nowhere once it has its seed", () => {
    // A seeded run makes every draw from a stream the seed determines, leaving nothing for
    // a replay to get wrong. Asserted as a whole-run property, not just the absence of a
    // call, because a new call site is exactly what would go unnoticed otherwise.
    const global = vi.spyOn(Math, "random").mockReturnValue(0);
    const trace = traceRun("rush-hour").trace;

    expect(trace.spawns.length).toBeGreaterThan(50);
    expect(trace.boardingSlots.length).toBeGreaterThan(20);
    expect(global).not.toHaveBeenCalled();
  });

  it("keeps boarding out of the stream the simulation runs on", () => {
    // The world spawns passengers from its own stream, so a slot draw landing there would
    // shift every later spawn, silently changing what every existing seed replays. Boarding
    // draws also come and go as rendering changes, which must never reach that sequence.
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
    // The same argument as boarding slots, for the button-repress offset: a press happens
    // when a passenger a turned-away car decides to retry, so this draw must stay off the
    // spawn stream or every seed would start replaying a different run.
    const random = vi.fn(() => 0);
    const world = createWorld({ floorCount: 3, elevatorCount: 2, spawnRate: 0.001 }, random);
    for (const elevator of world.elevators) {
      elevator.setFloorPosition(1);
    }

    random.mockClear();
    const global = vi.spyOn(Math, "random");
    at(world.floors, 1).pressUpButton();

    // The sweep ran and re-offered the floor, so an offset was drawn - from neither of these.
    expect(world.elevatorInterfaces.some((e) => e.destinationQueue.length > 0)).toBe(true);
    expect(random).not.toHaveBeenCalled();
    expect(global).not.toHaveBeenCalled();
  });

  it("draws the re-offered elevator from a stream the seed reproduces", () => {
    // The other half: keeping the offset off the spawn stream is no improvement if it stops
    // being replayable on the way out. Four cars all stand at the pressed floor and all can
    // take it, so which one ends up with the destination is exactly the offset the sweep drew.
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
    // This duration is drawn when a passenger steps out, which needs the player's program
    // to send a car to the right floor and have it brake onto it - nothing in a run is
    // further from being decided by the seed alone.
    const floorCount = 3;
    const random = vi.fn(createRandomSource("walk-off-isolation"));
    // A rate this low spawns exactly one passenger on the first frame - the accumulator
    // starts one thousandth of an interval past the threshold - and then nobody for the
    // next thousand seconds, so any draw seen after that frame is a draw the delivery made.
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
