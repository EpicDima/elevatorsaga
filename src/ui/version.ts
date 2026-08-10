/**
 * The version the footer shows.
 *
 * It used to be written out twice — `package.json` and a literal in the footer
 * of `index.html` — which is one copy too many: releasing meant remembering to
 * bump both, and nothing failed when only one of them moved. `package.json` is
 * the single source now, and `vite.config.ts` substitutes it in here at build
 * time.
 */

import { requireElement } from "./dom.ts";

/**
 * The version from `package.json`, replaced at build time by Vite's `define`.
 *
 * Declared rather than imported: the whole point is that no `package.json` ends
 * up in the shipped bundle.
 */
declare const __APP_VERSION__: string;

/** The version this build was made from, e.g. `"2.0.0"`. */
const APP_VERSION: string = __APP_VERSION__;

/** Where the footer keeps its version slot. */
export const VERSION_SELECTOR = ".appversion";

/**
 * Fills the footer's version slot.
 *
 * @param root - The document (or fragment) holding the footer.
 */
export function presentVersion(root: ParentNode = document): void {
  requireElement(VERSION_SELECTOR, root).textContent = APP_VERSION;
}
