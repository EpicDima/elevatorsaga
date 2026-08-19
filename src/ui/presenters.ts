/**
 * The presenters: everything that turns simulation state into DOM.
 *
 * Ported from the legacy `presenters.js`. The structure is unchanged — one
 * function per region of the page, each subscribing to the simulation objects it
 * draws — but jQuery, `riot.render` and the Font Awesome webfont are gone, and
 * every interactive control is a real `<button>`.
 *
 * Lifetime: presenters do not need to be torn down. Subscriptions are made on
 * the world and on objects the world owns, and `World.unWind()` drops all of
 * them when a challenge ends; the DOM they wrote is replaced wholesale when the
 * next challenge starts.
 */

import type { WorldController } from "../game/world-controller.ts";
import {
  controlsTemplate,
  elevatorFloorButtonLabel,
  elevatorLabel,
  floorCallDownLabel,
  floorCallUpLabel,
} from "./templates.ts";
import { presentSpeedStepper } from "#features/adjust-speed/index.ts";
import { presentRunControls } from "#features/run-simulation/index.ts";
import { clearChildren, queryAll, requireElement } from "#shared/lib/dom.ts";

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
  /** Called when the start/pause/restart button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
  /**
   * Whether a headless crunch, started by "Run instantly", is under way.
   *
   * A function for the same reason {@link challengeEnded} is one: this row is
   * drawn once and outlives every run, including the private controller a
   * crunch drives itself with.
   */
  readonly instantRunInProgress: () => boolean;
  /** Called when "Run instantly" is pressed. */
  readonly onRunInstant: () => void;
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
   * going anyway. This row is the one place on the page that survives every
   * redraw, which is what makes it the place to land.
   */
  focusStartStop(): void;
}

/**
 * Draws the run controls and wires them up.
 *
 * Called once, from the app's constructor, and never again — see
 * {@link "./templates.ts"!controlsTemplate} for why the row is not rebuilt with
 * the challenge bar. That is what makes {@link ControlsPresenter.update} the
 * whole of the redraw: there is no markup to carry focus or disclosure state
 * across, because the markup never goes away.
 *
 * A language change needs no more than another {@link ControlsPresenter.update}:
 * every word this row shows is written there, from the catalogue, at the moment
 * it is written.
 *
 * The four run buttons plus "Run instantly" are drawn and driven by
 * `#features/run-simulation`'s `presentRunControls`; the speed stepper by
 * `#features/adjust-speed`'s `presentSpeedStepper`. This function composes
 * the two. The composed pair keeps the app talking to one region and one
 * contract, the way it always has.
 *
 * @param parent - The `.controls` element.
 * @param options - The controller to report on and the callbacks for the six
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
    onStartStop: () => {
      options.onStartStop();
    },
    onStartOver: () => {
      options.onStartOver();
    },
    instantRunInProgress: () => options.instantRunInProgress(),
    onRunInstant: () => {
      options.onRunInstant();
    },
  });

  const speedStepper = presentSpeedStepper(parent, {
    worldController: options.worldController,
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
 * which is the defect {@link "../app/app.ts"!App}'s constructor comment
 * describes from the legacy code. The alternative, starting the run again so
 * it is drawn from scratch, is worse still: it throws away the run the player
 * is in the middle of because they changed a language.
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
 * `presenters.test.ts` holds this against `entities/floor`'s and
 * `entities/elevator`'s own markup rather than leaving it to this comment.
 *
 * @param parent - The `.innerworld` element the building was drawn into.
 */
export function relabelWorld(parent: HTMLElement): void {
  for (const [level, floor] of queryAll(FLOOR_SELECTOR, parent).entries()) {
    requireElement(CALL_UP_SELECTOR, floor).setAttribute("aria-label", floorCallUpLabel(level));
    requireElement(CALL_DOWN_SELECTOR, floor).setAttribute("aria-label", floorCallDownLabel(level));
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
