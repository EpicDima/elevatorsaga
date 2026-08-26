// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { presentStageColumn, type StageColumnController } from "./stage-column.ts";

/** The column, the card inside it, and the levers a test has over both. */
interface Harness {
  readonly column: HTMLElement;
  readonly controller: StageColumnController;
  /** Resizes the box the column scrolls in, as a pane drag or a window resize would. */
  readonly resizeTo: (clientHeight: number) => void;
  /** Scrolls the column the way a player would, event and all. */
  readonly scrollTo: (top: number) => void;
  /** Fires the observer the column watches its own box with, if one was installed. */
  readonly observed: () => void;
}

/**
 * Mounts a column of `scrollHeight` in a box of `clientHeight`, with a lesson card
 * `lessonHeight` tall — zero for a level that has none, or for the fullscreen demo,
 * which hides the card with the lesson still inside it.
 *
 * jsdom lays nothing out, so every extent here is stubbed. `scrollTop` clamps like a real
 * scroll container: a controller that writes past the foot must still read back parked there.
 */
function setUp(options: {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly lessonHeight: number;
  readonly observing?: boolean;
}): Harness {
  const column = document.createElement("div");
  column.className = "stagearea";
  const lesson = document.createElement("div");
  lesson.className = "tutorial";
  column.append(lesson);
  document.body.replaceChildren(column);

  let clientHeight = options.clientHeight;
  let top = 0;
  Object.defineProperty(column, "scrollHeight", {
    value: options.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(column, "clientHeight", { configurable: true, get: () => clientHeight });
  Object.defineProperty(column, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, options.scrollHeight - clientHeight));
    },
  });
  Object.defineProperty(lesson, "offsetHeight", {
    value: options.lessonHeight,
    configurable: true,
  });

  let observed: (() => void) | undefined;
  if (options.observing === true) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed = callback;
        }
        observe(): void {
          // The one box is passed in already; nothing to record.
        }
      },
    );
  }

  const controller = presentStageColumn({ column, lesson });

  return {
    column,
    controller,
    resizeTo: (height) => {
      clientHeight = height;
      observed?.();
    },
    scrollTo: (value) => {
      column.scrollTop = value;
      column.dispatchEvent(new Event("scroll"));
    },
    observed: () => {
      observed?.();
    },
  };
}

describe("presentStageColumn", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("opens a lesson at its title, with the building below the fold", () => {
    const { column, controller } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 280,
    });
    column.scrollTop = 1000;

    controller.park();

    expect(column.scrollTop).toBe(0);
  });

  it("opens a level with no lesson at the lobby", () => {
    // The house draws ground-floor-last, so a building taller than the pane opens looking
    // at the roof — the wrong end of the one place the game happens.
    const { column, controller } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 0,
    });

    controller.park();

    expect(column.scrollTop).toBe(500);
  });

  it("opens at the lobby when the card is on the page but not on screen", () => {
    // The fullscreen demo keeps the lesson mounted and hides the card, so counting the
    // card's children (rather than measuring it) would park the demo at a card nobody sees.
    const { column, controller } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 0,
    });
    column.append(document.createElement("p"));

    controller.park();

    expect(column.scrollTop).toBe(500);
  });

  it("drops to the lobby on demand, from wherever the reader had got to", () => {
    const { column, controller, scrollTo } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 280,
    });
    scrollTo(120);

    controller.showGround();

    expect(column.scrollTop).toBe(500);
  });

  it("takes a tab stop exactly while there is somewhere to scroll to", () => {
    // A scroll port a keyboard can't reach is WCAG 2.1.1; so is a tab stop that goes nowhere.
    const short = setUp({ scrollHeight: 500, clientHeight: 500, lessonHeight: 0 });
    short.controller.park();
    expect(short.column.hasAttribute("tabindex")).toBe(false);

    const tall = setUp({ scrollHeight: 1000, clientHeight: 500, lessonHeight: 280 });
    tall.controller.park();
    expect(tall.column.tabIndex).toBe(0);
  });

  it("puts the lobby back when the pane it stands in changes size", () => {
    // A shorter pane leaves more to scroll, and the browser only clamps a scroll position
    // that has become too large — one that has become too small strands the view mid-building.
    const { column, controller, resizeTo } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 0,
      observing: true,
    });
    controller.park();
    expect(column.scrollTop).toBe(500);

    resizeTo(300);

    expect(column.scrollTop).toBe(700);
    expect(column.tabIndex).toBe(0);
  });

  it("leaves a resize alone while the lesson is being read", () => {
    const { column, resizeTo, scrollTo } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 280,
      observing: true,
    });
    scrollTo(120);

    resizeTo(300);

    expect(column.scrollTop).toBe(120);
  });

  it("counts a scroll that lands within a pixel of the foot as parked there", () => {
    // Rounding: a fractional column height means the foot is never exactly `scrollHeight`.
    const { column, resizeTo, scrollTo } = setUp({
      scrollHeight: 1000,
      clientHeight: 500,
      lessonHeight: 280,
      observing: true,
    });
    scrollTo(499);

    resizeTo(300);

    expect(column.scrollTop).toBe(700);
  });
});
