/**
 * Names the modifier key the editor's shortcuts actually use.
 *
 * `src/ui/editor.ts` binds `Mod-Enter` and `Mod-s`, and CodeMirror resolves
 * `Mod-` to Command on Apple platforms and Control everywhere else. The page
 * shell can only hold one of those, so it holds "Ctrl" and this rewrites it on
 * the machines where that is wrong. Telling a Mac player to press Ctrl+S is
 * telling them to do nothing at all.
 */

/** Marks a `<kbd>` in the page shell as standing for the `Mod-` key. */
const MOD_KEY_SELECTOR = "kbd[data-mod-key]";

/**
 * The label for the `Mod-` key on the platform behind a user agent string.
 *
 * The test mirrors CodeMirror's own: it treats iOS and anything reporting a Mac
 * as Apple platforms, so the label always agrees with the binding.
 *
 * @param userAgent - The browser's user agent string.
 * @returns `"⌘"` on Apple platforms, `"Ctrl"` elsewhere.
 */
export function modifierKeyLabel(userAgent: string): string {
  return /Mac|iP(?:hone|ad|od)/.test(userAgent) ? "⌘" : "Ctrl";
}

/**
 * Relabels every `Mod-` key in the markup for the platform it is being read on.
 *
 * @param root - Where to look for the marked `<kbd>` elements.
 * @param userAgent - The browser's user agent string.
 */
export function labelModifierKeys(root: ParentNode, userAgent: string): void {
  const label = modifierKeyLabel(userAgent);
  for (const key of root.querySelectorAll(MOD_KEY_SELECTOR)) {
    key.textContent = label;
  }
}
