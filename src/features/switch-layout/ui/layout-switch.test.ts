// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  buildLayoutSwitchSkeleton,
  presentLayoutSwitch,
  type LayoutSwitchElements,
  type LayoutSwitchLabels,
} from "./layout-switch.ts";

const LABELS: LayoutSwitchLabels = {
  group: "Layout",
  buttons: { left: "Code left", right: "Code right", code: "Code only", game: "Building only" },
};

function baseElements(): LayoutSwitchElements {
  return buildLayoutSwitchSkeleton(document, LABELS);
}

describe("buildLayoutSwitchSkeleton", () => {
  it("labels the group and titles the four buttons", () => {
    const elements = baseElements();

    expect(elements.group.getAttribute("role")).toBe("group");
    expect(elements.group.getAttribute("aria-label")).toBe("Layout");
    expect(elements.left.title).toBe("Code left");
    expect(elements.right.title).toBe("Code right");
    expect(elements.code.title).toBe("Code only");
    expect(elements.game.title).toBe("Building only");
  });

  it("mirrors each button's title onto its aria-label", () => {
    const elements = baseElements();

    for (const button of [elements.left, elements.right, elements.code, elements.game]) {
      expect(button.getAttribute("aria-label")).toBe(button.title);
    }
  });

  it("marks each button with its own data-layout-btn and an explicit type", () => {
    const elements = baseElements();

    expect(elements.left.getAttribute("data-layout-btn")).toBe("left");
    expect(elements.right.getAttribute("data-layout-btn")).toBe("right");
    expect(elements.code.getAttribute("data-layout-btn")).toBe("code");
    expect(elements.game.getAttribute("data-layout-btn")).toBe("game");
    for (const button of [elements.left, elements.right, elements.code, elements.game]) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("draws exactly one icon into each button", () => {
    const elements = baseElements();

    for (const button of [elements.left, elements.right, elements.code, elements.game]) {
      expect(button.querySelectorAll("svg.ds-icon")).toHaveLength(1);
    }
  });

  it("nests the four buttons inside the group, in left/right/code/game order", () => {
    const elements = baseElements();

    expect([...elements.group.children]).toEqual([
      elements.left,
      elements.right,
      elements.code,
      elements.game,
    ]);
  });
});

describe("presentLayoutSwitch", () => {
  it("marks the initial mode pressed and leaves the others unpressed", () => {
    const elements = baseElements();

    presentLayoutSwitch({ elements, initialMode: "code", onSelect: () => undefined });

    expect(elements.left.getAttribute("aria-pressed")).toBe("false");
    expect(elements.right.getAttribute("aria-pressed")).toBe("false");
    expect(elements.code.getAttribute("aria-pressed")).toBe("true");
    expect(elements.game.getAttribute("aria-pressed")).toBe("false");
  });

  it("marks the clicked button pressed and reports the mode it chose", () => {
    const elements = baseElements();
    const selected: string[] = [];

    presentLayoutSwitch({
      elements,
      initialMode: "left",
      onSelect: (mode) => selected.push(mode),
    });
    elements.game.click();

    expect(selected).toEqual(["game"]);
    expect(elements.game.getAttribute("aria-pressed")).toBe("true");
    expect(elements.left.getAttribute("aria-pressed")).toBe("false");
  });

  it("does not call onSelect for setActiveMode", () => {
    const elements = baseElements();
    const selected: string[] = [];

    const controller = presentLayoutSwitch({
      elements,
      initialMode: "left",
      onSelect: (mode) => selected.push(mode),
    });
    controller.setActiveMode("right");

    expect(selected).toEqual([]);
    expect(elements.right.getAttribute("aria-pressed")).toBe("true");
    expect(elements.left.getAttribute("aria-pressed")).toBe("false");
  });

  describe("setActiveMode", () => {
    it("re-marks which button is pressed", () => {
      const elements = baseElements();

      const controller = presentLayoutSwitch({
        elements,
        initialMode: "left",
        onSelect: () => undefined,
      });
      controller.setActiveMode("code");

      expect(elements.left.getAttribute("aria-pressed")).toBe("false");
      expect(elements.code.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
