// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createFloorView, floorTemplate } from "./floor-view.ts";
import { Floor } from "#game/floor.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { renderElement } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

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

describe("floorTemplate", () => {
  it("positions the floor and shows its number", () => {
    const floor = renderElement(floorTemplate(2, 150));
    expect(floor.className).toBe("floor");
    expect(floor.style.top).toBe("150px");
    expect(floor.querySelector(".floornumber")?.textContent).toBe("2");
  });

  it("makes the call buttons real, labelled buttons", () => {
    const floor = renderElement(floorTemplate(2, 150));
    const up = floor.querySelector("button.up");
    const down = floor.querySelector("button.down");
    expect(up?.getAttribute("aria-label")).toBe("Call an elevator going up from floor 2");
    expect(down?.getAttribute("aria-label")).toBe("Call an elevator going down from floor 2");
    expect(up?.getAttribute("aria-pressed")).toBe("false");
    expect(down?.getAttribute("aria-pressed")).toBe("false");
    expect(up?.getAttribute("type")).toBe("button");
  });

  it("keeps exactly one space between the two call buttons", () => {
    const floor = renderElement(floorTemplate(0, 0));
    const indicator = floor.querySelector(".buttonindicator");
    expect(indicator?.childNodes[1]?.textContent).toBe(" ");
  });
});

describe("the two names a floor can be renamed from", () => {
  it("hands the call buttons the very labels the relabeller writes back in", () => {
    // relabelWorld renames a floor that is already on screen by calling
    // floorCallUpLabel/floorCallDownLabel directly, and this template calls the
    // same two. Two copies of a message key, one in each path, is how a renamed
    // message ends up renaming only half a floor; there is one copy, and this
    // is the assertion that the template still goes through it.
    const floor = renderElement(floorTemplate(2, 150));
    expect(floor.querySelector("button.up")?.getAttribute("aria-label")).toBe(floorCallUpLabel(2));
    expect(floor.querySelector("button.down")?.getAttribute("aria-label")).toBe(
      floorCallDownLabel(2),
    );
  });
});

describe("the language a floor's call buttons come out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("names the call buttons of a floor", () => {
    setLocale("ru");
    const floor = renderElement(floorTemplate(2, 150));

    expect(floor.querySelector("button.up")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вверх с этажа 2",
    );
    expect(floor.querySelector("button.down")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вниз с этажа 2",
    );
  });
});
