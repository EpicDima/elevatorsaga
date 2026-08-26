// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createFloorView, floorTemplate } from "./floor-view.ts";
import { Floor } from "#game/floor.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { renderElement } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

/** Six, so levels 1-4 are middle floors with both lamps and the ends are unambiguous. */
const FLOOR_COUNT = 6;

/** A floor with no error handler wired, for tests that never throw one. */
function fixtureFloor(level = 2): Floor {
  return new Floor(level, level * 50, () => {
    throw new Error("unexpected floor error");
  });
}

/** The same, in a building whose passengers name the floor they want. */
function dispatchFloor(level = 2): Floor {
  return new Floor(
    level,
    level * 50,
    () => {
      throw new Error("unexpected floor error");
    },
    true,
  );
}

/** A car that serves everything, with both indicators dark so a booking picked up on indicator state would be a bug. */
const ANY_CAR = { goingUpIndicator: false, goingDownIndicator: false, serves: () => true };

/** Reads a destination panel's chips; the overflow chip has no floor and falls back to its own text (e.g. "+2"). */
function drawnDestinations(
  element: HTMLElement,
): { floor: string; count: string | null; booked: boolean }[] {
  return [...element.querySelectorAll(".dest")].map((chip) => ({
    floor: (chip.querySelector(".dest-floor") ?? chip).textContent,
    count: chip.querySelector(".dest-count")?.textContent ?? null,
    booked: chip.classList.contains("is-booked"),
  }));
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
    // The engine tracks both directions on every floor; a missing lamp on an
    // end floor just isn't drawn.
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
    // The column is a flex stack; a floor that positioned itself would draw
    // through its neighbor.
    expect(view.element.style.top).toBe("");
  });
});

describe("a destination-dispatch floor's panel", () => {
  it("opens empty, with neither call lamp on the row", () => {
    const view = createFloorView(dispatchFloor(3), FLOOR_COUNT);

    expect(requireElement(".destinations", view.element).children.length).toBe(0);
    expect(view.element.querySelector("button.up")).toBeNull();
    expect(view.element.querySelector("button.down")).toBeNull();
  });

  it("opens with the journeys already standing on the floor", () => {
    // The panel is drawn from the book, not accumulated from events, so this
    // doesn't depend on when the view is created.
    const floor = dispatchFloor(0);
    floor.requestDestination(4);

    const view = createFloorView(floor, FLOOR_COUNT);

    expect(drawnDestinations(view.element)).toEqual([{ floor: "4", count: null, booked: false }]);
  });

  it("draws one chip per journey, lowest floor first, and counts only a crowd", () => {
    const floor = dispatchFloor(0);
    const view = createFloorView(floor, FLOOR_COUNT);

    floor.requestDestination(4);
    floor.requestDestination(1);
    floor.requestDestination(4);

    expect(drawnDestinations(view.element)).toEqual([
      { floor: "1", count: null, booked: false },
      { floor: "4", count: "2", booked: false },
    ]);
  });

  it("quiets a chip a car has been booked for, and lights it again when the car refuses", () => {
    const floor = dispatchFloor(0);
    const view = createFloorView(floor, FLOOR_COUNT);
    floor.requestDestination(4);

    floor.assignElevator(4, ANY_CAR);
    expect(drawnDestinations(view.element)).toEqual([{ floor: "4", count: null, booked: true }]);

    floor.destinationRefused(4);
    expect(drawnDestinations(view.element)).toEqual([{ floor: "4", count: null, booked: false }]);
  });

  it("counts down as people board, and drops the chip with the last of them", () => {
    const floor = dispatchFloor(0);
    const view = createFloorView(floor, FLOOR_COUNT);
    floor.requestDestination(4);
    floor.requestDestination(4);
    floor.assignElevator(4, ANY_CAR);

    floor.destinationBoarded(4);
    expect(drawnDestinations(view.element)).toEqual([{ floor: "4", count: null, booked: true }]);

    floor.destinationBoarded(4);
    expect(drawnDestinations(view.element)).toEqual([]);
  });

  it("draws a full panel without counting anything", () => {
    // Four is exactly the panel's two rows, so nothing is left to count; a cap
    // that started one journey early would swallow the fourth chip as "+1".
    const floor = dispatchFloor(0);
    const view = createFloorView(floor, FLOOR_COUNT);

    for (const destination of [4, 3, 2, 1]) {
      floor.requestDestination(destination);
    }

    expect(drawnDestinations(view.element)).toEqual([
      { floor: "1", count: null, booked: false },
      { floor: "2", count: null, booked: false },
      { floor: "3", count: null, booked: false },
      { floor: "4", count: null, booked: false },
    ]);
  });

  it("counts the journeys it has no room to draw instead of dropping them", () => {
    // Five destinations in a six-floor building reaches every other floor, so
    // the cap is reachable rather than theoretical.
    const floor = dispatchFloor(0);
    const view = createFloorView(floor, FLOOR_COUNT);

    for (const destination of [5, 4, 3, 2, 1]) {
      floor.requestDestination(destination);
    }

    expect(drawnDestinations(view.element)).toEqual([
      { floor: "1", count: null, booked: false },
      { floor: "2", count: null, booked: false },
      { floor: "3", count: null, booked: false },
      { floor: "+2", count: null, booked: false },
    ]);
  });

  it("draws no panel in a building whose passengers press buttons", () => {
    const view = createFloorView(fixtureFloor(2), FLOOR_COUNT);

    expect(view.element.querySelector(".destinations")).toBeNull();
    expect(view.element.querySelectorAll(".call").length).toBe(2);
  });
});

describe("floorTemplate", () => {
  it("draws the row, its number and its lamps in one box", () => {
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));
    expect(floor.className).toBe("floor");
    expect(floor.querySelector(".level-num")?.textContent).toBe("2");
    expect(floor.querySelectorAll(".calls .call").length).toBe(2);
  });

  it("leaves the lamp that could never light off each end floor", () => {
    // spawnUserRandomly never calls up from the roof or down from the lobby.
    const lobby = renderElement(floorTemplate(0, FLOOR_COUNT));
    expect(lobby.querySelector("button.up")).not.toBeNull();
    expect(lobby.querySelector("button.down")).toBeNull();

    const roof = renderElement(floorTemplate(FLOOR_COUNT - 1, FLOOR_COUNT));
    expect(roof.querySelector("button.up")).toBeNull();
    expect(roof.querySelector("button.down")).not.toBeNull();

    for (const level of [1, 2, FLOOR_COUNT - 2]) {
      const floor = renderElement(floorTemplate(level, FLOOR_COUNT));
      expect(floor.querySelector("button.up")).not.toBeNull();
      expect(floor.querySelector("button.down")).not.toBeNull();
    }
  });

  it("makes the call buttons real, labeled buttons", () => {
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
    // .calls is a flex column with its own gap; a stray text node between the
    // buttons would be a flex item of its own.
    const middle = renderElement(floorTemplate(1, FLOOR_COUNT)).querySelector(".calls");
    expect(middle?.childNodes.length).toBe(2);
    const lobby = renderElement(floorTemplate(0, FLOOR_COUNT)).querySelector(".calls");
    expect(lobby?.childNodes.length).toBe(1);
  });

  it("swaps both lamps for an empty destination panel when asked", () => {
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT, true));

    const panel = floor.querySelector(".calls");
    expect(panel?.className).toBe("calls destinations");
    expect(panel?.childNodes.length).toBe(0);
    expect(floor.querySelectorAll(".call").length).toBe(0);
  });

  it("keeps the destination panel out of the accessibility tree", () => {
    // The row's hover card already lists who is waiting and where; a label
    // here would repeat it.
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT, true));

    expect(floor.querySelector(".destinations")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the direction lamps unless a building asks for destinations", () => {
    // The destinations parameter defaults false, so buildings written before
    // dispatch existed are unaffected.
    const floor = renderElement(floorTemplate(2, FLOOR_COUNT));

    expect(floor.querySelector(".destinations")).toBeNull();
    expect(floor.querySelectorAll(".call").length).toBe(2);
  });
});

describe("the two names a floor can be renamed from", () => {
  it("hands the call buttons the very labels the relabeller writes back in", () => {
    // relabelWorld renames a floor already on screen by calling
    // floorCallUpLabel/floorCallDownLabel directly; this template must call the
    // same functions, or a renamed message key only takes effect on half a floor.
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
