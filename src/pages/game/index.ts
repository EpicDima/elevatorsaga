/**
 * The application: levels, the world controller, and the wiring between
 * the editor, the presenters and the URL.
 *
 * Ported from the `$(function() { ... })` block of the legacy `app.js`.
 *
 * The run controls, the building's relabelling and the fullscreen toggle were
 * a separate module, `src/ui/presenters.ts`, itself ported from the legacy
 * `presenters.js` — until {@link App}, this file's own class, became their
 * only caller and this file absorbed them, along with `controlsTemplate`
 * from `src/ui/templates.ts`. `presentControls`, `relabelWorld`, `clearAll`,
 * `containsFocus`, `setDemoFullscreen` and `controlsTemplate` stay exported
 * below only so this module's own test file can reach them directly; nothing
 * outside this file and that test imports them.
 */

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
    /**
     * The world currently being played.
     *
     * A long-standing debugging hook: the wiki's solutions and half the bug
     * reports poke at `world` from the browser console, so it stays.
     *
     * It also hands the simulation to the player's program, which runs in
     * global scope, so `world.transportedCounter = 999999` in `init` wins any
     * level. That has been known since 2015 and is left open on purpose:
     * nothing is scored outside this browser tab, and the half-measures --
     * read-only counters, a write-blocking proxy -- only cost debuggability
     * while leaving `world.users` and `world.elevators` reachable. Closing it
     * for real means running the player's code in a worker or an iframe, which
     * is worth doing on the day a scoreboard exists and not before. The
     * options and their prices are laid out in `docs/fork-survey.md`.
     */
    world: World | undefined;
  }
}

/** Where the chosen simulation speed is remembered between visits. */
export const TIME_SCALE_STORAGE_KEY = "elevatorTimeScale";

/**
 * Where the player's own seed is remembered between runs, levels and visits.
 *
 * Holds whatever seed the last run outside the learning track was built from,
 * drawn ones included — see {@link App.handleRoute} for why a seed nobody chose
 * is still worth keeping, and what that reverses.
 */
export const SEED_STORAGE_KEY = "elevatorSeed";

/**
 * Stands in for a program that did not compile.
 *
 * The legacy code passed `null` to the world controller, which then threw a
 * TypeError on the first frame and reported *that* instead of the compilation
 * error the player actually needs to see. The compilation error is already in
 * the banner by this point, so the world simply does nothing.
 */
const NO_OP_CODE = {
  init: (): void => undefined,
  update: (): void => undefined,
};

/** The link of the end-of-run card, whose words the last level of the track rewrites. */
const FEEDBACK_LINK_SELECTOR = ".verdict a";

/**
 * Turns the hash URL of a run into one that can be pasted somewhere else.
 *
 * The bar's link stays relative, because that is what a link in a page should
 * be and the browser resolves it when the player copies the address. The console
 * cannot copy anything, so what it prints has to be complete on its own.
 *
 * @param hash - A hash URL, as {@link createParamsUrl} builds them.
 * @returns The same URL, resolved against the page.
 */
function absoluteUrl(hash: string): string {
  return new URL(hash, window.location.href).href;
}

/** Class on `<html>` that hides everything except the world. */
export const FULLSCREEN_CLASS = "fullscreen-demo";

/**
 * Selectors for the parts of a drawn building.
 *
 * {@link relabelWorld} finds these to rename them after a language change. The
 * classes are the same ones `entities/floor`'s and `entities/elevator`'s own
 * view modules draw the building with, so a class renamed in one of those
 * templates and not here would leave the building silently unrenameable,
 * which is the quietest possible failure — the labels are invisible to
 * everyone who is not using a screen reader.
 */
const FLOOR_SELECTOR = ".floor";
const CALL_UP_SELECTOR = "button.up";
const CALL_DOWN_SELECTOR = "button.down";
const ELEVATOR_SELECTOR = ".elevator";
const FLOOR_BUTTON_SELECTOR = ".buttonpress";

/**
 * Empties several containers.
 *
 * @param elements - Containers to empty.
 */
export function clearAll(elements: readonly Element[]): void {
  for (const element of elements) {
    clearChildren(element);
  }
}

/**
 * Whether the focused element sits inside one of these containers.
 *
 * Asked immediately *before* a teardown, so the caller can tell that emptying
 * those containers is about to delete the focused element and drop focus back
 * to `<body>`. Once the node is gone the question can no longer be answered:
 * `document.activeElement` is already `<body>` by then.
 *
 * A container that is itself focused does not count — it survives being
 * emptied, and so does the focus on it.
 *
 * @param elements - Containers that are about to be emptied.
 * @returns Whether focus is inside any of them.
 */
export function containsFocus(elements: readonly Element[]): boolean {
  const active = document.activeElement;
  return (
    active !== null && elements.some((element) => element !== active && element.contains(active))
  );
}

/**
 * Everything that drives the run in progress, as one group.
 *
 * Drawn into the app bar — `design/ui-mockup.html`'s own `.runbox` and
 * `.speed`, in that order, between the level switcher and `.barspace`. "Всё
 * управление прогоном — здесь, и больше нигде", as the mockup's comment on
 * that slot puts it, "в шапке, потому что оно нужно в любой раскладке, в том
 * числе когда на экране только код": the bar is the one part of the page that
 * is on screen in all four workspace layouts, and a run control that
 * disappeared with the building would be a control the player cannot reach
 * from the layout they are most likely to be in while writing the program it
 * runs.
 *
 * It had spent one phase in a row of its own between the learning track's
 * panel and the building, and before that it was split three ways — Start in
 * the level bar, Pause under the building, the rest beside the editor.
 * Both of those arrangements had a cost this one does not: the row under the
 * building took a line of height from the building on every layout, and the
 * split one made "which of these restarts?" a question only experiment could
 * answer.
 *
 * What has not changed is that this is drawn once, for the life of the page,
 * and only relabelled. The level bar used to be rebuilt on every restart,
 * so every one of these buttons used to destroy itself when pressed — which is
 * what the level bar's own focus bookkeeping existed to paper over. A
 * keyboard player who presses Start over is still standing on Start over
 * afterwards, with nothing to restore.
 *
 * Two buttons and a speed. Reset/undo-reset moved to the editor pane's own
 * codetools (`widgets/editor-pane`), since they act on the code rather than the
 * run, and "Run instantly" became the last stop of the speed control. The
 * buttons are `#features/run-simulation`'s
 * {@link import("#features/run-simulation/index.ts").runButtonsTemplate} — see
 * that module for their own history and design, including what the primary one
 * says when. The speed is `#features/adjust-speed`'s
 * {@link import("#features/adjust-speed/index.ts").speedStepperTemplate} — see
 * that module for its instant stop and for its `aria-live` region.
 *
 * @returns The run controls markup.
 */
export function controlsTemplate(): string {
  return runButtonsTemplate() + speedStepperTemplate();
}

/** What the run controls need in order to draw and drive themselves. */
export interface ControlsPresenterOptions {
  /** The controller being driven, consulted for `isPaused` and `timeScale`. */
  readonly worldController: Pick<WorldController, "isPaused" | "timeScale">;
  /**
   * Whether the run on screen is over, so the button offers to start again.
   *
   * A function rather than the world itself, because this region outlives every
   * run it drives: it is drawn once for the life of the page, and the world it
   * is reporting on is replaced on every restart.
   */
  readonly levelEnded: () => boolean;
  /**
   * Whether the run on screen has already ticked, so the button offers to
   * resume rather than to start.
   *
   * A function for the same reason {@link levelEnded} is one.
   */
  readonly runStarted: () => boolean;
  /**
   * Whether the speed control is on its instant stop rather than on a time
   * scale — see `#features/adjust-speed/model/time-scale.ts` for why that is a
   * state of the control and not a value of `timeScale`.
   */
  readonly instantSpeed: () => boolean;
  /**
   * Whether the run on screen is one the instant stop is offered on at all.
   *
   * A function for the same reason {@link levelEnded} is one. See
   * {@link App.canRunInstantly} for the single run it is false on and why.
   */
  readonly instantAvailable: () => boolean;
  /** Called when the start/pause/resume button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
  /**
   * Whether a headless crunch is under way.
   *
   * A function for the same reason {@link levelEnded} is one: this row is
   * drawn once and outlives every run, including the private controller a
   * crunch drives itself with.
   */
  readonly instantRunInProgress: () => boolean;
}

/** The rendered run controls. */
export interface ControlsPresenter {
  /**
   * Relabels the start button and the speed.
   *
   * Everything this touches is state the row reports rather than owns, so it is
   * called after anything that could have moved any of it: a pause, a speed
   * change, the end of a run, a language change.
   */
  update(): void;

  /**
   * Puts focus on the start button.
   *
   * For the app, and only for the case it alone can see: a redraw that emptied
   * a region focus was inside — the end-of-level overlay holding the "Next
   * level" link, or the building — leaves focus on `<body>` and a keyboard
   * player back at the top of the page. The start button is where they were
   * going anyway. This row is drawn into the app bar, which survives every
   * redraw, which is what makes it the place to land.
   */
  focusStartStop(): void;
}

/**
 * Draws the run controls and wires them up.
 *
 * Called once, from {@link App}'s constructor, and never again — see
 * {@link controlsTemplate} for why the row is not rebuilt with the level
 * bar. That is what makes {@link ControlsPresenter.update} the whole of the
 * redraw: there is no markup to carry focus or disclosure state across,
 * because the markup never goes away.
 *
 * A language change needs no more than another {@link ControlsPresenter.update}:
 * every word this row shows is written there, from the catalogue, at the moment
 * it is written.
 *
 * The two run buttons are drawn and driven by `#features/run-simulation`'s
 * `presentRunControls`; the speed control by `#features/adjust-speed`'s
 * `presentSpeedStepper`. This function composes the two. The composed pair
 * keeps the app talking to one region and one contract, the way it always has.
 *
 * @param parent - The `.controls` mount in the app bar.
 * @param options - The controller to report on and the callbacks for the four
 * buttons.
 * @returns The presenter, already drawn.
 */
export function presentControls(
  parent: HTMLElement,
  options: ControlsPresenterOptions,
): ControlsPresenter {
  parent.innerHTML = controlsTemplate();

  // Forwarding closures, not the callbacks themselves: `options` is the live
  // object the app keeps updating (a language change, a new `worldController`
  // reference on restart), and copying a callback out of it here would freeze
  // this call's view of it at whatever it was when `presentControls` ran.
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
  // Before anything can take focus, so that a screen reader announces "Start"
  // rather than an unnamed button.
  presenter.update();
  return presenter;
}

/**
 * Renames a building that is already drawn, in the language active now.
 *
 * The building is the one region of the page that cannot be redrawn to change
 * its language: `widgets/building-stage` mounts one `entities/floor` view per
 * floor and one `entities/elevator` view per car, each subscribed to a
 * simulation object, and none of that is undone until the world is torn down
 * — so mounting it a second time would leave two buildings in the page, two
 * `buttonstate_change` handlers on every floor and two of everything else,
 * which is the defect {@link App}'s constructor comment describes from the
 * legacy code. The alternative, starting the run again so it is drawn from
 * scratch, is worse still: it throws away the run the player is in the
 * middle of because they changed a language.
 *
 * Nothing visible is touched, because nothing visible is a word: a floor shows
 * its number, a car shows the floor it is at, and an in-car button shows the
 * floor it requests. What is in a language is the four accessible names — the
 * only part of the building a screen reader has — and each of them is written
 * from the same helper the template used, so the two paths cannot say different
 * things about the same button.
 *
 * The numbers are taken from the positions of the drawn elements rather than
 * from a world, which is what makes this safe to call on whatever happens to be
 * on screen: it selects by class and position, not by which module drew the
 * markup. Floors are found in `world.floors` order, where `createFloors` gives
 * `floors[i]` level `i`; cars in `world.elevators` order; and in-car buttons in
 * floor order within each car — the same order the views were mounted in.
 * This module's own test file holds this against `entities/floor`'s and
 * `entities/elevator`'s own markup rather than leaving it to this comment.
 *
 * @param parent - The `.innerworld` element the building was drawn into.
 */
export function relabelWorld(parent: HTMLElement): void {
  for (const [level, floor] of queryAll(FLOOR_SELECTOR, parent).entries()) {
    // Each lamp is looked for, not demanded: `entities/floor` draws no "up" on
    // the roof and no "down" in the lobby, because neither could ever light.
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

/**
 * Hides everything except the world, for the `#fullscreen` demo mode.
 *
 * The legacy version wrote inline styles onto `html`, `body`, `.container` and
 * `.world` and could not be undone; this toggles a single class instead.
 *
 * @param enabled - Whether the demo should fill the page.
 */
export function setDemoFullscreen(enabled: boolean): void {
  document.documentElement.classList.toggle(FULLSCREEN_CLASS, enabled);
}

/** The page regions the app draws into. */
export interface AppElements {
  /**
   * The run controls' mount in the app bar: start/pause/resume, start over, the
   * speed.
   *
   * The one region the app draws that is never redrawn. Everything else here is
   * emptied and written again at the start of every run; this is written once,
   * in the constructor, and only relabelled afterwards, which is what lets a
   * player keep their finger on a button that restarts the game.
   */
  readonly controls: HTMLElement;
  /**
   * Where the learning track's panel goes.
   *
   * Empty on every route but the track, and the stylesheet hides an empty one,
   * so a level is not left with a gap above the building.
   */
  readonly tutorial: HTMLElement;
  /**
   * Where `widgets/level-switcher`'s trigger and popover go.
   *
   * Drawn once, in the constructor, like {@link controls}: the switcher is not
   * tied to a run, it reports on all of them at once, so it is never emptied
   * between one run and the next — only its own `update()` redraws it.
   */
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
  /**
   * The already-built and already-drawn `widgets/editor-pane` presenter.
   *
   * Built by `src/main.ts`, not here: the pane's mount has to exist before
   * {@link editor}'s own `CodeMirror` view can be built over it, which puts its
   * construction ahead of this class's own — see `editor-pane.ts`'s module
   * comment and `main.ts`'s call site for how the two are sequenced.
   */
  readonly editorPane: EditorPanePresenter;
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The levels, in order. */
  readonly levels: readonly Level[];
  /**
   * Where the chosen time scale and the learning track's progress are
   * remembered; defaults to `localStorage`.
   *
   * The player's program is deliberately not on that list, though it lives in
   * the same store: it is the editor's, and it is the editor that is asked for
   * it, so that what comes back is the program the player would actually see.
   * Everything here is something no other object owns.
   */
  readonly storage?: Storage;
  /** Schedules simulation frames; defaults to `requestAnimationFrame`. */
  readonly requestAnimationFrame?: AnimationFrameRequester;
  /**
   * Called whenever the run on screen's seed line might have changed — a new
   * run starting, or a language redrawing the one already on screen — with
   * the same value {@link App.currentSeedLink} would return right after.
   *
   * The composition root's hook for keeping a caller built once, before the
   * first run, in step with runs that start after it — see
   * `AppBarSettingsController.setSeed` and its own call site in `main.ts`.
   */
  readonly onSeedChange: (seed: SeedLinkData | null) => void;
}

/**
 * The level of the learning track on screen, and where it sits in the track.
 *
 * The level itself rather than its index alone, because everything the panel and
 * the bar ask for — the identifier, the seed, the two programs, the condition —
 * is on it, and a second lookup by index is a second chance to look up the
 * wrong one. The index rides along because the track is the one part of the
 * game that is *numbered for the player*: "Lesson 3" is what the level
 * switcher's trigger calls this, and it is a position in the table rather than
 * anything stored, which is why nothing but the interface is allowed to use it.
 */
export interface TutorialRun {
  /** The level being played. */
  readonly level: TutorialLevel;
  /** Its position in `tutorialLevels`, counted from zero. */
  readonly index: number;
}

/**
 * A level of the Skyscraper block, and where it sits in the block.
 *
 * The same pair as {@link TutorialRun} and for the same reasons: the level
 * itself, because everything downstream wants the level rather than another
 * chance to look up the wrong one, and the position beside it, because the
 * block is numbered for the player — "Tower 3" is a position in
 * `skyscraperLevels`, not anything written down.
 *
 * A separate type rather than a shared one over both blocks, because the levels
 * are separate types with different promises: only a `TutorialLevel` carries a
 * `solutionCode` for the lesson panel to show, and only a `SkyscraperLevel`
 * carries a `card`. Unifying them would mean the widest of both, and every
 * reader of either would have to ask which half of it was real.
 */
export interface SkyscraperRun {
  /** The level being played. */
  readonly level: SkyscraperLevel;
  /** Its position in `skyscraperLevels`, counted from zero. */
  readonly index: number;
}

/**
 * Reads the remembered time scale.
 *
 * @param storage - Where the time scale is remembered.
 * @returns The stored time scale, or `undefined` when there is no usable one.
 */
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

/**
 * Reads the seed this browser last played, if it is still one that can be
 * played.
 *
 * Validated on the way out rather than trusted, for the reason `#seed=` is:
 * this value is as editable as the address bar — a devtools console reaches it,
 * and so does an older or newer build of the game — and a stored string that
 * the router would refuse would otherwise become a seed no link could ever
 * express. What fails the check is treated as nothing stored at all, which
 * draws a fresh seed and overwrites it.
 *
 * @param storage - Where the seed is remembered.
 * @returns The remembered seed, or `undefined` when there is no usable one.
 */
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
  /**
   * Index of the level currently being played.
   *
   * Left where it was while the sandbox is running, since the sandbox is not in
   * the list: it says which numbered level a restart would return to, not
   * what is on screen. {@link isPlayingSandbox} is what distinguishes the two.
   */
  currentLevelIndex = 0;

  readonly #elements: AppElements;
  readonly #editor: CodeEditor;
  readonly #storage: Storage;
  readonly #requestAnimationFrame: AnimationFrameRequester;
  /** See {@link AppOptions.onSeedChange}. */
  readonly #onSeedChange: (seed: SeedLinkData | null) => void;
  /**
   * The run controls, drawn once in the constructor.
   *
   * Not optional and never reassigned, unlike every other presenter here: this
   * one is not tied to a run. See {@link AppElements.controls}.
   */
  readonly #controls: ControlsPresenter;
  /**
   * The level switcher, drawn once in the constructor.
   *
   * Not optional and never reassigned, for the same reason {@link #controls}
   * is not: it reports on every level at once rather than the one currently
   * on screen, so unlike {@link #goalBar} and {@link #statsPanel} there is no
   * per-run state for a fresh level to replace.
   */
  readonly #levelSwitcher: LevelSwitcherPresenter;
  /**
   * The editor pane, drawn once in the constructor.
   *
   * Not optional and never reassigned, for the same reason {@link #controls}
   * is: the slot switcher and the codetools act on the editor across every
   * run, not on the run itself.
   */
  readonly #editorPane: EditorPanePresenter;
  /**
   * The goal bar for the run on screen, or `undefined` before the first one
   * has started.
   *
   * Rebuilt fresh by every {@link #startRun}, unlike {@link #controls} and
   * {@link #levelSwitcher}: its meters are shaped by the level on screen,
   * and it subscribes to that level's own world. A language change calls
   * its `update()` instead of rebuilding it, so the tier popover's open state
   * survives the redraw.
   */
  #goalBar: GoalBarPresenter | undefined = undefined;
  /**
   * The statistics panel for the run on screen, or `undefined` before the
   * first one has started.
   *
   * Rebuilt fresh by every {@link #startRun} for the same reason
   * {@link #goalBar} is: it subscribes to the world on screen, and a new run
   * is a new world.
   */
  #statsPanel: StatsPanelPresenter | undefined = undefined;
  /**
   * The code slot open in the editor, for whichever numbered level is
   * current.
   *
   * In-memory only, like {@link currentLevelIndex}: nothing about which
   * slot a player last used is worth remembering across a reload, and the
   * editor's own storage already remembers each slot's text. Set by
   * {@link startLevel} and left alone by everything else that is not
   * {@link selectCodeSlot}, so that "Start over" and Ctrl-Enter reopen the slot
   * the player was looking at rather than silently returning to the first one.
   */
  #currentSlot: CodeSlot = DEFAULT_CODE_SLOT;
  /** The parameters of the URL the current level was started from. */
  #query: RouteQuery = new Map<string, string>();
  /** The building the sandbox is running, or `undefined` for a level. */
  #sandbox: SandboxOptions | undefined = undefined;
  /**
   * The level of the learning track being played, or `undefined` for anything
   * else.
   *
   * One of the four things that can be on screen, and the field that tells the
   * others what to do about it: it decides which run a restart repeats, which
   * seed a world is built from, what the bar's title says, and which overlay the
   * end of a run gets. Set by {@link startTutorial}, and cleared by every other
   * `start*` through {@link #clearSpecialRuns}, so that exactly one of the four
   * is ever in effect.
   */
  #tutorial: TutorialRun | undefined = undefined;
  /**
   * The level of the Skyscraper block being played, or `undefined` for anything
   * else.
   *
   * The fourth of the mutually exclusive four, and it behaves like
   * {@link #tutorial} in every respect that matters here: it pins the seed, it
   * takes over the card beside the building, it opens a buffer of its own in the
   * editor, and it decides what a restart repeats. Set by
   * {@link startSkyscraperLevel} and cleared by {@link #clearSpecialRuns}.
   *
   * Where it differs from the track is at the end of a run: a lesson records
   * that it was cleared, and a level here records a *medal*, through
   * {@link recordSkyscraperTier}. A level with nothing to say about silver and
   * gold omits `tiers` and so records bronze on a win, which is the block's
   * spelling of "cleared".
   */
  #skyscraper: SkyscraperRun | undefined = undefined;
  /**
   * The seed every run is built from, or `null` to let each draw its own.
   *
   * Read from the URL and from nowhere else, which is the whole of the restart
   * rule: see {@link handleRoute}.
   *
   * A level of the learning track is the exception, and it does not change that
   * sentence: the level's own seed is applied where the world is built, and this
   * field goes on meaning "what the URL asked for" so that leaving the track
   * for a level finds the URL's seed still in it. See {@link #startRun}.
   */
  #seed: string | null = null;
  /**
   * What is on screen, or `undefined` before the first run has started.
   *
   * The level rather than its description, because a description is a
   * sentence in whatever language was active when it was asked for --
   * `LevelCondition.description` is a getter for exactly that reason -- and
   * {@link relocalise} has to be able to ask again. The index rides along
   * because it is what tells the sandbox apart from the levels without
   * looking anything up, and it is `null` for the sandbox, which is not in the
   * list. Distinct from {@link currentLevelIndex}, which says where a
   * restart would go rather than what is being played.
   */
  #run: { readonly level: Level; readonly levelIndex: number | null } | undefined = undefined;
  /**
   * Whether the run on screen was won, or `undefined` while it is still going.
   *
   * The outcome and not the words: the overlay's title and message are
   * translated when they are drawn, so remembering what it said would mean
   * redrawing it in the language it was first shown in. Cleared at the start of
   * every run, alongside the overlay itself.
   */
  #outcome: boolean | undefined = undefined;
  /**
   * Whatever the player's program last threw, while the banner is showing it.
   *
   * Wrapped rather than held bare, because `throw undefined` is something player
   * code can do and the banner has to show it like anything else -- so the
   * wrapper is what distinguishes "no banner" from "a banner about `undefined`".
   * Kept for {@link relocalise}: the sentence around the error is a message, and
   * so is the description of a thrown object with nothing to say for itself.
   */
  #codeError: { readonly thrown: unknown } | undefined = undefined;
  /**
   * The headless crunch in progress, or `undefined` when there is none.
   *
   * Its own field rather than a case of {@link worldController} because it is
   * not that controller: a crunch gets a private one, so an abandoned run's
   * stale callbacks can never tick a world {@link #startRun} has already
   * replaced. Set when {@link runInstantly} starts one, cleared by the
   * `stats_changed` handler in {@link #startRun} when it reaches a verdict on
   * its own, and cleared -- after cancelling it -- at the top of every
   * {@link #startRun}, instant or not, so a player who starts anything else
   * while a crunch is running abandons it rather than raced against it.
   */
  #instantRunHandle: InstantRunHandle | undefined = undefined;
  /**
   * Whether the speed control is on its last stop, `∞x`, rather than on a time
   * scale.
   *
   * A field here rather than a value of {@link worldController}'s `timeScale`,
   * and that is the whole design of the instant stop: `timeScale` multiplies
   * the frame delta, so an `Infinity` in it produces a non-finite `dt` and a
   * world that can never be ticked back to life. See
   * `#features/adjust-speed/model/time-scale.ts`, whose module comment is about
   * exactly that hazard.
   *
   * The consequences are worth having in one place, because they are what a
   * reader coming from `#timescale=` will want:
   *
   * - Turning it on and off never touches `timeScale`, so it never raises
   *   `timescale_changed`, so {@link #storeTimeScale} never writes it and
   *   `#timescale=` never carries it. A reload comes back at the fastest finite
   *   stop the player was on before, which is where `-` from `∞x` lands too.
   * - It is not remembered across a reload on purpose. `∞x` is a way of asking
   *   for one answer now, not a speed to watch the game at, and a player who
   *   reopened the page to *see* their lifts run would find nothing drawn.
   * - It describes how the *next* run is driven, not the one on screen: a
   *   crunch is `src/game/instant-run.ts`'s own private controller starting the
   *   world from zero, and `WorldController.start` runs the player's `init` on
   *   its first unpaused frame, so there is no such thing as finishing a
   *   half-played run instantly.
   */
  #instantSpeed = false;

  /**
   * @param options - The page regions, the editor, the controller and the
   * levels.
   */
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

    // Drawn before anything else the app draws, and drawn exactly once: this is
    // the region that has to be standing there when a run is torn down. Every
    // question it asks is a closure over this object rather than a value, so the
    // row can be built before there is a world to report on and go on being
    // right after that world has been replaced.
    this.#controls = presentControls(this.#elements.controls, {
      worldController: this.worldController,
      levelEnded: () => this.world?.levelEnded === true,
      runStarted: () => this.#runHasBegun,
      instantSpeed: () => this.#instantSpeed,
      instantAvailable: () => this.canRunInstantly,
      instantRunInProgress: () => this.#instantRunHandle !== undefined,
      // Both buttons ask the same question first — is the speed control on its
      // instant stop? — because on that stop there is nothing to pause and
      // nothing to resume: a crunch is a run counted through from zero by
      // `src/game/instant-run.ts`'s own controller, so both "Start" and "Start
      // over" mean the one thing, and the primary button says "Start"
      // throughout to promise no more than that.
      onStartStop: () => {
        if (this.#instantSpeed) {
          this.runInstantly();
        } else {
          this.startStopOrRestart();
        }
      },
      // With `autoStart`, unlike the Restart that the same row's first button
      // turns into when a run ends. The two are asking for different things: a
      // finished run is a result to read, and the player says when to go again,
      // while "Start over" is pressed by somebody who has decided to. It is the
      // button the legacy "Apply" became, and applying the program has always
      // started the run — Ctrl-Enter still reaches this through `apply_code`.
      onStartOver: () => {
        if (this.#instantSpeed) {
          this.runInstantly();
        } else {
          this.#restart(true);
        }
      },
      // The instant stop is entered and left by the same two arrows that walk
      // the ladder, and it sits one press past the top of it. Leaving it puts
      // the run back at whatever finite speed it was already set to — the
      // fastest stop, ordinarily, since that is the only place `+` can arrive
      // from — rather than at a remembered one, so `+` then `-` is a round
      // trip. Neither press touches `timeScale`, which is why neither writes
      // the instant stop to storage or to `#timescale=`; see {@link
      // #instantSpeed}.
      onTimeScaleIncrease: () => {
        if (isFastestTimeScale(this.worldController.timeScale)) {
          // Guarded as well as dimmed: the arrow the stepper disables where
          // {@link canRunInstantly} is false is the only way to press this,
          // but a disabled button is a statement about a click and this is
          // the statement about the state.
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

    // Drawn once, alongside the run controls, for the same reason: it reports
    // on every level at once rather than on the run in progress, so it has
    // nothing to wait for. `getInput` is read fresh on every `update()`, not
    // captured here, since the tiers it draws move on every win.
    this.#elements.levelSwitcher.innerHTML = levelSwitcherTemplate();
    this.#levelSwitcher = presentLevelSwitcher(this.#elements.levelSwitcher, {
      getInput: () => this.#levelMenuInput(),
    });

    // Subscribed once, for the lifetime of the app. The legacy code subscribed
    // inside startLevel, so every level start added another listener
    // that was never removed: after N levels the time scale was written to
    // storage N times and the level bar was rebuilt N times per click.
    //
    // Pausing raises this too — `WorldController.setPaused` triggers it — so one
    // subscription relabels the start button as well as the speed.
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

  /**
   * Everything `widgets/level-switcher` needs to draw its popover: the two
   * lists it offers, what this browser has cleared of each, what is on screen
   * right now, and how to turn a tile into a URL.
   *
   * Read fresh on every call rather than held: three of the five move as the
   * game is played, and the switcher redraws from this on every run that
   * ends. The widget shapes them into blocks and tiles; nothing here decides
   * how a tile is named.
   *
   * The URL rule lives in {@link #levelHref}, and it is the whole point of
   * building an `href` at all: assigning `location.hash` outright — which is
   * how this feature is usually written — would drop `timescale`, `fullscreen`
   * and anything else the URL is carrying, so a player who had chosen 8x speed
   * would silently lose it by opening another level.
   *
   * `seed` is the exception, and is dropped *from the link*: a URL naming a seed
   * names one particular run, and a link to another building names a run nobody
   * has played. What a tile carries across are *preferences* — the speed, the
   * fullscreen they are watching in, the sandbox building they may come back to
   * — and a URL's seed is not one of those.
   *
   * The player's seed is, and it does carry across: {@link #startRun} falls back
   * to {@link readStoredSeed}, which no link touches, so the same seed plays in
   * the building the tile opens. The two are not in tension — this drops a
   * *claim about a run*, and storage keeps a *choice about a stream*. See
   * {@link handleRoute} for the whole of that arrangement, and for the decision
   * it reverses.
   *
   * @returns The switcher's input, as of this call.
   */
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

  /**
   * What is on screen right now, in the shape `widgets/level-switcher` wants
   * it in.
   *
   * Read fresh on every call rather than cached alongside {@link #run}: the
   * switcher is drawn once, before the first run has started, and a
   * `LevelSelection` has no fourth case for "nothing yet" — so this falls
   * back to {@link currentLevelIndex}'s own default, the same level a
   * bare reload would open.
   */
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

  /**
   * Turns a tile's {@link LevelLinkTarget} into the URL it links to, carrying
   * the speed and every other unknown key across exactly as
   * {@link #seedLink} does.
   *
   * @param target - What the tile links to.
   * @returns The URL the switcher should navigate to.
   */
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

  /**
   * The seed of a run, and the URL that starts another run from it.
   *
   * Read off the world rather than from {@link #seed}, so that the run whose
   * seed nobody chose — the overwhelmingly common one — is offered as readily as
   * the pinned one. That is the case the affordance exists for: the seed only
   * becomes interesting once the run has gone wrong.
   *
   * Built with {@link createParamsUrl}, so the level, the speed, the sandbox
   * building and every unknown key survive into the link, exactly as they do in
   * the navigation row. Unlike the row, this is the one link in the interface
   * whose job is the seed itself.
   *
   * There used to be a second URL here, and the panel rendered one or the other:
   * `newDrawUrl`, this hash with `seed=` taken back out, which drew a fresh run
   * for as long as an address without a seed meant a fresh run. It does not mean
   * that any more — {@link handleRoute} falls back to the seed this browser
   * remembers — so "a new draw" stopped being somewhere to go and became
   * something to decide: `features/manage-seed` draws one itself and asks
   * {@link playSeed} to play it.
   *
   * The two blocks that pin their own seeds — the learning track and the
   * Skyscraper block — offer no seed block at all, and those are the runs in the
   * game where that is the honest answer. Everything the block offers is an offer
   * about a seed the player chooses, and on a level of either the seed is not
   * theirs to choose. Typing one, or pinning one, writes `seed=` into an address
   * the router refuses it on — `refuseSeedOnTrack` in
   * `src/pages/game/model/route.ts`, which refuses on both — so following the
   * game's own link would warn on the console and have `startRouter` strip the key
   * back out of the bar in front of the player. A new draw would replace the seed
   * the *level* pins, which is the point of the level: `TutorialLevel.seed`
   * records that a random one would make the lesson a coin flip, and
   * `SkyscraperLevel.seed` that it would make a medal one. A block that undoes
   * itself is worse than no block, so the block goes, and the console print built
   * from the same data goes with it — what it prints is that same refused URL. The
   * seed is not lost: it is the level's, written down in the table.
   *
   * Returning `null` is also what keeps a pinned seed out of the player's own
   * remembered one. {@link #startRun} writes back whatever this returns, so a
   * Skyscraper level answering with its `4` would leave `4` in
   * {@link SEED_STORAGE_KEY} as though the player had chosen it, and the next
   * numbered level they opened would quietly play a crowd the block picked for
   * them.
   *
   * Rendering the seed as plain text was the alternative and was rejected. It
   * would occupy the same space to say a word that means nothing to the player on
   * the track — the seed of level 5 is `tutorial-5` — and the block exists to be
   * *acted* on. If the track ever wants the seed shown, the honest form is the
   * panel saying so in its own words, not this block with its controls taken
   * away.
   *
   * @param world - The run that has just been built.
   * @param levelIndex - Its index in {@link levels}, or `null` for the
   * sandbox, which the URL addresses by its building instead.
   * @returns Its seed and the URL that names this run outright, or `null` when it
   * has no seed to offer.
   */
  #seedLink(world: World, levelIndex: number | null): SeedLinkData | null {
    if (this.#tutorial !== undefined || this.#skyscraper !== undefined) {
      return null;
    }
    if (world.seed === null) {
      // Only reachable when a caller handed the world a ready-made random
      // stream, which the app never does; a test that does gets no seed block
      // rather than a link with nothing to pin.
      return null;
    }
    const seed = String(world.seed);
    return { seed, url: this.#seedHref(seed, levelIndex) };
  }

  /**
   * The address of this building played on `seed`.
   *
   * The level is named, as it is in every other link this class builds, and
   * here it is load-bearing rather than tidy. A first visit has no hash at all,
   * so "everything you are carrying, plus this seed" would leave the run's own
   * identity to a default — and a default that later changes is a link that
   * later means a different building. Where the URL already carries a level,
   * which is every route the game writes itself, this replaces it with the same
   * value and changes nothing.
   *
   * @param seed - The seed the address should play.
   * @param levelIndex - The level to name, or `null` for the sandbox,
   * which the URL addresses by its building instead.
   * @returns The hash URL.
   */
  #seedHref(seed: string, levelIndex: number | null): string {
    const at = levelIndex === null ? {} : { [LEVEL_KEY]: levelIndex + 1 };
    return createParamsUrl(this.#query, { ...at, seed });
  }

  /**
   * Plays `seed` on the building already on screen.
   *
   * The settings panel's own two decisions arrive here as one: a seed typed into
   * its field, and a seed its dice drew. Both are seeds the player chose, and
   * this class has nothing to say about which of the two it was.
   *
   * Done by navigating rather than by restarting in place, so that the seed a
   * player chose is the seed the address bar says they are playing — the same
   * rule the rest of this class keeps, and the one thing that makes a chosen run
   * shareable at the moment it is chosen. The router hears the `hashchange`,
   * resolves the route, and the run restarts through the same path a reload
   * takes. A seed equal to the one already in the hash changes nothing and
   * navigates nowhere, which is the correct answer to being asked for the run
   * that is already playing.
   *
   * The seed is not written to storage here. {@link #startRun} writes whatever
   * seed a run was actually built from, so a seed that arrives by this route is
   * remembered by having been played — and one the router refuses on the way is
   * not remembered at all, which is what should happen to it.
   *
   * @param seed - A seed the address bar can carry; `features/manage-seed`
   * checks that against `#shared/lib/seed.ts` before calling.
   */
  playSeed(seed: string): void {
    window.location.hash = this.#seedHref(seed, this.#run?.levelIndex ?? null);
  }

  /**
   * The seed line for whatever is on screen, for a caller mounted once at
   * startup rather than redrawn on every run the way {@link #drawLevelBar}
   * is.
   *
   * A snapshot, not a subscription: reading this again after a later run
   * returns that run's seed, but nothing here pushes the new value out on its
   * own. {@link AppOptions.onSeedChange} is the push side, called with this
   * same getter's value every time {@link #drawLevelBar} runs — a caller
   * built once, before the first run, wants both: this getter for the run the
   * router already resolved before {@link startRouter} returns, and the
   * callback for every run after it.
   */
  get currentSeedLink(): SeedLinkData | null {
    const world = this.world;
    const run = this.#run;
    if (world === undefined || run === undefined) {
      return null;
    }
    return this.#seedLink(world, run.levelIndex);
  }

  /**
   * Remembers a seed as this player's own, for the next run and the next visit.
   *
   * @param seed - The seed the run that has just started was built from.
   */
  #storeSeed(seed: string): void {
    try {
      this.#storage.setItem(SEED_STORAGE_KEY, seed);
    } catch {
      // A browser that refuses storage should not stop the game -- the seed is
      // still in the run, in the console line and on the panel, and only the
      // next run loses it.
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

  /**
   * Whether the run on screen is one a crunch could reach the end of.
   *
   * Everything but the sandbox is. `requireSandbox` is the last condition in
   * the game that never resolves — `levels.ts` says so where it is
   * defined, and the endless demo that was the other one is gone — so free
   * play is the one run with no answer to skip to. Handed a crunch it could
   * only ever run out the clock at
   * {@link INSTANT_RUN_MAX_SIMULATED_SECONDS} and call that a loss, which is
   * what it did: half an hour of simulated traffic, nothing drawn while it
   * ran, and «Уровень провален» over a building that has no goal to fail.
   *
   * So the instant stop is not offered here at all, which is the honest
   * version of the same answer: the speed control stops at its fastest finite
   * step, and the arrow past it dims the way both arrows already dim at the
   * ends of the ladder.
   */
  get canRunInstantly(): boolean {
    return !this.isPlayingSandbox;
  }

  /**
   * Starts whatever is currently on screen again, from the beginning.
   *
   * Its three callers — the run row's "Start over", the same row's first button
   * once it has become Restart, and the editor's "apply code" behind
   * Ctrl-Enter — all mean "run this again", and until the
   * sandbox existed the only thing that could be on screen was
   * `levels[currentLevelIndex]`. Restarting through the index would now
   * throw a sandbox player back onto a numbered level, and with it the
   * building they had configured. A level of the learning track is the same
   * hazard with a worse ending: `currentLevelIndex` is left wherever the
   * last numbered level put it, so Ctrl-Enter on level 3 would apply the
   * player's edit to level 1 — a different building, and the attempt they
   * were half-way through no longer on screen to compare against.
   *
   * The order of the four is the order of {@link handleRoute} and means the
   * same thing: a lesson, a Skyscraper level, the sandbox, or a numbered level.
   * At most one of the three fields is ever set — {@link #clearSpecialRuns} is
   * what makes that true — so the order decides nothing at runtime; it is
   * written the same way in both places so that a reader who has checked one
   * has checked the other.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
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

  /**
   * Whether the run on screen has begun: a world that has ticked at all, as
   * against one standing at zero waiting for its first frame.
   *
   * One statement of the question for the two places that ask it — the run
   * row, which labels its first button off it, and {@link startStopOrRestart},
   * which decides off it whether Start resumes a run or begins one.
   */
  get #runHasBegun(): boolean {
    return (this.world?.elapsedTime ?? 0) > 0;
  }

  /** Starts, pauses or restarts the simulation, depending on where it is. */
  startStopOrRestart(): void {
    if (this.world?.levelEnded === true) {
      this.#restart();
      return;
    }
    // A run that has not begun starts from the program on screen now, not from
    // the one that was on screen when the level was built. {@link #startRun}
    // compiles the editor's text once, as it hands the world to the
    // controller, and the controller holds that object for the whole run — so
    // everything the player does to their program between the level appearing
    // and this button being pressed is invisible to the building. Switching
    // code slots was the alarming version of it, since the entire visible
    // program changes and the building still runs the one it was set up with,
    // but a plain edit before the first press had exactly the same ending.
    //
    // Starting over is the operation that reads the editor again, so that is
    // what Start does while there is nothing yet to resume. The player loses
    // nothing to the teardown: the run being replaced has not happened, and
    // its seed is already stored, so the world rebuilt here is the same
    // building carrying the same passengers.
    //
    // Only while the run is paused and still at zero. Once it has ticked, the
    // program driving the building is the one whose `init` hung the handlers
    // on it, and putting another one under those handlers mid-run is not a
    // thing Pause and Resume may quietly do — "Start over" and Ctrl-Enter are
    // how a player asks for that, and they say so.
    if (this.worldController.isPaused && !this.#runHasBegun) {
      this.#restart(true);
      return;
    }
    this.worldController.setPaused(!this.worldController.isPaused);
  }

  /**
   * Runs whatever is on screen again, headlessly: nothing drawn while it
   * plays, the outcome and the final statistics shown the moment it has one.
   *
   * Deliberately not a fourth case alongside {@link #restart}'s three, though
   * it does the same job for the same reason: {@link #run} already says which
   * level, level or sandbox is current, however it got there, so re-reading
   * it here is one branch instead of {@link #restart}'s three, and none of
   * `startLevel`/`startSandbox`/`startTutorial`'s own bookkeeping --
   * leaving the tutorial buffer, remembering which sandbox or level index
   * is current -- has anything to add when what is being started is the very
   * thing already on screen. `autoStart` is always `true`: a crunch that
   * waited for the Start button would be a button that does nothing visible
   * until a second one is pressed.
   *
   * Does nothing before the first run has started -- there is nothing in
   * {@link #run} yet to rerun. Only a test still driving the constructor's
   * bare output can reach that path; by the time a player can click the
   * button that calls this, `handleRoute` has already started one.
   */
  runInstantly(): void {
    const run = this.#run;
    // `canRunInstantly` for the same reason `onTimeScaleIncrease` checks it:
    // the control that reaches this is already dimmed on a run with no end to
    // crunch to, and this is the state saying so rather than the click.
    if (run === undefined || !this.canRunInstantly) {
      return;
    }
    this.#startRun(run.level, run.levelIndex, true, true);
  }

  /**
   * Closes a crunch out: marks it finished, draws the building it ran, and
   * relabels the row.
   *
   * One method rather than three lines at each of the two places a crunch can
   * end — a verdict, or the player's program throwing — because until this
   * existed the two agreed on the bookkeeping and neither drew anything, and
   * the empty pane that left was the whole defect.
   *
   * ## Why the building is drawn here and not before
   *
   * A crunch's premise is that nothing is drawn while it runs: {@link
   * #startRun} skips {@link presentBuildingStage} for exactly that reason, and
   * it is what makes half an hour of simulated traffic take a fraction of a
   * second instead of a fraction of an hour. What it is not a reason for is
   * leaving the pane empty afterwards. A run that is over is a still picture,
   * and drawing it costs one layout: `presentBuildingStage` renders the world
   * it is handed in whatever state it is in — cars where they stopped, the
   * queues that were still waiting — so the player gets the building back at
   * the moment it ended, under the verdict, beside the figures.
   *
   * This was invisible until the run's verdict stopped being a full-screen
   * curtain and became a card in the corner (`widgets/verdict-toast`): the
   * curtain covered the empty pane the crunch left, and the card shows it.
   *
   * Clearing the handle is what marks this crunch finished rather than
   * abandoned — `#instantRunHandle` is {@link driveInstantly}'s own stopping
   * signal for nothing except a still-running one — and the explicit
   * `update()` is this path's replacement for the relabelling an animated run
   * gets for free from `setPaused`'s `timescale_changed`.
   *
   * @param world - The world the crunch was driving, now standing still.
   */
  #endInstantRun(world: World): void {
    this.#instantRunHandle = undefined;
    presentBuildingStage(this.#elements.world, world);
    this.#controls.update();
  }

  /**
   * Moves the speed control on and off its instant stop.
   *
   * The redraw has to be asked for here, unlike every other way the speed
   * moves: those all go through `setTimeScale`, which raises
   * `timescale_changed`, and the subscription on it redraws the whole row.
   * This state is nowhere near the controller — see {@link #instantSpeed} for
   * why it must not be — so nothing would raise anything.
   *
   * Both controls are redrawn rather than only the speed, because both read
   * it: the primary button says "Start" rather than "Resume" while this is on.
   *
   * @param instant - Whether the control is now on its instant stop.
   */
  #setInstantSpeed(instant: boolean): void {
    this.#instantSpeed = instant;
    this.#controls.update();
  }

  /**
   * Acts on a route: applies its options and starts the level it names.
   *
   * A `seed` in the hash still outranks everything but a level's own, so `#seed=…`
   * brings the same passengers in the same order from the Restart button, from
   * Ctrl-Enter and from a reload alike. How far that carries into the run itself
   * is the subject of `game.seed.explanation` in the message catalogues: the
   * passengers, and -- since the world advances in fixed `TICK_SECONDS` ticks --
   * the run they arrive into as well, for as long as the program is played the
   * same way.
   *
   * ## The seed a URL does not name
   *
   * This is where a decision recorded here for a long time was reversed rather
   * than worked around, so it is worth stating what it was. Remembering the seed
   * a run was built from and reusing it was rejected twice over: it would strand
   * a player stuck on a level with the same passenger stream however often
   * they restart, with no way back to another draw short of editing the address
   * bar; and it would put state behind the player's back, where this app's rule
   * has always been that the hash is what is being played.
   *
   * Both objections were answered by the same thing, and it is the reason the
   * decision could change: the settings panel grew a seed row that can be *acted*
   * on (`features/manage-seed`). A player is no longer stranded by a sticky seed,
   * because a new draw is one click on the dice beside the field, and a specific
   * seed is one line typed into the field — neither of which existed when a
   * remembered seed would have been a trap. The hidden state is not hidden: the
   * row shows the seed the run is on, which is the same place the player would go
   * to change it.
   *
   * What the reversal buys is the question that prompted it — why a player's seed
   * should be different every time they open the game. It should not. Two
   * programs are worth comparing when they are compared on one building's worth
   * of people, and a fresh draw on every visit means the run a player debugged
   * yesterday is gone. So {@link #startRun} falls back to
   * {@link readStoredSeed}, and writes back whatever seed a run was actually
   * built from — a URL's, a typed one, a drawn one alike. A seed becomes the
   * player's own by being played, and stays theirs across restarts, reloads and
   * levels until they ask for another.
   *
   * The URL's own role narrows to what a URL is for: naming a run to somebody
   * else, or to yourself later. That is why `#levelHref` still drops `seed` from
   * every link between levels — the seed a player carries across is not the
   * business of a link to another building — and the player carries it anyway,
   * through storage, which is the layer that has no address to mislead anyone
   * with.
   *
   * What a route names is decided in one order, and the order is stated because
   * it is the whole of the dispatch: a route is a level of the learning track, a
   * level of the Skyscraper block, the sandbox, or a numbered level. The router
   * never sets more than one of those — `#level=` holds one value — so this is a
   * statement of precedence rather than a decision made every time, and the
   * precedence runs from the most specific address to the least. `levelIndex` is
   * the least, because the router resolves it to level 1 for any spelling it
   * does not understand, which is exactly what an unrecognised route should play
   * and exactly what a named level's route must not: until these branches
   * existed, `#level=tutorial-5` played level 1 while the address bar went on
   * saying `tutorial-5`, and a reload never escaped it. `#level=sky-1` would
   * have done the same.
   *
   * @param params - The validated route parameters.
   * @param query - The raw parameters, kept for the next-level link.
   */
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

  /**
   * Tears the current level down and starts another one.
   *
   * @param levelIndex - Zero-based index of the level to start.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @param slot - Which of the level's three code slots to open; defaults
   * to {@link DEFAULT_CODE_SLOT}.
   */
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

  /**
   * Switches the editor to another of the current level's three code
   * slots, without disturbing the run in progress.
   *
   * Deliberately not a call to {@link startLevel}: a slot is a place to
   * keep a program, not a different level, and a player who switches slots
   * mid-run is not asking for the world to be torn down and rebuilt under
   * them. Only the editor's buffer and the two regions that report the slot in
   * use move; {@link #run}, the world and the controller are left exactly as
   * they were.
   *
   * A no-op when the slot asked for is already open, for the same reason
   * {@link "../../ui/editor.ts"!CodeEditor.openLevelBuffer} is idempotent: the
   * switcher's own button is one of the things that can ask for it, and a
   * second click must not replace the document under a player who is typing.
   *
   * @param slot - The slot to open.
   */
  selectCodeSlot(slot: CodeSlot): void {
    // A learning level, a Skyscraper level and the sandbox have no level index
    // of their own to key a slot by -- see `widgets/editor-pane`'s own slot
    // switcher, which, unlike the presenter this replaced, has no way to hide
    // itself while any of them is on screen. Silently doing nothing is what the
    // old, hidden switcher did for free; this is the same answer for a switcher
    // that is now visible, but inert, on all three.
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

  /**
   * Tears the current level down and starts a sandbox run in its place.
   *
   * The building comes from the URL, so it is bookmarkable and shareable, and
   * nothing about the run is remembered anywhere else: coming back to the same
   * link is coming back to the same building.
   *
   * The only run with no buffer of its own to open, which is why it is the only
   * one that names {@link "../../ui/editor.ts"!CodeEditor.openPlayerBuffer}: a
   * numbered level opens its level-and-slot buffer, and a lesson or a Skyscraper
   * level opens the one keyed by its id, but the sandbox has always shown the
   * legacy single-buffer program and still does. Calling it here is what carries
   * a player out of one of those named buffers; it is idempotent, so arriving
   * from a numbered level — where it is already the buffer on screen — does not
   * disturb the caret or empty the undo history.
   *
   * @param options - The building to play in, already validated by the router.
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  startSandbox(options: SandboxOptions, autoStart = false): void {
    this.#clearSpecialRuns();
    this.#sandbox = options;
    this.#editor.openPlayerBuffer();
    this.#startRun(createSandboxLevel(options), null, autoStart);
  }

  /**
   * Tears the current run down and starts a level of the learning track.
   *
   * A {@link TutorialLevel} is structurally a {@link Level} — `options` and
   * `condition` are named and typed to match, deliberately — so it is handed
   * straight to the same machinery, with `null` where a level index would
   * go. That `null` is the whole of "a level is not a level": it is not
   * numbered in the bar, not marked in the navigation row, and not followed by a
   * link into the numbered ladder. {@link currentLevelIndex} is left where
   * the last numbered level put it, exactly as the sandbox leaves it, since
   * it says where the player would return to and not what is on screen.
   *
   * The editor is switched to the level's own buffer before the run is built,
   * and the order matters: {@link #startRun} compiles whatever is in the editor
   * at the moment it starts, so opening the buffer afterwards would run the
   * previous level's program in this level's building for one run.
   *
   * @param tutorialIndex - Zero-based position of the level in `tutorialLevels`.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @throws RangeError When no level has that position. Symmetric with
   * {@link startLevel}: the router resolves a level address against the same
   * table, so this can only be reached by a caller that made the index up, and
   * a made-up index must not quietly play level 1.
   */
  startTutorial(tutorialIndex: number, autoStart = false): void {
    const level = tutorialLevels[tutorialIndex];
    if (level === undefined) {
      throw new RangeError(`No tutorial level with index ${String(tutorialIndex)}`);
    }
    this.#clearSpecialRuns();
    this.#tutorial = { level, index: tutorialIndex };
    // The level's own attempt if the player has left one, and the starting code
    // only when they have not: somebody who half-solved level 4, wandered off to
    // a level and came back is owed their attempt, not the mistake again.
    //
    // Read here rather than held anywhere, because the program is a message:
    // `TutorialLevel.startingCode` renders the level's own `.code` key when it is
    // asked for, so the editor is handed the language the player has chosen by
    // now, and starting the same level again — which is what "Start over" does —
    // hands over the language they have chosen since.
    this.#editor.openNamedLevelBuffer(level.id, level.startingCode);
    this.#startRun(level, null, autoStart);
  }

  /**
   * Tears the current run down and starts a level of the Skyscraper block.
   *
   * The same shape as {@link startTutorial}, and for the same reasons: a
   * {@link "../../game/skyscraper.ts"!SkyscraperLevel} is structurally a
   * {@link Level}, so it goes to the same machinery with `null` where a level
   * index would be, it opens a buffer keyed by its own id, and it opens it
   * *before* the run is built because {@link #startRun} compiles whatever is in
   * the editor at the moment it starts.
   *
   * It shares the track's buffer mechanism rather than getting one of its own.
   * `openNamedLevelBuffer` keys by level id and the two blocks' ids cannot
   * collide — `tutorial-4` against `sky-1` — so one keyspace serves both, and
   * the alternative would be a second prefix in `src/ui/editor.ts` that differs
   * from the first in nothing but its spelling.
   *
   * Where it parts company with the track is what it does with a `startingCode`
   * that is not optional here. Every level in this block is built on an idea the
   * numbered levels know nothing about, so arriving with the program you last
   * wrote for level 19 is arriving with a program written for a different set of
   * rules; the block's own starter is the floor a player is put on. Their own
   * attempt still wins over it whenever they have left one.
   *
   * @param skyscraperIndex - Zero-based position of the level in
   * `skyscraperLevels`.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @throws RangeError When no level has that position, symmetric with
   * {@link startLevel} and {@link startTutorial}: the router resolves a `sky-`
   * address against this same table, so this can only be reached by a caller
   * that made the index up, and a made-up index must not quietly play something
   * else.
   */
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

  /**
   * Forgets whichever of the three special runs was in effect.
   *
   * The one place the "exactly one of these is ever set" invariant is written
   * down. It used to be spelled out inline in every `start*` method, which was
   * survivable while there were two fields and became a trap at three: adding
   * {@link #skyscraper} meant remembering to clear it in three separate methods,
   * and the one that was forgotten would not fail a type check or throw — it
   * would leave a stale run answering {@link #levelSelection}, {@link #restart}
   * and the seed lookup, so the switcher would highlight a level the player had
   * left and Ctrl-Enter would restart it.
   *
   * Deliberately touches no buffer. Each caller opens the buffer it wants
   * immediately afterwards, and which buffer that is has nothing to do with
   * which fields are being cleared — the method this replaced conflated the two,
   * so leaving the track for the sandbox went through something named for the
   * track.
   */
  #clearSpecialRuns(): void {
    this.#sandbox = undefined;
    this.#tutorial = undefined;
    this.#skyscraper = undefined;
  }

  /**
   * The level of the learning track on screen, or `undefined` for anything else.
   *
   * The panel's whole input: it decides from this whether to draw at all and
   * which level's title, goal, hints and answer to show. Exposed read-only,
   * because the way to change what is played is {@link startTutorial} — a panel
   * that could assign this would leave the field disagreeing with the world.
   */
  get tutorial(): TutorialRun | undefined {
    return this.#tutorial;
  }

  /**
   * The Skyscraper level on screen, or `undefined` for anything else.
   *
   * Read-only for {@link tutorial}'s reason, and exposed at all for the same
   * one: the briefing card is drawn from it, and so is anything that needs to
   * know the two blocks apart.
   */
  get skyscraper(): SkyscraperRun | undefined {
    return this.#skyscraper;
  }

  /**
   * Builds a world for a level, draws it, and hands it to the controller.
   *
   * @param level - What to play: one of {@link levels}, or the sandbox
   * level the URL just described.
   * @param levelIndex - Its index in {@link levels}, or `null` for the
   * sandbox, which is not in the list and so is neither numbered in the bar nor
   * marked in the navigation row nor followed by a "next level" link.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @param instant - Whether to drive this run headlessly, through
   * {@link driveInstantly}, instead of drawing it and driving it from
   * animation frames. See {@link runInstantly}.
   */
  #startRun(level: Level, levelIndex: number | null, autoStart: boolean, instant = false): void {
    // Abandoned rather than raced: a crunch left running past the start of
    // whatever this call is beginning would go on ticking a world nothing on
    // screen points at any more, and could still reach the `stats_changed`
    // handler below with a verdict for a run that no longer exists. Done for
    // every run, not only an instant one, because the crunch this cancels
    // might have been left running by an *earlier* call here while a plain
    // Start over or a route change was what actually happened next.
    this.#instantRunHandle?.cancel();
    this.#instantRunHandle = undefined;
    // Off the instant stop, if the run being started is one that stop means
    // nothing on. The stop is app state rather than a time scale, so it
    // survives every change of run -- which is right for the ladder, where a
    // player who crunched level 4 means to crunch level 5, and wrong for the
    // sandbox, where the control would sit on `∞x` promising an answer that
    // free play does not have. Placed here rather than in `startSandbox`
    // because every way into a run passes through this method, the route and
    // Start over included, and `#sandbox` is already set by the time it does.
    // The field rather than `#setInstantSpeed`, whose whole job is the redraw
    // this method already ends with.
    if (this.#instantSpeed && !this.canRunInstantly) {
      this.#instantSpeed = false;
    }
    this.world?.unWind();
    // A level's own seed wins over the URL's, and it is the one seed in the game
    // the player cannot override. That is what `TutorialLevel.seed` is for: the
    // lesson is "this program loses and that one wins", which is a statement
    // about a particular stream of passengers, and a random draw would make it a
    // coin flip. The router already refuses `seed` on a level address, so the two
    // can disagree only when a level is started from inside the app while the URL
    // still carries the seed of the level just left -- and then it is the
    // leftover that has to lose.
    //
    // `SkyscraperLevel.seed` ranks beside it and pins for a related but distinct
    // reason, which its own docblock sets out: those levels have no decade of
    // published solutions to calibrate a threshold against, so a threshold is set
    // from one measured run, and a silver earned by two players has to have been
    // earned on the same crowd. Only one of the two fields is ever set -- see
    // `#clearSpecialRuns` -- so their order here settles nothing.
    //
    // Then the seed this browser last played, which is the player's own and
    // outlives the URL that introduced it -- see `handleRoute` for what that
    // reverses and why. It ranks below `#seed` so that a link somebody was sent
    // plays the run it names rather than the run they were already on.
    //
    // `undefined`, not `null`: the world generates a seed of its own when it is
    // given none, and records it either way, which is what makes even a run
    // nobody chose repeatable after the fact.
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
      // Written back on every start, drawn seeds included: the fallback above is
      // only worth anything if the seed a player ends up with becomes the seed
      // they keep, and the overwhelmingly common way to end up with one is to
      // have been given it. `#seedLink` is `null` for exactly the runs whose seed
      // is not the player's -- a level of the learning track or of the Skyscraper
      // block, each of which pins its own -- so the seeds that must not be
      // remembered are the ones this cannot see.
      this.#storeSeed(seed.seed);
      // Printed at every start, because nobody knows a run is worth repeating
      // until it has already gone wrong -- by which time the only record of what
      // it was is this line.
      console.log(t("game.seed.console", { seed: seed.seed, url: absoluteUrl(seed.url) }));
    }

    // All three of these regions can hold the focused element when a level
    // starts: the "Next level" link lives in the feedback overlay, the call
    // and in-car buttons live in the building, and the learning track's panel
    // has the button that leaves the track. Emptying them deletes it, and focus
    // falls back to <body> -- so a keyboard or screen-reader player who takes
    // the offered link, or who presses "leave", is dropped at the top of the
    // page instead of arriving at the level they just asked for. Asked
    // before the teardown, because afterwards there is nothing left to ask
    // about.
    //
    // The panel is the odd one of the three: it is not emptied here but at the
    // end of `#drawLevelBar`. One question covers all three because it is
    // asked of all three up front, and answered at the very end of this method
    // -- by which time every region that could have held the focus is gone,
    // whichever of them did.
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
    this.#drawLevelBar();
    // Skipped entirely for a crunch: this is the one line that draws the
    // building, and an instant run's whole point is that nothing does. The
    // statistics panel just above is not behind this condition -- it
    // subscribes to the world, not to this call -- so it goes on reporting
    // live figures throughout a crunch exactly as it does through an animated
    // run, and is left holding the final ones the moment `stats_changed`
    // below reaches a verdict.
    if (!instant) {
      presentBuildingStage(this.#elements.world, world);
    }

    world.on("stats_changed", () => {
      const conditionStatus = level.condition.evaluate(world);
      // A crunch's own ceiling, folded into the same verdict a normal run
      // reaches: past `INSTANT_RUN_MAX_SIMULATED_SECONDS` of simulated time
      // with the level's own condition still undecided, this stops
      // waiting for one and calls it a loss -- `false`, not a third outcome,
      // because the level is exactly the same one every other failure already
      // shows. Only a crunch is bounded this way; an animated run is bounded
      // by the player's own patience instead, same as it always was.
      const levelStatus =
        conditionStatus ??
        (instant && world.elapsedTime >= INSTANT_RUN_MAX_SIMULATED_SECONDS ? false : null);
      if (levelStatus === null) {
        return;
      }
      world.levelEnded = true;
      if (instant) {
        // Not `this.worldController.setPaused(true)`: a crunch drives a
        // private controller nothing else touches (see
        // `src/game/instant-run.ts`), so pausing the shared one here would
        // pause whatever *that* is doing instead and raise a `timescale_changed`
        // nobody asked for.
        this.#endInstantRun(world);
      } else {
        this.worldController.setPaused(true);
      }
      // Recorded where the verdict is reached rather than in `#showOutcome`,
      // which `relocalise` calls again to redraw that verdict in another
      // language. Nothing miscounts today if it moves -- progress is a set of
      // level ids, so a redraw would re-add an id that is already in it -- and
      // that is exactly why the rule is worth writing down rather than leaving
      // to the type it happens to be stored in. The day progress records
      // anything a repeat would change, an attempt count, a first-cleared
      // timestamp, a language switch would quietly start writing it, and the
      // drawing path is the last place anybody would think to look. Drawing
      // stays drawing.
      const tutorial = this.#tutorial;
      const skyscraper = this.#skyscraper;
      if (levelStatus && tutorial !== undefined) {
        recordClearedTutorialLevel(this.#storage, tutorial.level.id);
        // This lesson's tile in the switcher is drawn as cleared from now on,
        // and the player may open the menu before starting anything else --
        // the same reason the numbered branch below redraws it on a tier. The
        // panel is deliberately left standing: nothing it shows depends on
        // what has been cleared, and redrawing it would shut every hint the
        // player had opened at the moment they were told they had won.
        this.#levelSwitcher.update();
      } else if (levelStatus && skyscraper !== undefined) {
        // A medal rather than a cleared flag, because the block holds both
        // kinds of level and one path has to serve both: a level that grades
        // silver and gold gets the tier it earned, and a short demonstrating
        // level omits `tiers` entirely, which `evaluateLevelTier` reads as
        // "bronze is the only medal here". So bronze is this block's spelling
        // of "cleared", and no second progress shape is needed to say it.
        //
        // Keyed by the level's id and not by `levelIndex`, which is `null` on
        // every run in this block -- the numbered branch below is the only one
        // with an index to key by, and `#entities/skyscraper-level` keeps its
        // own store precisely so that a Skyscraper level cannot overwrite a
        // numbered level's medal.
        const tier = evaluateLevelTier(true, world, skyscraper.level.tiers);
        if (tier !== null) {
          recordSkyscraperTier(this.#storage, skyscraper.level.id, tier);
          this.#levelSwitcher.update();
        }
      } else if (levelStatus && levelIndex !== null) {
        // `true`, not `levelStatus`: a tier is only ever asked for on a win,
        // and `evaluateLevelTier` returns `null` for anything else, which
        // would make the field below need a guard this branch already is one.
        const tier = evaluateLevelTier(true, world, level.tiers);
        if (tier !== null) {
          recordLevelTier(this.#storage, levelIndex, tier);
          // The one place the switcher has to be redrawn between two runs
          // rather than by the next one's own `#drawLevelBar`: the tile
          // just earned or improved a tier, and the player may open the
          // popover before starting anything else.
          this.#levelSwitcher.update();
        }
      }
      this.#showOutcome(levelStatus);
    });

    const codeObj = this.#editor.getCodeObj();
    if (instant) {
      // The constructor's `usercode_error` subscription is bound to
      // `this.worldController`, the shared controller -- a crunch's private one
      // raises nothing on it, so it is wired here instead, through
      // `onController` rather than off the handle `driveInstantly` returns.
      // That distinction matters for a program whose `init` throws on the very
      // first tick: a level that small can run to a verdict, error and all,
      // entirely inside the call to `driveInstantly` below, before it has
      // returned anything to subscribe to. `onController` runs before a single
      // tick has happened, which is early enough to catch it; the handle is not.
      const handle = driveInstantly(world, codeObj ?? NO_OP_CODE, {
        onController: (controller) => {
          controller.on("usercode_error", (e) => {
            console.log("World raised code error", e);
            this.#editor.trigger("usercode_error", e);
            // A crunch has no Pause button to leave paused and no Resume to
            // come back from -- unlike an animated run's `worldController`,
            // nothing ever unpauses this private one again, so an error ends
            // this crunch rather than merely halting it. `stats_changed` will
            // not do this instead: it is `world.update` that raises it, and
            // `WorldController.start`'s own tick loop stops calling that the
            // moment `codeObj.update` has thrown. Ending the crunch here, not
            // just relying on the guard below, is what recovers a run whose
            // very first tick is the one that throws -- see that guard.
            this.#endInstantRun(world);
          });
        },
      });
      // Not stored when the crunch has already finished, or already failed:
      // a small level can run to a verdict, or a program can throw on its
      // very first tick, entirely inside `driveInstantly` above, before it
      // returns here -- and the handlers above have already cleared
      // `#instantRunHandle` by the time this line would otherwise overwrite it
      // with a handle for a run that is already over.
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
    // After the controller, which is where the new run's pause state is decided:
    // `start` pauses by assignment rather than through `setPaused`, so it raises
    // no event, and a run started from a running one would otherwise leave a
    // button reading "Pause" over a simulation that is standing still.
    this.#controls.update();
    // And the focus after the label, which is the whole reason this is down here
    // rather than back with the redraw that emptied the region: focusing a
    // button is what makes a screen reader read its name, and until the line
    // above the name is the one the *previous* run ended on. "Start over" on a
    // finished level would have announced "Start" and then silently become
    // "Pause", which is a button that says one thing and does another.
    //
    // The run controls are where it lands because the bar has nowhere to put it
    // -- every control there belongs to something the player was reading, not
    // doing -- and because a player who has just started a run is heading for
    // them anyway.
    if (focusWasDestroyed) {
      this.#controls.focusStartStop();
    }
  }

  /**
   * Redraws everything that depends on which run is on screen, but is not
   * itself the goal bar's own construction: the level switcher, the editor
   * pane, and the learning track's panel.
   *
   * Its own method because it has two callers with nothing else in common: the
   * start of a run, where {@link #startRun} has already built a fresh
   * {@link #goalBar} for the world it is about to draw, and a language change,
   * where {@link #goalBar}'s own `update()` is enough to re-translate it
   * without rebuilding it — see that field's own doc comment.
   */
  #drawLevelBar(): void {
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
   * Draws whichever card the level on screen has earned the region beside the
   * building — the learning track's lesson panel, or the briefing card of a
   * Skyscraper level that has one — and empties it when the level has neither.
   *
   * Two widgets, one element, and exactly one of them ever drawn: both write
   * into `#elements.tutorial`, and each presenter replaces the region's contents
   * outright rather than appending, so moving from a lesson to a Skyscraper
   * level cannot leave the lesson standing under the briefing. The mutual
   * exclusion is not this method's to enforce — {@link #clearSpecialRuns}
   * already guarantees at most one of the two fields is set — so the order of
   * the branches below settles nothing and is written to match
   * {@link handleRoute}'s.
   *
   * The name still says "tutorial panel" because the region and its element
   * still do, and renaming an element the stylesheet, the layout widget and
   * `index.html` all know by that name is a bigger edit than this one, for a
   * word rather than a behaviour.
   *
   * Hung off the end of {@link #drawLevelBar} rather than given call sites
   * of its own, because that method's two callers are exactly the two moments
   * the panel has to be drawn again: the start of a run, which is the only
   * thing that can change which level is on screen, and a language change, which
   * has to reach every word on the page — and the panel is most of the words on
   * it. The alternative, calling this from both places, is two call sites to
   * keep in step and a third to forget when a third caller appears. It runs
   * after the bar so that the page is written in the order it is read.
   *
   * Emptying is not an afterthought but the common case: nineteen levels, the
   * sandbox and most of the Skyscraper block all reach here, and every one of
   * them has to leave the region empty, since the stylesheet hides it only
   * while it is — which is how a level with nothing to explain gives the width
   * back to the building rather than to a blank card. Leaving
   * the last level's hints above level 1 would be worse than a gap — they
   * are the answer to a level the player is no longer playing.
   *
   * The panel has no button of its own for starting the level again, though it
   * had one until the run controls were gathered into a row: "Start over" in the
   * panel and "Start over" in `.controls` are two buttons with the same
   * accessible name, on screen together on every level, and the panel's one did
   * not auto-start where the row's does. Two buttons that say the same thing
   * must not do different things (WCAG 3.2.4), and the row is directly under the
   * panel, so the one that stayed is the one a player can find from anywhere in
   * the game rather than only on the track.
   *
   * Nothing is handed to the panel but the index, and no callback at all. It
   * had two -- one that copied the level's program into the player's own editor
   * and one that left the track for level 1 -- and both were buttons the panel
   * drew under its prose. Neither was a thing a lesson has to say: the app bar's
   * level switcher already leaves for any level in the game, and the answer the
   * panel shows already carries a button that copies it to the clipboard. What
   * is left is a lesson, and a lesson only needs to know which one it is.
   */
  #drawTutorialPanel(): void {
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      presentTutorial(this.#elements.tutorial, { levelIndex: tutorial.index });
      return;
    }
    // Read here, on the way in, rather than passed as a level id for the widget
    // to look up. `card` is a getter over the message catalogue, so reading it
    // at the moment of drawing is what puts the card in the language being drawn
    // -- which is the whole reason this method is called again on a language
    // change. Most levels of the block answer `undefined` and fall through to
    // the emptying below, which is what leaves the building the space.
    const card = this.#skyscraper?.level.card;
    if (card !== undefined) {
      presentLevelBriefing(this.#elements.tutorial, card);
      return;
    }
    clearChildren(this.#elements.tutorial);
  }

  /**
   * Draws the end-of-level card, and remembers that it is showing.
   *
   * The outcome is the thing worth remembering; the four strings are worked out
   * from it here, every time, so that {@link relocalise} can draw the same
   * verdict again in another language. The presenter replaces the container's
   * contents rather than appending, so calling this twice about one run leaves
   * one card.
   *
   * @param won - Whether the level's condition was met.
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
    // Recomputed from the world rather than carried from the `stats_changed`
    // handler that first recorded it: the tier is a pure function of the
    // world's own final figures, which do not move once `levelEnded` is
    // set, so asking again here is what lets `relocalise` draw the same badge
    // in another language without a field of its own to keep in step.
    const tier =
      won && levelIndex !== null && run !== undefined && world !== undefined
        ? (evaluateLevelTier(true, world, run.level.tiers) ?? undefined)
        : undefined;
    presentVerdictToast(this.#elements.feedback, {
      won,
      title: won ? t("game.feedback.success.title") : t("game.feedback.failure.title"),
      message: won ? t("game.feedback.success.message") : t("game.feedback.failure.message"),
      // Recomputed here for the same reason the tier above is, and from the
      // same two final figures -- the star that was earned and the world it was
      // earned in -- so that a language change redraws the sentence rather than
      // leaving the one language behind that the run happened to end in.
      hint:
        tier !== undefined && run !== undefined && world !== undefined
          ? nextTierHint(run.level.tiers, tier, world)
          : "",
      // No link after a failure, none after the last level, and none for the
      // sandbox, which cannot get here at all: its condition never resolves. The
      // seed is dropped for the same reason the navigation row drops it: it
      // belongs to the building just completed, not to the next one.
      url:
        won && levelIndex !== null && levelIndex + 1 < this.levels.length
          ? createParamsUrl(this.#query, { [LEVEL_KEY]: levelIndex + 2, seed: null })
          : "",
      tier,
    });
  }

  /**
   * Puts everything the app has drawn into the language that is active now.
   *
   * Called when the language picker changes the language, after the catalogue
   * has been fetched and after `localisePage` has rewritten the shell. The run
   * in progress survives it: nothing here tears down a world, so the passengers,
   * the clock, the score and the seed are the ones the player already had.
   * Restarting would have been a great deal less code, and it is the one outcome
   * this feature refuses -- losing a run because somebody changed a language is
   * worse than any amount of it staying in the old one.
   *
   * The five regions and why each is done the way it is:
   *
   * - The goal bar, the level switcher, the editor pane and the learning
   *   track's panel are rebuilt from scratch by {@link #drawLevelBar},
   *   which is cheap and correct: none of the four subscribe to the world.
   * - The statistics panel's own `update()` relabels its captions the same
   *   way; its *figures* go through `Intl` and are left alone, since they are
   *   numbers rather than words and the next tick redraws them anyway.
   * - The end-of-level overlay is drawn again from the remembered outcome,
   *   if there is one.
   *
   * The banner about a failed program is drawn again too, since the sentence
   * around the error is a message. What it wraps is not: an exception's own text
   * is whatever the player's program produced, and it is shown again exactly as
   * it was.
   *
   * Two lines in the page are left alone on purpose, and both report something
   * that has already happened: the save confirmation under the editor and the
   * fitness benchmark's result beside it. Re-translating either would mean asserting
   * in the new language that a thing happened at a time nobody recorded; both
   * are rewritten by the next save and the next measurement. The editor's own
   * accessible name is the third, and that one is a limitation rather than a
   * choice -- CodeMirror is given it when the view is built.
   *
   * The learning track's "program taken" line is a fourth report of something
   * that has already happened and is deliberately *not* in that group: it is
   * inside the panel this redraws, so leaving it alone was never an option --
   * the redraw would have thrown it away. It says nothing about when, so it can
   * be said again in the new language, and `src/widgets/tutorial-panel/ui/tutorial-panel.ts` carries
   * the answer rather than the sentence across the redraw in order to say it.
   */
  relocalise(): void {
    // Unconditional, unlike the bar: the run controls and the editor pane are
    // on screen from the first paint, before any level has started, so
    // they have words to rewrite even when there is no world to redraw around
    // them.
    this.#controls.update();
    this.#editorPane.update();
    const world = this.world;
    if (world !== undefined) {
      this.#drawLevelBar();
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
   * Draws the end-of-run overlay for a level of the learning track.
   *
   * A level ends in one of three ways and the game already had words for only one
   * of them. A loss is an ordinary loss and says so: the program did not clear
   * the bar, which on the track is the *expected* first outcome, so nothing here
   * treats it as special or offers a way onwards — the player is meant to go
   * back to the editor, and the panel is where the hints are.
   *
   * A win in the middle of the track offers the next level. It cannot use
   * `game.feedback.next`, which the template writes into every link and which
   * says "Next level": the numbered ladder is not where level 4 lives, and a
   * player who follows a link labelled that way lands somewhere they did not ask
   * for. So the link's words are replaced after the render, the way the sandbox
   * replaces the title, and for the same reason — the template is shared and its
   * markup is not this module's to change.
   *
   * A win on the *last* level replaces the whole overlay. Level 8 is level 1
   * with the hints taken away, so what the player has in the editor at that
   * moment is a program that clears the first real level, and the only
   * useful thing to say is "take it with you". That is `tutorial.finish.*`, and
   * its link leaves the track for level 1 rather than offering a ninth level
   * that does not exist.
   *
   * The link takes nothing with it, and its words no longer say it does. It is
   * an ordinary route change: the editor switches to the player's own buffer on
   * the way out, so what waits on level 1 is the player's own program and
   * not the one that just won. The label used to read "Go to level 1 with
   * this program", which was a promise the route does not keep — the winning
   * program is safe under the level's own key, but the player was told it had
   * travelled with them and would have found their old program instead. Copying
   * it across from here was the other way to make the two agree, and it is the
   * wrong one: what is under the player's own key is a program they wrote, and
   * a link out of the track that overwrote it on the way would be the one path
   * in the game that throws away an evening's work without asking. So the words
   * were corrected instead, and `tutorial.finish.message` says where the winning
   * program is rather than promising to carry it.
   *
   * Nothing is recorded here. {@link #startRun} records the clear where the
   * condition resolves, so that {@link relocalise} can call this again to redraw
   * the same verdict in another language without a language change counting as
   * a second win.
   *
   * @param tutorial - The level that just ended and where it sits in the track.
   * @param won - Whether the level's condition was met.
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
      // Nothing to be short of: a level carries no `level.tiers` for the
      // hint to name a next bar out of, the same reason `tier` below is
      // `undefined`.
      hint: "",
      // The seed is dropped from both, as it is from every link the app builds:
      // it belongs to the run just finished. On the way to level 1 that is
      // also what keeps the link usable at all -- the router refuses a seed on a
      // level address and would refuse this one on arrival if it survived.
      url: finished
        ? createParamsUrl(this.#query, { [LEVEL_KEY]: 1, seed: null })
        : won && nextLevel !== undefined
          ? createParamsUrl(this.#query, { [LEVEL_KEY]: nextLevel.id, seed: null })
          : "",
      // A level's win has no tier -- tiers rank a numbered level's run
      // against `level.tiers`, which levels on the learning track do not
      // carry. See {@link #showOutcome} for the numbered-level case.
      tier: undefined,
    });
    if (won) {
      this.#relabelFeedbackLink(
        finished ? t("tutorial.finish.toLevels") : t("tutorial.finish.nextLevel"),
      );
    }
  }

  /**
   * Replaces the words in the end-of-run link, leaving its caret icon alone.
   *
   * The link is one text node followed by an icon element, so the text node is
   * rewritten rather than the link: assigning `textContent` would take the caret
   * with it, and assigning `innerHTML` would put a translated string through the
   * HTML parser for no reason.
   *
   * Missing the link is not an error and is the ordinary case — there is no link
   * after a loss. What the player sees if the shape of the template ever changes
   * under this is the template's own wording, which is wrong but readable.
   *
   * @param words - What the link should say, already in the active language.
   */
  #relabelFeedbackLink(words: string): void {
    const link = this.#elements.feedback.querySelector(FEEDBACK_LINK_SELECTOR);
    const text = link?.firstChild;
    if (text?.nodeType === Node.TEXT_NODE) {
      text.textContent = `${words} `;
    }
  }
}
