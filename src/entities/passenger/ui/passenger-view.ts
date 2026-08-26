/**
 * A passenger's DOM element, positioned from the building's live scale.
 * Position is read fresh every frame from the simulation; there is no
 * setGeometry because size comes entirely from CSS, not from here.
 */

import type { User } from "#game/user.ts";
import { setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";

/** How a passenger is drawn; mirrors the simulation's `UserDisplayType`. */
export type UserDisplayType = "child" | "female" | "male";

/** Which silhouette each `displayType` draws; `male` is the plain `person` icon, not `person-male`. */
const PERSON_ICONS: Readonly<Record<UserDisplayType, SpriteIconName>> = {
  child: "person-child",
  female: "person-female",
  male: "person",
};

/** Renders a passenger's markup; `leaving` marks a passenger who has already been delivered. */
export function userTemplate(displayType: UserDisplayType, leaving: boolean): string {
  return spriteIconMarkup(PERSON_ICONS[displayType], leaving ? "person is-leaving" : "person");
}

/** Parses a passenger's markup into its element. */
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

/** Builds a passenger's view and wires it to the simulation. */
export function createPassengerView(user: User, scale: StageScale): PassengerView {
  const element = renderPassenger(user.displayType ?? "male", user.done);

  user.on("new_display_state", () => {
    setTransformPos(element, user.worldX * scale.scaleX, user.worldY * scale.scaleY);
    if (user.done) {
      element.classList.add("is-leaving");
    }
    setClass(element, "is-rider", user.parent !== null);
    setClass(element, "is-waiting-long", user.waitingLongest);
  });
  user.on("removed", () => {
    element.remove();
  });

  return { element };
}
