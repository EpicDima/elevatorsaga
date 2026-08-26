/**
 * The editor pane's chrome: the code slot switcher, the tools beside it, the
 * error banner above the editor, and the mount point for the editor itself.
 * The error banner's goto is a real `<button>`, not a link, since a hash
 * navigation would drop `level=`/`timescale=` and restart the player.
 */

import { presentCodeSlots, type CodeSlot } from "#features/manage-code-slots/index.ts";
import { t } from "#i18n/index.ts";
import { describeError } from "#shared/lib/describe-error.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

import { locateCodeError } from "../../../ui/error-location.ts";

/**
 * The pane's static skeleton, all text empty; {@link presentEditorPane} fills it in.
 * Each codetools button keeps its label in a `.lbl` span, separate from the icon,
 * so a stylesheet can hide the word alone and a language change can rewrite it alone.
 */
export function editorPaneTemplate(): string {
  return markup`<div class="codebar"><div class="slots" role="group" aria-label="${t("editor.slot.tablist.label")}"></div><div class="codetools"><button type="button" class="resetcode ghost">${raw(spriteIconMarkup("undo"))}<span class="lbl"></span></button><button type="button" class="undoreset ghost" hidden>${raw(spriteIconMarkup("redo"))}<span class="lbl"></span></button></div></div><div class="errorline" aria-live="polite" hidden>${raw(spriteIconMarkup("warn"))}<span class="errorline-text"><span class="errorline-label">${t("game.codeStatus")}</span> <code class="errormessage"></code></span><button type="button" class="goto" hidden></button></div><div class="editor"></div>`;
}

/** What the editor pane needs in order to draw and drive itself. */
export interface EditorPaneOptions {
  /** Which slot is open in the editor right now. */
  readonly currentSlot: () => CodeSlot;
  /** Called when a slot button is pressed. */
  readonly onSelectSlot: (slot: CodeSlot) => void;
  /** Whether there is a reset "Undo reset" could take back. */
  readonly canUndoReset: () => boolean;
  /** Called when "Reset code" is pressed. */
  readonly onResetCode: () => void;
  /** Called when "Undo reset" is pressed. */
  readonly onUndoReset: () => void;
  /** Called when the error banner's goto link is pressed, with the 1-based line found. */
  readonly onGotoLine: (line: number) => void;
}

/** The rendered editor pane. */
export interface EditorPanePresenter {
  /** Relabels the codetools buttons, the slot switcher, and "Undo reset"'s visibility. */
  update(): void;

  /** Draws the error banner and points the goto link at the line `error` came from in `code`, if any. */
  showError(error: unknown, code: string): void;

  /** Hides the error banner. */
  clearError(): void;

  /** Where a later caller mounts the real editor. */
  readonly editorMount: HTMLElement;
}

/** Draws the editor pane and wires it up. */
export function presentEditorPane(
  parent: HTMLElement,
  options: EditorPaneOptions,
): EditorPanePresenter {
  parent.innerHTML = editorPaneTemplate();

  const slots = requireElement(".slots", parent);
  const resetCode = requireElement(".resetcode", parent);
  const resetCodeLabel = requireElement(".lbl", resetCode);
  const undoReset = requireElement(".undoreset", parent);
  const undoResetLabel = requireElement(".lbl", undoReset);
  const errorLine = requireElement(".errorline", parent);
  const errorLabel = requireElement(".errorline-label", parent);
  const errorMessage = requireElement(".errormessage", parent);
  const goto = requireElement(".goto", parent);
  const editorMount = requireElement(".editor", parent);

  const codeSlots = presentCodeSlots(slots, {
    currentSlot: options.currentSlot,
    onSelect: options.onSelectSlot,
  });

  resetCode.addEventListener("click", () => {
    options.onResetCode();
  });
  undoReset.addEventListener("click", () => {
    options.onUndoReset();
  });

  // The line the goto link currently points at, kept as data rather than
  // parsed back out of the button's own text on click.
  let gotoLine: number | undefined;

  goto.addEventListener("click", () => {
    if (gotoLine !== undefined) {
      options.onGotoLine(gotoLine);
    }
  });

  const presenter: EditorPanePresenter = {
    update(): void {
      codeSlots.update();
      resetCodeLabel.textContent = t("game.button.resetCode");
      undoResetLabel.textContent = t("game.button.undoResetCode");
      // A `title` description, not the accessible name, which must stay the
      // visible label (WCAG 2.5.3).
      resetCode.title = t("game.button.resetCodeTitle");
      undoReset.title = t("game.button.undoResetCodeTitle");
      undoReset.hidden = !options.canUndoReset();
      errorLabel.textContent = t("game.codeStatus");
    },

    showError(error, code): void {
      errorLine.hidden = false;
      errorMessage.textContent = describeError(error);
      const location = locateCodeError(error, code);
      gotoLine = location?.line;
      goto.hidden = location === undefined;
      goto.textContent =
        location === undefined ? "" : t("game.editorPane.gotoLine", { line: location.line });
    },

    clearError(): void {
      errorLine.hidden = true;
      gotoLine = undefined;
    },

    editorMount,
  };
  presenter.update();
  return presenter;
}
