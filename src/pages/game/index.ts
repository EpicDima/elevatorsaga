/** The app: levels, the world controller, and the wiring between the editor, the presenters, and the URL. */

import { createSandboxLevel } from "../../game/levels.ts";
import type { Level, SandboxOptions } from "../../game/levels.ts";
import { INSTANT_RUN_MAX_SIMULATED_SECONDS, driveInstantly } from "../../game/instant-run.ts";
import type { InstantRunHandle } from "../../game/instant-run.ts";
import { skyscraperLevels } from "../../game/skyscraper.ts";
import type { SkyscraperLevel } from "../../game/skyscraper.ts";
import { tutorialLevels } from "../../game/tutorial.ts";
import type { TutorialLevel } from "../../game/tutorial.ts";
import { createWorld } from "../../game/world.ts";
import type { World } from "../../game/world.ts";
import type { AnimationFrameRequester, WorldController } from "../../game/world-controller.ts";
import { t } from "../../i18n/index.ts";
import type { CodeEditor } from "../../ui/editor.ts";
import {
  elevatorFloorButtonLabel,
  elevatorLabel,
  floorCallDownLabel,
  floorCallUpLabel,
} from "../../ui/templates.ts";
import type { SeedLinkData } from "../../ui/templates.ts";
import { LEVEL_KEY, SANDBOX_LEVEL } from "./model/route.ts";
import type { RouteParams } from "./model/route.ts";
import {
  evaluateLevelTier,
  nextTierHint,
  readBestLevelTiers,
  recordLevelTier,
} from "#entities/level-tier/index.ts";
import { readBestSkyscraperTiers, recordSkyscraperTier } from "#entities/skyscraper-level/index.ts";
import {
  readClearedTutorialLevels,
  recordClearedTutorialLevel,
} from "#entities/tutorial-level/model/progress.ts";
import { presentSpeedStepper, speedStepperTemplate } from "#features/adjust-speed/index.ts";
import {
  clampTimeScale,
  decreasedTimeScale,
  increasedTimeScale,
  isFastestTimeScale,
} from "#features/adjust-speed/model/time-scale.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import type { CodeSlot } from "#features/manage-code-slots/model/code-slots.ts";
import { presentRunControls, runButtonsTemplate } from "#features/run-simulation/index.ts";
import { clearChildren, query, queryAll } from "#shared/lib/dom.ts";
import { createParamsUrl } from "#shared/lib/route-query.ts";
import type { RouteQuery } from "#shared/lib/route-query.ts";
import { isUsableSeed } from "#shared/lib/seed.ts";
import { presentBuildingStage } from "#widgets/building-stage/index.ts";
import type { EditorPanePresenter } from "#widgets/editor-pane/index.ts";
import { presentGoalBar } from "#widgets/goal-bar/index.ts";
import type { GoalBarPresenter } from "#widgets/goal-bar/index.ts";
import { levelSwitcherTemplate, presentLevelSwitcher } from "#widgets/level-switcher/index.ts";
import type {
  LevelLinkTarget,
  LevelMenuInput,
  LevelSelection,
  LevelSwitcherPresenter,
} from "#widgets/level-switcher/index.ts";
import { presentLevelBriefing } from "#widgets/level-briefing/index.ts";
import { presentStatsPanel } from "#widgets/stats-panel/index.ts";
import type { StatsPanelPresenter } from "#widgets/stats-panel/index.ts";
import { presentTutorial } from "#widgets/tutorial-panel/index.ts";
import { presentVerdictToast } from "#widgets/verdict-toast/index.ts";

declare global {
  interface Window {
    /** The world being played, exposed to the console and the player's program; writable since nothing here is scored. */
    world: World | undefined;
  }
}

/** Where the chosen simulation speed is remembered between visits. */
export const TIME_SCALE_STORAGE_KEY = "elevatorTimeScale";

/** Where the player's last-used seed outside the learning track is remembered between runs and visits. */
export const SEED_STORAGE_KEY = "elevatorSeed";

/** Stands in for a program that failed to compile, so the world does nothing instead of throwing and masking the real error. */
const NO_OP_CODE = {
  init: (): void => undefined,
  update: (): void => undefined,
};

/** The link of the end-of-run card, whose words the last level of the track rewrites. */
const FEEDBACK_LINK_SELECTOR = ".verdict a";

/** Resolves a hash URL to an absolute one, for logging to the console. */
function absoluteUrl(hash: string): string {
  return new URL(hash, window.location.href).href;
}

/** Class on `<html>` that hides everything except the world. */
export const FULLSCREEN_CLASS = "fullscreen-demo";

/**
 * Selectors {@link relabelWorld} uses to rename building parts after a language
 * change; must match the classes `entities/floor` and `entities/elevator` draw with.
 */
const FLOOR_SELECTOR = ".floor";
const CALL_UP_SELECTOR = "button.up";
const CALL_DOWN_SELECTOR = "button.down";
const ELEVATOR_SELECTOR = ".elevator";
const FLOOR_BUTTON_SELECTOR = ".buttonpress";

/** Empties several containers. */
export function clearAll(elements: readonly Element[]): void {
  for (const element of elements) {
    clearChildren(element);
  }
}

/**
 * Whether the focused element sits inside one of these containers. Call before
 * emptying them — once a node is gone, `activeElement` has already reverted to
 * `<body>`.
 */
export function containsFocus(elements: readonly Element[]): boolean {
  const active = document.activeElement;
  return (
    active !== null && elements.some((element) => element !== active && element.contains(active))
  );
}

/** The run controls' markup: the start/pause/resume and start-over buttons, plus the speed stepper. */
export function controlsTemplate(): string {
  return runButtonsTemplate() + speedStepperTemplate();
}

/** What the run controls need in order to draw and drive themselves. */
export interface ControlsPresenterOptions {
  /** The controller being driven, consulted for `isPaused` and `timeScale`. */
  readonly worldController: Pick<WorldController, "isPaused" | "timeScale">;
  /** Whether the run on screen is over; a function, not a value, since this row outlives the world it reports on. */
  readonly levelEnded: () => boolean;
  /** Whether the run on screen has already ticked, so the button offers to resume rather than to start. */
  readonly runStarted: () => boolean;
  /** Whether the speed control is on its instant stop rather than a time scale. */
  readonly instantSpeed: () => boolean;
  /** Whether the instant stop is offered on the run on screen at all. */
  readonly instantAvailable: () => boolean;
  /** Called when the start/pause/resume button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
  /** Whether a headless "run instantly" crunch is under way. */
  readonly instantRunInProgress: () => boolean;
}

/** The rendered run controls. */
export interface ControlsPresenter {
  /** Relabels the start button and the speed; call after anything that could have moved that state. */
  update(): void;

  /** Puts focus on the start button, to recover it after a redraw empties the region it was in. */
  focusStartStop(): void;
}

/** Draws the run controls and wires them up; called once, from {@link App}'s constructor. */
export function presentControls(
  parent: HTMLElement,
  options: ControlsPresenterOptions,
): ControlsPresenter {
  parent.innerHTML = controlsTemplate();

  // Forward through closures, not the callbacks themselves: `options` is a live object the app keeps mutating.
  const runControls = presentRunControls(parent, {
    worldController: options.worldController,
    levelEnded: () => options.levelEnded(),
    runStarted: () => options.runStarted(),
    instantSpeed: () => options.instantSpeed(),
    instantRunInProgress: () => options.instantRunInProgress(),
    onStartStop: () => {
      options.onStartStop();
    },
    onStartOver: () => {
      options.onStartOver();
    },
  });

  const speedStepper = presentSpeedStepper(parent, {
    worldController: options.worldController,
    instantSpeed: () => options.instantSpeed(),
    instantAvailable: () => options.instantAvailable(),
    instantRunInProgress: () => options.instantRunInProgress(),
    onTimeScaleIncrease: () => {
      options.onTimeScaleIncrease();
    },
    onTimeScaleDecrease: () => {
      options.onTimeScaleDecrease();
    },
  });

  const presenter: ControlsPresenter = {
    update(): void {
      runControls.update();
      speedStepper.update();
    },

    focusStartStop(): void {
      runControls.focusStartStop();
    },
  };
  // Before anything can take focus, so a screen reader announces "Start" rather than an unnamed button.
  presenter.update();
  return presenter;
}

/**
 * Renames a building already drawn, in the language active now, without
 * tearing down the run. Matches by position (floor, car, button order), so it
 * must stay in sync with however `entities/floor` and `entities/elevator` draw it.
 */
export function relabelWorld(parent: HTMLElement): void {
  for (const [level, floor] of queryAll(FLOOR_SELECTOR, parent).entries()) {
    // Optional: `entities/floor` draws no "up" lamp on the roof or "down" in the lobby.
    query(CALL_UP_SELECTOR, floor)?.setAttribute("aria-label", floorCallUpLabel(level));
    query(CALL_DOWN_SELECTOR, floor)?.setAttribute("aria-label", floorCallDownLabel(level));
  }
  for (const [index, elevator] of queryAll(ELEVATOR_SELECTOR, parent).entries()) {
    elevator.setAttribute("aria-label", elevatorLabel(index));
    for (const [floorNum, button] of queryAll(FLOOR_BUTTON_SELECTOR, elevator).entries()) {
      button.setAttribute("aria-label", elevatorFloorButtonLabel(floorNum));
    }
  }
}

/** Hides everything except the world, for the `#fullscreen` demo mode. */
export function setDemoFullscreen(enabled: boolean): void {
  document.documentElement.classList.toggle(FULLSCREEN_CLASS, enabled);
}

/** The page regions the app draws into. */
export interface AppElements {
  /** The run controls' mount; unlike the regions below, never emptied and redrawn between runs — only relabeled. */
  readonly controls: HTMLElement;
  /** Where the learning track's panel goes; empty (and hidden by the stylesheet) on every other route. */
  readonly tutorial: HTMLElement;
  /** Where `widgets/level-switcher`'s trigger and popover go; drawn once, like {@link controls}, and only relabeled after. */
  readonly levelSwitcher: HTMLElement;
  /** Where `widgets/goal-bar` goes: the current level's meters and tier popover. */
  readonly goalBar: HTMLElement;
  /** Where `widgets/building-stage` draws the building. */
  readonly world: HTMLElement;
  /** Where `widgets/stats-panel` draws the run's figures. */
  readonly stats: HTMLElement;
  /** Where `widgets/verdict-toast` draws the end-of-level overlay. */
  readonly feedback: HTMLElement;
}

/** Everything the app needs to run. */
export interface AppOptions {
  /** The page regions to draw into. */
  readonly elements: AppElements;
  /** The player's editor. */
  readonly editor: CodeEditor;
  /** The already-built `widgets/editor-pane` presenter; built before this class since {@link editor}'s view needs its mount to exist. */
  readonly editorPane: EditorPanePresenter;
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The levels, in order. */
  readonly levels: readonly Level[];
  /** Where the time scale and track progress are remembered; defaults to `localStorage`, not the player's program. */
  readonly storage?: Storage;
  /** Schedules simulation frames; defaults to `requestAnimationFrame`. */
  readonly requestAnimationFrame?: AnimationFrameRequester;
  /** Called whenever the seed link might have changed, with the value {@link App.currentSeedLink} would return right after. */
  readonly onSeedChange: (seed: SeedLinkData | null) => void;
}

/** A learning-track level and its position in `tutorialLevels` ("Lesson N" for the player). */
export interface TutorialRun {
  /** The level being played. */
  readonly level: TutorialLevel;
  /** Its position in `tutorialLevels`, counted from zero. */
  readonly index: number;
}

/** A Skyscraper-block level and its position in `skyscraperLevels` ("Tower N" for the player). */
export interface SkyscraperRun {
  /** The level being played. */
  readonly level: SkyscraperLevel;
  /** Its position in `skyscraperLevels`, counted from zero. */
  readonly index: number;
}

/** Reads the remembered time scale, or `undefined` if there is none stored. */
export function readStoredTimeScale(storage: Storage): number | undefined {
  let stored: string | null;
  try {
    stored = storage.getItem(TIME_SCALE_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (stored === null) {
    return undefined;
  }
  const timeScale = Number.parseFloat(stored);
  return Number.isFinite(timeScale) ? clampTimeScale(timeScale) : undefined;
}

/** Reads the last-played seed, validated the same way `#seed=` is; an invalid value is treated as nothing stored. */
export function readStoredSeed(storage: Storage): string | undefined {
  let stored: string | null;
  try {
    stored = storage.getItem(SEED_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (stored === null || !isUsableSeed(stored)) {
    return undefined;
  }
  return stored;
}

/** Runs the game. */
export class App {
  /** The levels being played, in order. */
  readonly levels: readonly Level[];
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The world currently being played, once a level has started. */
  world: World | undefined = undefined;
  /** Index of the level currently played; left alone during a sandbox run, since it's the restart target, not what's on screen. */
  currentLevelIndex = 0;

  readonly #elements: AppElements;
  readonly #editor: CodeEditor;
  readonly #storage: Storage;
  readonly #requestAnimationFrame: AnimationFrameRequester;
  /** See {@link AppOptions.onSeedChange}. */
  readonly #onSeedChange: (seed: SeedLinkData | null) => void;
  /** The run controls, drawn once in the constructor and never tied to a run. */
  readonly #controls: ControlsPresenter;
  /** The level switcher, drawn once in the constructor; reports on every level at once, not tied to a run. */
  readonly #levelSwitcher: LevelSwitcherPresenter;
  /** The editor pane, drawn once in the constructor; its codetools act on the editor across every run. */
  readonly #editorPane: EditorPanePresenter;
  /** The goal bar for the run on screen, or `undefined` before the first one; rebuilt by every {@link #startRun}, not by a language change. */
  #goalBar: GoalBarPresenter | undefined = undefined;
  /** The stats panel for the run on screen, or `undefined` before the first one; rebuilt by every {@link #startRun}. */
  #statsPanel: StatsPanelPresenter | undefined = undefined;
  /** The code slot open in the editor for the current level, in-memory only; set by {@link startLevel}. */
  #currentSlot: CodeSlot = DEFAULT_CODE_SLOT;
  /** The parameters of the URL the current level was started from. */
  #query: RouteQuery = new Map<string, string>();
  /** The building the sandbox is running, or `undefined` for a level. */
  #sandbox: SandboxOptions | undefined = undefined;
  /** The learning-track level being played, or `undefined`; mutually exclusive with the other run kinds via {@link #clearSpecialRuns}. */
  #tutorial: TutorialRun | undefined = undefined;
  /** The Skyscraper-block level being played, or `undefined`; behaves like {@link #tutorial} but records a medal on a win. */
  #skyscraper: SkyscraperRun | undefined = undefined;
  /** The seed every run is built from, or `null` to draw one; read from the URL only — see {@link #startRun} for its precedence. */
  #seed: string | null = null;
  /** What is on screen, or `undefined` before the first run — the level itself, not its description, so {@link relocalize} can re-ask it. */
  #run: { readonly level: Level; readonly levelIndex: number | null } | undefined = undefined;
  /** Whether the run on screen was won, or `undefined` while still going; the outcome, not the overlay's words, so it can redraw. */
  #outcome: boolean | undefined = undefined;
  /** Whatever the player's program last threw; wrapped since `throw undefined` is legal and must stay distinguishable from no error. */
  #codeError: { readonly thrown: unknown } | undefined = undefined;
  /** The headless crunch in progress, or `undefined`; its own private controller, canceled at the top of every {@link #startRun}. */
  #instantRunHandle: InstantRunHandle | undefined = undefined;
  /** Whether the speed control is on its `∞x` stop; its own field, not a value of `timeScale`, which an `Infinity` would freeze. */
  #instantSpeed = false;

  constructor(options: AppOptions) {
    this.#elements = options.elements;
    this.#editor = options.editor;
    this.#editorPane = options.editorPane;
    this.worldController = options.worldController;
    this.levels = options.levels;
    this.#storage = options.storage ?? localStorage;
    this.#requestAnimationFrame =
      options.requestAnimationFrame ??
      ((callback): void => {
        requestAnimationFrame(callback);
      });
    this.#onSeedChange = options.onSeedChange;

    // Drawn once; every question it asks closures over `this`, so it works before a world exists.
    this.#controls = presentControls(this.#elements.controls, {
      worldController: this.worldController,
      levelEnded: () => this.world?.levelEnded === true,
      runStarted: () => this.#runHasBegun,
      instantSpeed: () => this.#instantSpeed,
      instantAvailable: () => this.canRunInstantly,
      instantRunInProgress: () => this.#instantRunHandle !== undefined,
      // On `∞x` there's nothing to pause or resume, so both just run a fresh crunch.
      onStartStop: () => {
        if (this.#instantSpeed) {
          this.runInstantly();
        } else {
          this.startStopOrRestart();
        }
      },
      // Restarts immediately (`autoStart`), unlike the first button's own offer after a run ends.
      onStartOver: () => {
        if (this.#instantSpeed) {
          this.runInstantly();
        } else {
          this.#restart(true);
        }
      },
      // The `+`/`-` arrows enter and leave the `∞x` stop; neither touches `timeScale` — see {@link #instantSpeed}.
      onTimeScaleIncrease: () => {
        if (isFastestTimeScale(this.worldController.timeScale)) {
          // Guarded, not just dimmed: a disabled button only stops a click, not a state change.
          if (this.canRunInstantly) {
            this.#setInstantSpeed(true);
          }
        } else {
          this.worldController.setTimeScale(increasedTimeScale(this.worldController.timeScale));
        }
      },
      onTimeScaleDecrease: () => {
        if (this.#instantSpeed) {
          this.#setInstantSpeed(false);
        } else {
          this.worldController.setTimeScale(decreasedTimeScale(this.worldController.timeScale));
        }
      },
    });

    // Drawn once; `getInput` is read fresh on every `update()` since tiers move on every win.
    this.#elements.levelSwitcher.innerHTML = levelSwitcherTemplate();
    this.#levelSwitcher = presentLevelSwitcher(this.#elements.levelSwitcher, {
      getInput: () => this.#levelMenuInput(),
    });

    // Subscribed once for the app's lifetime; pausing raises this event too, relabeling the start button.
    this.worldController.on("timescale_changed", () => {
      this.#storeTimeScale();
      this.#controls.update();
    });
    this.worldController.on("usercode_error", (e) => {
      console.log("World raised code error", e);
      this.#editor.trigger("usercode_error", e);
    });

    this.#editor.on("apply_code", () => {
      this.#restart(true);
    });
    this.#editor.on("code_success", () => {
      this.#codeError = undefined;
      this.#editorPane.clearError();
    });
    this.#editor.on("usercode_error", (error) => {
      this.#codeError = { thrown: error };
      this.#editorPane.showError(error, this.#editor.getCode());
    });
  }

  /** Everything `widgets/level-switcher` needs to draw its popover; tile links deliberately drop `seed` since a link names a building, not a run. */
  #levelMenuInput(): LevelMenuInput {
    return {
      levels: this.levels,
      tutorialLevels,
      skyscraperLevels,
      bestTiers: readBestLevelTiers(this.#storage),
      bestSkyscraperTiers: readBestSkyscraperTiers(this.#storage),
      clearedTutorialLevels: readClearedTutorialLevels(this.#storage),
      selection: this.#levelSelection(),
      buildHref: (target) => this.#levelHref(target),
    };
  }

  /** What is on screen, shaped for `widgets/level-switcher`; falls back to {@link currentLevelIndex} before the first run starts. */
  #levelSelection(): LevelSelection {
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      return { kind: "tutorial", index: tutorial.index };
    }
    const skyscraper = this.#skyscraper;
    if (skyscraper !== undefined) {
      return { kind: "skyscraper", index: skyscraper.index };
    }
    if (this.isPlayingSandbox) {
      return { kind: "sandbox" };
    }
    return { kind: "level", index: this.#run?.levelIndex ?? this.currentLevelIndex };
  }

  /** Turns a tile's {@link LevelLinkTarget} into the URL it links to, carrying the speed and every other unknown key across. */
  #levelHref(target: LevelLinkTarget): string {
    switch (target.kind) {
      case "level": {
        return createParamsUrl(this.#query, { [LEVEL_KEY]: target.number, seed: null });
      }
      case "tutorial":
      case "skyscraper": {
        return createParamsUrl(this.#query, { [LEVEL_KEY]: target.levelId, seed: null });
      }
      case "sandbox": {
        return createParamsUrl(this.#query, { [LEVEL_KEY]: SANDBOX_LEVEL, seed: null });
      }
    }
  }

  /** The seed of a run and its URL, read off the world (not {@link #seed}); `null` for the learning track and Skyscraper block. */
  #seedLink(world: World, levelIndex: number | null): SeedLinkData | null {
    if (this.#tutorial !== undefined || this.#skyscraper !== undefined) {
      return null;
    }
    if (world.seed === null) {
      // Only reachable for a world built with a ready-made random stream; the app never does that.
      return null;
    }
    const seed = String(world.seed);
    return { seed, url: this.#seedHref(seed, levelIndex) };
  }

  /** The address of this building played on `seed`; always names the level explicitly, even when the URL already does. */
  #seedHref(seed: string, levelIndex: number | null): string {
    const at = levelIndex === null ? {} : { [LEVEL_KEY]: levelIndex + 1 };
    return createParamsUrl(this.#query, { ...at, seed });
  }

  /** Plays `seed` on the building already on screen; navigates rather than restarts in place, so the address bar names the run. */
  playSeed(seed: string): void {
    window.location.hash = this.#seedHref(seed, this.#run?.levelIndex ?? null);
  }

  /** The seed line for whatever is on screen; a snapshot, not a subscription — {@link AppOptions.onSeedChange} is the push side. */
  get currentSeedLink(): SeedLinkData | null {
    const world = this.world;
    const run = this.#run;
    if (world === undefined || run === undefined) {
      return null;
    }
    return this.#seedLink(world, run.levelIndex);
  }

  /** Remembers a seed as this player's own, for the next run and the next visit. */
  #storeSeed(seed: string): void {
    try {
      this.#storage.setItem(SEED_STORAGE_KEY, seed);
    } catch {
      // A browser that refuses storage should not stop the game.
    }
  }

  /** Remembers the current time scale for the next visit. */
  #storeTimeScale(): void {
    try {
      this.#storage.setItem(TIME_SCALE_STORAGE_KEY, String(this.worldController.timeScale));
    } catch {
      // A browser that refuses storage should not stop the game.
    }
  }

  /** Whether what is on screen is the sandbox rather than a numbered level. */
  get isPlayingSandbox(): boolean {
    return this.#sandbox !== undefined;
  }

  /** Whether the run on screen is one a crunch could finish; false only for the sandbox, whose condition never resolves. */
  get canRunInstantly(): boolean {
    return !this.isPlayingSandbox;
  }

  /** Starts whatever is on screen again, from the beginning; dispatches on the special-run fields, not `currentLevelIndex` alone. */
  #restart(autoStart = false): void {
    const tutorial = this.#tutorial;
    const skyscraper = this.#skyscraper;
    const sandbox = this.#sandbox;
    if (tutorial !== undefined) {
      this.startTutorial(tutorial.index, autoStart);
    } else if (skyscraper !== undefined) {
      this.startSkyscraperLevel(skyscraper.index, autoStart);
    } else if (sandbox === undefined) {
      this.startLevel(this.currentLevelIndex, autoStart, this.#currentSlot);
    } else {
      this.startSandbox(sandbox, autoStart);
    }
  }

  /** Whether the run on screen has begun: a world that has ticked at all, rather than one still waiting for its first frame. */
  get #runHasBegun(): boolean {
    return (this.world?.elapsedTime ?? 0) > 0;
  }

  /** Starts, pauses or restarts the simulation, depending on where it is. */
  startStopOrRestart(): void {
    if (this.world?.levelEnded === true) {
      this.#restart();
      return;
    }
    // Start restarts, reading the editor fresh, only while paused and still at zero; once ticked, only "Start over" may replace it.
    if (this.worldController.isPaused && !this.#runHasBegun) {
      this.#restart(true);
      return;
    }
    this.worldController.setPaused(!this.worldController.isPaused);
  }

  /** Runs whatever is on screen again, headlessly, always `autoStart` since a crunch has nothing visible to wait for. No-op before the first run. */
  runInstantly(): void {
    const run = this.#run;
    if (run === undefined || !this.canRunInstantly) {
      return;
    }
    this.#startRun(run.level, run.levelIndex, true, true);
  }

  /** Closes a crunch out: marks it finished, draws the building in its final state, and relabels the row. */
  #endInstantRun(world: World): void {
    this.#instantRunHandle = undefined;
    presentBuildingStage(this.#elements.world, world);
    this.#controls.update();
  }

  /** Moves the speed control on and off its instant stop; redraws explicitly since this never goes through `setTimeScale`. */
  #setInstantSpeed(instant: boolean): void {
    this.#instantSpeed = instant;
    this.#controls.update();
  }

  /** Acts on a route: starts the level it names, in precedence order — learning track, Skyscraper, sandbox, then a numbered level. */
  handleRoute(params: RouteParams, query: RouteQuery): void {
    this.#query = query;
    this.#seed = params.seed;
    setDemoFullscreen(params.fullscreen);
    this.worldController.setTimeScale(params.timeScale);
    if (params.tutorialIndex !== null) {
      this.startTutorial(params.tutorialIndex);
    } else if (params.skyscraperIndex !== null) {
      this.startSkyscraperLevel(params.skyscraperIndex);
    } else if (params.sandbox === null) {
      this.startLevel(params.levelIndex);
    } else {
      this.startSandbox(params.sandbox);
    }
  }

  /** Tears the current level down and starts another one. */
  startLevel(levelIndex: number, autoStart = false, slot: CodeSlot = DEFAULT_CODE_SLOT): void {
    const level = this.levels[levelIndex];
    if (level === undefined) {
      throw new RangeError(`No level with index ${String(levelIndex)}`);
    }
    this.#clearSpecialRuns();
    this.#currentSlot = slot;
    this.#editor.openLevelBuffer(levelIndex, slot);
    this.currentLevelIndex = levelIndex;
    this.#startRun(level, levelIndex, autoStart);
  }

  /** Switches the editor to another code slot without disturbing the run in progress; a no-op when that slot is already open. */
  selectCodeSlot(slot: CodeSlot): void {
    // No level index to key a slot by on the track, Skyscraper, or sandbox, so this is a no-op there.
    if (this.#tutorial !== undefined || this.#skyscraper !== undefined || this.isPlayingSandbox) {
      return;
    }
    if (slot === this.#currentSlot) {
      return;
    }
    this.#currentSlot = slot;
    this.#editor.openLevelBuffer(this.currentLevelIndex, slot);
    this.#editorPane.update();
  }

  /** The code slot currently open in the editor. */
  get currentCodeSlot(): CodeSlot {
    return this.#currentSlot;
  }

  /** Tears the current level down and starts a sandbox run; the building comes entirely from the URL, so a bookmark reproduces it. */
  startSandbox(options: SandboxOptions, autoStart = false): void {
    this.#clearSpecialRuns();
    this.#sandbox = options;
    this.#editor.openPlayerBuffer();
    this.#startRun(createSandboxLevel(options), null, autoStart);
  }

  /** Tears the current run down and starts a level of the learning track; opens its buffer before {@link #startRun} compiles it. */
  startTutorial(tutorialIndex: number, autoStart = false): void {
    const level = tutorialLevels[tutorialIndex];
    if (level === undefined) {
      throw new RangeError(`No tutorial level with index ${String(tutorialIndex)}`);
    }
    this.#clearSpecialRuns();
    this.#tutorial = { level, index: tutorialIndex };
    // The player's own attempt if they left one, else the level's starting code.
    this.#editor.openNamedLevelBuffer(level.id, level.startingCode);
    this.#startRun(level, null, autoStart);
  }

  /** Starts a Skyscraper level like {@link startTutorial} does, except `startingCode` is never optional — its levels assume mechanics numbered levels don't. */
  startSkyscraperLevel(skyscraperIndex: number, autoStart = false): void {
    const level = skyscraperLevels[skyscraperIndex];
    if (level === undefined) {
      throw new RangeError(`No skyscraper level with index ${String(skyscraperIndex)}`);
    }
    this.#clearSpecialRuns();
    this.#skyscraper = { level, index: skyscraperIndex };
    this.#editor.openNamedLevelBuffer(level.id, level.startingCode);
    this.#startRun(level, null, autoStart);
  }

  /** Forgets whichever special run was in effect; call before setting a new one, or the switcher will answer for a stale run. */
  #clearSpecialRuns(): void {
    this.#sandbox = undefined;
    this.#tutorial = undefined;
    this.#skyscraper = undefined;
  }

  /** The level of the learning track on screen, or `undefined` otherwise; read-only since {@link startTutorial} is how it changes. */
  get tutorial(): TutorialRun | undefined {
    return this.#tutorial;
  }

  /** The Skyscraper level on screen, or `undefined` otherwise. */
  get skyscraper(): SkyscraperRun | undefined {
    return this.#skyscraper;
  }

  /** Builds a world for a level, draws it, and hands it to the controller; `levelIndex` is `null` for the sandbox. */
  #startRun(level: Level, levelIndex: number | null, autoStart: boolean, instant = false): void {
    // Cancel any earlier crunch so it can't go on ticking a world nothing on screen points at anymore.
    this.#instantRunHandle?.cancel();
    this.#instantRunHandle = undefined;
    // Drop the instant stop when entering a run that can't use it (the sandbox).
    if (this.#instantSpeed && !this.canRunInstantly) {
      this.#instantSpeed = false;
    }
    this.world?.unWind();
    // Seed precedence: a level's own pinned seed, then the URL's `#seed=`, then
    // the seed remembered from last visit, then a fresh draw (`undefined`).
    const world = createWorld(
      level.options,
      this.#tutorial?.level.seed ??
        this.#skyscraper?.level.seed ??
        this.#seed ??
        readStoredSeed(this.#storage) ??
        undefined,
    );
    this.world = world;
    window.world = world;
    const seed = this.#seedLink(world, levelIndex);
    if (seed !== null) {
      // Remembered for next time; `#seedLink` is null for a track/Skyscraper level, whose seed must not overwrite the player's.
      this.#storeSeed(seed.seed);
      // Logged so a run worth repeating can be found after the fact.
      console.log(t("game.seed.console", { seed: seed.seed, url: absoluteUrl(seed.url) }));
    }

    // Checked before these regions are emptied, since a removed node drops focus to `<body>`; restored at the end of this method.
    const focusWasDestroyed = containsFocus([
      this.#elements.world,
      this.#elements.feedback,
      this.#elements.tutorial,
    ]);
    clearAll([this.#elements.world, this.#elements.feedback]);
    this.#run = { level, levelIndex };
    this.#outcome = undefined;
    this.#statsPanel = presentStatsPanel(this.#elements.stats, world);
    this.#goalBar = presentGoalBar(this.#elements.goalBar, world, {
      level,
      getVerdict: () => level.condition.evaluate(world),
    });
    this.#redrawForLevel();
    // Skipped for a crunch — the whole point is that nothing gets drawn mid-run.
    if (!instant) {
      presentBuildingStage(this.#elements.world, world);
    }

    world.on("stats_changed", () => {
      const conditionStatus = level.condition.evaluate(world);
      // A crunch that outruns INSTANT_RUN_MAX_SIMULATED_SECONDS without a verdict counts as a loss; an animated run has no ceiling.
      const levelStatus =
        conditionStatus ??
        (instant && world.elapsedTime >= INSTANT_RUN_MAX_SIMULATED_SECONDS ? false : null);
      if (levelStatus === null) {
        return;
      }
      world.levelEnded = true;
      if (instant) {
        // Not `worldController.setPaused` — a crunch drives its own private
        // controller.
        this.#endInstantRun(world);
      } else {
        this.worldController.setPaused(true);
      }
      // Recorded here, not in `#showOutcome` (which `relocalize` also calls), so a language change can't re-record progress.
      const tutorial = this.#tutorial;
      const skyscraper = this.#skyscraper;
      if (levelStatus && tutorial !== undefined) {
        recordClearedTutorialLevel(this.#storage, tutorial.level.id);
        this.#levelSwitcher.update();
      } else if (levelStatus && skyscraper !== undefined) {
        // A medal, not a cleared flag: a level with no `tiers` still earns bronze, keyed by id since `levelIndex` is null here.
        const tier = evaluateLevelTier(true, world, skyscraper.level.tiers);
        if (tier !== null) {
          recordSkyscraperTier(this.#storage, skyscraper.level.id, tier);
          this.#levelSwitcher.update();
        }
      } else if (levelStatus && levelIndex !== null) {
        const tier = evaluateLevelTier(true, world, level.tiers);
        if (tier !== null) {
          recordLevelTier(this.#storage, levelIndex, tier);
          this.#levelSwitcher.update();
        }
      }
      this.#showOutcome(levelStatus);
    });

    const codeObj = this.#editor.getCodeObj();
    if (instant) {
      // `onController`, not the returned handle: a program whose `init` throws on the first tick can finish inside `driveInstantly`.
      const handle = driveInstantly(world, codeObj ?? NO_OP_CODE, {
        onController: (controller) => {
          controller.on("usercode_error", (e) => {
            console.log("World raised code error", e);
            this.#editor.trigger("usercode_error", e);
            // A crunch's private controller never unpauses, so an error ends it.
            this.#endInstantRun(world);
          });
        },
      });
      // Skip storing a handle for a crunch that already finished or errored inside `driveInstantly`, above.
      if (!world.levelEnded && !handle.controller.isPaused) {
        this.#instantRunHandle = handle;
      }
    } else {
      this.worldController.start(
        world,
        codeObj ?? NO_OP_CODE,
        this.#requestAnimationFrame,
        autoStart,
      );
    }
    // After the controller: `start` sets pause by assignment, raising no event,
    // so the label needs an explicit refresh here.
    this.#controls.update();
    // After the label, so a screen reader announces the right button name.
    if (focusWasDestroyed) {
      this.#controls.focusStartStop();
    }
  }

  /** Redraws everything tied to the run on screen except the goal bar itself: the switcher, the editor pane, and the tutorial panel. */
  #redrawForLevel(): void {
    if (this.#run === undefined) {
      return;
    }
    this.#goalBar?.update();
    this.#levelSwitcher.update();
    this.#editorPane.update();
    this.#drawTutorialPanel();
    this.#onSeedChange(this.currentSeedLink);
  }

  /**
   * Draws whichever card the level on screen has earned — the learning track's
   * lesson panel, or a Skyscraper level's briefing card — into the same shared
   * region, emptying it when the level has neither.
   */
  #drawTutorialPanel(): void {
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      presentTutorial(this.#elements.tutorial, { levelIndex: tutorial.index });
      return;
    }
    // Read fresh here (not looked up by id) so a language change picks up the catalog's current text.
    const card = this.#skyscraper?.level.card;
    if (card !== undefined) {
      presentLevelBriefing(this.#elements.tutorial, card);
      return;
    }
    clearChildren(this.#elements.tutorial);
  }

  /**
   * Draws the end-of-level card and remembers the outcome, so {@link relocalize}
   * can redraw the same verdict in another language.
   */
  #showOutcome(won: boolean): void {
    this.#outcome = won;
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      this.#showTutorialOutcome(tutorial, won);
      return;
    }
    const run = this.#run;
    const world = this.world;
    const levelIndex = run?.levelIndex ?? null;
    // Recomputed rather than cached, so a `relocalize` redraw stays in sync
    // without a field of its own.
    const tier =
      won && levelIndex !== null && run !== undefined && world !== undefined
        ? (evaluateLevelTier(true, world, run.level.tiers) ?? undefined)
        : undefined;
    presentVerdictToast(this.#elements.feedback, {
      won,
      title: won ? t("game.feedback.success.title") : t("game.feedback.failure.title"),
      message: won ? t("game.feedback.success.message") : t("game.feedback.failure.message"),
      // Recomputed for the same reason as `tier` above.
      hint:
        tier !== undefined && run !== undefined && world !== undefined
          ? nextTierHint(run.level.tiers, tier, world)
          : "",
      // No link after a failure or on the last level; seed dropped since it
      // belongs to the run just completed.
      url:
        won && levelIndex !== null && levelIndex + 1 < this.levels.length
          ? createParamsUrl(this.#query, { [LEVEL_KEY]: levelIndex + 2, seed: null })
          : "",
      tier,
    });
  }

  /**
   * Puts everything already drawn into the language active now, without tearing
   * down the run in progress. Figures shown via `Intl` and anything the player
   * typed into the editor are deliberately left alone.
   */
  relocalize(): void {
    // Before the pane: it compares the on-screen program to the old language's starter, so the pane must not see the new one yet.
    this.#editor.relocalize();
    // Unconditional: the controls and pane are on screen before any run starts.
    this.#controls.update();
    this.#editorPane.update();
    const world = this.world;
    if (world !== undefined) {
      this.#redrawForLevel();
      this.#statsPanel?.update();
      world.trigger("stats_display_changed");
      relabelWorld(this.#elements.world);
    }
    if (this.#outcome !== undefined) {
      this.#showOutcome(this.#outcome);
    }
    if (this.#codeError !== undefined) {
      this.#editorPane.showError(this.#codeError.thrown, this.#editor.getCode());
    }
  }

  /**
   * Draws the end-of-run overlay for a track level. A win relabels the link to
   * name the next lesson (never "Next level"); a win on the last level swaps in
   * the finish message. Nothing is recorded here — {@link #startRun} did that.
   */
  #showTutorialOutcome(tutorial: TutorialRun, won: boolean): void {
    const isLastLevel = tutorial.index + 1 >= tutorialLevels.length;
    const nextLevel = tutorialLevels[tutorial.index + 1];
    const finished = won && isLastLevel;
    presentVerdictToast(this.#elements.feedback, {
      won,
      title: finished
        ? t("tutorial.finish.title")
        : won
          ? t("game.feedback.success.title")
          : t("game.feedback.failure.title"),
      message: finished
        ? t("tutorial.finish.message")
        : won
          ? t("game.feedback.success.message")
          : t("game.feedback.failure.message"),
      // A track level has no `tiers` for the hint to name a bar out of.
      hint: "",
      // Seed dropped — the router refuses one on a level address anyway.
      url: finished
        ? createParamsUrl(this.#query, { [LEVEL_KEY]: 1, seed: null })
        : won && nextLevel !== undefined
          ? createParamsUrl(this.#query, { [LEVEL_KEY]: nextLevel.id, seed: null })
          : "",
      // Track levels carry no `tiers` to rank against.
      tier: undefined,
    });
    if (won) {
      this.#relabelFeedbackLink(
        finished ? t("tutorial.finish.toLevels") : t("tutorial.finish.nextLevel"),
      );
    }
  }

  /**
   * Replaces the link's text node, leaving its caret icon alone. A missing
   * link is the ordinary case — there's none after a loss.
   */
  #relabelFeedbackLink(words: string): void {
    const link = this.#elements.feedback.querySelector(FEEDBACK_LINK_SELECTOR);
    const text = link?.firstChild;
    if (text?.nodeType === Node.TEXT_NODE) {
      text.textContent = `${words} `;
    }
  }
}
