// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Challenge } from "../game/challenges.ts";
import { tutorialTasks } from "../game/tutorial.ts";
import type { TutorialTask } from "../game/tutorial.ts";
import { createWorldController } from "../game/world-controller.ts";
import type { WorldController } from "../game/world-controller.ts";
import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import { defaultCode } from "../ui/default-code.ts";
import { queryAll, requireElement } from "../ui/dom.ts";
import { CODE_STORAGE_KEY, CodeEditor } from "../ui/editor.ts";
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
    tutorial: createElement("div", { className: "tutorial" }),
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
    elements.tutorial,
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
  // Restored here rather than at the end of the test that switches, so that a
  // failing assertion cannot leave the rest of the file running in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

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

  it("says both outcomes in the language the overlay is drawn in", () => {
    // The four words the app itself owns; everything else in the overlay comes
    // from the templates. Read out of the catalogue when the challenge ends, so
    // a player who switched language mid-run is told in the language they are
    // now reading.
    setLocale("ru");
    const won = setUp();
    won.app.startChallenge(1);
    won.app.world?.trigger("stats_changed");
    const lost = setUp();
    lost.app.startChallenge(2);
    lost.app.world?.trigger("stats_changed");

    expect(requireElement(".feedback h2", won.elements.feedback).textContent).toBe("Получилось!");
    expect(requireElement(".feedback p", won.elements.feedback).textContent).toBe(
      "Задание выполнено",
    );
    expect(requireElement(".feedback h2", lost.elements.feedback).textContent).toBe(
      "Задание провалено",
    );
    expect(requireElement(".feedback p", lost.elements.feedback).textContent).toBe(
      "Может быть, программу стоит доработать?",
    );
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

describe("App learning track", () => {
  // Same reason as the outcome specs above: a failed assertion must not leave
  // the rest of the file in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /**
   * The task at a position in the track.
   *
   * Read out of the real table rather than a fixture, unlike the challenges
   * these specs play, because the table is what the app plays: `startTutorial`
   * takes a position in `tutorialTasks`, the router resolves an address against
   * the same array, and a stand-in track would prove the wiring against
   * something no player can reach.
   *
   * @param index - Position in the track, counted from zero.
   * @returns The task there.
   * @throws Error When the track is shorter than that.
   */
  function taskAt(index: number): TutorialTask {
    const task = tutorialTasks[index];
    if (task === undefined) {
      throw new Error(`The learning track has no task at position ${String(index)}`);
    }
    return task;
  }

  /**
   * Ends the run on screen, one way or the other.
   *
   * Every condition on the track asks for passengers within a time limit, so a
   * run is won by having delivered more than any task asks for while the clock
   * is still young, and lost by letting the clock run out with nobody delivered.
   * Written into the counters rather than played out, because what these specs
   * are about is what the app does with a verdict; that the tasks can actually
   * be lost by the program the player is handed and won by the answer they are
   * shown is what `src/game/tutorial-solutions.test.ts` proves, by playing them.
   *
   * @param app - The app whose run to end.
   * @param won - The verdict to produce.
   */
  function endRun(app: App, won: boolean): void {
    const world = app.world;
    if (world === undefined) {
      throw new Error("There is no run to end");
    }
    world.transportedCounter = won ? 1000 : 0;
    world.elapsedTime = won ? 1 : 1000;
    world.trigger("stats_changed");
  }

  /**
   * Where the editor keeps one task's program.
   *
   * Spelled out here as it is in `editor.test.ts`: the prefix is private to the
   * editor, and a test that imported it could not tell a renamed key from a
   * working one — the very thing the key exists to be stable about, since it
   * holds a program the player typed.
   */
  const TASK_2_CODE_KEY = "develevateTutorialCode_tutorial-2";

  it("plays the task the url names rather than challenge 1", () => {
    // Until the route was dispatched on `tutorialIndex`, `#challenge=tutorial-5`
    // fell through to the challenge branch, which resolves anything it does not
    // understand to challenge 1 -- so the game played challenge 1 while the
    // address bar went on saying `tutorial-5`, and a reload never escaped it.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));

    app.handleRoute(...routeFor("#challenge=tutorial-5"));

    expect(app.tutorial?.task.id).toBe("tutorial-5");
    expect(app.tutorial?.index).toBe(4);
    expect(app.isPlayingSandbox).toBe(false);
    expect(app.world?.floors.length).toBe(taskAt(4).options.floorCount);
    // Where a restart would send them back to, left where the challenge put it,
    // exactly as the sandbox leaves it: the track is not a station on the ladder.
    expect(app.currentChallengeIndex).toBe(2);
  });

  it("runs a task without waiting when the url asks it to", () => {
    const { app, worldController } = setUp();
    app.handleRoute(...routeFor("#challenge=tutorial-2,autostart=true"));
    expect(worldController.isPaused).toBe(false);
  });

  it("builds a task on its own pinned seed rather than a fresh draw", () => {
    // The lesson is "this program loses and that one wins", which is a statement
    // about a particular stream of passengers. On a random draw it would be a
    // coin flip, and a player could be shown a mistake that happened to squeak
    // past -- the opposite of what the task is for.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=tutorial-3"));
    expect(app.world?.seed).toBe(taskAt(2).seed);
  });

  it("keeps the task's seed when the url is still carrying a challenge's", () => {
    // The router refuses `seed` on a task address, so the two can only disagree
    // from inside the app -- the panel's own restart, Ctrl-Enter, the Restart
    // button -- and then it is the leftover from the challenge just left that
    // has to lose.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=2,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");

    app.startTutorial(0);

    expect(app.world?.seed).toBe(taskAt(0).seed);
  });

  it("offers no seed line, and prints none, because both halves of it are refused", () => {
    // "The same passengers again" would write `seed=` into an address the router
    // refuses it on, and "a new draw" would offer to stop pinning the seed the
    // task pins. A line that undoes itself is worse than no line, and the
    // console print is built from the same data.
    const { app, elements } = setUp();
    app.startTutorial(0);

    expect(elements.challenge.querySelector(".challengeseed")).toBeNull();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("hands a task nobody has opened its starting program", () => {
    const { app, view } = setUp();
    app.startTutorial(0);
    expect(view.getValue()).toBe(taskAt(0).startingCode);
  });

  it("opens the task's buffer before the run compiles anything", () => {
    // Ordering, tested by its consequence. `#startRun` compiles whatever is in
    // the editor at the moment it starts, so a buffer opened afterwards would
    // run the previous buffer's program in this task's building for one run.
    // The stored attempt does not compile and the player's program does, so the
    // banner is here only if the switch happened first.
    const { app, elements, storage, view } = setUp();
    storage.setItem(TASK_2_CODE_KEY, "{ this is not javascript");

    app.startTutorial(1);

    expect(view.getValue()).toBe("{ this is not javascript");
    expect(requireElement(".errormessage", elements.codeStatus).textContent).not.toBe("");
  });

  it("puts the player's own program back on the way out", () => {
    const { app, storage, view } = setUp();
    storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
    app.startTutorial(0);
    expect(view.getValue()).not.toBe(INERT_CODE);

    app.leaveTutorial();

    expect(app.tutorial).toBeUndefined();
    expect(view.getValue()).toBe(INERT_CODE);
    // Challenge one, and not wherever the player came from: the track is what
    // somebody plays before they have a challenge to go back to.
    expect(app.currentChallengeIndex).toBe(0);
  });

  it("leaves the track for the sandbox as readily as for a challenge", () => {
    // Every way out goes through one of the two other starts, which is why both
    // of them close the buffer rather than the router doing it once.
    const { app, storage, view } = setUp();
    storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
    app.startTutorial(2);

    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));

    expect(app.tutorial).toBeUndefined();
    expect(app.isPlayingSandbox).toBe(true);
    expect(view.getValue()).toBe(INERT_CODE);
  });

  it("repeats the task when the program is applied, not the last challenge played", () => {
    // `startChallenge(currentChallengeIndex)` was what "run this again" used to
    // mean. On the track it would apply the player's edit to a different
    // building and take the attempt they were half-way through off the screen.
    const { app, editor, view } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));
    app.startTutorial(2);
    view.type("// half an answer");
    const before = app.world;

    editor.trigger("apply_code");

    expect(app.world).not.toBe(before);
    expect(app.tutorial?.task.id).toBe("tutorial-3");
    expect(app.world?.floors.length).toBe(taskAt(2).options.floorCount);
    expect(app.worldController.isPaused).toBe(false);
    // Reopening the buffer already on screen is a no-op, so the attempt being
    // applied is still there to edit.
    expect(view.getValue()).toBe("// half an answer");
  });

  it("repeats the task from the bar's restart button", () => {
    const { app, elements } = setUp();
    app.startTutorial(1);
    // Only reachable once the run is over, which on a task is the ordinary case.
    app.world?.unWind();

    requireElement(".startstop", elements.challenge).click();

    expect(app.tutorial?.task.id).toBe("tutorial-2");
    expect(app.world?.challengeEnded).toBe(false);
  });

  it("numbers the bar's title in the track rather than in the challenge list", () => {
    const { app, elements } = setUp();
    app.startTutorial(2);

    const title = requireElement(".challengetitle", elements.challenge);
    expect(title.textContent).toBe(
      `Tutorial task 3 of ${String(tutorialTasks.length)}: ` +
        "Transport 15 people in 60 seconds or less",
    );
    // There is no challenge #0 to send anybody to, and the router refuses it.
    expect(title.textContent).not.toContain("Challenge #");
  });

  it("keeps the task's own title through a language change mid-run", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    setLocale("ru");
    app.relocalise();

    const title = requireElement(".challengetitle", elements.challenge);
    expect(title.textContent).toBe(
      `Учебное задание 1 из ${String(tutorialTasks.length)}: ` +
        "Перевезите 10 пассажиров за 60 секунд или быстрее",
    );
    // What the bar's own template would have written, had the retitle not run.
    expect(title.textContent).not.toContain("№0");
  });

  it("leaves every challenge reachable from a task, and marks none of them current", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=tutorial-4,timescale=8"));

    const entries = queryAll(".challengelink", elements.challenge);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([null, null, null]);
    expect(entries[1]?.getAttribute("href")).toBe("#challenge=2,timescale=8");
  });

  it("offers the next task, by name, after a win in the middle of the track", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, true);

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Success!");
    const link = requireElement(".feedback a", elements.feedback);
    expect(link.getAttribute("href")).toBe(`#challenge=${taskAt(1).id}`);
    // "Next challenge" is what the shared template writes into every such link,
    // and the numbered ladder is not where task 2 lives.
    expect(link.textContent.trim()).toBe("Next task");
    // The caret the template put beside the words survives being relabelled.
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("ends the track by offering challenge 1 and the program that clears it", () => {
    const { app, elements } = setUp();
    app.startTutorial(tutorialTasks.length - 1);

    endRun(app, true);

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe(
      "The track is finished",
    );
    const link = requireElement(".feedback a", elements.feedback);
    expect(link.getAttribute("href")).toBe("#challenge=1");
    expect(link.textContent.trim()).toBe("Go to challenge 1 with this program");
  });

  it("says a lost task is lost, and offers nothing", () => {
    // The expected first outcome on the track: the player is meant to go back to
    // the editor, where the hints are, rather than onwards.
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, false);

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Challenge failed");
    expect(elements.feedback.querySelector("a")).toBeNull();
  });

  it("counts a cleared task, and counts it once however often it is cleared", () => {
    const { app } = setUp();
    expect(app.tutorialProgress()).toEqual({ cleared: 0, count: tutorialTasks.length });

    app.startTutorial(0);
    endRun(app, true);
    expect(app.tutorialProgress().cleared).toBe(1);

    app.startTutorial(0);
    endRun(app, true);
    expect(app.tutorialProgress().cleared).toBe(1);
  });

  it("redraws a task's verdict in the new language, link and all", () => {
    // `relocalise` draws the remembered outcome again, and it has to arrive back
    // at the same three decisions: the task's overlay rather than a challenge's,
    // the address of the next task rather than the next challenge, and the words
    // the template does not have. Drawing it from the outcome alone is what
    // makes that possible, and a redraw that lost any of the three would put a
    // link labelled "Следующее задание" -- the numbered ladder -- in front of a
    // player half-way through the track.
    const { app, elements } = setUp();
    app.startTutorial(0);
    endRun(app, true);

    setLocale("ru");
    app.relocalise();

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Получилось!");
    const link = requireElement(".feedback a", elements.feedback);
    expect(link.getAttribute("href")).toBe(`#challenge=${taskAt(1).id}`);
    expect(link.textContent.trim()).toBe("Следующее учебное задание");
    expect(app.tutorialProgress().cleared).toBe(1);
  });

  it("counts nothing for a task that was lost", () => {
    const { app } = setUp();
    app.startTutorial(0);

    endRun(app, false);

    expect(app.tutorialProgress().cleared).toBe(0);
  });

  it("knows whether taking a task's program would overwrite one of the player's", () => {
    // Asked before the panel offers to confirm. An empty store is not a program
    // of theirs, and neither is the one the game itself put there: confirming
    // the replacement of a program nobody typed teaches players to dismiss the
    // question, and the one time it matters is the time they do it without
    // reading.
    const { app, storage } = setUp();
    expect(app.playerCodeWouldBeReplaced()).toBe(false);

    storage.setItem(CODE_STORAGE_KEY, defaultCode());
    expect(app.playerCodeWouldBeReplaced()).toBe(false);

    storage.setItem(CODE_STORAGE_KEY, "   \n  ");
    expect(app.playerCodeWouldBeReplaced()).toBe(false);

    storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
    expect(app.playerCodeWouldBeReplaced()).toBe(true);
  });

  it("copies the program into the player's editor without leaving the task", () => {
    // The button means "I want to keep this", not "I am done here": somebody who
    // takes the answer to task 4 usually wants to go on reading task 4.
    const { app, storage, view } = setUp();
    app.startTutorial(3);
    view.type("// my answer to task 4");

    expect(app.takeTutorialCode()).toBe(true);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// my answer to task 4");
    expect(app.tutorial?.index).toBe(3);
    expect(view.getValue()).toBe("// my answer to task 4");
  });

  it("refuses a position that does not name a task", () => {
    // Symmetric with `startChallenge`: the router resolves a task address
    // against the same table, so this is only reachable from a caller that made
    // the position up, and a made-up position must not quietly play task 1.
    const { app } = setUp();
    expect(() => {
      app.startTutorial(99);
    }).toThrow(RangeError);
  });

  describe("the panel between the bar and the building", () => {
    /**
     * What the panel says about where the player is, if it is drawn at all.
     *
     * @param elements - The page shell the app was built over.
     * @returns The position line's text, or `null` when the region is empty.
     */
    function positionLine(elements: AppElements): string | null {
      return elements.tutorial.querySelector(".tutorialposition")?.textContent ?? null;
    }

    it("draws the panel for the task on screen", () => {
      const { app, elements } = setUp();
      app.startTutorial(2);

      expect(positionLine(elements)).toBe(
        `Learning track Task 3 of ${String(tutorialTasks.length)}`,
      );
      expect(requireElement(".tutorialtitle", elements.tutorial).textContent).toBe(
        "The buttons inside the car",
      );
      expect(requireElement(".tutorialsolution code", elements.tutorial).textContent).toBe(
        taskAt(2).solutionCode,
      );
    });

    it("leaves the region empty everywhere else, so the page has no gap in it", () => {
      // Nineteen challenges, the sandbox and the demo all go through the same
      // draw, and the stylesheet hides the region only while it is empty. The
      // last task's hints left above challenge 1 would be worse than a gap: they
      // are the answer to a task nobody is playing.
      const { app, elements } = setUp();
      expect(elements.tutorial.children).toHaveLength(0);

      app.startTutorial(2);
      expect(elements.tutorial.children).toHaveLength(1);

      app.startChallenge(0);
      expect(elements.tutorial.children).toHaveLength(0);

      app.startTutorial(2);
      app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
      expect(elements.tutorial.children).toHaveLength(0);
    });

    it("redraws the panel when the language changes under it", () => {
      // The panel is most of the words on the page while a task is on screen,
      // so a language change that missed it would leave the game in English
      // with a Russian bar over it.
      const { app, elements } = setUp();
      app.startTutorial(0);

      setLocale("ru");
      app.relocalise();

      expect(positionLine(elements)).toBe(
        `Учебная дорожка Задание 1 из ${String(tutorialTasks.length)}`,
      );
      expect(requireElement(".tutorialtitle", elements.tutorial).textContent).toBe(
        "Лифт, который никуда не едет",
      );
    });

    it("counts the task just cleared without waiting for the next draw", () => {
      // The verdict is drawn over the panel, and the panel is behind it saying
      // how far along the track the player is. Without the redraw it would say
      // "0 of 8 tasks done" underneath an overlay congratulating them on the
      // first, until they started something else.
      const { app, elements } = setUp();
      app.startTutorial(0);
      expect(requireElement(".tutorialprogress", elements.tutorial).textContent).toBe(
        `0 of ${String(tutorialTasks.length)} tasks done`,
      );

      endRun(app, true);

      expect(requireElement(".tutorialprogress", elements.tutorial).textContent).toBe(
        `1 of ${String(tutorialTasks.length)} tasks done`,
      );
    });

    it("starts the task again from the panel's own button, and waits for Start", () => {
      // The same private restart the bar's button and Ctrl-Enter go through, so
      // two buttons that say the same thing do the same thing.
      const { app, elements } = setUp();
      app.startTutorial(1);
      const before = app.world;

      requireElement(".tutorialrestart", elements.tutorial).click();

      expect(app.world).not.toBe(before);
      expect(app.tutorial?.task.id).toBe("tutorial-2");
      expect(app.worldController.isPaused).toBe(true);
    });

    it("takes the task's program into the player's editor from the panel", () => {
      const { app, elements, storage, view } = setUp();
      app.startTutorial(3);
      view.type("// the answer, copied out of the hint");

      requireElement(".tutorialtakecode", elements.tutorial).click();

      expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// the answer, copied out of the hint");
      // Still on the task: the button means "I want to keep this", not "I am
      // done here".
      expect(app.tutorial?.index).toBe(3);
      // And the player is told, because the buffer it went into is not on screen
      // from the track: without this line the button is one that visibly does
      // nothing.
      expect(requireElement(".tutorialtaken", elements.tutorial).textContent).toBe(
        "Copied into the game editor, waiting when you leave the track.",
      );
    });

    it("tells the player when the store refused, instead of claiming it worked", () => {
      // A browser with storage switched off is the case `takeTutorialCode`
      // returns `false` for, and the panel is where that answer is spent: the
      // program is not waiting for them, and the useful thing to say is how to
      // keep it by hand.
      const { app, elements, storage } = setUp();
      app.startTutorial(3);
      vi.spyOn(storage, "setItem").mockImplementation(() => {
        throw new Error("The quota is exhausted");
      });

      requireElement(".tutorialtakecode", elements.tutorial).click();

      expect(requireElement(".tutorialtaken", elements.tutorial).textContent).toBe(
        "Your browser refused to store it. Copy the program out of the editor by hand to keep it.",
      );
      // The refusal is not an error for the player to deal with: the run they
      // are in does not depend on this write, and they are still on the task.
      expect(app.tutorial?.index).toBe(3);
    });

    it("asks the app, not itself, whether that would overwrite a program", () => {
      // The panel has no idea what is in the player's editor; `App` does, and
      // answers at the moment the button is pressed. A player who wrote their
      // first program during task 5 must not have it taken away in silence.
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const { app, elements, storage } = setUp();
      app.startTutorial(4);
      requireElement(".tutorialtakecode", elements.tutorial).click();
      expect(confirm).not.toHaveBeenCalled();

      storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
      requireElement(".tutorialtakecode", elements.tutorial).click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(storage.getItem(CODE_STORAGE_KEY)).toBe(INERT_CODE);
    });

    it("leaves the track from the panel's own button", () => {
      const { app, elements, storage, view } = setUp();
      storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
      app.startTutorial(2);

      requireElement(".tutorialleave", elements.tutorial).click();

      expect(app.tutorial).toBeUndefined();
      expect(app.currentChallengeIndex).toBe(0);
      expect(elements.tutorial.children).toHaveLength(0);
      expect(view.getValue()).toBe(INERT_CODE);
    });

    it("keeps the focus on the page when the button pressed was in the panel", () => {
      // Leaving the track deletes the button that was pressed along with the
      // rest of the panel, and the focus would fall back to the document -- the
      // whole page to tab through again (WCAG 2.4.3). The bar is drawn before
      // the panel is emptied, and it is the bar that catches the focus, exactly
      // as it does when the Restart button destroys itself.
      const { app, elements } = setUp();
      app.startTutorial(2);
      const leave = requireElement(".tutorialleave", elements.tutorial);
      leave.focus();

      leave.click();

      expect(document.activeElement).toBe(requireElement(".startstop", elements.challenge));
    });
  });
});

describe("App seed", () => {
  // One spec below reads the console line in Russian; same reason as the blocks
  // above, a failed assertion must not leave the rest of the file in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

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
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=2,seed=issue-61"));

    // The bar does not offer to pin a run the URL already pins, so what carries
    // the address of a pinned run is the line printed as it starts -- and it has
    // to name the seed once, not twice.
    const printed = String(vi.mocked(console.log).mock.calls[0]?.[0]);
    expect(printed).toContain("#challenge=2,seed=issue-61");
    expect(printed.match(/seed=/g)).toHaveLength(1);
  });

  it("leaves a pinned seed behind when the row jumps to another challenge", () => {
    // A seed was drawn for one building and means nothing in another, so the row
    // carries the speed and everything else but not this. What the row is not is
    // the way out of a pinned run: it has no entry for the sandbox, and pressing
    // the challenge already being played is not a move anybody would find. That
    // is the seed line's "new draw", below.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1,timescale=8,seed=issue-61"));

    expect(
      requireElement('[aria-label="Challenge 2"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=2,timescale=8");
    expect(
      requireElement('[aria-label="Challenge 1"]', elements.challenge).getAttribute("href"),
    ).toBe("#challenge=1,timescale=8");
  });

  it("offers the seed of a sandbox run as well, building and all", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    const seed = String(app.world?.seed);

    expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
      `#challenge=sandbox,floors=20,seed=${seed}`,
    );
  });

  it("gives both seed links an address even when the url is empty", () => {
    // A first visit has no hash at all. "Everything you are carrying, minus the
    // seed" is then nothing at all, and a hash can only spell that `#` -- which
    // navigates, but is also the fragment meaning "the top of this document",
    // so the browser scrolls there on the way out of a pinned run. Both links
    // name the challenge, so neither ever degenerates to one.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor(""));
    const seed = String(app.world?.seed);

    expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
      `#challenge=1,seed=${seed}`,
    );

    app.handleRoute(...routeFor("#seed=issue-61"));

    expect(requireElement(".seednewdraw", elements.challenge).getAttribute("href")).toBe(
      "#challenge=1",
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

  it("prints it in the language the player is reading", () => {
    // The one console line in the game that goes through the catalogue. Every
    // other one reports something -- a bug, a URL that would not parse, a
    // broken invariant -- and is addressed to whoever is reading a stack beside
    // it; this one reports nothing and is addressed to the player, at every
    // successful start, so a Russian player getting it in English is the same
    // gap as an English sentence anywhere else on the page.
    setLocale("ru");
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));

    expect(console.log).toHaveBeenCalledWith(
      `Сид issue-61 — снова те же пассажиры, но прогон каждый раз складывается немного иначе: ` +
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

      // Waited on the world rather than on the hash, because the hash is the
      // first half of the round trip and not the last: following the anchor
      // rewrites it synchronously, and `hashchange` -- the event the router is
      // listening for -- is dispatched after. A wait that ends at the hash can
      // therefore end before the app has heard anything, and the assertion below
      // catches the world still running on the number it drew at start-up rather
      // than the string the URL now carries. Under load it did, about one run in
      // three.
      await vi.waitFor(() => {
        expect(app.world?.seed).toBe(seed);
      });
      expect(window.location.hash).toBe(`#challenge=1,seed=${seed}`);
      // And what it offers now is the way back out, since the way in is the URL
      // the player is already at.
      expect(elements.challenge.querySelector(".seedlink")).toBeNull();
      expect(requireElement(".seednewdraw", elements.challenge).getAttribute("href")).toBe(
        "#challenge=1",
      );
    } finally {
      stopRouter();
      window.location.hash = "";
    }
  });

  it("offers no way out of a run nothing has pinned", () => {
    // There would be nowhere for it to go: the URL without a seed is the one
    // the player is already at, so the link would fire no hashchange and do
    // nothing at all.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8"));

    expect(elements.challenge.querySelector(".seednewdraw")).toBeNull();
    expect(requireElement(".seedlink", elements.challenge)).not.toBeNull();
  });

  it("offers a way back to a fresh draw once the url pins the seed", () => {
    // The counterweight to pinning being one click: unpinning is one click too,
    // and neither of them needs the address bar.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8,seed=issue-61"));

    expect(requireElement(".seednewdraw", elements.challenge).getAttribute("href")).toBe(
      "#challenge=2,timescale=8",
    );
  });

  it("keeps the sandbox building when the pin is taken back out", () => {
    // The case the navigation row cannot answer at all: it has no entry for the
    // sandbox, so every entry it offers leaves the building behind.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,seed=issue-61"));

    expect(requireElement(".seednewdraw", elements.challenge).getAttribute("href")).toBe(
      "#challenge=sandbox,floors=20",
    );
  });

  it("treats a seed the router refused as no pin at all", () => {
    // A browser percent-encodes the space in "#seed=rush hour", so what reaches
    // the router is "rush%20hour" -- which is the form written here, because a
    // fixture the app cannot be handed proves nothing about the app. The `%`
    // fails SEED_PATTERN, the router draws a fresh seed, and nothing is pinned,
    // so there is nothing to unpin -- and the refused text must not follow the
    // player around the bar, re-warning on arrival at every link it reaches.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=rush%20hour"));
    const seed = String(app.world?.seed);

    expect(elements.challenge.querySelector(".seednewdraw")).toBeNull();
    expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
      `#challenge=1,seed=${seed}`,
    );
    const hrefs = queryAll("a", elements.challenge).map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.includes("rush"))).toEqual([]);
  });

  it("draws again from a new seed when the way out is followed", async () => {
    // The whole way back: the anchor navigates to the URL without the seed, the
    // router hears it, and the app draws a run nobody chose.
    const { app, elements } = setUp();
    window.location.hash = "#challenge=1,seed=issue-61";
    const stopRouter = startRouter(
      (params, query) => {
        app.handleRoute(params, query);
      },
      { challengeCount: CHALLENGES.length, defaultTimeScale: () => DEFAULT_TIME_SCALE },
    );

    try {
      expect(app.world?.seed).toBe("issue-61");
      requireElement(".seednewdraw", elements.challenge).click();

      await vi.waitFor(() => {
        expect(window.location.hash).toBe("#challenge=1");
      });
      expect(app.world?.seed).not.toBe("issue-61");
      // And the line offers to pin what it drew, so the round trip closes.
      expect(requireElement(".seedlink", elements.challenge).getAttribute("href")).toBe(
        `#challenge=1,seed=${String(app.world?.seed)}`,
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

describe("App.relocalise", () => {
  // Same reason as the outcome specs above: a failed assertion must not leave
  // the rest of the file in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("rewrites the challenge bar in the language chosen part-way through a run", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    expect(requireElement(".challengetitle", elements.challenge).textContent).toBe(
      "Challenge #1: Challenge one",
    );

    setLocale("ru");
    app.relocalise();

    // The description is the fixture's own markup and stays English; the
    // sentence the game wraps it in, and every control beside it, do not.
    expect(requireElement(".challengetitle", elements.challenge).textContent).toBe(
      "Задание №1: Challenge one",
    );
    expect(requireElement(".startstop", elements.challenge).textContent).toBe("Старт");
    expect(requireElement(".challengenav", elements.challenge).ariaLabel).toBe("Задания");
  });

  it("writes the statistics the way a reader of the new language writes numbers", () => {
    // The labels beside these figures are shell and `localisePage` has already
    // dealt with them. The figures themselves go through `Intl`, and they are
    // written only when the world says they changed -- so if the language change
    // did not make the world say so, they would sit here in English until the
    // next tick of a paused clock, which may never come.
    const { app, elements } = setUp();
    app.startChallenge(0);
    const world = app.world;
    if (world === undefined) {
      throw new Error("The challenge did not start");
    }
    world.transportedCounter = 1234;
    world.elapsedTime = 2675;
    world.trigger("stats_display_changed");
    expect(requireElement(".elapsedtime", elements.stats).textContent).toBe("2,675s");

    setLocale("ru");
    app.relocalise();

    // A non-breaking space between the thousands and before the unit, both of
    // which `Intl` chooses and neither of which English has.
    expect(requireElement(".elapsedtime", elements.stats).textContent).toBe("2 675 с");
    expect(requireElement(".transportedcounter", elements.stats).textContent).toBe("1 234");
  });

  it("renames the building in place instead of drawing a second one", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    const floors = queryAll(".floor", elements.world);
    const callUp = requireElement("button.up", floors[0] ?? elements.world);
    const car = requireElement(".elevator", elements.world);
    const carButton = queryAll(".elevator .buttonpress", elements.world)[1];

    setLocale("ru");
    app.relocalise();

    expect(callUp.ariaLabel).toBe("Вызвать лифт вверх с этажа 0");
    expect(car.ariaLabel).toBe("Лифт 1");
    expect(carButton?.ariaLabel).toBe("Ехать на этаж 1");
    // The same three floors and the same one car, and the very elements that
    // were there before: `presentWorld` appends and subscribes, so a second call
    // would leave six floors, two cars and two listeners behind every click.
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
    expect(requireElement(".elevator", elements.world)).toBe(car);
  });

  it("leaves the run in progress exactly where the player had it", () => {
    // The whole reason this method exists rather than a call to
    // `startChallenge`: the world, its clock, its score and its seed are the
    // ones the player was playing, and the simulation is still paused or still
    // running as they left it.
    const { app, elements, worldController } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-53,autostart=true"));
    const world = app.world;
    if (world === undefined) {
      throw new Error("The challenge did not start");
    }
    world.elapsedTime = 42;
    world.transportedCounter = 7;

    setLocale("ru");
    app.relocalise();

    expect(app.world).toBe(world);
    expect(world.elapsedTime).toBe(42);
    expect(world.transportedCounter).toBe(7);
    expect(world.challengeEnded).toBe(false);
    expect(app.currentChallengeIndex).toBe(0);
    expect(worldController.isPaused).toBe(false);
    expect(requireElement(".seedvalue", elements.challenge).textContent).toBe("issue-53");
  });

  it("says the verdict again, in the new language, over one overlay", () => {
    const { app, elements } = setUp();
    app.startChallenge(1);
    app.world?.trigger("stats_changed");
    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Success!");

    setLocale("ru");
    app.relocalise();

    expect(queryAll(".feedback", elements.feedback)).toHaveLength(1);
    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Получилось!");
    expect(requireElement(".feedback p", elements.feedback).textContent).toBe("Задание выполнено");
    // Redrawn from the remembered outcome, so the way on is offered again too,
    // and to the same challenge.
    expect(requireElement(".feedback a", elements.feedback).getAttribute("href")).toBe(
      "#challenge=3",
    );
  });

  it("does not announce an outcome to a run that has not reached one", () => {
    // The overlay is empty for the whole of a run, which is most of the time a
    // language gets changed. Nothing may appear over the building.
    const { app, elements } = setUp();
    app.startChallenge(0);

    setLocale("ru");
    app.relocalise();

    expect(elements.feedback.innerHTML).toBe("");
  });

  it("keeps the banner about a broken program, and the program's own words in it", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    app.worldController.trigger("usercode_error", new Error("boom"));

    setLocale("ru");
    app.relocalise();

    expect(requireElement(".error", elements.codeStatus).textContent).toContain(
      "С вашим кодом что-то не так",
    );
    // Whatever the player's program threw is their JavaScript and is shown back
    // to them untouched.
    expect(requireElement(".errormessage", elements.codeStatus).textContent).toContain("boom");
  });

  it("has nothing to redraw before a challenge has been started", () => {
    // The language can be chosen on a page that has only just loaded, before
    // any route has been handled.
    const { app, elements } = setUp();

    setLocale("ru");
    expect(() => {
      app.relocalise();
    }).not.toThrow();

    expect(elements.challenge.innerHTML).toBe("");
    expect(elements.world.innerHTML).toBe("");
    expect(elements.feedback.innerHTML).toBe("");
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
