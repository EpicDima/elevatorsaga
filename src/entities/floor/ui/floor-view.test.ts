// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createFloorView, floorTemplate } from "./floor-view.ts";
import { Floor } from "#game/floor.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { renderElement } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

/**
 * How many floors the building these fixtures come from has.
 *
 * Six, so that levels 1 through 4 are all middle floors carrying both lamps
 * and the two ends are unambiguously the ends.
 */
const FLOOR_COUNT = 6;

/** A floor with no error handler wired, for tests that never throw one. */
function fixtureFloor(level = 2): Floor {
  return new Floor(level, level * 50, () => {
    throw new Error("unexpected floor error");
  });
}

describe("createFloorView", () => {
  it("draws the floor's number and unlit call buttons", () => {
    const view = createFloorView(fixtureFloor(3), FLOOR_COUNT);

    expect(requireElement(".level-num", view.element).textContent).toBe("3");
    expect(requireElement("button.up", view.element).getAttribute("aria-pressed")).toBe("false");
    expect(requireElement("button.down", view.element).getAttribute("aria-pressed")).toBe("false");
  });

  it("lights the up button once the floor's up call is pressed, and clears it once served", () => {
    const floor = fixtureFloor(1);
    const view = createFloorView(floor, FLOOR_COUNT);
    const up = requireElement("button.up", view.element);

    floor.pressUpButton();
    expect(up.classList.contains("is-lit")).toBe(true);
    expect(up.getAttribute("aria-pressed")).toBe("true");

    floor.elevatorAvailable({
      goingUpIndicator: true,
      goingDownIndicator: false,
      serves: () => true,
    });
    expect(up.classList.contains("is-lit")).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("false");
  });

  it("presses the floor's own up/down buttons when its call buttons are clicked", () => {
    const floor = fixtureFloor(1);
    const view = createFloorView(floor, FLOOR_COUNT);

    requireElement("button.up", view.element).dispatchEvent(new Event("click"));
    expect(floor.buttonStates.up).toBe("activated");

    requireElement("button.down", view.element).dispatchEvent(new Event("click"));
    expect(floor.buttonStates.down).toBe("activated");
  });

  it("stays wired to the world through an end floor's missing lamp", () => {
    // The lamp that is there still answers, and the state change that arrives
    // for the lamp that is not there is simply not drawn -- the engine keeps
    // both directions on every floor whatever the building shows.
    const lobby = fixtureFloor(0);
    const lobbyView = createFloorView(lobby, FLOOR_COUNT);
    const roof = fixtureFloor(FLOOR_COUNT - 1);
    const roofView = createFloorView(roof, FLOOR_COUNT);

    requireElement("button.up", lobbyView.element).dispatchEvent(new Event("click"));
    expect(lobby.buttonStates.up).toBe("activated");
    expect(() => {
      roof.pressUpButton();
    }).not.toThrow();
    expect(roof.buttonStates.up).toBe("activated");
    expect(roofView.element.querySelector(".is-lit")).toBeNull();
  });

  it("resizes the floor's row via inline style, and never positions it", () => {
    const view = createFloorView(fixtureFloor(0), FLOOR_COUNT);

    view.setGeometry(64);

    expect(view.element.style.height).toBe("64px");
    // The column is a flex stack: a floor that positioned itself would leave
    // the one below it drawing through it.
    expect(view.element.style.top).toBe("");
  });
});

describe("floorTemplate", () => {
  it("draws the mockup's level row, number and lamps in one box", () => {
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));
    expect(floor.className).toBe("floor level");
    expect(floor.querySelector(".level-num")?.textContent).toBe("2");
    expect(floor.querySelectorAll(".calls .call").length).toBe(2);
  });

  it("leaves the lamp that could never light off each end floor", () => {
    // Nothing is called up from the roof and nothing down from the lobby --
    // `spawnUserRandomly` cannot produce either call at any seed. See this
    // module's own comment, and `callControls` in design/ui-mockup.html.
    const lobby = renderElement(floorTemplate(0, FLOOR_COUNT));
    expect(lobby.querySelector("button.up")).not.toBeNull();
    expect(lobby.querySelector("button.down")).toBeNull();

    const roof = renderElement(floorTemplate(FLOOR_COUNT - 1, FLOOR_COUNT));
    expect(roof.querySelector("button.up")).toBeNull();
    expect(roof.querySelector("button.down")).not.toBeNull();

    // And every floor between them keeps both, however tall the building is.
    for (const level of [1, 2, FLOOR_COUNT - 2]) {
      const floor = renderElement(floorTemplate(level, FLOOR_COUNT));
      expect(floor.querySelector("button.up")).not.toBeNull();
      expect(floor.querySelector("button.down")).not.toBeNull();
    }
  });

  it("makes the call buttons real, labelled buttons", () => {
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));
    const up = floor.querySelector("button.up");
    const down = floor.querySelector("button.down");
    expect(up?.getAttribute("aria-label")).toBe("Call an elevator going up from floor 2");
    expect(down?.getAttribute("aria-label")).toBe("Call an elevator going down from floor 2");
    expect(up?.getAttribute("aria-pressed")).toBe("false");
    expect(down?.getAttribute("aria-pressed")).toBe("false");
    expect(up?.getAttribute("type")).toBe("button");
  });

  it("leaves no whitespace around the lamps, however many there are", () => {
    // `.calls` is a flex column with its own gap, so a stray text node between
    // the two buttons -- or where an end floor's missing one used to be --
    // would be a flex item of its own.
    const middle = renderElement(floorTemplate(1, FLOOR_COUNT)).querySelector(".calls");
    expect(middle?.childNodes.length).toBe(2);
    const lobby = renderElement(floorTemplate(0, FLOOR_COUNT)).querySelector(".calls");
    expect(lobby?.childNodes.length).toBe(1);
  });
});

describe("the two names a floor can be renamed from", () => {
  it("hands the call buttons the very labels the relabeller writes back in", () => {
    // relabelWorld renames a floor that is already on screen by calling
    // floorCallUpLabel/floorCallDownLabel directly, and this template calls the
    // same two. Two copies of a message key, one in each path, is how a renamed
    // message ends up renaming only half a floor; there is one copy, and this
    // is the assertion that the template still goes through it.
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));
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
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));

    expect(floor.querySelector("button.up")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вверх с этажа 2",
    );
    expect(floor.querySelector("button.down")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вниз с этажа 2",
    );
  });
});
