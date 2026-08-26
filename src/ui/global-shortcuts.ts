/**
 * Document-global shortcuts: Space (start/pause), Mod-Enter (start over), Mod-B (cycle layout),
 * F1 (docs), "?" (settings). Mounted once from `src/main.ts`.
 */

/** Tags a keydown at any of these belongs to what the player is typing, not to a shortcut. */
const TYPING_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Whether a keydown's target is somewhere a shortcut would collide with typing: one of the three form
 * tags, or CodeMirror's own `.cm-editor` (a `contenteditable` div none of those tags cover).
 * Excluding `.cm-editor` also keeps Mod-Enter here from double-firing alongside editor.ts's own binding.
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
  /** "?"'s target: the settings popover's trigger, clicked because `Disclosure` has no `open()` to call. */
  readonly settingsOpenButton: HTMLElement;
  /** Called on F1. */
  readonly onOpenDocs: () => void;
  /** Called on Mod-B. */
  readonly onCycleLayout: () => void;
}

/** Wires this module's five document-global shortcuts; called once and never torn down. */
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
