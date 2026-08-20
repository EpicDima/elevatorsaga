/**
 * The application: challenges, the world controller, and the wiring between
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

import { createSandboxChallenge } from "../../game/challenges.ts";
import type { Challenge, SandboxOptions } from "../../game/challenges.ts";
import { INSTANT_RUN_MAX_SIMULATED_SECONDS, driveInstantly } from "../../game/instant-run.ts";
import type { InstantRunHandle } from "../../game/instant-run.ts";
import { tutorialTasks } from "../../game/tutorial.ts";
import type { TutorialTask } from "../../game/tutorial.ts";
import { createWorld } from "../../game/world.ts";
import type { World } from "../../game/world.ts";
import type { AnimationFrameRequester, WorldController } from "../../game/world-controller.ts";
import { LOCALES, t, translateIn } from "../../i18n/index.ts";
import type { CodeEditor } from "../../ui/editor.ts";
import {
  elevatorFloorButtonLabel,
  elevatorLabel,
  floorCallDownLabel,
  floorCallUpLabel,
} from "../../ui/templates.ts";
import type { SeedLinkData } from "../../ui/templates.ts";
import { SANDBOX_CHALLENGE } from "./model/route.ts";
import type { RouteParams } from "./model/route.ts";
import {
  evaluateChallengeTier,
  nextTierHint,
  readBestChallengeTiers,
  recordChallengeTier,
} from "#entities/challenge-tier/index.ts";
import {
  countClearedTutorialTasks,
  readClearedTutorialTasks,
  recordClearedTutorialTask,
} from "#entities/tutorial-task/model/progress.ts";
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
     * challenge. That has been known since 2015 and is left open on purpose:
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

/** The link of the end-of-run card, whose words the last task of the track rewrites. */
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
 * the challenge bar, Pause under the building, the rest beside the editor.
 * Both of those arrangements had a cost this one does not: the row under the
 * building took a line of height from the building on every layout, and the
 * split one made "which of these restarts?" a question only experiment could
 * answer.
 *
 * What has not changed is that this is drawn once, for the life of the page,
 * and only relabelled. The challenge bar used to be rebuilt on every restart,
 * so every one of these buttons used to destroy itself when pressed — which is
 * what the challenge bar's own focus bookkeeping existed to paper over. A
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
  readonly challengeEnded: () => boolean;
  /**
   * Whether the run on screen has already ticked, so the button offers to
   * resume rather than to start.
   *
   * A function for the same reason {@link challengeEnded} is one.
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
   * A function for the same reason {@link challengeEnded} is one. See
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
   * A function for the same reason {@link challengeEnded} is one: this row is
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
   * a region focus was inside — the end-of-challenge overlay holding the "Next
   * challenge" link, or the building — leaves focus on `<body>` and a keyboard
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
 * {@link controlsTemplate} for why the row is not rebuilt with the challenge
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
    challengeEnded: () => options.challengeEnded(),
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
   * so a challenge is not left with a gap above the building.
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
  /** Where `widgets/goal-bar` goes: the current challenge's meters and tier popover. */
  readonly goalBar: HTMLElement;
  /** Where `widgets/building-stage` draws the building. */
  readonly world: HTMLElement;
  /** Where `widgets/stats-panel` draws the run's figures. */
  readonly stats: HTMLElement;
  /** Where `widgets/verdict-toast` draws the end-of-challenge overlay. */
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
  /** The challenges, in order. */
  readonly challenges: readonly Challenge[];
  /**
   * Where the chosen time scale and the learning track's progress are
   * remembered; defaults to `localStorage`.
   *
   * The player's program is deliberately not on that list, though it lives in
   * the same store: it is the editor's, and asking it for one
   * ({@link App.playerCodeWouldBeReplaced}) goes through the editor so that the
   * answer is the program the player would actually see. Everything here is
   * something no other object owns.
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
 * The task of the learning track on screen, and where it sits in the track.
 *
 * The task itself rather than its index alone, because everything the panel and
 * the bar ask for — the identifier, the seed, the two programs, the condition —
 * is on it, and a second lookup by index is a second chance to look up the
 * wrong one. The index rides along because the track is the one part of the
 * game that is *numbered for the player*: "Task 3 of 8" is in the bar's title
 * and in the panel, and it is a position in the table rather than anything
 * stored, which is why nothing but the interface is allowed to use it.
 */
export interface TutorialRun {
  /** The task being played. */
  readonly task: TutorialTask;
  /** Its position in `tutorialTasks`, counted from zero. */
  readonly index: number;
}

/** How much of the learning track this browser has cleared. */
export interface TutorialProgress {
  /** How many tasks have been cleared, counting each task once. */
  readonly cleared: number;
  /** How many tasks the track has. */
  readonly count: number;
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
  /** The challenges being played, in order. */
  readonly challenges: readonly Challenge[];
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The world currently being played, once a challenge has started. */
  world: World | undefined = undefined;
  /**
   * Index of the challenge currently being played.
   *
   * Left where it was while the sandbox is running, since the sandbox is not in
   * the list: it says which numbered challenge a restart would return to, not
   * what is on screen. {@link isPlayingSandbox} is what distinguishes the two.
   */
  currentChallengeIndex = 0;

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
   * per-run state for a fresh challenge to replace.
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
   * {@link #levelSwitcher}: its meters are shaped by the challenge on screen,
   * and it subscribes to that challenge's own world. A language change calls
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
   * The code slot open in the editor, for whichever numbered challenge is
   * current.
   *
   * In-memory only, like {@link currentChallengeIndex}: nothing about which
   * slot a player last used is worth remembering across a reload, and the
   * editor's own storage already remembers each slot's text. Set by
   * {@link startChallenge} and left alone by everything else that is not
   * {@link selectCodeSlot}, so that "Start over" and Ctrl-Enter reopen the slot
   * the player was looking at rather than silently returning to the first one.
   */
  #currentSlot: CodeSlot = DEFAULT_CODE_SLOT;
  /** The parameters of the URL the current challenge was started from. */
  #query: RouteQuery = new Map<string, string>();
  /** The building the sandbox is running, or `undefined` for a challenge. */
  #sandbox: SandboxOptions | undefined = undefined;
  /**
   * The task of the learning track being played, or `undefined` for anything
   * else.
   *
   * The third thing that can be on screen, and the field that tells the other
   * two what to do about it: it decides which run a restart repeats, which seed
   * a world is built from, what the bar's title says, and which overlay the end
   * of a run gets. Set by {@link startTutorial} and cleared by
   * {@link startChallenge} and {@link startSandbox}, so that exactly one of the
   * three is ever in effect.
   */
  #tutorial: TutorialRun | undefined = undefined;
  /**
   * The seed every run is built from, or `null` to let each draw its own.
   *
   * Read from the URL and from nowhere else, which is the whole of the restart
   * rule: see {@link handleRoute}.
   *
   * A task of the learning track is the exception, and it does not change that
   * sentence: the task's own seed is applied where the world is built, and this
   * field goes on meaning "what the URL asked for" so that leaving the track
   * for a challenge finds the URL's seed still in it. See {@link #startRun}.
   */
  #seed: string | null = null;
  /**
   * What is on screen, or `undefined` before the first run has started.
   *
   * The challenge rather than its description, because a description is a
   * sentence in whatever language was active when it was asked for --
   * `ChallengeCondition.description` is a getter for exactly that reason -- and
   * {@link relocalise} has to be able to ask again. The index rides along
   * because it is what tells the sandbox apart from the challenges without
   * looking anything up, and it is `null` for the sandbox, which is not in the
   * list. Distinct from {@link currentChallengeIndex}, which says where a
   * restart would go rather than what is being played.
   */
  #run: { readonly challenge: Challenge; readonly challengeIndex: number | null } | undefined =
    undefined;
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
   * challenges.
   */
  constructor(options: AppOptions) {
    this.#elements = options.elements;
    this.#editor = options.editor;
    this.#editorPane = options.editorPane;
    this.worldController = options.worldController;
    this.challenges = options.challenges;
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
      challengeEnded: () => this.world?.challengeEnded === true,
      runStarted: () => (this.world?.elapsedTime ?? 0) > 0,
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
    // inside startChallenge, so every challenge start added another listener
    // that was never removed: after N challenges the time scale was written to
    // storage N times and the challenge bar was rebuilt N times per click.
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
   * what is locked or how a tile is named.
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
      challenges: this.challenges,
      tutorialTasks,
      bestTiers: readBestChallengeTiers(this.#storage),
      clearedTutorialTasks: readClearedTutorialTasks(this.#storage),
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
   * back to {@link currentChallengeIndex}'s own default, the same challenge a
   * bare reload would open.
   */
  #levelSelection(): LevelSelection {
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      return { kind: "tutorial", index: tutorial.index };
    }
    if (this.isPlayingSandbox) {
      return { kind: "sandbox" };
    }
    return { kind: "challenge", index: this.#run?.challengeIndex ?? this.currentChallengeIndex };
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
      case "challenge": {
        return createParamsUrl(this.#query, { challenge: target.number, seed: null });
      }
      case "tutorial": {
        return createParamsUrl(this.#query, { challenge: target.taskId, seed: null });
      }
      case "sandbox": {
        return createParamsUrl(this.#query, { challenge: SANDBOX_CHALLENGE, seed: null });
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
   * Built with {@link createParamsUrl}, so the challenge, the speed, the sandbox
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
   * A task of the learning track offers no seed block at all, and it is the one
   * run in the game where that is the honest answer. Everything the block offers
   * is an offer about a seed the player chooses, and on a task the seed is not
   * theirs to choose. Typing one, or pinning one, writes `seed=` into an address
   * the router refuses it on — `refuseSeedOnTrack` in
   * `src/pages/game/model/route.ts` — so following the game's own link would warn
   * on the console and have `startRouter` strip the key back out of the bar in
   * front of the player. A new draw would replace the seed the *task* pins, which
   * is the point of the task: `TutorialTask.seed` records that a random one would
   * make the lesson a coin flip. A block that undoes itself is worse than no
   * block, so the block goes, and the console print built from the same data goes
   * with it — what it prints is that same refused URL. The seed is not lost: it
   * is the task's, written down in the table.
   *
   * Rendering the seed as plain text was the alternative and was rejected. It
   * would occupy the same space to say a word that means nothing to the player on
   * the track — the seed of task 5 is `tutorial-5` — and the block exists to be
   * *acted* on. If the track ever wants the seed shown, the honest form is the
   * panel saying so in its own words, not this block with its controls taken
   * away.
   *
   * @param world - The run that has just been built.
   * @param challengeIndex - Its index in {@link challenges}, or `null` for the
   * sandbox, which the URL addresses by its building instead.
   * @returns Its seed and the URL that names this run outright, or `null` when it
   * has no seed to offer.
   */
  #seedLink(world: World, challengeIndex: number | null): SeedLinkData | null {
    if (this.#tutorial !== undefined) {
      return null;
    }
    if (world.seed === null) {
      // Only reachable when a caller handed the world a ready-made random
      // stream, which the app never does; a test that does gets no seed block
      // rather than a link with nothing to pin.
      return null;
    }
    const seed = String(world.seed);
    return { seed, url: this.#seedHref(seed, challengeIndex) };
  }

  /**
   * The address of this building played on `seed`.
   *
   * The challenge is named, as it is in every other link this class builds, and
   * here it is load-bearing rather than tidy. A first visit has no hash at all,
   * so "everything you are carrying, plus this seed" would leave the run's own
   * identity to a default — and a default that later changes is a link that
   * later means a different building. Where the URL already carries a challenge,
   * which is every route the game writes itself, this replaces it with the same
   * value and changes nothing.
   *
   * @param seed - The seed the address should play.
   * @param challengeIndex - The challenge to name, or `null` for the sandbox,
   * which the URL addresses by its building instead.
   * @returns The hash URL.
   */
  #seedHref(seed: string, challengeIndex: number | null): string {
    const at = challengeIndex === null ? {} : { challenge: challengeIndex + 1 };
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
    window.location.hash = this.#seedHref(seed, this.#run?.challengeIndex ?? null);
  }

  /**
   * The seed line for whatever is on screen, for a caller mounted once at
   * startup rather than redrawn on every run the way {@link #drawChallengeBar}
   * is.
   *
   * A snapshot, not a subscription: reading this again after a later run
   * returns that run's seed, but nothing here pushes the new value out on its
   * own. {@link AppOptions.onSeedChange} is the push side, called with this
   * same getter's value every time {@link #drawChallengeBar} runs — a caller
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
    return this.#seedLink(world, run.challengeIndex);
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

  /** Whether what is on screen is the sandbox rather than a numbered challenge. */
  get isPlayingSandbox(): boolean {
    return this.#sandbox !== undefined;
  }

  /**
   * Whether the run on screen is one a crunch could reach the end of.
   *
   * Everything but the sandbox is. `requireSandbox` is the last condition in
   * the game that never resolves — `challenges.ts` says so where it is
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
   * `challenges[currentChallengeIndex]`. Restarting through the index would now
   * throw a sandbox player back onto a numbered challenge, and with it the
   * building they had configured. A task of the learning track is the same
   * hazard with a worse ending: `currentChallengeIndex` is left wherever the
   * last numbered challenge put it, so Ctrl-Enter on task 3 would apply the
   * player's edit to challenge 1 — a different building, and the attempt they
   * were half-way through no longer on screen to compare against.
   *
   * The order of the three is the order of {@link handleRoute} and means the
   * same thing: a task, or the sandbox, or a numbered challenge. Only one of
   * the two fields is ever set, so the order decides nothing at runtime; it is
   * written the same way in both places so that a reader who has checked one
   * has checked the other.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  #restart(autoStart = false): void {
    const tutorial = this.#tutorial;
    const sandbox = this.#sandbox;
    if (tutorial !== undefined) {
      this.startTutorial(tutorial.index, autoStart);
    } else if (sandbox === undefined) {
      this.startChallenge(this.currentChallengeIndex, autoStart, this.#currentSlot);
    } else {
      this.startSandbox(sandbox, autoStart);
    }
  }

  /** Starts, pauses or restarts the simulation, depending on where it is. */
  startStopOrRestart(): void {
    if (this.world?.challengeEnded === true) {
      this.#restart();
    } else {
      this.worldController.setPaused(!this.worldController.isPaused);
    }
  }

  /**
   * Runs whatever is on screen again, headlessly: nothing drawn while it
   * plays, the outcome and the final statistics shown the moment it has one.
   *
   * Deliberately not a fourth case alongside {@link #restart}'s three, though
   * it does the same job for the same reason: {@link #run} already says which
   * challenge, task or sandbox is current, however it got there, so re-reading
   * it here is one branch instead of {@link #restart}'s three, and none of
   * `startChallenge`/`startSandbox`/`startTutorial`'s own bookkeeping --
   * leaving the tutorial buffer, remembering which sandbox or challenge index
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
    this.#startRun(run.challenge, run.challengeIndex, true, true);
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
   * Acts on a route: applies its options and starts the challenge it names.
   *
   * A `seed` in the hash still outranks everything but a task's own, so `#seed=…`
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
   * a player stuck on a challenge with the same passenger stream however often
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
   * it is the whole of the dispatch: a route is a task of the learning track, or
   * the sandbox, or a numbered challenge. The router never sets more than one of
   * those — `#challenge=` holds one value — so this is a statement of precedence
   * rather than a decision made every time, and the precedence runs from the
   * most specific address to the least. `challengeIndex` is the least, because
   * the router resolves it to challenge 1 for any spelling it does not
   * understand, which is exactly what an unrecognised route should play and
   * exactly what a task's route must not: until this branch existed,
   * `#challenge=tutorial-5` played challenge 1 while the address bar went on
   * saying `tutorial-5`, and a reload never escaped it.
   *
   * @param params - The validated route parameters.
   * @param query - The raw parameters, kept for the next-challenge link.
   */
  handleRoute(params: RouteParams, query: RouteQuery): void {
    this.#query = query;
    this.#seed = params.seed;
    setDemoFullscreen(params.fullscreen);
    this.worldController.setTimeScale(params.timeScale);
    if (params.tutorialIndex !== null) {
      this.startTutorial(params.tutorialIndex);
    } else if (params.sandbox === null) {
      this.startChallenge(params.challengeIndex);
    } else {
      this.startSandbox(params.sandbox);
    }
  }

  /**
   * Tears the current challenge down and starts another one.
   *
   * @param challengeIndex - Zero-based index of the challenge to start.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @param slot - Which of the challenge's three code slots to open; defaults
   * to {@link DEFAULT_CODE_SLOT}.
   */
  startChallenge(
    challengeIndex: number,
    autoStart = false,
    slot: CodeSlot = DEFAULT_CODE_SLOT,
  ): void {
    const challenge = this.challenges[challengeIndex];
    if (challenge === undefined) {
      throw new RangeError(`No challenge with index ${String(challengeIndex)}`);
    }
    this.#sandbox = undefined;
    this.#tutorial = undefined;
    this.#currentSlot = slot;
    this.#editor.openChallengeBuffer(challengeIndex, slot);
    this.currentChallengeIndex = challengeIndex;
    this.#startRun(challenge, challengeIndex, autoStart);
  }

  /**
   * Switches the editor to another of the current challenge's three code
   * slots, without disturbing the run in progress.
   *
   * Deliberately not a call to {@link startChallenge}: a slot is a place to
   * keep a program, not a different challenge, and a player who switches slots
   * mid-run is not asking for the world to be torn down and rebuilt under
   * them. Only the editor's buffer and the two regions that report the slot in
   * use move; {@link #run}, the world and the controller are left exactly as
   * they were.
   *
   * A no-op when the slot asked for is already open, for the same reason
   * {@link "../../ui/editor.ts"!CodeEditor.openChallengeBuffer} is idempotent: the
   * switcher's own button is one of the things that can ask for it, and a
   * second click must not replace the document under a player who is typing.
   *
   * @param slot - The slot to open.
   */
  selectCodeSlot(slot: CodeSlot): void {
    // A learning task and the sandbox have no challenge index of their own to
    // key a slot by -- see `widgets/editor-pane`'s own slot switcher, which,
    // unlike the presenter this replaced, has no way to hide itself while
    // either is on screen. Silently doing nothing is what the old, hidden
    // switcher did for free; this is the same answer for a switcher that is
    // now visible, but inert, on both.
    if (this.#tutorial !== undefined || this.isPlayingSandbox) {
      return;
    }
    if (slot === this.#currentSlot) {
      return;
    }
    this.#currentSlot = slot;
    this.#editor.openChallengeBuffer(this.currentChallengeIndex, slot);
    this.#editorPane.update();
  }

  /** The code slot currently open in the editor. */
  get currentCodeSlot(): CodeSlot {
    return this.#currentSlot;
  }

  /**
   * Tears the current challenge down and starts a sandbox run in its place.
   *
   * The building comes from the URL, so it is bookmarkable and shareable, and
   * nothing about the run is remembered anywhere else: coming back to the same
   * link is coming back to the same building.
   *
   * @param options - The building to play in, already validated by the router.
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  startSandbox(options: SandboxOptions, autoStart = false): void {
    this.#sandbox = options;
    this.#leaveTutorialBuffer();
    this.#startRun(createSandboxChallenge(options), null, autoStart);
  }

  /**
   * Tears the current run down and starts a task of the learning track.
   *
   * A {@link TutorialTask} is structurally a {@link Challenge} — `options` and
   * `condition` are named and typed to match, deliberately — so it is handed
   * straight to the same machinery, with `null` where a challenge index would
   * go. That `null` is the whole of "a task is not a challenge": it is not
   * numbered in the bar, not marked in the navigation row, and not followed by a
   * link into the numbered ladder. {@link currentChallengeIndex} is left where
   * the last numbered challenge put it, exactly as the sandbox leaves it, since
   * it says where the player would return to and not what is on screen.
   *
   * The editor is switched to the task's own buffer before the run is built,
   * and the order matters: {@link #startRun} compiles whatever is in the editor
   * at the moment it starts, so opening the buffer afterwards would run the
   * previous task's program in this task's building for one run.
   *
   * @param tutorialIndex - Zero-based position of the task in `tutorialTasks`.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @throws RangeError When no task has that position. Symmetric with
   * {@link startChallenge}: the router resolves a task address against the same
   * table, so this can only be reached by a caller that made the index up, and
   * a made-up index must not quietly play task 1.
   */
  startTutorial(tutorialIndex: number, autoStart = false): void {
    const task = tutorialTasks[tutorialIndex];
    if (task === undefined) {
      throw new RangeError(`No tutorial task with index ${String(tutorialIndex)}`);
    }
    this.#sandbox = undefined;
    this.#tutorial = { task, index: tutorialIndex };
    // The task's own attempt if the player has left one, and the starting code
    // only when they have not: somebody who half-solved task 4, wandered off to
    // a challenge and came back is owed their attempt, not the mistake again.
    //
    // Read here rather than held anywhere, because the program is a message:
    // `TutorialTask.startingCode` renders the task's own `.code` key when it is
    // asked for, so the editor is handed the language the player has chosen by
    // now, and starting the same task again — which is what "Start over" does —
    // hands over the language they have chosen since.
    this.#editor.openTutorialBuffer(task.id, task.startingCode);
    this.#startRun(task, null, autoStart);
  }

  /**
   * Puts the legacy single-buffer program back in the editor on the way out of
   * the track, into the sandbox.
   *
   * `startChallenge` leaves the track the same way, but no longer through this
   * method: it opens its own challenge-and-slot buffer directly, which already
   * clears `#tutorial` and already replaces whatever was on screen. Only the
   * sandbox has no buffer of its own to open instead — it always shows the
   * legacy key — so this is what is left once that is its only caller.
   *
   * Idempotent, and so safe to call when no task was running: the editor
   * returns early when the buffer asked for is the one already on screen, which
   * is what keeps a challenge-to-sandbox jump from disturbing the caret or
   * emptying the undo history.
   */
  #leaveTutorialBuffer(): void {
    this.#tutorial = undefined;
    this.#editor.openPlayerBuffer();
  }

  /**
   * The task of the learning track on screen, or `undefined` for anything else.
   *
   * The panel's whole input: it decides from this whether to draw at all, which
   * task's hints to show, and which number to print. Exposed read-only, because
   * the way to change what is being played is {@link startTutorial} — a panel
   * that could assign this would leave the field disagreeing with the world.
   */
  get tutorial(): TutorialRun | undefined {
    return this.#tutorial;
  }

  /**
   * How much of the learning track this browser has cleared.
   *
   * Read from the store on every call rather than cached, which costs one
   * `getItem` per draw and buys the one thing a cache would lose: the count is
   * right after the win that has just happened, in a second tab, and after the
   * player clears their storage mid-session. Nothing here is on a frame path.
   *
   * @returns The cleared count and the size of the track.
   */
  tutorialProgress(): TutorialProgress {
    return {
      cleared: countClearedTutorialTasks(readClearedTutorialTasks(this.#storage), tutorialTasks),
      count: tutorialTasks.length,
    };
  }

  /**
   * Whether taking a task's program would overwrite something the player wrote.
   *
   * What the panel asks before it offers `tutorial.button.takeCodeConfirm`.
   * "Something the player wrote" is deliberately narrow: an empty store is not
   * it, and neither is the starting program the game itself put there, because
   * confirming the replacement of a program nobody typed teaches players to
   * dismiss the question — and the one time it matters is the time they do it
   * without reading.
   *
   * Compared against `editor.defaultCode.code` rather than remembered, since the
   * player may have arrived on the track without ever opening the editor, in
   * which case what is in the store is whatever the last version of this game
   * wrote there.
   *
   * Checked in every locale {@link LOCALES} names, not only the one on screen:
   * the slot this reads is written the moment challenge 1 is first opened (see
   * {@link "../../ui/editor.ts"!EditorBuffer.writesStarterOnOpen}), in whichever
   * language was active then, and a reader who switches language afterwards
   * must not be asked to confirm overwriting a program that is still exactly
   * the one the game put there — only in a language it no longer shows.
   * {@link translateIn} renders a locale that has not loaded as English rather
   * than throwing, so a language fetched later than this check costs nothing
   * beyond comparing against English twice.
   *
   * Asked of the editor rather than of the store this class also holds, because
   * the program at risk is the editor's: it keeps its own copy of every key it
   * has written this page and reads that first, so against a full quota — or in
   * the private windows that hand out a `Storage` and refuse every write — the
   * player's program is in the editor and the store says they never wrote one.
   * Reading the store directly answered "nothing of theirs here" in exactly the
   * case where the copy about to be overwritten is the only one left.
   *
   * @returns Whether the player's own buffer holds a program of theirs.
   */
  playerCodeWouldBeReplaced(): boolean {
    const stored = this.#editor.readPlayerCode();
    if (stored === null || stored.trim() === "") {
      return false;
    }
    const trimmed = stored.trim();
    return !LOCALES.some(
      (locale) => trimmed === translateIn(locale, "editor.defaultCode.code").trim(),
    );
  }

  /**
   * Copies the program now in the editor into the player's own buffer.
   *
   * Written to the player's key rather than by switching buffers, which is what
   * keeps the player on the task. The button means "I want to keep this", not
   * "I am done here": somebody who takes the answer to task 6 usually wants to
   * go on reading task 6. The copy is waiting for them under the game's own
   * editor whenever they leave, because challenge 1's first slot is the buffer
   * {@link leaveTutorial} always opens.
   *
   * Through {@link CodeEditor.writePlayerCode} rather than into `#storage` here,
   * even though this class holds the same store: the editor reads its own copy
   * of a key before the store's, so a write from outside it is a copy the editor
   * does not have and will overwrite. See that method.
   *
   * Throws nothing when the store refuses the write, for the reason every other
   * write in this class swallows its own: the run the player is in is what
   * matters, and it does not depend on this. The refusal is not swallowed
   * though — it is the return value, and the panel is what tells them either
   * way. That is the whole point of the boolean; a caller that drops it turns
   * the button into one that silently does nothing when the store throws. Which
   * it does on a full quota, and in the private-browsing modes that hand out a
   * `Storage` object and refuse every write to it. Storage being *switched off*
   * is not on the list: `src/main.ts` reads `localStorage` bare, so a browser
   * that throws on the property has already stopped the game from starting, and
   * there is no button to press.
   *
   * @returns Whether the program was stored.
   */
  takeTutorialCode(): boolean {
    return this.#editor.writePlayerCode(this.#editor.getCode());
  }

  /**
   * Leaves the learning track for the numbered challenges.
   *
   * Challenge one and not `currentChallengeIndex`, which is where a player who
   * came to the track from challenge 12 would be sent back to. The track is what
   * somebody plays before they have a challenge to go back to, so the useful
   * exit is the beginning of the game; a player who did arrive from challenge 12
   * has that address in their history and in the navigation row.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  leaveTutorial(autoStart = false): void {
    this.startChallenge(0, autoStart);
  }

  /**
   * Builds a world for a challenge, draws it, and hands it to the controller.
   *
   * @param challenge - What to play: one of {@link challenges}, or the sandbox
   * challenge the URL just described.
   * @param challengeIndex - Its index in {@link challenges}, or `null` for the
   * sandbox, which is not in the list and so is neither numbered in the bar nor
   * marked in the navigation row nor followed by a "next challenge" link.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @param instant - Whether to drive this run headlessly, through
   * {@link driveInstantly}, instead of drawing it and driving it from
   * animation frames. See {@link runInstantly}.
   */
  #startRun(
    challenge: Challenge,
    challengeIndex: number | null,
    autoStart: boolean,
    instant = false,
  ): void {
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
    // A task's own seed wins over the URL's, and it is the one seed in the game
    // the player cannot override. That is what `TutorialTask.seed` is for: the
    // lesson is "this program loses and that one wins", which is a statement
    // about a particular stream of passengers, and a random draw would make it a
    // coin flip. The router already refuses `seed` on a task address, so the two
    // can disagree only when a task is started from inside the app while the URL
    // still carries the seed of the challenge just left -- and then it is the
    // leftover that has to lose.
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
      challenge.options,
      this.#tutorial?.task.seed ?? this.#seed ?? readStoredSeed(this.#storage) ?? undefined,
    );
    this.world = world;
    window.world = world;
    const seed = this.#seedLink(world, challengeIndex);
    if (seed !== null) {
      // Written back on every start, drawn seeds included: the fallback above is
      // only worth anything if the seed a player ends up with becomes the seed
      // they keep, and the overwhelmingly common way to end up with one is to
      // have been given it. `#seedLink` is `null` for exactly the run whose seed
      // is not the player's -- a task of the learning track -- so the one seed
      // that must not be remembered is the one this cannot see.
      this.#storeSeed(seed.seed);
      // Printed at every start, because nobody knows a run is worth repeating
      // until it has already gone wrong -- by which time the only record of what
      // it was is this line.
      console.log(t("game.seed.console", { seed: seed.seed, url: absoluteUrl(seed.url) }));
    }

    // All three of these regions can hold the focused element when a challenge
    // starts: the "Next level" link lives in the feedback overlay, the call
    // and in-car buttons live in the building, and the learning track's panel
    // has the button that leaves the track. Emptying them deletes it, and focus
    // falls back to <body> -- so a keyboard or screen-reader player who takes
    // the offered link, or who presses "leave", is dropped at the top of the
    // page instead of arriving at the challenge they just asked for. Asked
    // before the teardown, because afterwards there is nothing left to ask
    // about.
    //
    // The panel is the odd one of the three: it is not emptied here but at the
    // end of `#drawChallengeBar`. One question covers all three because it is
    // asked of all three up front, and answered at the very end of this method
    // -- by which time every region that could have held the focus is gone,
    // whichever of them did.
    const focusWasDestroyed = containsFocus([
      this.#elements.world,
      this.#elements.feedback,
      this.#elements.tutorial,
    ]);
    clearAll([this.#elements.world, this.#elements.feedback]);
    this.#run = { challenge, challengeIndex };
    this.#outcome = undefined;
    this.#statsPanel = presentStatsPanel(this.#elements.stats, world);
    this.#goalBar = presentGoalBar(this.#elements.goalBar, world, {
      challenge,
      getVerdict: () => challenge.condition.evaluate(world),
    });
    this.#drawChallengeBar();
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
      const conditionStatus = challenge.condition.evaluate(world);
      // A crunch's own ceiling, folded into the same verdict a normal run
      // reaches: past `INSTANT_RUN_MAX_SIMULATED_SECONDS` of simulated time
      // with the challenge's own condition still undecided, this stops
      // waiting for one and calls it a loss -- `false`, not a third outcome,
      // because the task is exactly the same one every other failure already
      // shows. Only a crunch is bounded this way; an animated run is bounded
      // by the player's own patience instead, same as it always was.
      const challengeStatus =
        conditionStatus ??
        (instant && world.elapsedTime >= INSTANT_RUN_MAX_SIMULATED_SECONDS ? false : null);
      if (challengeStatus === null) {
        return;
      }
      world.challengeEnded = true;
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
      // task ids, so a redraw would re-add an id that is already in it -- and
      // that is exactly why the rule is worth writing down rather than leaving
      // to the type it happens to be stored in. The day progress records
      // anything a repeat would change, an attempt count, a first-cleared
      // timestamp, a language switch would quietly start writing it, and the
      // drawing path is the last place anybody would think to look. Drawing
      // stays drawing.
      const tutorial = this.#tutorial;
      if (challengeStatus && tutorial !== undefined) {
        recordClearedTutorialTask(this.#storage, tutorial.task.id);
        // The one moment the panel has to be redrawn without a run starting or a
        // language changing: the count it prints has just gone up, and the
        // player is looking at the panel while the success overlay tells them
        // so. Without this line the panel would still say "0 of 8 tasks done"
        // under an overlay congratulating them on the first. Drawn from the
        // store, like every other draw of it, so the line and the record cannot
        // disagree.
        this.#drawTutorialPanel();
      } else if (challengeStatus && challengeIndex !== null) {
        // `true`, not `challengeStatus`: a tier is only ever asked for on a win,
        // and `evaluateChallengeTier` returns `null` for anything else, which
        // would make the field below need a guard this branch already is one.
        const tier = evaluateChallengeTier(true, world, challenge.tiers);
        if (tier !== null) {
          recordChallengeTier(this.#storage, challengeIndex, tier);
          // The one place the switcher has to be redrawn between two runs
          // rather than by the next one's own `#drawChallengeBar`: the tile
          // just earned or improved a tier, and the player may open the
          // popover before starting anything else.
          this.#levelSwitcher.update();
        }
      }
      this.#showOutcome(challengeStatus);
    });

    const codeObj = this.#editor.getCodeObj();
    if (instant) {
      // The constructor's `usercode_error` subscription is bound to
      // `this.worldController`, the shared controller -- a crunch's private one
      // raises nothing on it, so it is wired here instead, through
      // `onController` rather than off the handle `driveInstantly` returns.
      // That distinction matters for a program whose `init` throws on the very
      // first tick: a challenge that small can run to a verdict, error and all,
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
      // a small challenge can run to a verdict, or a program can throw on its
      // very first tick, entirely inside `driveInstantly` above, before it
      // returns here -- and the handlers above have already cleared
      // `#instantRunHandle` by the time this line would otherwise overwrite it
      // with a handle for a run that is already over.
      if (!world.challengeEnded && !handle.controller.isPaused) {
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
    // finished challenge would have announced "Start" and then silently become
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
  #drawChallengeBar(): void {
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
   * Draws the learning track's panel, or empties its region when what is on
   * screen is not a task.
   *
   * Hung off the end of {@link #drawChallengeBar} rather than given call sites
   * of its own, because that method's two callers are exactly the two moments
   * the panel has to be drawn again: the start of a run, which is the only
   * thing that can change which task is on screen, and a language change, which
   * has to reach every word on the page — and the panel is most of the words on
   * it. The alternative, calling this from both places, is two call sites to
   * keep in step and a third to forget when a third caller appears. It runs
   * after the bar so that the page is written in the order it is read.
   *
   * Emptying is not an afterthought but the common case: nineteen challenges
   * and the sandbox all reach here, and every one of them has to leave
   * the region empty, since the stylesheet hides it only while it is. Leaving
   * the last task's hints above challenge 1 would be worse than a gap — they
   * are the answer to a task the player is no longer playing.
   *
   * The panel has no button of its own for starting the task again, though it
   * had one until the run controls were gathered into a row: "Start over" in the
   * panel and "Start over" in `.controls` are two buttons with the same
   * accessible name, on screen together on every task, and the panel's one did
   * not auto-start where the row's does. Two buttons that say the same thing
   * must not do different things (WCAG 3.2.4), and the row is directly under the
   * panel, so the one that stayed is the one a player can find from anywhere in
   * the game rather than only on the track.
   *
   * The two callbacks that are left are closures over this object rather than
   * public methods for the panel to call, so that the panel needs to know
   * nothing about how leaving the track or copying a program is carried out.
   *
   * The panel's `hasOwnProgram` is a function and not a boolean because it is
   * asked at the moment the player presses "take this program", not at the
   * moment the panel was drawn: a player who writes their first program during
   * task 5 would otherwise be told nothing before it was overwritten, since the
   * panel was drawn when the store was still empty.
   */
  #drawTutorialPanel(): void {
    const tutorial = this.#tutorial;
    if (tutorial === undefined) {
      clearChildren(this.#elements.tutorial);
      return;
    }
    presentTutorial(this.#elements.tutorial, {
      taskIndex: tutorial.index,
      clearedCount: this.tutorialProgress().cleared,
      hasOwnProgram: () => this.playerCodeWouldBeReplaced(),
      onTakeCode: () => this.takeTutorialCode(),
      onLeave: () => {
        this.leaveTutorial();
      },
    });
  }

  /**
   * Draws the end-of-challenge card, and remembers that it is showing.
   *
   * The outcome is the thing worth remembering; the four strings are worked out
   * from it here, every time, so that {@link relocalise} can draw the same
   * verdict again in another language. The presenter replaces the container's
   * contents rather than appending, so calling this twice about one run leaves
   * one card.
   *
   * @param won - Whether the challenge's condition was met.
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
    const challengeIndex = run?.challengeIndex ?? null;
    // Recomputed from the world rather than carried from the `stats_changed`
    // handler that first recorded it: the tier is a pure function of the
    // world's own final figures, which do not move once `challengeEnded` is
    // set, so asking again here is what lets `relocalise` draw the same badge
    // in another language without a field of its own to keep in step.
    const tier =
      won && challengeIndex !== null && run !== undefined && world !== undefined
        ? (evaluateChallengeTier(true, world, run.challenge.tiers) ?? undefined)
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
          ? nextTierHint(run.challenge.tiers, tier, world)
          : "",
      // No link after a failure, none after the last challenge, and none for the
      // sandbox, which cannot get here at all: its condition never resolves. The
      // seed is dropped for the same reason the navigation row drops it: it
      // belongs to the building just completed, not to the next one.
      url:
        won && challengeIndex !== null && challengeIndex + 1 < this.challenges.length
          ? createParamsUrl(this.#query, { challenge: challengeIndex + 2, seed: null })
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
   *   track's panel are rebuilt from scratch by {@link #drawChallengeBar},
   *   which is cheap and correct: none of the four subscribe to the world.
   * - The statistics panel's own `update()` relabels its captions the same
   *   way; its *figures* go through `Intl` and are left alone, since they are
   *   numbers rather than words and the next tick redraws them anyway.
   * - The end-of-challenge overlay is drawn again from the remembered outcome,
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
    // on screen from the first paint, before any challenge has started, so
    // they have words to rewrite even when there is no world to redraw around
    // them.
    this.#controls.update();
    this.#editorPane.update();
    const world = this.world;
    if (world !== undefined) {
      this.#drawChallengeBar();
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
   * Draws the end-of-run overlay for a task of the learning track.
   *
   * A task ends in one of three ways and the game already had words for only one
   * of them. A loss is an ordinary loss and says so: the program did not clear
   * the bar, which on the track is the *expected* first outcome, so nothing here
   * treats it as special or offers a way onwards — the player is meant to go
   * back to the editor, and the panel is where the hints are.
   *
   * A win in the middle of the track offers the next task. It cannot use
   * `game.feedback.next`, which the template writes into every link and which
   * says "Next level": the numbered ladder is not where task 4 lives, and a
   * player who follows a link labelled that way lands somewhere they did not ask
   * for. So the link's words are replaced after the render, the way the sandbox
   * replaces the title, and for the same reason — the template is shared and its
   * markup is not this module's to change.
   *
   * A win on the *last* task replaces the whole overlay. Task 8 is challenge 1
   * with the hints taken away, so what the player has in the editor at that
   * moment is a program that clears the first real challenge, and the only
   * useful thing to say is "take it with you". That is `tutorial.finish.*`, and
   * its link leaves the track for challenge 1 rather than offering a ninth task
   * that does not exist.
   *
   * The link takes nothing with it, and its words no longer say it does. It is
   * an ordinary route change: the editor switches to the player's own buffer on
   * the way out, so what waits on challenge 1 is the player's own program and
   * not the one that just won. The label used to read "Go to challenge 1 with
   * this program", which was a promise the route does not keep — the winning
   * program is safe under the task's own key, but the player was told it had
   * travelled with them and would have found their old program instead. Copying
   * it across from here was the other way to make the two agree, and it is the
   * wrong one: overwriting the player's program is the thing the panel's
   * `tutorial.button.takeCode` asks about first, and a link that did it silently
   * would be the one path on the track that takes a program without asking. So
   * the message names that button instead.
   *
   * Nothing is recorded here. {@link #startRun} records the clear where the
   * condition resolves, so that {@link relocalise} can call this again to redraw
   * the same verdict in another language without a language change counting as
   * a second win.
   *
   * @param tutorial - The task that just ended and where it sits in the track.
   * @param won - Whether the task's condition was met.
   */
  #showTutorialOutcome(tutorial: TutorialRun, won: boolean): void {
    const isLastTask = tutorial.index + 1 >= tutorialTasks.length;
    const nextTask = tutorialTasks[tutorial.index + 1];
    const finished = won && isLastTask;
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
      // Nothing to be short of: a task carries no `challenge.tiers` for the
      // hint to name a next bar out of, the same reason `tier` below is
      // `undefined`.
      hint: "",
      // The seed is dropped from both, as it is from every link the app builds:
      // it belongs to the run just finished. On the way to challenge 1 that is
      // also what keeps the link usable at all -- the router refuses a seed on a
      // task address and would refuse this one on arrival if it survived.
      url: finished
        ? createParamsUrl(this.#query, { challenge: 1, seed: null })
        : won && nextTask !== undefined
          ? createParamsUrl(this.#query, { challenge: nextTask.id, seed: null })
          : "",
      // A task's win has no tier -- tiers rank a numbered challenge's run
      // against `challenge.tiers`, which tasks on the learning track do not
      // carry. See {@link #showOutcome} for the numbered-challenge case.
      tier: undefined,
    });
    if (won) {
      this.#relabelFeedbackLink(
        finished ? t("tutorial.finish.toChallenges") : t("tutorial.finish.nextTask"),
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
