/**
 * A floor's DOM element, positioned and sized from the responsive building's
 * own geometry rather than the fixed pixel grid `src/ui/presenters.ts` draws.
 *
 * Built for widget 6b ("Building/stage rendering + hover cards"): the call
 * buttons and their lit state are wired exactly as `presentFloor` wires them
 * in `src/ui/presenters.ts`. What's new is {@link FloorView.setGeometry},
 * which lets `widgets/building-stage` reposition and resize the floor
 * whenever `layoutBuilding()` recomputes, rather than baking a position in
 * once at creation the way the legacy fixed-pixel view does.
 *
 * `.floor`'s stylesheet rule sizes a floor off `--floor-height`, a single
 * page-wide constant, and vertically centers its buttons and number with
 * `line-height: var(--floor-height)`. `setGeometry` overrides `top`/`height`
 * inline (inline styles win over that rule), which keeps every floor the
 * right box regardless of what `layoutBuilding()` decided — but at a floor
 * height other than the page's fixed default, the inherited vertical
 * centering drifts by a few pixels. Harmless and purely cosmetic — this
 * widget is not wired into the page yet — and a real follow-up for whichever
 * step gives it its own stylesheet.
 *
 * Relabeling on a language change is out of scope here, the same way it's
 * split out of `presentWorld` into a separate `relabelWorld` in
 * `src/ui/presenters.ts`: a floor is expensive to rebuild once its buttons
 * carry live listeners, and nothing wires a language change into this widget
 * yet (it isn't called from `src/app/app.ts`). Whichever step wires this
 * widget live is the one that should add it.
 */

import { floorTemplate, renderElement } from "../../../ui/templates.ts";
import type { Floor } from "#game/floor.ts";
import { requireElement, setClass } from "#shared/lib/dom.ts";

/** Selector for a floor's "call up" button. */
const CALL_UP_SELECTOR = "button.up";
/** Selector for a floor's "call down" button. */
const CALL_DOWN_SELECTOR = "button.down";

/**
 * Reflects a lit/unlit button state in both the class and the ARIA state.
 *
 * @param button - The call button.
 * @param activated - Whether the button is currently lit.
 */
function setActivated(button: Element, activated: boolean): void {
  setClass(button, "activated", activated);
  button.setAttribute("aria-pressed", String(activated));
}

/** A mounted floor: its element, and the one thing about it that changes after creation. */
export interface FloorView {
  /** The floor's element, unparented until the caller appends it. */
  readonly element: HTMLElement;
  /**
   * Repositions and resizes the floor.
   *
   * @param topPx - The floor's offset from the building's bottom, in pixels.
   * @param heightPx - The floor's height, in pixels.
   */
  setGeometry(topPx: number, heightPx: number): void;
}

/**
 * Builds a floor's view and wires its call buttons to the simulation.
 *
 * @param floor - The floor to present.
 * @returns The mounted view.
 */
export function createFloorView(floor: Floor): FloorView {
  const element = renderElement(floorTemplate(floor.level, 0));
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
    setGeometry(topPx: number, heightPx: number): void {
      element.style.top = `${String(topPx)}px`;
      element.style.height = `${String(heightPx)}px`;
    },
  };
}
