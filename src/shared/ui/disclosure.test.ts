// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createDisclosure } from "./disclosure.ts";

/**
 * Builds a trigger and panel wired into a disclosure, attached to the
 * document so an outside click can be dispatched on something other than
 * either of them.
 *
 * @returns The trigger, the panel, the disclosure, and an element that
 * counts as "outside" both.
 */
function setUp(): {
  trigger: HTMLButtonElement;
  panel: HTMLDivElement;
  outside: HTMLDivElement;
  disclosure: ReturnType<typeof createDisclosure>;
} {
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  const outside = document.createElement("div");
  document.body.append(trigger, panel, outside);
  const disclosure = createDisclosure(trigger, panel);
  return { trigger, panel, outside, disclosure };
}

/**
 * Dispatches a bubbling click on an element, the way a pointer click does.
 *
 * @param element - Element to click.
 */
function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("createDisclosure", () => {
  it("starts closed", () => {
    const { panel, trigger, disclosure } = setUp();

    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.isOpen()).toBe(false);
  });

  it("opens on a trigger click", () => {
    const { panel, trigger, disclosure } = setUp();

    click(trigger);

    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(disclosure.isOpen()).toBe(true);
  });

  it("closes again on a second trigger click", () => {
    const { panel, trigger } = setUp();

    click(trigger);
    click(trigger);

    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on a click outside the trigger and the panel", () => {
    const { panel, trigger, outside } = setUp();

    click(trigger);
    click(outside);

    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not close on a click inside the panel", () => {
    const { panel, trigger } = setUp();
    const link = document.createElement("a");
    panel.append(link);

    click(trigger);
    click(link);

    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape", () => {
    const { panel, trigger } = setUp();

    click(trigger);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("ignores a keydown for any other key", () => {
    const { panel, trigger } = setUp();

    click(trigger);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(panel.hidden).toBe(false);
  });

  it("close() closes it directly, for a caller such as a tile's own click handler", () => {
    const { panel, trigger, disclosure } = setUp();

    click(trigger);
    disclosure.close();

    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.isOpen()).toBe(false);
  });
});
