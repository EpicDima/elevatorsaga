// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { formatTimeScale, presentSpeedStepper, speedStepperTemplate } from "./speed-stepper.ts";
import type { SpeedStepperOptions } from "./speed-stepper.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";

/**
 * Builds a `.timescale`-holding parent and mutable speed-stepper options.
 *
 * @param overrides - Callbacks and data to replace the defaults with.
 * @returns The parent element and the options, both mutable.
 */
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
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
      ...overrides,
    },
  };
}

describe("speedStepperTemplate", () => {
  it("makes the time-scale controls real, labelled buttons", () => {
    const parent = document.createElement("div");
    parent.innerHTML = speedStepperTemplate();

    expect(parent.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(parent.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
  });

  it("announces the speed as it changes, without interrupting", () => {
    const parent = document.createElement("div");
    parent.innerHTML = speedStepperTemplate();

    expect(parent.querySelector(".timescale_value")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("presentSpeedStepper", () => {
  it("draws the current speed", () => {
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    expect(requireElement(".timescale_value", parent).textContent).toBe("2x");
  });

  it("reports button presses to the caller", () => {
    const { parent, options } = setUp();
    presentSpeedStepper(parent, options);

    requireElement(".timescale_increase", parent).click();
    requireElement(".timescale_decrease", parent).click();

    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleDecrease).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentSpeedStepper(parent, options);

    for (let i = 0; i < 5; i += 1) {
      options.worldController.timeScale = i;
      presenter.update();
    }
    requireElement(".timescale_increase", parent).click();

    expect(requireElement(".timescale_value", parent).textContent).toBe("4x");
    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
  });
});

describe("formatTimeScale", () => {
  it.each([
    // The speeds the +/- buttons produce, which must not gain a decimal point.
    [1, "1x"],
    [2, "2x"],
    [3, "3x"],
    [5, "5x"],
    [8, "8x"],
    [13, "13x"],
    [21, "21x"],
    [34, "34x"],
    [40, "40x"],
    [63, "63x"],
    [64, "64x"],
    // The slow half of the runnable range, which toFixed(0) misreported: 0.5
    // showed as "1x" and 0.1 as "0x", i.e. as a stopped simulation.
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
