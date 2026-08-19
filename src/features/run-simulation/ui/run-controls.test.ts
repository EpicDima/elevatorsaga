// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentRunControls, runButtonsTemplate } from "./run-controls.ts";
import type { RunControlsOptions } from "./run-controls.ts";
import { requireElement } from "#shared/lib/dom.ts";

/**
 * Builds a `.runbuttons`-holding parent and mutable run-control options.
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
      challengeEnded: (): boolean => false,
      onStartStop: vi.fn(),
      onStartOver: vi.fn(),
      instantRunInProgress: (): boolean => false,
      onRunInstant: vi.fn(),
      ...overrides,
    },
  };
}

describe("runButtonsTemplate", () => {
  it("draws the three run buttons in one box, in the order they are read in", () => {
    const parent = document.createElement("div");
    parent.innerHTML = runButtonsTemplate();
    const buttons = [...(parent.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "startstop unselectable",
      "startover unselectable",
      "runinstant unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships the three with no label at all, for the presenter to write", () => {
    const parent = document.createElement("div");
    parent.innerHTML = runButtonsTemplate();
    const buttons = [...(parent.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.textContent)).toEqual(["", "", ""]);
  });
});

describe("presentRunControls", () => {
  it("labels the start button, Start over and Run instantly", () => {
    const { parent, options } = setUp();
    presentRunControls(parent, options);

    expect(requireElement(".startstop", parent).textContent).toBe("Start");
    expect(requireElement(".startover", parent).textContent).toBe("Start over");
    expect(requireElement(".runinstant", parent).textContent).toBe("Run instantly");
  });

  it("labels the instant-run button as crunching, and disables it, while a crunch is in progress", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);
    const runInstant = requireElement(".runinstant", parent);
    expect(runInstant.hasAttribute("disabled")).toBe(false);

    options.instantRunInProgress = (): boolean => true;
    presenter.update();

    expect(runInstant.textContent).toBe("Crunching...");
    expect(runInstant.hasAttribute("disabled")).toBe(true);

    options.instantRunInProgress = (): boolean => false;
    presenter.update();

    expect(runInstant.textContent).toBe("Run instantly");
    expect(runInstant.hasAttribute("disabled")).toBe(false);
  });

  it("shows Pause while running and Restart once the challenge is over", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);
    const startStop = requireElement(".startstop", parent);

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Pause");

    options.challengeEnded = (): boolean => true;
    presenter.update();
    expect(startStop.textContent).toBe(" Restart");
    expect(startStop.querySelector("svg")).not.toBeNull();
  });

  it("reports button presses to the caller", () => {
    const { parent, options } = setUp();
    presentRunControls(parent, options);

    requireElement(".startstop", parent).click();
    requireElement(".startover", parent).click();
    requireElement(".runinstant", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
    expect(options.onStartOver).toHaveBeenCalledTimes(1);
    expect(options.onRunInstant).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentRunControls(parent, options);

    for (let i = 0; i < 5; i += 1) {
      options.instantRunInProgress = (): boolean => i % 2 === 0;
      presenter.update();
    }
    requireElement(".startstop", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
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
