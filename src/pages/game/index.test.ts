// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Challenge } from "../../game/challenges.ts";
import { INSTANT_RUN_MAX_SIMULATED_SECONDS } from "../../game/instant-run.ts";
import { tutorialTasks } from "../../game/tutorial.ts";
import type { TutorialTask } from "../../game/tutorial.ts";
import { TICK_SECONDS, createWorldController } from "../../game/world-controller.ts";
import type { WorldController } from "../../game/world-controller.ts";
import { createWorld } from "../../game/world.ts";
import type { World } from "../../game/world.ts";
import { DEFAULT_LOCALE, LOCALES, setLocale } from "../../i18n/index.ts";
import type { Locale } from "../../i18n/index.ts";
import { defaultCode } from "../../ui/default-code.ts";
import { CODE_STORAGE_KEY, CodeEditor } from "../../ui/editor.ts";
import {
  createElement,
  FakeTextEditorView,
  MemoryStorage,
  fullStorage,
} from "../../ui/test-helpers.ts";
import type { SeedLinkData } from "../../ui/templates.ts";
import {
  App,
  FULLSCREEN_CLASS,
  TIME_SCALE_STORAGE_KEY,
  clearAll,
  containsFocus,
  controlsTemplate,
  presentControls,
  readStoredTimeScale,
  relabelWorld,
  setDemoFullscreen,
} from "./index.ts";
import type { AppElements, ControlsPresenterOptions } from "./index.ts";
import { recordChallengeTier } from "#entities/challenge-tier/index.ts";
import { DEFAULT_TIME_SCALE } from "#features/adjust-speed/model/time-scale.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import { resolveRoute, startRouter } from "#pages/game/model/route.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { parseQuery } from "#shared/lib/route-query.ts";
import { renderFragment } from "#shared/ui/markup.ts";
import { presentBuildingStage } from "#widgets/building-stage/index.ts";
import { presentEditorPane } from "#widgets/editor-pane/index.ts";
import type { EditorPanePresenter } from "#widgets/editor-pane/index.ts";

/** A program that compiles and does nothing. */
const INERT_CODE = "{ init: function() {}, update: function() {} }";

/** Challenges used by these tests: the first two are winnable, the third not. */
const CHALLENGES: readonly Challenge[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0 },
    condition: {
      description: "Challenge <span>one</span>",
      evaluate: () => null,
      requirements: [],
    },
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0 },
    condition: { description: "Challenge two", evaluate: () => true, requirements: [] },
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0 },
    condition: { description: "Challenge three", evaluate: () => false, requirements: [] },
  },
];

/** The page shell, the app built over it, and the pieces the tests poke at. */
interface Harness {
  app: App;
  elements: AppElements;
  editor: CodeEditor;
  editorPane: EditorPanePresenter;
  editorPaneMount: HTMLElement;
  view: FakeTextEditorView;
  worldController: WorldController;
  storage: Storage;
}

/**
 * Builds a page shell and an app over it.
 *
 * @param code - The program the editor starts with.
 * @param storage - The store the app and its editor share. A working one unless
 * a spec is about what happens when the browser's is not.
 * @param onSeedChange - The app's `onSeedChange` option; a no-op unless a
 * spec is about that callback itself.
 * @returns Everything the tests need to drive the app.
 */
function setUp(
  code: string = INERT_CODE,
  storage: Storage = new MemoryStorage(),
  onSeedChange: (seed: SeedLinkData | null) => void = () => undefined,
): Harness {
  const elements: AppElements = {
    controls: createElement("div", { className: "controls" }),
    tutorial: createElement("div", { className: "tutorial" }),
    levelSwitcher: createElement("div", { className: "levelswitcher" }),
    goalBar: createElement("div", { className: "challenge" }),
    world: createElement("div", { className: "innerworld" }),
    stats: createElement("div", { className: "statscontainer" }),
    feedback: createElement("div", { className: "feedbackcontainer" }),
  };
  const editorPaneMount = createElement("div", { className: "code" });
  document.body.replaceChildren(
    elements.controls,
    elements.tutorial,
    elements.levelSwitcher,
    elements.goalBar,
    elements.world,
    elements.stats,
    elements.feedback,
    editorPaneMount,
  );

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

  // Mirrors `src/main.ts`'s own `appRef`: the editor pane's callbacks need the
  // app that owns the slot they open, and the app's own constructor needs the
  // editor pane already built to hand it as an option.
  // eslint-disable-next-line prefer-const -- assigned once, below the closures that read it.
  let appRef: App | undefined;
  const editorPane = presentEditorPane(editorPaneMount, {
    currentSlot: () => appRef?.currentCodeSlot ?? DEFAULT_CODE_SLOT,
    onSelectSlot: (slot) => {
      appRef?.selectCodeSlot(slot);
    },
    canUndoReset: () => editor.canUndoReset(),
    onResetCode: () => {
      editor.reset();
      editorPane.update();
    },
    onUndoReset: () => {
      editor.undoReset();
      editorPane.update();
    },
    onGotoLine: () => undefined,
  });

  const worldController = createWorldController(TICK_SECONDS);
  const app = new App({
    elements,
    editor,
    editorPane,
    worldController,
    challenges: CHALLENGES,
    storage,
    requestAnimationFrame: () => undefined,
    onSeedChange,
  });
  appRef = app;
  return { app, elements, editor, editorPane, editorPaneMount, view, worldController, storage };
}

/**
 * Unlocks challenge 2 in the level switcher, by recording the bronze tier
 * challenge 1 would earn if it could be won — see
 * `#features/switch-level/model/level-lock.ts`'s locking rule. `CHALLENGES[0]`
 * never resolves (`evaluate` always returns `null`), so this is the only way
 * a spec against this fixture reaches challenge 2 through a real `<a>` rather
 * than the `<button disabled>` a locked tile draws.
 *
 * @param storage - The store the app under test was built over.
 */
function unlockChallenge2(storage: Storage): void {
  recordChallengeTier(storage, 0, "bronze");
}

/**
 * The level switcher's challenge tiles, in playing order — the same three
 * entries `.challengelink` used to be the whole of, before the switcher also
 * started drawing the learning track and the sandbox as `.tasklink`s in
 * blocks either side of them.
 *
 * @param elements - The page shell the app was built over.
 * @returns The challenge block's tiles, or none if the switcher has not drawn one.
 */
function challengeTiles(elements: AppElements): HTMLElement[] {
  const challengeBlock = queryAll(".taskblock", elements.levelSwitcher)[1];
  return challengeBlock === undefined ? [] : queryAll(".tasklink", challengeBlock);
}

/**
 * The challenge block's own caption, e.g. "Levels" -- what
 * `.challengenav`'s `aria-label` used to carry, before the level switcher
 * replaced the challenge bar's own navigation row.
 *
 * @param elements - The page shell the app was built over.
 * @returns The caption text, or "" if the switcher has not drawn a challenge block.
 */
function challengeBlockCaption(elements: AppElements): string {
  const challengeBlock = queryAll(".taskblock", elements.levelSwitcher)[1];
  return challengeBlock === undefined ? "" : requireElement(".cap", challengeBlock).textContent;
}

/**
 * The level switcher's own trigger label — what replaced the challenge bar's
 * combined "Tutorial task N of M: <title>" title string. Unlike that title,
 * this carries only the task's own position, not the track's length or the
 * task's own sentence; see this file's specs for where the rest went.
 *
 * @param elements - The page shell the app was built over.
 * @returns The trigger's own text.
 */
function taskName(elements: AppElements): string {
  return requireElement(".task-name", elements.levelSwitcher).textContent;
}

/**
 * The goal bar's own description text for a challenge with no requirements —
 * every challenge and the sandbox in this file's fixtures. Unlike the
 * legacy `.challengetitle`, this carries no "Challenge #N:" or "Tutorial task
 * N of M:" prefix; see this file's own specs for where that numbering went.
 *
 * @param elements - The page shell the app was built over.
 * @returns The description text, as read out of the DOM.
 */
function goalDescription(elements: AppElements): string {
  return requireElement(".goalfree span", elements.goalBar).textContent;
}

/**
 * A stat tile's live value, out of the panel `widgets/stats-panel` draws —
 * `[data-stat="${stat}"] .tile-val`, not the bare class name `presentStats`
 * used to write the same figure under.
 *
 * @param elements - The page shell the app was built over.
 * @param stat - The tile's `data-stat`, camelCased the same as `StatsSnapshot`.
 * @returns The tile's live text.
 */
function statValue(elements: AppElements, stat: string): string {
  return requireElement(`[data-stat="${stat}"] .tile-val`, elements.stats).textContent;
}

/**
 * The code slot switcher's own buttons, drawn inside the editor pane's mount
 * rather than a dedicated `elements.codeSlots` region now.
 *
 * @param editorPaneMount - The element {@link setUp} built for the pane.
 * @returns The slot buttons, in slot order.
 */
function codeSlotButtons(editorPaneMount: HTMLElement): HTMLElement[] {
  return queryAll(".codeslot", editorPaneMount);
}

/**
 * The editor pane's error banner text, or "" if it is hidden — the pane's
 * own stand-in for the old `elements.codeStatus.innerHTML === ""` check,
 * since {@link EditorPanePresenter.clearError} hides the banner rather than
 * emptying it.
 *
 * @param editorPaneMount - The element {@link setUp} built for the pane.
 * @returns The banner's message, or "" if it is not showing one.
 */
function codeErrorMessage(editorPaneMount: HTMLElement): string {
  const errorLine = requireElement(".errorline", editorPaneMount);
  return errorLine.hidden ? "" : requireElement(".errormessage", editorPaneMount).textContent;
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
  // For the folded-in presenter specs below: `setUp()` above replaces
  // `document.body`'s children itself, so this only matters to the specs
  // that build their own elements straight onto the document.
  document.body.replaceChildren();
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
});

describe("App.startChallenge", () => {
  it("draws the challenge bar, the world and the statistics", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);

    expect(goalDescription(elements)).toBe("Challenge one");
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
    expect(statValue(elements, "transportedCounter")).toBe("0");
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
    const { app, editorPaneMount, storage } = setUp();
    storage.setItem("develevateChallengeCode_0_1", "{ this is not javascript");
    app.startChallenge(0);

    expect(app.world).toBeDefined();
    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
  });

  it("opens the first code slot by default", () => {
    const { app } = setUp();
    app.startChallenge(0);
    expect(app.currentCodeSlot).toBe(1);
  });

  it("opens the code slot it is asked for", () => {
    const { app, storage, view } = setUp();
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.startChallenge(0, false, 2);

    expect(app.currentCodeSlot).toBe(2);
    expect(view.getValue()).toBe("// slot two's program");
  });
});

describe("App code slots", () => {
  it("draws three slot buttons for a numbered challenge, marking the open one", () => {
    const { app, editorPaneMount } = setUp();
    app.startChallenge(0);

    const buttons = codeSlotButtons(editorPaneMount);
    expect(buttons.map((button) => button.textContent)).toEqual(["Code 1", "Code 2", "Code 3"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("switches the editor to another slot from the panel, without touching the run", () => {
    const { app, editorPaneMount, view, storage } = setUp();
    app.startChallenge(0);
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    const world = app.world;

    codeSlotButtons(editorPaneMount)[1]?.click();

    expect(app.currentCodeSlot).toBe(2);
    expect(view.getValue()).toBe("// slot two's program");
    expect(app.world).toBe(world);
    expect(
      codeSlotButtons(editorPaneMount).map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "true", "false"]);
  });

  it("does nothing when the slot already open is asked for again", () => {
    const { app, view } = setUp();
    app.startChallenge(0);
    view.type("// unsaved work");

    app.selectCodeSlot(1);

    expect(view.getValue()).toBe("// unsaved work");
  });

  it("keeps the slot a start-over reopens", () => {
    const { app, elements, view, storage } = setUp();
    app.startChallenge(0);
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.selectCodeSlot(2);

    requireElement(".startover", elements.controls).click();

    expect(app.currentCodeSlot).toBe(2);
    expect(view.getValue()).toBe("// slot two's program");
  });

  it("loads the reference solution into the first slot for devtest, regardless of which one is open", () => {
    const { app, view, storage } = setUp();
    app.startChallenge(0);
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.selectCodeSlot(2);

    app.handleRoute(...routeFor("#challenge=1,devtest=true"));

    expect(app.currentCodeSlot).toBe(1);
    expect(view.getValue()).toContain("selectElevatorForFloorPickup");
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

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Level failed");
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
      "Уровень пройден",
    );
    expect(requireElement(".feedback h2", lost.elements.feedback).textContent).toBe(
      "Уровень провален",
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

describe("App instant run", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("crunches the current challenge headlessly, drawing nothing while it runs, and shows the same outcome overlay an animated run would", () => {
    const { app, elements } = setUp();
    app.startChallenge(1);
    expect(queryAll(".elevator", elements.world)).toHaveLength(2);

    app.runInstantly();

    // `presentWorld` is skipped entirely for a crunch -- the building the
    // earlier animated start drew is torn down, and nothing replaces it.
    expect(queryAll(".floor", elements.world)).toHaveLength(0);
    expect(queryAll(".elevator", elements.world)).toHaveLength(0);
    expect(app.world?.challengeEnded).toBe(true);
    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Success!");
    // The button is back to its ready state, not stuck reading "Crunching...":
    // clearing `#instantRunHandle` when `stats_changed` reaches a verdict is
    // what a crunch gets in place of the relabelling an animated run's
    // `setPaused` raises for free.
    const button = requireElement(".runinstant", elements.controls);
    expect(button.textContent).toBe("Run instantly");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("falls back to a loss once the ceiling is reached without the challenge's own condition ever deciding", () => {
    const { app, elements } = setUp();
    app.startChallenge(0); // `evaluate` always returns null: nothing but the ceiling ends this

    app.runInstantly();
    // `driveInstantly` runs synchronously up to its first yield or verdict, so
    // nothing it queues in the background can run before this point -- an
    // empty, spawnless building is cheap enough that the real crunch may well
    // have already reached the ceiling on its own by here. Forcing it and
    // re-raising the event the ceiling is read from reproduces exactly what a
    // slower machine's crunch would eventually do on its own, without a test
    // that waits on real wall-clock time to find out which happened.
    if (app.world) {
      app.world.elapsedTime = INSTANT_RUN_MAX_SIMULATED_SECONDS;
      app.world.trigger("stats_changed");
    }

    expect(app.world?.challengeEnded).toBe(true);
    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Level failed");
  });

  it("surfaces a player-code error during a crunch through the same banner as any other run, and recovers the button", () => {
    const { app, elements, editorPaneMount, view } = setUp();
    app.startChallenge(0); // never resolves on its own; only the error ends this run
    view.type("{ init: function() {}, update: function() { throw new Error('boom'); } }");

    app.runInstantly();

    expect(codeErrorMessage(editorPaneMount)).toContain("boom");
    // Not ended: a controller a thrown error has paused never ticks the world
    // again, so nothing driven by `stats_changed` -- a verdict, the ceiling --
    // can fire either. The challenge is left exactly as undecided as it was,
    // the same as an animated run's error leaves it paused rather than lost.
    expect(app.world?.challengeEnded).toBe(false);
    const button = requireElement(".runinstant", elements.controls);
    expect(button.textContent).toBe("Run instantly");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("leaves the controls in their normal, ready state after starting a new run over an instant one", () => {
    const { app, elements } = setUp();
    app.startChallenge(0); // never resolves on its own
    app.runInstantly();

    app.startChallenge(1);

    // Whether the abandoned crunch had already reached its own ceiling or was
    // still running in the background, `#startRun` cancels whatever
    // `#instantRunHandle` still points at unconditionally, before it does
    // anything else -- so the button is never left stuck on "Crunching..."
    // for a run that is no longer the one on screen.
    const button = requireElement(".runinstant", elements.controls);
    expect(button.textContent).toBe("Run instantly");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(app.world?.floors).toHaveLength(4);
  });
});

describe("App challenge navigation", () => {
  it("puts a tile for every challenge in the switcher, marking the one being played", () => {
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=2"));

    const entries = challengeTiles(elements);
    expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
      "Level 1",
      "Level 2",
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
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=1,timescale=8,autostart=true"));

    expect(challengeTiles(elements).map((entry) => entry.getAttribute("href"))).toEqual([
      "#challenge=1,timescale=8,autostart=true",
      "#challenge=2,timescale=8,autostart=true",
      "#challenge=3,timescale=8,autostart=true",
    ]);
  });

  it("carries an unknown parameter across a jump as well", () => {
    // parseQuery keeps keys it does not understand, and createParamsUrl round
    // trips them, so a link someone hand-wrote survives being navigated from.
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=1,fullscreen,somethingelse=7"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#challenge=2,fullscreen=,somethingelse=7");
  });

  it("starts the challenge a link names when it is clicked", async () => {
    // The whole way round: the anchor navigates, the router hears the hash
    // change and the app starts the challenge it names.
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    window.location.hash = "#challenge=1,timescale=8";
    const stopRouter = startRouter(
      (params, query) => {
        app.handleRoute(params, query);
      },
      { challengeCount: CHALLENGES.length, defaultTimeScale: () => DEFAULT_TIME_SCALE },
    );

    try {
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).click();

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

    expect(goalDescription(elements)).toBe(
      "Sandbox: 20 floors, 3 elevators of capacity 4, 1.5 people per second. " +
        "No goal, so the run never ends",
    );
  });

  it("shows the clamped parameters, not the ones the url asked for", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=100000"));

    expect(goalDescription(elements)).toContain("Sandbox: 60 floors");
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

    const entries = challengeTiles(elements);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([null, null, null]);
  });

  it("carries the sandbox parameters into a jump, and out of the sandbox", () => {
    // Deliberate: `challenge` is the one key the row rewrites, so following an
    // entry leaves the sandbox by construction, while the building the player
    // configured stays in the hash, inert, and is still there on the way back.
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,timescale=8"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#challenge=2,floors=20,timescale=8");
  });

  it("stops being the sandbox once a numbered challenge is started", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    app.handleRoute(...routeFor("#challenge=2,floors=20"));

    expect(app.isPlayingSandbox).toBe(false);
    expect(app.world?.floors).toHaveLength(4);
    expect(goalDescription(elements)).toBe("Challenge two");
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
    expect(goalDescription(elements)).toContain("Sandbox:");
    expect(app.worldController.isPaused).toBe(false);
  });

  it("stays in the sandbox when the world is restarted from the bar", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    // Only reachable once the world has been torn down; the sandbox itself
    // never ends.
    app.world?.unWind();

    requireElement(".startstop", elements.controls).click();

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
    // from inside the app -- Ctrl-Enter, "Start over", the Restart button --
    // and then it is the leftover from the challenge just left that has to
    // lose.
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
    const { app } = setUp();
    app.startTutorial(0);

    expect(app.currentSeedLink).toBeNull();
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
    const { app, editorPaneMount, storage, view } = setUp();
    storage.setItem(TASK_2_CODE_KEY, "{ this is not javascript");

    app.startTutorial(1);

    expect(view.getValue()).toBe("{ this is not javascript");
    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
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

    requireElement(".startstop", elements.controls).click();

    expect(app.tutorial?.task.id).toBe("tutorial-2");
    expect(app.world?.challengeEnded).toBe(false);
  });

  it("numbers the track's own trigger label rather than the challenge list's", () => {
    const { app, elements } = setUp();
    app.startTutorial(2);

    expect(taskName(elements)).toBe("Tutorial task 3");
  });

  it("keeps the track's own numbering through a language change mid-run", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    setLocale("ru");
    app.relocalise();

    expect(taskName(elements)).toBe("Учебное задание 1");
  });

  it("leaves every challenge reachable from a task, and marks none of them current", () => {
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=tutorial-4,timescale=8"));

    const entries = challengeTiles(elements);
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
    // "Next level" is what the shared template writes into every such link,
    // and the numbered ladder is not where task 2 lives.
    expect(link.textContent.trim()).toBe("Next task");
    // The caret the template put beside the words survives being relabelled.
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("ends the track by offering level 1", () => {
    const { app, elements } = setUp();
    app.startTutorial(tutorialTasks.length - 1);

    endRun(app, true);

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe(
      "The track is finished",
    );
    const link = requireElement(".feedback a", elements.feedback);
    expect(link.getAttribute("href")).toBe("#challenge=1");
    expect(link.textContent.trim()).toBe("Go to level 1");
  });

  it("says how long the track was in the words each catalogue counts it with", () => {
    // `tutorial.finish.message` is the one sentence in the game that writes the
    // length of the track out rather than counting `tutorialTasks.length`,
    // because "Eight tasks" is what the sentence needs and "8 tasks" is not. A
    // ninth task would leave both catalogues quietly wrong on the one screen a
    // player reaches once, so the number is pinned here against the words --
    // add the task, add its wording, and this passes again.
    const SPELLED_OUT: Readonly<Record<number, Readonly<Record<Locale, string>>>> = {
      8: { en: "Eight tasks", ru: "Восемь заданий" },
    };
    const words = SPELLED_OUT[tutorialTasks.length];
    expect(
      words,
      `no wording is recorded for a track of ${String(tutorialTasks.length)}`,
    ).toBeDefined();

    for (const locale of LOCALES) {
      setLocale(locale);
      const { app, elements } = setUp();
      app.startTutorial(tutorialTasks.length - 1);

      endRun(app, true);

      expect(requireElement(".feedback p", elements.feedback).textContent).toContain(
        words?.[locale],
      );
    }
  });

  it("promises nothing on that link that following it does not do", () => {
    // It read "Go to challenge 1 with this program", and the program stayed
    // behind: the link is an ordinary route change, and leaving the track puts
    // the player's own buffer back on screen. Their program is what is waiting
    // there, which is right -- nothing may overwrite it without asking -- so it
    // is the label that had to give. The winning program is not lost either; it
    // is under the task's own key, and the panel's button is how it travels.
    const { app, elements, view, storage } = setUp();
    storage.setItem(CODE_STORAGE_KEY, "// the program I came in with");
    app.startTutorial(tutorialTasks.length - 1);
    view.type("// the program that clears challenge 1");

    endRun(app, true);
    const link = requireElement(".feedback a", elements.feedback);
    app.handleRoute(...routeFor(link.getAttribute("href") ?? ""));

    expect(link.textContent.trim()).not.toContain("this program");
    expect(view.getValue()).toBe("// the program I came in with");
    expect(storage.getItem(`develevateTutorialCode_${taskAt(tutorialTasks.length - 1).id}`)).toBe(
      "// the program that clears challenge 1",
    );
  });

  it("says a lost task is lost, and offers nothing", () => {
    // The expected first outcome on the track: the player is meant to go back to
    // the editor, where the hints are, rather than onwards.
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, false);

    expect(requireElement(".feedback h2", elements.feedback).textContent).toBe("Level failed");
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
    // link labelled "Следующий уровень" -- the numbered ladder -- in front of a
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

    storage.setItem("develevateChallengeCode_0_1", defaultCode());
    expect(app.playerCodeWouldBeReplaced()).toBe(false);

    storage.setItem("develevateChallengeCode_0_1", "   \n  ");
    expect(app.playerCodeWouldBeReplaced()).toBe(false);

    storage.setItem("develevateChallengeCode_0_1", INERT_CODE);
    expect(app.playerCodeWouldBeReplaced()).toBe(true);
  });

  it("still asks when the store refused to keep the player's program", () => {
    // The program the question is about is the editor's, not the store's: when
    // the store will not take a write, the editor's own copy of the key is the
    // only copy there is, and it is exactly what taking a task's program
    // overwrites. Asking the store directly answers "there is nothing of yours
    // here" at the one moment that is both wrong and expensive -- a full quota,
    // or the private windows that hand out a `Storage` and refuse every write.
    const { app, editor, view } = setUp(INERT_CODE, fullStorage());
    app.startChallenge(0);
    view.type("// the program I wrote in a private window");
    editor.save();

    expect(app.playerCodeWouldBeReplaced()).toBe(true);
  });

  it("does not ask about a program nobody wrote, however the store behaves", () => {
    // The other half of the same rule: a store that cannot be read is not a
    // store holding something to lose, and a confirmation nobody can act on is
    // the kind players learn to dismiss.
    const { app } = setUp(INERT_CODE, fullStorage());

    expect(app.playerCodeWouldBeReplaced()).toBe(false);
  });

  it("copies the program into the player's editor without leaving the task", () => {
    // The button means "I want to keep this", not "I am done here": somebody who
    // takes the answer to task 4 usually wants to go on reading task 4.
    const { app, storage, view } = setUp();
    app.startTutorial(3);
    view.type("// my answer to task 4");

    expect(app.takeTutorialCode()).toBe(true);

    expect(storage.getItem("develevateChallengeCode_0_1")).toBe("// my answer to task 4");
    expect(app.tutorial?.index).toBe(3);
    expect(view.getValue()).toBe("// my answer to task 4");
  });

  it("hands the taken program to the editor the player comes back to", () => {
    // The copy is only worth taking if it is the one waiting under the game's
    // own editor afterwards. It was not: the write went straight to storage,
    // around the copy the editor keeps of every key it has written this page,
    // and that copy is what challenge 1's slot 1 buffer reads first. A player
    // who had saved anything at all before visiting the track got their old
    // program back on leaving, and the next autosave wrote it over the taken one.
    const { app, editor, storage, view } = setUp();
    app.startChallenge(0);
    view.type("// the program I came in with");
    editor.save();

    app.startTutorial(3);
    view.type("// my answer to task 4");
    expect(app.takeTutorialCode()).toBe(true);

    app.leaveTutorial();

    expect(view.getValue()).toBe("// my answer to task 4");
    expect(storage.getItem("develevateChallengeCode_0_1")).toBe("// my answer to task 4");
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

    it("leaves the run controls to be the only way to start the task again", () => {
      // The panel had a "Start over" of its own, and so does the row of run
      // controls drawn directly under it, with the same accessible name and
      // without the auto-start the row's has (WCAG 3.2.4). The one that went is
      // the one only the track had; the one that stayed restarts the task from
      // the track exactly as it restarts a challenge.
      const { app, elements } = setUp();
      app.startTutorial(1);
      const before = app.world;

      expect(elements.tutorial.querySelector(".tutorialrestart")).toBeNull();
      requireElement(".startover", elements.controls).click();

      expect(app.world).not.toBe(before);
      expect(app.tutorial?.task.id).toBe("tutorial-2");
      expect(app.worldController.isPaused).toBe(false);
    });

    it("takes the task's program into the player's editor from the panel", () => {
      const { app, elements, storage, view } = setUp();
      app.startTutorial(3);
      view.type("// the answer, copied out of the hint");

      requireElement(".tutorialtakecode", elements.tutorial).click();

      expect(storage.getItem("develevateChallengeCode_0_1")).toBe(
        "// the answer, copied out of the hint",
      );
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
      // A store that throws on the write is what `takeTutorialCode` answers
      // `false` for -- a full quota, as here, or a private-browsing mode that
      // hands out a `Storage` and refuses every write to it -- and the panel is
      // where that answer is spent: the program is not waiting for them, and the
      // useful thing to say is how to keep it by hand.
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

    it("keeps that confirmation on screen when the task is cleared under it", () => {
      // The sequence this was written for: take the program, then win the run.
      // Clearing a task redraws the panel to move its progress line on, and the
      // sentence the player had just been given used to go with it -- wiped at
      // the exact moment the overlay appeared over the top, so it would have
      // looked like the overlay that did it.
      const { app, elements } = setUp();
      app.startTutorial(3);
      requireElement(".tutorialtakecode", elements.tutorial).click();

      endRun(app, true);

      expect(app.tutorialProgress().cleared).toBe(1);
      expect(requireElement(".tutorialtaken", elements.tutorial).textContent).toBe(
        "Copied into the game editor, waiting when you leave the track.",
      );
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

      storage.setItem("develevateChallengeCode_0_1", INERT_CODE);
      requireElement(".tutorialtakecode", elements.tutorial).click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(storage.getItem("develevateChallengeCode_0_1")).toBe(INERT_CODE);
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

      expect(document.activeElement).toBe(requireElement(".startstop", elements.controls));
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
    requireElement(".startstop", elements.controls).click();
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
    requireElement(".startstop", elements.controls).click();

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

  it("offers the seed of the run, keeping the rest of the url", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8"));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.seed).toBe(seed);
    expect(app.currentSeedLink?.url).toBe(`#challenge=2,timescale=8,seed=${seed}`);
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

  it("leaves a pinned seed behind when the switcher jumps to another challenge", () => {
    // A seed was drawn for one building and means nothing in another, so a tile
    // carries the speed and everything else but not this. A tile is not the way
    // out of a pinned run either: none names the sandbox, and pressing the
    // challenge already being played is not a move anybody would find. That is
    // the seed line's "new draw", below.
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=1,timescale=8,seed=issue-61"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#challenge=2,timescale=8");
    expect(
      requireElement('[aria-label="Level 1"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#challenge=1,timescale=8");
  });

  it("offers the seed of a sandbox run as well, building and all", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20"));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.url).toBe(`#challenge=sandbox,floors=20,seed=${seed}`);
  });

  it("gives both seed links an address even when the url is empty", () => {
    // A first visit has no hash at all. "Everything you are carrying, minus the
    // seed" is then nothing at all, and a hash can only spell that `#` -- which
    // navigates, but is also the fragment meaning "the top of this document",
    // so the browser scrolls there on the way out of a pinned run. Both links
    // name the challenge, so neither ever degenerates to one.
    const { app } = setUp();
    app.handleRoute(...routeFor(""));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.url).toBe(`#challenge=1,seed=${seed}`);

    app.handleRoute(...routeFor("#seed=issue-61"));

    expect(app.currentSeedLink?.newDrawUrl).toBe("#challenge=1");
  });

  it("prints the seed and a whole url at every start", () => {
    // The affordance that matters most: nobody knows a run is worth repeating
    // until it has already gone wrong, and by then this line is the only record
    // of what it was.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));

    expect(console.log).toHaveBeenCalledWith(
      `Seed issue-61 — the exact same run again, whatever the frame rate: ` +
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
      `Сид issue-61 — тот же самый прогон один в один, независимо от частоты кадров: ` +
        `${window.location.origin}/#challenge=1,seed=issue-61`,
    );
  });

  it("offers the exact same run back, because the controller no longer depends on frame timing", () => {
    // The controller used to take its dt from requestAnimationFrame timestamps,
    // so the cars stood somewhere else as each passenger appeared and the
    // player's program was asked to decide at different moments. Now
    // world-controller.ts advances codeObj.update and world.update in fixed
    // TICK_SECONDS ticks instead, so the browser and the headless paths (the
    // fitness suite, the tests) alike repeat a run step for step, played the
    // same way.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));

    const printed = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatch(/exact/i);
    expect(printed[0]).not.toMatch(/never quite the same/i);
  });

  it("prints a fresh line for every run, including a restart", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#challenge=3"));
    vi.mocked(console.log).mockClear();

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.controls).click();

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log).mock.calls[0]?.[0]).toContain(String(app.world?.seed));
  });

  it("offers no way back for a run nothing has pinned", () => {
    // There would be nowhere for it to go: the URL without a seed is the one
    // the player is already at, so following it would fire no hashchange and
    // do nothing at all.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8"));

    expect(app.currentSeedLink?.newDrawUrl).toBeNull();
  });

  it("offers a way back to a fresh draw once the url pins the seed", () => {
    // The counterweight to pinning being one click: unpinning is one click too,
    // and neither of them needs the address bar.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=2,timescale=8,seed=issue-61"));

    expect(app.currentSeedLink?.newDrawUrl).toBe("#challenge=2,timescale=8");
  });

  it("keeps the sandbox building when the pin is taken back out", () => {
    // The case a challenge tile cannot answer at all: none names the sandbox,
    // so every entry it offers leaves the building behind.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=sandbox,floors=20,seed=issue-61"));

    expect(app.currentSeedLink?.newDrawUrl).toBe("#challenge=sandbox,floors=20");
  });

  it("treats a seed the router refused as no pin at all", () => {
    // A browser percent-encodes the space in "#seed=rush hour", so what reaches
    // the router is "rush%20hour" -- which is the form written here, because a
    // fixture the app cannot be handed proves nothing about the app. The `%`
    // fails SEED_PATTERN, the router draws a fresh seed, and nothing is pinned,
    // so there is nothing to unpin.
    const { app } = setUp();
    app.handleRoute(...routeFor("#challenge=1,seed=rush%20hour"));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.newDrawUrl).toBeNull();
    expect(app.currentSeedLink?.url).toBe(`#challenge=1,seed=${seed}`);
  });

  it("tells a caller built before the first run what each later run's seed is", () => {
    // The whole reason AppOptions.onSeedChange exists: something mounted once,
    // ahead of `startRouter` resolving the first route, still has to learn
    // about every run after that one -- `currentSeedLink` alone only ever
    // answers for whatever is on screen right now.
    const seen: (SeedLinkData | null)[] = [];
    const { app } = setUp(INERT_CODE, new MemoryStorage(), (seed) => seen.push(seed));

    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));
    expect(seen.at(-1)?.seed).toBe("issue-61");

    app.handleRoute(...routeFor("#challenge=2"));
    expect(seen.at(-1)?.seed).not.toBe("issue-61");
  });

  it("tells that caller again on a language change, even when the seed itself did not change", () => {
    // `seedPanelTemplate` calls `t(...)` fresh on every render, so a caller
    // holding stale markup is stale in the same way the rest of the challenge
    // bar would be without `relocalise`'s own call to `#drawChallengeBar`.
    const seen: (SeedLinkData | null)[] = [];
    const { app } = setUp(INERT_CODE, new MemoryStorage(), (seed) => seen.push(seed));
    app.handleRoute(...routeFor("#challenge=1,seed=issue-61"));
    const callsBeforeRelocalise = seen.length;

    setLocale("ru");
    app.relocalise();

    expect(seen.length).toBeGreaterThan(callsBeforeRelocalise);
    expect(seen.at(-1)?.seed).toBe("issue-61");
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

    const startStop = requireElement(".startstop", elements.controls);
    expect(document.activeElement).toBe(startStop);
    // Focused after it has its label, so it is not announced unnamed.
    expect(startStop.textContent).toBe("Start");
  });

  it("keeps focus in the navigation row when a challenge is taken from it", () => {
    // Tabbing to "Level 2" and pressing it rebuilds the bar under the
    // player's feet, exactly as the next-challenge link does. They stay where
    // they were: on the entry that replaced the one they pressed, which is now
    // the current challenge.
    const { app, elements, storage } = setUp();
    unlockChallenge2(storage);
    app.handleRoute(...routeFor("#challenge=1"));
    requireElement('[aria-label="Level 2"]', elements.levelSwitcher).focus();

    app.handleRoute(...routeFor("#challenge=2"));

    const entry = requireElement('[aria-label="Level 2"]', elements.levelSwitcher);
    expect(document.activeElement).toBe(entry);
    expect(entry.getAttribute("aria-current")).toBe("page");
  });

  it("hands focus to the start button when the building it was in is torn down", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    requireElement(".floor button.up", elements.world).focus();

    app.startChallenge(1);

    expect(document.activeElement).toBe(requireElement(".startstop", elements.controls));
  });

  it("gives the start button its final label before handing it the focus", () => {
    // Focusing a button is what makes a screen reader read its name, so the
    // name has to be the one it will keep. "Start over" auto-starts, and the
    // label is decided twice on the way: once while the controller still holds
    // the old run's paused state, and once after it has been told about the new
    // one. Taking the focus between the two announces "Start" about a button
    // that is already becoming "Pause".
    //
    // Read inside the `focus` call rather than after it, because afterwards the
    // two orderings are indistinguishable: the second pass relabels the button
    // either way, and what a screen reader said is not in the DOM to assert on.
    // That focus lands there at all is pinned by the two tests above.
    const { app, elements } = setUp();
    app.startChallenge(0);
    const startStop = requireElement(".startstop", elements.controls);
    // The state that makes the two passes disagree: nothing is running, so the
    // first reads "paused" and the second reads the auto-started run.
    expect(startStop.textContent).toBe("Start");
    let labelWhenFocused: string | null = null;
    vi.spyOn(startStop, "focus").mockImplementation(() => {
      labelWhenFocused = startStop.textContent;
    });
    requireElement(".floor button.up", elements.world).focus();

    requireElement(".startover", elements.controls).click();

    expect(labelWhenFocused).toBe("Pause");
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
    const startStop = requireElement(".startstop", elements.controls);
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

    requireElement(".startstop", elements.controls).click();

    expect(app.world).not.toBe(ended);
    expect(app.currentChallengeIndex).toBe(2);
  });
});

describe("App run controls", () => {
  it("starts the same challenge over, running, from Start over", () => {
    // Unlike the Restart the first button becomes at the end of a run, which
    // leaves the new run paused: a finished run is a result to read and the
    // player says when to go again, while this one is pressed by somebody who
    // has already decided to.
    const { app, elements, worldController } = setUp();
    app.startChallenge(1);
    const before = app.world;

    requireElement(".startover", elements.controls).click();

    expect(app.world).not.toBe(before);
    expect(app.currentChallengeIndex).toBe(1);
    expect(worldController.isPaused).toBe(false);
  });
});

describe("App time scale", () => {
  it("steps the speed with the run controls' buttons", () => {
    const { app, worldController, elements } = setUp();
    app.startChallenge(0);
    worldController.setTimeScale(2);

    requireElement(".timescale_increase", elements.controls).click();
    expect(worldController.timeScale).toBe(3);
    expect(requireElement(".timescale_value", elements.controls).textContent).toBe("3x");

    requireElement(".timescale_decrease", elements.controls).click();
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
      requireElement(".timescale_decrease", elements.controls).click();
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
    expect(goalDescription(elements)).toBe("Challenge one");
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

  it("does not load it on a task, where it would land in the player's own buffer", () => {
    // The load happens before the editor has switched to the task's buffer, so
    // the reference solution used to be flushed into the player's own key on the
    // way past -- destroying their program with nothing on screen to show for
    // it, since what appears is the task's starting program. The router refuses
    // the flag on a task address for that reason, and because the last hint of
    // every task is already its answer.
    const { app, storage, view } = setUp();
    storage.setItem(CODE_STORAGE_KEY, "// the program I came in with");

    app.handleRoute(...routeFor("#challenge=tutorial-1,devtest=true"));

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// the program I came in with");
    expect(view.getValue()).not.toContain("selectElevatorForFloorPickup");
  });

  it("does not write the reference solution into the task it is leaving", () => {
    // The other direction of the same fault, and the one the router cannot
    // refuse: `#challenge=1,devtest=true` is a perfectly ordinary challenge
    // address, and the flag used to be applied while the task's buffer was
    // still the one on screen. The task's attempt was flushed away under the
    // dev-test program on the way out, and nothing showed it -- what appears
    // after the switch is the player's own program, so the reference solution
    // the flag was asked for was not even visible.
    const { app, storage, view } = setUp();
    app.handleRoute(...routeFor("#challenge=tutorial-1"));
    view.type("// my attempt at task 1");

    app.handleRoute(...routeFor("#challenge=1,devtest=true"));

    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// my attempt at task 1");
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
    const { app, editor, editorPaneMount } = setUp();
    app.startChallenge(0);

    app.worldController.trigger("usercode_error", new Error("boom"));
    expect(codeErrorMessage(editorPaneMount)).toContain("boom");

    editor.getCodeObj();
    expect(codeErrorMessage(editorPaneMount)).toBe("");
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

  it("rewrites the goal bar's own chrome and the level switcher's captions in the language chosen part-way through a run", () => {
    const { app, elements } = setUp();
    app.startChallenge(0);
    expect(goalDescription(elements)).toBe("Challenge one");
    expect(challengeBlockCaption(elements)).toBe("Levels");

    setLocale("ru");
    app.relocalise();

    // The description is the fixture's own markup and stays English; every
    // control around it does not. The level switcher redraws its tile grid
    // from scratch on every update, so the block from before relocalise is
    // gone -- looked up again rather than reused.
    expect(goalDescription(elements)).toBe("Challenge one");
    expect(requireElement(".startstop", elements.controls).textContent).toBe("Старт");
    expect(challengeBlockCaption(elements)).toBe("Уровни");
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
    expect(statValue(elements, "elapsedTime")).toBe("2,675s");

    setLocale("ru");
    app.relocalise();

    // A non-breaking space between the thousands and before the unit, both of
    // which `Intl` chooses and neither of which English has.
    expect(statValue(elements, "elapsedTime")).toBe("2 675 с");
    expect(statValue(elements, "transportedCounter")).toBe("1 234");
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
    const { app, worldController } = setUp();
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
    expect(app.currentSeedLink?.seed).toBe("issue-53");
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
    expect(requireElement(".feedback p", elements.feedback).textContent).toBe("Уровень пройден");
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
    const { app, editorPaneMount } = setUp();
    app.startChallenge(0);
    app.worldController.trigger("usercode_error", new Error("boom"));

    setLocale("ru");
    app.relocalise();

    expect(requireElement(".errorline", editorPaneMount).textContent).toContain(
      "Ошибка в вашей программе",
    );
    // Whatever the player's program threw is their JavaScript and is shown back
    // to them untouched.
    expect(codeErrorMessage(editorPaneMount)).toContain("boom");
  });

  it("has nothing to redraw before a challenge has been started", () => {
    // The language can be chosen on a page that has only just loaded, before
    // any route has been handled.
    const { app, elements } = setUp();

    setLocale("ru");
    expect(() => {
      app.relocalise();
    }).not.toThrow();

    expect(elements.goalBar.innerHTML).toBe("");
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

// The specs below were `src/ui/presenters.test.ts` and three describe blocks
// of `src/ui/templates.test.ts`, before `presentControls`, `relabelWorld`,
// `clearAll`, `containsFocus`, `setDemoFullscreen` and `controlsTemplate`
// folded into this module — see its own doc comment for why. Moved wholesale,
// with only their imports and cross-references adjusted.

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
  function setUpControls(overrides: Partial<ControlsPresenterOptions> = {}): {
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
    const { parent, options } = setUpControls();
    presentControls(parent, options);

    expect(requireElement(".timescale_value", parent).textContent).toBe("2x");
    expect(requireElement(".startstop", parent).textContent).toBe("Start");
    expect(requireElement(".startover", parent).textContent).toBe("Start over");
    expect(requireElement(".runinstant", parent).textContent).toBe("Run instantly");
  });

  it("labels the instant-run button as crunching, and disables it, while a crunch is in progress", () => {
    const { parent, options } = setUpControls();
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
    const { parent, options } = setUpControls();
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
    const { parent, options } = setUpControls();
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
    const { parent, options } = setUpControls();
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
    const { parent, options } = setUpControls();
    document.body.append(parent);
    const presenter = presentControls(parent, options);
    const startOver = requireElement(".startover", parent);
    startOver.focus();

    presenter.update();

    expect(document.activeElement).toBe(startOver);
  });

  it("lands focus on the start button when the app asks it to", () => {
    // For the redraw that empties the region focus was in -- the overlay's
    // "Next level" link, or the building -- which leaves focus on <body>.
    const { parent, options } = setUpControls();
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
    // this module's own job rather than the translator's.
    expect(startStop.textContent).toBe(" Заново");
  });
});

describe("controlsTemplate", () => {
  it("makes the time-scale controls real, labelled buttons", () => {
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
  });

  it("draws the three run buttons in one box, in the order they are read in", () => {
    // Not decoration: the row wraps on a narrow page, and loose in it the
    // three would break up one at a time. One box, so what drives the run
    // wraps as the cluster it is -- and so the speed, which is a setting
    // rather than a thing the player came for, stays on the far side of the
    // row. Reset/undo-reset moved to the editor pane's own codetools (see
    // `widgets/editor-pane`'s own tests) and are not drawn here any more.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "startstop unselectable",
      "startover unselectable",
      "runinstant unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships the three with no label at all, for the presenter to write", () => {
    // The region is drawn once for the life of the page, so a label baked in
    // here would still be in the language the page opened in after a change of
    // language. `presentControls.update` writes all three.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.textContent)).toEqual(["", "", ""]);
  });

  it("announces the speed as it changes, without interrupting", () => {
    // presentControls.update rewrites .timescale_value's text on every click of
    // the two speed buttons, which without aria-live would happen in perfect
    // silence for a screen reader -- the number changes and nothing is said.
    // Polite rather than assertive: a player holding a speed button down can
    // change it several times a second, and an assertive region interrupts
    // whatever is already being read to announce each one in turn.
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector(".timescale_value")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("the language the run controls come out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("names the speed controls", () => {
    setLocale("ru");
    const fragment = renderFragment(controlsTemplate());

    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Уменьшить скорость симуляции",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Увеличить скорость симуляции",
    );
  });
});
