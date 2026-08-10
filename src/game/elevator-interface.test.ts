import { beforeEach, describe, expect, it, vi } from "vitest";

import { Elevator } from "./elevator.ts";
import { ElevatorInterface, type ElevatorInterfaceErrorHandler } from "./elevator-interface.ts";
import { timeForwarder } from "./test-helpers.ts";

const FLOOR_COUNT = 4;
const FLOOR_HEIGHT = 40;

/** Runs the elevator forward the way the world does: task first, then physics. */
function stepElevator(e: Elevator, dt: number, stepSize: number): void {
  timeForwarder(dt, stepSize, (step) => {
    e.update(step);
    e.updateElevatorMovement(step);
  });
}

/**
 * Steps the elevator until `predicate` holds, giving up after `maxTime`.
 *
 * Used to land exactly inside the one-second wait the interface starts when the
 * elevator reaches a queued floor.
 */
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
  let elevInterface: ElevatorInterface;
  let errorHandler: ReturnType<typeof vi.fn<ElevatorInterfaceErrorHandler>>;

  beforeEach(() => {
    e = new Elevator(1.5, FLOOR_COUNT, FLOOR_HEIGHT);
    e.setFloorPosition(0);
    errorHandler = vi.fn<ElevatorInterfaceErrorHandler>();
    elevInterface = new ElevatorInterface(e, FLOOR_COUNT, errorHandler);
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
      // Kept from the legacy suite, where this spec shared the name of the one
      // below; it actually covers the "stopped" case.
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

  it("normalizes load factor", () => {
    for (let i = 0; i < 20; i++) {
      e.userEntering({ weight: 55 + i });
    }
    const load = elevInterface.loadFactor();
    expect(load).toBeGreaterThanOrEqual(0);
    expect(load).toBeLessThanOrEqual(1);
  });

  it("doesnt raise unexpected events when told to stop when passing floor", () => {
    e.setFloorPosition(2);
    elevInterface.goToFloor(0);
    let passingFloorEventCount = 0;
    elevInterface.on("passing_floor", (floorNum) => {
      passingFloorEventCount++;
      // We only expect to be passing floor 1, but it is possible and ok that several
      // such events are raised, due to possible overshoot.
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
  });

  describe("idle re-entrancy", () => {
    it("emits idle once for the documented clear-and-recheck idiom", () => {
      // documentation.html tells players to write exactly this inside an idle
      // handler. Without a re-entrancy guard it recurses until the stack
      // overflows, and the RangeError ends up in the error handler.
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
});
