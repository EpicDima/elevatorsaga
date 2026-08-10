import { describe, expect, it, vi, beforeEach } from "vitest";

import { challenges } from "./challenges.ts";
import { Elevator, type ElevatorDirection, type ElevatorPassenger } from "./elevator.ts";
import { createFrameRequester } from "./frame-requester.ts";
import { MovableBusyError, type MovableTask } from "./movable.ts";
import { assertWithinRange, at, timeForwarder } from "./test-helpers.ts";
import { createWorld, type WorldOptions } from "./world.ts";
import { createWorldController, type UserCodeObject } from "./world-controller.ts";

const FLOOR_COUNT = 4;
const FLOOR_HEIGHT = 44;

/** Runs the elevator forward the way the world does: task first, then physics. */
function stepElevator(e: Elevator, dt: number, stepSize: number): void {
  timeForwarder(dt, stepSize, (step) => {
    e.update(step);
    e.updateElevatorMovement(step);
  });
}

/** A stand-in for `User`, which only needs a weight to affect the load factor. */
function passenger(weight: number): ElevatorPassenger {
  return { weight };
}

/** Simulated seconds per frame, as the real game and the fitness suite run it. */
const SWEEP_STEP_SECONDS = 1.0 / 60.0;

/** Frames each sweep run simulates: half a minute of game time. */
const SWEEP_FRAMES = 1800;

/**
 * A deterministic stand-in for `Math.random` (mulberry32).
 *
 * The sweep below is evidence, so it has to be reproducible: a seed that trips
 * the invariant must trip it again on the next run, on any machine.
 *
 * @param seed - Chooses the stream.
 * @returns A generator of values in `[0, 1)`.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What one sweep saw, summed over every elevator of every run. */
interface SweepTotals {
  /** Movement steps that found an elevator busy. */
  busySteps: number;
  /** Times an elevator went from having no task to having one. */
  taskStarts: number;
  /** Velocities recorded where the invariant says there can be none. */
  violations: number[];
}

/**
 * Records the velocity an elevator has whenever it is handed a task.
 *
 * Hooks the property rather than {@link Elevator.wait}, so it catches every
 * assignment to `currentTask` whatever set it — including any path added later.
 *
 * @param elevator - The elevator to watch.
 * @param onBusyStart - Called with the velocity at the moment it becomes busy.
 */
function watchTaskStarts(elevator: Elevator, onBusyStart: (velocityY: number) => void): void {
  let task: MovableTask | null = elevator.currentTask;
  Object.defineProperty(elevator, "currentTask", {
    configurable: true,
    get: (): MovableTask | null => task,
    set: (value: MovableTask | null): void => {
      if (task === null && value !== null) {
        onBusyStart(elevator.velocityY);
      }
      task = value;
    },
  });
}

/**
 * Plays one challenge with one program, recording what the busy check saw.
 *
 * @param options - The challenge's world options.
 * @param codeObj - The player program to drive it with.
 * @param totals - Accumulator the run adds its observations to.
 * @returns Anything the player program threw.
 */
function sweepChallenge(
  options: WorldOptions,
  codeObj: UserCodeObject,
  totals: SweepTotals,
): unknown[] {
  const world = createWorld(options);
  for (const elevator of world.elevators) {
    watchTaskStarts(elevator, (velocityY) => {
      totals.taskStarts++;
      if (velocityY !== 0) {
        totals.violations.push(velocityY);
      }
    });
    const move = elevator.updateElevatorMovement.bind(elevator);
    elevator.updateElevatorMovement = (dt: number): void => {
      if (elevator.isBusy()) {
        totals.busySteps++;
        if (elevator.velocityY !== 0) {
          totals.violations.push(elevator.velocityY);
        }
      }
      move(dt);
    };
  }
  const errors: unknown[] = [];
  const controller = createWorldController(SWEEP_STEP_SECONDS);
  controller.on("usercode_error", (e) => {
    errors.push(e);
  });
  const frameRequester = createFrameRequester(1000.0 * SWEEP_STEP_SECONDS);
  controller.start(world, codeObj, frameRequester.register, true);
  for (let frame = 0; frame < SWEEP_FRAMES && !controller.isPaused; frame++) {
    frameRequester.trigger();
  }
  return errors;
}

/** The obvious first solution: visit every floor, over and over. */
function roundRobinProgram(): UserCodeObject {
  return {
    init(elevators, floors): void {
      for (const elevator of elevators) {
        elevator.on("idle", () => {
          for (let floorNum = 0; floorNum < floors.length; floorNum++) {
            elevator.goToFloor(floorNum);
          }
        });
      }
    },
    update(): void {
      // Nothing.
    },
  };
}

/**
 * Directional service, rewriting the indicators on every frame.
 *
 * This is the program that exercises the indicator re-offer: every indicator
 * change can hand a standing car a boarding dwell from outside the arrival
 * sequence.
 *
 * @returns The program.
 */
function directionalProgram(): UserCodeObject {
  return {
    init(elevators, floors): void {
      for (const floor of floors) {
        floor.on("up_button_pressed down_button_pressed", () => {
          at(elevators, floor.floorNum() % elevators.length).goToFloor(floor.floorNum());
        });
      }
      for (const elevator of elevators) {
        elevator.on("floor_button_pressed", (floorNum) => {
          elevator.goToFloor(floorNum);
        });
        elevator.on("idle", () => {
          elevator.goToFloor(0);
        });
      }
    },
    update(_dt, elevators): void {
      for (const elevator of elevators) {
        const direction = elevator.destinationDirection();
        elevator.goingUpIndicator(direction !== "down");
        elevator.goingDownIndicator(direction !== "up");
      }
    },
  };
}

/**
 * A deliberately hostile program: stops mid-flight, jumps the queue, and
 * flips the indicators at random.
 *
 * @param random - The seeded stream its decisions are drawn from.
 * @returns The program.
 */
function erraticProgram(random: () => number): UserCodeObject {
  return {
    init(elevators, floors): void {
      for (const floor of floors) {
        floor.on("up_button_pressed down_button_pressed", () => {
          at(elevators, Math.floor(random() * elevators.length)).goToFloor(
            floor.floorNum(),
            random() < 0.5,
          );
        });
      }
      for (const elevator of elevators) {
        elevator.on("floor_button_pressed", (floorNum) => {
          elevator.goToFloor(floorNum, random() < 0.3);
        });
        elevator.on("passing_floor", (floorNum) => {
          if (random() < 0.05) {
            elevator.stop();
          } else if (random() < 0.1) {
            elevator.goToFloor(floorNum, true);
          }
        });
        elevator.on("stopped_at_floor", (floorNum) => {
          if (random() < 0.2) {
            elevator.goToFloor(floorNum, true);
          }
        });
        elevator.on("idle", () => {
          elevator.goToFloor(Math.floor(random() * floors.length));
        });
      }
    },
    update(_dt, elevators): void {
      for (const elevator of elevators) {
        if (random() < 0.02) {
          elevator.goingUpIndicator(random() < 0.5);
          elevator.goingDownIndicator(random() < 0.5);
        }
        if (random() < 0.005) {
          elevator.stop();
        }
      }
    },
  };
}

describe("Elevator object", () => {
  let e: Elevator;

  beforeEach(() => {
    e = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
    e.setFloorPosition(0);
  });

  it("moves to floors specified", () => {
    for (let floor = 0; floor < FLOOR_COUNT - 1; floor++) {
      e.goToFloor(floor);
      stepElevator(e, 10.0, 0.015);
      const expectedY = FLOOR_HEIGHT * (FLOOR_COUNT - 1) - FLOOR_HEIGHT * floor;
      expect(e.y).toBe(expectedY);
      expect(e.currentFloor, "Floor num").toBe(floor);
    }
  });

  it("can change direction", () => {
    expect(e.currentFloor).toBe(0);
    const originalY = e.y;
    e.goToFloor(1);
    stepElevator(e, 0.2, 0.015);
    expect(e.y).not.toBe(originalY);
    e.goToFloor(0);
    stepElevator(e, 10.0, 0.015);
    expect(e.y).toBe(originalY);
    expect(e.currentFloor).toBe(0);
  });

  it("is correctly aware of it being on a floor", () => {
    expect(e.isOnAFloor()).toBe(true);
    e.y = e.y + 0.0000000000000001;
    expect(e.isOnAFloor()).toBe(true);
    e.y = e.y + 0.0001;
    expect(e.isOnAFloor()).toBe(false);
  });

  it("correctly reports travel suitability", () => {
    e.goingUpIndicator = true;
    e.goingDownIndicator = true;
    expect(e.isSuitableForTravelBetween(0, 1)).toBe(true);
    expect(e.isSuitableForTravelBetween(2, 4)).toBe(true);
    expect(e.isSuitableForTravelBetween(5, 3)).toBe(true);
    expect(e.isSuitableForTravelBetween(2, 0)).toBe(true);
    e.goingUpIndicator = false;
    expect(e.isSuitableForTravelBetween(1, 10)).toBe(false);
    e.goingDownIndicator = false;
    expect(e.isSuitableForTravelBetween(20, 0)).toBe(false);
  });

  it("reports travel to the same floor as suitable regardless of indicators", () => {
    e.goingUpIndicator = false;
    e.goingDownIndicator = false;
    expect(e.isSuitableForTravelBetween(2, 2)).toBe(true);
  });

  it("reports pressed floor buttons", () => {
    e.pressFloorButton(2);
    e.pressFloorButton(3);
    expect(e.getPressedFloors()).toEqual([2, 3]);
  });

  it("reports not approaching floor 0 when going up from floor 0", () => {
    e.goToFloor(1);
    stepElevator(e, 0.01, 0.015);
    expect(e.isApproachingFloor(0)).toBe(false);
  });

  it("reports approaching floor 2 when going up from floor 0", () => {
    e.goToFloor(1);
    stepElevator(e, 0.01, 0.015);
    expect(e.isApproachingFloor(2)).toBe(true);
  });

  it("reports approaching floor 2 when going down from floor 3", () => {
    e.setFloorPosition(3);
    e.goToFloor(2);
    stepElevator(e, 0.01, 0.015);
    expect(e.isApproachingFloor(2)).toBe(true);
  });

  it("emits no passing floor events when going from floor 0 to 1", () => {
    const someHandler = vi.fn();
    e.on("passing_floor", someHandler);
    e.goToFloor(1);
    stepElevator(e, 10.0, 0.015);
    expect(e.currentFloor).toBe(1);
    expect(someHandler).not.toHaveBeenCalled();
  });

  it("emits passing floor event when going from floor 0 to 2", () => {
    const someHandler = vi.fn();
    e.on("passing_floor", someHandler);
    e.goToFloor(2);
    stepElevator(e, 10.0, 0.015);
    expect(e.currentFloor).toBe(2);
    expect(someHandler).toHaveBeenCalledTimes(1);
    expect(someHandler.mock.calls.at(-1)?.slice(0, 1)).toEqual([1]);
  });

  it("emits passing floor events when going from floor 0 to 3", () => {
    const someHandler = vi.fn();
    e.on("passing_floor", someHandler);
    e.goToFloor(3);
    stepElevator(e, 10.0, 0.015);
    expect(e.currentFloor).toBe(3);
    expect(someHandler).toHaveBeenCalledTimes(2);
    expect(someHandler.mock.calls[0]?.slice(0, 1)).toEqual([1]);
    expect(someHandler.mock.calls[1]?.slice(0, 1)).toEqual([2]);
  });

  it("emits passing floor events when going from floor 3 to 0", () => {
    // The legacy spec of this name was a copy-paste of the 0 -> 3 case and
    // never exercised downward travel; this is the real thing.
    e.setFloorPosition(3);
    const someHandler = vi.fn();
    e.on("passing_floor", someHandler);
    e.goToFloor(0);
    stepElevator(e, 10.0, 0.015);
    expect(e.currentFloor).toBe(0);
    expect(someHandler).toHaveBeenCalledTimes(2);
    expect(someHandler.mock.calls[0]?.slice(0, 1)).toEqual([2]);
    expect(someHandler.mock.calls[1]?.slice(0, 1)).toEqual([1]);
  });

  it("reports direction up when travelling from floor 0 to 3", () => {
    // y grows downward, so travelling toward higher floor numbers means a
    // negative velocityY, which the implementation reports as "up".
    const directions: ElevatorDirection[] = [];
    e.on("passing_floor", (_floorNum, direction) => {
      directions.push(direction);
    });
    e.goToFloor(3);
    stepElevator(e, 10.0, 0.015);
    expect(directions).toEqual(["up", "up"]);
  });

  it("reports direction down when travelling from floor 3 to 0", () => {
    e.setFloorPosition(3);
    const directions: ElevatorDirection[] = [];
    e.on("passing_floor", (_floorNum, direction) => {
      directions.push(direction);
    });
    e.goToFloor(0);
    stepElevator(e, 10.0, 0.015);
    expect(directions).toEqual(["down", "down"]);
  });

  it("doesnt raise unexpected events when told to stop(ish) when passing floor", () => {
    let passingFloorEventCount = 0;
    e.on("passing_floor", (floorNum, direction) => {
      expect(floorNum, "floor being passed").toBe(1);
      expect(direction).toBe("up");
      passingFloorEventCount++;
      e.goToFloor(e.getExactFutureFloorIfStopped());
    });
    e.goToFloor(2);
    stepElevator(e, 3.0, 0.01401);
    expect(passingFloorEventCount, "event count").toBeGreaterThan(0);
    expect(e.getExactCurrentFloor(), "current floor").toBeLessThan(1.15);
  });

  it("doesnt seem to overshoot when stopping at floors", () => {
    for (let updatesPerSecond = 60; updatesPerSecond < 120; updatesPerSecond += 2.32133) {
      const stepSize = 1.0 / updatesPerSecond;
      e.setFloorPosition(1);
      e.goToFloor(3);
      timeForwarder(5.0, stepSize, (dt) => {
        e.update(dt);
        e.updateElevatorMovement(dt);
        assertWithinRange(e.getExactCurrentFloor(), 1.0, 3.0, `(STEPSIZE is ${String(stepSize)})`);
      });
      expect(e.getExactCurrentFloor()).toEqual(3.0);
    }
  });

  describe("construction", () => {
    it("derives physics constants from the floor height", () => {
      const elevator = new Elevator(2.6, 5, 50);
      expect(elevator.ACCELERATION).toBe(50 * 2.1);
      expect(elevator.DECELERATION).toBe(50 * 2.6);
      expect(elevator.MAXSPEED).toBe(50 * 2.6);
    });

    it("defaults to a capacity of four", () => {
      const elevator = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      expect(elevator.maxUsers).toBe(4);
      expect(elevator.userSlots).toHaveLength(4);
      expect(elevator.width).toBe(40);
    });

    it("lays out one slot per passenger", () => {
      const elevator = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT, 3);
      expect(elevator.userSlots.map((slot) => slot.pos)).toEqual([
        [2, 30],
        [12, 30],
        [22, 30],
      ]);
      expect(elevator.width).toBe(30);
    });

    it("starts unpressed, at floor 0, with both indicators lit", () => {
      const elevator = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      expect(elevator.buttonStates).toEqual([false, false, false, false]);
      expect(elevator.currentFloor).toBe(0);
      expect(elevator.goingUpIndicator).toBe(true);
      expect(elevator.goingDownIndicator).toBe(true);
      expect(elevator.destinationY).toBe(elevator.getYPosOfFloor(0));
    });

    it("disallows incorrect creation", () => {
      const faultyCreation = (): unknown => (Elevator as unknown as () => unknown)();
      expect(faultyCreation).toThrow(TypeError);
    });
  });

  describe("floor geometry", () => {
    it("places floor 0 at the bottom", () => {
      expect(e.getYPosOfFloor(0)).toBe(FLOOR_HEIGHT * (FLOOR_COUNT - 1));
      expect(e.getYPosOfFloor(FLOOR_COUNT - 1)).toBe(0);
    });

    it("inverts getYPosOfFloor", () => {
      expect(e.getExactFloorOfYPos(e.getYPosOfFloor(2))).toBe(2);
      expect(e.getExactFloorOfYPos(e.getYPosOfFloor(0.5))).toBeCloseTo(0.5, 10);
    });

    it("rounds the current floor", () => {
      e.moveTo(null, e.getYPosOfFloor(1.4));
      expect(e.getRoundedCurrentFloor()).toBe(1);
      e.moveTo(null, e.getYPosOfFloor(1.6));
      expect(e.getRoundedCurrentFloor()).toBe(2);
    });

    it("reports the destination floor", () => {
      e.goToFloor(2);
      expect(e.getDestinationFloor()).toBe(2);
    });

    it("reports the current floor as the future floor when standing still", () => {
      e.setFloorPosition(2);
      expect(e.getExactFutureFloorIfStopped()).toBe(2);
    });
  });

  describe("pressFloorButton", () => {
    it("clamps floor numbers into the valid range", () => {
      e.pressFloorButton(-3);
      e.pressFloorButton(99);
      expect(e.getPressedFloors()).toEqual([0, FLOOR_COUNT - 1]);
    });

    it("emits floor_button_pressed and floor_buttons_changed on the first press", () => {
      const pressed = vi.fn();
      const changed = vi.fn();
      e.on("floor_button_pressed", pressed);
      e.on("floor_buttons_changed", changed);

      e.pressFloorButton(2);

      expect(pressed).toHaveBeenCalledTimes(1);
      expect(pressed).toHaveBeenCalledWith(2);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenCalledWith([false, false, true, false], 2);
    });

    it("emits nothing when the button is already pressed", () => {
      e.pressFloorButton(2);
      const pressed = vi.fn();
      const changed = vi.fn();
      e.on("floor_button_pressed", pressed);
      e.on("floor_buttons_changed", changed);

      e.pressFloorButton(2);

      expect(pressed).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });

    it("reports the clamped floor number, not the requested one", () => {
      const pressed = vi.fn();
      e.on("floor_button_pressed", pressed);
      e.pressFloorButton(99);
      expect(pressed).toHaveBeenCalledWith(FLOOR_COUNT - 1);
    });

    it("returns pressed floors in ascending order", () => {
      e.pressFloorButton(3);
      e.pressFloorButton(0);
      e.pressFloorButton(2);
      expect(e.getPressedFloors()).toEqual([0, 2, 3]);
    });

    it("returns an empty array when nothing is pressed", () => {
      expect(e.getPressedFloors()).toEqual([]);
    });
  });

  // The deprecation is the point of these tests: the method is still part of
  // the shipped API surface and must keep behaving as it always did.
  /* eslint-disable @typescript-eslint/no-deprecated */
  describe("getFirstPressedFloor", () => {
    /**
     * Loads a fresh copy of the module, so the once-per-session warning has not
     * been used up by whatever else ran first.
     *
     * @returns The `Elevator` class of a newly evaluated module instance.
     */
    async function freshElevatorClass(): Promise<typeof Elevator> {
      vi.resetModules();
      return (await import("./elevator.ts")).Elevator;
    }

    it("returns the lowest pressed floor and warns about deprecation", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const FreshElevator = await freshElevatorClass();
      const fresh = new FreshElevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      fresh.pressFloorButton(3);
      fresh.pressFloorButton(1);

      expect(fresh.getFirstPressedFloor()).toBe(1);
      expect(warn).toHaveBeenCalledWith(
        "You are using a deprecated feature scheduled for removal: getFirstPressedFloor",
      );
      warn.mockRestore();
    });

    it("returns 0 when nothing is pressed", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(e.getFirstPressedFloor()).toBe(0);
      warn.mockRestore();
    });

    it("warns once per session, not once per call", async () => {
      // Player code calls this from update(), which runs about sixty times a
      // second: warning on every call floods the console the player is
      // debugging in, and the notice says the same thing every time.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const FreshElevator = await freshElevatorClass();
      const first = new FreshElevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      const second = new FreshElevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);

      for (let frame = 0; frame < 120; frame++) {
        first.getFirstPressedFloor();
        second.getFirstPressedFloor();
      }

      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("still answers correctly after the notice has been spent", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      e.getFirstPressedFloor();
      e.pressFloorButton(2);

      expect(e.getFirstPressedFloor()).toBe(2);
      warn.mockRestore();
    });
  });
  /* eslint-enable @typescript-eslint/no-deprecated */

  describe("passengers", () => {
    it("assigns a slot position to a boarding passenger", () => {
      const pos = e.userEntering(passenger(70));
      expect(pos).not.toBe(false);
      expect(e.userSlots.filter((slot) => slot.user !== null)).toHaveLength(1);
    });

    it("fills every slot before reporting itself as full", () => {
      expect(e.isEmpty()).toBe(true);
      expect(e.isFull()).toBe(false);
      for (let i = 0; i < e.maxUsers; i++) {
        expect(e.userEntering(passenger(70))).not.toBe(false);
        expect(e.isEmpty()).toBe(false);
      }
      expect(e.isFull()).toBe(true);
    });

    it("refuses to board a passenger when full", () => {
      for (let i = 0; i < e.maxUsers; i++) {
        e.userEntering(passenger(70));
      }
      expect(e.userEntering(passenger(70))).toBe(false);
    });

    it("uses a randomised starting slot but always finds the free one", () => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
      const first = e.userEntering(passenger(70));
      expect(first).toEqual(e.userSlots[e.maxUsers - 1]?.pos);
      randomSpy.mockRestore();
    });

    it("frees the slot when a passenger leaves", () => {
      const user = passenger(70);
      e.userEntering(user);
      expect(e.isEmpty()).toBe(false);
      e.userExiting(user);
      expect(e.isEmpty()).toBe(true);
    });

    it("ignores exits by passengers that never boarded", () => {
      const boarded = passenger(70);
      e.userEntering(boarded);
      e.userExiting(passenger(70));
      expect(e.isEmpty()).toBe(false);
    });

    it("normalizes the load factor", () => {
      expect(e.getLoadFactor()).toBe(0);
      e.userEntering(passenger(100));
      expect(e.getLoadFactor()).toBe(0.25);
      e.userEntering(passenger(50));
      expect(e.getLoadFactor()).toBe(0.375);
    });

    it("reaches a load factor of 1 at nominal full load", () => {
      for (let i = 0; i < e.maxUsers; i++) {
        e.userEntering(passenger(100));
      }
      expect(e.getLoadFactor()).toBe(1);
    });
  });

  describe("indicators", () => {
    it("emits indicatorstate_change when either indicator is assigned", () => {
      const changed = vi.fn();
      e.on("indicatorstate_change", changed);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);
      expect(changed).toHaveBeenNthCalledWith(1, { up: false, down: true });

      e.goingDownIndicator = false;
      e.trigger("change:goingDownIndicator", false);
      expect(changed).toHaveBeenNthCalledWith(2, { up: false, down: false });
    });

    it("emits no indicatorstate_change when neither indicator actually moved", () => {
      const changed = vi.fn();
      e.on("indicatorstate_change", changed);

      // Both indicators start lit, so these announce nothing.
      e.trigger("change:goingUpIndicator", true);
      e.trigger("change:goingDownIndicator", true);

      expect(changed).not.toHaveBeenCalled();
    });

    it("re-offers boarding when an indicator changes while parked at a floor", () => {
      // Issues #59, #74, #98, #124: boarding is otherwise only ever offered
      // from handleDestinationArrival, so a passenger the indicators refused is
      // never reconsidered once the elevator has come to rest.
      const entranceAvailable = vi.fn();
      e.on("entrance_available", entranceAvailable);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(entranceAvailable).toHaveBeenCalledTimes(1);
      expect(entranceAvailable).toHaveBeenCalledWith(e);
    });

    it("emits no other arrival event when an indicator changes", () => {
      const stopped = vi.fn();
      const stoppedAtFloor = vi.fn();
      const exitAvailable = vi.fn();
      const floorButtonsChanged = vi.fn();
      e.on("stopped", stopped);
      e.on("stopped_at_floor", stoppedAtFloor);
      e.on("exit_available", exitAvailable);
      e.on("floor_buttons_changed", floorButtonsChanged);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(stopped).not.toHaveBeenCalled();
      expect(stoppedAtFloor).not.toHaveBeenCalled();
      expect(exitAvailable).not.toHaveBeenCalled();
      expect(floorButtonsChanged).not.toHaveBeenCalled();
      expect(e.moveCount).toBe(0);
    });

    it("does not re-offer boarding while the elevator is moving", () => {
      const entranceAvailable = vi.fn();
      e.goToFloor(3);
      stepElevator(e, 0.3, 0.015);
      e.on("entrance_available", entranceAvailable);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(entranceAvailable).not.toHaveBeenCalled();
    });

    it("does not re-offer boarding when stopped between floors", () => {
      const entranceAvailable = vi.fn();
      e.goToFloor(1.5);
      stepElevator(e, 10.0, 0.015);
      expect(e.isMoving).toBe(false);
      e.on("entrance_available", entranceAvailable);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(entranceAvailable).not.toHaveBeenCalled();
    });

    it("does not re-offer boarding from inside the arrival sequence", () => {
      // isMoving is cleared before handleDestinationArrival runs, so an
      // indicator flip from a stopped_at_floor handler used to satisfy the
      // re-offer guard and fire entrance_available *before* exit_available -
      // boarding offered before the passengers on board had a chance to get
      // off, which is exactly what the comment above the arrival events says
      // must not happen. The arrival sequence emits its own entrance_available
      // moments later, with the new indicator state already in effect.
      const seen: string[] = [];
      e.on("stopped_at_floor", () => {
        seen.push("stopped_at_floor");
        e.goingUpIndicator = false;
        e.trigger("change:goingUpIndicator", false);
      });
      e.on("exit_available", () => {
        seen.push("exit_available");
      });
      e.on("entrance_available", () => {
        seen.push("entrance_available");
      });

      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);

      expect(seen).toEqual(["stopped_at_floor", "exit_available", "entrance_available"]);
    });

    it("re-offers boarding for an indicator flip made after the arrival sequence", () => {
      // The suppression above is scoped to the sequence, not to the stop.
      const entranceAvailable = vi.fn();
      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);
      e.on("entrance_available", entranceAvailable);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(entranceAvailable).toHaveBeenCalledTimes(1);
    });

    it("announces boarding when the re-offer actually fills a slot", () => {
      // Upstream issue #105: whoever decides when the car may leave has to know
      // that a passenger is mid-walk-in, and the re-offer is a boarding path
      // the arrival sequence knows nothing about.
      const seen: string[] = [];
      e.on("entrance_available", (elevator) => {
        seen.push("entrance_available");
        elevator.userEntering(passenger(70));
      });
      e.on("boarding_started", () => {
        seen.push("boarding_started");
      });

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(seen).toEqual(["entrance_available", "boarding_started"]);
    });

    it("stays silent when the re-offer boards nobody", () => {
      // What keeps the re-offer free for player code that rewrites the
      // indicators every frame: no boarder, no dwell, no delay.
      const boardingStarted = vi.fn();
      e.on("boarding_started", boardingStarted);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(boardingStarted).not.toHaveBeenCalled();
    });

    it("does not re-offer boarding when the elevator is full", () => {
      const entranceAvailable = vi.fn();
      for (let i = 0; i < e.maxUsers; i++) {
        e.userEntering(passenger(70));
      }
      e.on("entrance_available", entranceAvailable);

      e.goingUpIndicator = false;
      e.trigger("change:goingUpIndicator", false);

      expect(entranceAvailable).not.toHaveBeenCalled();
    });
  });

  describe("arrival", () => {
    it("clears the floor button and emits the arrival events in order", () => {
      e.pressFloorButton(2);

      const seen: string[] = [];
      e.on("stopped", () => {
        seen.push("stopped");
      });
      e.on("floor_buttons_changed", () => {
        seen.push("floor_buttons_changed");
      });
      e.on("stopped_at_floor", () => {
        seen.push("stopped_at_floor");
      });
      e.on("exit_available", () => {
        seen.push("exit_available");
      });
      e.on("entrance_available", () => {
        seen.push("entrance_available");
      });

      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);

      expect(seen).toEqual([
        "stopped",
        "floor_buttons_changed",
        "stopped_at_floor",
        "exit_available",
        "entrance_available",
      ]);
      expect(e.getPressedFloors()).toEqual([]);
    });

    it("announces boarding on arrival too, after entrance_available", () => {
      // The same signal from both boarding paths, so the facade's dwell has one
      // rule to follow rather than two.
      const seen: string[] = [];
      e.on("entrance_available", (elevator) => {
        seen.push("entrance_available");
        elevator.userEntering(passenger(70));
      });
      e.on("boarding_started", () => {
        seen.push("boarding_started");
      });

      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);

      expect(seen).toEqual(["entrance_available", "boarding_started"]);
    });

    it("emits only stopped when halting between floors", () => {
      const stopped = vi.fn();
      const stoppedAtFloor = vi.fn();
      e.on("stopped", stopped);
      e.on("stopped_at_floor", stoppedAtFloor);

      e.goToFloor(1.5);
      stepElevator(e, 10.0, 0.015);

      expect(stopped).toHaveBeenCalledTimes(1);
      expect(stopped).toHaveBeenCalledWith(1.5);
      expect(stoppedAtFloor).not.toHaveBeenCalled();
    });

    it("re-raises arrival events when told to go to the floor it is already on", () => {
      const stoppedAtFloor = vi.fn();
      e.on("stopped_at_floor", stoppedAtFloor);
      e.goToFloor(0);
      stepElevator(e, 1.0, 0.015);
      expect(stoppedAtFloor).toHaveBeenCalledTimes(1);
      expect(stoppedAtFloor).toHaveBeenCalledWith(0);
    });
  });

  describe("movement bookkeeping", () => {
    it("counts floor changes", () => {
      expect(e.moveCount).toBe(0);
      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);
      expect(e.moveCount).toBe(2);
    });

    it("emits new_current_floor as it passes each floor", () => {
      const seen: number[] = [];
      e.on("new_current_floor", (floorNum) => {
        seen.push(floorNum);
      });
      e.goToFloor(3);
      stepElevator(e, 10.0, 0.015);
      expect(seen).toEqual([1, 2, 3]);
    });

    it("does not move while a task occupies it", () => {
      e.goToFloor(3);
      e.wait(1.0);
      const y = e.y;
      e.updateElevatorMovement(0.015);
      expect(e.y).toBe(y);
      expect(e.velocityY).toBe(0);
    });

    it("refuses a new destination while busy", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      e.wait(1.0);
      expect(() => {
        e.goToFloor(2);
      }).toThrow(MovableBusyError);
      error.mockRestore();
    });

    it("clamps the speed to MAXSPEED", () => {
      e.goToFloor(3);
      e.velocityY = -1000;
      e.updateElevatorMovement(0.015);
      expect(Math.abs(e.velocityY)).toBeLessThanOrEqual(e.MAXSPEED + e.ACCELERATION * 0.015);
    });

    it("setFloorPosition teleports without emitting passing_floor", () => {
      const passing = vi.fn();
      e.on("passing_floor", passing);
      e.setFloorPosition(3);
      expect(e.y).toBe(e.getYPosOfFloor(3));
      expect(e.currentFloor).toBe(3);
      expect(e.previousTruncFutureFloorIfStopped).toBe(3);
      expect(passing).not.toHaveBeenCalled();
    });
  });
});

/**
 * The invariant behind the early return at the top of `updateElevatorMovement`,
 * which the legacy code wondered aloud about (`legacy-1.x:elevator.js:86`).
 */
describe("a busy elevator is always a stopped elevator", () => {
  it("never has a velocity when the movement step skips it, in any challenge", () => {
    // Every shipped challenge, three seeds and three programs: the naive first
    // solution, one that rewrites the indicators every frame, and one that
    // stops mid-flight and jumps the queue at random. Between them they reach
    // both callers of the dwell — arrival and the indicator re-offer — a few
    // thousand times.
    const totals: SweepTotals = { busySteps: 0, taskStarts: 0, violations: [] };
    for (const challenge of challenges) {
      for (const seed of [1, 2, 3]) {
        const random = seededRandom(seed);
        const mock = vi.spyOn(Math, "random").mockImplementation(random);
        try {
          for (const program of [
            roundRobinProgram(),
            directionalProgram(),
            erraticProgram(random),
          ]) {
            expect(sweepChallenge(challenge.options, program, totals)).toEqual([]);
          }
        } finally {
          mock.mockRestore();
        }
      }
    }

    expect(totals.violations).toEqual([]);
    // And the sweep really did exercise the paths it claims to.
    expect(totals.taskStarts).toBeGreaterThan(1000);
    expect(totals.busySteps).toBeGreaterThan(10000);
  });

  it("would be caught freezing mid-flight, and would hold its speed if it did", () => {
    // The counter-example the sweep never produces, constructed by hand: this
    // is what the early return does with a velocity, and why the invariant is
    // worth stating. The car neither drifts nor slows — the whole integration
    // step is skipped — and it resumes at exactly the speed it froze at.
    const e = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
    e.setFloorPosition(0);
    e.goToFloor(3);
    stepElevator(e, 0.2, 0.015);

    const frozenY = e.y;
    const frozenVelocity = e.velocityY;
    expect(frozenVelocity).not.toBe(0);

    e.wait(1.0);
    const seen: number[] = [];
    timeForwarder(0.5, 0.015, (step) => {
      e.update(step);
      if (e.isBusy()) {
        seen.push(e.velocityY);
      }
      e.updateElevatorMovement(step);
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((velocityY) => velocityY === frozenVelocity)).toBe(true);
    expect(e.y).toBe(frozenY);
    expect(e.velocityY).toBe(frozenVelocity);
  });
});
