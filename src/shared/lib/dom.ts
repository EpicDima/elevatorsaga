/** The handful of DOM helpers the presentation layer needs, replacing jQuery. */

/** Finds the first matching element, or `null` if nothing matches. */
export function query(selector: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(selector);
}

/**
 * Finds the first matching element, throwing instead of returning `null`.
 * Used for the static page shell, where a miss means `index.html` and the
 * presenters have drifted apart.
 *
 * @throws {Error} When nothing matches.
 */
export function requireElement(selector: string, root: ParentNode = document): HTMLElement {
  const element = query(selector, root);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

/** Finds every matching element, in document order. */
export function queryAll(selector: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)];
}

/** Removes every child of an element. */
export function clearChildren(element: Element): void {
  element.replaceChildren();
}

/** Adds or removes a class, based on `present`. */
export function setClass(element: Element, className: string, present: boolean): void {
  element.classList.toggle(className, present);
}

/**
 * Positions an absolutely placed element at world `x`,`y` (pixels), using a
 * single composited `translate3d`, which keeps elevators and passengers on the GPU.
 */
export function setTransformPos(element: HTMLElement | SVGElement, x: number, y: number): void {
  element.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
}
