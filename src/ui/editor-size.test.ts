// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  applyStoredEditorHeight,
  presentEditorResize,
  EDITOR_HEIGHT_PAGE_STEP,
  EDITOR_HEIGHT_PROPERTY,
  EDITOR_HEIGHT_STEP,
  EDITOR_HEIGHT_STORAGE_KEY,
  LEGACY_EDITOR_SIZE_STORAGE_KEY,
  MAX_EDITOR_HEIGHT_RATIO,
  MIN_EDITOR_HEIGHT,
} from "./editor-size.ts";
import { createElement, fullStorage, MemoryStorage } from "./test-helpers.ts";

/** The height the stylesheet ships, which the fake box reports until one is chosen. */
const SHIPPED_HEIGHT = 320;

/** jsdom's window is 768px tall, so this is what the grip may be dragged to. */
const MAX_HEIGHT = Math.round(768 * MAX_EDITOR_HEIGHT_RATIO);

/**
 * A pointer event jsdom does not have.
 *
 * jsdom implements no `PointerEvent`, and the handlers read three properties a
 * `MouseEvent` does not carry. Extending it rather than faking the whole thing
 * keeps `clientY`, `button` and `preventDefault` real, which is most of what is
 * under test here.
 */
class FakePointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;

  constructor(type: string, init: MouseEventInit & { pointerId?: number; isPrimary?: boolean }) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}

/** The grip, the box it resizes, the page it writes on, and the store. */
interface Harness {
  handle: HTMLElement;
  root: HTMLElement;
  storage: Storage;
  /** The height the fake box currently reports. */
  height: () => number;
  /** Presses the pointer on the grip and drags it by `by` pixels. */
  drag: (by: number, options?: { readonly release?: boolean }) => void;
  /** Presses a key on the grip. */
  press: (key: string, init?: KeyboardEventInit) => void;
}

/**
 * The grip, wired over a fake editor whose box follows the chosen height.
 *
 * jsdom lays nothing out, so `getBoundingClientRect` is stood in for by a
 * function that reads the property the module writes — which is what the
 * cascade does in the page, and what makes a second arrow key move on from
 * where the first one left off rather than from the shipped height again.
 *
 * @param storage - Where the height is remembered; an empty map by default.
 * @returns The grip and the handles a test needs to drive it.
 */
function setUp(storage: Storage = new MemoryStorage()): Harness {
  const handle = createElement("div");
  const editor = createElement("div");
  const root = createElement("html");
  document.body.replaceChildren(handle, editor);

  const height = (): number => {
    const chosen = root.style.getPropertyValue(EDITOR_HEIGHT_PROPERTY);
    return chosen === "" ? SHIPPED_HEIGHT : Number.parseFloat(chosen);
  };
  editor.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 600, height());

  // jsdom has no pointer capture either. The grip only ever asks the element it
  // is on, so a pair that remembers the last id is enough to exercise both the
  // release and the branch that skips it.
  let captured: number | null = null;
  handle.setPointerCapture = (pointerId: number): void => {
    captured = pointerId;
  };
  handle.hasPointerCapture = (pointerId: number): boolean => captured === pointerId;
  handle.releasePointerCapture = (): void => {
    captured = null;
  };

  presentEditorResize({ handle, editor, root, storage });

  const drag = (by: number, options: { readonly release?: boolean } = {}): void => {
    handle.dispatchEvent(new FakePointerEvent("pointerdown", { clientY: 400, button: 0 }));
    handle.dispatchEvent(new FakePointerEvent("pointermove", { clientY: 400 + by }));
    if (options.release !== false) {
      handle.dispatchEvent(new FakePointerEvent("pointerup", { clientY: 400 + by }));
    }
  };

  const press = (key: string, init: KeyboardEventInit = {}): void => {
    handle.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));
  };

  return { handle, root, storage, height, drag, press };
}

describe("applyStoredEditorHeight", () => {
  it("leaves the shipped height alone when nobody has chosen one", () => {
    const root = createElement("html");

    // No property at all rather than one holding the shipped figure: the height
    // nobody chose is the plain cascade, media query and all, and a page nobody
    // has touched should be indistinguishable from a page without this control.
    expect(applyStoredEditorHeight(root, new MemoryStorage())).toBeNull();
    expect(root.style.getPropertyValue(EDITOR_HEIGHT_PROPERTY)).toBe("");
  });

  it("comes back at the remembered height", () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_HEIGHT_STORAGE_KEY, "420");
    const root = createElement("html");

    expect(applyStoredEditorHeight(root, storage)).toBe(420);
    expect(root.style.getPropertyValue(EDITOR_HEIGHT_PROPERTY)).toBe("420px");
  });

  it("holds a remembered height inside the range this window allows", () => {
    const storage = new MemoryStorage();
    // Chosen on a taller screen, or edited by hand. Either way it is not a
    // reason to hand this window an editor it cannot show.
    storage.setItem(EDITOR_HEIGHT_STORAGE_KEY, "5000");
    const root = createElement("html");

    expect(applyStoredEditorHeight(root, storage)).toBe(MAX_HEIGHT);
  });

  it("ignores a remembered value that is not a height", () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_HEIGHT_STORAGE_KEY, "enormous");
    const root = createElement("html");

    expect(applyStoredEditorHeight(root, storage)).toBeNull();
    expect(root.style.getPropertyValue(EDITOR_HEIGHT_PROPERTY)).toBe("");
  });

  it("carries the Expand button's tall editor over to the grip", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_EDITOR_SIZE_STORAGE_KEY, "tall");
    const root = createElement("html");

    // What the retired button's `max(var(--editor-height), 70vh)` came to in a
    // 768px window. A player who expanded the editor last visit finds it that
    // tall this visit, with the control that got it there replaced underneath.
    expect(applyStoredEditorHeight(root, storage)).toBe(538);
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
    const root = createElement("html");

    expect(applyStoredEditorHeight(root, storage)).toBeNull();
  });
});

describe("presentEditorResize", () => {
  it("reports the height the editor is at before anybody touches it", () => {
    const { handle } = setUp();

    expect(handle.getAttribute("aria-valuenow")).toBe(String(SHIPPED_HEIGHT));
    expect(handle.getAttribute("aria-valuemin")).toBe(String(MIN_EDITOR_HEIGHT));
    expect(handle.getAttribute("aria-valuemax")).toBe(String(MAX_HEIGHT));
  });

  it("grows the editor as the grip is dragged down", () => {
    const { handle, height, storage, drag } = setUp();

    drag(140);

    expect(height()).toBe(SHIPPED_HEIGHT + 140);
    expect(handle.getAttribute("aria-valuenow")).toBe(String(SHIPPED_HEIGHT + 140));
    expect(storage.getItem(EDITOR_HEIGHT_STORAGE_KEY)).toBe(String(SHIPPED_HEIGHT + 140));
  });

  it("shrinks it as the grip is dragged up", () => {
    const { height, drag } = setUp();

    drag(-100);

    expect(height()).toBe(SHIPPED_HEIGHT - 100);
  });

  it("stops at the ends of the range, and says which end it stopped at", () => {
    const { handle, height, drag } = setUp();

    drag(4000);

    expect(height()).toBe(MAX_HEIGHT);
    // The value reported is the height that was applied and not the one that was
    // asked for, so a drag past the end announces the end rather than a number
    // the editor never reached.
    expect(handle.getAttribute("aria-valuenow")).toBe(String(MAX_HEIGHT));

    drag(-4000);

    expect(height()).toBe(MIN_EDITOR_HEIGHT);
  });

  it("goes on resizing while the pointer is down and stops when it is up", () => {
    const { handle, height, drag } = setUp();

    drag(60, { release: false });
    handle.dispatchEvent(new FakePointerEvent("pointermove", { clientY: 500 }));

    expect(height()).toBe(SHIPPED_HEIGHT + 100);

    handle.dispatchEvent(new FakePointerEvent("pointerup", { clientY: 500 }));
    handle.dispatchEvent(new FakePointerEvent("pointermove", { clientY: 700 }));

    expect(height()).toBe(SHIPPED_HEIGHT + 100);
  });

  it("ends the drag when the browser takes the gesture away", () => {
    // A touch the browser claims for a scroll fires `pointercancel` and no
    // `pointerup`. Without this the grip would still be dragging the next time
    // a finger crossed it.
    const { handle, height } = setUp();

    handle.dispatchEvent(new FakePointerEvent("pointerdown", { clientY: 400, button: 0 }));
    handle.dispatchEvent(new FakePointerEvent("pointercancel", { clientY: 400 }));
    handle.dispatchEvent(new FakePointerEvent("pointermove", { clientY: 600 }));

    expect(height()).toBe(SHIPPED_HEIGHT);
  });

  it("leaves the secondary button to the browser", () => {
    const { handle, height } = setUp();

    handle.dispatchEvent(new FakePointerEvent("pointerdown", { clientY: 400, button: 2 }));
    handle.dispatchEvent(new FakePointerEvent("pointermove", { clientY: 600 }));

    expect(height()).toBe(SHIPPED_HEIGHT);
  });

  it("moves a line at a time on the arrow keys", () => {
    const { height, storage, press } = setUp();

    press("ArrowDown");
    press("ArrowDown");

    expect(height()).toBe(SHIPPED_HEIGHT + 2 * EDITOR_HEIGHT_STEP);
    expect(storage.getItem(EDITOR_HEIGHT_STORAGE_KEY)).toBe(
      String(SHIPPED_HEIGHT + 2 * EDITOR_HEIGHT_STEP),
    );

    press("ArrowUp");

    expect(height()).toBe(SHIPPED_HEIGHT + EDITOR_HEIGHT_STEP);
  });

  it("moves five at a time on Page Up and Page Down", () => {
    const { height, press } = setUp();

    press("PageDown");

    expect(height()).toBe(SHIPPED_HEIGHT + EDITOR_HEIGHT_PAGE_STEP);

    press("PageUp");
    press("PageUp");

    expect(height()).toBe(SHIPPED_HEIGHT - EDITOR_HEIGHT_PAGE_STEP);
  });

  it("goes to either end on Home and End", () => {
    const { height, press } = setUp();

    press("End");

    expect(height()).toBe(MAX_HEIGHT);

    press("Home");

    expect(height()).toBe(MIN_EDITOR_HEIGHT);
  });

  it("leaves a modified arrow key to the browser", () => {
    // Alt-Left is Back, and every one of these is somebody's shortcut. A grip
    // that swallowed them would be taking keys it was never given.
    const { height, press } = setUp();

    press("ArrowDown", { altKey: true });
    press("ArrowDown", { ctrlKey: true });
    press("ArrowDown", { metaKey: true });
    press("ArrowDown", { shiftKey: true });

    expect(height()).toBe(SHIPPED_HEIGHT);
  });

  it("leaves Tab alone so the focus can move on", () => {
    const { press } = setUp();

    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    document.body.querySelector("div")?.dispatchEvent(tab);
    press("Tab");

    expect(tab.defaultPrevented).toBe(false);
  });

  it("gives the shipped height back on a double click", () => {
    const { handle, root, storage, height, drag } = setUp();
    drag(200);

    handle.dispatchEvent(new MouseEvent("dblclick"));

    // Back to no choice at all rather than to 320px written down: the shipped
    // height is a media query away from being a different number on the next
    // screen, and only the absent property lets it go on being one.
    expect(root.style.getPropertyValue(EDITOR_HEIGHT_PROPERTY)).toBe("");
    expect(storage.getItem(EDITOR_HEIGHT_STORAGE_KEY)).toBeNull();
    expect(height()).toBe(SHIPPED_HEIGHT);
    expect(handle.getAttribute("aria-valuenow")).toBe(String(SHIPPED_HEIGHT));
  });

  it("still resizes when the store refuses to remember", () => {
    // A full store, or Safari in private mode. The height may not survive the
    // tab; it has to change now, which is what the player asked for.
    const { height, drag } = setUp(fullStorage());

    drag(120);

    expect(height()).toBe(SHIPPED_HEIGHT + 120);
  });
});
