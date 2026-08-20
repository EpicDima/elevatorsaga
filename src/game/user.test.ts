import { beforeEach, describe, expect, it, vi } from "vitest";

import { Elevator } from "./elevator.ts";
import { Floor } from "./floor.ts";
import type { RandomSource } from "./random.ts";
import { assertWithinRange, at, timeForwarder } from "./test-helpers.ts";
import { User } from "./user.ts";

const FLOOR_COUNT = 4;
const FLOOR_HEIGHT = 50;

/** Builds the floors of a test world, laid out like `createFloors` does. */
function makeFloors(): Floor[] {
  return Array.from(
    { length: FLOOR_COUNT },
    (_unused, i) => new Floor(i, (FLOOR_COUNT - 1 - i) * FLOOR_HEIGHT, vi.fn()),
  );
}

/** Runs a user and an elevator forward the way the world does. */
function step(dt: number, stepSize: number, user: User, elevator?: Elevator): void {
  timeForwarder(dt, stepSize, (s) => {
    elevator?.update(s);
    elevator?.updateElevatorMovement(s);
    user.update(s);
  });
}

describe("User class", () => {
  it("updates display position when told to", () => {
    const u = new User(70);
    u.moveTo(1.0, 1.0);
    u.updateDisplayPosition();
    expect(u.worldX).toBe(1.0);
    expect(u.worldY).toBe(1.0);
  });

  it("disallows incorrect creation", () => {
    const faultyCreation = (): unknown => (User as unknown as () => unknown)();
    expect(faultyCreation).toThrow(TypeError);
  });

  it("starts on floor 0, not done and not removable", () => {
    const u = new User(70);
    expect(u.weight).toBe(70);
    expect(u.currentFloor).toBe(0);
    expect(u.destinationFloor).toBe(0);
    expect(u.done).toBe(false);
    expect(u.removeMe).toBe(false);
    expect(u.waitingLongest).toBe(false);
  });

  it("announces a change of the longest-wait flag, and only a change", () => {
    // The world sets this every frame with the same answer, so repeating
    // itself has to be free; the passenger it is true of is standing still,
    // so a change has to be announced or nothing would redraw them.
    const u = new User(70);
    const redraws = vi.fn();
    u.on("new_display_state", redraws);

    u.setWaitingLongest(true);
    u.setWaitingLongest(true);
    expect(u.waitingLongest).toBe(true);
    expect(redraws).toHaveBeenCalledTimes(1);

    u.setWaitingLongest(false);
    u.setWaitingLongest(false);
    expect(u.waitingLongest).toBe(false);
    expect(redraws).toHaveBeenCalledTimes(2);
  });
});

describe("User.appearOnFloor", () => {
  let floors: Floor[];

  beforeEach(() => {
    floors = makeFloors();
  });

  it("places the user at the floor spawn position and records the floors", () => {
    const floor = floors[1];
    if (floor === undefined) throw new Error("missing floor");
    const u = new User(70);

    u.appearOnFloor(floor, 3);

    expect(u.currentFloor).toBe(1);
    expect(u.destinationFloor).toBe(3);
    expect(u.y).toBe(floor.getSpawnPosY());
  });

  it("presses the up button when going up", () => {
    const floor = floors[1];
    if (floor === undefined) throw new Error("missing floor");
    new User(70).appearOnFloor(floor, 3);
    expect(floor.buttonStates).toEqual({ up: "activated", down: "" });
  });

  it("presses the down button when going down", () => {
    const floor = floors[2];
    if (floor === undefined) throw new Error("missing floor");
    new User(70).appearOnFloor(floor, 0);
    expect(floor.buttonStates).toEqual({ up: "", down: "activated" });
  });

  it("presses the up button when destination equals current floor", () => {
    // The legacy test is a strict less-than, so a same-floor trip reads as up.
    const floor = floors[2];
    if (floor === undefined) throw new Error("missing floor");
    new User(70).appearOnFloor(floor, 2);
    expect(floor.buttonStates).toEqual({ up: "activated", down: "" });
  });
});

describe("User.elevatorAvailable", () => {
  let floors: Floor[];
  let elevator: Elevator;
  let user: User;

  beforeEach(() => {
    floors = makeFloors();
    elevator = new Elevator(2.6, FLOOR_COUNT, FLOOR_HEIGHT);
    elevator.setFloorPosition(0);
    user = new User(70);
    const floor = floors[0];
    if (floor === undefined) throw new Error("missing floor");
    user.appearOnFloor(floor, 2);
  });

  /** The floor the elevator is currently standing at. */
  function currentFloor(): Floor {
    const floor = floors[elevator.currentFloor];
    if (floor === undefined) throw new Error("missing floor");
    return floor;
  }

  it("boards the elevator and emits entered_elevator", () => {
    const entered = vi.fn();
    user.on("entered_elevator", entered);

    user.elevatorAvailable(elevator, currentFloor());

    expect(entered).toHaveBeenCalledWith(elevator);
    expect(user.parent).toBe(elevator);
    expect(elevator.isEmpty()).toBe(false);
  });

  it("presses the destination button once it has walked in", () => {
    user.elevatorAvailable(elevator, currentFloor());
    step(2.0, 0.05, user, elevator);
    expect(elevator.getPressedFloors()).toContain(2);
  });

  it("refuses an elevator whose indicators do not suit the trip", () => {
    elevator.goingUpIndicator = false;
    const entered = vi.fn();
    user.on("entered_elevator", entered);

    user.elevatorAvailable(elevator, currentFloor());

    expect(entered).not.toHaveBeenCalled();
    expect(user.parent).toBe(null);
    expect(elevator.isEmpty()).toBe(true);
  });

  it("re-presses the call button when the elevator is full", () => {
    for (let i = 0; i < elevator.maxUsers; i++) {
      elevator.userEntering({ weight: 70 });
    }
    const floor = currentFloor();
    floor.elevatorAvailable(elevator);
    expect(floor.buttonStates.up).toBe("");

    user.elevatorAvailable(elevator, floor);

    expect(user.parent).toBe(null);
    expect(floor.buttonStates.up).toBe("activated");
  });

  it("re-presses the call button when the elevator will not serve their direction", () => {
    // Issue #110 ("Passengers not rehitting button"): documentation.html says
    // of both up_button_pressed and down_button_pressed that "passengers will
    // press the button again if they fail to enter an elevator", but only the
    // full-elevator path did so. The floor is notified of the arriving elevator
    // before its waiting passengers are, so an elevator whose indicators change
    // in between - which player code does from floor button handlers - clears
    // the call button and then turns the passenger away, leaving the floor
    // looking as though nobody is waiting there.
    const floor = currentFloor();
    floor.elevatorAvailable(elevator);
    expect(floor.buttonStates.up).toBe("");
    elevator.goingUpIndicator = false;
    const upPressed = vi.fn();
    floor.on("up_button_pressed", upPressed);

    user.elevatorAvailable(elevator, floor);

    expect(user.parent).toBe(null);
    expect(floor.buttonStates.up).toBe("activated");
    expect(upPressed).toHaveBeenCalledTimes(1);
  });

  it("re-presses the down button for a refused passenger travelling down", () => {
    // The mirror of the case above: the passenger's direction decides which
    // button is pressed, exactly as on their first arrival at the floor.
    const topFloor = at(floors, FLOOR_COUNT - 1);
    const downUser = new User(70);
    downUser.appearOnFloor(topFloor, 0);
    elevator.setFloorPosition(FLOOR_COUNT - 1);
    topFloor.elevatorAvailable(elevator);
    expect(topFloor.buttonStates.down).toBe("");
    elevator.goingDownIndicator = false;

    downUser.elevatorAvailable(elevator, topFloor);

    expect(downUser.parent).toBe(null);
    expect(topFloor.buttonStates.down).toBe("activated");
    expect(topFloor.buttonStates.up).toBe("");
  });

  it("ignores the offer while already walking into an elevator", () => {
    const entered = vi.fn();
    user.on("entered_elevator", entered);

    user.elevatorAvailable(elevator, currentFloor());
    user.elevatorAvailable(elevator, currentFloor());

    expect(entered).toHaveBeenCalledTimes(1);
  });

  it("ignores the offer once done", () => {
    user.done = true;
    const entered = vi.fn();
    user.on("entered_elevator", entered);

    user.elevatorAvailable(elevator, currentFloor());

    expect(entered).not.toHaveBeenCalled();
  });

  it("ignores the offer while busy with another level", () => {
    user.wait(1.0);
    const entered = vi.fn();
    user.on("entered_elevator", entered);

    user.elevatorAvailable(elevator, currentFloor());

    expect(entered).not.toHaveBeenCalled();
  });
});

describe("User exit", () => {
  let floors: Floor[];
  let elevator: Elevator;
  let user: User;

  beforeEach(() => {
    floors = makeFloors();
    elevator = new Elevator(2.6, FLOOR_COUNT, FLOOR_HEIGHT);
    elevator.setFloorPosition(0);
    user = new User(70);
    const floor = floors[0];
    if (floor === undefined) throw new Error("missing floor");
    user.appearOnFloor(floor, 2);
    user.elevatorAvailable(elevator, floor);
    step(2.0, 0.05, user, elevator);
  });

  it("rides to the destination, steps out and is eventually removable", () => {
    const exited = vi.fn();
    const removed = vi.fn();
    user.on("exited_elevator", exited);
    user.on("removed", removed);

    elevator.goToFloor(2);
    step(10.0, 0.05, user, elevator);

    expect(exited).toHaveBeenCalledWith(elevator);
    expect(user.done).toBe(true);
    expect(user.currentFloor).toBe(2);
    expect(user.parent).toBe(null);
    expect(elevator.isEmpty()).toBe(true);

    step(3.0, 0.05, user);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(user.removeMe).toBe(true);
  });

  it("stays inside when the elevator stops at another floor", () => {
    const exited = vi.fn();
    user.on("exited_elevator", exited);

    elevator.goToFloor(1);
    step(10.0, 0.05, user, elevator);

    expect(exited).not.toHaveBeenCalled();
    expect(user.done).toBe(false);
    expect(user.parent).toBe(elevator);
  });

  it("unsubscribes from the elevator once it has left", () => {
    elevator.goToFloor(2);
    step(10.0, 0.05, user, elevator);
    const exited = vi.fn();
    user.on("exited_elevator", exited);

    elevator.trigger("exit_available", 2, elevator);

    expect(exited).not.toHaveBeenCalled();
  });

  it("drops all its own handlers once removed", () => {
    const removed = vi.fn();
    const newState = vi.fn();
    user.on("removed", removed);
    user.on("new_state", newState);

    elevator.goToFloor(2);
    step(10.0, 0.05, user, elevator);
    expect(removed).toHaveBeenCalledTimes(1);

    const callsAtRemoval = newState.mock.calls.length;
    user.moveTo(500, 500);
    user.trigger("removed");

    expect(removed).toHaveBeenCalledTimes(1);
    expect(newState).toHaveBeenCalledTimes(callsAtRemoval);
  });

  it("walks 100 units to the right after stepping out", () => {
    let xOnExit = Number.NaN;
    user.on("exited_elevator", () => {
      xOnExit = user.x;
    });

    elevator.goToFloor(2);
    // Long enough to cover the ride plus the 1 - 1.5 second walk-off.
    step(10.0, 0.05, user, elevator);

    expect(user.removeMe).toBe(true);
    expect(user.x).toBeCloseTo(xOnExit + 100, 10);
  });
});

describe("User walk-off duration", () => {
  /** Step size the walk-off is measured with, in simulated seconds. */
  const MEASURE_STEP = 0.01;

  /**
   * Delivers a passenger to floor 2 and times their walk off to the right.
   *
   * @param random - Stream the passenger draws the duration from; omitted, the
   * passenger falls back to its own.
   * @returns Simulated seconds between stepping out and being removable,
   * rounded up to a whole step.
   */
  function measureWalkOff(random?: RandomSource): number {
    const floors = makeFloors();
    const elevator = new Elevator(2.6, FLOOR_COUNT, FLOOR_HEIGHT);
    elevator.setFloorPosition(0);
    const user = new User(70, random);
    const floor = at(floors, 0);
    user.appearOnFloor(floor, 2);
    user.elevatorAvailable(elevator, floor);
    step(2.0, 0.05, user, elevator);
    elevator.goToFloor(2);

    for (let i = 0; i < 10000 && !user.done; i++) {
      elevator.update(MEASURE_STEP);
      elevator.updateElevatorMovement(MEASURE_STEP);
      user.update(MEASURE_STEP);
    }
    expect(user.done).toBe(true);
    // The frame the passenger stepped out on also advanced the walk by a step.
    let walkOff = MEASURE_STEP;
    for (let i = 0; i < 10000 && !user.removeMe; i++) {
      user.update(MEASURE_STEP);
      walkOff += MEASURE_STEP;
    }
    expect(user.removeMe).toBe(true);
    return walkOff;
  }

  it("draws the duration from the source it was given", () => {
    // `legacy-1.x:user.js:41` spends `1 + Math.random() * 0.5` seconds walking
    // off, and the passenger stays in `world.users` for all of it - so this
    // draw decides when the world drops them, and has to come from the world's
    // seeded stream rather than the global one for a run to replay.
    assertWithinRange(
      measureWalkOff(() => 0),
      1.0,
      1.0 + MEASURE_STEP,
      "for a source at zero",
    );
    assertWithinRange(
      measureWalkOff(() => 0.8),
      1.4,
      1.4 + MEASURE_STEP,
      "for a source at 0.8",
    );
  });

  it("still walks off for one to one and a half seconds without a source", () => {
    // The distribution is unchanged for a passenger built outside a world,
    // which is the only way the default is ever reached.
    for (let i = 0; i < 20; i++) {
      assertWithinRange(measureWalkOff(), 1.0, 1.5 + MEASURE_STEP, "for the default source");
    }
  });
});
