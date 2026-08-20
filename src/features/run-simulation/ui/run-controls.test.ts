// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentRunControls, runButtonsTemplate } from "./run-controls.ts";
import type { RunControlsOptions } from "./run-controls.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { SPRITE_ICONS, type SpriteIconName } from "#shared/ui/icon.ts";

/**
 * Builds a `.runbox`-holding parent and mutable run-control options.
 *
 * @param overrides - Callbacks and data to replace the defaults with.
 * @returns The parent element and the options, both mutable.
 */
function setUp(overrides: Partial<RunControlsOptions> = {}): {
  parent: HTMLElement;
  options: {
    -readonly [Key in keyof RunControlsOptions]: RunControlsOptions[Key];
  } & { worldController: { isPaused: boolean } };
} {
  const parent = document.createElement("div");
  parent.innerHTML = runButtonsTemplate();
  return {
    parent,
    options: {
      worldController: { isPaused: true },
      levelEnded: (): boolean => false,
      runStarted: (): boolean => false,
      instantSpeed: (): boolean => false,
      instantRunInProgress: (): boolean => false,
      onStartStop: vi.fn(),
      onStartOver: vi.fn(),
      ...overrides,
    },
  };
}

/**
 * The glyph the primary button is currently showing, by its sprite name.
 *
 * Read back off the drawn path rather than off a class or a `data-` attribute,
 * because the sprite writes neither: a rendered icon is its own shape and
 * nothing else, so its `d` is the only thing that identifies it.
 *
 * @param parent - The element the markup was written into.
 * @returns The sprite's name, or `undefined` if it is neither of the two.
 */
function startStopGlyph(parent: HTMLElement): SpriteIconName | undefined {
  const drawn = requireElement(".startstop", parent).querySelector("path")?.getAttribute("d");
  return (["play", "pause"] as const).find(
    (name) => SPRITE_ICONS[name].shapes[0].attrs.d === drawn,
  );
}

describe("runButtonsTemplate", () => {
  it("draws the two run buttons in one box, in the order they are read in", () => {
    const parent = document.createElement("div");
    parent.innerHTML = runButtonsTemplate();
    const buttons = [...(parent.querySelector(".runbox")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "btn btn-primary startstop unselectable",
      "btn startover unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships both with a glyph and an empty label for the presenter to write", () => {
    const parent = document.createElement("div");
    parent.innerHTML = runButtonsTemplate();
    const buttons = [...(parent.querySelector(".runbox")?.children ?? [])];

    expect(buttons.map((button) => button.textContent)).toEqual(["", ""]);
    expect(buttons.every((button) => button.querySelector("svg") !== null)).toBe(true);
    expect(buttons.every((button) => button.querySelector(".lbl") !== null)).toBe(true);
  });
});

describe("presentRunControls", () => {
  it("labels both buttons, and gives Start over the title its label has no room for", () => {
    const { parent, options } = setUp();
    presentRunControls(parent, options);

    expect(requireElement(".startstop", parent).textContent).toBe("Start");
    expect(requireElement(".startover", parent).textContent).toBe("Start over");
    expect(requireElement(".startover", parent).title).toBe(
      "Start the run from the very beginning",
    );
  });

  it("says Start, Pause, Resume and Start again in the four states they mean", () => {
    // The word on the button is always what will happen, never what the run is
    // doing: "Pause" while it plays, "Resume" when it is standing still
    // part-way through, "Start" at either end of it.
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);
    const startStop = requireElement(".startstop", parent);

    expect(startStop.textContent).toBe("Start");
    expect(startStopGlyph(parent)).toBe("play");
    expect(startStop.title).toBe("");

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Pause");
    expect(startStopGlyph(parent)).toBe("pause");

    options.worldController.isPaused = true;
    options.runStarted = (): boolean => true;
    presenter.update();
    expect(startStop.textContent).toBe("Resume");
    expect(startStopGlyph(parent)).toBe("play");

    // The one state where "Start" needs saying twice: what it offers is to
    // throw away a result the player is still reading.
    options.levelEnded = (): boolean => true;
    presenter.update();
    expect(startStop.textContent).toBe("Start");
    expect(startStop.title).toBe("Run it again from the beginning");
  });

  it("never offers to resume while the speed control is on its instant stop", () => {
    // A crunch begins at the beginning -- `WorldController.start` runs the
    // player's `init` on its first unpaused frame -- so "Resume" would be a
    // promise the button cannot keep.
    const { parent, options } = setUp({ runStarted: (): boolean => true });
    const presenter = presentRunControls(parent, options);
    expect(requireElement(".startstop", parent).textContent).toBe("Resume");

    options.instantSpeed = (): boolean => true;
    presenter.update();

    expect(requireElement(".startstop", parent).textContent).toBe("Start");
  });

  it("says so on the primary button, and disables it, while a crunch is in progress", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);
    const startStop = requireElement(".startstop", parent);
    expect(startStop.hasAttribute("disabled")).toBe(false);

    options.instantRunInProgress = (): boolean => true;
    presenter.update();

    expect(startStop.textContent).toBe("Crunching...");
    expect(startStop.hasAttribute("disabled")).toBe(true);

    options.instantRunInProgress = (): boolean => false;
    presenter.update();

    expect(startStop.textContent).toBe("Start");
    expect(startStop.hasAttribute("disabled")).toBe(false);
  });

  it("does not read Pause over a run nothing is drawing", () => {
    // A crunch drives a private controller, so the shared one is paused
    // throughout one -- `!isPaused` alone would say the opposite.
    const { parent, options } = setUp({
      instantRunInProgress: (): boolean => true,
    });
    options.worldController.isPaused = false;
    presentRunControls(parent, options);

    expect(startStopGlyph(parent)).toBe("play");
  });

  it("leaves the glyph element alone when a redraw does not change it", () => {
    // A language change and a step of the speed both redraw this row, and
    // replacing the icon on each would throw away the element under a
    // pointer or a screen reader's cursor for no reason.
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);
    const icon = requireElement(".startstop", parent).querySelector("svg");

    presenter.update();
    presenter.update();

    expect(requireElement(".startstop", parent).querySelector("svg")).toBe(icon);
  });

  it("reports button presses to the caller", () => {
    const { parent, options } = setUp();
    presentRunControls(parent, options);

    requireElement(".startstop", parent).click();
    requireElement(".startover", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
    expect(options.onStartOver).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);

    for (let i = 0; i < 5; i += 1) {
      options.worldController.isPaused = i % 2 === 0;
      presenter.update();
    }
    options.worldController.isPaused = true;
    presenter.update();
    requireElement(".startstop", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
  });

  it("rewrites both labels when the language changes", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);

    setLocale("ru");
    try {
      presenter.update();
      expect(requireElement(".startstop", parent).textContent).toBe("Запустить");
      expect(requireElement(".startover", parent).textContent).toBe("Заново");
      expect(requireElement(".startover", parent).title).toBe("Начать прогон с самого начала");
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });

  it("keeps the element a keyboard player is standing on across an update", () => {
    // The whole point of the row being drawn once: pressing Start over
    // restarts the run, which used to delete the button that was pressed and
    // drop focus on <body>. Nothing here is rebuilt, so there is nothing to
    // restore.
    const { parent, options } = setUp();
    document.body.append(parent);
    const presenter = presentRunControls(parent, options);
    const startOver = requireElement(".startover", parent);
    startOver.focus();

    presenter.update();

    expect(document.activeElement).toBe(startOver);
  });

  it("lands focus on the start button when asked to", () => {
    const { parent, options } = setUp();
    document.body.append(parent);
    const presenter = presentRunControls(parent, options);

    presenter.focusStartStop();

    expect(document.activeElement).toBe(requireElement(".startstop", parent));
  });
});
