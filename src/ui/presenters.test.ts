// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  clearAll,
  containsFocus,
  FULLSCREEN_CLASS,
  presentControls,
  relabelWorld,
  setDemoFullscreen,
} from "./presenters.ts";
import type { ControlsPresenterOptions } from "./presenters.ts";
import { createElement } from "./test-helpers.ts";
import { presentBuildingStage } from "#widgets/building-stage/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
});

describe("clearAll", () => {
  it("empties every element it is given", () => {
    const a = createElement("div", { children: [createElement("span")] });
    const b = createElement("div", { text: "text" });
    clearAll([a, b]);
    expect(a.innerHTML).toBe("");
    expect(b.innerHTML).toBe("");
  });
});

describe("presentControls", () => {
  /**
   * Assembles controls options over a mutable controller.
   *
   * @param overrides - Callbacks and data to replace the defaults with.
   * @returns The parent element and the options, both mutable.
   */
  function setUp(overrides: Partial<ControlsPresenterOptions> = {}): {
    parent: HTMLElement;
    options: {
      -readonly [Key in keyof ControlsPresenterOptions]: ControlsPresenterOptions[Key];
    } & { worldController: { isPaused: boolean; timeScale: number } };
  } {
    const parent = createElement("div", { className: "controls" });
    return {
      parent,
      options: {
        worldController: { isPaused: true, timeScale: 2 },
        challengeEnded: (): boolean => false,
        onStartStop: vi.fn(),
        onStartOver: vi.fn(),
        onTimeScaleIncrease: vi.fn(),
        onTimeScaleDecrease: vi.fn(),
        instantRunInProgress: (): boolean => false,
        onRunInstant: vi.fn(),
        ...overrides,
      },
    };
  }

  it("draws the time scale and labels the three run buttons", () => {
    const { parent, options } = setUp();
    presentControls(parent, options);

    expect(requireElement(".timescale_value", parent).textContent).toBe("2x");
    expect(requireElement(".startstop", parent).textContent).toBe("Start");
    expect(requireElement(".startover", parent).textContent).toBe("Start over");
    expect(requireElement(".runinstant", parent).textContent).toBe("Run instantly");
  });

  it("labels the instant-run button as crunching, and disables it, while a crunch is in progress", () => {
    const { parent, options } = setUp();
    const presenter = presentControls(parent, options);
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
    const presenter = presentControls(parent, options);
    const startStop = requireElement(".startstop", parent);

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Pause");

    options.challengeEnded = (): boolean => true;
    presenter.update();
    expect(startStop.textContent).toBe(" Restart");
    expect(startStop.querySelector("svg")).not.toBeNull();
  });

  it("reports button presses to the app", () => {
    const { parent, options } = setUp();
    presentControls(parent, options);

    requireElement(".startstop", parent).click();
    requireElement(".startover", parent).click();
    requireElement(".runinstant", parent).click();
    requireElement(".timescale_increase", parent).click();
    requireElement(".timescale_decrease", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
    expect(options.onStartOver).toHaveBeenCalledTimes(1);
    expect(options.onRunInstant).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleDecrease).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentControls(parent, options);

    for (let i = 0; i < 5; i += 1) {
      options.worldController.timeScale = i;
      presenter.update();
    }
    requireElement(".startstop", parent).click();

    expect(requireElement(".timescale_value", parent).textContent).toBe("4x");
    expect(options.onStartStop).toHaveBeenCalledTimes(1);
  });

  it("keeps the element a keyboard player is standing on across an update", () => {
    // The whole point of the row being drawn once: pressing Start over restarts
    // the run, which used to delete the button that was pressed and drop focus
    // on <body>. Nothing here is rebuilt, so there is nothing to restore.
    const { parent, options } = setUp();
    document.body.append(parent);
    const presenter = presentControls(parent, options);
    const startOver = requireElement(".startover", parent);
    startOver.focus();

    presenter.update();

    expect(document.activeElement).toBe(startOver);
  });

  it("lands focus on the start button when the app asks it to", () => {
    // For the redraw that empties the region focus was in -- the overlay's
    // "Next challenge" link, or the building -- which leaves focus on <body>.
    const { parent, options } = setUp();
    document.body.append(parent);
    const presenter = presentControls(parent, options);

    presenter.focusStartStop();

    expect(document.activeElement).toBe(requireElement(".startstop", parent));
  });
});

describe("containsFocus", () => {
  /**
   * Attaches a container holding one button to the document.
   *
   * @returns The container and the button inside it.
   */
  function mountContainer(): { container: HTMLElement; button: HTMLElement } {
    const button = createElement("button");
    const container = createElement("div", { children: [button] });
    document.body.append(container);
    return { container, button };
  }

  it("reports focus held inside a container", () => {
    const { container, button } = mountContainer();
    button.focus();
    expect(containsFocus([container])).toBe(true);
  });

  it("is false when focus is somewhere else entirely", () => {
    const { container } = mountContainer();
    const elsewhere = createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();
    expect(containsFocus([container])).toBe(false);
  });

  it("ignores focus on a container itself, which survives being emptied", () => {
    // .world carries tabindex="0" so the building can be scrolled by keyboard;
    // emptying its contents does not disturb the focus on it.
    const { container } = mountContainer();
    container.setAttribute("tabindex", "0");
    container.focus();
    expect(containsFocus([container])).toBe(false);
  });

  it("is false for an empty list, and for a container outside the document", () => {
    const { button } = mountContainer();
    button.focus();
    expect(containsFocus([])).toBe(false);
    expect(containsFocus([createElement("div")])).toBe(false);
  });
});

describe("relabelWorld", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /**
   * Draws a world into a fresh `.innerworld`, the way `widgets/building-stage`
   * draws it live.
   *
   * A container per call, and never a second `presentBuildingStage` into a
   * container that already holds a building: the presenter appends and
   * subscribes, so drawing twice into one parent is the very thing
   * `relabelWorld` exists to avoid.
   *
   * @param world - The world to draw.
   * @returns The container it was drawn into.
   */
  function draw(world: World): HTMLElement {
    const parent = createElement("div", { className: "innerworld" });
    document.body.append(parent);
    presentBuildingStage(parent, world);
    return parent;
  }

  /**
   * Every name assistive technology can read off a drawn building.
   *
   * In document order, which for a building is every floor's two call buttons
   * and then every car followed by its in-car buttons -- so two of these lists
   * compare position by position without either side saying which key produced
   * which entry.
   *
   * @param parent - A container a building has been drawn into.
   * @returns The `aria-label` of every element inside it that carries one.
   */
  function names(parent: HTMLElement): string[] {
    return queryAll("[aria-label]", parent).map((element) => element.ariaLabel ?? "");
  }

  it("renames a drawn building into exactly the names a freshly drawn one is born with", () => {
    // The test the two paths are held together by. `entities/floor` and
    // `entities/elevator` write these names through the templates when the
    // building is first drawn, and `relabelWorld` writes them again over a
    // building that is already on screen; if either one ever grows a label the
    // other does not know about, or spells one differently, these two lists stop
    // matching.
    const drawnInEnglish = draw(createWorld({ floorCount: 3, elevatorCount: 2 }));
    const english = names(drawnInEnglish);

    setLocale("ru");
    const drawnInRussian = draw(createWorld({ floorCount: 3, elevatorCount: 2 }));
    relabelWorld(drawnInEnglish);

    expect(names(drawnInEnglish)).toEqual(names(drawnInRussian));
    // And not vacuously: a building with no labels at all, or a `setLocale` that
    // did nothing, would satisfy the line above on its own.
    expect(names(drawnInRussian)).toHaveLength(14);
    expect(names(drawnInEnglish)).not.toEqual(english);
    expect(english[0]).toBe("Call an elevator going up from floor 0");
    expect(names(drawnInEnglish)[0]).toBe("Вызвать лифт вверх с этажа 0");
  });

  it("leaves the run in progress standing: the same elements, still wired, still lit", () => {
    // A language change must cost the player nothing. The building is not drawn
    // again, so every element a passenger is riding in or a click has lit is the
    // one that was there before.
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const called = requireElement("button.up", queryAll(".floor", parent)[1] ?? parent);
    const carButton = queryAll(".elevator .buttonpress", parent)[2];
    called.click();
    carButton?.click();
    const elementsBefore = queryAll("*", parent);

    setLocale("ru");
    relabelWorld(parent);

    // Identity, element by element: `toEqual` on nodes compares markup, and
    // markup is exactly what a redraw would reproduce.
    const elementsAfter = queryAll("*", parent);
    expect(elementsAfter).toHaveLength(elementsBefore.length);
    for (const [index, element] of elementsAfter.entries()) {
      expect(element).toBe(elementsBefore[index]);
    }
    expect(requireElement("button.up", queryAll(".floor", parent)[1] ?? parent)).toBe(called);
    expect(called.classList.contains("activated")).toBe(true);
    expect(called.getAttribute("aria-pressed")).toBe("true");
    expect(carButton?.classList.contains("activated")).toBe(true);
    expect(world.floors[1]?.buttonStates.up).toBe("activated");
    expect(world.elevators[0]?.buttonStates[2]).toBe(true);
  });

  it("keeps the buttons answering the world they were drawn from", () => {
    // Renaming an element by hand is the kind of change that can quietly replace
    // it. A click has to still reach the floor it was wired to afterwards.
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);

    setLocale("ru");
    relabelWorld(parent);
    const up = requireElement("button.up", queryAll(".floor", parent)[1] ?? parent);
    up.click();

    expect(world.floors[1]?.buttonStates.up).toBe("activated");
    expect(up.classList.contains("activated")).toBe(true);
  });

  it("has nothing to say to a container with no building in it", () => {
    // The world container is empty between runs and while a challenge is being
    // loaded, and a language can be chosen at either moment.
    const parent = createElement("div", { className: "innerworld" });
    document.body.append(parent);

    setLocale("ru");
    expect(() => {
      relabelWorld(parent);
    }).not.toThrow();
    expect(parent.childElementCount).toBe(0);
  });
});

describe("setDemoFullscreen", () => {
  it("toggles a single class on the document, and is reversible", () => {
    setDemoFullscreen(true);
    expect(document.documentElement.classList.contains(FULLSCREEN_CLASS)).toBe(true);
    setDemoFullscreen(false);
    expect(document.documentElement.classList.contains(FULLSCREEN_CLASS)).toBe(false);
  });
});

describe("the language the interface comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("relabels every run control on the next update", () => {
    // The row is drawn once for the life of the page, so a language change is
    // an `update()` and nothing else: every word it shows is read from the
    // catalogue at the moment it is written.
    const parent = createElement("div", { className: "controls" });
    const worldController = { isPaused: true, timeScale: 8 };
    let challengeEnded = false;
    const presenter = presentControls(parent, {
      worldController,
      challengeEnded: () => challengeEnded,
      onStartStop: vi.fn(),
      onStartOver: vi.fn(),
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
      instantRunInProgress: () => false,
      onRunInstant: vi.fn(),
    });
    const startStop = requireElement(".startstop", parent);

    setLocale("ru");
    presenter.update();

    expect(requireElement(".timescale_value", parent).textContent).toBe("8×");
    expect(startStop.textContent).toBe("Старт");
    expect(requireElement(".startover", parent).textContent).toBe("С начала");
    expect(requireElement(".runinstant", parent).textContent).toBe("Прогнать мгновенно");
    expect(requireElement(".timescale_increase", parent).getAttribute("aria-label")).toBe(
      "Увеличить скорость симуляции",
    );

    worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Пауза");

    challengeEnded = true;
    presenter.update();
    // The space in front is the gap between the icon and the word, and it is
    // `presenters.ts`'s job rather than the translator's.
    expect(startStop.textContent).toBe(" Заново");
  });
});
