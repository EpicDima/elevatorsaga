// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { formatTimeScale, presentSpeedStepper, speedStepperTemplate } from "./speed-stepper.ts";
import type { SpeedStepperOptions } from "./speed-stepper.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";

/** Builds a `.speed`-holding parent and mutable speed-control options. */
function setUp(overrides: Partial<SpeedStepperOptions> = {}): {
  parent: HTMLElement;
  options: {
    -readonly [Key in keyof SpeedStepperOptions]: SpeedStepperOptions[Key];
  } & { worldController: { timeScale: number } };
} {
  const parent = document.createElement("div");
  parent.innerHTML = speedStepperTemplate();
  return {
    parent,
    options: {
      worldController: { timeScale: 2 },
      instantSpeed: () => false,
      instantAvailable: () => true,
      instantRunInProgress: () => false,
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
      ...overrides,
    },
  };
}

describe("speedStepperTemplate", () => {
  it("makes the two arrows real buttons, with a glyph each", () => {
    const parent = document.createElement("div");
    parent.innerHTML = speedStepperTemplate();

    // Names are `presentSpeedStepper`'s to write, not the template's.
    for (const selector of ["button.speed-down", "button.speed-up"]) {
      const button = parent.querySelector(selector);
      expect(button?.getAttribute("type")).toBe("button");
      expect(button?.querySelector("svg")).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBeNull();
    }
  });

  it("names the pair once, on the group, rather than twice over on the arrows", () => {
    const parent = document.createElement("div");
    parent.innerHTML = speedStepperTemplate();

    expect(parent.querySelector(".speed")?.getAttribute("role")).toBe("group");
  });

  it("announces the speed as it changes, without interrupting", () => {
    const parent = document.createElement("div");
    parent.innerHTML = speedStepperTemplate();

    expect(parent.querySelector(".speed-val")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("presentSpeedStepper", () => {
  it("draws the current speed, and names the group and both arrows", () => {
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    expect(requireElement(".speed-val", parent).textContent).toBe("2x");
    expect(requireElement(".speed", parent).getAttribute("aria-label")).toBe("Run speed");
    expect(requireElement(".speed-down", parent).getAttribute("aria-label")).toBe("Slower");
    expect(requireElement(".speed-up", parent).getAttribute("aria-label")).toBe("Faster");
  });

  it("says on each arrow, in its title, what it says in its name", () => {
    // A pointer has no other way to ask what a bare chevron does.
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    for (const selector of [".speed-down", ".speed-up"]) {
      const button = requireElement(selector, parent);
      expect(button.title).toBe(button.getAttribute("aria-label"));
    }
  });

  it("explains the reading in its own title", () => {
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    expect(requireElement(".speed-val", parent).title).toBe("Run speed: 2x");
  });

  it("reports button presses to the caller", () => {
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    requireElement(".speed-up", parent).click();
    requireElement(".speed-down", parent).click();

    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleDecrease).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentSpeedStepper(parent, options);

    for (let i = 1; i <= 5; i += 1) {
      options.worldController.timeScale = i;
      presenter.update();
    }
    requireElement(".speed-up", parent).click();

    expect(requireElement(".speed-val", parent).textContent).toBe("5x");
    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
  });

  it("dims `-` at the bottom of the ladder and `+` at the top of the control", () => {
    const { parent, options } = setUp();
    const presenter = presentSpeedStepper(parent, options);
    const decrease = requireElement(".speed-down", parent);
    const increase = requireElement(".speed-up", parent);

    expect(decrease.hasAttribute("disabled")).toBe(false);
    expect(increase.hasAttribute("disabled")).toBe(false);

    options.worldController.timeScale = 1;
    presenter.update();
    expect(decrease.hasAttribute("disabled")).toBe(true);

    // 20x is the ladder's top, not the control's: the instant stop is one press further on.
    options.worldController.timeScale = 20;
    presenter.update();
    expect(decrease.hasAttribute("disabled")).toBe(false);
    expect(increase.hasAttribute("disabled")).toBe(false);
  });

  it("ends the ladder at the fastest speed where the instant stop is not on offer", () => {
    const { parent, options } = setUp({ instantAvailable: () => false });
    const presenter = presentSpeedStepper(parent, options);
    const increase = requireElement(".speed-up", parent);

    expect(increase.hasAttribute("disabled")).toBe(false);

    options.worldController.timeScale = 20;
    presenter.update();
    expect(increase.hasAttribute("disabled")).toBe(true);
    // Only `+` is affected: the way back down the ladder is as open as ever.
    expect(requireElement(".speed-down", parent).hasAttribute("disabled")).toBe(false);
  });

  it("reads the instant stop off the app rather than off the time scale", () => {
    // `timeScale` multiplies the frame delta, so the reading it stands for could never be in it.
    let instant = false;
    const { parent, options } = setUp({ instantSpeed: () => instant });
    const presenter = presentSpeedStepper(parent, options);

    options.worldController.timeScale = 20;
    instant = true;
    presenter.update();

    const value = requireElement(".speed-val", parent);
    expect(value.textContent).toBe("∞x");
    expect(value.title).toBe("Instantly: the run is counted straight through to its result");
    // Nothing past it, and the way back is `-`, which lands on the finite speed the control was left at.
    expect(requireElement(".speed-up", parent).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".speed-down", parent).hasAttribute("disabled")).toBe(false);
  });

  it("leaves `-` live on the instant stop even from the bottom of the ladder", () => {
    const { parent, options } = setUp({ instantSpeed: () => true });
    options.worldController.timeScale = 1;
    presentSpeedStepper(parent, options);

    expect(requireElement(".speed-down", parent).hasAttribute("disabled")).toBe(false);
  });

  it("dims both arrows while a crunch is under way", () => {
    const { parent, options } = setUp({ instantRunInProgress: () => true });
    presentSpeedStepper(parent, options);

    expect(requireElement(".speed-down", parent).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".speed-up", parent).hasAttribute("disabled")).toBe(true);
  });

  it("rewrites every word it draws when the language changes", () => {
    const { parent, options } = setUp({ instantSpeed: () => true });
    const presenter = presentSpeedStepper(parent, options);

    setLocale("ru");
    try {
      presenter.update();
      expect(requireElement(".speed", parent).getAttribute("aria-label")).toBe("Скорость прогона");
      expect(requireElement(".speed-down", parent).title).toBe("Медленнее");
      expect(requireElement(".speed-up", parent).title).toBe("Быстрее");
      expect(requireElement(".speed-val", parent).textContent).toBe("∞×");
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });
});

describe("formatTimeScale", () => {
  it.each([
    // Whole speeds the +/- buttons produce, which must not gain a decimal point.
    [1, "1x"],
    [2, "2x"],
    [3, "3x"],
    [6, "6x"],
    [10, "10x"],
    [20, "20x"],
    [40, "40x"],
    [64, "64x"],
    // The slow half of the runnable range.
    [0.5, "0.5x"],
    [0.25, "0.25x"],
    [0.1, "0.1x"],
    // Anything else a hand-written #timescale= can ask for.
    [0.7, "0.7x"],
    [1.618, "1.618x"],
  ])("renders %s as %s", (timeScale, expected) => {
    expect(formatTimeScale(timeScale)).toBe(expected);
  });

  it("does not leak binary floating-point noise into the label", () => {
    expect(formatTimeScale(0.1 + 0.2)).toBe("0.3x");
  });

  it("writes the time scale with the multiplication sign Russian uses", () => {
    setLocale("ru");
    try {
      expect(formatTimeScale(2)).toBe("2×");
      expect(formatTimeScale(0.5)).toBe("0,5×");
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });
});
