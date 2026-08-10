import { beforeEach, describe, expect, it, vi } from "vitest";

import { Floor, type FloorElevator, type FloorErrorHandler } from "./floor.ts";

/** An elevator stand-in: a floor only reads the two indicator flags. */
function indicators(up: boolean, down: boolean): FloorElevator {
  return { goingUpIndicator: up, goingDownIndicator: down };
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
