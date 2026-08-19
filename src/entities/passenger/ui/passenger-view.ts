/**
 * A passenger's DOM element, positioned from the responsive building's own
 * geometry rather than the fixed pixel grid once drawn by what was
 * `src/ui/presenters.ts`.
 *
 * Built for widget 6b ("Building/stage rendering + hover cards"), wired
 * mostly as `presentUser` wired a passenger in what was `src/ui/presenters.ts` —
 * a leaving class, a longest-wait class, removal on the `removed` event — with
 * two differences: the position multiplies `worldX`/`worldY` by
 * {@link StageScale}'s current `scaleX`/`scaleY`, read fresh on every
 * `new_display_state` rather than cached, the same way `entities/elevator`
 * does; and `is-rider`, from `user.parent`, that `presentUser` never had reason
 * to track — the corridor and the car are painted differently enough now (see
 * `.person.is-rider` in style.css) that a passenger's colour has to know which
 * one it is standing in. Unlike `presentUser`, this view does not append itself
 * to a parent; `widgets/building-stage` owns that, the same way it owns
 * appending floors and cars.
 *
 * ## The figure itself
 *
 * `design/ui-mockup.html`'s `.person` (§6) is a flat filled silhouette in an
 * 11x20 box, not one of the Font Awesome outlines this used to draw, and it is
 * sized entirely from CSS — the mockup's own `--ph`, here `--ds-person-h`,
 * derived from the floor height so that a figure in a twenty-storey building
 * shrinks with the storey rather than sticking out of it. Nothing about the
 * figure's size is written from here, which is why this view has no
 * `setGeometry` while every other entity in the building does: a passenger is
 * the one thing whose only per-frame number is its position, and the position
 * is the simulation's, not the layout's.
 *
 * The three `displayType`s survive as three glyphs (see `SPRITE_ICONS.person`
 * and its neighbours), which is a deliberate addition to the mockup rather than
 * a port of it — the reasoning is written down beside the artwork.
 */

import type { User } from "#game/user.ts";
import { setClass, setTransformPos } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";

/** How a passenger is drawn; mirrors the simulation's `UserDisplayType`. */
export type UserDisplayType = "child" | "female" | "male";

/**
 * Which silhouette each `displayType` draws.
 *
 * `male` is the plain `person`, not a `person-male`, because it is the default
 * the other two are variations on — the same way the mockup's own single figure
 * is just `#i-person`.
 */
const PERSON_ICONS: Readonly<Record<UserDisplayType, SpriteIconName>> = {
  child: "person-child",
  female: "person-female",
  male: "person",
};

/**
 * A passenger.
 *
 * @param displayType - Which person glyph to draw.
 * @param leaving - Whether the passenger has already been delivered.
 * @returns The passenger markup.
 */
export function userTemplate(displayType: UserDisplayType, leaving: boolean): string {
  return spriteIconMarkup(PERSON_ICONS[displayType], leaving ? "person is-leaving" : "person");
}

/**
 * Parses the markup for one passenger into its element.
 *
 * @param displayType - Which person glyph to draw.
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
