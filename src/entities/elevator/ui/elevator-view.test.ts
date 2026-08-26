// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createElevatorView, elevatorButtonTemplate, elevatorTemplate } from "./elevator-view.ts";
import { Elevator } from "#game/elevator.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { unscaled, type StageScale } from "#shared/lib/stage-scale.ts";
import { renderElement, renderFragment } from "#shared/ui/markup.ts";

import { elevatorFloorButtonLabel, elevatorLabel } from "../../../ui/templates.ts";

/** A 5-floor, 50px-floor-height elevator with capacity 4, for tests that don't care about speed. */
function fixtureElevator(maxUsers = 4): Elevator {
  return new Elevator(1.5, 5, 50, maxUsers);
}

/** The mark strip's buttons, in level order. */
function marks(view: { element: HTMLElement }): HTMLElement[] {
  return [...view.element.querySelectorAll<HTMLElement>(".shaft-marks .mark")];
}

describe("createElevatorView", () => {
  it("draws one order mark per floor, unlit, inside the shaft's own strip", () => {
    const view = createElevatorView(fixtureElevator(), 0, unscaled());

    const buttons = marks(view);
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.classList.contains("is-lit")).toBe(false);
      // .buttonpress is the selector relabelWorld and the e2e specs use to
      // reach an in-car floor button.
      expect(button.classList.contains("buttonpress")).toBe(true);
    }
  });

  it("moves the car inside the shaft, at the live StageScale, and never sideways", () => {
    const elevator = fixtureElevator();
    const scale: StageScale = unscaled();
    const view = createElevatorView(elevator, 0, scale);
    const car = requireElement(".car", view.element);

    elevator.moveTo(200, 100);
    elevator.updateDisplayPosition();
    // x stays 0 whatever worldX says: the shaft holds the car's horizontal
    // place; setGeometry is what positions the shaft.
    expect(car.style.transform).toBe("translate3d(0px, 100px, 0)");

    scale.scaleX = 0.5;
    scale.scaleY = 2;
    elevator.moveTo(200, 120);
    elevator.updateDisplayPosition();
    expect(car.style.transform).toBe("translate3d(0px, 240px, 0)");
  });

  it("shows the floor the car is on", () => {
    const elevator = fixtureElevator();
    const view = createElevatorView(elevator, 0, unscaled());
    const label = requireElement(".car-floor", view.element);

    // World y 0 is the top floor of a five-floor building; the label is read
    // from the simulation, not assumed to be 0.
    expect(label.textContent).toBe("4");

    elevator.moveTo(null, elevator.getYPosOfFloor(1));
    elevator.trigger("new_state", elevator);
    expect(label.textContent).toBe("1");
  });

  it("lights an order mark once pressed, and presses it back when clicked", () => {
    const elevator = fixtureElevator();
    const view = createElevatorView(elevator, 0, unscaled());
    const buttons = marks(view);

    elevator.pressFloorButton(2);
    expect(buttons[2]?.classList.contains("is-lit")).toBe(true);
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1]?.classList.contains("is-lit")).toBe(false);

    const otherElevator = fixtureElevator();
    const otherView = createElevatorView(otherElevator, 0, unscaled());
    requireElement(".mark", otherView.element).dispatchEvent(new Event("click"));
    expect(otherElevator.buttonStates[0]).toBe(true);
  });

  it("draws the boarding lamps from the state that really decides who may board", () => {
    const elevator = fixtureElevator();
    const view = createElevatorView(elevator, 0, unscaled());
    const up = requireElement(".car-dir-up", view.element);
    const down = requireElement(".car-dir-down", view.element);

    // A car advertises both directions until a program says otherwise; the
    // view reads that initial state since indicatorstate_change only fires on change.
    expect(up.classList.contains("is-on")).toBe(true);
    expect(down.classList.contains("is-on")).toBe(true);

    elevator.goingUpIndicator = false;
    elevator.trigger("change:goingUpIndicator", false);
    expect(up.classList.contains("is-on")).toBe(false);
    expect(down.classList.contains("is-on")).toBe(true);

    elevator.goingUpIndicator = true;
    elevator.trigger("change:goingUpIndicator", true);
    expect(up.classList.contains("is-on")).toBe(true);
  });

  it("opens the doors exactly while the car is standing still on a floor", () => {
    const elevator = fixtureElevator();
    const view = createElevatorView(elevator, 0, unscaled());
    const car = requireElement(".car", view.element);

    expect(car.classList.contains("is-open")).toBe(true);

    // Between two floors: nothing to open onto.
    elevator.moveTo(null, 75);
    elevator.updateDisplayPosition(true);
    expect(car.classList.contains("is-open")).toBe(false);

    // Level with a floor, but passing it at speed.
    elevator.isMoving = true;
    elevator.moveTo(null, 100);
    elevator.updateDisplayPosition(true);
    expect(car.classList.contains("is-open")).toBe(false);

    // Arriving doesn't move the car, so new_display_state isn't raised;
    // stopped_at_floor is what opens the doors here.
    elevator.isMoving = false;
    elevator.trigger("stopped_at_floor", 2);
    expect(car.classList.contains("is-open")).toBe(true);
  });

  it("places the shaft and centers every mark on its own floor", () => {
    const view = createElevatorView(fixtureElevator(), 0, unscaled());

    view.setGeometry({
      leftPx: 154,
      widthPx: 52,
      padPx: 6,
      markBottomsPx: [24, 72, 120, 168, 216],
    });

    expect(view.element.style.left).toBe("154px");
    expect(view.element.style.width).toBe("52px");
    // The pad is a variable since the car is inset by it on both walls, and
    // the mark strip is drawn in it.
    expect(view.element.style.getPropertyValue("--ds-shaft-pad")).toBe("6px");
    expect(marks(view).map((mark) => mark.style.bottom)).toEqual([
      "24px",
      "72px",
      "120px",
      "168px",
      "216px",
    ]);
  });
});

describe("elevatorTemplate", () => {
  it("keeps both the class the stylesheet draws and the one relabelWorld selects by", () => {
    const shaft = renderElement(elevatorTemplate(0));
    expect(shaft.className).toBe("shaft elevator");
    expect(shaft.getAttribute("role")).toBe("group");
  });

  it("renders the car with its two boarding lamps and its floor number", () => {
    const shaft = renderElement(elevatorTemplate(1));
    expect(shaft.querySelector(".car .car-top .car-dir-up")).not.toBeNull();
    expect(shaft.querySelector(".car .car-top .car-dir-down")).not.toBeNull();
    expect(shaft.querySelector(".car-floor")?.textContent).toBe("0");
    expect(shaft.querySelectorAll(".car-cabin .doors .door")).toHaveLength(2);
    // Empty until createElevatorView fills it; a template doesn't know how
    // many floors the building has.
    expect(shaft.querySelector(".shaft-marks")?.children).toHaveLength(0);
    expect(shaft.getAttribute("aria-label")).toBe("Elevator 1");
  });
});

describe("elevatorButtonTemplate", () => {
  it("renders a labeled mark carrying no text of its own", () => {
    const button = renderElement(elevatorButtonTemplate(7));
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toBe("mark buttonpress");
    // A mark is four pixels wide, too narrow to draw a digit; the aria-label
    // is all a screen reader has.
    expect(button.textContent).toBe("");
    expect(button.getAttribute("aria-label")).toBe("Go to floor 7");
  });

  it("introduces no whitespace, so the marks can be positioned one per floor", () => {
    const source = elevatorButtonTemplate(0) + elevatorButtonTemplate(1);
    const fragment = renderFragment(source);
    expect(fragment.childNodes).toHaveLength(2);
  });
});

describe("the two names a car can be renamed from", () => {
  it("hands the car and its floor buttons the very labels the relabeller writes back in", () => {
    // relabelWorld renames a car already on screen by calling
    // elevatorLabel/elevatorFloorButtonLabel directly; these templates must
    // call the same functions, or a renamed message key only takes effect on half a car.
    expect(renderElement(elevatorTemplate(1)).getAttribute("aria-label")).toBe(elevatorLabel(1));
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

    expect(renderElement(elevatorTemplate(1)).getAttribute("aria-label")).toBe("Лифт 1");
    expect(renderElement(elevatorButtonTemplate(7)).getAttribute("aria-label")).toBe(
      "Ехать на этаж 7",
    );
  });

  it("is settled when a template runs, not when the module was loaded", () => {
    // A const holding a translated string would be filled in at import time,
    // before any non-English catalog loads, and stay English for the session.
    expect(renderElement(elevatorTemplate(0)).getAttribute("aria-label")).toBe("Elevator 0");

    setLocale("ru");

    expect(renderElement(elevatorTemplate(0)).getAttribute("aria-label")).toBe("Лифт 0");
  });
});
