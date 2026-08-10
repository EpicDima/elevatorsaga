// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "../game/user.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import { createElement, queryAll, requireElement } from "./dom.ts";
import {
  clearAll,
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

/** A world with predictable statistics. */
function worldWithStats(): World {
  const world = createWorld({ floorCount: 3, elevatorCount: 1 });
  world.transportedCounter = 12;
  world.elapsedTime = 61.4;
  world.transportedPerSec = 0.195_312_5;
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
    expect(requireElement(".transportedpersec", container).textContent).toBe("0.195");
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

  it("falls back to stringifying values without a stack", () => {
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, "plain string failure");
    expect(requireElement(".errormessage", parent).textContent).toBe("plain string failure");
  });

  it("clears the banner when there is no error", () => {
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, new Error("boom"));
    presentCodeStatus(parent);
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
