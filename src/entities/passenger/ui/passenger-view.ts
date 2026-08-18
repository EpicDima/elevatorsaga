/**
 * A passenger's DOM element, positioned from the responsive building's own
 * geometry rather than the fixed pixel grid `src/ui/presenters.ts` draws.
 *
 * Built for widget 6b ("Building/stage rendering + hover cards"), wired
 * exactly as `presentUser` wires a passenger in `src/ui/presenters.ts` —
 * `leaving`/`waiting-longest` classes, removal on the `removed` event — with
 * one difference: the position multiplies `worldX`/`worldY` by
 * {@link StageScale}'s current `scaleX`/`scaleY`, read fresh on every
 * `new_display_state` rather than cached, the same way `entities/elevator`
 * does. Unlike `presentUser`, this view does not append itself to a parent;
 * `widgets/building-stage` owns that, the same way it owns appending floors
 * and cars.
 */

import { userTemplate, type UserDisplayType } from "../../../ui/templates.ts";
import type { User } from "#game/user.ts";
import { setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";

/**
 * Parses the markup for one passenger into its element.
 *
 * @param displayType - Which person icon to draw.
 * @param leaving - Whether the passenger has already been delivered.
 * @returns The passenger element.
 */
function renderPassenger(displayType: UserDisplayType, leaving: boolean): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = userTemplate(displayType, leaving);
  const element = template.content.firstElementChild;
  if (!(element instanceof SVGElement)) {
    throw new Error("Expected the user template to render an SVG element");
  }
  return element;
}

/** A mounted passenger: its element. Nothing about a passenger is resized or repositioned by hand. */
export interface PassengerView {
  /** The passenger's element, unparented until the caller appends it. */
  readonly element: SVGElement;
}

/**
 * Builds a passenger's view and wires it to the simulation.
 *
 * @param user - The passenger to present.
 * @param scale - The stage's current scale, read fresh on every position update.
 * @returns The mounted view.
 */
export function createPassengerView(user: User, scale: StageScale): PassengerView {
  const element = renderPassenger(user.displayType ?? "male", user.done);

  user.on("new_display_state", () => {
    setTransformPos(element, user.worldX * scale.scaleX, user.worldY * scale.scaleY);
    if (user.done) {
      element.classList.add("leaving");
    }
    setClass(element, "waiting-longest", user.waitingLongest);
  });
  user.on("removed", () => {
    element.remove();
  });

  return { element };
}
