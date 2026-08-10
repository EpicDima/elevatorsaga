/**
 * The handful of DOM helpers the presentation layer needs, replacing jQuery.
 *
 * The legacy UI pulled in all of jQuery 2.1 for class toggling, `find`, `empty`
 * and click binding. Those are one-liners on the modern DOM, so they live here
 * instead and the dependency is gone.
 *
 * Element *creation* is not among them: the view is built from the escaping
 * templates in `templates.ts`, and the icons from `document.createElementNS`.
 * The small `createElement` helper the unit tests build page fragments with is
 * in `test-helpers.ts`, with the rest of the test-only code.
 */

/**
 * Finds the first matching element.
 *
 * @param selector - CSS selector to match.
 * @param root - Node to search within; defaults to the whole document.
 * @returns The element, or `null` when nothing matches.
 */
export function query(selector: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(selector);
}

/**
 * Finds the first matching element, insisting that it exists.
 *
 * Used for the static page shell, where a missing node means `index.html` and
 * the presenters have drifted apart and the game cannot run at all.
 *
 * @param selector - CSS selector to match.
 * @param root - Node to search within; defaults to the whole document.
 * @returns The element.
 * @throws {Error} When nothing matches.
 */
export function requireElement(selector: string, root: ParentNode = document): HTMLElement {
  const element = query(selector, root);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

/**
 * Finds every matching element.
 *
 * @param selector - CSS selector to match.
 * @param root - Node to search within; defaults to the whole document.
 * @returns The matching elements, in document order.
 */
export function queryAll(selector: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)];
}

/**
 * Removes every child of an element.
 *
 * @param element - Element to empty.
 */
export function clearChildren(element: Element): void {
  element.replaceChildren();
}

/**
 * Adds or removes a class.
 *
 * @param element - Element to update.
 * @param className - Class to toggle.
 * @param present - Whether the class should be present afterwards.
 */
export function setClass(element: Element, className: string, present: boolean): void {
  element.classList.toggle(className, present);
}

/**
 * Positions an absolutely placed element in the world.
 *
 * Uses a single composited `translate3d`, which is what keeps the elevators and
 * passengers on the GPU. The legacy code wrote `-ms-`/`-webkit-` prefixed
 * variants of `translate(x, y) translateZ(0)` as well; every browser that can
 * run this game has supported the unprefixed 3D form for over a decade.
 *
 * @param element - Element to position.
 * @param x - World x, in pixels.
 * @param y - World y, in pixels.
 */
export function setTransformPos(element: HTMLElement | SVGElement, x: number, y: number): void {
  element.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
}
