/**
 * The hotkeys dialog: a title, a close button and a row per hotkey, pairing it
 * with what it does.
 *
 * A Mod- binding is spelled as two `<kbd>`s joined by "+" rather than as one
 * compressed glyph (`⌘⏎`), so `src/ui/shortcuts.ts`'s `labelModifierKeys` can
 * resolve the modifier per visitor — `⌘` on a Mac, `Ctrl` elsewhere — and the
 * dialog needs no standing note about what Windows and Linux read instead. This
 * module only draws the `data-mod-key` marker; whoever mounts the dialog live
 * still has to call `labelModifierKeys` against it, the way
 * `src/ui/localize-page.ts` already does for the rest of the page shell.
 *
 * Built and unit-tested against a jsdom `<dialog>` —
 * `polyfillDialogElement` (`#shared/ui/test-helpers.ts`). `src/main.ts` mounts
 * it and wires `settings-menu.ts`'s `keysopen` opener to it.
 */

import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { markup } from "#shared/ui/markup.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";

/** Counter for {@link hotkeysModalTemplate}'s own title id, unique per call. */
let nextTitleId = 0;

/**
 * Every `t()`-sourced row label {@link hotkeysModalTemplate} draws, in the
 * same order as its five `.keyrow`s — the order {@link presentHotkeysModal}'s
 * `update` re-applies them in.
 */
function rowLabels(): readonly string[] {
  return [
    t("game.hotkeys.startPause"),
    t("game.hotkeys.startOver"),
    t("game.hotkeys.switchLayout"),
    t("game.hotkeys.openDocs"),
    t("game.hotkeys.openSettings"),
  ];
}

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
  const [startPause, startOver, switchLayout, openDocs, openSettings] = rowLabels();

  return markup`<dialog class="keys" aria-labelledby="${titleId}"><div class="keys-head"><h2 id="${titleId}">${title}</h2><button type="button" class="btn keysclose" title="${closeTitle}">${close}</button></div><div class="keys-body"><div class="keyrow"><span>${startPause}</span><kbd>Space</kbd></div><div class="keyrow"><span>${startOver}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd></div><div class="keyrow"><span>${switchLayout}</span><kbd data-mod-key>Ctrl</kbd>+<kbd>B</kbd></div><div class="keyrow"><span>${openDocs}</span><kbd>F1</kbd></div><div class="keyrow"><span>${openSettings}</span><kbd>?</kbd></div></div></dialog>`;
}

/** What a mounted hotkeys modal hands back — a {@link Modal}, plus a way to keep its labels current. */
export interface HotkeysModalController extends Modal {
  /**
   * Re-derives every `t()`-sourced label this dialog drew — the title, the
   * close button and the five row descriptions — for a caller redrawing
   * after a language change. {@link hotkeysModalTemplate} bakes them in
   * once, at construction; this is what keeps them current instead, the
   * same role `RunControlsPresenter.update` plays for the run controls. The
   * `kbd`s are untouched: their glyphs are per-platform, not per-language —
   * see the module comment.
   */
  update(): void;
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
