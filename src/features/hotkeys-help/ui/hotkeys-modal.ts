/**
 * The hotkeys dialog: a title, a close button, and groups of rows pairing a hotkey with what it
 * does, under a heading saying where it applies. A `Mod-` binding is only marked `data-mod-key`
 * here; whoever mounts the dialog live resolves the marker per platform.
 */

import { t, type MessageKey } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { markup, raw } from "#shared/ui/markup.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";

/** Counter for a unique title id per modal instance. */
let nextTitleId = 0;

/** The key cap standing for the platform's `Mod-`, as opposed to a literal `Ctrl`. */
const MOD = "Mod";

/** The dialog's own keys — narrow enough that `t()` knows none of them takes a parameter. */
type HotkeyMessageKey = Extract<MessageKey, `game.hotkeys.${string}`>;

/** One row: what the shortcut does, and the caps that chord it. */
interface Shortcut {
  /** The message naming what the shortcut does. */
  readonly label: HotkeyMessageKey;
  /** The caps, in press order; {@link MOD} stands for the platform's modifier. */
  readonly keys: readonly string[];
}

/** A run of rows under one heading, which is where those rows apply. */
interface ShortcutGroup {
  /** The message heading the group. */
  readonly heading: HotkeyMessageKey;
  /** Its rows, in the order they are drawn. */
  readonly shortcuts: readonly Shortcut[];
}

/** Every group, in the order the dialog draws them. */
const GROUPS: readonly ShortcutGroup[] = [
  {
    // The space bar belongs to whatever is focused, so the page claims it only when nothing is.
    heading: "game.hotkeys.nothingFocused",
    shortcuts: [{ label: "game.hotkeys.startPause", keys: ["Space"] }],
  },
  {
    // The page listens for these, and the editor swallows every one of them.
    heading: "game.hotkeys.outsideEditor",
    shortcuts: [
      { label: "game.hotkeys.startOver", keys: [MOD, "Enter"] },
      { label: "game.hotkeys.switchLayout", keys: [MOD, "B"] },
      { label: "game.hotkeys.openDocs", keys: ["F1"] },
      { label: "game.hotkeys.openSettings", keys: ["?"] },
    ],
  },
  {
    // CodeMirror's own; completion alone takes a literal `Ctrl` on every platform.
    heading: "game.hotkeys.editorOnly",
    shortcuts: [
      { label: "game.hotkeys.applyCode", keys: [MOD, "Enter"] },
      { label: "game.hotkeys.saveNow", keys: [MOD, "S"] },
      { label: "game.hotkeys.completions", keys: ["Ctrl", "Space"] },
      { label: "game.hotkeys.find", keys: [MOD, "F"] },
      { label: "game.hotkeys.findNext", keys: [MOD, "G"] },
      { label: "game.hotkeys.findPrevious", keys: [MOD, "Shift", "G"] },
      { label: "game.hotkeys.selectNextMatch", keys: [MOD, "D"] },
      { label: "game.hotkeys.indent", keys: ["Tab"] },
      { label: "game.hotkeys.leaveEditor", keys: ["Esc"] },
    ],
  },
];

/** Every `t()`-sourced row label, in the same order as the `.keyrow`s. */
function rowLabels(): readonly string[] {
  return GROUPS.flatMap((group) => group.shortcuts.map((shortcut) => t(shortcut.label)));
}

/** One row's caps, joined by `+`. */
function keysMarkup(keys: readonly string[]): string {
  return keys
    .map((key) => (key === MOD ? markup`<kbd data-mod-key>Ctrl</kbd>` : markup`<kbd>${key}</kbd>`))
    .join("+");
}

/** One group: its heading and its rows. */
function groupMarkup(group: ShortcutGroup): string {
  const rows = group.shortcuts
    .map(
      (shortcut) =>
        markup`<div class="keyrow"><span>${t(shortcut.label)}</span>${raw(keysMarkup(shortcut.keys))}</div>`,
    )
    .join("");
  return markup`<h3 class="keys-group">${t(group.heading)}</h3>${raw(rows)}`;
}

/** The dialog's inert markup, ready for {@link presentHotkeysModal}. */
export function hotkeysModalTemplate(): string {
  const titleId = `hotkeys-modal-title-${String(nextTitleId)}`;
  nextTitleId += 1;

  return markup`<dialog class="keys" aria-labelledby="${titleId}"><div class="keys-head"><h2 id="${titleId}">${t("game.hotkeys.title")}</h2><button type="button" class="btn keysclose" title="${t("game.hotkeys.closeTitle")}">${t("game.hotkeys.close")}</button></div><div class="keys-body">${raw(GROUPS.map(groupMarkup).join(""))}</div></dialog>`;
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
  const groupEls = queryAll(".keys-group", dialog);
  const rowLabelEls = queryAll(".keyrow > span", dialog);

  return {
    ...createModal(dialog, closeButton),
    update(): void {
      titleEl.textContent = t("game.hotkeys.title");
      closeButton.title = t("game.hotkeys.closeTitle");
      closeButton.textContent = t("game.hotkeys.close");
      const headings = GROUPS.map((group) => t(group.heading));
      groupEls.forEach((el, index) => {
        el.textContent = headings[index] ?? "";
      });
      const labels = rowLabels();
      rowLabelEls.forEach((el, index) => {
        el.textContent = labels[index] ?? "";
      });
    },
  };
}
