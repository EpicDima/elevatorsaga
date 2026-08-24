import { beforeEach, describe, expect, it, vi } from "vitest";

import { Floor, type FloorElevator, type FloorErrorHandler } from "./floor.ts";

/**
 * An elevator stand-in.
 *
 * `serves` answers `true` to everything, which is what an unzoned car does and
 * what every spec below assumes; the specs that care build their own literal.
 */
function indicators(up: boolean, down: boolean): FloorElevator {
  return { goingUpIndicator: up, goingDownIndicator: down, serves: () => true };
}

/**
 * An elevator stand-in whose zone is exactly the floors named.
 *
 * Both indicators are dark, because a booking is answered by name: a
 * destination-dispatch floor never reads them, and a car that got picked up by
 * one of these specs on its indicators would be a bug these specs would miss.
 */
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
      // The floor is number 2, and this car's zone is the two below it. Both
      // indicators are lit, so without the service check every lamp here would
      // go out for a car nobody standing here may board -- and a passenger
      // whose lamp was cleared by a car that will not take them is a passenger
      // the building has stopped looking for.
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
      // The whole point of the mechanic: the program is told about the trip,
      // not about each traveler, and cannot book two cars for one journey.
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
      // A guard rather than a case: a refusal does not decrement the count, so
      // no engine path reaches this. The branch is here because the method is
      // public on the engine floor and cheaper to make total than to reason
      // about at every call site.
      dispatch.destinationRefused(7);

      expect(requested).not.toHaveBeenCalled();
    });

    it("holds a booking the program never honors, and says nothing more", () => {
      // The stall destination dispatch can still reach, and the reason a
      // program has to be able to read the book. A booking is cleared by
      // boarding or by refusal, and both need the booked car to open its doors
      // here. A program that books a car and then sends it elsewhere leaves a
      // booking nothing will clear; the floor is not told where the car went,
      // so it cannot tell this from a car that is simply on its way.
      dispatch.requestDestination(7);
      dispatch.assignElevator(7, servingOnly(2, 7));
      requested.mockClear();

      dispatch.requestDestination(7);

      expect(requested).not.toHaveBeenCalled();
      expect(dispatch.pendingDestinations()).toEqual(new Map([[7, 2]]));
    });

    it("takes a second car for a booking the first never honored", () => {
      // The way out, and it is the program's: the request is still in the book
      // for anyone who reads it, and booking another car both replaces the dead
      // booking and announces the replacement.
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
        // A handler reads the floor rather than a snapshot, so the floor has to
        // already read the new way by the time it is handed one -- and it has
        // to be handed one before the request that moved the book is passed on,
        // or a panel redrawn from inside a `destination_requested` handler
        // draws a book one passenger behind.
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
        // The reason this event exists. `destination_requested` is deliberately
        // silent about the second person bound for a floor a car is already
        // coming for, so a panel counting from it would be one short until the
        // car arrived and would never learn otherwise.
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
        // Announced first, the panel would redraw with the journey still
        // reading unanswered and would only catch up on the next thing to move
        // the book.
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
        // Both, because a chip that says how many people are waiting is wrong
        // the moment one of them steps into a car.
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
        // A full car turns a passenger away and the panel redraws. Announced
        // before the booking is dropped, the chip would redraw still marked
        // answered, and since the program does not rebook it nothing would move
        // the book again -- so it would read that way for the rest of the run.
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
      // Issue #88 (also #83, #27): the legacy tryTrigger wrapped the whole
      // dispatch in one try/catch, so the first handler to throw silently
      // killed every handler registered after it.
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
