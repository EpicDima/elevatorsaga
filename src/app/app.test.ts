// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Challenge } from "../game/challenges.ts";
import { createWorldController } from "../game/world-controller.ts";
import type { WorldController } from "../game/world-controller.ts";
import { createElement, queryAll, requireElement } from "../ui/dom.ts";
import { CodeEditor } from "../ui/editor.ts";
import { FakeTextEditorView, MemoryStorage } from "../ui/test-helpers.ts";
import { App, TIME_SCALE_STORAGE_KEY, readStoredTimeScale } from "./app.ts";
import type { AppElements } from "./app.ts";
import { parseQuery, resolveRoute } from "./router.ts";
import { DEFAULT_TIME_SCALE } from "./time-scale.ts";

/** A program that compiles and does nothing. */
const INERT_CODE = "{ init: function() {}, update: function() {} }";

/** Challenges used by these tests: the first two are winnable, the third not. */
const CHALLENGES: readonly Challenge[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0 },
    condition: { description: "Challenge <span>one</span>", evaluate: () => null },
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0 },
    condition: { description: "Challenge two", evaluate: () => true },
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0 },
    condition: { description: "Challenge three", evaluate: () => false },
  },
];

/** The page shell, the app built over it, and the pieces the tests poke at. */
interface Harness {
  app: App;
  elements: AppElements;
  editor: CodeEditor;
  view: FakeTextEditorView;
  worldController: WorldController;
  storage: MemoryStorage;
}

/**
 * Builds a page shell and an app over it.
 *
 * @param code - The program the editor starts with.
 * @returns Everything the tests need to drive the app.
 */
function setUp(code: string = INERT_CODE): Harness {
  const elements: AppElements = {
    challenge: createElement("div", { className: "challenge" }),
    world: createElement("div", { className: "innerworld" }),
    stats: createElement("div", { className: "statscontainer" }),
    feedback: createElement("div", { className: "feedbackcontainer" }),
    codeStatus: createElement("div", { className: "codestatus" }),
  };
  for (const className of [
    "transportedcounter",
    "elapsedtime",
    "transportedpersec",
    "avgwaittime",
    "maxwaittime",
    "movecount",
  ]) {
    elements.stats.append(createElement("span", { className }));
  }
  document.body.replaceChildren(
    elements.challenge,
    elements.world,
    elements.stats,
    elements.feedback,
    elements.codeStatus,
  );

  const storage = new MemoryStorage();
  let view: FakeTextEditorView | undefined;
  const editor = new CodeEditor(
    (handlers) => {
      view = new FakeTextEditorView(handlers);
      return view;
    },
    { storage },
  );
  if (view === undefined) {
    throw new Error("The editor did not build its view");
  }
  view.value = code;

  const worldController = createWorldController(1.0 / 60.0);
  const app = new App({
    elements,
    editor,
    worldController,
    challenges: CHALLENGES,
    storage,
    requestAnimationFrame: () => undefined,
  });
  return { app, elements, editor, view, worldController, storage };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("App.startChallenge", () => {
  it("draws the challenge bar, the world and the statistics", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);

    expect(requireElement(".challengetitle", elements.challenge).textContent).toBe(
      "Challenge #1: Challenge one",
    );
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
    expect(requireElement(".transportedcounter", elements.stats).textContent).toBe("0");
  });

  it("keeps the window.world debugging hook pointing at the live world", () => {
    const { app } = setUp();
    app.startChallenge(1);
    expect(window.world).toBe(app.world);
    expect(window.world?.floors).toHaveLength(4);
  });

  it("tears the previous world down and starts from a clean page", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    const first = app.world;

    app.startChallenge(1);

    expect(first?.challengeEnded).toBe(true);
    expect(first?.floors).toHaveLength(0);
    expect(queryAll(".floor", elements.world)).toHaveLength(4);
    expect(elements.feedback.innerHTML).toBe("");
  });

  it("refuses an index that does not name a challenge", () => {
    const { app } = setUp();
    expect(() => {
      app.startChallenge(99);
    }).toThrow(RangeError);
  });

  it("starts even when the program does not compile", () => {
    const { app, elements } = setUp("{ this is not javascript");
    app.startChallenge(0);

    expect(app.world).toBeDefined();
    expect(requireElement(".errormessage", elements.codeStatus).textContent).not.toBe("");
  });
});

describe("App challenge outcome", () => {
  it("stops the world and offers the next challenge on a win", () => {
    const { app, elements } = setUp();
    app.startChallenge(1);

    app.world?.trigger("stats_changed");

    expect(app.world?.challengeEnded).toBe(true);
    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Success!");
    expect(requireElement(".feedback a", elements.feedback).getAttribute("href")).toBe(
      "#challenge=3",
    );
  });

  it("says so, without a link, on a loss", () => {
    const { app, elements } = setUp();
    app.startChallenge(2);

    app.world?.trigger("stats_changed");

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Challenge failed");
    expect(elements.feedback.querySelector("a")).toBeNull();
  });

  it("offers no next challenge after the last one", () => {
    const { app, elements } = setUp();
    app.startChallenge(1);
    // Pretend the winnable challenge is the last one in the list.
    Object.defineProperty(app, "challenges", { value: CHALLENGES.slice(0, 2) });

    app.world?.trigger("stats_changed");

    expect(elements.feedback.querySelector("a")).toBeNull();
  });

  it("keeps the rest of the url in the next-challenge link", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8,autostart=true"));

    app.world?.trigger("stats_changed");

    expect(requireElement(".feedback a", elements.feedback).getAttribute("href")).toBe(
      "#challenge=3,timescale=8,autostart=true",
    );
  });
});

describe("App start/stop", () => {
  it("pauses and resumes a running challenge", () => {
    const { app, worldController, elements } = setUp();
    app.startChallenge(0);
    const startStop = requireElement(".startstop", elements.challenge);
    expect(startStop.textContent).toBe("Start");

    startStop.click();
    expect(worldController.isPaused).toBe(false);
    expect(startStop.textContent).toBe("Pause");

    startStop.click();
    expect(worldController.isPaused).toBe(true);
    expect(startStop.textContent).toBe("Start");
  });

  it("restarts the challenge once it has ended", () => {
    const { app, elements } = setUp();
    app.startChallenge(2);
    app.world?.trigger("stats_changed");
    const ended = app.world;

    requireElement(".startstop", elements.challenge).click();

    expect(app.world).not.toBe(ended);
    expect(app.currentChallengeIndex).toBe(2);
  });
});

describe("App time scale", () => {
  it("steps the speed with the challenge bar's buttons", () => {
    const { app, worldController, elements } = setUp();
    app.startChallenge(0);
    worldController.setTimeScale(2);

    requireElement(".timescale_increase", elements.challenge).click();
    expect(worldController.timeScale).toBe(3);
    expect(requireElement(".timescale_value", elements.challenge).textContent).toBe("3x");

    requireElement(".timescale_decrease", elements.challenge).click();
    expect(worldController.timeScale).toBe(2);
  });

  it("remembers the chosen speed", () => {
    const { app, worldController, storage } = setUp();
    app.startChallenge(0);
    worldController.setTimeScale(8);
    expect(storage.getItem(TIME_SCALE_STORAGE_KEY)).toBe("8");
    expect(readStoredTimeScale(storage)).toBe(8);
  });

  it("subscribes to timescale_changed exactly once, however many challenges are started", () => {
    // The legacy app.startChallenge subscribed on every start and never
    // unsubscribed, so the Nth challenge wrote the time scale to storage N
    // times and rebuilt the challenge bar N times for a single button press.
    const { app, worldController, storage } = setUp();
    const setItem = vi.spyOn(storage, "setItem");

    app.startChallenge(0);
    app.startChallenge(1);
    app.startChallenge(2);
    setItem.mockClear();

    worldController.setTimeScale(8);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("never lets the decrease button freeze the world", () => {
    const { app, worldController, elements } = setUp();
    app.handleRoute(...routeFor("#timescale=0.5"));
    expect(worldController.timeScale).toBe(0.5);

    for (let i = 0; i < 5; i += 1) {
      requireElement(".timescale_decrease", elements.challenge).click();
    }

    expect(worldController.timeScale).toBeGreaterThan(0);
  });
});

/**
 * Resolves a location hash into the arguments {@link App.handleRoute} takes.
 *
 * @param hash - The location hash.
 * @returns The validated parameters and the raw ones.
 */
function routeFor(hash: string): Parameters<App["handleRoute"]> {
  const query = parseQuery(hash);
  return [resolveRoute(query, { challengeCount: 3, defaultTimeScale: DEFAULT_TIME_SCALE }), query];
}

describe("App.handleRoute", () => {
  it("starts the challenge the url names", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));
    expect(app.currentChallengeIndex).toBe(2);
  });

  it("does not blank the page when the challenge is not a number", () => {
    // #challenge=abc used to reach challenges[NaN].options and throw.
    const { app, elements } = setUp();
    expect(() => {
      app.handleRoute(...routeFor("#challenge=abc"));
    }).not.toThrow();
    expect(app.currentChallengeIndex).toBe(0);
    expect(requireElement(".challengetitle", elements.challenge).textContent).toContain(
      "Challenge #1",
    );
  });

  it("does not freeze the world when the timescale is not a number", () => {
    // #timescale=abc used to make every simulated dt NaN.
    const { app, worldController } = setUp();
    app.handleRoute(...routeFor("#timescale=abc"));
    expect(worldController.timeScale).toBe(DEFAULT_TIME_SCALE);
    expect(Number.isFinite(worldController.timeScale)).toBe(true);
  });

  it("runs straight away when asked to autostart", () => {
    const { app, worldController } = setUp();
    app.handleRoute(...routeFor("#autostart=true"));
    expect(worldController.isPaused).toBe(false);
  });

  it("loads the reference solution for devtest", () => {
    const { app, view } = setUp();
    app.handleRoute(...routeFor("#devtest=true"));
    expect(view.getValue()).toContain("selectElevatorForFloorPickup");
  });

  it("enters and leaves fullscreen with the url", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#fullscreen=true"));
    expect(document.documentElement.classList.contains("fullscreen-demo")).toBe(true);

    app.handleRoute(...routeFor("#challenge=1"));
    expect(document.documentElement.classList.contains("fullscreen-demo")).toBe(false);
  });
});

describe("App code status", () => {
  it("shows an error the simulation raises and clears it on the next success", () => {
    const { app, editor, elements } = setUp();
    app.startChallenge(0);

    app.worldController.trigger("usercode_error", new Error("boom"));
    expect(requireElement(".errormessage", elements.codeStatus).textContent).toContain("boom");

    editor.getCodeObj();
    expect(elements.codeStatus.innerHTML).toBe("");
  });

  it("restarts the current challenge, running, when the program is applied", () => {
    const { app, editor } = setUp();
    app.startChallenge(2);
    const before = app.world;

    editor.trigger("apply_code");

    expect(app.world).not.toBe(before);
    expect(app.currentChallengeIndex).toBe(2);
    expect(app.worldController.isPaused).toBe(false);
  });
});

describe("readStoredTimeScale", () => {
  it("reads back what the app stored", () => {
    const storage = new MemoryStorage();
    storage.setItem(TIME_SCALE_STORAGE_KEY, "16");
    expect(readStoredTimeScale(storage)).toBe(16);
  });

  it("ignores a missing or unusable stored value", () => {
    const storage = new MemoryStorage();
    expect(readStoredTimeScale(storage)).toBeUndefined();
    storage.setItem(TIME_SCALE_STORAGE_KEY, "not a number");
    expect(readStoredTimeScale(storage)).toBeUndefined();
  });
});
