/**
 * The hotkeys dialog: `design/ui-mockup.html`'s own `<dialog class="keys">` —
 * a title, a close button and five rows pairing a hotkey with what it does.
 *
 * Two of the five rows are Mod- bindings. The mockup spells each as one
 * compressed glyph (`⌘⏎`, `⌘B`) with a static paragraph underneath explaining
 * that Windows and Linux read `Ctrl` for `⌘`; this port spells both as two
 * `<kbd>`s joined by "+" instead, `page.hint.html`'s own convention, resolved
 * per visitor at runtime by `src/ui/shortcuts.ts`'s `labelModifierKeys` —
 * which is also why the mockup's own hint paragraph is dropped: relabelling
 * per visitor is what makes the hint's own question not arise. This module
 * only draws the `data-mod-key` marker, the same as `page.hint.html` does
 * inline; whoever mounts the dialog live still has to call
 * `labelModifierKeys` against it, the way `src/ui/localise-page.ts` already
 * does for the rest of the page shell.
 *
 * Built and unit-tested against a jsdom `<dialog>` —
 * `polyfillDialogElement` (`#shared/ui/test-helpers.ts`) — but not wired into
 * `src/app/app.ts` or `settings-menu.ts`'s `keysopen` opener yet, the "build
 * inert first" staging every widget in this migration has followed so far.
 */

import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";
import { markup } from "../../../ui/templates.ts";

/** Counter for {@link hotkeysModalTemplate}'s own title id, unique per call. */
let nextTitleId = 0;

/**
 * The dialog's inert markup, ready for {@link presentHotkeysModal}.
 *
 * @returns The dialog's markup, describing exactly one `<dialog class="keys">`.
 */
export function hotkeysModalTemplate(): string {
  const titleId = `hotkeys-modal-title-${String(nextTitleId)}`;
  nextTitleId += 1;

  const title = t("game.hotkeys.title");
  const closeTitle = t("game.hotkeys.closeTitle");
  const close = t("game.hotkeys.close");
  const startPause = t("game.hotkeys.startPause");
  const startOver = t("game.hotkeys.startOver");
  const switchLayout = t("game.hotkeys.switchLayout");
  const openDocs = t("game.hotkeys.openDocs");
  const openSettings = t("game.hotkeys.openSettings");

  return markup`<dialog class="keys" aria-labelledby="${titleId}"><div class="keys-head"><h2 id="${titleId}">${title}</h2><button type="button" class="btn keysclose" title="${closeTitle}">${close}</button></div><div class="keys-body"><div class="keyrow"><span>${startPause}</span><kbd>Space</kbd></div><div class="keyrow"><span>${startOver}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd></div><div class="keyrow"><span>${switchLayout}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>B</kbd></div><div class="keyrow"><span>${openDocs}</span><kbd>F1</kbd></div><div class="keyrow"><span>${openSettings}</span><kbd>?</kbd></div></div></dialog>`;
}

/**
 * Wires the dialog's close button and its own backdrop click into an
 * open/close pair — the same wiring `presentAppBarSettings` gives
 * `settings-menu.ts`'s own `keysopen` row, one level up.
 *
 * @param dialog - The `<dialog class="keys">` built from
 * {@link hotkeysModalTemplate}'s markup.
 * @returns The modal, closed to start.
 */
export function presentHotkeysModal(dialog: HTMLDialogElement): Modal {
  const closeButton = requireElement(".keysclose", dialog);
  return createModal(dialog, closeButton);
}
