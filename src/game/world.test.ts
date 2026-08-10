import { afterEach, describe, expect, it, vi } from "vitest";

import type { Elevator } from "./elevator.ts";
import type { ElevatorInterface } from "./elevator-interface.ts";
import { Floor } from "./floor.ts";
import { at } from "./test-helpers.ts";
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
 * Builds a world with exactly one user waiting on floor 0.
 *
 * `Math.random` is pinned so the spawn lands on floor 0 heading up, and the
 * elevator is parked at the top so it neither re-arrives nor picks the user up
 * on its own.
 *
 * @returns The world and its lone user.
 */
function createWorldWithWaitingUser(): { world: World; user: User } {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 });
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
});

describe("createRandomUser", () => {
  it("gives every user a weight between 55 and 100 and an appearance", () => {
    for (let i = 0; i < 200; ++i) {
      const user = createRandomUser();
      expect(user.weight).toBeGreaterThanOrEqual(55);
      expect(user.weight).toBeLessThanOrEqual(100);
      expect(["child", "female", "male"]).toContain(user.displayType);
    }
  });

  it("makes a child when the one-in-41 roll comes up", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = createRandomUser();
    expect(user.weight).toBe(55);
    expect(user.displayType).toBe("child");
  });

  it("makes a female when the child roll misses and the gender roll is 0", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0) // weight
      .mockReturnValueOnce(0.5) // child roll: misses
      .mockReturnValueOnce(0); // gender roll
    expect(createRandomUser().displayType).toBe("female");
  });

  it("makes a male otherwise", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const user = createRandomUser();
    expect(user.weight).toBe(100);
    expect(user.displayType).toBe("male");
  });
});

describe("spawnUserRandomly", () => {
  it("always picks a real floor and a destination that is somewhere else", () => {
    const floorCount = 5;
    const floors = createFloors(floorCount, 50, () => undefined);
    for (let i = 0; i < 500; ++i) {
      const user = spawnUserRandomly(floorCount, 50, floors);
      expect(user.currentFloor).toBeGreaterThanOrEqual(0);
      expect(user.currentFloor).toBeLessThan(floorCount);
      expect(user.destinationFloor).toBeGreaterThanOrEqual(0);
      expect(user.destinationFloor).toBeLessThan(floorCount);
      expect(user.destinationFloor).not.toBe(user.currentFloor);
    }
  });

  it("puts the user on their floor and presses the matching call button", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const floors = createFloors(3, 50, () => undefined);
    const user = spawnUserRandomly(3, 50, floors);

    expect(user.currentFloor).toBe(0);
    expect(user.destinationFloor).toBe(1);
    expect(user.x).toBe(105);
    expect(user.y).toBe(at(floors, 0).getSpawnPosY());
    expect(at(floors, 0).buttonStates.up).toBe("activated");
    expect(at(floors, 0).buttonStates.down).toBe("");
  });

  it("sends users above the lobby down to it by default", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0) // weight
      .mockReturnValueOnce(0.5) // child roll
      .mockReturnValueOnce(0.5) // gender roll
      .mockReturnValueOnce(0) // spawn x offset
      .mockReturnValueOnce(0.9) // "start in the lobby?" roll: no
      .mockReturnValueOnce(0.9) // floor roll
      .mockReturnValueOnce(0.5); // "not going to the lobby?" roll: no
    const floors = createFloors(3, 50, () => undefined);
    const user = spawnUserRandomly(3, 50, floors);

    expect(user.currentFloor).toBe(2);
    expect(user.destinationFloor).toBe(0);
    expect(at(floors, 2).buttonStates.down).toBe("activated");
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
      vi.spyOn(Math, "random").mockReturnValue(0);
      const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 });
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
      vi.spyOn(Math, "random").mockReturnValue(0);
      const world = createWorld({ spawnRate: 0.5, floorCount: 3, elevatorCount: 1 });
      const elevator = at(world.elevators, 0);
      const elevInterface = at(world.elevatorInterfaces, 0);
      elevInterface.goingUpIndicator(false);
      const spawned = collectUsers(world);
      world.update(0.1);
      return { world, elevator, elevInterface, user: at(spawned, 0) };
    }

    it("picks up a refused passenger once the matching indicator is lit", () => {
      // Issues #59, #74, #98, #124: the elevator stands empty at the
      // passenger's floor with the wrong indicator lit, so it never takes them.
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
      // installs from `stopped` (`interfaces.js:29`, `elevator.wait(1, ...)`),
      // which outlasts the one second a passenger takes to walk in
      // (`user.js:70`). The re-offer is a boarding path the legacy code did not
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
      vi.spyOn(Math, "random").mockReturnValue(0);
      const world = createWorld({
        spawnRate: 0.001,
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [1],
      });
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
      vi.spyOn(Math, "random").mockReturnValue(0);
      const world = createWorld({
        spawnRate: 0.001,
        floorCount: 3,
        elevatorCount: 2,
        elevatorCapacities: [1, 4],
      });
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
      // What a guard would cost is the nested World.handleButtonRepressing.
      // It re-offers nothing here - the car is full - but it draws a
      // randomInt(0, elevatorCount - 1) before it looks, and dropping a draw
      // shifts every later value out of the shared Math.random stream. The
      // world spawns passengers, weights, floors and elevator slots from that
      // same stream, so a run would silently stop matching the legacy one.
      const random = vi.spyOn(Math, "random").mockReturnValue(0);
      const world = createWorld({
        spawnRate: 0.001,
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [1],
      });
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

      random.mockClear();
      floor.pressDownButton();

      expect(first.parent).toBe(elevator);
      expect(second.parent).toBe(null);
      expect(floor.buttonStates.down).toBe("activated");
      // One draw for each handleButtonRepressing - the outer one and the
      // nested one - plus one for the boarding slot and one for the slot scan
      // that finds the car full. Guarding Floor would leave three.
      expect(random).toHaveBeenCalledTimes(4);
      // Player code still sees the call once: the facade the event is forwarded
      // to is a PlayerObservable, and its guard absorbs the nested forward.
      // That is the split - the world's own handler runs, the player's does
      // not - and it is why the guard cannot simply be moved down onto Floor.
      expect(seen).toEqual([at(world.floorInterfaces, 1)]);
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
      world.users.push(createRandomUser());
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
