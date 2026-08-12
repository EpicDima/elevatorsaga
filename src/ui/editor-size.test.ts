// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  presentEditorSize,
  EDITOR_SIZE_ATTRIBUTE,
  EDITOR_SIZE_STORAGE_KEY,
  TALL_EDITOR,
} from "./editor-size.ts";
import { createElement, fullStorage, MemoryStorage } from "./test-helpers.ts";

/** The control, the page it marks, and the storage behind it. */
interface Harness {
  button: HTMLButtonElement;
  root: HTMLElement;
  storage: Storage;
}

/**
 * The control, wired over a fresh page.
 *
 * @param storage - Where the choice is remembered; an empty map by default.
 * @returns The button, the element it marks, and the store.
 */
function setUp(storage: Storage = new MemoryStorage()): Harness {
  const button = createElement("button");
  const root = createElement("html");
  document.body.replaceChildren(button);
  presentEditorSize({ button, root, storage });
  return { button, root, storage };
}

describe("presentEditorSize", () => {
  it("starts at the height the stylesheet ships", () => {
    const { button, root } = setUp();

    // No attribute at all rather than one saying "default": the shipped height
    // is the plain cascade, and a page nobody has touched should be indis-
    // tinguishable from a page without this control in it.
    expect(root.hasAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("expands the editor when the button is pressed", () => {
    const { button, root, storage } = setUp();

    button.click();

    expect(root.getAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(TALL_EDITOR);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(storage.getItem(EDITOR_SIZE_STORAGE_KEY)).toBe(TALL_EDITOR);
  });

  it("puts it back when the button is pressed again", () => {
    const { button, root, storage } = setUp();

    button.click();
    button.click();

    expect(root.hasAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    // Removed rather than written as some other word. What is left behind is
    // what the next visit reads, and a key holding "default" would have to mean
    // the same thing as no key at all forever after.
    expect(storage.getItem(EDITOR_SIZE_STORAGE_KEY)).toBeNull();
  });

  it("comes back expanded next visit", () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_SIZE_STORAGE_KEY, TALL_EDITOR);

    const { button, root } = setUp(storage);

    // Before any click: the whole point of remembering it is that the page
    // comes up at the height it was left at rather than growing into it.
    expect(root.getAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(TALL_EDITOR);
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("ignores a remembered value it does not recognise", () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_SIZE_STORAGE_KEY, "enormous");

    const { root } = setUp(storage);

    expect(root.hasAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(false);
  });

  it("still expands when the store refuses to remember", () => {
    // A full store, or Safari in private mode. The size may not survive the
    // tab; it has to change now, which is what the player asked for.
    const { button, root } = setUp(fullStorage());

    button.click();

    expect(root.getAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(TALL_EDITOR);
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("still comes up when the store cannot be read at all", () => {
    const storage: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };

    const { button, root } = setUp(storage);

    expect(root.hasAttribute(EDITOR_SIZE_ATTRIBUTE)).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
