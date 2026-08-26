// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Level } from "../../game/levels.ts";
import { WINNING_IS_GOLD, atLeastAvgLoadFactorOnMove } from "../../game/level-tiers.ts";
import type { LevelTierRequirements } from "../../game/level-tiers.ts";
import { INSTANT_RUN_MAX_SIMULATED_SECONDS } from "../../game/instant-run.ts";
import { chapter2Levels } from "../../game/chapter2.ts";
import type { Chapter2Card, Chapter2Level } from "../../game/chapter2.ts";
import { tutorialLevels } from "../../game/tutorial.ts";
import type { TutorialLevel } from "../../game/tutorial.ts";
import { TICK_SECONDS, createWorldController } from "../../game/world-controller.ts";
import type { WorldController } from "../../game/world-controller.ts";
import { createWorld } from "../../game/world.ts";
import type { World } from "../../game/world.ts";
import { DEFAULT_LOCALE, LOCALES, setLocale } from "../../i18n/index.ts";
import type { Locale } from "../../i18n/index.ts";
import { CODE_STORAGE_KEY, CodeEditor } from "../../ui/editor.ts";
import { createElement, FakeTextEditorView, MemoryStorage } from "../../ui/test-helpers.ts";
import type { SeedLinkData } from "../../ui/templates.ts";
import {
  App,
  FULLSCREEN_CLASS,
  SEED_STORAGE_KEY,
  TIME_SCALE_STORAGE_KEY,
  clearAll,
  containsFocus,
  controlsTemplate,
  presentControls,
  readStoredSeed,
  readStoredTimeScale,
  relabelWorld,
  setDemoFullscreen,
} from "./index.ts";
import type { AppElements, ControlsPresenterOptions } from "./index.ts";
import { readBestChapter1Tiers } from "#entities/chapter1-level/index.ts";
import { readBestChapter2Tiers } from "#entities/chapter2-level/index.ts";
import { readClearedTutorialLevels } from "#entities/tutorial-level/model/progress.ts";
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

/** Levels used by these tests: the first two are winnable, the third not. */
const LEVELS: readonly Level[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0 },
    condition: {
      description: "Level <span>one</span>",
      evaluate: () => null,
      requirements: [],
    },
    tiers: WINNING_IS_GOLD,
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0 },
    condition: { description: "Level two", evaluate: () => true, requirements: [] },
    tiers: WINNING_IS_GOLD,
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0 },
    condition: { description: "Level three", evaluate: () => false, requirements: [] },
    tiers: WINNING_IS_GOLD,
  },
];

/** Hangs a silver and a gold bar on the winnable level; call before `startChapter1Level`, which reads the level list at run start. */
function withTiers(app: App, tiers: LevelTierRequirements): void {
  Object.defineProperty(app, "chapter1Levels", {
    value: LEVELS.map((level, index) => (index === 1 ? { ...level, tiers } : level)),
  });
}

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

/** Builds a page shell and an app over it. */
function setUp(
  code: string = INERT_CODE,
  storage: Storage = new MemoryStorage(),
  onSeedChange: (seed: SeedLinkData | null) => void = () => undefined,
): Harness {
  const elements: AppElements = {
    controls: createElement("div", { className: "controls" }),
    tutorial: createElement("div", { className: "tutorial" }),
    levelSwitcher: createElement("div", { className: "levelswitcher" }),
    goalBar: createElement("div", { className: "level" }),
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
    chapter1Levels: LEVELS,
    storage,
    requestAnimationFrame: () => undefined,
    onSeedChange,
  });
  appRef = app;
  return { app, elements, editor, editorPane, editorPaneMount, view, worldController, storage };
}

/** The level switcher's level tiles, in playing order. */
function levelTiles(elements: AppElements): HTMLElement[] {
  const levelBlock = queryAll(".taskblock", elements.levelSwitcher)[1];
  return levelBlock === undefined ? [] : queryAll(".tasklink", levelBlock);
}

/** The level block's own caption, e.g. "Levels". */
function levelBlockCaption(elements: AppElements): string {
  const levelBlock = queryAll(".taskblock", elements.levelSwitcher)[1];
  return levelBlock === undefined ? "" : requireElement(".cap", levelBlock).textContent;
}

/** The level switcher's own trigger label. */
function taskName(elements: AppElements): string {
  return requireElement(".task-name", elements.levelSwitcher).textContent;
}

/** The goal bar's description text for a level with no requirements. */
function goalDescription(elements: AppElements): string {
  return requireElement(".goalfree span", elements.goalBar).textContent;
}

/** A stat tile's live text value. */
function statValue(elements: AppElements, stat: string): string {
  return requireElement(`[data-stat="${stat}"] .tile-val`, elements.stats).textContent;
}

/** The verdict headline text; the `<h3>` also carries a star badge and a screen-reader medal name that `textContent` would blend in. */
function verdictTitle(elements: AppElements): string {
  return requireElement(".verdict h3", elements.feedback).firstChild?.textContent ?? "";
}

/** The code slot switcher's own buttons, in slot order. */
function codeSlotButtons(editorPaneMount: HTMLElement): HTMLElement[] {
  return queryAll(".codeslot", editorPaneMount);
}

/** The editor pane's error banner text, or "" if it is hidden. */
function codeErrorMessage(editorPaneMount: HTMLElement): string {
  const errorLine = requireElement(".errorline", editorPaneMount);
  return errorLine.hidden ? "" : requireElement(".errormessage", editorPaneMount).textContent;
}

beforeEach(() => {
  // Cleared, not just silenced: a spy outlives its spec, so uncleared calls leak in.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
  vi.spyOn(console, "log")
    .mockImplementation(() => undefined)
    .mockClear();
  document.body.replaceChildren();
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
});

describe("App.startChapter1Level", () => {
  it("draws the goal bar, the world and the statistics", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);

    expect(goalDescription(elements)).toBe("Level one");
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
    expect(statValue(elements, "transportedCounter")).toBe("0");
  });

  it("keeps the window.world debugging hook pointing at the live world", () => {
    const { app } = setUp();
    app.startChapter1Level(1);
    expect(window.world).toBe(app.world);
    expect(window.world?.floors).toHaveLength(4);
  });

  it("tears the previous world down and starts from a clean page", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    const first = app.world;

    app.startChapter1Level(1);

    expect(first?.levelEnded).toBe(true);
    expect(first?.floors).toHaveLength(0);
    expect(queryAll(".floor", elements.world)).toHaveLength(4);
    expect(elements.feedback.innerHTML).toBe("");
  });

  it("refuses an index that does not name a level", () => {
    const { app } = setUp();
    expect(() => {
      app.startChapter1Level(99);
    }).toThrow(RangeError);
  });

  it("starts even when the program does not compile", () => {
    const { app, editorPaneMount, storage } = setUp();
    storage.setItem("develevateChallengeCode_0_1", "{ this is not javascript");
    app.startChapter1Level(0);

    expect(app.world).toBeDefined();
    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
  });

  it("opens the first code slot by default", () => {
    const { app } = setUp();
    app.startChapter1Level(0);
    expect(app.currentCodeSlot).toBe(1);
  });

  it("opens the code slot it is asked for", () => {
    const { app, storage, view } = setUp();
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.startChapter1Level(0, false, 2);

    expect(app.currentCodeSlot).toBe(2);
    expect(view.getValue()).toBe("// slot two's program");
  });
});

describe("App browser defaults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("remembers the seed in the page's own store and runs on the page's own frames when it is given neither", () => {
    // What the running game relies on: it names neither, so both defaults have to be the page's own.
    const storage = new MemoryStorage();
    const pending: ((t: number) => void)[] = [];
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("requestAnimationFrame", (callback: (t: number) => void) => {
      pending.push(callback);
    });
    const { elements, editor, editorPane, worldController } = setUp();
    const app = new App({
      elements,
      editor,
      editorPane,
      worldController,
      chapter1Levels: LEVELS,
      onSeedChange: () => undefined,
    });

    app.startChapter1Level(0, true);
    // Two frames: the first only marks the clock, the second is the one that runs time.
    for (const timestamp of [0, 1000]) {
      for (const callback of pending.splice(0)) {
        callback(timestamp);
      }
    }

    expect(storage.getItem(SEED_STORAGE_KEY)).toBe(String(app.world?.seed));
    expect(app.world?.elapsedTime).toBeGreaterThan(0);
  });
});

describe("App code slots", () => {
  it("draws three slot buttons for a numbered level, marking the open one", () => {
    const { app, editorPaneMount } = setUp();
    app.startChapter1Level(0);

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
    app.startChapter1Level(0);
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
    app.startChapter1Level(0);
    view.type("// unsaved work");

    app.selectCodeSlot(1);

    expect(view.getValue()).toBe("// unsaved work");
  });

  it("keeps the slot a start-over reopens", () => {
    const { app, elements, view, storage } = setUp();
    app.startChapter1Level(0);
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.selectCodeSlot(2);

    requireElement(".startover", elements.controls).click();

    expect(app.currentCodeSlot).toBe(2);
    expect(view.getValue()).toBe("// slot two's program");
  });
});

describe("App level outcome", () => {
  // In afterEach, not at the end of the switching test, so a failing assertion can't leave the suite in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("stops the world and offers the next level on a win", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);

    app.world?.trigger("stats_changed");

    expect(app.world?.levelEnded).toBe(true);
    expect(verdictTitle(elements)).toBe("Success!");
    expect(requireElement(".verdict a", elements.feedback).getAttribute("href")).toBe("#level=3");
  });

  it("says so, without a link, on a loss", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(2);

    app.world?.trigger("stats_changed");

    expect(verdictTitle(elements)).toBe("Level failed");
    expect(elements.feedback.querySelector("a")).toBeNull();
  });

  it("says both outcomes in the language the card is drawn in", () => {
    setLocale("ru");
    const won = setUp();
    won.app.startChapter1Level(1);
    won.app.world?.trigger("stats_changed");
    const lost = setUp();
    lost.app.startChapter1Level(2);
    lost.app.world?.trigger("stats_changed");

    expect(verdictTitle(won.elements)).toBe("Получилось!");
    expect(requireElement(".verdict p", won.elements.feedback).textContent).toBe("Уровень пройден");
    expect(verdictTitle(lost.elements)).toBe("Уровень провален");
    expect(requireElement(".verdict p", lost.elements.feedback).textContent).toBe(
      "Может быть, программу стоит доработать?",
    );
  });

  it("offers no next level after the last one", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    Object.defineProperty(app, "chapter1Levels", { value: LEVELS.slice(0, 2) });

    app.world?.trigger("stats_changed");

    expect(elements.feedback.querySelector("a")).toBeNull();
  });

  it("keeps the rest of the url in the next-level link", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=2,timescale=8,fullscreen=true"));

    app.world?.trigger("stats_changed");

    expect(requireElement(".verdict a", elements.feedback).getAttribute("href")).toBe(
      "#level=3,timescale=8,fullscreen=true",
    );
  });

  it("leaves the seed of the level just won out of the link to the next", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=2,timescale=8,seed=issue-61"));

    app.world?.trigger("stats_changed");

    expect(requireElement(".verdict a", elements.feedback).getAttribute("href")).toBe(
      "#level=3,timescale=8",
    );
  });

  it("puts the star the run earned beside the headline", () => {
    // A level with no silver or gold of its own rates a win as gold: clearing it is the whole achievement.
    const { app, elements } = setUp();
    app.startChapter1Level(1);

    app.world?.trigger("stats_changed");

    const stars = requireElement(".verdict h3 .stars", elements.feedback);
    expect(stars.getAttribute("data-tier")).toBe("gold");
    // Icons are aria-hidden, so this text is the screen-reader equivalent.
    expect(requireElement(".verdict h3 .visually-hidden", elements.feedback).textContent).toBe(
      "Level stars: Gold",
    );
    expect(elements.feedback.querySelector(".verdict-more")).toBeNull();
  });

  it("draws no star and no hint on a loss", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(2);

    app.world?.trigger("stats_changed");

    expect(elements.feedback.querySelector(".stars")).toBeNull();
    expect(elements.feedback.querySelector(".verdict-more")).toBeNull();
  });

  it("names what a bronze run still owes the next star", () => {
    const { app, elements } = setUp();
    withTiers(app, {
      silver: atLeastAvgLoadFactorOnMove(0.5),
      gold: atLeastAvgLoadFactorOnMove(0.9),
    });
    app.startChapter1Level(1);

    app.world?.trigger("stats_changed");

    // The fixture building has no passengers, so every car runs empty.
    expect(requireElement(".verdict-more", elements.feedback).textContent).toBe(
      "For silver: elevators run 50% full or more (now 0%)",
    );
  });

  it("says the hint again in the new language, figures and all", () => {
    const { app, elements } = setUp();
    withTiers(app, {
      silver: atLeastAvgLoadFactorOnMove(0.5),
      gold: atLeastAvgLoadFactorOnMove(0.9),
    });
    app.startChapter1Level(1);
    app.world?.trigger("stats_changed");

    setLocale("ru");
    app.relocalize();

    // U+00A0 (escaped) precedes both percent signs: Russian's pattern is unbreakable there.
    expect(requireElement(".verdict-more", elements.feedback).textContent).toBe(
      "До серебра: лифты заполнены на 50\u00A0% и выше (сейчас 0\u00A0%)",
    );
  });
});

describe("App instant run", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("crunches the current level headlessly and shows the same outcome overlay an animated run would", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    expect(queryAll(".elevator", elements.world)).toHaveLength(2);

    app.runInstantly();

    // presentBuildingStage is skipped during the crunch and runs once at the end, behind the verdict.
    expect(queryAll(".floor", elements.world)).toHaveLength(4);
    expect(queryAll(".elevator", elements.world)).toHaveLength(2);
    expect(app.world?.levelEnded).toBe(true);
    expect(verdictTitle(elements)).toBe("Success!");
    const button = requireElement(".startstop", elements.controls);
    expect(button.textContent).toBe("Start");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("crunches a program that did not compile as an empty one, rather than refusing to run", () => {
    const { app, elements, editorPaneMount, storage } = setUp();
    storage.setItem("develevateChallengeCode_1_1", "{ this is not javascript");
    app.startChapter1Level(1);

    app.runInstantly();

    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
    expect(app.world?.levelEnded).toBe(true);
    expect(verdictTitle(elements)).toBe("Success!");
  });

  it("falls back to a loss once the ceiling is reached without the level's own condition ever deciding", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0); // `evaluate` always returns null: nothing but the ceiling ends this

    app.runInstantly();
    if (app.world) {
      app.world.elapsedTime = INSTANT_RUN_MAX_SIMULATED_SECONDS;
      app.world.trigger("stats_changed");
    }

    expect(app.world?.levelEnded).toBe(true);
    expect(verdictTitle(elements)).toBe("Level failed");
  });

  it("surfaces a player-code error during a crunch through the same banner as any other run, and recovers the button", () => {
    const { app, elements, editorPaneMount, view } = setUp();
    app.startChapter1Level(0); // never resolves on its own; only the error ends this run
    view.type("{ init: function() {}, update: function() { throw new Error('boom'); } }");

    app.runInstantly();

    expect(codeErrorMessage(editorPaneMount)).toContain("boom");
    expect(app.world?.levelEnded).toBe(false);
    const button = requireElement(".startstop", elements.controls);
    expect(button.textContent).not.toBe("Crunching...");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("leaves the controls in their normal, ready state after starting a new run over an instant one", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0); // never resolves on its own
    app.runInstantly();

    app.startChapter1Level(1);

    const button = requireElement(".startstop", elements.controls);
    expect(button.textContent).toBe("Start");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(app.world?.floors).toHaveLength(4);
  });

  it("is what the primary button does once the speed control is on its instant stop", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    const before = app.world;
    reachInstantSpeed(elements);

    requireElement(".startstop", elements.controls).click();

    expect(app.world).not.toBe(before);
    expect(app.world?.levelEnded).toBe(true);
    expect(verdictTitle(elements)).toBe("Success!");
  });

  it("is what Start over does on that stop too", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    reachInstantSpeed(elements);

    requireElement(".startover", elements.controls).click();

    expect(app.world?.levelEnded).toBe(true);
  });

  it("is what applying the code does as well, since it is the same Mod-Enter", () => {
    // The editor's binding used to start an animated run instead, so where the caret happened to
    // be decided which of two things one keystroke did.
    const { app, elements, editor } = setUp();
    app.startChapter1Level(1);
    reachInstantSpeed(elements);

    editor.trigger("apply_code");

    expect(app.world?.levelEnded).toBe(true);
    expect(requireElement(".speed-val", elements.controls).textContent).toBe("∞x");
  });

  it("draws the finished building whichever way the crunch ended", () => {
    const { app, elements } = setUp();

    app.startChapter1Level(1); // resolves at once
    app.runInstantly();
    expect(queryAll(".floor", elements.world)).toHaveLength(4);
    expect(queryAll(".elevator", elements.world)).toHaveLength(2);

    app.startChapter1Level(2); // fails at once
    app.runInstantly();
    expect(verdictTitle(elements)).toBe("Level failed");
    expect(queryAll(".floor", elements.world)).toHaveLength(5);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
  });

  it("draws the building again when a crunch is stopped by an error in the program", () => {
    const { app, elements, view } = setUp();
    app.startChapter1Level(0); // never resolves on its own
    view.type("{ init: function() {}, update: function() { throw new Error('boom'); } }");

    app.runInstantly();

    expect(app.world?.levelEnded).toBe(false);
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
  });

  it("goes back to an animated run the moment the stop is left", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    reachInstantSpeed(elements);
    requireElement(".speed-down", elements.controls).click();

    requireElement(".startover", elements.controls).click();

    expect(queryAll(".elevator", elements.world)).toHaveLength(2);
    expect(app.world?.levelEnded).toBe(false);
  });
});

/** Walks the speed control to its instant stop; pressed rather than set, since the stop is a state, not a `timeScale` value. */
function reachInstantSpeed(elements: AppElements): void {
  const increase = requireElement(".speed-up", elements.controls);
  while (!increase.hasAttribute("disabled")) {
    increase.click();
  }
}

describe("App level navigation", () => {
  it("puts a tile for every level in the switcher, marking the one being played", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=2"));

    const entries = levelTiles(elements);
    expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
      "Level 1",
      "Level 2",
      "Level 3",
    ]);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([
      null,
      "page",
      null,
    ]);
  });

  it("keeps the rest of the url when jumping to another level", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=1,timescale=8,fullscreen=true"));

    expect(levelTiles(elements).map((entry) => entry.getAttribute("href"))).toEqual([
      "#level=1,timescale=8,fullscreen=true",
      "#level=2,timescale=8,fullscreen=true",
      "#level=3,timescale=8,fullscreen=true",
    ]);
  });

  it("carries an unknown parameter across a jump as well", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=1,fullscreen,somethingelse=7"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#level=2,fullscreen=,somethingelse=7");
  });

  it("starts the level a link names when it is clicked", async () => {
    const { app, elements } = setUp();
    window.location.hash = "#level=1,timescale=8";
    const stopRouter = startRouter(
      (params, query) => {
        app.handleRoute(params, query);
      },
      {
        chapter1LevelCount: LEVELS.length,
        defaultTimeScale: () => DEFAULT_TIME_SCALE,
      },
    );

    try {
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).click();

      await vi.waitFor(() => {
        expect(app.currentChapter1Index).toBe(1);
      });
      expect(window.location.hash).toBe("#level=2,timescale=8");
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
    app.handleRoute(...routeFor("#level=sandbox,floors=20,elevators=3,capacities=6-9"));

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
    // Three cars over a two-entry cycle: 6, 9, and 6 again.
    expect(app.world?.elevators.map((elevator) => elevator.maxUsers)).toEqual([6, 9, 6]);
  });

  it("spawns passengers at the rate the url asked for", () => {
    // The world starts one spawn interval behind (1.001 / spawnRate), so the first
    // second yields three passengers at 2/s and one at 0.5/s.
    const fast = setUp().app;
    fast.handleRoute(...routeFor("#level=sandbox,spawnrate=2"));
    fast.world?.update(1.0);
    expect(fast.world?.users).toHaveLength(3);

    const slow = setUp().app;
    slow.handleRoute(...routeFor("#level=sandbox,spawnrate=0.5"));
    slow.world?.update(1.0);
    expect(slow.world?.users).toHaveLength(1);
  });

  it("titles the bar with the parameters in effect, and not as a level", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20,elevators=3,spawnrate=1.5"));

    expect(goalDescription(elements)).toBe(
      "Sandbox: 20 floors, 3 elevators of capacity 4, 1.5 people per second. " +
        "No goal, so the run never ends",
    );
  });

  it("shows the clamped parameters, not the ones the url asked for", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=100000"));

    expect(goalDescription(elements)).toContain("Sandbox: 60 floors");
    expect(app.world?.floors).toHaveLength(60);
  });

  it("never ends, however long the run goes on", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=3,spawnrate=2"));
    const world = app.world;

    for (let i = 0; i < 50; i += 1) {
      world?.update(1.0);
    }
    world?.trigger("stats_changed");

    expect(world?.elapsedTime).toBeGreaterThanOrEqual(50);
    expect(world?.transportedCounter).toBe(0);
    expect(world?.maxWaitTime).toBeGreaterThan(40);
    expect(world?.levelEnded).toBe(false);
    expect(elements.feedback.innerHTML).toBe("");
  });

  it("leaves every level reachable, and marks none of them as current", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));

    const entries = levelTiles(elements);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([null, null, null]);
  });

  it("carries the sandbox parameters into a jump, and out of the sandbox", () => {
    // `level` is the only key a tile rewrites, so the sandbox's other parameters ride along.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20,timescale=8"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#level=2,floors=20,timescale=8");
  });

  it("stops being the sandbox once a numbered level is started", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));
    app.handleRoute(...routeFor("#level=2,floors=20"));

    expect(app.isPlayingSandbox).toBe(false);
    expect(app.world?.floors).toHaveLength(4);
    expect(goalDescription(elements)).toBe("Level two");
  });

  it("stays in the sandbox when the program is applied", () => {
    const { app, editor, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));

    editor.trigger("apply_code");

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
    expect(goalDescription(elements)).toContain("Sandbox:");
    expect(app.worldController.isPaused).toBe(false);
  });

  it("stays in the sandbox when the world is restarted from the bar", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));
    // Reachable only after the world is torn down; the sandbox itself never ends.
    app.world?.unWind();

    requireElement(".startstop", elements.controls).click();

    expect(app.isPlayingSandbox).toBe(true);
    expect(app.world?.floors).toHaveLength(20);
  });

  it("does not offer the instant stop, because there is no end to crunch to", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));

    reachInstantSpeed(elements);

    expect(requireElement(".speed-val", elements.controls).textContent).toBe("16x");
    expect(app.worldController.timeScale).toBe(16);
    expect(requireElement(".speed-up", elements.controls).hasAttribute("disabled")).toBe(true);
  });

  it("leaves the instant stop on the way in, and offers it again on the way out", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    reachInstantSpeed(elements);
    expect(requireElement(".speed-val", elements.controls).textContent).toBe("∞x");

    app.handleRoute(...routeFor("#level=sandbox,floors=20,timescale=16"));

    expect(requireElement(".speed-val", elements.controls).textContent).toBe("16x");
    expect(requireElement(".speed-up", elements.controls).hasAttribute("disabled")).toBe(true);

    app.handleRoute(...routeFor("#level=1,timescale=16"));
    expect(requireElement(".speed-up", elements.controls).hasAttribute("disabled")).toBe(false);
  });

  it("ignores a crunch asked for by any other route", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20,spawnrate=2"));
    const world = app.world;

    app.runInstantly();

    expect(app.world).toBe(world);
    expect(app.world?.levelEnded).toBe(false);
    expect(elements.feedback.innerHTML).toBe("");
  });
});

describe("App learning track", () => {
  // So a failing assertion can't leave the suite in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /** The level at a position in the track, read from the real `tutorialLevels` table. */
  function levelAt(index: number): TutorialLevel {
    const level = tutorialLevels[index];
    if (level === undefined) {
      throw new Error(`The learning track has no level at position ${String(index)}`);
    }
    return level;
  }

  /** Ends the run on screen by writing the verdict straight into the world's counters. */
  function endRun(app: App, won: boolean): void {
    const world = app.world;
    if (world === undefined) {
      throw new Error("There is no run to end");
    }
    world.transportedCounter = won ? 1000 : 0;
    world.elapsedTime = won ? 1 : 1000;
    world.trigger("stats_changed");
  }

  /** Where the editor keeps one level's program, spelled out rather than imported so a prefix rename would break this test. */
  const LEVEL_2_CODE_KEY = "develevateTutorialCode_tutorial-2";

  it("plays the level the url names rather than level 1", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=3"));

    app.handleRoute(...routeFor("#level=tutorial-5"));

    expect(app.tutorial?.level.id).toBe("tutorial-5");
    expect(app.tutorial?.index).toBe(4);
    expect(app.isPlayingSandbox).toBe(false);
    expect(app.world?.floors.length).toBe(levelAt(4).options.floorCount);
    expect(app.currentChapter1Index).toBe(2);
  });

  it("builds a level on its own pinned seed rather than a fresh draw", () => {
    // A random draw would make the lesson a coin flip instead of a guaranteed contrast.
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=tutorial-3"));
    expect(app.world?.seed).toBe(levelAt(2).seed);
  });

  it("keeps the level's seed when the url is still carrying a level's", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=2,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");

    app.startTutorial(0);

    expect(app.world?.seed).toBe(levelAt(0).seed);
  });

  it("offers no seed line, and prints none, because both halves of it are refused", () => {
    const { app } = setUp();
    app.startTutorial(0);

    expect(app.currentSeedLink).toBeNull();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("hands a level nobody has opened its starting program", () => {
    const { app, view } = setUp();
    app.startTutorial(0);
    expect(view.getValue()).toBe(levelAt(0).startingCode);
  });

  it("opens the level's buffer before the run compiles anything", () => {
    // The buffer switch must happen before compiling, or the error banner would never appear.
    const { app, editorPaneMount, storage, view } = setUp();
    storage.setItem(LEVEL_2_CODE_KEY, "{ this is not javascript");

    app.startTutorial(1);

    expect(view.getValue()).toBe("{ this is not javascript");
    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
  });

  it("puts the player's own program back on the way out", () => {
    const { app, storage, view } = setUp();
    storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
    app.startTutorial(0);
    expect(view.getValue()).not.toBe(INERT_CODE);

    app.handleRoute(...routeFor("#level=1"));

    expect(app.tutorial).toBeUndefined();
    expect(view.getValue()).toBe(INERT_CODE);
  });

  it("leaves the track for the sandbox as readily as for a level", () => {
    const { app, storage, view } = setUp();
    storage.setItem(CODE_STORAGE_KEY, INERT_CODE);
    app.startTutorial(2);

    app.handleRoute(...routeFor("#level=sandbox,floors=20"));

    expect(app.tutorial).toBeUndefined();
    expect(app.isPlayingSandbox).toBe(true);
    expect(view.getValue()).toBe(INERT_CODE);
  });

  it("repeats the level when the program is applied, not the last level played", () => {
    const { app, editor, view } = setUp();
    app.handleRoute(...routeFor("#level=3"));
    app.startTutorial(2);
    view.type("// half an answer");
    const before = app.world;

    editor.trigger("apply_code");

    expect(app.world).not.toBe(before);
    expect(app.tutorial?.level.id).toBe("tutorial-3");
    expect(app.world?.floors.length).toBe(levelAt(2).options.floorCount);
    expect(app.worldController.isPaused).toBe(false);
    expect(view.getValue()).toBe("// half an answer");
  });

  it("repeats the level from the bar's restart button", () => {
    const { app, elements } = setUp();
    app.startTutorial(1);
    // Reachable only once the run is over.
    app.world?.unWind();

    requireElement(".startstop", elements.controls).click();

    expect(app.tutorial?.level.id).toBe("tutorial-2");
    expect(app.world?.levelEnded).toBe(false);
  });

  it("numbers the track's own trigger label rather than the level list's", () => {
    const { app, elements } = setUp();
    app.startTutorial(2);

    // The medal is the tile's business, not the trigger's.
    expect(taskName(elements)).toBe("Lesson 3");
  });

  it("keeps the track's own numbering through a language change mid-run", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    setLocale("ru");
    app.relocalize();

    expect(taskName(elements)).toBe("Урок 1");
  });

  it("leaves every level reachable from a level, and marks none of them current", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=tutorial-4,timescale=8"));

    const entries = levelTiles(elements);
    expect(entries.map((entry) => entry.getAttribute("aria-current"))).toEqual([null, null, null]);
    expect(entries[1]?.getAttribute("href")).toBe("#level=2,timescale=8");
  });

  it("offers the next level, by name, after a win in the middle of the track", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, true);

    expect(verdictTitle(elements)).toBe("Success!");
    const link = requireElement(".verdict a", elements.feedback);
    expect(link.getAttribute("href")).toBe(`#level=${levelAt(1).id}`);
    expect(link.textContent.trim()).toBe("Next tutorial level");
    // The caret the template put beside the words survives being relabeled.
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("ends the track by offering level 1", () => {
    const { app, elements } = setUp();
    app.startTutorial(tutorialLevels.length - 1);

    endRun(app, true);

    expect(verdictTitle(elements)).toBe("The track is finished");
    const link = requireElement(".verdict a", elements.feedback);
    expect(link.getAttribute("href")).toBe("#level=1");
    expect(link.textContent.trim()).toBe("Go to level 1");
  });

  it("says how long the track was in the words each catalog counts it with", () => {
    // tutorial.finish.message spells the track length out in words, so update
    // SPELLED_OUT whenever the track's length changes.
    const SPELLED_OUT: Readonly<Record<number, Readonly<Record<Locale, string>>>> = {
      8: { en: "Eight tutorial levels", ru: "Восемь учебных уровней" },
    };
    const words = SPELLED_OUT[tutorialLevels.length];
    expect(
      words,
      `no wording is recorded for a track of ${String(tutorialLevels.length)}`,
    ).toBeDefined();

    for (const locale of LOCALES) {
      setLocale(locale);
      const { app, elements } = setUp();
      app.startTutorial(tutorialLevels.length - 1);

      endRun(app, true);

      expect(requireElement(".verdict p", elements.feedback).textContent).toContain(
        words?.[locale],
      );
    }
  });

  it("promises nothing on that link that following it does not do", () => {
    const { app, elements, view, storage } = setUp();
    storage.setItem(CODE_STORAGE_KEY, "// the program I came in with");
    app.startTutorial(tutorialLevels.length - 1);
    view.type("// the program that clears level 1");

    endRun(app, true);
    const link = requireElement(".verdict a", elements.feedback);
    app.handleRoute(...routeFor(link.getAttribute("href") ?? ""));

    expect(link.textContent.trim()).not.toContain("this program");
    expect(view.getValue()).toBe("// the program I came in with");
    expect(storage.getItem(`develevateTutorialCode_${levelAt(tutorialLevels.length - 1).id}`)).toBe(
      "// the program that clears level 1",
    );
  });

  it("says a lost level is lost, and offers nothing", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, false);

    expect(verdictTitle(elements)).toBe("Level failed");
    expect(elements.feedback.querySelector("a")).toBeNull();
    expect(elements.feedback.querySelector(".stars")).toBeNull();
  });

  it("puts the same gold on the card that the cleared tile shows", () => {
    const { app, elements } = setUp();
    app.startTutorial(0);

    endRun(app, true);

    const stars = requireElement(".verdict h3 .stars", elements.feedback);
    expect(stars.getAttribute("data-tier")).toBe("gold");
    expect(requireElement(".verdict h3 .visually-hidden", elements.feedback).textContent).toBe(
      "Level stars: Gold",
    );
    // The track grades nothing, so there is no next bar to name.
    expect(elements.feedback.querySelector(".verdict-more")).toBeNull();
  });

  it("records a cleared level, and records it once however often it is cleared", () => {
    const { app, storage } = setUp();
    expect(readClearedTutorialLevels(storage)).toEqual(new Set());

    app.startTutorial(0);
    endRun(app, true);
    expect(readClearedTutorialLevels(storage)).toEqual(new Set([levelAt(0).id]));

    app.startTutorial(0);
    endRun(app, true);
    expect(readClearedTutorialLevels(storage)).toEqual(new Set([levelAt(0).id]));
  });

  it("redraws a level's verdict in the new language, link and all", () => {
    // relocalize redraws the remembered outcome from data, not markup, so it must not
    // relabel the link with the numbered ladder's wording mid-track.
    const { app, elements } = setUp();
    app.startTutorial(0);
    endRun(app, true);

    setLocale("ru");
    app.relocalize();

    expect(verdictTitle(elements)).toBe("Получилось!");
    const link = requireElement(".verdict a", elements.feedback);
    expect(link.getAttribute("href")).toBe(`#level=${levelAt(1).id}`);
    expect(link.textContent.trim()).toBe("Следующий учебный уровень");
  });

  it("records nothing for a level that was lost", () => {
    const { app, storage } = setUp();
    app.startTutorial(0);

    endRun(app, false);

    expect(readClearedTutorialLevels(storage)).toEqual(new Set());
  });

  it("refuses a position that does not name a level", () => {
    const { app } = setUp();
    expect(() => {
      app.startTutorial(99);
    }).toThrow(RangeError);
  });

  describe("the panel beside the building", () => {
    /** The level index the panel on screen was drawn for, or `null` when it's empty. */
    function drawnLevelIndex(elements: AppElements): string | null {
      return (
        elements.tutorial.querySelector(".tutorialpanel")?.getAttribute("data-level-index") ?? null
      );
    }

    it("draws the panel for the level on screen", () => {
      const { app, elements } = setUp();
      app.startTutorial(2);

      expect(drawnLevelIndex(elements)).toBe("2");
      expect(requireElement(".tutorialtitle", elements.tutorial).textContent).toBe(
        "The buttons inside the car",
      );
      expect(requireElement(".tutorialsolution code", elements.tutorial).textContent).toBe(
        levelAt(2).solutionCode,
      );
    });

    it("leaves the region empty everywhere else, so the page has no gap in it", () => {
      const { app, elements } = setUp();
      expect(elements.tutorial.children).toHaveLength(0);

      app.startTutorial(2);
      expect(elements.tutorial.children).toHaveLength(1);

      app.startChapter1Level(0);
      expect(elements.tutorial.children).toHaveLength(0);

      app.startTutorial(2);
      app.handleRoute(...routeFor("#level=sandbox,floors=20"));
      expect(elements.tutorial.children).toHaveLength(0);
    });

    it("redraws the panel when the language changes under it", () => {
      const { app, elements } = setUp();
      app.startTutorial(0);

      setLocale("ru");
      app.relocalize();

      expect(drawnLevelIndex(elements)).toBe("0");
      expect(requireElement(".tutorialtitle", elements.tutorial).textContent).toBe(
        "Лифт, который никуда не едет",
      );
      expect(requireElement(".tutorialhint summary", elements.tutorial).textContent).toBe(
        "Подсказка 1",
      );
    });

    it("marks the cleared lesson in the switcher without shutting the hints under it", () => {
      const { app, elements } = setUp();
      app.startTutorial(0);
      const hint = requireElement(".tutorialhint", elements.tutorial);
      if (!(hint instanceof HTMLDetailsElement)) {
        throw new TypeError("A hint is a disclosure");
      }
      hint.open = true;
      const tile = (): HTMLElement =>
        requireElement(`[href="#level=${levelAt(0).id}"]`, elements.levelSwitcher);
      expect(tile().getAttribute("aria-label")).toBe("Tutorial level 1");

      endRun(app, true);

      expect(requireElement(".tutorialhint", elements.tutorial)).toBe(hint);
      expect(hint.open).toBe(true);
      expect(tile().getAttribute("aria-label")).toBe("Tutorial level 1, Gold");
      expect(tile().getAttribute("data-tier")).toBe("gold");
    });

    it("leaves the run controls to be the only way to start the level again", () => {
      const { app, elements } = setUp();
      app.startTutorial(1);
      const before = app.world;

      expect(elements.tutorial.querySelector(".tutorialrestart")).toBeNull();
      requireElement(".startover", elements.controls).click();

      expect(app.world).not.toBe(before);
      expect(app.tutorial?.level.id).toBe("tutorial-2");
      expect(app.worldController.isPaused).toBe(false);
    });
  });
});

describe("App chapter two", () => {
  // So a failing assertion can't leave the suite in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /** The level at a position in chapter two, read from the real `chapter2Levels` table. */
  function levelAt(index: number): Chapter2Level {
    const level = chapter2Levels[index];
    if (level === undefined) {
      throw new Error(`Chapter two has no level at position ${String(index)}`);
    }
    return level;
  }

  /** The briefing card of a level expected to carry one; throws instead of returning `undefined` so a missing card fails at the lookup. */
  function cardAt(index: number): Chapter2Card {
    const card = levelAt(index).card;
    if (card === undefined) {
      throw new Error(`The chapter two level at position ${String(index)} carries no card`);
    }
    return card;
  }

  /** Ends the run on screen; `chapter2-1` is judged in moves, so a win zeroes `moveCount` instead of adjusting elapsed time. */
  function endRun(app: App, won: boolean): void {
    const world = app.world;
    if (world === undefined) {
      throw new Error("There is no run to end");
    }
    world.transportedCounter = won ? 1000 : 0;
    world.moveCount = won ? 0 : 100000;
    world.trigger("stats_changed");
  }

  it("plays the level the url names rather than level 1", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=3"));

    app.handleRoute(...routeFor("#level=chapter2-1"));

    expect(app.chapter2?.level.id).toBe("chapter2-1");
    expect(app.chapter2?.index).toBe(0);
    expect(app.isPlayingSandbox).toBe(false);
    expect(app.currentChapter1Index).toBe(2);
  });

  it("builds the level's own building", () => {
    const { app } = setUp();

    app.startChapter2Level(0);

    expect(app.world?.floors.length).toBe(levelAt(0).options.floorCount);
    // The table's one capacity cycles over all three cars.
    expect(app.world?.elevators.map((elevator) => elevator.maxUsers)).toEqual([8, 8, 8]);
  });

  it("builds a level on its own pinned seed, over the url's and the player's alike", () => {
    // A silver threshold here is calibrated against one specific run, so the level's
    // seed must outrank the url's and the player's, set here to different values.
    const storage = new MemoryStorage();
    const { app } = setUp(INERT_CODE, storage);
    app.handleRoute(...routeFor("#level=2,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");
    storage.setItem(SEED_STORAGE_KEY, "issue-62");
    expect(readStoredSeed(storage)).toBe("issue-62");

    app.startChapter2Level(0);

    expect(app.world?.seed).toBe(levelAt(0).seed);
  });

  it("offers no seed line, and leaves the player's remembered seed alone", () => {
    const storage = new MemoryStorage();
    storage.setItem(SEED_STORAGE_KEY, "issue-61");
    const { app } = setUp(INERT_CODE, storage);

    app.startChapter2Level(0);

    expect(app.world?.seed).toBe(levelAt(0).seed);
    expect(app.currentSeedLink).toBeNull();
    expect(console.log).not.toHaveBeenCalled();
    expect(readStoredSeed(storage)).toBe("issue-61");
  });

  it("refuses a position that does not name a level", () => {
    const { app } = setUp();
    expect(() => {
      app.startChapter2Level(99);
    }).toThrow(RangeError);
  });

  it("takes the screen over from a lesson and from the sandbox", () => {
    // A field left set fails silently: the switcher would mark a level the player left, and Ctrl-Enter would restart it.
    const { app } = setUp();
    app.startTutorial(0);

    app.startChapter2Level(0);

    expect(app.chapter2?.level.id).toBe(levelAt(0).id);
    expect(app.tutorial).toBeUndefined();

    app.handleRoute(...routeFor("#level=sandbox,floors=20"));
    app.startChapter2Level(0);

    expect(app.chapter2?.level.id).toBe(levelAt(0).id);
    expect(app.isPlayingSandbox).toBe(false);
  });

  it("is left behind by a lesson, a numbered level and the sandbox alike", () => {
    // Every start* clears this field through the same helper.
    const { app } = setUp();

    app.startChapter2Level(0);
    app.startTutorial(0);
    expect(app.chapter2).toBeUndefined();
    expect(app.tutorial?.index).toBe(0);

    app.startChapter2Level(0);
    app.handleRoute(...routeFor("#level=2"));
    expect(app.chapter2).toBeUndefined();
    expect(app.currentChapter1Index).toBe(1);

    app.startChapter2Level(0);
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));
    expect(app.chapter2).toBeUndefined();
    expect(app.isPlayingSandbox).toBe(true);
  });

  it("repeats the level when the program is applied, not the last level played", () => {
    const { app, editor, view } = setUp();
    app.handleRoute(...routeFor("#level=3"));
    app.startChapter2Level(0);
    view.type("// half an answer");
    const before = app.world;

    editor.trigger("apply_code");

    expect(app.world).not.toBe(before);
    expect(app.chapter2?.level.id).toBe(levelAt(0).id);
    expect(app.world?.floors.length).toBe(levelAt(0).options.floorCount);
    expect(app.worldController.isPaused).toBe(false);
    expect(view.getValue()).toBe("// half an answer");
  });

  it("leaves the code-slot switcher inert while one of its levels is on screen", () => {
    // Buffers are keyed by level id, not slot index, so a stray press can't replace
    // this level's program with a numbered level's slot.
    const { app, storage, view } = setUp();
    storage.setItem("develevateChallengeCode_0_2", "// slot two's program");
    app.startChapter2Level(0);

    app.selectCodeSlot(2);

    expect(app.currentCodeSlot).toBe(DEFAULT_CODE_SLOT);
    expect(view.getValue()).toBe(levelAt(0).startingCode);
  });

  it("records a medal for a win, under the level's own id", () => {
    // Recorded under the block's own store, keyed by id, so it can't collide with the
    // numbered levels' tiers.
    const { app, elements, storage } = setUp();
    // A demo level grading nothing, so its win is gold.
    expect(levelAt(0).tiers).toBe(WINNING_IS_GOLD);

    app.startChapter2Level(0);
    endRun(app, true);

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([[levelAt(0).id, "gold"]]));
    expect(readBestChapter1Tiers(storage)).toEqual(new Map());
    // The tile updates without waiting for the next run's redraw.
    expect(
      requireElement('[href^="#level=chapter2-1"]', elements.levelSwitcher).getAttribute(
        "data-tier",
      ),
    ).toBe("gold");
    // The card names the same medal, though the block's levels have no index to key one by.
    expect(requireElement(".verdict h3 .stars", elements.feedback).getAttribute("data-tier")).toBe(
      "gold",
    );
  });

  it("puts a graded level's own star and its next-star hint on the card", () => {
    // `chapter2-3` grades in moves, and the block has no level index to key a tier by; the
    // card owes the same bronze and the same "for silver" line a numbered level's would.
    const { app, elements, storage } = setUp();
    app.startChapter2Level(2);

    // Enough passengers to clear the level, in more moves than silver allows.
    const world = app.world;
    if (world === undefined) {
      throw new Error("There is no run to end");
    }
    world.transportedCounter = 1000;
    world.moveCount = 260;
    world.trigger("stats_changed");

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([[levelAt(2).id, "bronze"]]));
    expect(requireElement(".verdict h3 .stars", elements.feedback).getAttribute("data-tier")).toBe(
      "bronze",
    );
    expect(requireElement(".verdict-more", elements.feedback).textContent).toBe(
      "For silver: elevators travel no more than 250 floors (now 260)",
    );
  });

  it("records nothing for a level that was lost", () => {
    const { app, elements, storage } = setUp();
    app.startChapter2Level(0);

    endRun(app, false);

    expect(verdictTitle(elements)).toBe("Level failed");
    expect(readBestChapter2Tiers(storage)).toEqual(new Map());
  });

  it("links to the block's levels by id, dropping the seed of the run in progress", () => {
    // A tile drops the seed: it names a run of a different building.
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=1,timescale=8,seed=issue-61"));

    expect(
      requireElement('[href^="#level=chapter2-1"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#level=chapter2-1,timescale=8");
  });

  it("marks the block's own tile as current, and no numbered level", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=chapter2-1,timescale=8"));

    expect(
      requireElement('[href^="#level=chapter2-1"]', elements.levelSwitcher).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    expect(levelTiles(elements).map((entry) => entry.getAttribute("aria-current"))).toEqual([
      null,
      null,
      null,
    ]);
    // Chapter two carries on the three fixture levels' numbering.
    expect(taskName(elements)).toBe("Level 4");
  });

  describe("the briefing card beside the building", () => {
    // chapter2-2 (index 1) is where traffic profiles are introduced and carries a card;
    // chapter2-1 (index 0) is the level below that carries none.
    const CARD_LEVEL = 1;

    it("draws the level's name and the paragraph it is about", () => {
      const { app, elements } = setUp();
      app.startChapter2Level(CARD_LEVEL);

      expect(requireElement(".briefingtitle", elements.tutorial).textContent).toBe(
        "Everyone starts in the lobby",
      );
      // Compared as markup, not text: the briefing carries `<em>` around key terms,
      // and escaped tags would print literally.
      expect(requireElement(".briefingtext", elements.tutorial).innerHTML).toBe(
        cardAt(CARD_LEVEL).briefing,
      );
      expect(elements.tutorial.querySelector(".tutorialpanel")).toBeNull();
    });

    it("draws nothing at all on a level with nothing to introduce", () => {
      const { app, elements } = setUp();
      app.startChapter2Level(CARD_LEVEL);
      expect(elements.tutorial.children).toHaveLength(1);

      app.startChapter2Level(0);

      expect(levelAt(0).card).toBeUndefined();
      expect(elements.tutorial.children).toHaveLength(0);
    });

    it("gives the region back to the lesson panel on the way to a lesson", () => {
      const { app, elements } = setUp();
      app.startChapter2Level(CARD_LEVEL);

      app.startTutorial(2);

      expect(elements.tutorial.querySelector(".briefingpanel")).toBeNull();
      expect(requireElement(".tutorialtitle", elements.tutorial).textContent).toBe(
        "The buttons inside the car",
      );
    });

    it("empties the region on a numbered level, so the page has no gap in it", () => {
      const { app, elements } = setUp();
      app.startChapter2Level(CARD_LEVEL);
      expect(elements.tutorial.children).toHaveLength(1);

      app.startChapter1Level(0);

      expect(elements.tutorial.children).toHaveLength(0);
    });

    it("redraws the card when the language changes under it", () => {
      const { app, elements } = setUp();
      app.startChapter2Level(CARD_LEVEL);

      setLocale("ru");
      app.relocalize();

      expect(requireElement(".briefingtitle", elements.tutorial).textContent).toBe(
        "Все начинают в холле",
      );
      expect(requireElement(".briefingtext", elements.tutorial).textContent).toContain(
        "утренний пик",
      );
    });
  });
});

describe("App seed", () => {
  // So a failing assertion can't leave the suite in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /** The passengers a run produces, in order, as `from>to`; `step` must evenly divide `seconds`. */
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
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");
  });

  it("draws a seed of its own when the url pins none, and records it", () => {
    const { app, storage } = setUp();
    app.handleRoute(...routeFor("#level=1"));
    expect(typeof app.world?.seed).toBe("number");
    expect(storage.getItem(SEED_STORAGE_KEY)).toBe(String(app.world?.seed));
  });

  it("brings one seed's passengers back whatever the frame length", () => {
    // Varying the frame length between runs is the point: anything drawing from frame
    // timing instead of the seed's own stream would fail here.
    const first = setUp().app;
    first.handleRoute(...routeFor("#level=sandbox,floors=8,spawnrate=2,seed=issue-61"));
    const second = setUp().app;
    second.handleRoute(...routeFor("#level=sandbox,floors=8,spawnrate=2,seed=issue-61"));

    const slow = passengerStream(first, 10, 1.0);
    const fast = passengerStream(second, 10, 0.25);
    const shared = Math.min(slow.length, fast.length);

    expect(shared).toBeGreaterThan(15);
    expect(fast.slice(0, shared)).toEqual(slow.slice(0, shared));
  });

  it("gives two unseeded runs different passengers", () => {
    const first = setUp().app;
    first.handleRoute(...routeFor("#level=sandbox,floors=8,spawnrate=2"));
    const second = setUp().app;
    second.handleRoute(...routeFor("#level=sandbox,floors=8,spawnrate=2"));

    expect(first.world?.seed).not.toBe(second.world?.seed);
    expect(passengerStream(second, 10)).not.toEqual(passengerStream(first, 10));
  });

  it("restarts a pinned run on the same seed, however it is restarted", () => {
    const { app, editor, elements } = setUp();
    app.handleRoute(...routeFor("#level=3,seed=issue-61"));

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.controls).click();
    expect(app.world?.seed).toBe("issue-61");

    editor.trigger("apply_code");
    expect(app.world?.seed).toBe("issue-61");
  });

  it("restarts an unpinned run on the seed it was already playing", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=3"));
    const first = String(app.world?.seed);

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.controls).click();

    // Compared as text: an unseeded run's seed is a number in memory but a string once
    // round-tripped through storage; both hash to the same stream.
    expect(String(app.world?.seed)).toBe(first);
  });

  it("plays the seed this browser last played, on a visit that names none", () => {
    const storage = new MemoryStorage();
    storage.setItem(SEED_STORAGE_KEY, "issue-61");
    const { app } = setUp(INERT_CODE, storage);

    app.handleRoute(...routeFor("#level=1"));

    expect(app.world?.seed).toBe("issue-61");
  });

  it("carries the player's own seed into the building a tile opens", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));

    app.handleRoute(...routeFor("#level=2"));

    expect(app.world?.seed).toBe("issue-61");
  });

  it("ignores a remembered seed the address bar could never carry", () => {
    const storage = new MemoryStorage();
    storage.setItem(SEED_STORAGE_KEY, "rush hour");
    const { app } = setUp(INERT_CODE, storage);

    app.handleRoute(...routeFor("#level=1"));

    expect(app.world?.seed).not.toBe("rush hour");
    expect(typeof app.world?.seed).toBe("number");
  });

  it("keeps playing when the browser refuses to remember anything", () => {
    const storage = new MemoryStorage();
    const { app } = setUp(INERT_CODE, storage);
    const refuse = (): never => {
      throw new Error("The quota is exhausted");
    };
    vi.spyOn(storage, "setItem").mockImplementation(refuse);
    vi.spyOn(storage, "getItem").mockImplementation(refuse);

    app.handleRoute(...routeFor("#level=1,seed=issue-61"));

    expect(app.world?.seed).toBe("issue-61");
  });

  it("keeps the pinned seed when another level is started", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));
    app.handleRoute(...routeFor("#level=2,seed=issue-61"));
    expect(app.world?.seed).toBe("issue-61");
  });

  it("takes a seed the url stops naming as still the player's own", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));
    app.handleRoute(...routeFor("#level=1"));
    expect(app.world?.seed).toBe("issue-61");
  });

  it("offers the seed of the run, keeping the rest of the url", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=2,timescale=8"));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.seed).toBe(seed);
    expect(app.currentSeedLink?.url).toBe(`#level=2,timescale=8,seed=${seed}`);
  });

  it("replaces the seed in the url rather than adding a second one", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=2,seed=issue-61"));

    const printed = String(vi.mocked(console.log).mock.calls[0]?.[0]);
    expect(printed).toContain("#level=2,seed=issue-61");
    expect(printed.match(/seed=/g)).toHaveLength(1);
  });

  it("leaves a pinned seed behind when the switcher jumps to another level", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=1,timescale=8,seed=issue-61"));

    expect(
      requireElement('[aria-label="Level 2"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#level=2,timescale=8");
    expect(
      requireElement('[aria-label="Level 1"]', elements.levelSwitcher).getAttribute("href"),
    ).toBe("#level=1,timescale=8");
  });

  it("offers the seed of a sandbox run as well, building and all", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20"));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.url).toBe(`#level=sandbox,floors=20,seed=${seed}`);
  });

  it("gives the seed link an address even when the url is empty", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor(""));
    const seed = String(app.world?.seed);

    expect(app.currentSeedLink?.url).toBe(`#level=1,seed=${seed}`);
  });

  it("prints the seed and a whole url at every start", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));

    expect(console.log).toHaveBeenCalledWith(
      `Seed issue-61 — the exact same run again, whatever the frame rate: ` +
        `${window.location.origin}/#level=1,seed=issue-61`,
    );
  });

  it("prints it in the language the player is reading", () => {
    setLocale("ru");
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));

    expect(console.log).toHaveBeenCalledWith(
      `Сид issue-61 — тот же самый прогон один в один, независимо от частоты кадров: ` +
        `${window.location.origin}/#level=1,seed=issue-61`,
    );
  });

  it("offers the exact same run back, because the controller no longer depends on frame timing", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));

    const printed = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatch(/exact/i);
    expect(printed[0]).not.toMatch(/never quite the same/i);
  });

  it("prints a fresh line for every run, including a restart", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=3"));
    vi.mocked(console.log).mockClear();

    app.world?.trigger("stats_changed");
    requireElement(".startstop", elements.controls).click();

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log).mock.calls[0]?.[0]).toContain(String(app.world?.seed));
  });

  it("offers the run's own address whether or not the url already names it", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=2,timescale=8"));
    const drawn = String(app.world?.seed);
    expect(app.currentSeedLink?.url).toBe(`#level=2,timescale=8,seed=${drawn}`);

    app.handleRoute(...routeFor("#level=2,timescale=8,seed=issue-61"));

    expect(app.currentSeedLink?.url).toBe("#level=2,timescale=8,seed=issue-61");
  });

  it("keeps the sandbox building in the seed's own address", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=sandbox,floors=20,seed=issue-61"));

    expect(app.currentSeedLink?.url).toBe("#level=sandbox,floors=20,seed=issue-61");
  });

  it("treats a seed the router refused as no seed at all", () => {
    // A browser percent-encodes the space in "#seed=rush hour" to "rush%20hour", the
    // form written here; the `%` fails SEED_PATTERN, so the router draws a fresh seed.
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=rush%20hour"));
    const seed = String(app.world?.seed);

    expect(seed).not.toContain("rush");
    expect(app.currentSeedLink?.url).toBe(`#level=1,seed=${seed}`);
  });

  it("has no seed line to offer before the first run has started", () => {
    // The page reads this while drawing its chrome, which happens before any route resolves.
    const { app } = setUp();
    expect(app.currentSeedLink).toBeNull();
  });

  describe("playSeed", () => {
    // The only method here that writes to the address bar, so it must be put back.
    afterEach(() => {
      window.location.hash = "";
    });

    it("puts the seed the player chose in the address bar", () => {
      const { app } = setUp();
      app.handleRoute(...routeFor("#level=2,timescale=8"));

      app.playSeed("hand-picked");

      expect(window.location.hash).toBe("#level=2,timescale=8,seed=hand-picked");
    });

    it("keeps the sandbox's building when a seed is chosen inside it", () => {
      const { app } = setUp();
      app.handleRoute(...routeFor("#level=sandbox,floors=20"));

      app.playSeed("hand-picked");

      expect(window.location.hash).toBe("#level=sandbox,floors=20,seed=hand-picked");
    });
  });

  it("tells a caller built before the first run what each later run's seed is", () => {
    // Lets a caller mounted before the first route resolves learn every later run's
    // seed; currentSeedLink alone only answers for what is on screen now.
    const seen: (SeedLinkData | null)[] = [];
    const { app } = setUp(INERT_CODE, new MemoryStorage(), (seed) => seen.push(seed));

    app.handleRoute(...routeFor("#level=1,seed=issue-61"));
    expect(seen.at(-1)?.seed).toBe("issue-61");

    app.handleRoute(...routeFor("#level=2,seed=issue-62"));
    expect(seen.at(-1)?.seed).toBe("issue-62");
    expect(seen.at(-1)?.url).toBe("#level=2,seed=issue-62");
  });

  it("tells that caller again on a language change, even when the seed itself did not change", () => {
    const seen: (SeedLinkData | null)[] = [];
    const { app } = setUp(INERT_CODE, new MemoryStorage(), (seed) => seen.push(seed));
    app.handleRoute(...routeFor("#level=1,seed=issue-61"));
    const callsBeforeRelocalize = seen.length;

    setLocale("ru");
    app.relocalize();

    expect(seen.length).toBeGreaterThan(callsBeforeRelocalize);
    expect(seen.at(-1)?.seed).toBe("issue-61");
  });
});

describe("App focus", () => {
  it("hands focus to the start button when the next-level link is taken", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=2"));
    app.world?.trigger("stats_changed");
    const link = requireElement(".verdict a", elements.feedback);
    link.focus();
    expect(document.activeElement).toBe(link);

    app.handleRoute(...routeFor("#level=3"));

    const startStop = requireElement(".startstop", elements.controls);
    expect(document.activeElement).toBe(startStop);
    // Focused after it has its label, so it is not announced unnamed.
    expect(startStop.textContent).toBe("Start");
  });

  it("keeps focus in the navigation row when a level is taken from it", () => {
    const { app, elements } = setUp();
    app.handleRoute(...routeFor("#level=1"));
    requireElement('[aria-label="Level 2"]', elements.levelSwitcher).focus();

    app.handleRoute(...routeFor("#level=2"));

    const entry = requireElement('[aria-label="Level 2"]', elements.levelSwitcher);
    expect(document.activeElement).toBe(entry);
    expect(entry.getAttribute("aria-current")).toBe("page");
  });

  it("hands focus to the start button when the building it was in is torn down", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    requireElement(".floor button.up", elements.world).focus();

    app.startChapter1Level(1);

    expect(document.activeElement).toBe(requireElement(".startstop", elements.controls));
  });

  it("gives the start button its final label before handing it the focus", () => {
    // "Start over" auto-starts, so the button's label is set twice in quick succession;
    // captured inside the `focus` spy because both orderings look identical afterward.
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    const startStop = requireElement(".startstop", elements.controls);
    expect(startStop.textContent).toBe("Start");
    let labelWhenFocused: string | null = null;
    vi.spyOn(startStop, "focus").mockImplementation(() => {
      labelWhenFocused = startStop.textContent;
    });
    requireElement(".floor button.up", elements.world).focus();

    requireElement(".startover", elements.controls).click();

    expect(labelWhenFocused).toBe("Pause");
  });

  it("leaves focus alone when the level is restarted from the editor", () => {
    const { app, editor } = setUp();
    app.startChapter1Level(0);
    const elsewhere = createElement("textarea");
    document.body.append(elsewhere);
    elsewhere.focus();

    editor.trigger("apply_code");

    expect(document.activeElement).toBe(elsewhere);
  });
});

describe("App start/stop", () => {
  it("pauses and resumes a running level", () => {
    const { app, worldController, elements } = setUp();
    app.startChapter1Level(0);
    const startStop = requireElement(".startstop", elements.controls);
    expect(startStop.textContent).toBe("Start");

    startStop.click();
    expect(worldController.isPaused).toBe(false);
    expect(startStop.textContent).toBe("Pause");

    startStop.click();
    expect(worldController.isPaused).toBe(true);
    expect(startStop.textContent).toBe("Start");
  });

  it("restarts the level once it has ended", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(2);
    app.world?.trigger("stats_changed");
    const ended = app.world;

    requireElement(".startstop", elements.controls).click();

    expect(app.world).not.toBe(ended);
    expect(app.currentChapter1Index).toBe(2);
  });

  it("starts a run that has not begun from the program on screen now", () => {
    const { app, view, elements, editorPaneMount } = setUp();
    app.startChapter1Level(0);
    expect(codeErrorMessage(editorPaneMount)).toBe("");
    const built = app.world;

    view.type("{ update: function() {} }");
    requireElement(".startstop", elements.controls).click();

    expect(codeErrorMessage(editorPaneMount)).not.toBe("");
    expect(app.world).not.toBe(built);
    expect(app.worldController.isPaused).toBe(false);
  });

  it("runs the code slot the player has open, not the one the level was built with", () => {
    const { app, elements, editorPaneMount, storage } = setUp();
    storage.setItem("develevateChallengeCode_0_1", "{ update: function() {} }");
    storage.setItem("develevateChallengeCode_0_2", INERT_CODE);
    app.startChapter1Level(0);
    expect(codeErrorMessage(editorPaneMount)).not.toBe("");

    codeSlotButtons(editorPaneMount)[1]?.click();
    requireElement(".startstop", elements.controls).click();

    expect(app.currentCodeSlot).toBe(2);
    expect(codeErrorMessage(editorPaneMount)).toBe("");
  });

  it("resumes a paused run rather than starting it over", () => {
    // Once the run has ticked, the program whose `init` wired the handlers is the one
    // driving it; Pause then Resume may not quietly swap in another.
    const { app, view, elements, worldController } = setUp();
    app.startChapter1Level(0);
    requireElement(".startstop", elements.controls).click();
    const running = app.world;
    running?.update(1);
    requireElement(".startstop", elements.controls).click();
    expect(worldController.isPaused).toBe(true);

    view.type("{ update: function() {} }");
    requireElement(".startstop", elements.controls).click();

    expect(worldController.isPaused).toBe(false);
    expect(app.world).toBe(running);
  });
});

describe("App run controls", () => {
  it("starts the same level over, running, from Start over", () => {
    const { app, elements, worldController } = setUp();
    app.startChapter1Level(1);
    const before = app.world;

    requireElement(".startover", elements.controls).click();

    expect(app.world).not.toBe(before);
    expect(app.currentChapter1Index).toBe(1);
    expect(worldController.isPaused).toBe(false);
  });
});

describe("App time scale", () => {
  it("steps the speed with the run controls' buttons", () => {
    const { app, worldController, elements } = setUp();
    app.startChapter1Level(0);
    worldController.setTimeScale(2);

    requireElement(".speed-up", elements.controls).click();
    expect(worldController.timeScale).toBe(4);
    expect(requireElement(".speed-val", elements.controls).textContent).toBe("4x");

    requireElement(".speed-down", elements.controls).click();
    expect(worldController.timeScale).toBe(2);
  });

  it("turns the press past the top of the ladder into the instant stop, and `-` back out of it", () => {
    // The stop is a state of the control, not a `timeScale` value: `timeScale`
    // multiplies the frame delta, and an Infinity there is a world that can never
    // tick again. So `+` at the top only changes what the next Start press will do.
    const { app, worldController, elements } = setUp();
    app.startChapter1Level(0);
    worldController.setTimeScale(16);
    const value = requireElement(".speed-val", elements.controls);

    requireElement(".speed-up", elements.controls).click();

    expect(value.textContent).toBe("\u221ex");
    expect(worldController.timeScale).toBe(16);
    expect(Number.isFinite(worldController.timeScale)).toBe(true);
    expect(requireElement(".speed-up", elements.controls).hasAttribute("disabled")).toBe(true);
    expect(requireElement(".startstop", elements.controls).textContent).toBe("Start");

    requireElement(".speed-down", elements.controls).click();

    expect(value.textContent).toBe("16x");
    expect(worldController.timeScale).toBe(16);
  });

  it("keeps the instant stop out of storage and out of the url", () => {
    // The instant stop never raises `timescale_changed`, so it isn't stored or put in
    // the url; a reload should reopen at a finite speed, not a game with nothing drawn.
    const { app, worldController, storage, elements } = setUp();
    app.startChapter1Level(0);
    worldController.setTimeScale(16);
    const setItem = vi.spyOn(storage, "setItem");

    requireElement(".speed-up", elements.controls).click();

    expect(setItem).not.toHaveBeenCalled();
    expect(readStoredTimeScale(storage)).toBe(16);
  });

  it("remembers the chosen speed", () => {
    const { app, worldController, storage } = setUp();
    app.startChapter1Level(0);
    worldController.setTimeScale(8);
    expect(storage.getItem(TIME_SCALE_STORAGE_KEY)).toBe("8");
    expect(readStoredTimeScale(storage)).toBe(8);
  });

  it("subscribes to timescale_changed exactly once, however many levels are started", () => {
    // A subscription made on every start must be replaced, not stacked, or one press would write to storage N times.
    const { app, worldController, storage } = setUp();
    const setItem = vi.spyOn(storage, "setItem");

    app.startChapter1Level(0);
    app.startChapter1Level(1);
    app.startChapter1Level(2);
    setItem.mockClear();

    worldController.setTimeScale(8);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("never lets the decrease button freeze the world", () => {
    const { app, worldController, elements } = setUp();
    app.handleRoute(...routeFor("#timescale=0.5"));
    expect(worldController.timeScale).toBe(0.5);

    for (let i = 0; i < 5; i += 1) {
      requireElement(".speed-down", elements.controls).click();
    }

    expect(worldController.timeScale).toBeGreaterThan(0);
  });
});

/** Resolves a location hash into the arguments `App.handleRoute` takes. */
function routeFor(hash: string): Parameters<App["handleRoute"]> {
  const query = parseQuery(hash);
  return [
    resolveRoute(query, {
      chapter1LevelCount: 3,
      defaultTimeScale: DEFAULT_TIME_SCALE,
    }),
    query,
  ];
}

describe("App.handleRoute", () => {
  it("starts the level the url names", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#level=3"));
    expect(app.currentChapter1Index).toBe(2);
  });

  it("does not blank the page when the level is not a number", () => {
    const { app, elements } = setUp();
    expect(() => {
      app.handleRoute(...routeFor("#level=abc"));
    }).not.toThrow();
    expect(app.currentChapter1Index).toBe(0);
    expect(goalDescription(elements)).toBe("Level one");
  });

  it("does not freeze the world when the timescale is not a number", () => {
    const { app, worldController } = setUp();
    app.handleRoute(...routeFor("#timescale=abc"));
    expect(worldController.timeScale).toBe(DEFAULT_TIME_SCALE);
    expect(Number.isFinite(worldController.timeScale)).toBe(true);
  });

  it("enters and leaves fullscreen with the url", () => {
    const { app } = setUp();
    app.handleRoute(...routeFor("#fullscreen=true"));
    expect(document.documentElement.classList.contains("fullscreen-demo")).toBe(true);

    app.handleRoute(...routeFor("#level=1"));
    expect(document.documentElement.classList.contains("fullscreen-demo")).toBe(false);
  });
});

describe("App code status", () => {
  it("shows an error the simulation raises and clears it on the next success", () => {
    const { app, editor, editorPaneMount } = setUp();
    app.startChapter1Level(0);

    app.worldController.trigger("usercode_error", new Error("boom"));
    expect(codeErrorMessage(editorPaneMount)).toContain("boom");

    editor.getCodeObj();
    expect(codeErrorMessage(editorPaneMount)).toBe("");
  });

  it("restarts the current level, running, when the program is applied", () => {
    const { app, editor } = setUp();
    app.startChapter1Level(2);
    const before = app.world;

    editor.trigger("apply_code");

    expect(app.world).not.toBe(before);
    expect(app.currentChapter1Index).toBe(2);
    expect(app.worldController.isPaused).toBe(false);
  });
});

describe("App.relocalize", () => {
  // So a failing assertion can't leave the rest of the file in Russian.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("rewrites the goal bar's own chrome and the level switcher's captions in the language chosen part-way through a run", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    expect(goalDescription(elements)).toBe("Level one");
    expect(levelBlockCaption(elements)).toBe("Chapter 1");

    setLocale("ru");
    app.relocalize();

    // The description is the fixture's own markup and stays English; the level switcher
    // redraws its tile grid from scratch, so elements from before relocalize are gone.
    expect(goalDescription(elements)).toBe("Level one");
    expect(requireElement(".startstop", elements.controls).textContent).toBe("Запустить");
    expect(levelBlockCaption(elements)).toBe("Глава 1");
  });

  it("writes the statistics the way a reader of the new language writes numbers", () => {
    // Figures go through `Intl` and are written only when the world reports a change,
    // so relocalize alone would leave them in English until the next stats tick.
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    const world = app.world;
    if (world === undefined) {
      throw new Error("The level did not start");
    }
    world.transportedCounter = 1234;
    world.elapsedTime = 2675;
    world.trigger("stats_display_changed");
    expect(statValue(elements, "elapsedTime")).toBe("2,675s");

    setLocale("ru");
    app.relocalize();

    // A non-breaking space precedes the thousands separator and the unit, both of
    // which `Intl` chooses and neither of which English has.
    expect(statValue(elements, "elapsedTime")).toBe("2 675 с");
    expect(statValue(elements, "transportedCounter")).toBe("1 234");
  });

  it("renames the building in place instead of drawing a second one", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);
    const floors = queryAll(".floor", elements.world);
    const callUp = requireElement("button.up", floors[0] ?? elements.world);
    const car = requireElement(".elevator", elements.world);
    const carButton = queryAll(".elevator .buttonpress", elements.world)[1];

    setLocale("ru");
    app.relocalize();

    expect(callUp.ariaLabel).toBe("Вызвать лифт вверх с этажа 0");
    expect(car.ariaLabel).toBe("Лифт 0");
    expect(carButton?.ariaLabel).toBe("Ехать на этаж 1");
    // The same three floors and one car survive: `presentBuildingStage` appends and
    // subscribes, so a second call would double both and leave stale listeners.
    expect(queryAll(".floor", elements.world)).toHaveLength(3);
    expect(queryAll(".elevator", elements.world)).toHaveLength(1);
    expect(requireElement(".elevator", elements.world)).toBe(car);
  });

  it("leaves the run in progress exactly where the player had it", () => {
    // relocalize preserves the run in progress rather than restarting it: the world,
    // its clock, its score and its seed stay exactly as the player left them.
    const { app, worldController } = setUp();
    app.handleRoute(...routeFor("#level=1,seed=issue-53"));
    worldController.setPaused(false);
    const world = app.world;
    if (world === undefined) {
      throw new Error("The level did not start");
    }
    world.elapsedTime = 42;
    world.transportedCounter = 7;

    setLocale("ru");
    app.relocalize();

    expect(app.world).toBe(world);
    expect(world.elapsedTime).toBe(42);
    expect(world.transportedCounter).toBe(7);
    expect(world.levelEnded).toBe(false);
    expect(app.currentChapter1Index).toBe(0);
    expect(worldController.isPaused).toBe(false);
    expect(app.currentSeedLink?.seed).toBe("issue-53");
  });

  it("says the verdict again, in the new language, on one card", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(1);
    app.world?.trigger("stats_changed");
    expect(verdictTitle(elements)).toBe("Success!");

    setLocale("ru");
    app.relocalize();

    expect(queryAll(".verdict", elements.feedback)).toHaveLength(1);
    expect(verdictTitle(elements)).toBe("Получилось!");
    expect(requireElement(".verdict p", elements.feedback).textContent).toBe("Уровень пройден");
    // Redrawn from the remembered outcome, so the way on is offered again too, to the same level.
    expect(requireElement(".verdict a", elements.feedback).getAttribute("href")).toBe("#level=3");
  });

  it("does not announce an outcome to a run that has not reached one", () => {
    const { app, elements } = setUp();
    app.startChapter1Level(0);

    setLocale("ru");
    app.relocalize();

    expect(elements.feedback.innerHTML).toBe("");
  });

  it("keeps the banner about a broken program, and the program's own words in it", () => {
    const { app, editorPaneMount } = setUp();
    app.startChapter1Level(0);
    app.worldController.trigger("usercode_error", new Error("boom"));

    setLocale("ru");
    app.relocalize();

    expect(requireElement(".errorline", editorPaneMount).textContent).toContain(
      "Ошибка в вашей программе",
    );
    expect(codeErrorMessage(editorPaneMount)).toContain("boom");
  });

  it("says the program the game handed the player again, in the new language", () => {
    const [lesson] = tutorialLevels;
    if (lesson === undefined) {
      throw new Error("The learning track has no levels");
    }
    const { app, view } = setUp();
    app.startTutorial(0);
    const english = lesson.startingCode;
    expect(view.getValue()).toBe(english);

    setLocale("ru");
    app.relocalize();

    expect(view.getValue()).toBe(lesson.startingCode);
    expect(view.getValue()).not.toBe(english);
  });

  it("leaves the program the player wrote exactly where it was", () => {
    const { app, view } = setUp();
    app.startChapter1Level(0);
    view.type("// my own dispatcher");

    setLocale("ru");
    app.relocalize();

    expect(view.getValue()).toBe("// my own dispatcher");
  });

  it("has nothing to redraw before a level has been started", () => {
    const { app, elements } = setUp();

    setLocale("ru");
    expect(() => {
      app.relocalize();
    }).not.toThrow();

    expect(elements.goalBar.innerHTML).toBe("");
    expect(elements.world.innerHTML).toBe("");
    expect(elements.feedback.innerHTML).toBe("");
  });
});

describe("TIME_SCALE_STORAGE_KEY", () => {
  it("is exactly the key the legacy game wrote", () => {
    // An on-disk compatibility contract with every player's browser: renaming the
    // constant compiles and keeps every test passing while quietly losing their
    // chosen speed. The literal is pinned here on purpose.
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

describe("readStoredSeed", () => {
  it("reads back what the app stored", () => {
    const storage = new MemoryStorage();
    storage.setItem(SEED_STORAGE_KEY, "issue-61");
    expect(readStoredSeed(storage)).toBe("issue-61");
  });

  it("ignores a missing value", () => {
    expect(readStoredSeed(new MemoryStorage())).toBeUndefined();
  });

  it.each(["rush hour", "", "a".repeat(65), "%20"])(
    "refuses %o, because no link could ever express it",
    (stored) => {
      const storage = new MemoryStorage();
      storage.setItem(SEED_STORAGE_KEY, stored);
      expect(readStoredSeed(storage)).toBeUndefined();
    },
  );

  it("treats a browser that refuses to be read as one with nothing stored", () => {
    const storage = new MemoryStorage();
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("The profile is locked down");
    });
    expect(readStoredSeed(storage)).toBeUndefined();
  });
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
  /** Assembles controls options over a mutable controller. */
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
        levelEnded: (): boolean => false,
        runStarted: (): boolean => false,
        instantSpeed: (): boolean => false,
        instantAvailable: (): boolean => true,
        instantRunInProgress: (): boolean => false,
        onStartStop: vi.fn(),
        onStartOver: vi.fn(),
        onTimeScaleIncrease: vi.fn(),
        onTimeScaleDecrease: vi.fn(),
        ...overrides,
      },
    };
  }

  it("draws the speed and labels both run buttons", () => {
    const { parent, options } = setUpControls();
    presentControls(parent, options);

    expect(requireElement(".speed-val", parent).textContent).toBe("2x");
    expect(requireElement(".startstop", parent).textContent).toBe("Start");
    expect(requireElement(".startover", parent).textContent).toBe("Start over");
  });

  it("labels the primary button as crunching, and disables it, while a crunch is in progress", () => {
    const { parent, options } = setUpControls();
    const presenter = presentControls(parent, options);
    const startStop = requireElement(".startstop", parent);
    expect(startStop.hasAttribute("disabled")).toBe(false);

    options.instantRunInProgress = (): boolean => true;
    presenter.update();

    expect(startStop.textContent).toBe("Crunching...");
    expect(startStop.hasAttribute("disabled")).toBe(true);

    options.instantRunInProgress = (): boolean => false;
    presenter.update();

    expect(startStop.textContent).toBe("Start");
    expect(startStop.hasAttribute("disabled")).toBe(false);
  });

  it("shows Pause while running and Start once the level is over", () => {
    const { parent, options } = setUpControls();
    const presenter = presentControls(parent, options);
    const startStop = requireElement(".startstop", parent);

    options.worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Pause");

    options.levelEnded = (): boolean => true;
    presenter.update();
    expect(startStop.textContent).toBe("Start");
    expect(startStop.title).toBe("Run it again from the beginning");
    expect(startStop.querySelector("svg")).not.toBeNull();
  });

  it("passes the instant stop through to both halves at once", () => {
    // One flag, read by two features: the speed shows the stop, and the primary button stops offering to resume.
    const { parent, options } = setUpControls({
      runStarted: (): boolean => true,
      instantSpeed: (): boolean => true,
    });
    presentControls(parent, options);

    expect(requireElement(".speed-val", parent).textContent).toBe("\u221ex");
    expect(requireElement(".startstop", parent).textContent).toBe("Start");
  });

  it("reports button presses to the app", () => {
    const { parent, options } = setUpControls();
    presentControls(parent, options);

    requireElement(".startstop", parent).click();
    requireElement(".startover", parent).click();
    requireElement(".speed-up", parent).click();
    requireElement(".speed-down", parent).click();

    expect(options.onStartStop).toHaveBeenCalledTimes(1);
    expect(options.onStartOver).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleIncrease).toHaveBeenCalledTimes(1);
    expect(options.onTimeScaleDecrease).toHaveBeenCalledTimes(1);
  });

  it("binds its listeners once, however often it is updated", () => {
    const { parent, options } = setUpControls();
    const presenter = presentControls(parent, options);

    for (let i = 1; i <= 5; i += 1) {
      options.worldController.timeScale = i;
      presenter.update();
    }
    requireElement(".startstop", parent).click();

    expect(requireElement(".speed-val", parent).textContent).toBe("5x");
    expect(options.onStartStop).toHaveBeenCalledTimes(1);
  });

  it("keeps the element a keyboard player is standing on across an update", () => {
    const { parent, options } = setUpControls();
    document.body.append(parent);
    const presenter = presentControls(parent, options);
    const startOver = requireElement(".startover", parent);
    startOver.focus();

    presenter.update();

    expect(document.activeElement).toBe(startOver);
  });

  it("lands focus on the start button when the app asks it to", () => {
    const { parent, options } = setUpControls();
    document.body.append(parent);
    const presenter = presentControls(parent, options);

    presenter.focusStartStop();

    expect(document.activeElement).toBe(requireElement(".startstop", parent));
  });
});

describe("containsFocus", () => {
  /** Attaches a container holding one button to the document. */
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
    // .world is focusable so the verdict card has somewhere to put the keyboard;
    // emptying its contents does not disturb the focus on it.
    const { container } = mountContainer();
    container.setAttribute("tabindex", "-1");
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

  /** Draws a world into a fresh `.innerworld`; never draw twice into one container, since the presenter appends and subscribes each call. */
  function draw(world: World): HTMLElement {
    const parent = createElement("div", { className: "innerworld" });
    document.body.append(parent);
    presentBuildingStage(parent, world);
    return parent;
  }

  /** Every `aria-label` in a drawn building, in document order, so two buildings' names compare position by position. */
  function names(parent: HTMLElement): string[] {
    return queryAll("[aria-label]", parent).map((element) => element.ariaLabel ?? "");
  }

  it("renames a drawn building into exactly the names a freshly drawn one is born with", () => {
    // Held together by two label-writing paths: `entities/floor`/`entities/elevator`
    // label a building as it's first drawn, and `relabelWorld` labels one already
    // on screen. If either changes a label, these two lists diverge.
    const drawnInEnglish = draw(createWorld({ floorCount: 3, elevatorCount: 2 }));
    const english = names(drawnInEnglish);

    setLocale("ru");
    const drawnInRussian = draw(createWorld({ floorCount: 3, elevatorCount: 2 }));
    relabelWorld(drawnInEnglish);

    expect(names(drawnInEnglish)).toEqual(names(drawnInRussian));
    expect(names(drawnInRussian)).toHaveLength(12);
    expect(names(drawnInEnglish)).not.toEqual(english);
    expect(english[0]).toBe("Call an elevator going up from floor 0");
    expect(names(drawnInEnglish)[0]).toBe("Вызвать лифт вверх с этажа 0");
  });

  it("leaves the run in progress standing: the same elements, still wired, still lit", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);
    const called = requireElement("button.up", queryAll(".floor", parent)[1] ?? parent);
    const carButton = queryAll(".elevator .buttonpress", parent)[2];
    called.click();
    carButton?.click();
    const elementsBefore = queryAll("*", parent);

    setLocale("ru");
    relabelWorld(parent);

    // Identity, element by element: `toEqual` on nodes compares markup, which is
    // exactly what a redraw would reproduce.
    const elementsAfter = queryAll("*", parent);
    expect(elementsAfter).toHaveLength(elementsBefore.length);
    for (const [index, element] of elementsAfter.entries()) {
      expect(element).toBe(elementsBefore[index]);
    }
    expect(requireElement("button.up", queryAll(".floor", parent)[1] ?? parent)).toBe(called);
    expect(called.classList.contains("is-lit")).toBe(true);
    expect(called.getAttribute("aria-pressed")).toBe("true");
    expect(carButton?.classList.contains("is-lit")).toBe(true);
    expect(carButton?.getAttribute("aria-pressed")).toBe("true");
    expect(world.floors[1]?.buttonStates.up).toBe("activated");
    expect(world.elevators[0]?.buttonStates[2]).toBe(true);
  });

  it("keeps the buttons answering the world they were drawn from", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const parent = draw(world);

    setLocale("ru");
    relabelWorld(parent);
    const up = requireElement("button.up", queryAll(".floor", parent)[1] ?? parent);
    up.click();

    expect(world.floors[1]?.buttonStates.up).toBe("activated");
    expect(up.classList.contains("is-lit")).toBe(true);
  });

  it("has nothing to say to a container with no building in it", () => {
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
    const parent = createElement("div", { className: "controls" });
    const worldController = { isPaused: true, timeScale: 16 };
    let levelEnded = false;
    let runStarted = false;
    const presenter = presentControls(parent, {
      worldController,
      levelEnded: () => levelEnded,
      runStarted: () => runStarted,
      instantSpeed: () => false,
      instantAvailable: () => true,
      instantRunInProgress: () => false,
      onStartStop: vi.fn(),
      onStartOver: vi.fn(),
      onTimeScaleIncrease: vi.fn(),
      onTimeScaleDecrease: vi.fn(),
    });
    const startStop = requireElement(".startstop", parent);

    setLocale("ru");
    presenter.update();

    expect(requireElement(".speed-val", parent).textContent).toBe("16×");
    expect(startStop.textContent).toBe("Запустить");
    expect(requireElement(".startover", parent).textContent).toBe("Заново");
    expect(requireElement(".startover", parent).title).toBe("Начать прогон с самого начала");
    expect(requireElement(".speed", parent).getAttribute("aria-label")).toBe("Скорость прогона");
    expect(requireElement(".speed-up", parent).getAttribute("aria-label")).toBe("Быстрее");

    worldController.isPaused = false;
    presenter.update();
    expect(startStop.textContent).toBe("Пауза");

    worldController.isPaused = true;
    runStarted = true;
    presenter.update();
    expect(startStop.textContent).toBe("Продолжить");

    levelEnded = true;
    presenter.update();
    expect(startStop.textContent).toBe("Запустить");
    expect(startStop.title).toBe("Пустить прогон заново");
  });
});

describe("controlsTemplate", () => {
  it("composes the two features in the order they are read in", () => {
    const fragment = renderFragment(controlsTemplate());

    expect([...fragment.children].map((child) => child.className)).toEqual(["runbox", "speed"]);
  });

  it("draws both run buttons in one box, in the order they are read in", () => {
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbox")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "btn btn-primary startstop unselectable",
      "btn startover unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships every word of it empty, for the presenter to write", () => {
    const fragment = renderFragment(controlsTemplate());

    expect(
      [...(fragment.querySelector(".runbox")?.children ?? [])].map((b) => b.textContent),
    ).toEqual(["", ""]);
    expect(fragment.querySelector(".speed-val")?.textContent).toBe("");
    expect(fragment.querySelector(".speed")?.getAttribute("aria-label")).toBeNull();
  });

  it("announces the speed as it changes, without interrupting", () => {
    // Without aria-live, a screen reader would say nothing as the number changes.
    // Polite, not assertive: holding a speed button changes it several times a
    // second, and assertive would interrupt whatever is already being read.
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector(".speed-val")?.getAttribute("aria-live")).toBe("polite");
  });
});
