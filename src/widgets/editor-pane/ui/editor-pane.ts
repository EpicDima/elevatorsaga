/**
 * The editor pane's chrome: the code slot switcher, the tools beside it, the
 * error banner above the editor, and the mount point for the editor itself.
 *
 * Ported from `design/ui-mockup.html`'s `.pane.pane-code` section — the
 * `.codebar` row (slots plus `.codetools`), the `.errorline` banner, and the
 * `.editor` mount point — for `widgets/workspace-layout`'s `.pane-code`,
 * which is where {@link presentEditorPane} is meant to draw once a later
 * phase mounts this widget. Nothing here is reachable yet: like every widget
 * staged ahead of it, this is built and tested, not yet called from
 * `index.html` or `src/app/app.ts`.
 *
 * Three things this pane draws deliberately are not straight ports:
 *
 * - The slot switcher is not redrawn here at all. `presentCodeSlots` already
 *   exists, in `#features/manage-code-slots`, and is composed as-is — the
 *   mockup's own markup for it (`.slots[role=group]`) is reproduced as the
 *   container this pane hands that presenter, nothing more.
 * - `.codetools`' "Reset code" and "Undo reset" are a second, independent
 *   copy of `#features/run-simulation`'s own two buttons, not a move of
 *   them. `run-controls.ts` is already mounted and live, drawn once from the
 *   app's constructor; deleting its two buttons to "relocate" them here
 *   would be a real behavioural change to a shipping control, which the
 *   inert-and-unmounted rule the rest of this widget follows does not cover.
 *   The two copies read the mockup's own rationale for wanting them beside
 *   the editor rather than the run — "Сброс кода стоял в панели прогона...
 *   а он про редактор, а не про прогон" — but only one of them can act on it
 *   before a later phase deletes the run row's own pair; see `run-controls.ts`
 *   for the button logic this one mirrors.
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
 *   mockup's own link only gestured at — once a later phase gives it a
 *   caller that can move a real cursor.
 *
 * The `.editor` mount point is left empty on purpose. `CodeEditor` is a full
 * subsystem of its own — one autosave timer, one set of storage keys, one
 * CodeMirror view — and the page has exactly one of it today, built once in
 * `src/main.ts`. Building a second live instance here, ahead of the cutover
 * that decides where the first one goes, risks two editors autosaving over
 * the same storage keys the moment both existed on a page at once. A later
 * phase — the same one that deletes the run row's own reset/undo pair —
 * decides who builds `CodeEditor` and where it hands this pane the view to
 * mount; until then, `.editor` is exactly what `buildWorkspaceLayoutSkeleton`
 * already leaves its own two panes as: a place, not a thing.
 */

import { presentCodeSlots, type CodeSlot } from "#features/manage-code-slots/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { iconMarkup } from "#shared/ui/icon.ts";

import { locateCodeError } from "../../../ui/error-location.ts";
import { describeError } from "../../../ui/presenters.ts";
import { markup, raw } from "../../../ui/templates.ts";

/**
 * The pane's static skeleton: the slots container, the two codetools
 * buttons, the error banner and the editor mount point, all empty — every
 * word is written by {@link presentEditorPane}, the same reason
 * `runButtonsTemplate` and `speedStepperTemplate` ship blank.
 *
 * @returns The pane's markup, ready to mount into `.pane-code`.
 */
export function editorPaneTemplate(): string {
  return markup`<div class="codebar"><div class="slots" role="group" aria-label="${t("editor.slot.tablist.label")}"></div><div class="codetools"><button type="button" class="resetcode ghost"></button><button type="button" class="undoreset ghost" hidden></button></div></div><div class="errorline" aria-live="polite" hidden>${raw(iconMarkup("warning", "error-color"))}<span>${t("game.codeStatus")} <code class="errormessage"></code></span><button type="button" class="goto" hidden></button></div><div class="editor"></div>`;
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
   * See `#features/run-simulation`'s own `RunControlsOptions.canUndoReset`
   * for why this asks the caller rather than "whether there is a program in
   * the backup slot".
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
   * switch, an edit, or a language change — the same list `RunControlsPresenter.update`
   * answers for its own copy of these two buttons.
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
  const undoReset = requireElement(".undoreset", parent);
  const errorLine = requireElement(".errorline", parent);
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
      resetCode.textContent = t("game.button.resetCode");
      undoReset.textContent = t("game.button.undoResetCode");
      undoReset.hidden = !options.canUndoReset();
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
