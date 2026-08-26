import { beforeEach, describe, expect, it, vi } from "vitest";

import { Floor, type FloorErrorHandler } from "./floor.ts";
import { FloorInterface } from "./floor-interface.ts";

describe("FloorInterface", () => {
  let errorHandler: ReturnType<typeof vi.fn<FloorErrorHandler>>;
  let floor: Floor;
  let floorInterface: FloorInterface;

  beforeEach(() => {
    errorHandler = vi.fn<FloorErrorHandler>();
    floor = new Floor(2, 100, errorHandler);
    floorInterface = new FloorInterface(floor, errorHandler);
  });

  it("reports the floor number the documented way", () => {
    expect(floorInterface.floorNum()).toBe(2);
    expect(floorInterface.level).toBe(2);
  });

  it("exposes exactly the documented surface and nothing else", () => {
    // The emitter is held rather than inherited from, so its dispatch side
    // is not reachable either.
    const exposed = new Set<string>();
    for (
      let proto: object | null = floorInterface;
      proto !== null && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto) as object | null
    ) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        exposed.add(key);
      }
    }
    exposed.delete("constructor");

    expect([...exposed].sort()).toEqual([
      "buttonStates",
      "floorNum",
      "level",
      "off",
      "offAll",
      "on",
      "once",
      "one",
      "pendingDestinations",
    ]);
    for (const forbidden of [
      "yPosition",
      "getSpawnPosY",
      "elevatorAvailable",
      "pressUpButton",
      "pressDownButton",
      "trigger",
      "triggerSafe",
    ]) {
      expect(exposed.has(forbidden)).toBe(false);
    }
    expect(floorInterface).not.toBe(floor);
  });

  describe("buttonStates", () => {
    it("reflects the floor's call buttons", () => {
      expect(floorInterface.buttonStates).toEqual({ up: "", down: "" });
      floor.pressUpButton();
      expect(floorInterface.buttonStates).toEqual({ up: "activated", down: "" });
      floor.pressDownButton();
      expect(floorInterface.buttonStates).toEqual({ up: "activated", down: "activated" });
    });

    it("is a snapshot, so player code cannot corrupt the floor", () => {
      floor.pressUpButton();
      const states = floorInterface.buttonStates as { up: string; down: string };
      states.up = "";
      states.down = "activated";
      expect(floor.buttonStates).toEqual({ up: "activated", down: "" });
      expect(floorInterface.buttonStates).toEqual({ up: "activated", down: "" });
    });
  });

  describe("pendingDestinations", () => {
    let dispatchFloor: Floor;
    let dispatchInterface: FloorInterface;

    beforeEach(() => {
      dispatchFloor = new Floor(2, 100, errorHandler, true);
      dispatchInterface = new FloorInterface(dispatchFloor, errorHandler);
    });

    it("is empty while nobody here has asked for anything", () => {
      expect(dispatchInterface.pendingDestinations()).toEqual([]);
    });

    it("is empty in a building whose passengers press call buttons", () => {
      floor.pressUpButton();
      floor.pressDownButton();

      expect(floorInterface.pendingDestinations()).toEqual([]);
    });

    it("counts the people waiting for each destination, lowest floor first", () => {
      dispatchFloor.requestDestination(5);
      dispatchFloor.requestDestination(1);
      dispatchFloor.requestDestination(5);

      expect(dispatchInterface.pendingDestinations()).toEqual([
        { floorNum: 1, waiting: 1 },
        { floorNum: 5, waiting: 2 },
      ]);
    });

    it("keeps a request a car was booked for and never sent to fetch", () => {
      // A booked journey is never re-announced by the event; this is where a program finds it again.
      dispatchFloor.requestDestination(5);
      dispatchFloor.assignElevator(5, {
        goingUpIndicator: false,
        goingDownIndicator: false,
        serves: () => true,
      });

      expect(dispatchInterface.pendingDestinations()).toEqual([{ floorNum: 5, waiting: 1 }]);
    });

    it("drops a destination once the last person waiting for it boards", () => {
      dispatchFloor.requestDestination(5);
      dispatchFloor.requestDestination(5);

      dispatchFloor.destinationBoarded(5);
      expect(dispatchInterface.pendingDestinations()).toEqual([{ floorNum: 5, waiting: 1 }]);

      dispatchFloor.destinationBoarded(5);
      expect(dispatchInterface.pendingDestinations()).toEqual([]);
    });

    it("is a fresh array of fresh entries, so player code cannot corrupt the floor", () => {
      // Same reason `buttonStates` is a snapshot: emptying it would empty the engine's own live map.
      dispatchFloor.requestDestination(5);
      const first = dispatchInterface.pendingDestinations();
      first.length = 0;

      expect(dispatchInterface.pendingDestinations()).toEqual([{ floorNum: 5, waiting: 1 }]);
      expect(dispatchInterface.pendingDestinations()).not.toBe(first);
    });
  });

  describe("events", () => {
    it("forwards up_button_pressed with itself, never the real floor", () => {
      const upPressed = vi.fn();
      floorInterface.on("up_button_pressed", upPressed);

      floor.pressUpButton();

      expect(upPressed).toHaveBeenCalledTimes(1);
      expect(upPressed).toHaveBeenCalledWith(floorInterface);
      expect(upPressed).not.toHaveBeenCalledWith(floor);
    });

    it("forwards down_button_pressed with itself", () => {
      const downPressed = vi.fn();
      floorInterface.on("down_button_pressed", downPressed);

      floor.pressDownButton();

      expect(downPressed).toHaveBeenCalledWith(floorInterface);
    });

    it("forwards buttonstate_change with a snapshot, not the live object", () => {
      const seen: unknown[] = [];
      floorInterface.on("buttonstate_change", (states) => {
        seen.push(states);
      });

      floor.pressUpButton();

      expect(seen).toEqual([{ up: "activated", down: "" }]);
      expect(seen[0]).not.toBe(floor.buttonStates);
    });

    it("calls handlers with the facade as `this`", () => {
      const seen: unknown[] = [];
      floorInterface.on("up_button_pressed", function (this: unknown): void {
        seen.push(this);
      });

      floor.pressUpButton();

      expect(seen).toHaveLength(1);
      expect(seen[0]).toBe(floorInterface);
      expect(seen[0]).not.toBe(floor);
    });

    it("supports the documented space separated registration", () => {
      const pressed = vi.fn();
      floorInterface.on("down_button_pressed up_button_pressed", pressed);

      floor.pressUpButton();
      floor.pressDownButton();

      expect(pressed).toHaveBeenCalledTimes(2);
      // A multi-event registration gets the name of whichever event fired, prepended.
      expect(pressed).toHaveBeenNthCalledWith(1, "up_button_pressed", floorInterface);
      expect(pressed).toHaveBeenNthCalledWith(2, "down_button_pressed", floorInterface);
    });

    it("supports off and once", () => {
      const once = vi.fn();
      const removed = vi.fn();
      floorInterface.once("up_button_pressed", once);
      floorInterface.on("up_button_pressed", removed);
      floorInterface.off("up_button_pressed", removed);

      floor.pressUpButton();
      floor.elevatorAvailable({
        goingUpIndicator: true,
        goingDownIndicator: true,
        serves: () => true,
      });
      floor.pressUpButton();

      expect(once).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    });

    it("routes player handler exceptions to the error handler, one handler at a time", () => {
      const boom = new Error("boom");
      const second = vi.fn();
      floorInterface.on("up_button_pressed", () => {
        throw boom;
      });
      floorInterface.on("up_button_pressed", second);

      expect(() => {
        floor.pressUpButton();
      }).not.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(boom);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("refuses to re-enter a dispatch of the event already in flight", () => {
      const upPressed = vi.fn(() => {
        floor.trigger("up_button_pressed", floor);
      });
      floorInterface.on("up_button_pressed", upPressed);

      floor.pressUpButton();

      expect(upPressed).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("stops forwarding once the floor's subscriptions are dropped", () => {
      const upPressed = vi.fn();
      floorInterface.on("up_button_pressed", upPressed);

      floor.offAll();
      floor.pressUpButton();

      expect(upPressed).not.toHaveBeenCalled();
    });

    it("drops every handler of a named event on request", () => {
      const upPressed = vi.fn();
      floorInterface.on("up_button_pressed", upPressed);

      floorInterface.off("up_button_pressed");
      floor.pressUpButton();

      expect(upPressed).not.toHaveBeenCalled();
    });

    it("drops every player handler on offAll, and forwards again afterwards", () => {
      const dropped = vi.fn();
      floorInterface.on("up_button_pressed", dropped);
      floorInterface.on("buttonstate_change", dropped);

      expect(floorInterface.offAll()).toBe(floorInterface);
      floor.pressUpButton();

      expect(dropped).not.toHaveBeenCalled();

      // Forwarding is registered on the floor, not the facade's emitter, so it survives offAll.
      const later = vi.fn();
      floorInterface.on("down_button_pressed", later);
      floor.pressDownButton();

      expect(later).toHaveBeenCalledTimes(1);
      expect(later).toHaveBeenCalledWith(floorInterface);
    });

    it("supports the legacy one() spelling of once()", () => {
      const handler = vi.fn();

      expect(floorInterface.one("up_button_pressed", handler)).toBe(floorInterface);
      floor.pressUpButton();
      floor.elevatorAvailable({
        goingUpIndicator: true,
        goingDownIndicator: true,
        serves: () => true,
      });
      floor.pressUpButton();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(floorInterface);
    });

    it('drops every player handler on off("*") too', () => {
      // Must not be a silent no-op — this is the spelling published solutions actually use.
      const dropped = vi.fn();
      floorInterface.on("up_button_pressed", dropped);
      floorInterface.on("buttonstate_change", dropped);

      expect(floorInterface.off("*")).toBe(floorInterface);
      floor.pressUpButton();

      expect(dropped).not.toHaveBeenCalled();
    });

    describe("hall_button_pressed", () => {
      it("forwards either call button, with the direction and itself", () => {
        const hallPressed = vi.fn();
        floorInterface.on("hall_button_pressed", hallPressed);

        floor.pressUpButton();
        floor.pressDownButton();

        expect(hallPressed).toHaveBeenCalledTimes(2);
        expect(hallPressed).toHaveBeenNthCalledWith(1, "up", floorInterface);
        expect(hallPressed).toHaveBeenNthCalledWith(2, "down", floorInterface);
        expect(hallPressed).not.toHaveBeenCalledWith("up", floor);
      });

      it("follows the button's own event, whichever order they were registered in", () => {
        // The order is the forwarder's, not the player's: both fire from one
        // subscription on the real floor, specific first.
        const calls: string[] = [];
        floorInterface.on("hall_button_pressed", (direction) => {
          calls.push(`hall:${direction}`);
        });
        floorInterface.on("up_button_pressed", () => {
          calls.push("up");
        });
        floorInterface.on("down_button_pressed", () => {
          calls.push("down");
        });
        floorInterface.on("buttonstate_change", () => {
          calls.push("buttons");
        });

        floor.pressUpButton();
        floor.pressDownButton();

        expect(calls).toEqual(["buttons", "up", "hall:up", "buttons", "down", "hall:down"]);
      });

      it("is raised for a press, not for a button going out", () => {
        const hallPressed = vi.fn();
        floor.pressUpButton();
        floorInterface.on("hall_button_pressed", hallPressed);

        floor.elevatorAvailable({
          goingUpIndicator: true,
          goingDownIndicator: true,
          serves: () => true,
        });

        expect(floorInterface.buttonStates).toEqual({ up: "", down: "" });
        expect(hallPressed).not.toHaveBeenCalled();
      });

      it("still runs when a handler of the button's own event throws", () => {
        // Separate dispatches, each isolating its handlers, so one throwing doesn't lose the other.
        const boom = new Error("boom");
        const hallPressed = vi.fn();
        floorInterface.on("up_button_pressed", () => {
          throw boom;
        });
        floorInterface.on("hall_button_pressed", hallPressed);

        expect(() => {
          floor.pressUpButton();
        }).not.toThrow();

        expect(errorHandler).toHaveBeenCalledWith(boom);
        expect(hallPressed).toHaveBeenCalledWith("up", floorInterface);
      });

      it("runs its own handlers one at a time when one of them throws", () => {
        const boom = new Error("boom");
        const second = vi.fn();
        floorInterface.on("hall_button_pressed", () => {
          throw boom;
        });
        floorInterface.on("hall_button_pressed", second);

        expect(() => {
          floor.pressDownButton();
        }).not.toThrow();

        expect(errorHandler).toHaveBeenCalledWith(boom);
        expect(second).toHaveBeenCalledWith("down", floorInterface);
      });

      it("supports once, one and off", () => {
        const onceHandler = vi.fn();
        const oneHandler = vi.fn();
        const removed = vi.fn();
        floorInterface.once("hall_button_pressed", onceHandler);
        floorInterface.one("hall_button_pressed", oneHandler);
        floorInterface.on("hall_button_pressed", removed);
        floorInterface.off("hall_button_pressed", removed);

        floor.pressUpButton();
        floor.pressDownButton();

        expect(onceHandler).toHaveBeenCalledTimes(1);
        expect(onceHandler).toHaveBeenCalledWith("up", floorInterface);
        expect(oneHandler).toHaveBeenCalledTimes(1);
        expect(removed).not.toHaveBeenCalled();
      });

      it('goes with the rest on offAll, and on the off("*") spelling of it', () => {
        const dropped = vi.fn();
        floorInterface.on("hall_button_pressed", dropped);
        floorInterface.offAll();
        floor.pressUpButton();

        // A second press of an already-lit button raises nothing.
        floorInterface.on("hall_button_pressed", dropped);
        floorInterface.off("*");
        floor.pressDownButton();

        expect(dropped).not.toHaveBeenCalled();
      });

      it("takes part in the documented space separated registration", () => {
        const pressed = vi.fn();
        floorInterface.on("hall_button_pressed up_button_pressed", pressed);

        floor.pressUpButton();

        // The order of the two is the forwarder's, not the order the names were written in.
        expect(pressed).toHaveBeenCalledTimes(2);
        expect(pressed).toHaveBeenNthCalledWith(1, "up_button_pressed", floorInterface);
        expect(pressed).toHaveBeenNthCalledWith(2, "hall_button_pressed", "up", floorInterface);
      });

      describe("when a handler presses the same button again", () => {
        /** Registers all three handlers; `repressFrom` presses again, once. */
        const recordPresses = (repressFrom: "down_button_pressed" | "hall_button_pressed") => {
          const calls: string[] = [];
          let repressed = false;
          const repress = () => {
            if (repressed) {
              return;
            }
            repressed = true;
            // Clearing first, since an already-lit button would raise nothing to observe.
            floor.buttonStates.down = "";
            floor.pressDownButton();
          };

          floorInterface.on("down_button_pressed", () => {
            calls.push("down");
            if (repressFrom === "down_button_pressed") {
              repress();
            }
          });
          floorInterface.on("hall_button_pressed", (direction) => {
            calls.push(`hall:${direction}`);
            if (repressFrom === "hall_button_pressed") {
              repress();
            }
          });

          floor.pressDownButton();
          return calls;
        };

        it("drops the repress whole, from the button's own handler", () => {
          // The repress is refused as already in flight, and the general event with it.
          expect(recordPresses("down_button_pressed")).toEqual(["down", "hall:down"]);
        });

        it("drops the repress whole, from the general handler", () => {
          expect(recordPresses("hall_button_pressed")).toEqual(["down", "hall:down"]);
        });

        it("still delivers a press of the other button", () => {
          // The mark is per direction, so the two calls stay independent.
          const calls: string[] = [];
          let pressedUp = false;
          floorInterface.on("down_button_pressed", () => {
            calls.push("down");
            if (!pressedUp) {
              pressedUp = true;
              floor.pressUpButton();
            }
          });
          floorInterface.on("up_button_pressed", () => {
            calls.push("up");
          });
          floorInterface.on("hall_button_pressed", (direction) => {
            calls.push(`hall:${direction}`);
          });

          floor.pressDownButton();

          expect(calls).toEqual(["down", "up", "hall:up", "hall:down"]);
        });

        it("still delivers a press of the other button from the general handler", () => {
          // The guard keys on the call, not the event name, so the nested `up`
          // call isn't refused just because both directions share a name.
          const calls: string[] = [];
          let pressedUp = false;
          floorInterface.on("down_button_pressed", () => {
            calls.push("down");
          });
          floorInterface.on("up_button_pressed", () => {
            calls.push("up");
          });
          floorInterface.on("hall_button_pressed", (direction) => {
            calls.push(`hall:${direction}`);
            if (direction === "down" && !pressedUp) {
              pressedUp = true;
              floor.pressUpButton();
            }
          });

          floor.pressDownButton();

          expect(calls).toEqual(["down", "hall:down", "up", "hall:up"]);
        });

        it("drops a repress of the same button from the general handler", () => {
          // Narrowing the guard to one call must not widen it back to nothing.
          const calls: string[] = [];
          let repressed = false;
          floorInterface.on("down_button_pressed", () => {
            calls.push("down");
          });
          floorInterface.on("hall_button_pressed", (direction) => {
            calls.push(`hall:${direction}`);
            if (!repressed) {
              repressed = true;
              floor.buttonStates.down = "";
              floor.pressDownButton();
            }
          });

          floor.pressDownButton();

          expect(calls).toEqual(["down", "hall:down"]);
        });
      });
    });

    describe("destination_requested", () => {
      let dispatchFloor: Floor;
      let dispatchInterface: FloorInterface;

      /** Serves everything, which is all a booking asks of an elevator. */
      const anyElevator = {
        goingUpIndicator: false,
        goingDownIndicator: false,
        serves: () => true,
      };

      beforeEach(() => {
        dispatchFloor = new Floor(2, 100, errorHandler, true);
        dispatchInterface = new FloorInterface(dispatchFloor, errorHandler);
      });

      it("forwards a request with the destination first and itself second", () => {
        const requested = vi.fn();
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);

        expect(requested).toHaveBeenCalledTimes(1);
        expect(requested).toHaveBeenCalledWith(5, dispatchInterface);
        expect(requested).not.toHaveBeenCalledWith(5, dispatchFloor);
      });

      it("calls its handlers with the facade as `this`", () => {
        const seen: unknown[] = [];
        dispatchInterface.on("destination_requested", function (this: unknown): void {
          seen.push(this);
        });

        dispatchFloor.requestDestination(5);

        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(dispatchInterface);
        expect(seen[0]).not.toBe(dispatchFloor);
      });

      it("says nothing about someone joining a journey a car is booked for", () => {
        const requested = vi.fn();
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);
        dispatchFloor.assignElevator(5, anyElevator);
        dispatchFloor.requestDestination(5);

        expect(requested).toHaveBeenCalledTimes(1);
      });

      it("asks again when the booked car turns up full", () => {
        // Anti-livelock: a refused passenger has no lit button to press again, so the request reissues itself.
        const requested = vi.fn();
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);
        dispatchFloor.assignElevator(5, anyElevator);
        dispatchFloor.destinationRefused(5);

        expect(requested).toHaveBeenCalledTimes(2);
        expect(requested).toHaveBeenNthCalledWith(2, 5, dispatchInterface);
      });

      it("keeps journeys to different floors apart", () => {
        const requested = vi.fn();
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);
        dispatchFloor.assignElevator(5, anyElevator);
        dispatchFloor.requestDestination(7);

        expect(requested).toHaveBeenNthCalledWith(1, 5, dispatchInterface);
        expect(requested).toHaveBeenNthCalledWith(2, 7, dispatchInterface);
      });

      it("is not what a call button raises", () => {
        const requested = vi.fn();
        const dispatchRequested = vi.fn();
        floorInterface.on("destination_requested", requested);
        dispatchInterface.on("destination_requested", dispatchRequested);

        floor.pressUpButton();
        floor.pressDownButton();
        dispatchFloor.pressUpButton();

        expect(requested).not.toHaveBeenCalled();
        expect(dispatchRequested).not.toHaveBeenCalled();

        // Control: confirms the silence above is the button, not a dead forwarder.
        dispatchFloor.requestDestination(5);
        expect(dispatchRequested).toHaveBeenCalledTimes(1);
      });

      it("takes part in the documented space separated registration", () => {
        const heard = vi.fn();
        dispatchInterface.on("destination_requested up_button_pressed", heard);

        dispatchFloor.requestDestination(5);

        expect(heard).toHaveBeenCalledTimes(1);
        expect(heard).toHaveBeenCalledWith("destination_requested", 5, dispatchInterface);
      });

      it("supports once, one and off", () => {
        const onceHandler = vi.fn();
        const oneHandler = vi.fn();
        const removed = vi.fn();
        dispatchInterface.once("destination_requested", onceHandler);
        dispatchInterface.one("destination_requested", oneHandler);
        dispatchInterface.on("destination_requested", removed);
        dispatchInterface.off("destination_requested", removed);

        dispatchFloor.requestDestination(5);
        dispatchFloor.requestDestination(7);

        expect(onceHandler).toHaveBeenCalledTimes(1);
        expect(onceHandler).toHaveBeenCalledWith(5, dispatchInterface);
        expect(oneHandler).toHaveBeenCalledTimes(1);
        expect(removed).not.toHaveBeenCalled();
      });

      it('goes with the rest on offAll, and on the off("*") spelling of it', () => {
        const dropped = vi.fn();
        dispatchInterface.on("destination_requested", dropped);
        dispatchInterface.offAll();
        dispatchFloor.requestDestination(5);

        dispatchInterface.on("destination_requested", dropped);
        dispatchInterface.off("*");
        dispatchFloor.requestDestination(7);

        expect(dropped).not.toHaveBeenCalled();

        // Control: a handler registered after the drop is still heard.
        const kept = vi.fn();
        dispatchInterface.on("destination_requested", kept);
        dispatchFloor.requestDestination(9);
        expect(kept).toHaveBeenCalledTimes(1);
      });

      it("routes player handler exceptions to the error handler, one at a time", () => {
        const boom = new Error("boom");
        const second = vi.fn();
        dispatchInterface.on("destination_requested", () => {
          throw boom;
        });
        dispatchInterface.on("destination_requested", second);

        expect(() => {
          dispatchFloor.requestDestination(5);
        }).not.toThrow();

        expect(errorHandler).toHaveBeenCalledWith(boom);
        expect(second).toHaveBeenCalledWith(5, dispatchInterface);
      });

      it("delivers a journey to this same floor after the dispatch unwinds", () => {
        // A handler books a car that turns up full, and `destinationRefused`
        // asks again while this dispatch is still running.
        const seen: string[] = [];
        let nested = false;
        dispatchInterface.on("destination_requested", (destinationFloor) => {
          seen.push(`enter:${String(destinationFloor)}`);
          if (!nested) {
            nested = true;
            dispatchFloor.assignElevator(destinationFloor, anyElevator);
            dispatchFloor.destinationRefused(destinationFloor);
          }
          seen.push(`leave:${String(destinationFloor)}`);
        });

        dispatchFloor.requestDestination(5);

        // The second dispatch begins after the first has left.
        expect(seen).toEqual(["enter:5", "leave:5", "enter:5", "leave:5"]);
        expect(errorHandler).not.toHaveBeenCalled();
      });

      it("stops at one re-delivery, however often a handler reissues", () => {
        // Each re-delivery is its own dispatch, so this could otherwise recur forever.
        const requested = vi.fn(() => {
          dispatchFloor.requestDestination(5);
        });
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);

        expect(requested).toHaveBeenCalledTimes(2);
        expect(errorHandler).not.toHaveBeenCalled();
      });

      it("says nothing about a journey booked while the dispatch unwound", () => {
        // A re-delivery is re-checked against the floor first, so an answered nested request stays silent.
        let nested = false;
        const requested = vi.fn((destinationFloor: number) => {
          if (nested) {
            return;
          }
          nested = true;
          dispatchFloor.requestDestination(destinationFloor);
          dispatchFloor.assignElevator(destinationFloor, anyElevator);
        });
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);

        expect(requested).toHaveBeenCalledTimes(1);
        expect(dispatchFloor.assignedElevator(5)).toBe(anyElevator);
      });

      it("says nothing about a journey nobody is waiting on any more", () => {
        let nested = false;
        const requested = vi.fn((destinationFloor: number) => {
          if (nested) {
            return;
          }
          nested = true;
          dispatchFloor.requestDestination(destinationFloor);
          dispatchFloor.destinationBoarded(destinationFloor);
          dispatchFloor.destinationBoarded(destinationFloor);
        });
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);

        expect(requested).toHaveBeenCalledTimes(1);
        expect(dispatchFloor.pendingDestinations().has(5)).toBe(false);
      });

      it("delivers a journey to another floor raised from inside a dispatch", () => {
        // A car that turns up full refuses a passenger bound elsewhere, whose
        // journey is asked for afresh while this dispatch is still running.
        const seen: number[] = [];
        dispatchInterface.on("destination_requested", (destinationFloor) => {
          seen.push(destinationFloor);
          if (destinationFloor === 5) {
            dispatchFloor.requestDestination(7);
          }
        });

        dispatchFloor.requestDestination(5);

        expect(seen).toEqual([5, 7]);
        expect(errorHandler).not.toHaveBeenCalled();
      });

      it("stops forwarding once the floor's subscriptions are dropped", () => {
        const requested = vi.fn();
        dispatchInterface.on("destination_requested", requested);

        dispatchFloor.requestDestination(5);
        expect(requested).toHaveBeenCalledTimes(1);

        dispatchFloor.offAll();
        dispatchFloor.requestDestination(7);

        expect(requested).toHaveBeenCalledTimes(1);
      });
    });
  });
});
