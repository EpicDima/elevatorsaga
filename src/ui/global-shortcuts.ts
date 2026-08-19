/**
 * The document-global keyboard shortcuts `design/ui-mockup.html`'s own
 * `document.addEventListener("keydown", ...)` block wires (§A): start or
 * pause with Space, start the run over with Mod-Enter, switch the workspace
 * layout with Mod-B, open the docs with F1, and open the settings popover
 * with "?" — the same five rows `features/hotkeys-help`'s dialog prints.
 *
 * Nothing here exists in production today. `src/ui/shortcuts.ts` only
 * relabels the `Mod-` key already printed in `page.hint.html` and the
 * hotkeys dialog; it binds nothing itself. This module is the binding,
 * mounted once from `src/main.ts` once every element and callback it drives
 * exists.
 *
 * ## Guards
 *
 * A typing target — an `<input>`, a `<textarea>`, a `<select>`, or anywhere
 * inside CodeMirror's own `.cm-editor` — takes every key below except Space,
 * which is guarded stricter still: it only fires with `document.body` itself
 * focused, the same as the mockup's own `document.activeElement ===
 * document.body` check. Two things make the CodeMirror check necessary
 * beyond the ordinary tag check: CodeMirror's own editable region is a plain
 * `contenteditable` `<div>`, not one of the three tags above, and
 * `src/ui/editor.ts` already binds `Mod-Enter` itself, at `Prec.highest` —
 * a document-level listener that did not defer to it would start the run
 * over twice for one keypress.
 *
 * `Mod-` is `event.ctrlKey || event.metaKey` rather than a literal `Ctrl`
 * check, for the same reason `src/ui/shortcuts.ts`'s own `modifierKeyLabel`
 * exists: CodeMirror resolves `Mod-` to Command on Apple platforms, and a
 * handler that only checked `ctrlKey` would silently do nothing for exactly
 * the players that label was rewritten for. Mod-B's `preventDefault()` is
 * unconditional, unlike the others below it: it is also Chrome's own
 * "toggle the bookmarks bar", and a shortcut that opens the browser's own UI
 * instead of this page's has not been intercepted at all.
 *
 * "?" opens the settings popover through a click on its own trigger rather
 * than a callback, because `#shared/ui/disclosure.ts`'s `Disclosure` has no
 * `open()` of its own to call — the panel only ever opens from the trigger's
 * own click listener. Space works the same way, for the same reason
 * `#features/run-simulation`'s own button exists: this module has no opinion
 * on what starting, pausing or restarting a run does, only on which key asks
 * for it.
 */

/** Tags a keydown at any of these belongs to what the player is typing, not to a shortcut. */
const TYPING_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Whether a keydown's target is somewhere a shortcut would collide with
 * typing — one of the three form tags above, or anywhere inside CodeMirror's
 * own `.cm-editor`, which is a `contenteditable` region none of those tags
 * name.
 *
 * @param target - The keydown event's own `target`.
 * @returns Whether every shortcut but Space should stay out of the way.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return TYPING_TAGS.has(target.tagName) || target.closest(".cm-editor") !== null;
}

/** What {@link presentGlobalShortcuts} needs in order to wire every shortcut. */
export interface GlobalShortcutsOptions {
  /** Where the keydown listener is attached — `document` in the page. */
  readonly root: Document;
  /** Space's target: clicked, not called, so this module keeps no opinion on what starting or pausing does. */
  readonly startStopButton: HTMLElement;
  /** Mod-Enter's target. */
  readonly startOverButton: HTMLElement;
  /** "?"'s target — the settings popover's own trigger; see the module comment for why a click and not a call. */
  readonly settingsOpenButton: HTMLElement;
  /** Called on F1. */
  readonly onOpenDocs: () => void;
  /** Called on Mod-B. */
  readonly onCycleLayout: () => void;
}

/**
 * Wires every document-global shortcut this module's own comment lists.
 *
 * Called once; nothing here is ever torn down, the same as every other
 * document-level listener this page wires — `#shared/ui/disclosure.ts`'s
 * outside-click and Escape listeners among them.
 *
 * @param options - The buttons each key clicks, and the callbacks for the
 * two keys with no button of their own.
 */
export function presentGlobalShortcuts(options: GlobalShortcutsOptions): void {
  const { root, startStopButton, startOverButton, settingsOpenButton, onOpenDocs, onCycleLayout } =
    options;

  root.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === " ") {
      // Stricter than the typing-target guard below: a space bar's ordinary
      // job — activating whatever is focused, or scrolling when nothing is —
      // is left alone unless nothing at all is focused.
      if (event.target !== root.body) {
        return;
      }
      event.preventDefault();
      startStopButton.click();
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key === "Enter") {
      event.preventDefault();
      startOverButton.click();
      return;
    }
    if (mod && (event.key === "b" || event.key === "B")) {
      event.preventDefault();
      onCycleLayout();
      return;
    }
    if (event.key === "F1") {
      event.preventDefault();
      onOpenDocs();
      return;
    }
    if (event.key === "?") {
      event.preventDefault();
      settingsOpenButton.click();
    }
  });
}
