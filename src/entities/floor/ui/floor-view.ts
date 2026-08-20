/**
 * A floor's row in the building's floor-number column: its number, and the two
 * call lamps standing on it.
 *
 * This is `design/ui-mockup.html`'s own `.level` (§"Здание"), not the legacy
 * renderer's full-width band. The legacy floor was a striped bar spanning the
 * whole building with a 32px number floating over the shafts and two round
 * arrows at a fixed 50px inset; the mockup puts every floor's markings in one
 * narrow column down the left-hand side and leaves the shaft area to the cars
 * and the people walking to them. The class stays `floor` — `relabelWorld` in
 * `src/pages/game/index.ts` selects `.floor` and, inside it, `button.up` and
 * `button.down`, and indexes them by DOM order — with the mockup's `level`
 * beside it so the stylesheet can be read against the mockup rule for rule.
 *
 * The end floors get one lamp, not two, which is why both the template and
 * {@link createFloorView} are told how many floors the building has and not
 * only which one this is. The mockup's own `callControls` leaves the
 * impossible lamp off — «пустое место лучше кнопки, которая никогда не
 * загорится» — and the engine agrees with it: `spawnUserRandomly` in
 * `src/game/world.ts` puts every passenger on the ground floor bound upwards,
 * or above it bound for a floor `(currentFloor + 1..floorCount-1) %
 * floorCount`, which from the roof is always below the roof. So `User`'s own
 * `pressFloorButton` can never reach the roof's "up" or the lobby's "down" in
 * any run, at any seed. What is left is a player clicking one by hand, and a
 * call in a direction the building does not go is not a thing to offer.
 *
 * `floor.buttonStates` still carries both directions on every floor, drawn or
 * not — that is the engine's shape, and player code reads it. What changes is
 * that `relabelWorld` in `src/pages/game/index.ts` now *looks for* each lamp
 * rather than demanding it, since a row that has only one is now the normal
 * shape of the two rows at the ends.
 *
 * Vertical size comes from the widget, not from a page-wide constant:
 * `layoutBuilding()` decides how tall a floor is for the stage it has to fit
 * into, and pushes it here through {@link FloorView.setGeometry}. The row's
 * *position* is no longer anyone's to set — the column is a flex stack, so a
 * floor sits wherever the floors below it leave it.
 *
 * Relabeling on a language change is out of scope here, the same way it's
 * split out of `presentWorld` into a separate `relabelWorld` in
 * `src/pages/game/index.ts`: a floor is expensive to rebuild once its buttons
 * carry live listeners.
 */

import type { Floor } from "#game/floor.ts";
import { query, setClass } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

/** Selector for a floor's "call up" button. */
const CALL_UP_SELECTOR = "button.up";
/** Selector for a floor's "call down" button. */
const CALL_DOWN_SELECTOR = "button.down";

/**
 * One floor of the building: its number and the call lamps it can light.
 *
 * The call buttons used to be clickable `<i>` elements, which put them out of
 * reach of the keyboard and made them invisible to screen readers. They are real
 * buttons now; the stylesheet resets them so the pixels are the mockup's.
 *
 * @param level - Floor number.
 * @param floorCount - How many floors the building has, which is what decides
 * whether this floor is the roof (no call up) or the lobby (no call down).
 * @returns The floor markup.
 */
export function floorTemplate(level: number, floorCount: number): string {
  const up =
    level === floorCount - 1
      ? ""
      : markup`<button type="button" class="call up" aria-pressed="false" aria-label="${floorCallUpLabel(level)}">${raw(spriteIconMarkup("up"))}</button>`;
  const down =
    level === 0
      ? ""
      : markup`<button type="button" class="call down" aria-pressed="false" aria-label="${floorCallDownLabel(level)}">${raw(spriteIconMarkup("down"))}</button>`;
  return markup`<div class="floor level"><span class="level-num" aria-hidden="true">${level}</span><span class="calls">${raw(up)}${raw(down)}</span></div>`;
}

/**
 * Reflects a lit/unlit button state in both the class and the ARIA state.
 *
 * `is-lit` is the mockup's own class for a lamp with a call standing on it,
 * replacing the legacy `activated`; the engine's `ButtonState` still spells
 * that word, and still means the same thing.
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
 * Builds a floor's view and wires the call buttons it has to the simulation.
 *
 * The two lookups are {@link query} and not `requireElement`: the roof has no
 * "up" and the lobby no "down", so a missing lamp here is the drawn shape of
 * an end floor rather than a template that went wrong.
 *
 * @param floor - The floor to present.
 * @param floorCount - How many floors the building has; see
 * {@link floorTemplate}.
 * @returns The mounted view.
 */
export function createFloorView(floor: Floor, floorCount: number): FloorView {
  const element = renderElement(floorTemplate(floor.level, floorCount));
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
