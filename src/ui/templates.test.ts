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

  it("counts cars from zero, the way the floors and the player's own array do", () => {
    expect(elevatorLabel(0)).toBe("Elevator 0");
    expect(elevatorLabel(3)).toBe("Elevator 3");
  });

  it("answers in the language active when it is asked, not when it was imported", () => {
    expect(floorCallUpLabel(2)).toBe("Call an elevator going up from floor 2");

    setLocale("ru");

    expect(floorCallUpLabel(2)).toBe("Вызвать лифт вверх с этажа 2");
    expect(floorCallDownLabel(2)).toBe("Вызвать лифт вниз с этажа 2");
    expect(elevatorLabel(1)).toBe("Лифт 1");
    expect(elevatorFloorButtonLabel(7)).toBe("Ехать на этаж 7");
  });
});
