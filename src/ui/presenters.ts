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

import type { Elevator } from "../game/elevator.ts";
import type { Floor } from "../game/floor.ts";
import type { User } from "../game/user.ts";
import type { World } from "../game/world.ts";
import type { WorldController } from "../game/world-controller.ts";
import { decimal, format, percent, quantity, seconds, t } from "../i18n/index.ts";
import {
  clearChildren,
  query,
  queryAll,
  requireElement,
  setClass,
  setTransformPos,
} from "./dom.ts";
import { createIcon } from "./icons.ts";
import {
  challengeTemplate,
  codeStatusTemplate,
  controlsTemplate,
  elevatorButtonTemplate,
  elevatorFloorButtonLabel,
  elevatorLabel,
  elevatorTemplate,
  feedbackTemplate,
  floorCallDownLabel,
  floorCallUpLabel,
  floorTemplate,
  renderElement,
  userTemplate,
} from "./templates.ts";
import type { ChallengeLinkData, SeedLinkData, UserDisplayType } from "./templates.ts";

/** Class on `<html>` that hides everything except the world. */
export const FULLSCREEN_CLASS = "fullscreen-demo";

/** Selector matching the links of the challenge bar's navigation row. */
const CHALLENGE_LINK_SELECTOR = ".challengelink";

/**
 * Selector matching the controls of the challenge bar's seed line.
 *
 * Written as "whatever the line offers" rather than by class, because what it
 * offers changes with the run: the seed's own link while the run can still be
 * pinned, `new draw` in its place once it is, and the disclosure that explains
 * what a seed does either way.
 */
const SEED_CONTROL_SELECTOR = ".challengeseed a, .challengeseed summary";

/** Selector matching the seed line's disclosure. */
const SEED_HELP_SELECTOR = ".seedhelp";

/**
 * Selectors for the parts of a drawn building.
 *
 * Constants rather than literals because two functions now look for the same
 * elements: {@link presentWorld} draws them and {@link relabelWorld} finds them
 * again to rename them. A class renamed in the template and in one of the two
 * would leave the building silently unrenameable, which is the quietest possible
 * failure — the labels are invisible to everyone who is not using a screen
 * reader.
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
 * Reflects a lit/unlit button state in both the class and the ARIA state.
 *
 * @param button - The call or floor button.
 * @param activated - Whether the button is currently lit.
 */
function setActivated(button: Element, activated: boolean): void {
  setClass(button, "activated", activated);
  button.setAttribute("aria-pressed", String(activated));
}

/**
 * Parses the markup for one passenger into its element.
 *
 * @param displayType - Which person icon to draw.
 * @param leaving - Whether the passenger has already been delivered.
 * @returns The passenger element.
 */
function renderUser(displayType: UserDisplayType, leaving: boolean): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = userTemplate(displayType, leaving);
  const element = template.content.firstElementChild;
  if (!(element instanceof SVGElement)) {
    throw new Error("Expected the user template to render an SVG element");
  }
  return element;
}

/**
 * How the "transported per second" figure is rounded.
 *
 * Three significant digits, which is what `toPrecision(3)` gave this panel
 * before and what it should keep giving: the quotient is a small fraction, and
 * three digits of it is the difference between 0.198 and 0.2. Significant digits
 * rather than decimal places for the same reason `toPrecision` was chosen
 * originally — the figure spans two orders of magnitude over a run, and a fixed
 * three decimals reads as 0.000 for the first few seconds of one.
 *
 * `toPrecision` also switches to exponential notation once the exponent reaches
 * the precision, so 1230 came out as `1.23e+3`; `Intl` writes 1,230 instead.
 * Nothing in this game delivers a thousand passengers a second, so the
 * difference is theoretical, but the direction of it is the right one.
 */
const PER_SECOND_DIGITS: Intl.NumberFormatOptions = {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
};

/**
 * Keeps the statistics panel in sync with a world.
 *
 * Every figure goes through `Intl` rather than `toFixed` and `String`, so a
 * locale that writes decimals with a comma or groups thousands with a space
 * does. In English the digits are exactly the ones the panel has always shown,
 * with one deliberate exception: four figures and up are grouped, so a long
 * run's elapsed time reads 2,675s rather than 2675s.
 *
 * @param parent - The `.statscontainer` element.
 * @param world - The world to report on.
 */
export function presentStats(parent: HTMLElement, world: World): void {
  const transportedCounter = requireElement(".transportedcounter", parent);
  const elapsedTime = requireElement(".elapsedtime", parent);
  const transportedPerSec = requireElement(".transportedpersec", parent);
  const avgWaitTime = requireElement(".avgwaittime", parent);
  const avgPickupTime = requireElement(".avgpickuptime", parent);
  const avgRideTime = requireElement(".avgridetime", parent);
  const maxWaitTime = requireElement(".maxwaittime", parent);
  const moveCount = requireElement(".movecount", parent);
  const stopCount = requireElement(".stopcount", parent);
  const peoplePerStop = requireElement(".peopleperstop", parent);
  const avgLoadFactor = requireElement(".avgloadfactor", parent);

  world.on("stats_display_changed", () => {
    transportedCounter.textContent = format(world.transportedCounter);
    elapsedTime.textContent = format(seconds(world.elapsedTime));
    transportedPerSec.textContent = format(quantity(world.transportedPerSec, PER_SECOND_DIGITS));
    avgWaitTime.textContent = format(seconds(world.avgWaitTime, 1));
    avgPickupTime.textContent = format(seconds(world.avgPickupTime, 1));
    avgRideTime.textContent = format(seconds(world.avgRideTime, 1));
    maxWaitTime.textContent = format(seconds(world.maxWaitTime, 1));
    moveCount.textContent = format(world.moveCount);
    stopCount.textContent = format(world.stopCount);
    peoplePerStop.textContent = format(decimal(world.avgPeoplePerStop, 2));
    avgLoadFactor.textContent = format(percent(world.avgLoadFactorOnMove));
  });
  world.trigger("stats_display_changed");
}

/** What the challenge bar needs in order to draw and drive itself. */
export interface ChallengePresenterOptions {
  /** One-based challenge number. */
  readonly challengeNum: number;
  /** The challenge requirement; contains markup from `src/game/challenges.ts`. */
  readonly description: string;
  /**
   * One entry per challenge for the navigation row, in playing order.
   *
   * Built by the app, which is where the current URL parameters live: every
   * entry has to keep them, so that jumping to a challenge does not silently
   * throw away the speed or the autostart the player arrived with.
   */
  readonly challengeLinks: readonly ChallengeLinkData[];
  /**
   * The seed of the run in progress, or `null` when there is none to show.
   *
   * Built by the app for the same reason the navigation row is: the URL it links
   * to is the current one with `seed` written into it, and only the app knows
   * what the current one is.
   */
  readonly seed: SeedLinkData | null;
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
   * Whether there is a reset "Undo reset" could take back.
   *
   * Not "whether there is a program in the backup slot": see
   * {@link "./editor.ts"!CodeEditor.canUndoReset}, where the difference is the
   * difference between a button that recovers work and one that destroys it.
   */
  readonly canUndoReset: () => boolean;
  /** Called when the start/pause/restart button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
  /** Called when "Reset code" is pressed. */
  readonly onResetCode: () => void;
  /** Called when "Undo reset" is pressed. */
  readonly onUndoReset: () => void;
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
   * Relabels the start button, the speed and the visibility of "Undo reset".
   *
   * Everything this touches is state the row reports rather than owns, so it is
   * called after anything that could have moved any of it: a pause, a speed
   * change, the end of a run, a reset, a language change — and an edit, which
   * is the one that is easy to leave out. `canUndoReset` answers for the
   * program on screen, so typing moves it as surely as pressing Reset does, and
   * a row that is only refreshed by the run controls' own events would go on
   * offering to undo a reset the player has already typed over.
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

  const startStop = requireElement(".startstop", parent);
  const startOver = requireElement(".startover", parent);
  const resetCode = requireElement(".resetcode", parent);
  const undoReset = requireElement(".undoreset", parent);
  const runInstant = requireElement(".runinstant", parent);
  const timeScaleValue = requireElement(".timescale_value", parent);
  const timeScaleDecrease = requireElement(".timescale_decrease", parent);
  const timeScaleIncrease = requireElement(".timescale_increase", parent);

  startStop.addEventListener("click", () => {
    options.onStartStop();
  });
  startOver.addEventListener("click", () => {
    options.onStartOver();
  });
  resetCode.addEventListener("click", () => {
    options.onResetCode();
  });
  undoReset.addEventListener("click", () => {
    options.onUndoReset();
  });
  runInstant.addEventListener("click", () => {
    options.onRunInstant();
  });
  timeScaleDecrease.addEventListener("click", () => {
    options.onTimeScaleDecrease();
  });
  timeScaleIncrease.addEventListener("click", () => {
    options.onTimeScaleIncrease();
  });

  const presenter: ControlsPresenter = {
    update(): void {
      timeScaleValue.textContent = formatTimeScale(options.worldController.timeScale);
      timeScaleDecrease.setAttribute("aria-label", t("game.timeScale.decrease"));
      timeScaleIncrease.setAttribute("aria-label", t("game.timeScale.increase"));
      startOver.textContent = t("game.button.startOver");
      resetCode.textContent = t("game.button.resetCode");
      undoReset.textContent = t("game.button.undoResetCode");
      if (options.challengeEnded()) {
        // The space belongs to this line rather than to the message: it is the
        // gap between the icon and the word, which every language needs and no
        // translator should have to remember to type.
        startStop.replaceChildren(createIcon("repeat"), ` ${t("game.button.restart")}`);
      } else {
        startStop.textContent = options.worldController.isPaused
          ? t("game.button.start")
          : t("game.button.pause");
      }
      // Hidden rather than disabled: there is nothing to explain to a player
      // who has not reset anything, and a disabled control they can neither
      // press nor tab to is a worse answer than one that is not there. It
      // appears the moment a reset gives it something to do.
      undoReset.hidden = !options.canUndoReset();
      // Disabled rather than hidden, unlike "Undo reset" above: a crunch is
      // ordinarily too quick to ever be seen in this state, so a player who
      // does see it pressed the button and wants to know it was heard, not to
      // have it vanish out from under the pointer.
      const inProgress = options.instantRunInProgress();
      runInstant.textContent = inProgress
        ? t("game.button.runningInstantly")
        : t("game.button.runInstant");
      runInstant.toggleAttribute("disabled", inProgress);
    },

    focusStartStop(): void {
      startStop.focus();
    },
  };
  // Before anything can take focus, so that a screen reader announces "Start"
  // rather than an unnamed button.
  presenter.update();
  return presenter;
}

/**
 * Renders a time scale the way the run controls show it.
 *
 * The legacy `timeScale.toFixed(0) + "x"` was fine for the whole numbers the
 * buttons produce and a lie for anything else: `#timescale=0.5` read `1x`, and
 * `#timescale=0.1` read `0x`, which says the simulation is stopped when it is
 * running at a tenth speed. Whole speeds still render as `1x` and `40x` — not
 * `1.0x` — and fractional ones render as themselves.
 *
 * The multiplication sign is part of the message rather than appended here,
 * because it is not the same character everywhere: English writes the `x` this
 * game has always written, and Russian typography wants `×`.
 *
 * @param timeScale - The multiplier the simulation is running at.
 * @returns The label, e.g. `"2x"`, `"0.25x"`, or `"0,25×"` in Russian.
 */
export function formatTimeScale(timeScale: number): string {
  // Rounding first keeps float noise (0.1 + 0.2 and friends) out of the label.
  // `Intl` then prints the result without padding whole numbers with a decimal
  // point the way toFixed does, since it is given no minimum fraction digits.
  return t("game.timeScale.value", { value: Math.round(timeScale * 1000) / 1000 });
}

/**
 * Draws the challenge bar.
 *
 * The legacy version re-rendered the whole bar — and re-bound all three click
 * handlers — on every `timescale_changed` event. The speed and the start button
 * have their own region now ({@link presentControls}), which is drawn once and
 * never rebuilt, so a speed change touches no markup here at all; the bar itself
 * is built once per challenge.
 *
 * Nothing is returned: everything the bar shows is settled by the time it is
 * drawn, and the one thing about it that changes during a run — the start
 * button — moved out to {@link presentControls}, which is what has an `update`.
 *
 * @param parent - The `.challenge` element.
 * @param options - The challenge number, the requirement, the navigation row and
 * the seed line.
 */
export function presentChallenge(parent: HTMLElement, options: ChallengePresenterOptions): void {
  // A rebuild of this bar destroys whatever inside it had focus, and following
  // any of its links rebuilds it: each changes the hash, which restarts the run.
  // So the two things a player can be standing on here are restored by position
  // below. What is no longer restored here is the start button, which used to be
  // the fallback for everything else: it is in the controls row now, which
  // survives every rebuild, so the button a player pressed is still under them
  // afterwards and there is nothing to put back.
  //
  // Taking a link out of the navigation row destroys the focused element, and
  // the start button was the wrong landing place for that even when it was
  // here: a player working through the row with the keyboard has to be able to
  // carry on down it. The row is rebuilt entry for entry, so the entry that
  // replaces the one that was pressed is the one in the same position — which is
  // also the one now marked as current.
  const focusedLinkIndex = queryAll(CHALLENGE_LINK_SELECTOR, parent).findIndex(
    (link) => link === document.activeElement,
  );

  // The seed line is the one other thing in the bar a player can be standing on
  // when it rebuilds, and following either of its links *always* rebuilds: both
  // change the hash, which restarts the run. It is not in the row, so it needs
  // asking about separately.
  //
  // Restored by position, like the row and for the same reason: the link that
  // replaces the one that was followed is not the same link. Pinning a run
  // turns the seed's link into "new draw", and taking the pin back out turns it
  // back, so the control that lands where the player was standing is the one
  // they should still be standing on. The line's disclosure is in the same list
  // -- it starts no run itself, but a rebuild started from anywhere else deletes
  // it just as thoroughly while a player is reading it.
  const focusedSeedIndex = queryAll(SEED_CONTROL_SELECTOR, parent).findIndex(
    (control) => control === document.activeElement,
  );

  // Whether the caveat about what a seed does was open. It is markup like the
  // rest of the bar, so a rebuild would otherwise close it -- and every restart
  // rebuilds, which would mean a player who wanted the explanation in front of
  // them while they tried the thing it explains could not keep it there. `open`
  // is the state of a disclosure, not the state of the run, so it is carried
  // across by hand; nothing else in the bar has any state to lose.
  const openedHelp = query(SEED_HELP_SELECTOR, parent);
  const helpWasOpen = openedHelp instanceof HTMLDetailsElement && openedHelp.open;

  parent.innerHTML = challengeTemplate({
    num: options.challengeNum,
    description: options.description,
    links: options.challengeLinks,
    seed: options.seed,
  });

  const rebuiltHelp = query(SEED_HELP_SELECTOR, parent);
  if (helpWasOpen && rebuiltHelp instanceof HTMLDetailsElement) {
    rebuiltHelp.open = true;
  }

  const focusedLink = queryAll(CHALLENGE_LINK_SELECTOR, parent)[focusedLinkIndex];
  const focusedSeedControl = queryAll(SEED_CONTROL_SELECTOR, parent)[focusedSeedIndex];
  if (focusedLink !== undefined) {
    focusedLink.focus();
  } else if (focusedSeedControl !== undefined) {
    focusedSeedControl.focus();
  }
}

/** What the end-of-challenge overlay says. */
export interface FeedbackData {
  /** Headline, e.g. `"Success!"`. */
  readonly title: string;
  /** Explanatory line under the headline. */
  readonly message: string;
  /** Link to the next challenge, or `""` for no link. */
  readonly url: string;
}

/**
 * Draws the overlay shown when a challenge is won or lost.
 *
 * @param parent - The `.feedbackcontainer` element.
 * @param data - Headline, message and next-challenge link.
 */
export function presentFeedback(parent: HTMLElement, data: FeedbackData): void {
  parent.replaceChildren(renderElement(feedbackTemplate(data)));
}

/**
 * Draws one floor and wires its call buttons to the simulation.
 *
 * @param floor - The floor to draw.
 * @returns The floor element.
 */
function presentFloor(floor: Floor): HTMLElement {
  const element = renderElement(floorTemplate(floor.level, floor.yPosition));
  const up = requireElement(CALL_UP_SELECTOR, element);
  const down = requireElement(CALL_DOWN_SELECTOR, element);

  floor.on("buttonstate_change", (buttonStates) => {
    setActivated(up, buttonStates.up !== "");
    setActivated(down, buttonStates.down !== "");
  });
  up.addEventListener("click", () => {
    floor.pressUpButton();
  });
  down.addEventListener("click", () => {
    floor.pressDownButton();
  });
  return element;
}

/**
 * Draws one elevator and wires its in-car buttons to the simulation.
 *
 * @param elevator - The elevator to draw.
 * @param index - Zero-based index of the car, used for its accessible name.
 * @returns The elevator element.
 */
function presentElevator(elevator: Elevator, index: number): HTMLElement {
  const element = renderElement(elevatorTemplate(elevator.width, index));
  const buttonIndicator = requireElement(".buttonindicator", element);
  buttonIndicator.append(
    ...elevator.buttonStates.map((_unused, floorNum) =>
      renderElement(elevatorButtonTemplate(floorNum)),
    ),
  );
  const buttons = queryAll(FLOOR_BUTTON_SELECTOR, buttonIndicator);
  const floorIndicator = requireElement(".floorindicator > span", element);
  const upIndicator = requireElement(".directionindicatorup .up", element);
  const downIndicator = requireElement(".directionindicatordown .down", element);

  for (const [floorNum, button] of buttons.entries()) {
    button.addEventListener("click", () => {
      elevator.pressFloorButton(floorNum);
    });
  }
  elevator.on("new_display_state", () => {
    setTransformPos(element, elevator.worldX, elevator.worldY);
  });
  elevator.on("new_current_floor", (floorNum) => {
    floorIndicator.textContent = String(floorNum);
  });
  elevator.on("floor_buttons_changed", (states, indexChanged) => {
    const button = buttons[indexChanged];
    if (button !== undefined) {
      setActivated(button, states[indexChanged] === true);
    }
  });
  elevator.on("indicatorstate_change", (indicatorStates) => {
    setClass(upIndicator, "activated", indicatorStates.up);
    setClass(downIndicator, "activated", indicatorStates.down);
  });

  elevator.trigger("new_state", elevator);
  elevator.trigger("new_display_state", elevator);
  elevator.trigger("new_current_floor", elevator.currentFloor);
  return element;
}

/**
 * Draws a passenger and follows them until they leave the world.
 *
 * @param parent - The `.innerworld` element.
 * @param user - The passenger to draw.
 */
function presentUser(parent: HTMLElement, user: User): void {
  const element = renderUser(user.displayType ?? "male", user.done);

  user.on("new_display_state", () => {
    setTransformPos(element, user.worldX, user.worldY);
    if (user.done) {
      element.classList.add("leaving");
    }
    // Toggled rather than added, because this one is handed on: the passenger
    // who has waited longest changes as often as the elevators reach people,
    // and the world emits this event on both of them when it does.
    setClass(element, "waiting-longest", user.waitingLongest);
  });
  user.on("removed", () => {
    element.remove();
  });
  parent.append(element);
}

/**
 * Draws a whole world: its floors, its elevators and its passengers.
 *
 * @param parent - The `.innerworld` element.
 * @param world - The world to draw.
 */
export function presentWorld(parent: HTMLElement, world: World): void {
  parent.style.height = `${String(world.floorHeight * world.floors.length)}px`;
  parent.append(...world.floors.map((floor) => presentFloor(floor)));

  // Nobody can be called further down from the bottom floor, or further up from
  // the top one. `.invisible` keeps the layout (and so the spacing of the other
  // button) exactly as it is; `disabled` keeps the hidden control off the
  // keyboard's path.
  const floorElements = queryAll(FLOOR_SELECTOR, parent);
  for (const [selector, floorElement] of [
    [CALL_DOWN_SELECTOR, floorElements.at(0)],
    [CALL_UP_SELECTOR, floorElements.at(-1)],
  ] as const) {
    if (floorElement === undefined) {
      continue;
    }
    const button = requireElement(selector, floorElement);
    button.classList.add("invisible");
    button.setAttribute("disabled", "");
  }

  parent.append(...world.elevators.map((elevator, i) => presentElevator(elevator, i)));

  world.on("new_user", (user) => {
    presentUser(parent, user);
  });
}

/**
 * Renames a building that is already drawn, in the language active now.
 *
 * The building is the one region of the page that cannot be redrawn to change
 * its language. {@link presentWorld} appends an element and subscribes to a
 * simulation object for every floor, every car and every passenger, and none of
 * that is undone until the world is torn down — so a second call would leave two
 * buildings in the page, two `buttonstate_change` handlers on every floor and
 * two of everything else, which is the defect
 * {@link "../app/app.ts"!App}'s constructor comment describes from the legacy
 * code. The alternative, starting the run again so it is drawn from scratch, is
 * worse still: it throws away the run the player is in the middle of because
 * they changed a language.
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
 * on screen. It is the same arithmetic {@link presentWorld} did: floors are
 * appended in `world.floors` order, where `createFloors` gives `floors[i]` level
 * `i`; cars in `world.elevators` order; and in-car buttons in floor order within
 * each car. `presenters.test.ts` holds the two paths to producing identical
 * markup rather than leaving that to this comment.
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

/** Matches the useless output of the default `Object.prototype.toString`. */
const GENERIC_TO_STRING = /^\[object [A-Za-z]*]$/;

/**
 * Reads a string property of a thrown value, if it has a usable one.
 *
 * @param value - The thrown value.
 * @param key - The property to read.
 * @returns The property, or `undefined` when it is missing, empty, not a
 * string, or throws from a getter.
 */
function stringProperty(value: object, key: "message" | "stack"): string | undefined {
  try {
    const property: unknown = (value as Record<string, unknown>)[key];
    return typeof property === "string" && property !== "" ? property : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Converts a thrown value with its own `toString`, if it has a useful one.
 *
 * @param value - The thrown value.
 * @returns The conversion, or `undefined` when it throws, is empty, or is the
 * `[object Object]` that `Object.prototype.toString` produces for a value with
 * nothing of its own to say.
 */
function ownStringConversion(value: unknown): string | undefined {
  let text: string;
  try {
    // A hostile — or merely broken — `toString` can throw, and so can a value
    // with a null prototype, which has no `toString` at all.
    text = String(value);
  } catch {
    return undefined;
  }
  return text === "" || GENERIC_TO_STRING.test(text) ? undefined : text;
}

/**
 * Describes a thrown object that has nothing readable to say for itself.
 *
 * @param error - The thrown object.
 * @returns Its class and, where they can be had, its contents.
 */
function describeStructure(error: object): string {
  // "[object Object]" -> "Object", "[object Array]" -> "Array".
  const kind = Object.prototype.toString.call(error).slice(8, -1);
  let json: string | undefined;
  try {
    json = JSON.stringify(error);
  } catch {
    // Circular, a BigInt, or a throwing `toJSON`.
    json = undefined;
  }
  if (json !== undefined && json !== "{}" && json !== "undefined") {
    return `${kind} ${json}`;
  }
  const keys = Object.keys(error);
  // `kind` and the key names are the player's own JavaScript, so they are
  // interpolated rather than translated; only the sentence around them changes
  // language.
  return keys.length === 0
    ? t("error.thrown.noMessage", { kind })
    : t("error.thrown.keys", { kind, keys: keys.join(", ") });
}

/**
 * Turns whatever the player's code threw into something readable.
 *
 * Player code can throw anything at all, so this degrades in stages: the stack
 * first, as the legacy banner did; then the value's own string conversion,
 * which is what the legacy banner fell back to (a thrown object reached
 * `riot.render`, which concatenated it, calling its `toString`); then a
 * `message` property; and finally a structural description. What it never
 * returns is the bare `[object Object]` that `Object.prototype.toString`
 * produces, which tells the player nothing at all about what went wrong.
 *
 * @param error - Whatever the player's code threw.
 * @returns Text describing the failure.
 */
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    // Strings, numbers, booleans, symbols, `null` and `undefined` all stringify
    // to exactly what the player threw.
    const text = String(error);
    return text === "" ? t("error.thrown.emptyString") : text;
  }
  return (
    stringProperty(error, "stack") ??
    ownStringConversion(error) ??
    stringProperty(error, "message") ??
    describeStructure(error)
  );
}

/**
 * Draws the "there is a problem with your code" banner.
 *
 * The message is player-authored: it is whatever their exception stringifies
 * to. It is therefore written with `textContent`, never as markup. The legacy
 * version replaced newlines with `<br>` and assigned the result as HTML; the
 * banner uses `white-space: pre-wrap` instead, so multi-line stacks still read
 * as multiple lines.
 *
 * Clearing the banner is {@link clearCodeStatus}, not a missing argument here:
 * `throw undefined` is something player code can do, and it has to reach the
 * banner like anything else.
 *
 * @param parent - The `.codestatus` element.
 * @param error - Whatever the player's code threw.
 */
export function presentCodeStatus(parent: HTMLElement, error: unknown): void {
  const banner = renderElement(codeStatusTemplate());
  requireElement(".errormessage", banner).textContent = describeError(error);
  parent.replaceChildren(banner);
}

/**
 * Removes the "there is a problem with your code" banner.
 *
 * @param parent - The `.codestatus` element.
 */
export function clearCodeStatus(parent: HTMLElement): void {
  clearChildren(parent);
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
