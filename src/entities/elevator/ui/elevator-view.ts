/**
 * One elevator: its shaft, the order strip beside it, and the car that runs up
 * and down inside it.
 *
 * The cabin draws no riders of its own, no occupancy count and no load bar. A
 * rider here is a real `entities/passenger` element standing in a real seat
 * (`elevator.userSlots[i].pos`), drawn by `widgets/building-stage` in its own
 * layer over the car, because a passenger walks in, rides, and walks out again
 * — one continuous movement through one coordinate space, not a figure deleted
 * from a queue and re-created in a cabin. The figures always fit: a seat is ten
 * world units and the car is ten times its capacity, so they are exactly as
 * crowded as the car is.
 *
 * What the car does carry is wired to the simulation:
 *
 * - the two boarding lamps on `.car-top`. They are not decoration:
 *   `goingUpIndicator`/`goingDownIndicator` are what decide who is allowed to
 *   board (`src/game/elevator.ts`'s `isSuitableForTravelBetween`), and a
 *   player's program sets them.
 * - the doors, opened exactly while the car is standing still on a floor —
 *   which is exactly when `entrance_available` is offered and a passenger may
 *   walk in or out.
 * - the order strip: the floors this car has been asked for, marked along the
 *   shaft at the height of the floor each one stands for. The marks are
 *   `<button>`s carrying a name and a pressed state — a mark is 4px wide and
 *   has no room for a digit, but that is a fact about the drawing, not about
 *   what a screen reader is told.
 *
 * The car's position comes from the simulation on every tick: this view
 * multiplies `worldY` by {@link StageScale}'s current `scaleY`, read fresh
 * rather than cached, so a stage resize lands on the car's very next frame. Its
 * horizontal position is the *shaft's*, written once per geometry pass by
 * {@link ElevatorView.setGeometry} — a car does not move sideways.
 */

import type { Elevator } from "#game/elevator.ts";
import { queryAll, requireElement, setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { elevatorFloorButtonLabel, elevatorLabel } from "../../../ui/templates.ts";

/** Selector for one order mark, which is also one in-car floor button. */
const FLOOR_BUTTON_SELECTOR = ".buttonpress";

/**
 * One elevator's shaft, order strip and car.
 *
 * Both classes on the root on purpose: `.shaft` is what the stylesheet draws,
 * and `.elevator` is what `relabelWorld` in `src/pages/game/index.ts` selects a
 * car by when the language changes. The accessible name is on this element
 * rather than on the car inside it because that is what carries the whole
 * control — the order marks are in here too, and it is the shaft rather than
 * the moving cabin that a pointer aims at.
 *
 * @param index - Zero-based index of the car, used for its accessible name.
 * @returns The shaft markup.
 */
export function elevatorTemplate(index: number): string {
  return markup`<div class="shaft elevator" role="group" aria-label="${elevatorLabel(index)}"><span class="shaft-marks"></span><div class="car"><div class="car-top">${raw(spriteIconMarkup("up", "car-dir car-dir-up"))}<span class="car-floor">0</span>${raw(spriteIconMarkup("down", "car-dir car-dir-down"))}</div><div class="car-cabin"><div class="doors"><i class="door"></i><i class="door"></i></div></div></div></div>`;
}

/**
 * One order mark: the floor button the car has for that level.
 *
 * Empty of content: the name is the whole of what identifies it, so it is the
 * `aria-label` that has to be right.
 *
 * These sit inside `.shaft-marks`, absolutely positioned at their own floor's
 * height, so the template must not introduce any surrounding whitespace.
 *
 * @param floorNum - Floor the button requests.
 * @returns The button markup.
 */
export function elevatorButtonTemplate(floorNum: number): string {
  return markup`<button type="button" class="mark buttonpress" aria-pressed="false" aria-label="${elevatorFloorButtonLabel(floorNum)}"></button>`;
}

/**
 * Reflects a lit/unlit order mark in both the class and the ARIA state.
 *
 * @param button - The in-car floor button.
 * @param lit - Whether the floor has been asked for.
 */
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
  /**
   * How much of that width is the shaft's own margin on either side of the car,
   * in pixels — the room the order strip is drawn in.
   */
  readonly padPx: number;
  /**
   * The middle of each floor's band, in pixels above the building's ground, in
   * level order. A mark is centered on it by the stylesheet rather than by
   * arithmetic here, so the caller never has to know how tall a mark is drawn.
   */
  readonly markBottomsPx: readonly number[];
}

/** A mounted elevator: its element, and the geometry that changes after creation. */
export interface ElevatorView {
  /** The shaft's element, unparented until the caller appends it. */
  readonly element: HTMLElement;
  /**
   * Places and sizes the shaft, and puts every order mark at its own floor.
   *
   * @param geometry - Where the shaft stands and where its marks go.
   */
  setGeometry(geometry: ElevatorGeometry): void;
}

/**
 * Builds an elevator's view and wires it to the simulation.
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

  /**
   * Opens or closes the doors, if the answer has changed since the last frame.
   *
   * Standing still on a floor is the simulation's own definition of a car that
   * can be got into: `src/game/world.ts` offers `entrance_available` under the
   * same two conditions, and `Elevator#update` refuses a re-offer under them
   * too. Guarded on the previous answer because the caller is a per-tick event
   * and a class toggle every frame of every car is a cost with nothing to show
   * for it.
   */
  let doorsOpen = false;
  function updateDoors(): void {
    const open = !elevator.isMoving && elevator.isOnAFloor();
    if (open !== doorsOpen) {
      doorsOpen = open;
      setClass(car, "is-open", open);
    }
  }

  elevator.on("new_display_state", () => {
    // No x: the shaft holds the car's horizontal place, and it is the geometry
    // pass that puts the shaft there.
    setTransformPos(car, 0, elevator.worldY * scale.scaleY);
    updateDoors();
  });
  // The frame a car arrives on is not a frame it moves on, so the event above
  // is not raised for it — and arriving is exactly when the doors open.
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

  // The lamps are drawn dark and lit from the car's real state, rather than
  // drawn lit because a new car happens to advertise both directions:
  // `indicatorstate_change` is only raised on a *change*, so a view that
  // assumed the starting state would keep whatever it assumed until a program
  // moved one of them.
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
