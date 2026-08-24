/**
 * A floor's row in the building's floor-number column: its number, and the two
 * call lamps standing on it.
 *
 * Every floor's markings stand in one narrow column down the left-hand side,
 * leaving the shaft area to the cars and the people walking to them.
 * `relabelWorld` in `src/pages/game/index.ts` selects `.floor` and, inside it,
 * `button.up` and `button.down`, and indexes them by DOM order.
 *
 * The end floors get one lamp, not two, which is why both the template and
 * {@link createFloorView} are told how many floors the building has and not
 * only which one this is. `spawnUserRandomly` in `src/game/world.ts` puts every
 * passenger on the ground floor bound upwards, or above it bound for a floor
 * `(currentFloor + 1..floorCount-1) % floorCount`, which from the roof is
 * always below the roof, so `User`'s own `pressFloorButton` can never reach the
 * roof's "up" or the lobby's "down" at any seed. What is left is a player
 * clicking one by hand, and a call in a direction the building does not go is
 * not a thing to offer.
 *
 * `floor.buttonStates` carries both directions on every floor, drawn or not —
 * that is the engine's shape, and player code reads it. `relabelWorld` *looks
 * for* each lamp rather than demanding it, a row with only one being the normal
 * shape of the two rows at the ends — and of every row in a
 * destination-dispatch building, which draws no lamps at all.
 *
 * Such a floor gets a panel of the journeys standing on it instead, because
 * that is what it has: its passengers name a floor and wait for whichever car
 * the program books, and the two ways of calling never mix on one floor (see
 * `Floor.destinationDispatch`). The panel is read-only where a lamp is
 * clickable, and not for want of an idea: a hand-lit lamp is a call the next
 * arriving car clears, while a hand-filed request would put somebody in the
 * floor's book that no passenger ever boards for, and the book is emptied only
 * by boarding or by refusal. That entry would stand for the rest of the run,
 * and swallow every later request for the same floor, since a request is
 * silent while a car is booked.
 *
 * The panel is `aria-hidden`, as the floor number beside it is. A floor's row
 * is focusable and describes itself with the hover card `widgets/building-stage`
 * hangs on it, and that card already names the floor, counts who is waiting and
 * lists where they are going; a second copy in a label would be read out twice.
 *
 * Vertical size comes from the widget, not from a page-wide constant:
 * `layoutBuilding()` decides how tall a floor is for the stage it has to fit
 * into, and pushes it here through {@link FloorView.setGeometry}. The row's
 * *position* is nobody's to set — the column is a flex stack, so a floor sits
 * wherever the floors below it leave it.
 *
 * Relabeling on a language change is out of scope here, the same way it is
 * split out of `presentWorld` into a separate `relabelWorld` in
 * `src/pages/game/index.ts`: a floor is expensive to rebuild once its buttons
 * carry live listeners.
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
 * How many chips a destination panel draws before it starts counting.
 *
 * Four, which is two rows of two in the width a destination-dispatch column
 * leaves over — it is wider than a two-lamp one for this — and inside the
 * height of the shortest floor of a tall building. Past four the last chip
 * becomes the number of journeys not drawn, so a crowded floor says how crowded
 * it is instead of quietly losing the tail of the list.
 */
const MAX_DESTINATION_CHIPS = 4;

/**
 * One floor of the building: its number and the call lamps it can light.
 *
 * The call lamps are real `<button>`s, so they are reachable from the keyboard
 * and named for a screen reader; the stylesheet resets their chrome.
 *
 * A destination-dispatch floor gets neither lamp and an empty panel instead,
 * which the view fills from the floor's book and refills whenever it changes.
 *
 * @param level - Floor number.
 * @param floorCount - How many floors the building has, which is what decides
 * whether this floor is the roof (no call up) or the lobby (no call down).
 * @param destinationDispatch - Whether this floor takes calls by destination
 * rather than by direction. Defaults to `false`, the way `Floor`'s own
 * constructor does, for the same reason: it is every floor of every building
 * written before destination dispatch existed.
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
 * One journey standing on a destination-dispatch floor.
 *
 * Lit is the state of a chip nobody has answered, which is the call lamp's rule
 * exactly: a lamp is lit while a call stands and goes out when a car takes it.
 * A chip cannot go out — the people are still here until they board — so it
 * goes quiet instead, and the accent moves to the journeys still asking.
 *
 * The count is drawn only when there is more than one person to count. One is
 * what a chip already means.
 *
 * @param destinationFloor - Where this journey goes.
 * @param waiting - How many people are making it.
 * @param booked - Whether a car has been booked to take them.
 * @returns The chip markup.
 */
function destinationChip(destinationFloor: number, waiting: number, booked: boolean): string {
  const count = waiting > 1 ? markup`<span class="dest-count">${waiting}</span>` : "";
  return markup`<span class="dest${booked ? " is-booked" : ""}"><span class="dest-floor">${destinationFloor}</span>${raw(count)}</span>`;
}

/**
 * Redraws a destination-dispatch floor's panel from the floor's own book.
 *
 * The whole panel every time rather than a diff of it: the book holds a handful
 * of entries at most, and it changes only when somebody asks for a car, boards
 * one, or is turned away by one.
 *
 * @param panel - The floor's destination panel.
 * @param floor - The floor it belongs to.
 */
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

/**
 * Reflects a lit/unlit button state in both the class and the ARIA state.
 *
 * `is-lit` is the class for a lamp with a call standing on it; the engine spells
 * the same state `activated` in its own `ButtonState`.
 *
 * @param button - The call button.
 * @param activated - Whether the button is currently lit.
 */
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
 * The lamp lookups are {@link query} and not `requireElement`: the roof has no
 * "up", the lobby no "down" and a destination-dispatch floor neither, so a
 * missing lamp here is the drawn shape of the floor rather than a template that
 * went wrong.
 *
 * The panel is filled once before any of that, so that a view built over a
 * floor people are already standing on opens with them on it.
 *
 * @param floor - The floor to present.
 * @param floorCount - How many floors the building has; see
 * {@link floorTemplate}.
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
