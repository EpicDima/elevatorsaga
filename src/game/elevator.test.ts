import { describe, expect, it, vi, beforeEach } from "vitest";

import { levels } from "./levels.ts";
import { Elevator, type ElevatorDirection, type ElevatorPassenger } from "./elevator.ts";
import { createFrameRequester } from "./frame-requester.ts";
import { MovableBusyError, type MovableTask } from "./movable.ts";
import { assertWithinRange, at, scriptedRandom, timeForwarder } from "./test-helpers.ts";
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

/** A deterministic stand-in for `Math.random` (mulberry32), reproducible across runs and machines. */
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
  busySteps: number;
  taskStarts: number;
  /** Velocities recorded where the invariant says there can be none. */
  violations: number[];
}

/** Hooks the `currentTask` property rather than {@link Elevator.wait}, catching every assignment. */
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

/** Plays one level with one program, recording what the busy check saw, and returns whatever it threw. */
function sweepLevel(
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

/** Directional service, rewriting the indicators every frame; exercises the indicator re-offer. */
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

/** A deliberately hostile program: stops mid-flight, jumps the queue, and flips indicators at random. */
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

  describe("zones", () => {
    /** A car serving the bottom half of a four-floor building. */
    function zoned(servedFloors: readonly number[]): Elevator {
      const zonedElevator = new Elevator(
        1.5,
        FLOOR_COUNT,
        FLOOR_HEIGHT,
        undefined,
        undefined,
        servedFloors,
      );
      zonedElevator.setFloorPosition(0);
      return zonedElevator;
    }

    it("serves every floor when no zone was given", () => {
      for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        expect(e.serves(floor)).toBe(true);
      }
    });

    it("serves every floor when the zone is empty", () => {
      // An empty list must mean the same as no list at all.
      const unzoned = zoned([]);
      for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        expect(unzoned.serves(floor)).toBe(true);
      }
    });

    it("serves the floors of its zone and no others", () => {
      const lower = zoned([0, 1]);
      expect(lower.serves(0)).toBe(true);
      expect(lower.serves(1)).toBe(true);
      expect(lower.serves(2)).toBe(false);
      expect(lower.serves(3)).toBe(false);
    });

    it("refuses a trip with either end outside its zone, however the indicators are set", () => {
      const lower = zoned([0, 1]);
      lower.goingUpIndicator = true;
      lower.goingDownIndicator = true;

      expect(lower.isSuitableForTravelBetween(0, 1)).toBe(true);
      expect(lower.isSuitableForTravelBetween(0, 2), "destination outside").toBe(false);
      expect(lower.isSuitableForTravelBetween(3, 1), "origin outside").toBe(false);
      // Even the no-op trip, which the indicators alone always allow.
      expect(lower.isSuitableForTravelBetween(2, 2), "both ends outside").toBe(false);
    });

    it("still drives to a floor it does not serve", () => {
      // A zone is a rule about service, not about the shaft; a silently refused goToFloor would be undebuggable.
      const lower = zoned([0, 1]);
      lower.goToFloor(3);
      stepElevator(lower, 10.0, 0.015);
      expect(lower.currentFloor).toBe(3);
      expect(lower.serves(3)).toBe(false);
    });
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

  it("approaches the destination floor without ever passing it", () => {
    // passing_floor is withheld even while approaching: arriving isn't passing it.
    const passed = vi.fn();
    e.on("passing_floor", passed);
    e.goToFloor(2);
    stepElevator(e, 0.5, 0.015);

    expect(e.isApproachingFloor(2)).toBe(true);

    stepElevator(e, 10.0, 0.015);
    expect(e.currentFloor).toBe(2);
    expect(passed).toHaveBeenCalledTimes(1);
    expect(passed.mock.calls[0]?.slice(0, 1)).toEqual([1]);
  });

  it("emits passing floor events when going from floor 3 to 0", () => {
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

  it("reports direction up when traveling from floor 0 to 3", () => {
    // y grows downward, so climbing floors means a negative velocityY, reported as "up".
    const directions: ElevatorDirection[] = [];
    e.on("passing_floor", (_floorNum, direction) => {
      directions.push(direction);
    });
    e.goToFloor(3);
    stepElevator(e, 10.0, 0.015);
    expect(directions).toEqual(["up", "up"]);
  });

  it("reports direction down when traveling from floor 3 to 0", () => {
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

  // The method is still part of the shipped API and must keep behaving as it always did.
  /* eslint-disable @typescript-eslint/no-deprecated */
  describe("getFirstPressedFloor", () => {
    /** Loads a fresh copy of the module, so the once-per-session warning isn't already spent. */
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
      // update() runs many times a second; warning on every call would flood the console.
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

    it("uses a randomized starting slot but always finds the free one", () => {
      // Falls back to the unseeded source when built without one.
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
      const first = e.userEntering(passenger(70));
      expect(first).toEqual(e.userSlots[e.maxUsers - 1]?.pos);
      randomSpy.mockRestore();
    });

    it("draws the starting slot from the stream it was handed", () => {
      // 0.99 and 0 are the top and bottom of the offset's range: last slot, then first.
      const global = vi.spyOn(Math, "random");
      const seeded = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT, 4, scriptedRandom([0.99, 0]));

      expect(seeded.userEntering(passenger(70))).toEqual(at(seeded.userSlots, 3).pos);
      expect(seeded.userEntering(passenger(70))).toEqual(at(seeded.userSlots, 0).pos);
      expect(global).not.toHaveBeenCalled();
      global.mockRestore();
    });

    it("spends exactly one value per boarding attempt, a full car included", () => {
      // The offset is drawn before the scan, so a full-car attempt still consumes one value.
      const random = vi.fn(() => 0.5);
      const small = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT, 2, random);

      expect(small.userEntering(passenger(70))).not.toBe(false);
      expect(small.userEntering(passenger(70))).not.toBe(false);
      expect(random).toHaveBeenCalledTimes(2);

      expect(small.userEntering(passenger(70))).toBe(false);
      expect(random).toHaveBeenCalledTimes(3);
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
      // Otherwise a passenger the indicators refused is never reconsidered once at rest.
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
      // isMoving clears early, so a flip mid-handler could offer boarding before exit_available.
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
      // The re-offer is a boarding path the arrival sequence knows nothing about.
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
      // Keeps the re-offer safe for player code that rewrites the indicators every frame.
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
      // Same signal from both boarding paths, so the facade's dwell has one rule to follow.
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

    it("samples how full it is on every floor it crosses", () => {
      // Two slots at the nominal 100 is a load factor of exactly 0.5; two floors crossed
      // at that load sum to exactly 1, both exact in binary, so no epsilon is needed.
      e.userEntering(passenger(100));
      e.userEntering(passenger(100));
      expect(e.loadFactorSumOnMove).toBe(0);
      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);
      expect(e.moveCount).toBe(2);
      expect(e.loadFactorSumOnMove).toBe(1);
    });

    it("counts an empty car's floors without adding to the load it carried", () => {
      e.goToFloor(2);
      stepElevator(e, 10.0, 0.015);
      expect(e.moveCount).toBe(2);
      expect(e.loadFactorSumOnMove).toBe(0);
    });

    it("counts one stop however many floors the journey crossed", () => {
      // The doors open once at the end of the journey, whatever the distance was.
      expect(e.stopCount).toBe(0);
      e.goToFloor(3);
      stepElevator(e, 10.0, 0.015);
      expect(e.moveCount).toBe(3);
      expect(e.stopCount).toBe(1);
    });

    it("counts a stop for a car sent to the floor it is already on", () => {
      // A real door opening, so this can't be derived from moveCount.
      e.goToFloor(0);
      stepElevator(e, 1.0, 0.015);
      expect(e.moveCount).toBe(0);
      expect(e.stopCount).toBe(1);
    });

    it("counts nothing for a car that comes to rest between floors", () => {
      // Nothing opens, so nothing is counted; a stop nobody could board at is not a stop.
      e.goToFloor(1.5);
      stepElevator(e, 10.0, 0.015);
      expect(e.isOnAFloor()).toBe(false);
      expect(e.stopCount).toBe(0);
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

/** The invariant behind the early return at the top of `updateElevatorMovement`. */
describe("a busy elevator is always a stopped elevator", () => {
  // The suite's one expensive computation, raised past the default timeout.
  it(
    "never has a velocity when the movement step skips it, in any level",
    { timeout: 30_000 },
    () => {
      // Sweeps every shipped level, reaching both callers of the dwell: arrival and the re-offer.
      const totals: SweepTotals = { busySteps: 0, taskStarts: 0, violations: [] };
      for (const level of levels) {
        for (const seed of [1, 2, 3]) {
          const random = seededRandom(seed);
          const mock = vi.spyOn(Math, "random").mockImplementation(random);
          try {
            for (const program of [
              roundRobinProgram(),
              directionalProgram(),
              erraticProgram(random),
            ]) {
              expect(sweepLevel(level.options, program, totals)).toEqual([]);
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
    },
  );

  it("would be caught freezing mid-flight, and would hold its speed if it did", () => {
    // Constructed by hand: the whole integration step is skipped, so it resumes frozen.
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
