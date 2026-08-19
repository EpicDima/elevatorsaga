// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  controlsTemplate,
  elevatorFloorButtonLabel,
  elevatorLabel,
  floorCallDownLabel,
  floorCallUpLabel,
} from "./templates.ts";
import { renderFragment } from "#shared/ui/markup.ts";

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

describe("controlsTemplate", () => {
  it("makes the time-scale controls real, labelled buttons", () => {
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
  });

  it("draws the three run buttons in one box, in the order they are read in", () => {
    // Not decoration: the row wraps on a narrow page, and loose in it the
    // three would break up one at a time. One box, so what drives the run
    // wraps as the cluster it is -- and so the speed, which is a setting
    // rather than a thing the player came for, stays on the far side of the
    // row. Reset/undo-reset moved to the editor pane's own codetools (see
    // `widgets/editor-pane`'s own tests) and are not drawn here any more.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "startstop unselectable",
      "startover unselectable",
      "runinstant unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships the three with no label at all, for the presenter to write", () => {
    // The region is drawn once for the life of the page, so a label baked in
    // here would still be in the language the page opened in after a change of
    // language. `presentControls.update` writes all three.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.textContent)).toEqual(["", "", ""]);
  });

  it("announces the speed as it changes, without interrupting", () => {
    // presentControls.update rewrites .timescale_value's text on every click of
    // the two speed buttons, which without aria-live would happen in perfect
    // silence for a screen reader -- the number changes and nothing is said.
    // Polite rather than assertive: a player holding a speed button down can
    // change it several times a second, and an assertive region interrupts
    // whatever is already being read to announce each one in turn.
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector(".timescale_value")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("the language the run controls come out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("names the speed controls", () => {
    setLocale("ru");
    const fragment = renderFragment(controlsTemplate());

    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Уменьшить скорость симуляции",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Увеличить скорость симуляции",
    );
  });
});
