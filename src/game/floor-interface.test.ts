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
    // Issue #3: the real Floor was handed straight to player code, exposing
    // yPosition, getSpawnPosY, elevatorAvailable, pressUpButton and trigger.
    // The emitter is held rather than inherited from, so its dispatch side is
    // not reachable either.
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
      // Legacy riot dispatched with `fn.apply(el, ...)` (libs/riot.js:45), and
      // player code was handed the emitter itself.
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
      // The legacy floors were riot observables (`floor.js:3`), and riot
      // prepended the name of the event that fired whenever the registration
      // listed more than one (`libs/riot.js:11`, `libs/riot.js:45`).
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
      // How World.unWind tears the facades down: it drops the floor's
      // subscriptions, which includes the forwarding this facade registered.
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
      // The legacy floors were riot observables (`floor.js:3`) handed straight
      // to player code (`world.js:239`), so `floor.off("*")` — riot's
      // unregister-everything wildcard (`libs/riot.js:18`) — worked on them.
      const dropped = vi.fn();
      floorInterface.on("up_button_pressed", dropped);
      floorInterface.on("buttonstate_change", dropped);

      expect(floorInterface.offAll()).toBe(floorInterface);
      floor.pressUpButton();

      expect(dropped).not.toHaveBeenCalled();

      // The forwarding is registered on the floor, not on the facade's own
      // emitter, so it survives: unlike riot's shared callback map, this cannot
      // leave a player deaf to floor events for the rest of the run.
      const later = vi.fn();
      floorInterface.on("down_button_pressed", later);
      floor.pressDownButton();

      expect(later).toHaveBeenCalledTimes(1);
      expect(later).toHaveBeenCalledWith(floorInterface);
    });

    it("supports the legacy one() spelling of once()", () => {
      // The legacy floors were riot observables (`floor.js:3`) handed straight
      // to player code, and riot published `one`, not `once`
      // (`libs/riot.js:33`).
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
      // The spelling published solutions actually use, and the one the accepted
      // answer to upstream issue #97 gives. It must not be a silent no-op.
      const dropped = vi.fn();
      floorInterface.on("up_button_pressed", dropped);
      floorInterface.on("buttonstate_change", dropped);

      expect(floorInterface.off("*")).toBe(floorInterface);
      floor.pressUpButton();

      expect(dropped).not.toHaveBeenCalled();
    });

    describe("hall_button_pressed", () => {
      // Upstream issue #33: one event for both call buttons, so a solution that
      // treats a call as a call — the usual shape — need not register the same
      // handler twice and then work out which of the two it was given.
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
        // The order is the forwarder's, not the player's: both events are
        // raised from the one subscription on the real floor, specific first.
        // Registering the general one first is the case that would give a
        // registration-order dependency away.
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
        // The two are separate dispatches and each isolates its handlers, so a
        // solution subscribed to both does not lose the second because the
        // first went wrong (upstream issues #88, #83, #27).
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

        // A second press of a button that is already lit raises nothing
        // (`Floor.pressUpButton`), so the other button is what tests the other
        // spelling.
        floorInterface.on("hall_button_pressed", dropped);
        floorInterface.off("*");
        floor.pressDownButton();

        expect(dropped).not.toHaveBeenCalled();
      });

      it("takes part in the documented space separated registration", () => {
        const pressed = vi.fn();
        floorInterface.on("hall_button_pressed up_button_pressed", pressed);

        floor.pressUpButton();

        // riot prepended the name of the event that fired whenever the
        // registration named more than one (`libs/riot.js:11`,
        // `libs/riot.js:45`), and the order of the two is still the forwarder's
        // rather than the order the names were written in.
        expect(pressed).toHaveBeenCalledTimes(2);
        expect(pressed).toHaveBeenNthCalledWith(1, "up_button_pressed", floorInterface);
        expect(pressed).toHaveBeenNthCalledWith(2, "hall_button_pressed", "up", floorInterface);
      });

      // A nested press is not a contrived case: `Floor` has no re-entrancy
      // guard on purpose, and a passenger refused by a full car presses again
      // while `*_button_pressed` is still in flight. The emitter's own guard is
      // per event name, so before the pair was made atomic these two tests
      // recorded ["down", "hall:down", "hall:down"] and
      // ["down", "hall:down", "down"] respectively — a general event with no
      // specific one before it, and a specific one with no general one after.
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
            // Clearing first because a button that is already lit raises
            // nothing, which would leave nothing nested to observe.
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
          // The specific event alone behaved this way before the general one
          // existed, and still does: the repress is refused as already in
          // flight. What matters is that the general event is refused with it.
          expect(recordPresses("down_button_pressed")).toEqual(["down", "hall:down"]);
        });

        it("drops the repress whole, from the general handler", () => {
          expect(recordPresses("hall_button_pressed")).toEqual(["down", "hall:down"]);
        });

        it("still delivers a press of the other button", () => {
          // The mark is per direction, so the two calls stay independent: a
          // handler that presses the *other* button is heard exactly as it was
          // before this event existed, and each general event still follows its
          // own specific one.
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
          // The same independence, reached from the general event — which is the
          // case the per-direction mark alone could not carry. It admits the
          // nested `up` call, being a different direction, but the emitter
          // guards by event *name*, and `hall_button_pressed` is one name for
          // both directions: the nested general event was refused as already in
          // flight, so this recorded ["down", "hall:down", "up"] — a specific
          // event with no general one after it, the very split the mark exists
          // to prevent. Hence the per-call key in `#forwardCall`.
          //
          // Worth a test of its own because a solution reads far more naturally
          // this way round: a handler of `hall_button_pressed` is the one place
          // a program sees both calls, so it is where a program that answers a
          // call by making another would put that logic.
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
          // The other half of the key: narrowing the guard to one call must not
          // widen it back to nothing. A `hall_button_pressed` handler that
          // presses the button it was just told about is the recursion the guard
          // is for, and it is still refused — both events of it, not one.
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
  });
});
