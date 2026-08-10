/**
 * The code editor: CodeMirror 6, plus the persistence around it.
 *
 * Ported from `createEditor()` in the legacy `app.js`, which drove CodeMirror 5
 * through jQuery and lodash. The split here is deliberate: {@link CodeEditor}
 * owns the storage, the events and the compilation of the player's program and
 * knows nothing about CodeMirror, while {@link codeMirrorView} owns the widget.
 * That keeps the editor testable without a real editing surface, and keeps the
 * choice of editor swappable.
 *
 * One legacy feature is deliberately not carried over: CodeMirror 5's
 * reindent-on-paste hook. It reindented every pasted line with the "smart"
 * indenter, which mangled pasted code often enough to be reported as a bug
 * (magwo/elevatorsaga#119). CodeMirror 6 indents as you type and leaves pasted
 * text alone, which is what players expect.
 */

import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { indentUnit } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";

import { Observable } from "../game/observable.ts";
import { getCodeObjFromCode } from "../game/user-code.ts";
import type { UserCodeObject } from "../game/user-code.ts";
import { playerApiCompletionSource } from "./completions.ts";
import { DEFAULT_CODE, DEV_TEST_CODE } from "./default-code.ts";

/**
 * Where the player's program is kept between visits.
 *
 * Unchanged from the legacy game on purpose: saved code must survive the
 * upgrade.
 */
export const CODE_STORAGE_KEY = "elevatorCrushCode_v5";

/** Where the program is copied before "Reset" overwrites it. */
export const BACKUP_STORAGE_KEY = "develevateBackupCode";

/** How long typing must pause before the program is saved, in milliseconds. */
export const AUTOSAVE_DELAY_MS = 1000;

/** Indentation the editor inserts, matching the legacy `indentUnit: 4`. */
const INDENT = "    ";

/** Events emitted by {@link CodeEditor}. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- only a type alias gets the implicit index signature `Observable<E>` requires
export type CodeEditorEvents = {
  /** The stored program changed. */
  change: [];
  /** The program compiled. */
  code_success: [];
  /** The program failed to compile, or the simulation reported an error. */
  usercode_error: [e: unknown];
  /** The player asked for the program to be applied and the challenge restarted. */
  apply_code: [];
  /** The program was written to storage. */
  saved: [savedAt: Date];
};

/** Callbacks a {@link TextEditorView} raises. */
export interface TextEditorHandlers {
  /** The document changed. */
  onChange: () => void;
  /** The player asked to apply the program from within the editor. */
  onApply: () => void;
  /** The player asked to save the program from within the editor. */
  onSave: () => void;
}

/** The editing surface {@link CodeEditor} drives. */
export interface TextEditorView {
  /** Returns the whole document. */
  getValue: () => string;
  /**
   * Replaces the whole document.
   *
   * This is a document change like any other, so the surface raises
   * {@link TextEditorHandlers.onChange} for it — replacing the program from
   * "Reset", "Undo reset" or `#devtest` autosaves, as it did in the legacy
   * game. The document the surface is *built* with does not, which is why it is
   * passed to the factory instead of being assigned afterwards.
   */
  setValue: (value: string) => void;
  /** Puts the caret back in the editor. */
  focus: () => void;
}

/**
 * Builds an editing surface bound to the given handlers.
 *
 * @param handlers - Callbacks the surface raises.
 * @param initialValue - The document the surface starts with.
 */
export type TextEditorViewFactory = (
  handlers: TextEditorHandlers,
  initialValue: string,
) => TextEditorView;

/** Options accepted by {@link CodeEditor}. */
export interface CodeEditorOptions {
  /** Where to persist the program; defaults to `localStorage`. */
  storage?: Storage;
}

/**
 * Reads a key from storage, treating an unavailable store as an empty one.
 *
 * Safari in private mode throws from `localStorage.getItem`, and a player whose
 * browser refuses storage should still be able to play.
 *
 * @param storage - The store to read.
 * @param key - The key to read.
 * @returns The stored value, or `null`.
 */
function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a key to storage, ignoring a store that refuses to be written to.
 *
 * @param storage - The store to write.
 * @param key - The key to write.
 * @param value - The value to store.
 * @returns Whether the value was stored.
 */
function writeStorage(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The player's program: its text, its storage and its compilation.
 */
export class CodeEditor extends Observable<CodeEditorEvents> {
  readonly #view: TextEditorView;
  readonly #storage: Storage;
  #autosaveTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * @param createView - Builds the editing surface; receives the handlers the
   * surface should raise.
   * @param options - Storage override, mainly for tests.
   */
  constructor(createView: TextEditorViewFactory, options: CodeEditorOptions = {}) {
    super();
    this.#storage = options.storage ?? localStorage;
    // The stored program is handed to the surface as the document it is built
    // with, never assigned to it afterwards. Assigning it is a document change,
    // which schedules an autosave: the legacy game avoided that by calling
    // `cm.setValue()` before registering the change handler (app.js:50-55, then
    // :77-81), and without the same care every page load wrote to storage and
    // announced "Code saved …" a second later, unasked. Building the document
    // in also keeps it out of the undo history, so the first Ctrl+Z cannot wipe
    // the program the player arrived with.
    const existingCode = readStorage(this.#storage, CODE_STORAGE_KEY);
    this.#view = createView(
      {
        onChange: () => {
          this.#scheduleSave();
        },
        onApply: () => {
          this.trigger("apply_code");
        },
        onSave: () => {
          this.save();
        },
      },
      existingCode === null || existingCode === "" ? DEFAULT_CODE : existingCode,
    );
  }

  /**
   * Queues an autosave, restarting the countdown on every keystroke.
   *
   * Replaces the legacy `_.debounce(saveCode, 1000)`.
   */
  #scheduleSave(): void {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = setTimeout(() => {
      this.save();
    }, AUTOSAVE_DELAY_MS);
  }

  /** The current program text. */
  getCode(): string {
    return this.#view.getValue();
  }

  /**
   * Replaces the program text.
   *
   * @param code - The program to show.
   */
  setCode(code: string): void {
    this.#view.setValue(code);
  }

  /** Loads the naive reference solution used by `#devtest`. */
  setDevTestCode(): void {
    this.setCode(DEV_TEST_CODE);
  }

  /**
   * Compiles the program.
   *
   * @returns The compiled program, or `null` when it did not compile.
   */
  getCodeObj(): UserCodeObject | null {
    try {
      const codeObj = getCodeObjFromCode(this.getCode());
      this.trigger("code_success");
      return codeObj;
    } catch (e) {
      this.trigger("usercode_error", e);
      return null;
    }
  }

  /** Writes the program to storage and announces the change. */
  save(): void {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = undefined;
    if (writeStorage(this.#storage, CODE_STORAGE_KEY, this.getCode())) {
      this.trigger("saved", new Date());
    }
    this.trigger("change");
  }

  /** Backs the program up and replaces it with the starter program. */
  reset(): void {
    writeStorage(this.#storage, BACKUP_STORAGE_KEY, this.getCode());
    this.setCode(DEFAULT_CODE);
  }

  /** Restores the program as it was before the last {@link CodeEditor.reset}. */
  undoReset(): void {
    this.setCode(readStorage(this.#storage, BACKUP_STORAGE_KEY) ?? "");
  }

  /** Puts the caret back in the editing surface. */
  focus(): void {
    this.#view.focus();
  }
}

/**
 * Builds a CodeMirror 6 editing surface inside a container.
 *
 * @param parent - Element the editor is appended to.
 * @returns A factory that mounts the editor and returns the surface.
 */
export function codeMirrorView(parent: HTMLElement): TextEditorViewFactory {
  return (handlers: TextEditorHandlers, initialValue: string): TextEditorView => {
    const view = new EditorView({
      parent,
      doc: initialValue,
      extensions: [
        basicSetup,
        javascript(),
        // The player API in the completion popup, so the method names are in
        // the editor rather than only in the other tab. Registered as one more
        // of the JavaScript language's completion sources rather than through
        // `autocompletion({override})`, which would replace the language's own
        // sources: keywords, snippets and the identifiers already in the
        // player's program stay. `basicSetup` has already turned completion on,
        // with CodeMirror's defaults — Ctrl-Space, and while typing — and the
        // source itself is what keeps that from being noisy, by offering
        // nothing outside the three contexts described in `completions.ts`.
        javascriptLanguage.data.of({ autocomplete: playerApiCompletionSource }),
        indentUnit.of(INDENT),
        EditorState.tabSize.of(INDENT.length),
        EditorView.contentAttributes.of({ "aria-label": "Elevator program" }),
        // Ahead of the default keymap, which binds Mod-Enter itself.
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              preventDefault: true,
              run: () => {
                handlers.onApply();
                return true;
              },
            },
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                handlers.onSave();
                return true;
              },
            },
            {
              // The legacy Tab binding, which inserted spaces rather than
              // moving focus. Escape is the way back out, see below.
              key: "Tab",
              preventDefault: true,
              run: (target) => {
                target.dispatch(target.state.replaceSelection(INDENT));
                return true;
              },
            },
            {
              // Tab is taken, so the editor would otherwise be a keyboard trap.
              // Escape moves focus to the editor's own wrapper, from where Tab
              // continues to the next control on the page.
              key: "Escape",
              preventDefault: true,
              run: (target) => {
                target.dom.focus();
                return true;
              },
            },
          ]),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handlers.onChange();
          }
        }),
      ],
    });
    view.dom.tabIndex = -1;

    return {
      getValue: () => view.state.doc.toString(),
      setValue: (value: string) => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value },
          selection: { anchor: 0 },
        });
      },
      focus: () => {
        view.focus();
      },
    };
  };
}
