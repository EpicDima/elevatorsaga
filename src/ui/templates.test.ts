// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  elevatorFloorButtonLabel,
  elevatorLabel,
  floorCallDownLabel,
  floorCallUpLabel,
} from "./templates.ts";

describe("the four names a drawn building can be renamed from", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("counts cars from one for the reader, from zero for the code", () => {
    // The conversion lives in the helper so that neither caller can do it, or
    // fail to do it, on its own: "Elevator 0" is not a car anybody can point at.
    expect(elevatorLabel(0)).toBe("Elevator 1");
    expect(elevatorLabel(3)).toBe("Elevator 4");
  });

  it("answers in the language active when it is asked, not when it was imported", () => {
    // The whole point of a helper rather than a constant: the building outlives
    // the language it was drawn in, and these are asked again to change it.
    expect(floorCallUpLabel(2)).toBe("Call an elevator going up from floor 2");

    setLocale("ru");

    expect(floorCallUpLabel(2)).toBe("Вызвать лифт вверх с этажа 2");
    expect(floorCallDownLabel(2)).toBe("Вызвать лифт вниз с этажа 2");
    expect(elevatorLabel(1)).toBe("Лифт 2");
    expect(elevatorFloorButtonLabel(7)).toBe("Ехать на этаж 7");
  });
});
