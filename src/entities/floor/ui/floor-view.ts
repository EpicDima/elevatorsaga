/**
 * A floor's row: its number, and either its two call lamps or a
 * destination-dispatch panel, never both.
 */

import type { Floor } from "#game/floor.ts";
import { query, setClass } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement, renderFragment } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

/** Selector for a floor's "call up" button. */
const CALL_UP_SELECTOR = "button.up";
/** Selector for a floor's "call down" button. */
const CALL_DOWN_SELECTOR = "button.down";
/** Selector for the panel a destination-dispatch floor draws its journeys in. */
const DESTINATIONS_SELECTOR = ".destinations";

/**
 * How many chips a destination panel draws before collapsing the rest into a
 * "+N" count.
 */
const MAX_DESTINATION_CHIPS = 4;

/**
 * One floor's markup: its number, and either call-lamp buttons or an empty
 * destination panel.
 *
 * @param floorCount - Decides whether this floor is the roof (no "up") or the lobby (no "down").
 * @returns The floor markup.
 */
export function floorTemplate(
  level: number,
  floorCount: number,
  destinationDispatch = false,
): string {
  const up =
    level === floorCount - 1
      ? ""
      : markup`<button type="button" class="call up" aria-pressed="false" aria-label="${floorCallUpLabel(level)}">${raw(spriteIconMarkup("up"))}</button>`;
  const down =
    level === 0
      ? ""
      : markup`<button type="button" class="call down" aria-pressed="false" aria-label="${floorCallDownLabel(level)}">${raw(spriteIconMarkup("down"))}</button>`;
  const calls = destinationDispatch
    ? markup`<span class="calls destinations" aria-hidden="true"></span>`
    : markup`<span class="calls">${raw(up)}${raw(down)}</span>`;
  return markup`<div class="floor"><span class="level-num" aria-hidden="true">${level}</span>${raw(calls)}</div>`;
}

/**
 * One journey standing on a destination-dispatch floor. The count is drawn
 * only when more than one person shares it.
 *
 * @returns The chip markup.
 */
function destinationChip(destinationFloor: number, waiting: number, booked: boolean): string {
  const count = waiting > 1 ? markup`<span class="dest-count">${waiting}</span>` : "";
  return markup`<span class="dest${booked ? " is-booked" : ""}"><span class="dest-floor">${destinationFloor}</span>${raw(count)}</span>`;
}

/** Redraws a destination-dispatch floor's panel from scratch, from the floor's own book. */
function drawDestinations(panel: Element, floor: Floor): void {
  const pending = [...floor.pendingDestinations()].sort(([left], [right]) => left - right);
  const drawn =
    pending.length > MAX_DESTINATION_CHIPS ? pending.slice(0, MAX_DESTINATION_CHIPS - 1) : pending;
  const chips = drawn.map(([destinationFloor, waiting]) =>
    destinationChip(destinationFloor, waiting, floor.assignedElevator(destinationFloor) !== null),
  );
  if (drawn.length < pending.length) {
    chips.push(markup`<span class="dest is-more">+${pending.length - drawn.length}</span>`);
  }
  panel.replaceChildren(renderFragment(chips.join("")));
}

/** Reflects a lit/unlit button state in both the `is-lit` class and `aria-pressed`. */
function setActivated(button: Element, activated: boolean): void {
  setClass(button, "is-lit", activated);
  button.setAttribute("aria-pressed", String(activated));
}

/** A mounted floor: its element, and the one thing about it that changes after creation. */
export interface FloorView {
  /** The floor's element, unparented until the caller appends it. */
  readonly element: HTMLElement;
  /**
   * Resizes the floor's row to the height the building's layout gave it.
   *
   * @param heightPx - The floor's height, in pixels.
   */
  setGeometry(heightPx: number): void;
}

/**
 * Builds a floor's view and wires whichever kind of call it takes.
 *
 * Lamp lookups use {@link query}, not `requireElement`: a missing lamp is the
 * floor's drawn shape (roof, lobby, or destination-dispatch), not an error.
 *
 * @returns The mounted view.
 */
export function createFloorView(floor: Floor, floorCount: number): FloorView {
  const element = renderElement(floorTemplate(floor.level, floorCount, floor.destinationDispatch));
  const destinations = query(DESTINATIONS_SELECTOR, element);
  if (destinations !== null) {
    drawDestinations(destinations, floor);
    floor.on("destinations_change", () => {
      drawDestinations(destinations, floor);
    });
  }

  const up = query(CALL_UP_SELECTOR, element);
  const down = query(CALL_DOWN_SELECTOR, element);

  floor.on("buttonstate_change", (buttonStates) => {
    if (up !== null) {
      setActivated(up, buttonStates.up !== "");
    }
    if (down !== null) {
      setActivated(down, buttonStates.down !== "");
    }
  });
  up?.addEventListener("click", () => {
    floor.pressUpButton();
  });
  down?.addEventListener("click", () => {
    floor.pressDownButton();
  });

  return {
    element,
    setGeometry(heightPx: number): void {
      element.style.height = `${String(heightPx)}px`;
    },
  };
}
