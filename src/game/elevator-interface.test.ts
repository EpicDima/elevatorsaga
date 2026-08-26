import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import { Elevator } from "./elevator.ts";
import { ElevatorInterface, type ElevatorInterfaceErrorHandler } from "./elevator-interface.ts";
import type { Floor } from "./floor.ts";
import { at, timeForwarder } from "./test-helpers.ts";
import { createFloors } from "./world.ts";

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

const FLOOR_COUNT = 4;
const FLOOR_HEIGHT = 40;

/** Runs the elevator forward the way the world does: task first, then physics. */
function stepElevator(e: Elevator, dt: number, stepSize: number): void {
  timeForwarder(dt, stepSize, (step) => {
    e.update(step);
    e.updateElevatorMovement(step);
  });
}

/** Steps the elevator until `predicate` holds, giving up after `maxTime`. */
function stepUntil(e: Elevator, predicate: () => boolean, maxTime = 10.0): void {
  const stepSize = 0.015;
  let elapsed = 0.0;
  while (elapsed < maxTime && !predicate()) {
    e.update(stepSize);
    e.updateElevatorMovement(stepSize);
    elapsed += stepSize;
  }
}

describe("Elevator interface", () => {
  let e: Elevator;
  let floors: Floor[];
  let elevInterface: ElevatorInterface;
  let errorHandler: ReturnType<typeof vi.fn<ElevatorInterfaceErrorHandler>>;

  beforeEach(() => {
    e = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
    e.setFloorPosition(0);
    floors = createFloors(FLOOR_COUNT, FLOOR_HEIGHT, () => undefined, true);
    errorHandler = vi.fn<ElevatorInterfaceErrorHandler>();
    elevInterface = new ElevatorInterface(e, floors, errorHandler);
  });

  it("exposes exactly the documented surface and nothing else", () => {
    const exposed = new Set<string>();
    for (
      let proto: object | null = elevInterface;
      proto !== null && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto) as object | null
    ) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        exposed.add(key);
      }
    }
    exposed.delete("constructor");

    expect([...exposed].sort()).toEqual([
      "checkDestinationQueue",
      "currentFloor",
      "destinationDirection",
      "destinationQueue",
      "getFirstPressedFloor",
      "getPressedFloors",
      "goToFloor",
      "goingDownIndicator",
      "goingUpIndicator",
      "isApproachingFloor",
      "isEmpty",
      "isFull",
      "loadFactor",
      "maxPassengerCount",
      "off",
      "offAll",
      "on",
      "once",
      "one",
      "servedFloors",
      "stop",
      "takeRequest",
      "trigger",
    ]);
    for (const forbidden of [
      "triggerSafe",
      // The elevator behind the facade must stay unreachable.
      "userEntering",
      "userExiting",
      "setFloorPosition",
      "updateElevatorMovement",
      "pressFloorButton",
      "isBusy",
      "wait",
      "moveTo",
      "y",
      "destinationY",
      // Not published: exposing it would make the braking-curve kinematics part of the player API.
      "getExactFutureFloorIfStopped",
      "getExactCurrentFloor",
    ]) {
      expect(exposed.has(forbidden)).toBe(false);
    }
    expect(elevInterface).not.toBe(e);
  });

  it("forwards the whole emitter surface to the emitter it holds", () => {
    const once = vi.fn();
    const removed = vi.fn();
    const kept = vi.fn();
    const dropped = vi.fn();
    expect(elevInterface.once("stopped_at_floor", once)).toBe(elevInterface);
    expect(elevInterface.on("stopped_at_floor", removed)).toBe(elevInterface);
    expect(elevInterface.on("stopped_at_floor", kept)).toBe(elevInterface);
    expect(elevInterface.off("stopped_at_floor", removed)).toBe(elevInterface);

    expect(elevInterface.trigger("stopped_at_floor", 1)).toBe(elevInterface);
    elevInterface.trigger("stopped_at_floor", 2);

    expect(once).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(2);

    elevInterface.on("idle", dropped);
    expect(elevInterface.offAll()).toBe(elevInterface);
    elevInterface.checkDestinationQueue();
    e.trigger("stopped_at_floor", 3);

    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(2);
  });

  describe("events", () => {
    it("propagates stopped_at_floor event", () => {
      const someHandler = vi.fn();
      elevInterface.on("stopped_at_floor", someHandler);
      e.trigger("stopped_at_floor", 3);
      expect(someHandler).toHaveBeenCalledWith(3);
    });

    it("propagates floor_button_pressed event", () => {
      const someHandler = vi.fn();
      elevInterface.on("floor_button_pressed", someHandler);
      e.pressFloorButton(2);
      expect(someHandler).toHaveBeenCalledWith(2);
    });

    it("propagates passing_floor event with its direction", () => {
      const someHandler = vi.fn();
      elevInterface.on("passing_floor", someHandler);
      e.trigger("passing_floor", 1, "up");
      expect(someHandler).toHaveBeenCalledWith(1, "up");
    });

    it("prepends the event name when one handler covers several events", () => {
      const calls: unknown[][] = [];
      elevInterface.on("stopped_at_floor passing_floor", (...args: unknown[]) => {
        calls.push(args);
      });

      e.trigger("passing_floor", 1, "up");
      e.trigger("stopped_at_floor", 2);

      expect(calls).toEqual([
        ["passing_floor", 1, "up"],
        ["stopped_at_floor", 2],
      ]);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("leaves a single-event registration free of the event name", () => {
      const single = vi.fn();
      elevInterface.on("passing_floor", single);

      e.trigger("passing_floor", 1, "up");

      expect(single).toHaveBeenCalledWith(1, "up");
    });

    it("does not propagate stopped event", () => {
      const someHandler = vi.fn();
      // @ts-expect-error -- `stopped` is deliberately not part of the player API
      elevInterface.on("stopped", someHandler);
      e.trigger("stopped", 3.1);
      expect(someHandler).not.toHaveBeenCalled();
    });

    it("triggers idle event at start", () => {
      const someHandler = vi.fn();
      elevInterface.on("idle", someHandler);
      elevInterface.checkDestinationQueue();
      expect(someHandler).toHaveBeenCalled();
    });

    it("triggers idle event when queue empties", () => {
      const someHandler = vi.fn();
      elevInterface.on("idle", someHandler);
      elevInterface.destinationQueue = [11, 21];
      e.y = 11;
      e.trigger("stopped", e.y);
      expect(someHandler).not.toHaveBeenCalled();
      e.y = 21;
      e.trigger("stopped", e.y);
      expect(someHandler).toHaveBeenCalled();
    });

    it("supports the legacy one() spelling of once()", () => {
      const handler = vi.fn();

      expect(elevInterface.one("stopped_at_floor", handler)).toBe(elevInterface);
      e.trigger("stopped_at_floor", 1);
      e.trigger("stopped_at_floor", 2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });

    it('unregisters every handler on off("*")', () => {
      // A literal event named "*" finds nothing, so a regression here leaks every handler.
      const stopped = vi.fn();
      const idle = vi.fn();
      elevInterface.on("stopped_at_floor", stopped);
      elevInterface.on("idle", idle);

      expect(elevInterface.off("*")).toBe(elevInterface);
      e.trigger("stopped_at_floor", 1);
      elevInterface.checkDestinationQueue();

      expect(stopped).not.toHaveBeenCalled();
      expect(idle).not.toHaveBeenCalled();
    });

    it("calls handlers with the interface as `this`", () => {
      const seen: unknown[] = [];
      elevInterface.on("stopped_at_floor", function (this: unknown): void {
        seen.push(this);
      });

      e.trigger("stopped_at_floor", 1);

      expect(seen).toHaveLength(1);
      expect(seen[0]).toBe(elevInterface);
    });

    it("supports the legacy `function () { this.goToFloor(0); }` idiom", () => {
      e.setFloorPosition(2);
      elevInterface.on("idle", function (this: ElevatorInterface): void {
        this.goToFloor(0);
      });

      elevInterface.checkDestinationQueue();

      expect(elevInterface.destinationQueue).toEqual([0]);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("routes exceptions thrown by player handlers to the error handler", () => {
      const boom = new Error("boom");
      elevInterface.on("stopped_at_floor", () => {
        throw boom;
      });

      expect(() => {
        e.trigger("stopped_at_floor", 1);
      }).not.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("keeps running the remaining handlers of an event after one throws", () => {
      const boom = new Error("boom");
      const second = vi.fn();
      const third = vi.fn();
      elevInterface.on("stopped_at_floor", () => {
        throw boom;
      });
      elevInterface.on("stopped_at_floor", second);
      elevInterface.on("stopped_at_floor", third);

      e.trigger("stopped_at_floor", 1);

      expect(second).toHaveBeenCalledTimes(1);
      expect(third).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("runs a handler that threw again on the next dispatch", () => {
      const throwing = vi.fn(() => {
        throw new Error("boom");
      });
      elevInterface.on("stopped_at_floor", throwing);

      e.trigger("stopped_at_floor", 1);
      e.trigger("stopped_at_floor", 2);

      expect(throwing).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenCalledTimes(2);
    });

    it("keeps running the remaining idle handlers after one throws", () => {
      const boom = new Error("boom");
      const second = vi.fn();
      elevInterface.on("idle", () => {
        throw boom;
      });
      elevInterface.on("idle", second);

      elevInterface.checkDestinationQueue();

      expect(second).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("routes exceptions thrown by idle handlers", () => {
      const boom = new Error("boom");
      elevInterface.on("idle", () => {
        throw boom;
      });

      elevInterface.checkDestinationQueue();

      expect(errorHandler).toHaveBeenCalledWith(boom);
    });
  });

  it("stops when told told to stop", () => {
    const originalY = e.y;
    elevInterface.goToFloor(2);
    stepElevator(e, 10, 0.015);
    expect(e.y).not.toBe(originalY);

    elevInterface.goToFloor(0);
    stepElevator(e, 0.2, 0.015);
    const whenMovingY = e.y;

    elevInterface.stop();
    stepElevator(e, 10, 0.015);
    expect(e.y).not.toBe(whenMovingY);
    expect(e.y).not.toBe(originalY);
  });

  describe("destination direction", () => {
    it("reports stopped when already at the destination", () => {
      e.setFloorPosition(1);
      elevInterface.goToFloor(1);
      expect(elevInterface.destinationDirection()).toBe("stopped");
    });

    it("reports up when going up", () => {
      elevInterface.goToFloor(1);
      expect(elevInterface.destinationDirection()).toBe("up");
    });

    it("reports down when going down", () => {
      e.setFloorPosition(3);
      elevInterface.goToFloor(2);
      expect(elevInterface.destinationDirection()).toBe("down");
    });
  });

  describe("isApproachingFloor", () => {
    /** Calls the method the way untyped player code does: past the signature. */
    function looseIsApproachingFloor(value: unknown): boolean {
      return (
        elevInterface as unknown as { isApproachingFloor(floorNum: unknown): boolean }
      ).isApproachingFloor(value);
    }

    it("is true for the floors ahead while going up", () => {
      elevInterface.goToFloor(3);
      stepElevator(e, 0.1, 0.015);

      expect(elevInterface.isApproachingFloor(1)).toBe(true);
      expect(elevInterface.isApproachingFloor(3)).toBe(true);
    });

    it("is true for the floors ahead while going down", () => {
      e.setFloorPosition(3);
      elevInterface.goToFloor(0);
      stepElevator(e, 0.1, 0.015);

      expect(elevInterface.isApproachingFloor(2)).toBe(true);
      expect(elevInterface.isApproachingFloor(0)).toBe(true);
    });

    it("is false for every floor while the car stands still", () => {
      for (let floorNum = 0; floorNum < FLOOR_COUNT; floorNum++) {
        expect(elevInterface.isApproachingFloor(floorNum)).toBe(false);
      }

      elevInterface.goToFloor(2);
      stepUntil(e, () => !e.isMoving);
      expect(e.currentFloor).toBe(2);

      for (let floorNum = 0; floorNum < FLOOR_COUNT; floorNum++) {
        expect(elevInterface.isApproachingFloor(floorNum)).toBe(false);
      }
    });

    it("is false for a floor the car has already passed", () => {
      elevInterface.goToFloor(3);
      stepUntil(e, () => e.getExactCurrentFloor() > 1.5);

      expect(elevInterface.isApproachingFloor(1)).toBe(false);
      expect(elevInterface.isApproachingFloor(2)).toBe(true);
    });

    it("stays true for the floor the car is arriving at until it gets there", () => {
      elevInterface.goToFloor(2);
      // currentFloor() rounds, so it reads 2 well before the car actually gets there.
      stepUntil(e, () => e.currentFloor === 2);

      expect(elevInterface.currentFloor()).toBe(2);
      expect(e.getExactCurrentFloor()).toBeLessThan(2);
      expect(elevInterface.isApproachingFloor(2)).toBe(true);

      stepUntil(e, () => !e.isMoving);

      expect(e.getExactCurrentFloor()).toBe(2);
      expect(elevInterface.isApproachingFloor(2)).toBe(false);
    });

    it("looks at the direction of travel, not at where the car will stop", () => {
      // A floor past the destination still counts, as it does for passing_floor.
      elevInterface.goToFloor(1);
      stepElevator(e, 0.1, 0.015);

      expect(e.getDestinationFloor()).toBe(1);
      expect(elevInterface.isApproachingFloor(3)).toBe(true);
    });

    it("agrees with passing_floor about which floors have been passed", () => {
      // Forwarded rather than reimplemented, so player code and the event cannot disagree.
      const seen: [floorNum: number, approaching: boolean][] = [];
      elevInterface.on("passing_floor", (floorNum) => {
        seen.push([floorNum, elevInterface.isApproachingFloor(floorNum)]);
      });

      elevInterface.goToFloor(3);
      stepElevator(e, 10.0, 0.015);

      expect(seen).toEqual([
        [1, true],
        [2, true],
      ]);
      expect(elevInterface.isApproachingFloor(1)).toBe(false);
      expect(elevInterface.isApproachingFloor(2)).toBe(false);
    });

    it("coerces a string floor number, as untyped player code may pass one", () => {
      elevInterface.goToFloor(3);
      stepElevator(e, 0.1, 0.015);

      expect(looseIsApproachingFloor("2")).toBe(true);
      expect(looseIsApproachingFloor("0")).toBe(false);
    });

    it("accepts a position between floors, as goToFloor does", () => {
      elevInterface.goToFloor(3);
      stepUntil(e, () => e.getExactCurrentFloor() > 1.5);

      expect(elevInterface.isApproachingFloor(1.6)).toBe(true);
      expect(elevInterface.isApproachingFloor(1.4)).toBe(false);
    });

    it("clamps a floor outside the building, as goToFloor does", () => {
      elevInterface.goToFloor(3);
      stepElevator(e, 0.1, 0.015);

      expect(elevInterface.isApproachingFloor(99)).toBe(true);
      expect(elevInterface.isApproachingFloor(FLOOR_COUNT - 1)).toBe(true);
      expect(elevInterface.isApproachingFloor(-5)).toBe(false);
      expect(elevInterface.isApproachingFloor(0)).toBe(false);
    });

    it("clamps the same way for a car heading down", () => {
      e.setFloorPosition(3);
      elevInterface.goToFloor(0);
      stepElevator(e, 0.1, 0.015);

      expect(elevInterface.isApproachingFloor(-5)).toBe(true);
      expect(elevInterface.isApproachingFloor(99)).toBe(false);
    });

    describe("arguments that are not floor numbers", () => {
      const notFloorNumbers: readonly (readonly [call: string, value: unknown, named: string])[] = [
        ["isApproachingFloor()", undefined, "undefined"],
        ["isApproachingFloor(NaN)", Number.NaN, "NaN"],
        ['isApproachingFloor("abc")', "abc", '"abc"'],
        ["isApproachingFloor({})", {}, "an object"],
        ["isApproachingFloor(Infinity)", Number.POSITIVE_INFINITY, "Infinity"],
      ];

      for (const [call, value, named] of notFloorNumbers) {
        it(`refuses ${call} instead of answering a silent false`, () => {
          // `false` looks identical to a genuine "already behind us", so a typo would never surface.
          elevInterface.goToFloor(3);
          stepElevator(e, 0.1, 0.015);

          expect(() => looseIsApproachingFloor(value)).toThrow(TypeError);
          expect(() => looseIsApproachingFloor(value)).toThrow("elevator.isApproachingFloor");
          expect(() => looseIsApproachingFloor(value)).toThrow(named);
        });
      }

      it("reports the refusal through the player's own error path", () => {
        // In a real game this reaches World's error handler and pauses the game.
        elevInterface.on("idle", () => {
          looseIsApproachingFloor(undefined);
        });

        elevInterface.checkDestinationQueue();

        expect(errorHandler).toHaveBeenCalledTimes(1);
        const reported: unknown = errorHandler.mock.calls[0]?.[0];
        expect(reported).toBeInstanceOf(TypeError);
        expect((reported as Error).message).toContain("elevator.isApproachingFloor");
      });

      it("leaves the elevator running after refusing one", () => {
        elevInterface.goToFloor(2);
        expect(() => looseIsApproachingFloor(Number.NaN)).toThrow(TypeError);

        stepElevator(e, 20.0, 0.015);

        expect(e.currentFloor).toBe(2);
        expect(e.y).toBe(e.getYPosOfFloor(2));
        expect(elevInterface.destinationQueue).toEqual([]);
      });
    });
  });

  it("stores going up and going down properties", () => {
    expect(e.goingUpIndicator).toBe(true);
    expect(e.goingDownIndicator).toBe(true);
    expect(elevInterface.goingUpIndicator()).toBe(true);
    expect(elevInterface.goingDownIndicator()).toBe(true);

    elevInterface.goingUpIndicator(false);
    expect(elevInterface.goingUpIndicator()).toBe(false);
    expect(elevInterface.goingDownIndicator()).toBe(true);

    elevInterface.goingDownIndicator(false);
    expect(elevInterface.goingDownIndicator()).toBe(false);
    expect(elevInterface.goingUpIndicator()).toBe(false);
  });

  it("can chain calls to going up and down indicator functions", () => {
    elevInterface.goingUpIndicator(false).goingDownIndicator(false);
    expect(elevInterface.goingUpIndicator()).toBe(false);
    expect(elevInterface.goingDownIndicator()).toBe(false);
  });

  it("writes indicator changes through to the elevator and emits its event", () => {
    const indicatorChange = vi.fn();
    e.on("indicatorstate_change", indicatorChange);

    elevInterface.goingUpIndicator(false);

    expect(e.goingUpIndicator).toBe(false);
    expect(indicatorChange).toHaveBeenCalledWith({ up: false, down: true });
  });

  it("emits nothing when an indicator is written its current value", () => {
    // Without the guard, writing every frame would cascade into a re-offer each time.
    const indicatorChange = vi.fn();
    const upChange = vi.fn();
    e.on("indicatorstate_change", indicatorChange);
    e.on("change:goingUpIndicator", upChange);

    for (let i = 0; i < 10; i++) {
      elevInterface.goingUpIndicator(false);
    }

    expect(e.goingUpIndicator).toBe(false);
    expect(upChange).toHaveBeenCalledTimes(1);
    expect(indicatorChange).toHaveBeenCalledTimes(1);
  });

  it("still emits on every real indicator change", () => {
    const indicatorChange = vi.fn();
    e.on("indicatorstate_change", indicatorChange);

    for (let i = 0; i < 5; i++) {
      elevInterface.goingUpIndicator(false);
      elevInterface.goingUpIndicator(true);
    }

    expect(indicatorChange).toHaveBeenCalledTimes(10);
  });

  it("normalizes load factor", () => {
    for (let i = 0; i < 20; i++) {
      e.userEntering({ weight: 55 + i });
    }
    const load = elevInterface.loadFactor();
    expect(load).toBeGreaterThanOrEqual(0);
    expect(load).toBeLessThanOrEqual(1);
  });

  describe("occupancy", () => {
    it("reports empty, then neither, then full as passengers take slots", () => {
      const passengers = Array.from({ length: e.maxUsers }, (_unused, i) => ({ weight: 60 + i }));

      expect(elevInterface.isEmpty()).toBe(true);
      expect(elevInterface.isFull()).toBe(false);

      for (const passenger of passengers) {
        expect(elevInterface.isFull()).toBe(false);
        e.userEntering(passenger);
        expect(elevInterface.isEmpty()).toBe(false);
      }

      expect(elevInterface.isFull()).toBe(true);

      for (const passenger of passengers) {
        e.userExiting(passenger);
      }

      expect(elevInterface.isEmpty()).toBe(true);
      expect(elevInterface.isFull()).toBe(false);
    });

    it("answers full where loadFactor cannot", () => {
      // Light passengers fill every slot but read well under 1 on loadFactor.
      for (let i = 0; i < e.maxUsers; i++) {
        e.userEntering({ weight: 55 });
      }

      expect(elevInterface.isFull()).toBe(true);
      expect(elevInterface.loadFactor()).toBeCloseTo(0.55, 10);
    });
  });

  it("doesnt raise unexpected events when told to stop when passing floor", () => {
    e.setFloorPosition(2);
    elevInterface.goToFloor(0);
    let passingFloorEventCount = 0;
    elevInterface.on("passing_floor", (floorNum) => {
      passingFloorEventCount++;
      // Overshoot can raise this more than once; only floor 1 should ever be passed.
      expect(floorNum, "floor being passed").toBe(1);
      elevInterface.stop();
    });
    stepElevator(e, 3.0, 0.01401);
    expect(passingFloorEventCount).toBeGreaterThan(0);
  });

  describe("simple accessors", () => {
    it("forwards currentFloor, maxPassengerCount and getPressedFloors", () => {
      e.setFloorPosition(2);
      e.pressFloorButton(1);
      e.pressFloorButton(3);

      expect(elevInterface.currentFloor()).toBe(2);
      expect(elevInterface.maxPassengerCount()).toBe(e.maxUsers);
      expect(elevInterface.getPressedFloors()).toEqual([1, 3]);
    });

    describe("servedFloors", () => {
      /** The facade over a car serving `servedFloors` of the same building. */
      function facadeOver(servedFloors: readonly number[]): ElevatorInterface {
        return new ElevatorInterface(
          new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT, undefined, undefined, servedFloors),
          floors,
          errorHandler,
        );
      }

      it("reports every floor of the building for a car with no zone", () => {
        // Always one shape, so callers need no special case for unzoned cars.
        expect(elevInterface.servedFloors()).toEqual([0, 1, 2, 3]);
      });

      it("reports a zoned car's own floors, in ascending order", () => {
        expect(facadeOver([2, 0]).servedFloors()).toEqual([0, 2]);
      });

      it("reports every floor for a car whose zone is empty", () => {
        expect(facadeOver([]).servedFloors()).toEqual([0, 1, 2, 3]);
      });

      it("hands out a fresh array each call", () => {
        // Player code sorting or splicing the answer must not reach into the engine.
        const zoned = facadeOver([1, 2]);
        const first = zoned.servedFloors();
        first.length = 0;
        expect(zoned.servedFloors()).toEqual([1, 2]);
        expect(zoned.servedFloors()).not.toBe(first);
      });

      it("says nothing about where the car can be sent", () => {
        // A zone is a rule about service, not about the shaft.
        const zoned = facadeOver([0, 1]);
        zoned.goToFloor(3);
        expect(zoned.destinationQueue).toEqual([3]);
      });
    });

    it("forwards the deprecated getFirstPressedFloor", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      e.pressFloorButton(3);
      e.pressFloorButton(1);
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the deprecation is what is under test
      expect(elevInterface.getFirstPressedFloor()).toBe(1);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe("takeRequest", () => {
    /** Puts somebody on `from` waiting to be taken to `to`. */
    function waits(from: number, to: number): void {
      at(floors, from).requestDestination(to);
    }

    it("books this car for a journey somebody is waiting to make", () => {
      waits(1, 3);

      expect(elevInterface.takeRequest(1, 3)).toBe(true);
      expect(at(floors, 1).assignedElevator(3)).toBe(e);
    });

    it("books the car itself, never the facade over it", () => {
      // The floor compares the booked car against the one out front; a facade there would match nothing.
      waits(1, 3);
      elevInterface.takeRequest(1, 3);

      expect(at(floors, 1).assignedElevator(3)).not.toBe(elevInterface);
    });

    it("refuses a journey nobody is waiting to make", () => {
      expect(elevInterface.takeRequest(1, 3)).toBe(false);
      expect(at(floors, 1).assignedElevator(3)).toBeNull();
    });

    it("refuses every booking in a building whose passengers press buttons", () => {
      const hallCallFloors = createFloors(FLOOR_COUNT, FLOOR_HEIGHT, () => undefined);
      const facade = new ElevatorInterface(e, hallCallFloors, errorHandler);
      at(hallCallFloors, 1).pressUpButton();

      expect(facade.takeRequest(1, 3)).toBe(false);
    });

    it("refuses a journey this car cannot serve end to end", () => {
      const zoned = new ElevatorInterface(
        new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT, undefined, undefined, [0, 1]),
        floors,
        errorHandler,
      );
      waits(1, 3);

      expect(zoned.takeRequest(1, 3)).toBe(false);
      expect(at(floors, 1).assignedElevator(3)).toBeNull();
    });

    it("says the same thing again without doing anything again", () => {
      // Lets a program book on every frame: re-booking the same car is not a change.
      const assigned = vi.fn();
      waits(1, 3);
      elevInterface.takeRequest(1, 3);
      at(floors, 1).on("elevator_assigned", assigned);

      expect(elevInterface.takeRequest(1, 3)).toBe(true);
      expect(assigned).not.toHaveBeenCalled();
    });

    it("takes over a journey another car was booked for", () => {
      const other = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      waits(1, 3);
      at(floors, 1).assignElevator(3, other);

      expect(elevInterface.takeRequest(1, 3)).toBe(true);
      expect(at(floors, 1).assignedElevator(3)).toBe(e);
    });

    it("rounds both floors, since a floor is a place and not a position", () => {
      // 1.4 rounds down and 2.6 rounds up, so rounding only one direction would be caught.
      waits(1, 3);
      waits(2, 3);
      waits(1, 2);

      expect(elevInterface.takeRequest(1.4, 2.6)).toBe(true);
      expect(at(floors, 1).assignedElevator(3)).toBe(e);
      expect(at(floors, 2).assignedElevator(3)).toBeNull();
      expect(at(floors, 1).assignedElevator(2)).toBeNull();
    });

    it("clamps a floor outside the building rather than booking nothing", () => {
      // `#toFloorNumber` clamps into the building, so no argument here can fail to name a floor.
      waits(3, 0);

      expect(elevInterface.takeRequest(9, -4)).toBe(true);
      expect(at(floors, 3).assignedElevator(0)).toBe(e);
    });

    it("books nothing when there are no floors to book on", () => {
      // World never builds a floor-less building; kept because the type checker can't know that.
      const noFloors = new ElevatorInterface(e, [], errorHandler);

      expect(noFloors.takeRequest(0, 1)).toBe(false);
    });

    it("refuses a floor that is not a number at all, and books nothing", () => {
      const loose = elevInterface as unknown as {
        takeRequest(from: unknown, to: unknown): boolean;
      };
      waits(1, 3);

      expect(() => loose.takeRequest("abc", 3)).toThrow(TypeError);
      expect(() => loose.takeRequest(1, Number.NaN)).toThrow(TypeError);
      expect(at(floors, 1).assignedElevator(3)).toBeNull();
    });

    it("names itself in the error, not the method that clamps for it", () => {
      const loose = elevInterface as unknown as {
        takeRequest(from: unknown, to: unknown): boolean;
      };

      expect(() => loose.takeRequest(1, undefined)).toThrow(/elevator\.takeRequest/);
    });
  });

  describe("goToFloor queueing", () => {
    it("queues destinations in order", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(3);
      expect(elevInterface.destinationQueue).toEqual([2, 3]);
    });

    it("drops a repeat of the last queued floor", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(2);
      expect(elevInterface.destinationQueue).toEqual([2]);
    });

    it("allows a floor that is not adjacent in the queue", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(3);
      elevInterface.goToFloor(2);
      expect(elevInterface.destinationQueue).toEqual([2, 3, 2]);
    });

    it("unshifts when forceNow is set", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(3);
      elevInterface.goToFloor(1, true);
      expect(elevInterface.destinationQueue).toEqual([1, 2, 3]);
    });

    it("compares against the front of the queue when forceNow is set", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(3);
      elevInterface.goToFloor(2, true);
      expect(elevInterface.destinationQueue).toEqual([2, 3]);
    });

    it("clamps floor numbers into the valid range", () => {
      elevInterface.goToFloor(-5);
      elevInterface.goToFloor(99);
      expect(elevInterface.destinationQueue).toEqual([0, FLOOR_COUNT - 1]);
    });

    it("coerces string floor numbers, as untyped player code may pass them", () => {
      (elevInterface as unknown as { goToFloor(n: string): void }).goToFloor("2");
      expect(elevInterface.destinationQueue).toEqual([2]);
    });

    it("starts the elevator moving toward the head of the queue", () => {
      elevInterface.goToFloor(3);
      expect(e.destinationY).toBe(e.getYPosOfFloor(3));
      expect(e.isMoving).toBe(true);
    });

    it("does not touch the elevator while it is busy waiting at a floor", () => {
      elevInterface.goToFloor(1);
      // The interface makes the elevator wait a second after arriving.
      stepUntil(e, () => e.isBusy());
      expect(e.isBusy()).toBe(true);
      elevInterface.goToFloor(3);
      expect(e.destinationY).toBe(e.getYPosOfFloor(1));
      expect(elevInterface.destinationQueue).toEqual([3]);
    });

    it("moves on to the next destination after the wait elapses", () => {
      elevInterface.goToFloor(1);
      elevInterface.goToFloor(3);
      stepElevator(e, 20.0, 0.015);
      expect(elevInterface.destinationQueue).toEqual([]);
      expect(e.currentFloor).toBe(3);
    });

    it("idles exactly one second after emptying the queue at a floor", () => {
      const stepSize = 0.015;
      let elapsed = 0.0;
      let arrivedAt = Number.NaN;
      let idleAt = Number.NaN;
      elevInterface.on("stopped_at_floor", () => {
        arrivedAt = elapsed;
      });
      elevInterface.on("idle", () => {
        idleAt = elapsed;
      });

      elevInterface.goToFloor(2);
      while (elapsed < 12.0 && Number.isNaN(idleAt)) {
        elapsed += stepSize;
        e.update(stepSize);
        e.updateElevatorMovement(stepSize);
      }

      expect(arrivedAt).not.toBeNaN();
      expect(idleAt - arrivedAt).toBeGreaterThan(1.0);
      expect(idleAt - arrivedAt).toBeLessThanOrEqual(1.0 + stepSize);
    });
  });

  describe("destinations that are not floor numbers", () => {
    const notFloorNumbers: readonly (readonly [call: string, value: unknown, named: string])[] = [
      ["goToFloor(NaN)", Number.NaN, "NaN"],
      ["goToFloor(undefined)", undefined, "undefined"],
      ['goToFloor("abc")', "abc", '"abc"'],
      ["goToFloor({})", {}, "an object"],
    ];

    /** Calls `goToFloor` the way untyped player code does: past the signature. */
    function looseGoToFloor(value: unknown, forceNow?: boolean): void {
      (
        elevInterface as unknown as { goToFloor(floorNum: unknown, forceNow?: boolean): void }
      ).goToFloor(value, forceNow);
    }

    /** The single value the error handler was given, as an `Error`. */
    function soleReport(): Error {
      expect(errorHandler).toHaveBeenCalledTimes(1);
      const reported: unknown = errorHandler.mock.calls[0]?.[0];
      expect(reported).toBeInstanceOf(TypeError);
      return reported as Error;
    }

    for (const [call, value, named] of notFloorNumbers) {
      it(`refuses ${call} instead of queueing a destination that cannot be reached`, () => {
        expect(() => {
          looseGoToFloor(value);
        }).toThrow(TypeError);
        expect(() => {
          looseGoToFloor(value, true);
        }).toThrow(TypeError);

        expect(elevInterface.destinationQueue).toEqual([]);
        expect(e.destinationY).toBe(e.getYPosOfFloor(0));
        expect(e.isMoving).toBe(false);
      });

      it(`reports ${call} from a handler to the error handler, naming both`, () => {
        // The route player code actually takes: a handler's exception reaches World's error path.
        elevInterface.on("idle", () => {
          looseGoToFloor(value);
        });

        elevInterface.checkDestinationQueue();

        expect(soleReport().message).toContain("elevator.goToFloor");
        expect(soleReport().message).toContain(named);
      });
    }

    it("refuses an infinite floor too, which used to clamp to an end of the range", () => {
      // Clamping alone maps Infinity to the top floor instead of throwing.
      expect(() => {
        elevInterface.goToFloor(Number.POSITIVE_INFINITY);
      }).toThrow(TypeError);
      expect(() => {
        elevInterface.goToFloor(Number.NEGATIVE_INFINITY);
      }).toThrow(TypeError);
      expect(elevInterface.destinationQueue).toEqual([]);
    });

    it("leaves the elevator usable after refusing one", () => {
      expect(() => {
        looseGoToFloor(Number.NaN);
      }).toThrow(TypeError);

      elevInterface.goToFloor(2);
      stepElevator(e, 20.0, 0.015);

      expect(e.currentFloor).toBe(2);
      expect(e.y).toBe(e.getYPosOfFloor(2));
      expect(elevInterface.destinationQueue).toEqual([]);
    });

    it("drops one a hand-assigned queue brought in, and keeps the rest", () => {
      // Direct assignment to destinationQueue never reaches goToFloor at all.
      elevInterface.destinationQueue = [Number.NaN, 2];

      elevInterface.checkDestinationQueue();

      expect(elevInterface.destinationQueue).toEqual([2]);
      expect(e.destinationY).toBe(e.getYPosOfFloor(2));
      expect(soleReport().message).toContain("elevator.destinationQueue");
      expect(soleReport().message).toContain("NaN");
    });

    it("never throws out of checkDestinationQueue, which the engine calls too", () => {
      // An exception here would take the simulation down, not just the player's code.
      const idle = vi.fn();
      elevInterface.on("idle", idle);
      elevInterface.destinationQueue = [Number.NaN];

      expect(() => {
        elevInterface.checkDestinationQueue();
      }).not.toThrow();

      expect(elevInterface.destinationQueue).toEqual([]);
      expect(idle).toHaveBeenCalledTimes(1);
      expect(e.isMoving).toBe(false);
      expect(e.y).toBe(e.getYPosOfFloor(0));
    });

    it("keeps the elevator usable after dropping one", () => {
      elevInterface.destinationQueue = [Number.NaN];
      elevInterface.checkDestinationQueue();

      elevInterface.goToFloor(2);
      stepElevator(e, 20.0, 0.015);

      expect(e.currentFloor).toBe(2);
      expect(e.y).toBe(e.getYPosOfFloor(2));
    });

    it("reports a dropped destination once per facade, not once per frame", () => {
      for (let frame = 0; frame < 60; frame++) {
        elevInterface.destinationQueue = [Number.NaN];
        elevInterface.checkDestinationQueue();
      }

      expect(errorHandler).toHaveBeenCalledTimes(1);

      // A new world builds new facades, so a restarted level is still told about the mistake.
      const restarted = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
      restarted.setFloorPosition(0);
      const restartedInterface = new ElevatorInterface(restarted, floors, errorHandler);
      restartedInterface.destinationQueue = [Number.NaN];
      restartedInterface.checkDestinationQueue();

      expect(errorHandler).toHaveBeenCalledTimes(2);
    });

    it("leaves a finite destination outside the building exactly where it was", () => {
      // Only what the simulation cannot compute is dropped; an out-of-building floor is still a valid position.
      elevInterface.destinationQueue = [99];

      elevInterface.checkDestinationQueue();

      expect(elevInterface.destinationQueue).toEqual([99]);
      expect(e.destinationY).toBe(e.getYPosOfFloor(99));
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("names an array as one rather than printing its contents", () => {
      // `String([1, 2])` is "1,2", reading like a pair of floor numbers rather than the mistake it is.
      expect(() => {
        looseGoToFloor([1, 2]);
      }).toThrow(
        new TypeError(
          "elevator.goToFloor was called with an array, which is not a floor number. " +
            "It takes a finite number, and this building has floors 0 to 3.",
        ),
      );
    });

    it("names an object as one, in the queue message as well", () => {
      // A different sentence from goToFloor's, so the test above wouldn't catch this one.
      elevInterface.destinationQueue = [{ floor: 2 } as unknown as number];
      elevInterface.checkDestinationQueue();

      expect(soleReport().message).toBe(
        "elevator.destinationQueue contained an object, which is not a floor number. " +
          "The entry was dropped so the elevator keeps running; destinationQueue takes " +
          "finite numbers, and this building has floors 0 to 3.",
      );
    });

    it("refuses in the language the page is in, composed phrase and all", () => {
      // The sentence and "an array" come from separate keys; translating only one leaves English behind.
      setLocale("ru");

      expect(() => {
        looseGoToFloor([1, 2]);
      }).toThrow(
        new TypeError(
          "elevator.goToFloor получил массив — это не номер этажа. " +
            "Нужно конечное число, а этажи в этом здании — от 0 до 3.",
        ),
      );

      // An array, not NaN: NaN doesn't inflect in Russian, so only a noun like «массив» can expose a mismatch.
      elevInterface.destinationQueue = [[1, 2] as unknown as number, 2];
      elevInterface.checkDestinationQueue();

      expect(soleReport().message).toBe(
        "elevator.destinationQueue содержит массив — это не номер этажа. Запись отброшена, " +
          "чтобы лифт продолжал работать; destinationQueue принимает конечные числа, " +
          "а этажи в этом здании — от 0 до 3.",
      );
    });
  });

  describe("stop", () => {
    it("empties the destination queue", () => {
      elevInterface.goToFloor(2);
      elevInterface.goToFloor(3);
      elevInterface.stop();
      expect(elevInterface.destinationQueue).toEqual([]);
    });

    it("retargets the elevator at the floor it can actually reach", () => {
      elevInterface.goToFloor(3);
      stepElevator(e, 0.3, 0.015);
      const futureFloor = e.getExactFutureFloorIfStopped();

      elevInterface.stop();

      expect(e.getDestinationFloor()).toBeCloseTo(futureFloor, 10);
    });

    it("emits idle once the elevator has coasted to a halt", () => {
      const idle = vi.fn();
      elevInterface.on("idle", idle);
      elevInterface.goToFloor(3);
      stepElevator(e, 0.3, 0.015);
      expect(e.isMoving).toBe(true);

      elevInterface.stop();
      stepElevator(e, 5.0, 0.015);

      expect(e.isMoving).toBe(false);
      expect(e.isOnAFloor()).toBe(false);
      expect(elevInterface.destinationQueue).toEqual([]);
      expect(idle).toHaveBeenCalledTimes(1);
    });

    it("waits the boarding second before idling when it halts on a floor", () => {
      const idle = vi.fn();
      elevInterface.on("idle", idle);

      elevInterface.stop();
      stepElevator(e, 0.5, 0.015);

      expect(e.isOnAFloor()).toBe(true);
      expect(e.isBusy()).toBe(true);
      expect(idle).not.toHaveBeenCalled();

      stepElevator(e, 0.6, 0.015);

      expect(idle).toHaveBeenCalledTimes(1);
    });

    it("leaves a busy elevator alone", () => {
      elevInterface.goToFloor(1);
      stepUntil(e, () => e.isBusy());
      expect(e.isBusy()).toBe(true);
      const destinationY = e.destinationY;

      elevInterface.stop();

      expect(e.destinationY).toBe(destinationY);
      expect(elevInterface.destinationQueue).toEqual([]);
    });
  });

  describe("checkDestinationQueue", () => {
    it("picks up a queue assigned directly by player code", () => {
      elevInterface.destinationQueue = [3];
      elevInterface.checkDestinationQueue();
      expect(e.destinationY).toBe(e.getYPosOfFloor(3));
    });

    it("does nothing while the elevator is busy", () => {
      const idle = vi.fn();
      elevInterface.on("idle", idle);
      e.wait(1.0);
      elevInterface.checkDestinationQueue();
      expect(idle).not.toHaveBeenCalled();
    });

    it("dwells and then idles when player code empties the queue mid-flight", () => {
      // The car still coasts to the floor it was sent to; that halt has no matching queue head.
      const idle = vi.fn();
      elevInterface.on("idle", idle);
      elevInterface.goToFloor(3);
      stepElevator(e, 0.3, 0.015);
      expect(e.isMoving).toBe(true);

      elevInterface.destinationQueue = [];
      stepUntil(e, () => !e.isMoving);

      expect(e.currentFloor).toBe(3);
      expect(e.isOnAFloor()).toBe(true);
      expect(e.isBusy()).toBe(true);
      expect(idle).not.toHaveBeenCalled();

      stepElevator(e, 1.1, 0.015);

      expect(idle).toHaveBeenCalledTimes(1);
    });
  });

  describe("boarding dwell", () => {
    it("holds the car for a second when boarding starts away from an arrival", () => {
      elevInterface.destinationQueue = [3];

      e.trigger("boarding_started", e);

      expect(e.isBusy()).toBe(true);
      stepElevator(e, 0.9, 0.015);
      expect(e.isMoving).toBe(false);
      expect(e.destinationY).toBe(e.getYPosOfFloor(0));

      // A delay, not a cancellation: the queue is taken as soon as it expires.
      stepElevator(e, 0.2, 0.015);
      expect(e.isMoving).toBe(true);
      expect(e.destinationY).toBe(e.getYPosOfFloor(3));
    });

    it("restarts a dwell already running instead of failing on the busy car", () => {
      // Boarding can begin mid-dwell; the passenger still gets a full second, rather than `wait` throwing.
      elevInterface.goToFloor(2);
      stepUntil(e, () => !e.isMoving);
      expect(e.isBusy()).toBe(true);
      stepElevator(e, 0.6, 0.015);

      expect(() => {
        e.trigger("boarding_started", e);
      }).not.toThrow();

      stepElevator(e, 0.9, 0.015);
      expect(e.isBusy()).toBe(true);
      stepElevator(e, 0.2, 0.015);
      expect(e.isBusy()).toBe(false);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe("idle re-entrancy", () => {
    it("emits idle once for the documented clear-and-recheck idiom", () => {
      // Without a guard this recurses until the stack overflows.
      const idle = vi.fn(() => {
        elevInterface.destinationQueue = [];
        elevInterface.checkDestinationQueue();
      });
      elevInterface.on("idle", idle);

      elevInterface.checkDestinationQueue();

      expect(idle).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("still starts a destination queued from inside the idle handler", () => {
      const idle = vi.fn(() => {
        elevInterface.destinationQueue = [];
        elevInterface.checkDestinationQueue();
        elevInterface.goToFloor(3);
      });
      elevInterface.on("idle", idle);

      elevInterface.checkDestinationQueue();

      expect(idle).toHaveBeenCalledTimes(1);
      expect(elevInterface.destinationQueue).toEqual([3]);
      expect(e.destinationY).toBe(e.getYPosOfFloor(3));
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("clears the guard so idle can fire again on a later check", () => {
      const idle = vi.fn(() => {
        elevInterface.checkDestinationQueue();
      });
      elevInterface.on("idle", idle);

      elevInterface.checkDestinationQueue();
      elevInterface.checkDestinationQueue();

      expect(idle).toHaveBeenCalledTimes(2);
    });

    it("clears the guard even when the idle handler throws", () => {
      const boom = new Error("boom");
      const idle = vi.fn(() => {
        throw boom;
      });
      elevInterface.on("idle", idle);

      elevInterface.checkDestinationQueue();
      elevInterface.checkDestinationQueue();

      expect(idle).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenNthCalledWith(1, boom);
      expect(errorHandler).toHaveBeenNthCalledWith(2, boom);
    });
  });

  describe("event re-entrancy", () => {
    it("refuses to re-enter a dispatch of the event already in flight", () => {
      const stoppedAtFloor = vi.fn(() => {
        e.trigger("stopped_at_floor", 1);
      });
      elevInterface.on("stopped_at_floor", stoppedAtFloor);

      e.trigger("stopped_at_floor", 1);

      expect(stoppedAtFloor).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("still nests a dispatch of a different event", () => {
      // The guard is per event name, not a blanket ban on dispatch inside a dispatch.
      const seen: string[] = [];
      elevInterface.on("stopped_at_floor", () => {
        seen.push("stopped_at_floor");
        e.trigger("floor_button_pressed", 2);
        seen.push("after");
      });
      elevInterface.on("floor_button_pressed", () => {
        seen.push("floor_button_pressed");
      });

      e.trigger("stopped_at_floor", 1);

      expect(seen).toEqual(["stopped_at_floor", "floor_button_pressed", "after"]);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("clears the marker when a handler throws", () => {
      const boom = new Error("boom");
      const stoppedAtFloor = vi.fn(() => {
        throw boom;
      });
      elevInterface.on("stopped_at_floor", stoppedAtFloor);

      e.trigger("stopped_at_floor", 1);
      e.trigger("stopped_at_floor", 1);

      expect(stoppedAtFloor).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenNthCalledWith(2, boom);
    });

    it("absorbs player code re-triggering the event it is handling", () => {
      let calls = 0;
      elevInterface.on("idle", () => {
        calls++;
        if (calls < 100000) {
          elevInterface.trigger("idle");
        }
      });

      expect(() => {
        elevInterface.trigger("idle");
      }).not.toThrow();

      expect(calls).toBe(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("absorbs it when the engine started the dispatch, not the player", () => {
      // The engine dispatches with triggerSafe, player code with trigger; both share the in-flight set.
      let calls = 0;
      elevInterface.on("idle", () => {
        calls++;
        if (calls < 100000) {
          elevInterface.trigger("idle");
        }
      });

      // How `idle` really arrives: checkDestinationQueue's empty-queue branch.
      expect(() => {
        elevInterface.checkDestinationQueue();
      }).not.toThrow();

      expect(calls).toBe(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("absorbs a player trigger of an engine event already in flight", () => {
      let calls = 0;
      elevInterface.on("stopped_at_floor", () => {
        calls++;
        if (calls < 100000) {
          elevInterface.trigger("stopped_at_floor", 1);
        }
      });

      expect(() => {
        e.trigger("stopped_at_floor", 1);
      }).not.toThrow();

      expect(calls).toBe(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("lets player code trigger a different event from a handler", () => {
      // The guard is per event name, so a hand-raised event still dispatches.
      const floorButtonPressed = vi.fn();
      elevInterface.on("floor_button_pressed", floorButtonPressed);
      elevInterface.on("idle", () => {
        elevInterface.trigger("floor_button_pressed", 2);
      });

      elevInterface.checkDestinationQueue();

      expect(floorButtonPressed).toHaveBeenCalledWith(2);
    });
  });
});
