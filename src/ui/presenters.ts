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
import { clearChildren, queryAll, requireElement, setClass, setTransformPos } from "./dom.ts";
import { createIcon } from "./icons.ts";
import {
  challengeTemplate,
  codeStatusTemplate,
  elevatorButtonTemplate,
  elevatorTemplate,
  feedbackTemplate,
  floorTemplate,
  renderElement,
  userTemplate,
} from "./templates.ts";
import type { UserDisplayType } from "./templates.ts";

/** Class on `<html>` that hides everything except the world. */
export const FULLSCREEN_CLASS = "fullscreen-demo";

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
 * Keeps the statistics panel in sync with a world.
 *
 * @param parent - The `.statscontainer` element.
 * @param world - The world to report on.
 */
export function presentStats(parent: HTMLElement, world: World): void {
  const transportedCounter = requireElement(".transportedcounter", parent);
  const elapsedTime = requireElement(".elapsedtime", parent);
  const transportedPerSec = requireElement(".transportedpersec", parent);
  const avgWaitTime = requireElement(".avgwaittime", parent);
  const maxWaitTime = requireElement(".maxwaittime", parent);
  const moveCount = requireElement(".movecount", parent);

  world.on("stats_display_changed", () => {
    transportedCounter.textContent = String(world.transportedCounter);
    elapsedTime.textContent = `${world.elapsedTime.toFixed(0)}s`;
    transportedPerSec.textContent = world.transportedPerSec.toPrecision(3);
    avgWaitTime.textContent = `${world.avgWaitTime.toFixed(1)}s`;
    maxWaitTime.textContent = `${world.maxWaitTime.toFixed(1)}s`;
    moveCount.textContent = String(world.moveCount);
  });
  world.trigger("stats_display_changed");
}

/** What the challenge bar needs in order to draw and drive itself. */
export interface ChallengePresenterOptions {
  /** One-based challenge number. */
  readonly challengeNum: number;
  /** The challenge requirement; contains markup from `src/game/challenges.ts`. */
  readonly description: string;
  /** The world being played, consulted for `challengeEnded`. */
  readonly world: Pick<World, "challengeEnded">;
  /** The controller being driven, consulted for `isPaused` and `timeScale`. */
  readonly worldController: Pick<WorldController, "isPaused" | "timeScale">;
  /** Called when the start/pause/restart button is pressed. */
  readonly onStartStop: () => void;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
}

/** A rendered challenge bar. */
export interface ChallengePresenter {
  /** Redraws the parts that change: the start button label and the time scale. */
  update(): void;
}

/**
 * Draws the challenge bar and wires up its controls.
 *
 * The legacy version re-rendered the whole bar — and re-bound all three click
 * handlers — on every `timescale_changed` event. Here the bar is built once per
 * challenge and {@link ChallengePresenter.update} refreshes only the text.
 *
 * @param parent - The `.challenge` element.
 * @param options - Challenge data and the callbacks for its three buttons.
 * @returns The presenter, already drawn.
 */
export function presentChallenge(
  parent: HTMLElement,
  options: ChallengePresenterOptions,
): ChallengePresenter {
  parent.innerHTML = challengeTemplate({
    num: options.challengeNum,
    description: options.description,
  });

  const startStop = requireElement(".startstop", parent);
  const timeScaleValue = requireElement(".timescale_value", parent);

  requireElement(".timescale_decrease", parent).addEventListener("click", () => {
    options.onTimeScaleDecrease();
  });
  requireElement(".timescale_increase", parent).addEventListener("click", () => {
    options.onTimeScaleIncrease();
  });
  startStop.addEventListener("click", () => {
    options.onStartStop();
  });

  const presenter: ChallengePresenter = {
    update(): void {
      timeScaleValue.textContent = `${options.worldController.timeScale.toFixed(0)}x`;
      if (options.world.challengeEnded) {
        startStop.replaceChildren(createIcon("repeat"), " Restart");
      } else {
        startStop.textContent = options.worldController.isPaused ? "Start" : "Pause";
      }
    },
  };
  presenter.update();
  return presenter;
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
  const up = requireElement("button.up", element);
  const down = requireElement("button.down", element);

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
  const buttons = queryAll(".buttonpress", buttonIndicator);
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
  const floorElements = queryAll(".floor", parent);
  for (const [selector, floorElement] of [
    ["button.down", floorElements.at(0)],
    ["button.up", floorElements.at(-1)],
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
  return keys.length === 0
    ? `Thrown ${kind} with no message`
    : `${kind} with keys: ${keys.join(", ")}`;
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
    return text === "" ? "Thrown empty string" : text;
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
