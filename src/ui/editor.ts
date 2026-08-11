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

/**
 * Prefix of the storage keys holding the learning track's programs.
 *
 * `develevate…` rather than `elevatorCrush…` because the `elevatorCrush*` names
 * are an on-disk contract inherited from the game this is a fork of: they mean
 * there exactly what they mean here, and a player who has both games in one
 * browser profile must not have one of them read the other's data. Everything
 * this fork invents therefore lives under the fork's own prefix, as
 * {@link BACKUP_STORAGE_KEY} already does.
 *
 * The task number is part of the key — one key per task, not one key holding
 * all eight — so that a player who left task 3 half-written finds their own
 * attempt when they come back, "start over" is an operation on exactly one
 * task, and an entry that somehow becomes unreadable cannot take the other
 * seven down with it. Not exported: which keys exist, and how they are spelled,
 * is the editor's business alone.
 */
const TUTORIAL_CODE_KEY_PREFIX = "develevateTutorialCode_";

/**
 * Prefix of the per-task "Undo reset" backups.
 *
 * Per task rather than one shared slot, for the reason the whole buffer split
 * exists: with one slot, resetting task 3 and undoing in task 4 would paste
 * task 3's program over task 4's.
 */
const TUTORIAL_BACKUP_KEY_PREFIX = "develevateTutorialBackupCode_";

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
 * One editable program: where its text lives, what it starts from, and where
 * "Reset" parks the text it replaces.
 *
 * The editor shows exactly one of these at a time. Everything that reads or
 * writes storage goes through the buffer on screen, which is what keeps the
 * learning track's eight programs and the player's own program from writing
 * over each other: there is no code path that names a key directly.
 */
interface EditorBuffer {
  /** Where this buffer's text is stored between visits. */
  readonly codeKey: string;
  /** Where {@link CodeEditor.reset} parks the text before replacing it. */
  readonly backupKey: string;
  /** The program {@link CodeEditor.reset} restores, and an empty buffer opens with. */
  readonly starterCode: string;
  /**
   * Whether opening this buffer empty may write {@link EditorBuffer.starterCode}
   * into {@link EditorBuffer.codeKey}.
   *
   * False for the player's own key and true for the track's, deliberately: the
   * player's program is written by the player and by the explicit Save and
   * Reset buttons, and by nothing else. A brand-new player who opens a tutorial
   * task and never types must not come back to find the game has claimed their
   * key on their behalf — an empty key already means "the default program", so
   * writing it there would say nothing new and would only make an untouched
   * install look like a played one.
   */
  readonly writesStarterOnOpen: boolean;
}

/** The buffer holding the player's own program, which the editor opens with. */
const PLAYER_BUFFER: EditorBuffer = {
  codeKey: CODE_STORAGE_KEY,
  backupKey: BACKUP_STORAGE_KEY,
  starterCode: DEFAULT_CODE,
  writesStarterOnOpen: false,
};

/**
 * Describes the buffer of one learning-track task.
 *
 * @param task - The task's number, counting from one.
 * @param starterCode - The program the task hands the player to complete.
 * @returns The buffer for that task.
 * @throws RangeError When `task` is not a positive whole number. The number
 * comes from a URL the player can type by hand, and a `NaN` or `-1` slipping
 * through would spell one shared key that several malformed routes would then
 * pour their text into.
 */
function tutorialBuffer(task: number, starterCode: string): EditorBuffer {
  if (!Number.isInteger(task) || task < 1) {
    throw new RangeError(`Tutorial task must be a positive whole number, got ${String(task)}`);
  }
  return {
    codeKey: `${TUTORIAL_CODE_KEY_PREFIX}${String(task)}`,
    backupKey: `${TUTORIAL_BACKUP_KEY_PREFIX}${String(task)}`,
    starterCode,
    writesStarterOnOpen: true,
  };
}

/**
 * The player's program: its text, its storage and its compilation.
 */
export class CodeEditor extends Observable<CodeEditorEvents> {
  readonly #view: TextEditorView;
  readonly #storage: Storage;
  /** The buffer on screen; every read and write of program text goes to it. */
  #buffer: EditorBuffer = PLAYER_BUFFER;
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
    const existingCode = readStorage(this.#storage, this.#buffer.codeKey);
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
      existingCode === null || existingCode === "" ? this.#buffer.starterCode : existingCode,
    );
  }

  /**
   * Queues an autosave, restarting the countdown on every keystroke.
   *
   * Replaces the legacy `_.debounce(saveCode, 1000)`.
   */
  #scheduleSave(): void {
    this.#cancelSave();
    this.#autosaveTimer = setTimeout(() => {
      this.save();
    }, AUTOSAVE_DELAY_MS);
  }

  /**
   * Drops a queued autosave.
   *
   * Anything that has just put the buffer's text into storage itself must do
   * this, or the countdown started by the keystroke before it fires afterwards
   * — and a countdown that outlives a buffer switch writes the text now on
   * screen into whichever buffer is on screen when it goes off.
   */
  #cancelSave(): void {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = undefined;
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
    this.#cancelSave();
    if (writeStorage(this.#storage, this.#buffer.codeKey, this.getCode())) {
      this.trigger("saved", new Date());
    }
    this.trigger("change");
  }

  /**
   * Shows the player's own program again, keeping whatever was on screen.
   *
   * Takes no program to fall back on, and that is the point: the only text this
   * can ever put on screen is the player's own, so no caller can hand the
   * player's key somebody else's starter code by mistake.
   */
  openPlayerBuffer(): void {
    this.#openBuffer(PLAYER_BUFFER);
  }

  /**
   * Shows one learning-track task's program, keeping whatever was on screen.
   *
   * The task's own attempt if there is one, otherwise `starterCode`. Callers
   * name a task, never a storage key: a method taking a key can be handed the
   * player's key together with a task's starter program, and the player's
   * program is gone. There is no such call to make here.
   *
   * @param task - The task's number, counting from one.
   * @param starterCode - The program the task starts from, used only when the
   * task has nothing stored yet. Also what {@link CodeEditor.reset} restores
   * while the task is open, so passing the text in the player's current
   * language keeps "start over" in that language.
   */
  openTutorialBuffer(task: number, starterCode: string): void {
    this.#openBuffer(tutorialBuffer(task, starterCode));
  }

  /**
   * Puts `next` on screen, having put the text on screen back where it came
   * from.
   *
   * @param next - The buffer to show.
   */
  #openBuffer(next: EditorBuffer): void {
    if (next.codeKey === this.#buffer.codeKey) {
      // Already on screen. Reloading it would be worse than useless: the
      // document would be replaced, moving the caret and emptying the undo
      // history, for text that is already there. Routers and interfaces repeat
      // themselves — a re-render, a language change, a second click on the link
      // for the task already open — and none of that may disturb typing. The
      // description is still taken, because the starter program of one task is
      // translated, so it changes under a language switch and "Reset" owes the
      // player the version they can read.
      this.#buffer = next;
      return;
    }
    // Everything unsaved in the buffer being left goes back to that buffer's
    // own key before anything else happens; the switch is the last chance,
    // since the pending autosave is about to be cancelled.
    this.#flush();
    this.#buffer = next;
    const stored = readStorage(this.#storage, next.codeKey);
    // An empty entry counts as no entry, as it does when the editor is built:
    // the alternative is opening a task on a blank page with no way back to its
    // starting point except deleting the entry by hand.
    if (stored === null || stored === "") {
      if (next.writesStarterOnOpen) {
        // Stored right away rather than left to the first autosave, so that the
        // task the player is looking at is the task they come back to even if
        // they close the tab without typing a character.
        writeStorage(this.#storage, next.codeKey, next.starterCode);
      }
      this.setCode(next.starterCode);
    } else {
      this.setCode(stored);
    }
    // Replacing the document is a document change, which has just queued an
    // autosave of text that is already in storage. Letting it run would tell
    // the player "Code saved ..." for a save they did not ask for — the same
    // unasked announcement the constructor goes out of its way to avoid.
    this.#cancelSave();
    // The program in the editor is a different program now, even though nobody
    // typed: listeners that describe the editor's contents, such as the fitness
    // measurement, are stale and say so themselves off this event.
    this.trigger("change");
  }

  /**
   * Writes the text on screen back to the buffer it belongs to.
   *
   * Deliberately silent, unlike {@link CodeEditor.save}: this is bookkeeping on
   * the way out of a buffer, not a save the player asked for.
   */
  #flush(): void {
    this.#cancelSave();
    const code = this.getCode();
    const stored = readStorage(this.#storage, this.#buffer.codeKey);
    if ((stored === null || stored === "") && code === this.#buffer.starterCode) {
      // Storage already says exactly this: an empty entry is read back as the
      // buffer's starter program. Writing it anyway would be the one way a walk
      // through the learning track could create the player's own key for a
      // player who has never typed a character, and an untouched install would
      // start looking like a played one.
      return;
    }
    writeStorage(this.#storage, this.#buffer.codeKey, code);
  }

  /** Backs the program up and replaces it with the buffer's starter program. */
  reset(): void {
    writeStorage(this.#storage, this.#buffer.backupKey, this.getCode());
    this.setCode(this.#buffer.starterCode);
  }

  /**
   * Restores the program as it was before the last {@link CodeEditor.reset} of
   * this buffer.
   *
   * Does nothing when this buffer has no backup, which is a change from the
   * legacy game: there, "Undo reset" with nothing to undo emptied the editor
   * and the autosave a second later made that permanent. The button is offered
   * unconditionally and now every buffer has a backup slot of its own, so
   * "nothing to bring back" became the ordinary case — pressing it in a task
   * never reset must not be the fastest way to lose an afternoon's work.
   */
  undoReset(): void {
    const backup = readStorage(this.#storage, this.#buffer.backupKey);
    if (backup === null || backup === "") {
      return;
    }
    this.setCode(backup);
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
