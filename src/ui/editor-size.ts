/**
 * The control that makes the code editor taller, and remembers that it is.
 *
 * Upstream PR #104 asked for this in 2016 and was never merged: "the coding
 * area is too small for editing after a few levels". At the default height the
 * editor shows sixteen lines, which is right for the starter program and wrong
 * for the program somebody is writing by challenge 12 — and the editor is the
 * one part of this page a player spends the whole game inside.
 *
 * ## An attribute on `<html>`, not a height in JavaScript
 *
 * The obvious implementation writes `--editor-height` into
 * `document.documentElement.style`, and it is wrong in a way that only shows up
 * on a phone: that is an inline style on the very element the stylesheet
 * declares the token on, so it outranks the `max-width: 760px` media query that
 * also sets it, and the narrow-screen height would stop applying for good the
 * first time anybody touched this control. {@link EDITOR_SIZE_ATTRIBUTE} is
 * written instead, and both heights stay in `src/styles/style.css`, where a
 * media query can go on having an opinion about either of them.
 *
 * It goes on `<html>` rather than on the editor because that is the element the
 * shell ships before any module has run: a player who expanded the editor last
 * visit should not watch it start short and jump, and `src/main.ts` applies the
 * remembered size in the same pass that wires the button.
 *
 * ## One label, and `aria-pressed`
 *
 * The button's words never change. A toggle whose label flips between "Expand"
 * and "Collapse" has to be relabelled every time the language changes as well —
 * `localisePage` re-reads the shell and would write the other one back — and it
 * says two different things to a screen reader depending on when it is read.
 * The ARIA pattern for a control with two states is one name and `aria-pressed`,
 * which is announced as part of the button and needs nothing from the catalogue
 * but the name the shell already carries.
 *
 * ## Nothing tells CodeMirror
 *
 * It notices by itself: `@codemirror/view` puts a `ResizeObserver` on its own
 * scroller and remeasures when the box changes, so a height that arrives
 * through the cascade is the same to it as one that arrives from the window
 * being dragged. `e2e/editor.spec.ts` is what checks that this is still true.
 */

/**
 * Where the choice is remembered.
 *
 * `develevate…` like the other keys this fork invented, rather than
 * `elevator…`, which is reserved for the two keys the legacy game wrote and
 * this one still reads.
 */
export const EDITOR_SIZE_STORAGE_KEY = "develevateEditorSize";

/** What `<html>` carries while the editor is expanded. */
export const EDITOR_SIZE_ATTRIBUTE = "data-editor-size";

/**
 * The one value that attribute is ever set to.
 *
 * A word rather than a height: what "tall" comes to is a question for the
 * stylesheet, and storage holds a decision the player made rather than a
 * measurement that would go stale the moment the design changed.
 */
export const TALL_EDITOR = "tall";

/** What the control needs in order to draw and drive itself. */
export interface EditorSizeOptions {
  /** The button in the shell's row under the editor. */
  readonly button: HTMLButtonElement;
  /**
   * The element the attribute goes on — `document.documentElement` in the page.
   *
   * Injected for the same reason the storage is: it makes the whole of this
   * testable against a document that is not the one the test runner is in.
   */
  readonly root: HTMLElement;
  /** Where the choice is remembered between visits. */
  readonly storage: Storage;
}

/**
 * Whether the editor was left expanded.
 *
 * A refused or unreadable storage answers "no", which is the shipped default
 * and the only answer that cannot surprise anybody.
 *
 * @param storage - Where the choice was remembered.
 * @returns Whether to start expanded.
 */
function readStoredSize(storage: Storage): boolean {
  try {
    return storage.getItem(EDITOR_SIZE_STORAGE_KEY) === TALL_EDITOR;
  } catch {
    return false;
  }
}

/**
 * Remembers the choice, or does not.
 *
 * Deliberately unchecked, the same trade as `#storeTimeScale` in
 * `src/app/app.ts`: a browser that refuses storage — Safari in private mode is
 * the one everybody meets — is a reason for the size not to survive the tab,
 * not a reason for it not to change now.
 *
 * @param storage - Where to remember it.
 * @param tall - Whether the editor is expanded.
 */
function storeSize(storage: Storage, tall: boolean): void {
  try {
    if (tall) {
      storage.setItem(EDITOR_SIZE_STORAGE_KEY, TALL_EDITOR);
    } else {
      storage.removeItem(EDITOR_SIZE_STORAGE_KEY);
    }
  } catch {
    // Nothing to do about it, and nothing worth stopping for.
  }
}

/**
 * Applies a size to the page and says so on the button.
 *
 * @param options - The button and the element the attribute goes on.
 * @param tall - Whether the editor is expanded.
 */
function applySize(options: EditorSizeOptions, tall: boolean): void {
  if (tall) {
    options.root.setAttribute(EDITOR_SIZE_ATTRIBUTE, TALL_EDITOR);
  } else {
    // Removed rather than set to some other word, so that the default height is
    // the plain cascade with nothing on top of it. The stylesheet then has one
    // rule to read instead of two, and a size nobody chose leaves no trace.
    options.root.removeAttribute(EDITOR_SIZE_ATTRIBUTE);
  }
  options.button.setAttribute("aria-pressed", String(tall));
}

/**
 * Restores the remembered size and wires the button that changes it.
 *
 * @param options - The button, the element to mark, and where to remember.
 */
export function presentEditorSize(options: EditorSizeOptions): void {
  let tall = readStoredSize(options.storage);
  applySize(options, tall);

  options.button.addEventListener("click", () => {
    tall = !tall;
    applySize(options, tall);
    storeSize(options.storage, tall);
    // The focus stays on the button, unlike the other controls in this row,
    // which hand it to the editor. Those act on the program; this one acts on
    // the view of it, and a player who has just made the editor taller is as
    // likely to want it shorter again as to want to type.
  });
}
