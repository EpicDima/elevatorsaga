import { beforeEach, describe, expect, it, vi } from "vitest";

import { Floor, type FloorElevator, type FloorErrorHandler } from "./floor.ts";

/** An elevator stand-in whose `serves` answers `true` to everything, matching an unzoned car. */
function indicators(up: boolean, down: boolean): FloorElevator {
  return { goingUpIndicator: up, goingDownIndicator: down, serves: () => true };
}

/** An elevator stand-in whose zone is exactly the floors named; both indicators are dark. */
function servingOnly(...floors: number[]): FloorElevator {
  return {
    goingUpIndicator: false,
    goingDownIndicator: false,
    serves: (floorNum) => floors.includes(floorNum),
  };
}

describe("Floor", () => {
  let errorHandler: ReturnType<typeof vi.fn<FloorErrorHandler>>;
  let floor: Floor;

  beforeEach(() => {
    errorHandler = vi.fn<FloorErrorHandler>();
    floor = new Floor(2, 100, errorHandler);
  });

  it("reports its floor number and spawn position", () => {
    expect(floor.floorNum()).toBe(2);
    expect(floor.level).toBe(2);
    expect(floor.yPosition).toBe(100);
    expect(floor.getSpawnPosY()).toBe(130);
  });

  it("starts with both buttons unlit", () => {
    expect(floor.buttonStates).toEqual({ up: "", down: "" });
  });

  describe("pressUpButton", () => {
    it("lights the up button and emits both events", () => {
      const buttonStateChange = vi.fn();
      const upPressed = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);
      floor.on("up_button_pressed", upPressed);

      floor.pressUpButton();

      expect(floor.buttonStates).toEqual({ up: "activated", down: "" });
      expect(buttonStateChange).toHaveBeenCalledTimes(1);
      expect(buttonStateChange).toHaveBeenCalledWith({ up: "activated", down: "" });
      expect(upPressed).toHaveBeenCalledTimes(1);
      expect(upPressed).toHaveBeenCalledWith(floor);
    });

    it("emits nothing when already lit", () => {
      floor.pressUpButton();
      const buttonStateChange = vi.fn();
      const upPressed = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);
      floor.on("up_button_pressed", upPressed);

      floor.pressUpButton();

      expect(buttonStateChange).not.toHaveBeenCalled();
      expect(upPressed).not.toHaveBeenCalled();
    });

    it("does not touch the down button", () => {
      const downPressed = vi.fn();
      floor.on("down_button_pressed", downPressed);
      floor.pressUpButton();
      expect(floor.buttonStates.down).toBe("");
      expect(downPressed).not.toHaveBeenCalled();
    });
  });

  describe("pressDownButton", () => {
    it("lights the down button and emits both events", () => {
      const buttonStateChange = vi.fn();
      const downPressed = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);
      floor.on("down_button_pressed", downPressed);

      floor.pressDownButton();

      expect(floor.buttonStates).toEqual({ up: "", down: "activated" });
      expect(buttonStateChange).toHaveBeenCalledTimes(1);
      expect(downPressed).toHaveBeenCalledTimes(1);
      expect(downPressed).toHaveBeenCalledWith(floor);
    });

    it("emits nothing when already lit", () => {
      floor.pressDownButton();
      const downPressed = vi.fn();
      floor.on("down_button_pressed", downPressed);
      floor.pressDownButton();
      expect(downPressed).not.toHaveBeenCalled();
    });
  });

  describe("elevatorAvailable", () => {
    it("clears only the buttons the elevator advertises", () => {
      floor.pressUpButton();
      floor.pressDownButton();

      floor.elevatorAvailable(indicators(true, false));

      expect(floor.buttonStates).toEqual({ up: "", down: "activated" });
    });

    it("clears both buttons when both indicators are lit", () => {
      floor.pressUpButton();
      floor.pressDownButton();

      floor.elevatorAvailable(indicators(true, true));

      expect(floor.buttonStates).toEqual({ up: "", down: "" });
    });

    it("emits one buttonstate_change per cleared button", () => {
      floor.pressUpButton();
      floor.pressDownButton();
      const buttonStateChange = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);

      floor.elevatorAvailable(indicators(true, true));

      expect(buttonStateChange).toHaveBeenCalledTimes(2);
    });

    it("emits nothing when no button was lit", () => {
      const buttonStateChange = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);
      floor.elevatorAvailable(indicators(true, true));
      expect(buttonStateChange).not.toHaveBeenCalled();
    });

    it("emits nothing when the elevator serves neither direction", () => {
      floor.pressUpButton();
      floor.pressDownButton();
      const buttonStateChange = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);

      floor.elevatorAvailable(indicators(false, false));

      expect(buttonStateChange).not.toHaveBeenCalled();
      expect(floor.buttonStates).toEqual({ up: "activated", down: "activated" });
    });

    it("clears nothing when the elevator does not serve this floor", () => {
      // Both indicators are lit, but the elevator's zone excludes this floor.
      floor.pressUpButton();
      floor.pressDownButton();
      const buttonStateChange = vi.fn();
      floor.on("buttonstate_change", buttonStateChange);

      floor.elevatorAvailable({
        goingUpIndicator: true,
        goingDownIndicator: true,
        serves: (floorNum) => floorNum < 2,
      });

      expect(buttonStateChange).not.toHaveBeenCalled();
      expect(floor.buttonStates).toEqual({ up: "activated", down: "activated" });
    });

    it("clears as usual when the elevator does serve this floor", () => {
      floor.pressUpButton();
      floor.pressDownButton();

      floor.elevatorAvailable({
        goingUpIndicator: true,
        goingDownIndicator: true,
        serves: (floorNum) => floorNum >= 2,
      });

      expect(floor.buttonStates).toEqual({ up: "", down: "" });
    });
  });

  describe("the destination request book", () => {
    let dispatch: Floor;
    let requested: ReturnType<typeof vi.fn<(floor: Floor, destinationFloor: number) => void>>;
    let booked: ReturnType<
      typeof vi.fn<(floor: Floor, destinationFloor: number, elevator: FloorElevator) => void>
    >;

    beforeEach(() => {
      dispatch = new Floor(2, 100, errorHandler, true);
      requested = vi.fn();
      booked = vi.fn();
      dispatch.on("destination_requested", requested);
      dispatch.on("elevator_assigned", booked);
    });

    it("is off unless a building asks for it", () => {
      expect(floor.destinationDispatch).toBe(false);
      expect(dispatch.destinationDispatch).toBe(true);
    });

    it("starts with nobody waiting for anything", () => {
      expect(dispatch.pendingDestinations()).toEqual(new Map());
      expect(dispatch.assignedElevator(7)).toBeNull();
    });

    it("announces a request and counts the person who made it", () => {
      dispatch.requestDestination(7);

      expect(requested).toHaveBeenCalledTimes(1);
      expect(requested).toHaveBeenCalledWith(dispatch, 7);
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 1]]));
    });

    it("announces each destination separately", () => {
      dispatch.requestDestination(7);
      dispatch.requestDestination(3);

      expect(requested).toHaveBeenCalledTimes(2);
      expect(dispatch.pendingDestinations()).toEqual(
        new Map([
          [7, 1],
          [3, 1],
        ]),
      );
    });

    it("asks again for a destination no car is coming for yet", () => {
      dispatch.requestDestination(7);
      dispatch.requestDestination(7);

      expect(requested).toHaveBeenCalledTimes(2);
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 2]]));
    });

    it("groups a second passenger onto a car that is already coming", () => {
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      requested.mockClear();

      dispatch.requestDestination(7);

      expect(requested).not.toHaveBeenCalled();
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 2]]));
    });

    it("books a car that can carry the trip", () => {
      const elevator = servingOnly(2, 7);
      dispatch.requestDestination(7);

      expect(dispatch.assignElevator(7, elevator)).toBe(true);

      expect(dispatch.assignedElevator(7)).toBe(elevator);
      expect(booked).toHaveBeenCalledTimes(1);
      expect(booked).toHaveBeenCalledWith(dispatch, 7, elevator);
    });

    it("refuses a car that does not serve this floor", () => {
      dispatch.requestDestination(7);

      expect(dispatch.assignElevator(7, servingOnly(7))).toBe(false);

      expect(dispatch.assignedElevator(7)).toBeNull();
      expect(booked).not.toHaveBeenCalled();
    });

    it("refuses a car that does not serve the destination", () => {
      dispatch.requestDestination(7);

      expect(dispatch.assignElevator(7, servingOnly(2))).toBe(false);

      expect(dispatch.assignedElevator(7)).toBeNull();
    });

    it("refuses a booking nobody is waiting on", () => {
      expect(dispatch.assignElevator(7, servingOnly(2, 7))).toBe(false);

      expect(dispatch.assignedElevator(7)).toBeNull();
      expect(booked).not.toHaveBeenCalled();
    });

    it("says nothing when the same car is booked again", () => {
      const elevator = servingOnly(2, 7);
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, elevator);
      booked.mockClear();

      expect(dispatch.assignElevator(7, elevator)).toBe(true);

      expect(booked).not.toHaveBeenCalled();
    });

    it("announces a booking that changes cars", () => {
      const second = servingOnly(2, 7);
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      booked.mockClear();

      dispatch.assignElevator(7, second);

      expect(dispatch.assignedElevator(7)).toBe(second);
      expect(booked).toHaveBeenCalledTimes(1);
    });

    it("keeps the booking while somebody is still waiting on it", () => {
      const elevator = servingOnly(2, 7);
      dispatch.requestDestination(7);
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, elevator);

      dispatch.destinationBoarded(7);

      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 1]]));
      expect(dispatch.assignedElevator(7)).toBe(elevator);
    });

    it("withdraws the booking with the last person waiting on it", () => {
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));

      dispatch.destinationBoarded(7);

      expect(dispatch.pendingDestinations()).toEqual(new Map());
      expect(dispatch.assignedElevator(7)).toBeNull();
    });

    it("lets the next passenger ask for a car of their own", () => {
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      dispatch.destinationBoarded(7);
      requested.mockClear();

      dispatch.requestDestination(7);

      expect(requested).toHaveBeenCalledTimes(1);
    });

    it("shrugs at a boarding for a destination nobody asked about", () => {
      dispatch.destinationBoarded(7);

      expect(dispatch.pendingDestinations()).toEqual(new Map());
    });

    it("withdraws a refused car and asks for another", () => {
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      requested.mockClear();

      dispatch.destinationRefused(7);

      expect(dispatch.assignedElevator(7)).toBeNull();
      expect(requested).toHaveBeenCalledTimes(1);
      expect(requested).toHaveBeenCalledWith(dispatch, 7);
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 1]]));
    });

    it("says nothing when the refusal leaves nobody waiting", () => {
      // No engine path reaches this; kept because the public method must stay total.
      dispatch.destinationRefused(7);

      expect(requested).not.toHaveBeenCalled();
    });

    it("holds a booking the program never honors, and says nothing more", () => {
      // A car sent elsewhere leaves a booking nothing clears -- indistinguishable from one still on its way.
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      requested.mockClear();

      dispatch.requestDestination(7);

      expect(requested).not.toHaveBeenCalled();
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 2]]));
    });

    it("takes a second car for a booking the first never honored", () => {
      const rescue = servingOnly(2, 7);
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      booked.mockClear();

      expect(dispatch.assignElevator(7, rescue)).toBe(true);

      expect(dispatch.assignedElevator(7)).toBe(rescue);
      expect(booked).toHaveBeenCalledWith(dispatch, 7, rescue);
    });

    it("routes exceptions thrown by destination_requested handlers", () => {
      const boom = new Error("boom");
      dispatch.on("destination_requested", () => {
        throw boom;
      });

      dispatch.requestDestination(7);

      expect(errorHandler).toHaveBeenCalledWith(boom);
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 1]]));
    });

    it("routes exceptions thrown by elevator_assigned handlers", () => {
      const boom = new Error("boom");
      const elevator = servingOnly(2, 7);
      dispatch.on("elevator_assigned", () => {
        throw boom;
      });
      dispatch.requestDestination(7);

      expect(dispatch.assignElevator(7, elevator)).toBe(true);

      expect(errorHandler).toHaveBeenCalledWith(boom);
      expect(dispatch.assignedElevator(7)).toBe(elevator);
    });

    describe("destinations_change", () => {
      let changed: ReturnType<typeof vi.fn<(floor: Floor) => void>>;

      beforeEach(() => {
        changed = vi.fn();
        dispatch.on("destinations_change", changed);
      });

      it("names the floor whose book moved", () => {
        dispatch.requestDestination(7);

        expect(changed).toHaveBeenCalledTimes(1);
        expect(changed).toHaveBeenCalledWith(dispatch);
      });

      it("announces the book before anyone is told what happened to it", () => {
        // A handler reads live state, so the book must already reflect the
        // change before the event that caused it is announced.
        const order: string[] = [];
        const seen: (readonly [number, number])[][] = [];
        changed.mockImplementation((floor) => {
          order.push("destinations_change");
          seen.push([...floor.pendingDestinations()]);
        });
        requested.mockImplementation(() => {
          order.push("destination_requested");
        });

        dispatch.requestDestination(7);
        dispatch.requestDestination(7);

        expect(seen).toEqual([[[7, 1]], [[7, 2]]]);
        expect(order).toEqual([
          "destinations_change",
          "destination_requested",
          "destinations_change",
          "destination_requested",
        ]);
      });

      it("announces the traveler the request event keeps quiet about", () => {
        // `destination_requested` stays silent about a passenger joining a booked trip.
        dispatch.requestDestination(7);
        dispatch.assignElevator(7, servingOnly(2, 7));
        changed.mockClear();
        requested.mockClear();

        dispatch.requestDestination(7);

        expect(requested).not.toHaveBeenCalled();
        expect(changed).toHaveBeenCalledTimes(1);
      });

      it("announces a booking, and only when it is a new one", () => {
        const elevator = servingOnly(2, 7);
        dispatch.requestDestination(7);
        changed.mockClear();

        dispatch.assignElevator(7, elevator);
        expect(changed).toHaveBeenCalledTimes(1);

        dispatch.assignElevator(7, elevator);
        expect(changed).toHaveBeenCalledTimes(1);
      });

      it("has already written the booking down by the time it announces it", () => {
        // Booking is written before the event fires, so a handler reading the floor sees it already answered.
        const elevator = servingOnly(2, 7);
        const seen: (FloorElevator | null)[] = [];
        dispatch.requestDestination(7);
        changed.mockClear();
        changed.mockImplementation((floor) => {
          seen.push(floor.assignedElevator(7));
        });

        dispatch.assignElevator(7, elevator);

        expect(seen).toEqual([elevator]);
      });

      it("says nothing about a booking the floor turned down", () => {
        dispatch.requestDestination(7);
        changed.mockClear();

        expect(dispatch.assignElevator(7, servingOnly(7))).toBe(false);

        expect(changed).not.toHaveBeenCalled();
      });

      it("announces every boarding, not only the one that empties the book", () => {
        dispatch.requestDestination(7);
        dispatch.requestDestination(7);
        dispatch.assignElevator(7, servingOnly(2, 7));
        changed.mockClear();

        dispatch.destinationBoarded(7);
        expect(changed).toHaveBeenCalledTimes(1);

        dispatch.destinationBoarded(7);
        expect(changed).toHaveBeenCalledTimes(2);
        expect(dispatch.pendingDestinations()).toEqual(new Map());
      });

      it("announces a withdrawn booking", () => {
        dispatch.requestDestination(7);
        dispatch.assignElevator(7, servingOnly(2, 7));
        changed.mockClear();

        dispatch.destinationRefused(7);

        expect(changed).toHaveBeenCalledTimes(1);
      });

      it("has already withdrawn the booking by the time it announces it", () => {
        // Booking is cleared before the event fires, so a handler reading the floor sees it already withdrawn.
        const seen: (FloorElevator | null)[] = [];
        dispatch.requestDestination(7);
        dispatch.assignElevator(7, servingOnly(2, 7));
        changed.mockClear();
        changed.mockImplementation((floor) => {
          seen.push(floor.assignedElevator(7));
        });

        dispatch.destinationRefused(7);

        expect(seen).toEqual([null]);
      });

      it("routes exceptions thrown by its handlers", () => {
        const boom = new Error("boom");
        dispatch.on("destinations_change", () => {
          throw boom;
        });

        dispatch.requestDestination(7);

        expect(errorHandler).toHaveBeenCalledWith(boom);
        expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 1]]));
      });
    });
  });

  describe("error routing", () => {
    it("routes exceptions thrown by up_button_pressed handlers to the error handler", () => {
      const boom = new Error("boom");
      floor.on("up_button_pressed", () => {
        throw boom;
      });

      expect(() => {
        floor.pressUpButton();
      }).not.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("routes exceptions thrown by down_button_pressed handlers", () => {
      const boom = new Error("boom");
      floor.on("down_button_pressed", () => {
        throw boom;
      });

      floor.pressDownButton();

      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("routes exceptions thrown by buttonstate_change handlers", () => {
      const boom = new Error("boom");
      floor.on("buttonstate_change", () => {
        throw boom;
      });

      floor.pressUpButton();

      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("keeps emitting the remaining events after a handler throws", () => {
      const upPressed = vi.fn();
      floor.on("buttonstate_change", () => {
        throw new Error("boom");
      });
      floor.on("up_button_pressed", upPressed);

      floor.pressUpButton();

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(upPressed).toHaveBeenCalledTimes(1);
    });

    it("keeps running the remaining handlers of an event after one throws", () => {
      const boom = new Error("boom");
      const second = vi.fn();
      const third = vi.fn();
      floor.on("up_button_pressed", () => {
        throw boom;
      });
      floor.on("up_button_pressed", second);
      floor.on("up_button_pressed", third);

      floor.pressUpButton();

      expect(second).toHaveBeenCalledTimes(1);
      expect(third).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(boom);
    });

    it("runs a handler that threw again on the next dispatch", () => {
      const throwing = vi.fn(() => {
        throw new Error("boom");
      });
      floor.on("up_button_pressed", throwing);

      floor.pressUpButton();
      floor.elevatorAvailable(indicators(true, true));
      floor.pressUpButton();

      expect(throwing).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenCalledTimes(2);
    });

    it("routes exceptions thrown while clearing buttons", () => {
      floor.pressUpButton();
      const boom = new Error("boom");
      floor.on("buttonstate_change", () => {
        throw boom;
      });

      floor.elevatorAvailable(indicators(true, true));

      expect(errorHandler).toHaveBeenCalledWith(boom);
      expect(floor.buttonStates.up).toBe("");
    });
  });
});
