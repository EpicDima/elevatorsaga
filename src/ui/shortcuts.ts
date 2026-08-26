/** Relabels the page shell's `Mod-` key hint to match CodeMirror's actual binding for the platform. */

/** Marks a `<kbd>` in the page shell as standing for the `Mod-` key. */
const MOD_KEY_SELECTOR = "kbd[data-mod-key]";

/** Returns `"⌘"` on Apple platforms (matching CodeMirror's own `Mod-` test), `"Ctrl"` elsewhere. */
export function modifierKeyLabel(userAgent: string): string {
  return /Mac|iP(?:hone|ad|od)/.test(userAgent) ? "⌘" : "Ctrl";
}

/** Relabels every marked `Mod-` key under `root` for the platform behind `userAgent`. */
export function labelModifierKeys(root: ParentNode, userAgent: string): void {
  const label = modifierKeyLabel(userAgent);
  for (const key of root.querySelectorAll(MOD_KEY_SELECTOR)) {
    key.textContent = label;
  }
}
