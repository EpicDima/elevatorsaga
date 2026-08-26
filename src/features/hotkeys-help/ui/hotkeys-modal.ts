/**
 * The hotkeys dialog: a title, a close button and a row per hotkey, pairing it
 * with what it does.
 *
 * A Mod- binding is spelled as two `<kbd>`s joined by "+", marked
 * `data-mod-key`, rather than one compressed glyph: this module only draws
 * the marker, and whoever mounts the dialog live still has to resolve it per
 * platform.
 */

import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { markup } from "#shared/ui/markup.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";

/** Counter for a unique title id per modal instance. */
let nextTitleId = 0;

/** Every `t()`-sourced row label, in the same order as the five `.keyrow`s. */
function rowLabels(): readonly string[] {
  return [
    t("game.hotkeys.startPause"),
    t("game.hotkeys.startOver"),
    t("game.hotkeys.switchLayout"),
    t("game.hotkeys.openDocs"),
    t("game.hotkeys.openSettings"),
  ];
}

/** The dialog's inert markup, ready for {@link presentHotkeysModal}. */
export function hotkeysModalTemplate(): string {
  const titleId = `hotkeys-modal-title-${String(nextTitleId)}`;
  nextTitleId += 1;

  const title = t("game.hotkeys.title");
  const closeTitle = t("game.hotkeys.closeTitle");
  const close = t("game.hotkeys.close");
  const [startPause, startOver, switchLayout, openDocs, openSettings] = rowLabels();

  return markup`<dialog class="keys" aria-labelledby="${titleId}"><div class="keys-head"><h2 id="${titleId}">${title}</h2><button type="button" class="btn keysclose" title="${closeTitle}">${close}</button></div><div class="keys-body"><div class="keyrow"><span>${startPause}</span><kbd>Space</kbd></div><div class="keyrow"><span>${startOver}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd></div><div class="keyrow"><span>${switchLayout}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>B</kbd></div><div class="keyrow"><span>${openDocs}</span><kbd>F1</kbd></div><div class="keyrow"><span>${openSettings}</span><kbd>?</kbd></div></div></dialog>`;
}

/** What a mounted hotkeys modal hands back — a {@link Modal}, plus a way to keep its labels current. */
export interface HotkeysModalController extends Modal {
  /** Re-derives every `t()`-sourced label after a language change; the `kbd`s are untouched, since their glyphs are per-platform, not per-language. */
  update(): void;
}

/** Wires the dialog's close button and backdrop click into an open/close pair. */
export function presentHotkeysModal(dialog: HTMLDialogElement): HotkeysModalController {
  const closeButton = requireElement(".keysclose", dialog);
  const titleEl = requireElement("h2", dialog);
  const rowLabelEls = queryAll(".keyrow > span", dialog);

  return {
    ...createModal(dialog, closeButton),
    update(): void {
      titleEl.textContent = t("game.hotkeys.title");
      closeButton.title = t("game.hotkeys.closeTitle");
      closeButton.textContent = t("game.hotkeys.close");
      const labels = rowLabels();
      rowLabelEls.forEach((el, index) => {
        el.textContent = labels[index] ?? "";
      });
    },
  };
}
