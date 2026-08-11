// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "../game/user.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import { queryAll, requireElement } from "./dom.ts";
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
import type { ChallengeLinkData, SeedLinkData } from "./templates.ts";
import { createElement } from "./test-helpers.ts";

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

  it("groups the thousands a long run gets to", () => {
    // The one thing the panel shows differently than it used to. `String` and
    // `toFixed` wrote 2675s; every reader of English writes 2,675s, and every
    // reader of Russian writes it with a space instead, which is the whole
    // reason these figures go through `Intl` now.
    const container = statsContainer();
    const world = worldWithStats();
    world.transportedCounter = 1234;
    world.elapsedTime = 2675;
    world.moveCount = 10000;
    presentStats(container, world);

    expect(requireElement(".transportedcounter", container).textContent).toBe("1,234");
    expect(requireElement(".elapsedtime", container).textContent).toBe("2,675s");
    expect(requireElement(".movecount", container).textContent).toBe("10,000");
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
  /** Four challenges, the third being played and the last being the demo. */
  const CHALLENGE_LINKS: readonly ChallengeLinkData[] = [1, 2, 3, 4].map((num) => ({
    num,
    url: `#challenge=${String(num)},timescale=8`,
    current: num === 3,
    demo: num === 4,
  }));

  /** The seed of the run being drawn, and the URL that starts it again. */
  const SEED: SeedLinkData = {
    seed: "1234567890",
    url: "#challenge=3,timescale=8,seed=1234567890",
    newDrawUrl: null,
  };

  /** The same run once the URL pins its seed, and the URL that unpins it. */
  const PINNED_SEED: SeedLinkData = { ...SEED, newDrawUrl: "#challenge=3,timescale=8" };

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
      challengeLinks: CHALLENGE_LINKS,
      seed: SEED,
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

  it("draws a link to every challenge, marking the one being played", () => {
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    const entries = queryAll(".challengelink", parent);
    expect(entries.map((entry) => entry.getAttribute("href"))).toEqual([
      "#challenge=1,timescale=8",
      "#challenge=2,timescale=8",
      "#challenge=3,timescale=8",
      "#challenge=4,timescale=8",
    ]);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([
      null,
      null,
      "page",
      null,
    ]);
  });

  it("leaves the links to navigate on their own", () => {
    // Nothing is bound to them: they are hash URLs, and the router is already
    // listening for the hash. That is what keeps the browser's own affordances
    // — open in a new tab, copy the address — working.
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    const entries = queryAll(".challengelink", parent);
    expect(entries.every((entry) => entry.tagName === "A")).toBe(true);
    expect(entries.every((entry) => entry.getAttribute("href") !== "")).toBe(true);
  });

  it("draws the seed of the run as a link back to it", () => {
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    const seedLink = requireElement(".seedlink", parent);
    expect(seedLink.textContent).toBe("1234567890");
    expect(seedLink.getAttribute("href")).toBe("#challenge=3,timescale=8,seed=1234567890");
  });

  it("draws the way out of a pinned run in place of the way in", () => {
    const { parent, options } = setUp({ seed: PINNED_SEED });
    presentChallenge(parent, options);

    expect(parent.querySelector(".seedlink")).toBeNull();
    expect(requireElement(".seednewdraw", parent).getAttribute("href")).toBe(
      "#challenge=3,timescale=8",
    );
  });

  it("keeps the caveat open across the rebuilds a run is made of", () => {
    // Every restart rebuilds this bar from markup, so a disclosure the player
    // opened would close itself on each one -- and the caveat is most wanted
    // exactly while they are restarting to see how far a seed goes.
    const { parent, options } = setUp();
    presentChallenge(parent, options);
    const help = requireElement(".seedhelp", parent);
    expect(help).toBeInstanceOf(HTMLDetailsElement);
    if (help instanceof HTMLDetailsElement) {
      help.open = true;
    }

    presentChallenge(parent, options);

    expect(requireElement(".seedhelp", parent).hasAttribute("open")).toBe(true);
  });

  it("leaves a closed caveat closed", () => {
    const { parent, options } = setUp();
    presentChallenge(parent, options);

    presentChallenge(parent, options);

    expect(requireElement(".seedhelp", parent).hasAttribute("open")).toBe(false);
  });

  it("draws no seed line when the run has no seed", () => {
    const { parent, options } = setUp({ seed: null });
    presentChallenge(parent, options);

    expect(parent.querySelector(".challengeseed")).toBeNull();
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

    it("keeps focus in the navigation row when a challenge is taken from it", () => {
      // Pressing "Challenge 1" starts that challenge, which rebuilds the bar and
      // deletes the link that was pressed. Landing on the start button would at
      // least not be <body>, but it strands a keyboard player who was working
      // along the row; the entry that replaced the one they pressed is where
      // they were.
      const { parent, options } = mount();
      presentChallenge(parent, options);
      queryAll(".challengelink", parent)[0]?.focus();

      presentChallenge(parent, {
        ...options,
        challengeNum: 1,
        challengeLinks: options.challengeLinks.map((link) => ({
          ...link,
          current: link.num === 1,
        })),
      });

      const first = queryAll(".challengelink", parent)[0];
      expect(document.activeElement).toBe(first);
      // And it is the challenge that is now being played, so a screen reader
      // announces the arrival rather than a link to somewhere else.
      expect(first?.getAttribute("aria-current")).toBe("page");
      expect(document.activeElement).not.toBe(requireElement(".startstop", parent));
    });

    it("keeps focus on the seed when following it rebuilds the bar", () => {
      // Following the seed pins it in the hash, which restarts the run and
      // rebuilds this bar -- so the link that was pressed is deleted every
      // time. Landing on the start button would leave a keyboard player one
      // press away from restarting again, having asked for no such thing.
      const { parent, options } = mount();
      presentChallenge(parent, options);
      requireElement(".seedlink", parent).focus();

      presentChallenge(parent, options);

      expect(document.activeElement).toBe(requireElement(".seedlink", parent));
    });

    it("keeps focus on the seed line when pinning replaces the link that was followed", () => {
      // Following the seed pins it, and the rebuilt line offers "new draw"
      // where the seed's own link used to be. The player pressed something in
      // that position and is still standing in that position, exactly as they
      // would be in the navigation row.
      const { parent, options } = mount();
      presentChallenge(parent, options);
      requireElement(".seedlink", parent).focus();

      presentChallenge(parent, { ...options, seed: PINNED_SEED });

      expect(document.activeElement).toBe(requireElement(".seednewdraw", parent));
    });

    it("keeps focus on the seed line when a new draw puts the seed's link back", () => {
      const { parent, options } = mount({ seed: PINNED_SEED });
      presentChallenge(parent, options);
      requireElement(".seednewdraw", parent).focus();

      presentChallenge(parent, { ...options, seed: SEED });

      expect(document.activeElement).toBe(requireElement(".seedlink", parent));
    });

    it("keeps focus on the caveat when something else rebuilds the bar", () => {
      // Reading the explanation is not itself a restart, but anything else can
      // be one -- the editor's Ctrl-Enter, a challenge finishing -- and a
      // keyboard player who was standing on the disclosure should still be
      // standing on it rather than on the start button.
      const { parent, options } = mount();
      presentChallenge(parent, options);
      requireElement(".seedhelp summary", parent).focus();

      presentChallenge(parent, options);

      expect(document.activeElement).toBe(requireElement(".seedhelp summary", parent));
    });

    it("falls back to the start button when the rebuild has no seed to return to", () => {
      const { parent, options } = mount();
      presentChallenge(parent, options);
      requireElement(".seedlink", parent).focus();

      presentChallenge(parent, { ...options, seed: null });

      expect(document.activeElement).toBe(requireElement(".startstop", parent));
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

  it("marks the passenger who has waited longest, and unmarks them again", () => {
    // The class the stylesheet colours. It has to come off as well as go on:
    // the world hands the title over rather than handing it out once.
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const user = new User(60);
    world.trigger("new_user", user);
    const element = requireElement(".user", parent);

    user.setWaitingLongest(true);
    expect(element.classList.contains("waiting-longest")).toBe(true);

    user.setWaitingLongest(false);
    expect(element.classList.contains("waiting-longest")).toBe(false);
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

describe("the language the interface comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("writes the statistics the way a reader of the locale writes numbers", () => {
    // A decimal comma, a space instead of a comma between thousands, and the
    // seconds abbreviated in Russian -- none of which `toFixed` and a glued-on
    // "s" could ever have produced. The space before «с» is a non-breaking one,
    // which is what keeps a figure and its unit on the same line; `Intl` puts an
    // ordinary space there and `formatNumber` replaces it.
    setLocale("ru");
    const container = statsContainer();
    presentStats(container, worldWithStats());

    expect(requireElement(".transportedcounter", container).textContent).toBe("12");
    expect(requireElement(".elapsedtime", container).textContent).toBe("61 с");
    expect(requireElement(".transportedpersec", container).textContent).toBe("0,198");
    expect(requireElement(".avgwaittime", container).textContent).toBe("3,3 с");
    expect(requireElement(".maxwaittime", container).textContent).toBe("11,1 с");
    expect(requireElement(".movecount", container).textContent).toBe("7");
  });

  it("groups thousands with a space rather than a comma", () => {
    setLocale("ru");
    const container = statsContainer();
    const world = worldWithStats();
    world.elapsedTime = 2675;
    presentStats(container, world);

    // U+00A0 again: Russian groups digits with a non-breaking space, and the
    // one before «с» is the unit separator.
    expect(requireElement(".elapsedtime", container).textContent).toBe("2 675 с");
  });

  it("writes the time scale with the multiplication sign Russian uses", () => {
    setLocale("ru");

    expect(formatTimeScale(2)).toBe("2×");
    expect(formatTimeScale(0.5)).toBe("0,5×");
  });

  it("labels the start button in the language of the moment it is drawn", () => {
    // The bar is rebuilt on every restart, so this is the label a player sees
    // after switching language and letting the page redraw -- which is the
    // contract `setLocale` asks its callers to keep.
    const parent = createElement("div", { className: "challenge" });
    const options: ChallengePresenterOptions = {
      challengeNum: 3,
      description: "Перевезите <span class='emphasis-color'>15</span> пассажиров",
      challengeLinks: [],
      seed: null,
      world: { challengeEnded: false },
      worldController: { isPaused: true, timeScale: 8 },
      onStartStop: vi.fn(),
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
    };
    setLocale("ru");
    const presenter = presentChallenge(parent, options);
    const startStop = requireElement(".startstop", parent);

    expect(requireElement(".challengetitle", parent).textContent).toBe(
      "Задание №3: Перевезите 15 пассажиров",
    );
    expect(requireElement(".timescale_value", parent).textContent).toBe("8×");
    expect(startStop.textContent).toBe("Старт");

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Пауза");

    options.world.challengeEnded = true;
    presenter.update();
    // The space in front is the gap between the icon and the word, and it is
    // this file's job rather than the translator's.
    expect(startStop.textContent).toBe(" Заново");
  });

  it("translates the sentence around a thrown value without translating the value", () => {
    // `Object`, the property names and anything the player's own code produced
    // are their JavaScript, and stay exactly as they wrote it.
    setLocale("ru");
    const circular: Record<string, unknown> = { floor: 3 };
    circular["self"] = circular;

    expect(describeError("")).toBe("Брошена пустая строка");
    expect(describeError({})).toBe("Брошен Object без сообщения");
    expect(describeError(circular)).toBe("Object с ключами: floor, self");
    expect(describeError("TypeError: elevator.goToFloor is not a function")).toBe(
      "TypeError: elevator.goToFloor is not a function",
    );
  });

  it("puts the banner's sentence in the locale and the message beside it untouched", () => {
    setLocale("ru");
    const parent = createElement("div", { className: "codestatus" });
    presentCodeStatus(parent, "Error: boom");

    expect(requireElement(".error", parent).textContent).toBe(
      " С вашим кодом что-то не так: Error: boom",
    );
  });
});
