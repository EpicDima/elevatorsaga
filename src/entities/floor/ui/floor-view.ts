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
 * The mockup omits the impossible lamp on the end floors (no "up" on the roof,
 * no "down" in the lobby). Both are drawn here regardless: `relabelWorld`
 * fetches each with `requireElement` on *every* floor and would throw on a row
 * that had only one, and that function lives in a file this widget does not
 * own. Rendering both also keeps the simulation's own API honest — a player's
 * code can read `floor.buttonStates.up` on the top floor and gets a control
 * that visibly exists.
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
import { requireElement, setClass } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { floorCallDownLabel, floorCallUpLabel } from "../../../ui/templates.ts";

/** Selector for a floor's "call up" button. */
const CALL_UP_SELECTOR = "button.up";
/** Selector for a floor's "call down" button. */
const CALL_DOWN_SELECTOR = "button.down";

/**
 * One floor of the building: its number and its two call lamps.
 *
 * The call buttons used to be clickable `<i>` elements, which put them out of
 * reach of the keyboard and made them invisible to screen readers. They are real
 * buttons now; the stylesheet resets them so the pixels are the mockup's.
 *
 * @param level - Floor number.
 * @returns The floor markup.
 */
export function floorTemplate(level: number): string {
  return markup`<div class="floor level"><span class="level-num" aria-hidden="true">${level}</span><span class="calls"><button type="button" class="call up" aria-pressed="false" aria-label="${floorCallUpLabel(level)}">${raw(spriteIconMarkup("up"))}</button><button type="button" class="call down" aria-pressed="false" aria-label="${floorCallDownLabel(level)}">${raw(spriteIconMarkup("down"))}</button></span></div>`;
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
 * Builds a floor's view and wires its call buttons to the simulation.
 *
 * @param floor - The floor to present.
 * @returns The mounted view.
 */
export function createFloorView(floor: Floor): FloorView {
  const element = renderElement(floorTemplate(floor.level));
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

  return {
    element,
    setGeometry(heightPx: number): void {
      element.style.height = `${String(heightPx)}px`;
    },
  };
}
