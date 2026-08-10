// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "../game/user.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import { createElement, queryAll, requireElement } from "./dom.ts";
import {
  clearAll,
  clearCodeStatus,
  containsFocus,
  describeError,
  formatTimeScale,
  FULLSCREEN_CLASS,
  presentChallenge,
  presentCodeStatus,
  presentFeedback,
  presentStats,
  presentWorld,
  setDemoFullscreen,
} from "./presenters.ts";
import type { ChallengePresenterOptions } from "./presenters.ts";

/** Builds the `.statscontainer` markup the page shell provides. */
function statsContainer(): HTMLElement {
  const container = createElement("div", { className: "statscontainer" });
  for (const className of [
    "transportedcounter",
    "elapsedtime",
    "transportedpersec",
    "avgwaittime",
    "maxwaittime",
    "movecount",
  ]) {
    container.append(createElement("span", { className: `value ${className}` }));
  }
  return container;
}

/**
 * A world with predictable statistics.
 *
 * Every value is chosen so that its formatter has to round it, and to round it
 * *up*, since rounding down is what truncation looks like too. `61.4` and
 * `0.1953125` used to sit here: the first is not a number `toFixed(0)` can get
 * wrong, and the second is a binary-exact `25 / 128` that `toPrecision(3)`
 * cannot get wrong either.
 */
function worldWithStats(): World {
  const world = createWorld({ floorCount: 3, elevatorCount: 1 });
  world.transportedCounter = 12;
  world.elapsedTime = 60.7;
  // The quotient the simulation would have computed, 0.1976935...
  world.transportedPerSec = world.transportedCounter / world.elapsedTime;
  world.avgWaitTime = 3.25;
  world.maxWaitTime = 11.06;
  world.moveCount = 7;
  return world;
}

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

describe("presentStats", () => {
  it("fills the panel immediately, with the legacy number formats", () => {
    const container = statsContainer();
    presentStats(container, worldWithStats());

    expect(requireElement(".transportedcounter", container).textContent).toBe("12");
    expect(requireElement(".elapsedtime", container).textContent).toBe("61s");
    expect(requireElement(".transportedpersec", container).textContent).toBe("0.198");
    expect(requireElement(".avgwaittime", container).textContent).toBe("3.3s");
    expect(requireElement(".maxwaittime", container).textContent).toBe("11.1s");
    expect(requireElement(".movecount", container).textContent).toBe("7");
  });

  it("keeps following the world", () => {
    const container = statsContainer();
    const world = worldWithStats();
    presentStats(container, world);

    world.transportedCounter = 13;
    world.trigger("stats_display_changed");
    expect(requireElement(".transportedcounter", container).textContent).toBe("13");
  });

  it("throws when the page shell is missing a value slot", () => {
    const container = createElement("div", { className: "statscontainer" });
    expect(() => {
      presentStats(container, worldWithStats());
    }).toThrow("Missing required element: .transportedcounter");
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
});

describe("presentChallenge", () => {
  /**
   * Assembles challenge options over a mutable world/controller pair.
   *
   * @param overrides - Callbacks and data to replace the defaults with.
   * @returns The parent element, the options and the presenter.
   */
  function setUp(overrides: Partial<ChallengePresenterOptions> = {}): {
    parent: HTMLElement;
    options: ChallengePresenterOptions;
  } {
    const parent = createElement("div", { className: "challenge" });
    const options: ChallengePresenterOptions = {
      challengeNum: 3,
      description: "Transport <span class='emphasis-color'>15</span> people",
      world: { challengeEnded: false },
      worldController: { isPaused: true, timeScale: 2 },
      onStartStop: vi.fn(),
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
      ...overrides,
    };
    return { parent, options };
  }

  it("draws the title, the time scale and the start button", () => {
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    expect(requireElement(".challengetitle", parent).textContent).toBe(
      "Challenge #3: Transport 15 people",
    );
    expect(requireElement(".timescale_value", parent).textContent).toBe("2x");
    expect(requireElement(".startstop", parent).textContent).toBe("Start");
  });

  it("shows Pause while running and Restart once the challenge is over", () => {
    const { parent, options } = setUp();
    const presenter = presentChallenge(parent, options);
    const startStop = requireElement(".startstop", parent);

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Pause");

    options.world.challengeEnded = true;
    presenter.update();
    expect(startStop.textContent).toBe(" Restart");
    expect(startStop.querySelector("svg")).not.toBeNull();
  });

  it("reports button presses to the app", () => {
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    requireElement(".startstop", parent).click();
    requireElement(".timescale_increase", parent).click();
    requireElement(".timescale_decrease", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleDecrease).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUp();
    const presenter = presentChallenge(parent, options);

    for (let i = 0; i < 5; i += 1) {
      options.worldController.timeScale = i;
      presenter.update();
    }
    requireElement(".startstop", parent).click();

    expect(requireElement(".timescale_value", parent).textContent).toBe("4x");
    expect(options.onStartStop).toHaveBeenCalledTimes(1);
  });

  describe("focus", () => {
    /**
     * Draws a challenge bar inside the document, where focus can be moved.
     *
     * @param overrides - Callbacks and data to replace the defaults with.
     * @returns The parent element and the options it was drawn from.
     */
    function mount(overrides: Partial<ChallengePresenterOptions> = {}): {
      parent: HTMLElement;
      options: ChallengePresenterOptions;
    } {
      const { parent, options } = setUp(overrides);
      document.body.append(parent);
      return { parent, options };
    }

    it("puts focus back on the button a rebuild destroyed", () => {
      // Pressing Restart restarts the challenge, which rebuilds this bar and
      // deletes the button that was pressed. Focus used to fall back to <body>,
      // dropping a keyboard player at the top of the page mid-game.
      const { parent, options } = mount({ world: { challengeEnded: true } });
      presentChallenge(parent, options);
      requireElement(".startstop", parent).focus();

      presentChallenge(parent, { ...options, world: { challengeEnded: false } });

      const startStop = requireElement(".startstop", parent);
      expect(document.activeElement).toBe(startStop);
      // Focused after the label is written, so it is not announced unnamed.
      expect(startStop.textContent).toBe("Start");
    });

    it("does not grab focus on the first render", () => {
      const { parent, options } = mount();
      document.body.focus();

      presentChallenge(parent, options);

      expect(document.activeElement).not.toBe(requireElement(".startstop", parent));
    });

    it("leaves focus alone when the rebuild came from outside the bar", () => {
      // Applying code with Ctrl-Enter also restarts the challenge. Yanking
      // focus out of the editor every time would be worse than the bug.
      const { parent, options } = mount();
      presentChallenge(parent, options);
      const elsewhere = document.createElement("textarea");
      document.body.append(elsewhere);
      elsewhere.focus();

      presentChallenge(parent, options);

      expect(document.activeElement).toBe(elsewhere);
    });

    it("takes focus when the caller reports the teardown destroyed it", () => {
      // The app empties the feedback overlay and the building before drawing
      // the bar, so a "Next challenge" link that had focus is already gone --
      // and with it any way for the bar to notice.
      const { parent, options } = mount();
      document.body.focus();

      presentChallenge(parent, { ...options, focusWasDestroyed: true });

      const startStop = requireElement(".startstop", parent);
      expect(document.activeElement).toBe(startStop);
      expect(startStop.textContent).toBe("Start");
    });
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

describe("presentFeedback", () => {
  it("replaces any previous feedback", () => {
    const parent = createElement("div", { className: "feedbackcontainer" });
    presentFeedback(parent, { title: "Challenge failed", message: "Try again", url: "" });
    presentFeedback(parent, { title: "Success!", message: "Well done", url: "#challenge=4" });

    expect(parent.children).toHaveLength(1);
    expect(requireElement("h2", parent).textContent).toBe("Success!");
    expect(requireElement("a", parent).getAttribute("href")).toBe("#challenge=4");
  });

  it("omits the next-challenge link when there is nowhere to go", () => {
    const parent = createElement("div", { className: "feedbackcontainer" });
    presentFeedback(parent, { title: "Challenge failed", message: "Try again", url: "" });
    expect(parent.querySelector("a")).toBeNull();
  });
});

describe("presentWorld", () => {
  /**
   * Draws a world into a fresh `.innerworld`.
   *
   * @param world - The world to draw.
   * @returns The container it was drawn into.
   */
  function draw(world: World): HTMLElement {
    const parent = createElement("div", { className: "innerworld" });
    document.body.append(parent);
    presentWorld(parent, world);
    return parent;
  }

  it("sizes the building and draws every floor and elevator", () => {
    const world = createWorld({ floorCount: 4, elevatorCount: 2 });
    const parent = draw(world);

    expect(parent.style.height).toBe("200px");
    expect(queryAll(".floor", parent)).toHaveLength(4);
    expect(queryAll(".elevator", parent)).toHaveLength(2);
    expect(queryAll(".floor .floornumber", parent).map((e) => e.textContent)).toEqual([
      "0",
      "1",
      "2",
      "3",
    ]);
  });

  it("hides the impossible call buttons and keeps them off the keyboard path", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const floors = queryAll(".floor", draw(world));
    const first = floors.at(0);
    const last = floors.at(-1);

    const down = requireElement("button.down", first ?? document.body);
    const up = requireElement("button.up", last ?? document.body);
    expect(down.classList.contains("invisible")).toBe(true);
    expect(down.hasAttribute("disabled")).toBe(true);
    expect(up.classList.contains("invisible")).toBe(true);
    expect(requireElement("button.up", first ?? document.body).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("calls the elevator when a floor button is clicked, and lights the button", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const floor = queryAll(".floor", parent)[1];
    const up = requireElement("button.up", floor ?? document.body);

    up.click();

    expect(world.floors[1]?.buttonStates.up).toBe("activated");
    expect(up.classList.contains("activated")).toBe(true);
    expect(up.getAttribute("aria-pressed")).toBe("true");
  });

  it("gives every elevator one in-car button per floor, wired to the car", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const buttons = queryAll(".elevator .buttonpress", parent);
    expect(buttons.map((b) => b.textContent)).toEqual(["0", "1", "2"]);

    buttons[2]?.click();

    expect(world.elevators[0]?.buttonStates[2]).toBe(true);
    expect(buttons[2]?.classList.contains("activated")).toBe(true);
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the current floor and follows the car as it moves", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const elevator = world.elevators[0];
    const element = requireElement(".elevator", parent);

    expect(requireElement(".floorindicator > span", element).textContent).toBe("0");

    elevator?.moveTo(105, 20);
    elevator?.updateDisplayPosition();
    expect(element.style.transform).toBe("translate3d(105px, 20px, 0)");
  });

  it("lights the direction indicators", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const elevatorInterface = world.elevatorInterfaces[0];
    const up = requireElement(".directionindicatorup .up", parent);
    const down = requireElement(".directionindicatordown .down", parent);

    elevatorInterface?.goingUpIndicator(true);
    elevatorInterface?.goingDownIndicator(false);

    expect(up.classList.contains("activated")).toBe(true);
    expect(down.classList.contains("activated")).toBe(false);
  });

  it("draws passengers as they appear and drops them when they leave", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const user = new User(60);
    user.displayType = "female";

    world.trigger("new_user", user);
    const element = requireElement(".user", parent);
    expect(element.getAttribute("class")).toBe("icon movable user");

    user.moveTo(30, 40);
    user.updateDisplayPosition();
    expect(element.getAttribute("style")).toBe("transform: translate3d(30px, 40px, 0);");

    user.done = true;
    user.updateDisplayPosition(true);
    expect(element.classList.contains("leaving")).toBe(true);

    user.trigger("removed");
    expect(parent.querySelector(".user")).toBeNull();
  });
});

describe("describeError", () => {
  // Player code can throw literally anything, and whatever it throws is all
  // the player has to go on. None of these may come out as "[object Object]".
  it.each([
    ["a string", "plain string failure", "plain string failure"],
    ["a number", 42, "42"],
    ["null", null, "null"],
    ["undefined", undefined, "undefined"],
    ["a boolean", false, "false"],
    ["an empty string", "", "Thrown empty string"],
  ])("describes %s", (_name, thrown, expected) => {
    expect(describeError(thrown)).toBe(expected);
  });

  it("prefers the stack of an Error subclass", () => {
    class ElevatorStuck extends Error {}
    const error = new ElevatorStuck("stuck between floors");
    error.stack = "ElevatorStuck: stuck between floors\n    at update";
    expect(describeError(error)).toBe(error.stack);
  });

  it("falls back to an Error that has no stack", () => {
    const error = new Error("boom");
    error.stack = "";
    expect(describeError(error)).toBe("Error: boom");
  });

  it("uses a thrown object's own toString", () => {
    // What the legacy banner did: the object reached riot.render, which
    // concatenated it and so called its toString.
    expect(describeError({ toString: (): string => "ElevatorError: doors stuck" })).toBe(
      "ElevatorError: doors stuck",
    );
  });

  it("uses the message of an object that has one but no stack", () => {
    expect(describeError({ message: "no stack here" })).toBe("no stack here");
  });

  it("survives an object whose toString throws", () => {
    const error = {
      floor: 3,
      toString: (): string => {
        throw new Error("not today");
      },
    };
    expect(describeError(error)).toBe('Object {"floor":3}');
  });

  it("survives an object whose stack and message getters throw", () => {
    const error = {
      get stack(): string {
        throw new Error("no stack for you");
      },
      get message(): string {
        throw new Error("no message either");
      },
    };
    expect(describeError(error)).toBe("Object with keys: stack, message");
  });

  it("describes a bare object structurally rather than as [object Object]", () => {
    expect(describeError({ code: "E_STUCK", floor: 3 })).toBe(
      'Object {"code":"E_STUCK","floor":3}',
    );
    expect(describeError({})).toBe("Thrown Object with no message");
    // An array does have a useful string conversion of its own.
    expect(describeError([1, 2])).toBe("1,2");
    expect(describeError([{ floor: 3 }])).toBe('Array [{"floor":3}]');
  });

  it("survives a circular object and one with a null prototype", () => {
    const circular: Record<string, unknown> = { floor: 3 };
    circular["self"] = circular;
    expect(describeError(circular)).toBe("Object with keys: floor, self");

    const bare = Object.assign(Object.create(null) as object, { floor: 3 });
    expect(describeError(bare)).toBe('Object {"floor":3}');
  });
});

describe("presentCodeStatus", () => {
  it("shows the stack of a thrown error as text, never as markup", () => {
    const parent = createElement("div", { className: "codestatus" });
    const error = new Error("boom");
    error.stack = "Error: <img src=x onerror=alert(1)>\n    at update";

    presentCodeStatus(parent, error);

    const message = requireElement(".errormessage", parent);
    expect(message.textContent).toBe(error.stack);
    expect(message.children).toHaveLength(0);
  });

  it("replaces any previous banner", () => {
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, new Error("first"));
    presentCodeStatus(parent, "second");
    expect(parent.children).toHaveLength(1);
    expect(requireElement(".errormessage", parent).textContent).toBe("second");
  });

  it("draws a banner even for a thrown undefined", () => {
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, undefined);
    expect(requireElement(".errormessage", parent).textContent).toBe("undefined");
  });
});

describe("clearCodeStatus", () => {
  it("clears the banner", () => {
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, new Error("boom"));
    clearCodeStatus(parent);
    expect(parent.innerHTML).toBe("");
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
