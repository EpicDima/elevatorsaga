// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createElevatorView } from "./elevator-view.ts";
import { Elevator } from "#game/elevator.ts";
import { requireElement } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";

/** A 5-floor, 50px-floor-height elevator with capacity 4, for tests that don't care about speed. */
function fixtureElevator(maxUsers = 4): Elevator {
  return new Elevator(1.5, 5, 50, maxUsers);
}

describe("createElevatorView", () => {
  it("draws the car's floor buttons, one per floor, unlit", () => {
    const view = createElevatorView(fixtureElevator(), 0, { scaleX: 1, scaleY: 1 });

    const buttons = view.element.querySelectorAll(".buttonpress");
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("scales worldX/worldY by the live StageScale on every new_display_state", () => {
    const elevator = fixtureElevator();
    const scale: StageScale = { scaleX: 1, scaleY: 1 };
    const view = createElevatorView(elevator, 0, scale);

    elevator.moveTo(200, 100);
    elevator.updateDisplayPosition();
    expect(view.element.style.transform).toBe("translate3d(200px, 100px, 0)");

    scale.scaleX = 0.5;
    scale.scaleY = 2;
    elevator.moveTo(200, 120);
    elevator.updateDisplayPosition();
    expect(view.element.style.transform).toBe("translate3d(100px, 240px, 0)");
  });

  it("lights a floor button once pressed, and presses it back when clicked", () => {
    const elevator = fixtureElevator();
    const view = createElevatorView(elevator, 0, { scaleX: 1, scaleY: 1 });
    const buttons = view.element.querySelectorAll(".buttonpress");

    elevator.pressFloorButton(2);
    expect(buttons[2]?.classList.contains("activated")).toBe(true);

    const otherElevator = fixtureElevator();
    const otherView = createElevatorView(otherElevator, 0, { scaleX: 1, scaleY: 1 });
    requireElement(".buttonpress", otherView.element).dispatchEvent(new Event("click"));
    expect(otherElevator.buttonStates[0]).toBe(true);
  });

  it("resizes the car via inline style", () => {
    const view = createElevatorView(fixtureElevator(), 0, { scaleX: 1, scaleY: 1 });

    view.setGeometry(40, 42);

    expect(view.element.style.width).toBe("40px");
    expect(view.element.style.height).toBe("42px");
  });
});
