// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { CodeSlot } from "../model/code-slots.ts";
import { codeSlotsTemplate, presentCodeSlots } from "./code-slots.ts";
import { queryAll } from "#shared/lib/dom.ts";

describe("codeSlotsTemplate", () => {
  it("draws three buttons, marking the current one pressed", () => {
    const parent = document.createElement("div");
    parent.innerHTML = codeSlotsTemplate({ currentSlot: 2 });

    const buttons = queryAll(".codeslot", parent);
    expect(buttons.map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("labels each button with its own slot number", () => {
    const parent = document.createElement("div");
    parent.innerHTML = codeSlotsTemplate({ currentSlot: 1 });

    expect(
      queryAll(".codeslot", parent).map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Code slot 1", "Code slot 2", "Code slot 3"]);
  });
});

describe("presentCodeSlots", () => {
  it("draws three buttons, marking the open one", () => {
    const parent = document.createElement("div");
    presentCodeSlots(parent, { currentSlot: () => 2, onSelect: vi.fn() });

    const buttons = queryAll(".codeslot", parent);
    expect(buttons.map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("moves the mark to the new slot on the next update", () => {
    const parent = document.createElement("div");
    let currentSlot: CodeSlot = 1;
    const presenter = presentCodeSlots(parent, {
      currentSlot: () => currentSlot,
      onSelect: vi.fn(),
    });

    currentSlot = 3;
    presenter.update();

    expect(
      queryAll(".codeslot", parent).map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "false", "true"]);
  });

  it("reports the slot pressed, by position rather than by its label alone", () => {
    const parent = document.createElement("div");
    const onSelect = vi.fn();
    presentCodeSlots(parent, { currentSlot: () => 1, onSelect });

    queryAll(".codeslot", parent)[1]?.click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("goes on hearing clicks after being rebuilt by its own update", () => {
    // Every button is destroyed and rebuilt on `update`, unlike the run
    // controls' -- there is no single element a listener could be bound to
    // that survives every call, so the listener is bound to the parent
    // instead, once, and never has to be rebound.
    const parent = document.createElement("div");
    const onSelect = vi.fn();
    const presenter = presentCodeSlots(parent, { currentSlot: () => 1, onSelect });

    presenter.update();
    presenter.update();
    queryAll(".codeslot", parent)[2]?.click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("ignores a click that did not land on a slot button", () => {
    const parent = document.createElement("div");
    const onSelect = vi.fn();
    presentCodeSlots(parent, { currentSlot: () => 1, onSelect });

    parent.click();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
