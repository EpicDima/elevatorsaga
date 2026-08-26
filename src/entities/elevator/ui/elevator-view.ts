/**
 * One elevator: its shaft, order strip, and car. The cabin draws no riders of
 * its own; those are real `entities/passenger` elements drawn in a separate
 * layer by `widgets/building-stage`.
 */

import type { Elevator } from "#game/elevator.ts";
import { queryAll, requireElement, setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { elevatorFloorButtonLabel, elevatorLabel } from "../../../ui/templates.ts";

/** Selector for one order mark, which is also one in-car floor button. */
const FLOOR_BUTTON_SELECTOR = ".buttonpress";

/** One elevator's shaft, order strip, and car; `.shaft` is what the stylesheet paints, `.elevator` is what `relabelWorld` selects by. */
export function elevatorTemplate(index: number): string {
  return markup`<div class="shaft elevator" role="group" aria-label="${elevatorLabel(index)}"><span class="shaft-marks"></span><div class="car"><div class="car-top">${raw(spriteIconMarkup("up", "car-dir car-dir-up"))}<span class="car-floor">0</span>${raw(spriteIconMarkup("down", "car-dir car-dir-down"))}</div><div class="car-cabin"><div class="doors"><i class="door"></i><i class="door"></i></div></div></div></div>`;
}

/** One order mark: an empty floor button identified only by its `aria-label`; no whitespace, since marks are absolutely positioned. */
export function elevatorButtonTemplate(floorNum: number): string {
  return markup`<button type="button" class="mark buttonpress" aria-pressed="false" aria-label="${elevatorFloorButtonLabel(floorNum)}"></button>`;
}

/** Reflects a lit/unlit order mark in both the class and the ARIA state. */
function setLit(button: Element, lit: boolean): void {
  setClass(button, "is-lit", lit);
  button.setAttribute("aria-pressed", String(lit));
}

/** Where one elevator's shaft stands, and how tall its building's floors are. */
export interface ElevatorGeometry {
  /** The shaft's left edge inside `.shafts`, in pixels. */
  readonly leftPx: number;
  /** The shaft's width, in pixels, borders included. */
  readonly widthPx: number;
  /** The shaft's own margin on either side of the car, in pixels -- where the order strip is drawn. */
  readonly padPx: number;
  /** The middle of each floor's band, in pixels above the building's ground, in level order. */
  readonly markBottomsPx: readonly number[];
}

/** A mounted elevator: its element, and the geometry that changes after creation. */
export interface ElevatorView {
  /** The shaft's element, unparented until the caller appends it. */
  readonly element: HTMLElement;
  /** Places and sizes the shaft, and puts every order mark at its own floor. */
  setGeometry(geometry: ElevatorGeometry): void;
}

/** Builds an elevator's view and wires it to the simulation. */
export function createElevatorView(
  elevator: Elevator,
  index: number,
  scale: StageScale,
): ElevatorView {
  const element = renderElement(elevatorTemplate(index));
  const marks = requireElement(".shaft-marks", element);
  marks.append(
    ...elevator.buttonStates.map((_unused, floorNum) =>
      renderElement(elevatorButtonTemplate(floorNum)),
    ),
  );
  const buttons = queryAll(FLOOR_BUTTON_SELECTOR, marks);
  const car = requireElement(".car", element);
  const floorLabel = requireElement(".car-floor", element);
  const upLamp = requireElement(".car-dir-up", element);
  const downLamp = requireElement(".car-dir-down", element);

  for (const [floorNum, button] of buttons.entries()) {
    button.addEventListener("click", () => {
      elevator.pressFloorButton(floorNum);
    });
  }

  /** Opens or closes the doors, matching `entrance_available`'s own two conditions, if the answer changed since the last frame. */
  let doorsOpen = false;
  function updateDoors(): void {
    const open = !elevator.isMoving && elevator.isOnAFloor();
    if (open !== doorsOpen) {
      doorsOpen = open;
      setClass(car, "is-open", open);
    }
  }

  elevator.on("new_display_state", () => {
    // No x: the shaft carries horizontal position; the geometry pass sets that.
    setTransformPos(car, 0, elevator.worldY * scale.scaleY);
    updateDoors();
  });
  // Arrival doesn't fire `new_display_state`, so doors need their own trigger here.
  elevator.on("stopped_at_floor", () => {
    updateDoors();
  });
  elevator.on("new_current_floor", (floorNum) => {
    floorLabel.textContent = String(floorNum);
  });
  elevator.on("floor_buttons_changed", (states, indexChanged) => {
    const button = buttons[indexChanged];
    if (button !== undefined) {
      setLit(button, states[indexChanged] === true);
    }
  });
  elevator.on("indicatorstate_change", (indicatorStates) => {
    setClass(upLamp, "is-on", indicatorStates.up);
    setClass(downLamp, "is-on", indicatorStates.down);
  });

  // Initial sync: `indicatorstate_change` only fires on change, so a fresh view needs this to match the starting state.
  setClass(upLamp, "is-on", elevator.goingUpIndicator);
  setClass(downLamp, "is-on", elevator.goingDownIndicator);

  elevator.trigger("new_state", elevator);
  elevator.trigger("new_display_state", elevator);
  elevator.trigger("new_current_floor", elevator.currentFloor);

  return {
    element,
    setGeometry(geometry: ElevatorGeometry): void {
      element.style.left = `${String(geometry.leftPx)}px`;
      element.style.width = `${String(geometry.widthPx)}px`;
      element.style.setProperty("--ds-shaft-pad", `${String(geometry.padPx)}px`);
      for (const [level, button] of buttons.entries()) {
        const bottom = geometry.markBottomsPx[level];
        if (bottom !== undefined) {
          button.style.bottom = `${String(bottom)}px`;
        }
      }
    },
  };
}
