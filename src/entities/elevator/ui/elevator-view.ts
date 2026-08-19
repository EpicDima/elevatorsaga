/**
 * An elevator car's DOM element, positioned and sized from the responsive
 * building's own geometry rather than the fixed pixel grid
 * `src/ui/presenters.ts` draws.
 *
 * Built for widget 6b ("Building/stage rendering + hover cards"). The
 * direction indicators, floor indicator, and in-car buttons are wired exactly
 * as `presentElevator` wires them in `src/ui/presenters.ts`; the position
 * wiring is new. The legacy view writes `elevator.worldX`/`worldY` straight
 * into a `translate3d` on every `new_display_state`; this one multiplies by
 * {@link StageScale}'s current `scaleX`/`scaleY` first, reading the scale
 * fresh on every tick rather than caching it, so a `widgets/building-stage`
 * resize takes effect on the car's very next frame without this view having
 * to know a resize happened.
 *
 * {@link ElevatorView.setGeometry} is separate from that per-tick position
 * update: width and height only change on the widget's much rarer geometry
 * recompute, not every tick, so they are pushed explicitly rather than read
 * off the shared scale cell.
 */

import type { Elevator } from "#game/elevator.ts";
import { queryAll, requireElement, setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { iconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { elevatorFloorButtonLabel, elevatorLabel } from "../../../ui/templates.ts";

/** Selector for one in-car floor button. */
const FLOOR_BUTTON_SELECTOR = ".buttonpress";

/**
 * One elevator car.
 *
 * @param width - Car width in pixels, derived from its capacity.
 * @param index - Zero-based index of the car, used for its accessible name.
 * @returns The elevator markup.
 */
export function elevatorTemplate(width: number, index: number): string {
  return markup`<div class="elevator movable" style="width: ${width}px" role="group" aria-label="${elevatorLabel(index)}"><span class="directionindicator directionindicatorup">${raw(iconMarkup("arrow-circle-up", "up activated"))}</span><span class="floorindicator"><span></span></span><span class="directionindicator directionindicatordown">${raw(iconMarkup("arrow-circle-down", "down activated"))}</span><span class="buttonindicator"></span></div>`;
}

/**
 * One in-car floor button.
 *
 * These sit flush against each other inside `.buttonindicator`, so the template
 * must not introduce any surrounding whitespace.
 *
 * @param floorNum - Floor the button requests.
 * @returns The button markup.
 */
export function elevatorButtonTemplate(floorNum: number): string {
  return markup`<button type="button" class="buttonpress" aria-pressed="false" aria-label="${elevatorFloorButtonLabel(floorNum)}">${floorNum}</button>`;
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

/** A mounted elevator car: its element, and the two things about it that change after creation. */
export interface ElevatorView {
  /** The car's element, unparented until the caller appends it. */
  readonly element: HTMLElement;
  /**
   * Resizes the car.
   *
   * @param widthPx - The car's width, in pixels (`elevator.width * scaleX`).
   * @param heightPx - The car's height, in pixels (`layoutBuilding()`'s `carHeight`).
   */
  setGeometry(widthPx: number, heightPx: number): void;
}

/**
 * Builds an elevator car's view and wires it to the simulation.
 *
 * @param elevator - The elevator to present.
 * @param index - Zero-based index of the car, for its accessible name.
 * @param scale - The stage's current scale, read fresh on every position update.
 * @returns The mounted view.
 */
export function createElevatorView(
  elevator: Elevator,
  index: number,
  scale: StageScale,
): ElevatorView {
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
    setTransformPos(element, elevator.worldX * scale.scaleX, elevator.worldY * scale.scaleY);
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

  return {
    element,
    setGeometry(widthPx: number, heightPx: number): void {
      element.style.width = `${String(widthPx)}px`;
      element.style.height = `${String(heightPx)}px`;
    },
  };
}
