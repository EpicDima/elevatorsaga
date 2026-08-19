// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT_MODE,
  DEFAULT_SPLIT_PERCENT,
  LAYOUT_MODE_STORAGE_KEY,
  SPLIT_PERCENT_STORAGE_KEY,
} from "../model/layout-mode.ts";
import {
  buildWorkspaceLayoutSkeleton,
  presentWorkspaceLayout,
  SPLIT_PERCENT_PROPERTY,
  type WorkspaceLayoutElements,
} from "./workspace-layout.ts";
import { fullStorage, MemoryStorage } from "../../../ui/test-helpers.ts";

/** The `aria-label` text a test builds the skeleton with. */
const LABELS = {
  gamePane: "Симуляция",
  codePane: "Редактор кода",
  splitter: "Ширина редактора",
};

/**
 * A pointer event jsdom does not have.
 *
 * Kept local rather than shared: it is a small, single-purpose stand-in for
 * one API jsdom does not implement, not an abstraction.
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

/** The skeleton, the page it writes onto, and the store, wired and ready. */
interface Harness {
  elements: WorkspaceLayoutElements;
  root: HTMLElement;
  storage: Storage;
  setLayoutMode: (mode: "right" | "left" | "code" | "game") => void;
  /** The split percentage currently applied to `root`. */
  split: () => number;
  /** Presses the pointer on the splitter and drags it to an absolute x. */
  dragTo: (clientX: number, options?: { readonly release?: boolean }) => void;
  /** Presses a key on the splitter. */
  press: (key: string, init?: KeyboardEventInit) => void;
}

/**
 * Mounts the workspace layout over a workspace of a given pixel width.
 *
 * jsdom lays nothing out, so the workspace's box is stood in for by a fixed
 * `DOMRect`.
 *
 * @param options - The width to lay the workspace out at, and the store to
 * read/write; both default to values chosen so the shipped default split
 * (62%) sits well inside the reachable range.
 * @returns The harness.
 */
function setUp(options: { readonly width?: number; readonly storage?: Storage } = {}): Harness {
  const width = options.width ?? 1200;
  const storage = options.storage ?? new MemoryStorage();

  const root = document.createElement("html");
  const elements = buildWorkspaceLayoutSkeleton(document, LABELS);
  document.body.replaceChildren(elements.workspace);

  Object.defineProperty(elements.workspace, "clientWidth", { value: width, configurable: true });
  elements.workspace.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, width, 600);

  // jsdom has no pointer capture; a pair that remembers the last id is enough
  // to exercise both the release and the branch that skips it.
  let captured: number | null = null;
  elements.splitter.setPointerCapture = (pointerId: number): void => {
    captured = pointerId;
  };
  elements.splitter.hasPointerCapture = (pointerId: number): boolean => captured === pointerId;
  elements.splitter.releasePointerCapture = (): void => {
    captured = null;
  };

  const { setLayoutMode } = presentWorkspaceLayout({ elements, root, storage });

  const split = (): number => {
    const value = root.style.getPropertyValue(SPLIT_PERCENT_PROPERTY);
    return Number.parseFloat(value.replace("%", ""));
  };

  const dragTo = (clientX: number, dragOptions: { readonly release?: boolean } = {}): void => {
    elements.splitter.dispatchEvent(new FakePointerEvent("pointerdown", { clientX: 0, button: 0 }));
    elements.splitter.dispatchEvent(new FakePointerEvent("pointermove", { clientX }));
    if (dragOptions.release !== false) {
      elements.splitter.dispatchEvent(new FakePointerEvent("pointerup", { clientX }));
    }
  };

  const press = (key: string, init: KeyboardEventInit = {}): void => {
    elements.splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key, cancelable: true, ...init }),
    );
  };

  return { elements, root, storage, setLayoutMode, split, dragTo, press };
}

describe("buildWorkspaceLayoutSkeleton", () => {
  it("builds the workspace, both panes and the splitter with their labels", () => {
    const { workspace, gamePane, codePane, splitter } = buildWorkspaceLayoutSkeleton(
      document,
      LABELS,
    );

    expect(workspace.className).toBe("workspace");
    expect([...workspace.children]).toEqual([gamePane, splitter, codePane]);

    expect(gamePane.className).toBe("pane pane-game");
    expect(gamePane.getAttribute("aria-label")).toBe(LABELS.gamePane);
    expect(codePane.className).toBe("pane pane-code");
    expect(codePane.getAttribute("aria-label")).toBe(LABELS.codePane);

    expect(splitter.className).toBe("splitter");
    expect(splitter.getAttribute("role")).toBe("separator");
    expect(splitter.getAttribute("aria-orientation")).toBe("vertical");
    expect(splitter.getAttribute("aria-label")).toBe(LABELS.splitter);
    expect(splitter.tabIndex).toBe(0);
  });

  it("builds both panes empty", () => {
    const { gamePane, codePane } = buildWorkspaceLayoutSkeleton(document, LABELS);

    expect(gamePane.childNodes).toHaveLength(0);
    expect(codePane.childNodes).toHaveLength(0);
  });
});

describe("presentWorkspaceLayout", () => {
  it("applies the shipped default mode and split when nothing is remembered", () => {
    const { root, split, elements } = setUp();

    expect(root.dataset["layout"]).toBe(DEFAULT_LAYOUT_MODE);
    expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    expect(elements.splitter.getAttribute("aria-valuenow")).toBe(String(DEFAULT_SPLIT_PERCENT));
  });

  it("does not write to storage just from being mounted", () => {
    const { storage } = setUp();

    expect(storage.getItem(LAYOUT_MODE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBeNull();
  });

  it("restores a remembered mode and split", () => {
    const storage = new MemoryStorage();
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, "code");
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, "45");

    const { root, split } = setUp({ storage });

    expect(root.dataset["layout"]).toBe("code");
    expect(split()).toBe(45);
  });

  it("clamps a remembered split that no longer fits the window", () => {
    const storage = new MemoryStorage();
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, "5");

    // 380 / 400 * 100 = 95, capped to 40, so the reachable range is [40, 60].
    const { split } = setUp({ storage, width: 400 });

    expect(split()).toBe(40);
  });

  describe("setLayoutMode", () => {
    it("switches the mode and persists it", () => {
      const { root, storage, setLayoutMode } = setUp();

      setLayoutMode("game");

      expect(root.dataset["layout"]).toBe("game");
      expect(storage.getItem(LAYOUT_MODE_STORAGE_KEY)).toBe("game");
    });

    it("mirrors the split across a right/left swap", () => {
      const { split, setLayoutMode } = setUp();

      setLayoutMode("left");

      expect(split()).toBe(100 - DEFAULT_SPLIT_PERCENT);
    });

    it("does nothing when asked for the mode already active", () => {
      const { storage, setLayoutMode } = setUp();

      setLayoutMode(DEFAULT_LAYOUT_MODE);

      expect(storage.getItem(LAYOUT_MODE_STORAGE_KEY)).toBeNull();
    });
  });

  describe("dragging the splitter", () => {
    it("moves the split to the pointer's position across the workspace", () => {
      const { split, dragTo } = setUp({ width: 1200 });

      // 40% across a 1200px workspace starting at x = 0.
      dragTo(480);

      expect(split()).toBeCloseTo(40);
    });

    it("persists only once the drag ends", () => {
      const { storage, dragTo } = setUp({ width: 1200 });

      dragTo(480, { release: false });
      expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBeNull();

      dragTo(480);
      expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).not.toBeNull();
    });

    it("stops at the reachable range and reports the end it stopped at", () => {
      const { split, elements, dragTo } = setUp({ width: 1200 });

      dragTo(1200 * 2);

      // 380 / 1200 * 100 ≈ 31.67, so the reachable high end is 100 minus that.
      const high = 100 - (380 / 1200) * 100;
      expect(split()).toBeCloseTo(high);
      expect(elements.splitter.getAttribute("aria-valuenow")).toBe(String(Math.round(high)));
    });

    it("ends the drag when the browser takes the gesture away", () => {
      const { split, elements } = setUp({ width: 1200 });

      elements.splitter.dispatchEvent(
        new FakePointerEvent("pointerdown", { clientX: 0, button: 0 }),
      );
      elements.splitter.dispatchEvent(new FakePointerEvent("pointercancel", { clientX: 480 }));
      elements.splitter.dispatchEvent(new FakePointerEvent("pointermove", { clientX: 900 }));

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });

    it("leaves the secondary button to the browser", () => {
      const { split, elements } = setUp({ width: 1200 });

      elements.splitter.dispatchEvent(
        new FakePointerEvent("pointerdown", { clientX: 0, button: 2 }),
      );
      elements.splitter.dispatchEvent(new FakePointerEvent("pointermove", { clientX: 900 }));

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });

    it("leaves a non-primary pointer to the browser", () => {
      const { split, elements } = setUp({ width: 1200 });

      elements.splitter.dispatchEvent(
        new FakePointerEvent("pointerdown", { clientX: 0, button: 0, isPrimary: false }),
      );
      elements.splitter.dispatchEvent(new FakePointerEvent("pointermove", { clientX: 900 }));

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });
  });

  describe("keyboard resize", () => {
    it("steps the split on the arrow keys and persists each step", () => {
      const { split, storage, press } = setUp();

      press("ArrowRight");
      press("ArrowRight");

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT + 4);
      expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBe(String(DEFAULT_SPLIT_PERCENT + 4));

      press("ArrowLeft");

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT + 2);
    });

    it("leaves a modified arrow key to the browser", () => {
      const { split, press } = setUp();

      press("ArrowRight", { altKey: true });
      press("ArrowRight", { ctrlKey: true });
      press("ArrowRight", { metaKey: true });
      press("ArrowRight", { shiftKey: true });

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });

    it("leaves every other key to the browser", () => {
      const { split, press } = setUp();

      press("Tab");
      press("Enter");

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });
  });

  describe("double-click", () => {
    it("returns the split to the mode's default", () => {
      const { split, dragTo, elements } = setUp({ width: 1200 });

      dragTo(120);
      expect(split()).not.toBe(DEFAULT_SPLIT_PERCENT);

      elements.splitter.dispatchEvent(new MouseEvent("dblclick"));

      expect(split()).toBe(DEFAULT_SPLIT_PERCENT);
    });

    it("returns to the mirrored default while in left mode", () => {
      const { split, setLayoutMode, dragTo, elements } = setUp({ width: 1200 });

      setLayoutMode("left");
      dragTo(120);
      expect(split()).not.toBe(100 - DEFAULT_SPLIT_PERCENT);

      elements.splitter.dispatchEvent(new MouseEvent("dblclick"));

      expect(split()).toBe(100 - DEFAULT_SPLIT_PERCENT);
    });

    it("persists the reset", () => {
      const { storage, elements } = setUp();

      elements.splitter.dispatchEvent(new MouseEvent("dblclick"));

      expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBe(String(DEFAULT_SPLIT_PERCENT));
    });
  });

  it("still resizes when the store refuses to remember", () => {
    const { split, press } = setUp({ storage: fullStorage() });

    press("ArrowRight");

    expect(split()).toBe(DEFAULT_SPLIT_PERCENT + 2);
  });
});
