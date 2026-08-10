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

  it("hides the floor's internals from player code", () => {
    // Issue #3: the real Floor was handed straight to player code, exposing
    // yPosition, getSpawnPosY, elevatorAvailable, pressUpButton and trigger.
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
    for (const forbidden of [
      "yPosition",
      "getSpawnPosY",
      "elevatorAvailable",
      "pressUpButton",
      "pressDownButton",
    ]) {
      expect(exposed.has(forbidden)).toBe(false);
    }
    // The Observable members it does inherit only reach its own subscribers,
    // exactly as on ElevatorInterface.
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
    });

    it("supports off and once", () => {
      const once = vi.fn();
      const removed = vi.fn();
      floorInterface.once("up_button_pressed", once);
      floorInterface.on("up_button_pressed", removed);
      floorInterface.off("up_button_pressed", removed);

      floor.pressUpButton();
      floor.elevatorAvailable({ goingUpIndicator: true, goingDownIndicator: true });
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

    it("stops forwarding once its subscriptions are dropped", () => {
      const upPressed = vi.fn();
      floorInterface.on("up_button_pressed", upPressed);

      floorInterface.offAll();
      floor.pressUpButton();

      expect(upPressed).not.toHaveBeenCalled();
    });
  });
});
