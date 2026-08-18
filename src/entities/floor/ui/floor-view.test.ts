// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createFloorView } from "./floor-view.ts";
import { Floor } from "#game/floor.ts";
import { requireElement } from "#shared/lib/dom.ts";

/** A floor with no error handler wired, for tests that never throw one. */
function fixtureFloor(level = 2): Floor {
  return new Floor(level, level * 50, () => {
    throw new Error("unexpected floor error");
  });
}

describe("createFloorView", () => {
  it("draws the floor's number and unlit call buttons", () => {
    const view = createFloorView(fixtureFloor(3));

    expect(requireElement(".floornumber", view.element).textContent).toBe("3");
    expect(requireElement("button.up", view.element).getAttribute("aria-pressed")).toBe("false");
    expect(requireElement("button.down", view.element).getAttribute("aria-pressed")).toBe("false");
  });

  it("lights the up button once the floor's up call is pressed, and clears it once served", () => {
    const floor = fixtureFloor(1);
    const view = createFloorView(floor);
    const up = requireElement("button.up", view.element);

    floor.pressUpButton();
    expect(up.classList.contains("activated")).toBe(true);
    expect(up.getAttribute("aria-pressed")).toBe("true");

    floor.elevatorAvailable({ goingUpIndicator: true, goingDownIndicator: false });
    expect(up.classList.contains("activated")).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("false");
  });

  it("presses the floor's own up/down buttons when its call buttons are clicked", () => {
    const floor = fixtureFloor(1);
    const view = createFloorView(floor);

    requireElement("button.up", view.element).dispatchEvent(new Event("click"));
    expect(floor.buttonStates.up).toBe("activated");

    requireElement("button.down", view.element).dispatchEvent(new Event("click"));
    expect(floor.buttonStates.down).toBe("activated");
  });

  it("repositions and resizes the floor via inline style, overriding nothing else", () => {
    const view = createFloorView(fixtureFloor(0));

    view.setGeometry(120, 64);

    expect(view.element.style.top).toBe("120px");
    expect(view.element.style.height).toBe("64px");
  });
});
