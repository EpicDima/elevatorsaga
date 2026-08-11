// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Challenge } from "../game/challenges.ts";
import { createWorldController } from "../game/world-controller.ts";
import type { WorldController } from "../game/world-controller.ts";
import { queryAll, requireElement } from "../ui/dom.ts";
import { CodeEditor } from "../ui/editor.ts";
import { createElement, FakeTextEditorView, MemoryStorage } from "../ui/test-helpers.ts";
import { App, TIME_SCALE_STORAGE_KEY, readStoredTimeScale } from "./app.ts";
import type { AppElements } from "./app.ts";
import { parseQuery, resolveRoute, startRouter } from "./router.ts";
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
    (handlers, initialValue) => {
      view = new FakeTextEditorView(handlers, initialValue);
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
  // Cleared as well as silenced: a spy outlives the spec that installed it, so
  // the specs that assert on what was printed would otherwise see the whole
  // file's output.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
  vi.spyOn(console, "log")
    .mockImplementation(() => undefined)
    .mockClear();
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

  it("leaves the seed of the challenge just won out of the link to the next", () => {
    // Everything else the player is carrying rides along; the seed does not,
    // because it was drawn for the building they have finished with.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8,seed=issue-61"));

    app.world?.trigger("stats_changed");

    expect(requireElement(".feedback a", elements.feedback).getAttribute("href")).toBe(
      "#challenge=3,timescale=8",
    );
  });
});

describe("App challenge navigation", () => {
  it("puts a link to every challenge in the bar, marking the one being played", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2"));

    const entries = queryAll(".challengelink", elements.challenge);
    expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
      "Challenge 1",
      "Challenge 2",
      // The last challenge is the endless demo, which is labelled rather than
      // numbered; here that is the third of the test list.
      "Demo",
    ]);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([
      null,
      "page",
      null,
    ]);
  });

  it("keeps the rest of the url when jumping to another challenge", () => {
    // The one implementation of this feature in the wild assigns the whole
    // location hash, so taking a jump throws away the speed and the autostart
    // the player arrived with. Every entry is built from the current
    // parameters instead.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1,timescale=8,autostart=true"));

    expect(
      queryAll(".challengelink", elements.challenge).map((entry) => entry.getAttribute("href")),
    ).toEqual([
      "#challenge=1,timescale=8,autostart=true",
      "#challenge=2,timescale=8,autostart=true",
      "#challenge=3,timescale=8,autostart=true",
    ]);
  });

  it("carries an unknown parameter across a jump as well", () => {
    // parseQuery keeps keys it does not understand, and createParamsUrl round
    // trips them, so a link someone hand-wrote survives being navigated from.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1,fullscreen,somethingelse=7"));

    expect(
      requireElement('[aria-label="Challenge 2"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=2,fullscreen=,somethingelse=7");
  });

  it("starts the challenge a link names when it is clicked", async () => {
    // The whole way round: the anchor navigates, the router hears the hash
    // change and the app starts the challenge it names.
    const { app, elements } = setUp();
    window.location.hash = "#challenge=1,timescale=8";
    const stopRouter = startRouter(
      (params, query) => {
        app.handleRoute(params, query);
      },
      { challengeCount: CHALLENGES.length, defaultTimeScale: () => DEFAULT_TIME_SCALE },
    );

    try {
      requireElement('[aria-label="Challenge 2"]', elements.challenge).click();

      await vi.waitFor(() => {
        expect(app.currentChallengeIndex).toBe(1);
      });
      expect(window.location.hash).toBe("#challenge=2,timescale=8");
      expect(app.worldController.timeScale).toBe(8);
    } finally {
      stopRouter();
      window.location.hash = "";
    }
  });
});

describe("App sandbox", () => {
  it("builds the building the url describes", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,elevators=3,capacities=6-9"));

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
    // Three cars over a two-entry cycle: 6, 9, and 6 again.
    expect(app.world?.elevators.map((elevator) => elevator.maxUsers)).toEqual([6, 9, 6]);
  });

  it("spawns passengers at the rate the url asked for", () => {
    // The spawn rate is not readable off the world, so it is measured. The
    // world starts one spawn interval behind (1.001 / spawnRate), so a first
    // second at 2/s is three passengers and at 0.5/s is one.
    const fast = setUp().app;
    fast.handleRoute(...routeFor("#challenge=sandbox,spawnrate=2"));
    fast.world?.update(1.0);
    expect(fast.world?.users).toHaveLength(3);

    const slow = setUp().app;
    slow.handleRoute(...routeFor("#challenge=sandbox,spawnrate=0.5"));
    slow.world?.update(1.0);
    expect(slow.world?.users).toHaveLength(1);
  });

  it("titles the bar with the parameters in effect, and not as a challenge", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,elevators=3,spawnrate=1.5"));

    const title = requireElement(".challengetitle", elements.challenge);
    expect(title.textContent).toBe(
      "Sandbox: 20 floors, 3 elevators of capacity 4, 1.5 people per second. " +
        "No goal, so the run never ends",
    );
    // There is no twentieth challenge to send anybody to.
    expect(title.textContent).not.toContain("Challenge #");
  });

  it("shows the clamped parameters, not the ones the url asked for", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=100000"));

    expect(requireElement(".challengetitle", elements.challenge).textContent).toContain(
      "Sandbox: 60 floors",
    );
    expect(app.world?.floors).toHaveLength(60);
  });

  it("never ends, however long the run goes on", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=3,spawnrate=2"));
    const world = app.world;

    for (let i = 0; i < 50; i += 1) {
      world?.update(1.0);
    }
    world?.trigger("stats_changed");

    // Fifty simulated seconds with no program running at all: nobody has been
    // delivered and the first passenger has been waiting almost the whole time,
    // which is a loss under every condition in the challenge list, and longer
    // than the time limit of all but the last of them. This is the state a
    // condition would have resolved in if the sandbox had one.
    expect(world?.elapsedTime).toBeGreaterThanOrEqual(50);
    expect(world?.transportedCounter).toBe(0);
    expect(world?.maxWaitTime).toBeGreaterThan(40);
    expect(world?.challengeEnded).toBe(false);
    expect(elements.feedback.innerHTML).toBe("");
  });

  it("leaves every challenge reachable, and marks none of them as current", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));

    const entries = queryAll(".challengelink", elements.challenge);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([null, null, null]);
  });

  it("carries the sandbox parameters into a jump, and out of the sandbox", () => {
    // Deliberate: `challenge` is the one key the row rewrites, so following an
    // entry leaves the sandbox by construction, while the building the player
    // configured stays in the hash, inert, and is still there on the way back.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,timescale=8"));

    expect(
      requireElement('[aria-label="Challenge 2"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=2,floors=20,timescale=8");
  });

  it("stops being the sandbox once a numbered challenge is started", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    app.handleRoute(...routeFor("#challenge=2,floors=20"));

    expect(app.isPlayingSandbox).toBe(false);
    expect(app.world?.floors).toHaveLength(4);
    expect(requireElement(".challengetitle", elements.challenge).textContent).toBe(
      "Challenge #2: Challenge two",
    );
  });

  it("stays in the sandbox when the program is applied", () => {
    // startChallenge(currentChallengeIndex) was what "run this again" used to
    // mean, and it would drop a sandbox player back onto a numbered challenge
    // -- losing the building they had just configured -- on every Ctrl-Enter.
    const { app, editor, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));

    editor.trigger("apply_code");

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
    expect(requireElement(".challengetitle", elements.challenge).textContent).toContain("Sandbox:");
    expect(app.worldController.isPaused).toBe(false);
  });

  it("stays in the sandbox when the world is restarted from the bar", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    // Only reachable once the world has been torn down; the sandbox itself
    // never ends.
    app.world?.unWind();

    requireElement(".startstop", elements.challenge).click();

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
  });
});

describe("App seed", () => {
  /**
   * The passengers a run produces, in the order they appeared.
   *
   * The thing a seed actually promises: who turns up, from where, heading
   * where. Read off a world that has been driven forward by hand, since the
   * spawns are what the seed's own stream decides.
   *
   * The step is a parameter because the browser's is not fixed -- `dt` there
   * comes from `requestAnimationFrame` -- and the promise in the bar has to
   * survive that, not merely a clock this file drives itself.
   *
   * @param app - The app whose world to run and read.
   * @param seconds - How many simulated seconds to run for.
   * @param step - Simulated seconds per frame; a power of one half, so that the
   * total is reached exactly whichever step is used.
   * @returns One entry per passenger, as `from>to`.
   */
  function passengerStream(app: App, seconds: number, step = 1.0): string[] {
    for (let elapsed = 0; elapsed < seconds; elapsed += step) {
      app.world?.update(step);
    }
    return (app.world?.users ?? []).map(
      (user) => `${String(user.currentFloor)}>${String(user.destinationFloor)}`,
    );
  }

  it("builds the world from the seed the url pins", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");
  });

  it("draws a seed of its own when the url pins none, and records it", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1"));
    expect(typeof app.world?.seed).toBe("number");
  });

  it("brings one seed's passengers back whatever the frame length", () => {
    // The promise the bar makes, tested the way the browser breaks it: two runs
    // of one URL, fed frames of different lengths, and the same people appear in
    // the same order, from the same floors, wanting the same destinations.
    //
    // Stepping both by the same clock would prove only that a PRNG is a PRNG.
    // Varying it is what has teeth: before `e2cc0b5` this failed, because the
    // re-press offset in `src/game/world.ts` and the walk-off duration in
    // `src/game/user.ts` drew from the stream the passengers came from, at
    // moments the frame length decided. If either goes back into it, this test
    // is what says so.
    //
    // How many have arrived by a given second is not part of the promise -- the
    // spawn accumulator crosses its threshold at frame boundaries -- so the two
    // are compared as far as they both go.
    const first = setUp().app;
    first.handleRoute(...routeFor("#challenge=sandbox,floors=8,spawnrate=2,seed=issue-61"));
    const second = setUp().app;
    second.handleRoute(...routeFor("#challenge=sandbox,floors=8,spawnrate=2,seed=issue-61"));

    const slow = passengerStream(first, 10, 1.0);
    const fast = passengerStream(second, 10, 0.25);
    const shared = Math.min(slow.length, fast.length);

    expect(shared).toBeGreaterThan(15);
    expect(fast.slice(0, shared)).toEqual(slow.slice(0, shared));
  });

  it("gives two unseeded runs different passengers", () => {
    const first = setUp().app;
    first.handleRoute(...routeFor("#challenge=sandbox,floors=8,spawnrate=2"));
    const second = setUp().app;
    second.handleRoute(...routeFor("#challenge=sandbox,floors=8,spawnrate=2"));

    expect(first.world?.seed).not.toBe(second.world?.seed);
    expect(passengerStream(second, 10)).not.toEqual(passengerStream(first, 10));
  });

  it("restarts a pinned run on the same seed, however it is restarted", () => {
    // The reason somebody writes #seed= into the address bar at all: the
    // Restart button and Ctrl-Enter both have to give back the run they were
    // comparing programs on.
    const { app, editor, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=3,seed=issue-61"));

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.challenge).click();
    expect(app.world?.seed).toBe("issue-61");

    editor.trigger("apply_code");
    expect(app.world?.seed).toBe("issue-61");
  });

  it("draws a fresh seed on every restart when the url pins none", () => {
    // Deliberate, and the counterpart of the rule above: reusing the last
    // generated seed would leave a player who is stuck on a challenge stuck on
    // one passenger stream, with no way to another draw short of editing the
    // address bar. The seed of every run is printed, so pinning after the fact
    // is a click away.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));
    const first = app.world?.seed;

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.challenge).click();

    expect(app.world?.seed).not.toBe(first);
  });

  it("keeps the pinned seed when another challenge is started", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));
    app.handleRoute(...routeFor("#challenge=2,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");
  });

  it("stops pinning as soon as the url stops asking", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));
    app.handleRoute(...routeFor("#challenge=1"));
    expect(app.world?.seed).not.toBe("issue-61");
  });

  it("offers the seed of the run in the bar, keeping the rest of the url", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8"));
    const seed = String(app.world?.seed);

    const link = requireElement(".seedlink", elements.challenge);
    expect(link.textContent).toBe(seed);
    expect(link.getAttribute("href")).toBe(`#challenge=2,timescale=8,seed=${seed}`);
  });

  it("replaces the seed in the url rather than adding a second one", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,seed=issue-61"));

    expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
      "#challenge=2,seed=issue-61",
    );
  });

  it("leaves a pinned seed behind when the row jumps to another challenge", () => {
    // A seed was drawn for one building and means nothing in another, so the row
    // carries the speed and everything else but not this. It is also the way out
    // of a pinned run: the row's entry for the challenge being played is a fresh
    // draw of it, which is the only reason a player who once followed the seed
    // link is not stuck with it forever.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1,timescale=8,seed=issue-61"));

    expect(
      requireElement('[aria-label="Challenge 2"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=2,timescale=8");
    expect(
      requireElement('[aria-label="Challenge 1"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=1,timescale=8");
  });

  it("offers the seed of a sandbox run as well", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,seed=issue-61"));

    expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
      "#challenge=sandbox,floors=20,seed=issue-61",
    );
  });

  it("prints the seed and a whole url at every start", () => {
    // The affordance that matters most: nobody knows a run is worth repeating
    // until it has already gone wrong, and by then this line is the only record
    // of what it was.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));

    expect(console.log).toHaveBeenCalledWith(
      `Seed issue-61 — the same passengers again, though never quite the same run: ` +
        `${window.location.origin}/#challenge=1,seed=issue-61`,
    );
  });

  it("offers the passengers back, and says the run is not, because it is not", () => {
    // The controller takes its dt from requestAnimationFrame timestamps, so the
    // cars stand somewhere else as each passenger appears and the player's
    // program is asked to decide at different moments. The people repeat; what
    // happens to them does not. Only the headless paths -- the fitness suite and
    // these tests -- repeat a run step for step.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));

    const printed = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain("never quite the same run");
    expect(printed[0]).not.toMatch(/exact|identical|replay/i);
  });

  it("prints a fresh line for every run, including a restart", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));
    vi.mocked(console.log).mockClear();

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.challenge).click();

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log).mock.calls[0]?.[0]).toContain(String(app.world?.seed));
  });

  it("pins the seed of the run when the link in the bar is followed", async () => {
    // The whole way round: the anchor navigates, the router hears the hash
    // change, and the app rebuilds the world on the seed that was on screen.
    const { app, elements } = setUp();
    window.location.hash = "#challenge=1";
    const stopRouter = startRouter(
      (params, query) => {
        app.handleRoute(params, query);
      },
      { challengeCount: CHALLENGES.length, defaultTimeScale: () => DEFAULT_TIME_SCALE },
    );

    try {
      const seed = String(app.world?.seed);
      requireElement(".seedlink", elements.challenge).click();

      await vi.waitFor(() => {
        expect(window.location.hash).toBe(`#challenge=1,seed=${seed}`);
      });
      expect(app.world?.seed).toBe(seed);
      // And what it now offers is the URL it is already at, so a second visit
      // is the same seed again rather than another draw.
      expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
        `#challenge=1,seed=${seed}`,
      );
    } finally {
      stopRouter();
      window.location.hash = "";
    }
  });
});

describe("App focus", () => {
  it("hands focus to the start button when the next-challenge link is taken", () => {
    // Activating the link navigates, which starts the next challenge, which
    // empties the overlay the link is in. The anchor is deleted under the
    // player's feet and focus falls back to <body>, so whoever just asked for
    // the next challenge is dropped at the top of the page instead of arriving
    // at it.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2"));
    app.world?.trigger("stats_changed");
    const link = requireElement(".feedback a", elements.feedback);
    link.focus();
    expect(document.activeElement).toBe(link);

    // What the router does once the link's hash navigation arrives.
    app.handleRoute(...routeFor("#challenge=3"));

    const startStop = requireElement(".startstop", elements.challenge);
    expect(document.activeElement).toBe(startStop);
    // Focused after it has its label, so it is not announced unnamed.
    expect(startStop.textContent).toBe("Start");
  });

  it("keeps focus in the navigation row when a challenge is taken from it", () => {
    // Tabbing to "Challenge 2" and pressing it rebuilds the bar under the
    // player's feet, exactly as the next-challenge link does. They stay where
    // they were: on the entry that replaced the one they pressed, which is now
    // the current challenge.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1"));
    requireElement('[aria-label="Challenge 2"]', elements.challenge).focus();

    app.handleRoute(...routeFor("#challenge=2"));

    const entry = requireElement('[aria-label="Challenge 2"]', elements.challenge);
    expect(document.activeElement).toBe(entry);
    expect(entry.getAttribute("aria-current")).toBe("page");
  });

  it("hands focus to the start button when the building it was in is torn down", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    requireElement(".floor button.up", elements.world).focus();

    app.startChallenge(1);

    expect(document.activeElement).toBe(requireElement(".startstop", elements.challenge));
  });

  it("leaves focus alone when the challenge is restarted from the editor", () => {
    // Ctrl-Enter applies the program, which restarts the challenge. Pulling
    // focus out of the editor on every apply would be worse than the bug.
    const { app, editor } = setUp();
    app.startChallenge(0);
    const elsewhere = createElement("textarea");
    document.body.append(elsewhere);
    elsewhere.focus();

    editor.trigger("apply_code");

    expect(document.activeElement).toBe(elsewhere);
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

describe("TIME_SCALE_STORAGE_KEY", () => {
  it("is exactly the key the legacy game wrote", () => {
    // An on-disk compatibility contract with the browser of every player who
    // has ever played: renaming the constant compiles, and every test that
    // goes through the constant keeps passing, while quietly forgetting the
    // speed they had chosen. The literal is pinned here on purpose.
    expect(TIME_SCALE_STORAGE_KEY).toBe("elevatorTimeScale");
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
