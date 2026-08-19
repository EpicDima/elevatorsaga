// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createElevatorView, elevatorButtonTemplate, elevatorTemplate } from "./elevator-view.ts";
import { Elevator } from "#game/elevator.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { renderElement, renderFragment } from "#shared/ui/markup.ts";

import { elevatorFloorButtonLabel, elevatorLabel } from "../../../ui/templates.ts";

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

describe("elevatorTemplate", () => {
  it("sets the car width and keeps the movable class", () => {
    const elevator = renderElement(elevatorTemplate(40, 0));
    expect(elevator.className).toBe("elevator movable");
    expect(elevator.style.width).toBe("40px");
  });

  it("renders both direction indicators and the empty indicator slots", () => {
    const elevator = renderElement(elevatorTemplate(40, 1));
    expect(elevator.querySelector(".directionindicatorup .up.activated")).not.toBeNull();
    expect(elevator.querySelector(".directionindicatordown .down.activated")).not.toBeNull();
    expect(elevator.querySelector(".floorindicator > span")?.textContent).toBe("");
    expect(elevator.querySelector(".buttonindicator")?.children).toHaveLength(0);
    expect(elevator.getAttribute("aria-label")).toBe("Elevator 2");
  });
});

describe("elevatorButtonTemplate", () => {
  it("renders a labelled button holding just the floor number", () => {
    const button = renderElement(elevatorButtonTemplate(7));
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toBe("buttonpress");
    expect(button.textContent).toBe("7");
    expect(button.getAttribute("aria-label")).toBe("Go to floor 7");
  });

  it("introduces no whitespace, so the buttons stay flush against each other", () => {
    const source = elevatorButtonTemplate(0) + elevatorButtonTemplate(1);
    const fragment = renderFragment(source);
    expect(fragment.childNodes).toHaveLength(2);
    expect(fragment.textContent).toBe("01");
  });
});

describe("the two names a car can be renamed from", () => {
  it("hands the car and its floor buttons the very labels the relabeller writes back in", () => {
    // relabelWorld renames a car that is already on screen by calling
    // elevatorLabel/elevatorFloorButtonLabel directly, and these templates call
    // the same two. Two copies of a message key, one in each path, is how a
    // renamed message ends up renaming only half a car; there is one copy, and
    // this is the assertion that the templates still go through it.
    expect(renderElement(elevatorTemplate(40, 1)).getAttribute("aria-label")).toBe(
      elevatorLabel(1),
    );
    expect(renderElement(elevatorButtonTemplate(7)).getAttribute("aria-label")).toBe(
      elevatorFloorButtonLabel(7),
    );
  });
});

describe("the language a car comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("names a car and its floor buttons", () => {
    setLocale("ru");

    expect(renderElement(elevatorTemplate(40, 1)).getAttribute("aria-label")).toBe("Лифт 2");
    expect(renderElement(elevatorButtonTemplate(7)).getAttribute("aria-label")).toBe(
      "Ехать на этаж 7",
    );
  });

  it("is settled when a template runs, not when the module was loaded", () => {
    // The trap `src/ui/templates.ts`'s docblock is about: a `const` holding a
    // translated string would be filled in at import time, when no catalogue
    // but English has been loaded, and would stay English for the rest of the
    // session.
    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Elevator 1");

    setLocale("ru");

    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Лифт 1");
  });
});
