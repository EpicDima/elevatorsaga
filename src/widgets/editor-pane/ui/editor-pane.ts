/**
 * The editor pane's chrome: the code slot switcher, the tools beside it, the
 * error banner above the editor, and the mount point for the editor itself.
 *
 * Ported from `design/ui-mockup.html`'s `.pane.pane-code` section — the
 * `.codebar` row (slots plus `.codetools`), the `.errorline` banner, and the
 * `.editor` mount point — for `widgets/workspace-layout`'s `.pane-code`,
 * mounted from `src/main.ts`.
 *
 * Three things this pane draws are not straight ports:
 *
 * - The slot switcher is not redrawn here at all. `presentCodeSlots` already
 *   exists, in `#features/manage-code-slots`, and is composed as-is — the
 *   mockup's own markup for it (`.slots[role=group]`) is reproduced as the
 *   container this pane hands that presenter, nothing more.
 * - `.codetools`' "Reset code" and "Undo reset" are this pane's own copy of
 *   the buttons `#features/run-simulation`'s run controls used to draw.
 *   `run-controls.ts` no longer has them — see its own module comment —
 *   because a control about the editor belongs beside the editor, which is
 *   the mockup's own rationale: "Сброс кода стоял в панели прогона... а он
 *   про редактор, а не про прогон".
 * - The mockup's `#errorGoto` is `<a href="#" ...>`, and does nothing: its
 *   `#editor` is static markup with no script wiring the link to a real
 *   position. This pane's own goto is a real `<button>`, not an `<a>` — the
 *   same reason `speedStepperTemplate`'s own doc comment gives for the run
 *   controls no longer being an `<h3>` of clickable `<i>` elements, and
 *   specifically not an `<a href="#">`: the hash belongs to the router (see
 *   `src/main.ts`'s `.skip-link` handler), and a real navigation to it would
 *   throw away `challenge=`/`timescale=` and restart the player on the first
 *   challenge. It calls {@link EditorPaneOptions.onGotoLine} with the line
 *   `src/ui/error-location.ts`'s `locateCodeError` found, so it does what the
 *   mockup's own link only gestured at.
 *
 * The `.editor` mount point is built and handed its `CodeEditor` view by
 * `src/main.ts`, in that order: this pane's mount has to exist before
 * `codeMirrorView` can be built over it, and `CodeEditor` before the run/reset
 * callbacks that close over it can be written — see `main.ts`'s own comment
 * at the call site for how the three are sequenced.
 */

import { presentCodeSlots, type CodeSlot } from "#features/manage-code-slots/index.ts";
import { t } from "#i18n/index.ts";
import { describeError } from "#shared/lib/describe-error.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

import { locateCodeError } from "../../../ui/error-location.ts";

/**
 * The pane's static skeleton: the slots container, the two codetools
 * buttons, the error banner and the editor mount point, all empty — every
 * word is written by {@link presentEditorPane}, the same reason
 * `runButtonsTemplate` and `speedStepperTemplate` ship blank.
 *
 * Each codetools button is a glyph plus a `.lbl` span, which is the shape the
 * mockup gives its own `.ghost` buttons and the shape `widgets/app-bar` has
 * already ported: the label is a span of its own rather than a text node
 * beside the `<svg>` so that a stylesheet can reach it — the mockup's own §14
 * hides these labels under a narrow viewport and leaves the glyphs — and so
 * that {@link presentEditorPane} can rewrite the word on a language change
 * without touching the icon next to it.
 *
 * @returns The pane's markup, ready to mount into `.pane-code`.
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
  /**
   * Whether there is a reset "Undo reset" could take back.
   *
   * Not "whether there is a program in the backup slot": see
   * `src/ui/editor.ts`'s `CodeEditor.canUndoReset`, where the difference is
   * the difference between a button that recovers work and one that destroys
   * it.
   */
  readonly canUndoReset: () => boolean;
  /** Called when "Reset code" is pressed. */
  readonly onResetCode: () => void;
  /** Called when "Undo reset" is pressed. */
  readonly onUndoReset: () => void;
  /**
   * Called when the error banner's goto link is pressed, with the 1-based
   * line {@link EditorPanePresenter.showError}'s last call located.
   */
  readonly onGotoLine: (line: number) => void;
}

/** The rendered editor pane. */
export interface EditorPanePresenter {
  /**
   * Relabels the codetools buttons, the slot switcher, and "Undo reset"'s
   * visibility.
   *
   * Called after anything that could have moved any of it: a reset, a slot
   * switch, an edit, or a language change.
   */
  update(): void;

  /**
   * Draws the "there is a problem with your code" banner, and points the
   * goto link at the line `error` came from, if `src/ui/error-location.ts`'s
   * `locateCodeError` can find one in `code`.
   *
   * @param error - Whatever the player's code threw.
   * @param code - The program that was running when it threw.
   */
  showError(error: unknown, code: string): void;

  /** Hides the error banner. */
  clearError(): void;

  /** Where a later caller mounts the real editor; see the module comment. */
  readonly editorMount: HTMLElement;
}

/**
 * Draws the editor pane and wires it up.
 *
 * @param parent - The element {@link editorPaneTemplate}'s markup is written
 * into — `.pane-code`, once a later phase mounts this widget there.
 * @param options - The state to report on and the callbacks for its controls.
 * @returns The presenter, already drawn.
 */
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

  // The line the goto link currently points at, if any -- read by its click
  // listener, written by every `showError`. Kept outside the DOM rather than
  // parsed back out of the button's own text on click, the same reason
  // `#runningCode` exists on `CodeEditor`: the number is data the pane
  // already has, not something to recover from what it last rendered.
  let gotoLine: number | undefined;

  goto.addEventListener("click", () => {
    if (gotoLine !== undefined) {
      options.onGotoLine(gotoLine);
    }
  });

  const presenter: EditorPanePresenter = {
    update(): void {
      codeSlots.update();
      // The word goes in the `.lbl` span, not on the button: writing
      // `textContent` on the button itself would take the glyph beside it out
      // with the old text.
      resetCodeLabel.textContent = t("game.button.resetCode");
      undoResetLabel.textContent = t("game.button.undoResetCode");
      // What the label has no room to say -- which of the two programs comes
      // back. A description rather than the accessible name, which stays the
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
