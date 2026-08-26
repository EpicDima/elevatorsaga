/** The code editor: CodeMirror 6, plus persistence of the player's program. */

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  closeSearchPanel,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  searchKeymap,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import { Compartment, EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import type { Extension, Text } from "@codemirror/state";
import {
  crosshairCursor,
  Decoration,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

import { Observable } from "../game/observable.ts";
import { getCodeObjFromCode } from "../game/user-code.ts";
import type { UserCodeObject } from "../game/user-code.ts";
import { t } from "../i18n/index.ts";
import { editorSyntaxTheme } from "./code-highlight.ts";
import { playerApiCompletionSource } from "./completions.ts";
import { defaultCode } from "./default-code.ts";
import { locateCodeError } from "./error-location.ts";
import type { CodeErrorLocation } from "./error-location.ts";
import { localizeStarterCode } from "./starter-code.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import type { CodeSlot } from "#features/manage-code-slots/model/code-slots.ts";

/** Storage key for the player's own program; renaming it loses every saved program. */
export const CODE_STORAGE_KEY = "elevatorCrushCode_v5";

/** Where the program is copied before "Reset" overwrites it. */
export const BACKUP_STORAGE_KEY = "develevateBackupCode";

/**
 * Prefix for a learning-track level's storage key, one key per level id. Lives
 * under its own `develevate…` prefix so a player with both this fork and the
 * original game installed never has one read the other's data.
 */
const TUTORIAL_CODE_KEY_PREFIX = "develevateTutorialCode_";

/** Prefix for a level's "Undo reset" backup key; per level so a reset in one level cannot leak into another's undo. */
const TUTORIAL_BACKUP_KEY_PREFIX = "develevateTutorialBackupCode_";

/**
 * Prefix for a chapter one level+slot's storage key, one key per `(chapter1Index, slot)`
 * pair. Keep the spelling — renaming loses every already-saved program.
 */
const CHAPTER1_CODE_KEY_PREFIX = "develevateChallengeCode_";

/** Prefix of the per-`(chapter1Index, slot)` "Undo reset" backups. */
const CHAPTER1_BACKUP_KEY_PREFIX = "develevateChallengeBackupCode_";

function chapter1CodeKey(chapter1Index: number, slot: CodeSlot): string {
  return `${CHAPTER1_CODE_KEY_PREFIX}${String(chapter1Index)}_${String(slot)}`;
}

function chapter1BackupKey(chapter1Index: number, slot: CodeSlot): string {
  return `${CHAPTER1_BACKUP_KEY_PREFIX}${String(chapter1Index)}_${String(slot)}`;
}

/**
 * A key's spelling for one slot of the buffers that predate slots — the
 * player's own and the named levels'. The first slot keeps the bare key it was
 * always saved under, so nothing already stored goes missing; only the other
 * two carry a suffix. Chapter one's keys, written slot-suffixed from the start,
 * are spelled by {@link chapter1CodeKey} instead.
 */
function slotKey(key: string, slot: CodeSlot): string {
  return slot === DEFAULT_CODE_SLOT ? key : `${key}_${String(slot)}`;
}

/** How long typing must pause before the program is saved, in milliseconds. */
export const AUTOSAVE_DELAY_MS = 1000;

/** The indentation string; also used as CodeMirror's indent unit and tab size below. */
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
  /** The player asked for the program to be applied and the level restarted. */
  apply_code: [];
  /** The program was written to storage. */
  saved: [savedAt: Date];
  /**
   * The store refused a write, including autosaves the player never asked
   * for — every consumer showing "last saved" needs this to know when that
   * claim is false.
   */
  storage_refused: [];
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

/**
 * What a `setValue` call means for undo history: `"edit"` is a change the
 * player can undo; `"swap"` replaces the whole buffer and drops the old
 * buffer's undo history, so undo cannot leak a different program in.
 */
export type TextReplacement = "edit" | "swap";

/** The editing surface {@link CodeEditor} drives. */
export interface TextEditorView {
  /** Returns the whole document. */
  getValue: () => string;
  /**
   * Replaces the whole document. An `"edit"` raises
   * {@link TextEditorHandlers.onChange}; a `"swap"` does not, matching the
   * document the surface was built with.
   */
  setValue: (value: string, replacement?: TextReplacement) => void;
  /** Puts the caret back in the editor. */
  focus: () => void;
  /** Re-reads the surface's own labels — its accessible name, and CodeMirror's — from the catalog. */
  relocalize: () => void;
  /**
   * Marks where a program failed, or clears the mark for `undefined`. Never
   * moves the caret. A location the document can no longer contain also
   * clears the mark rather than being clamped to an unrelated line.
   */
  markError: (location: CodeErrorLocation | undefined) => void;
}

/** Builds an editing surface bound to the given handlers and starting document. */
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
 * What a store said when asked for a program. Three states rather than a
 * `null`, because "nothing here" (safe to write the starter code) and "would
 * not answer" (may be hiding unsaved work) must not be treated the same way.
 */
type StoredText =
  | { readonly state: "text"; readonly text: string }
  | { readonly state: "empty" }
  | { readonly state: "unreadable" };

/** Classifies a raw `getItem` result into a {@link StoredText}. */
function storedText(value: string | null): StoredText {
  return value === null || value === "" ? { state: "empty" } : { state: "text", text: value };
}

/** Reads a key from storage; safe against private-mode Safari, which throws from `getItem`. */
function readStorage(storage: Storage, key: string): StoredText {
  try {
    return storedText(storage.getItem(key));
  } catch {
    return { state: "unreadable" };
  }
}

/** Writes a key to storage; returns `false` instead of throwing if the store refuses. */
function writeStorage(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * One editable program: its storage key, backup key, and starter text. The
 * editor shows exactly one at a time, so all storage access goes through it.
 */
interface EditorBuffer {
  /** Where this buffer's text is stored between visits. */
  readonly codeKey: string;
  /** Where {@link CodeEditor.reset} parks the text before replacing it. */
  readonly backupKey: string;
  /**
   * The program {@link CodeEditor.reset} restores, and an empty buffer opens
   * with. Read fresh on each use, not held, so a language change is picked up
   * by an already-open buffer.
   */
  readonly starterCode: string;
  /**
   * Whether opening this buffer empty may write {@link EditorBuffer.starterCode}
   * into {@link EditorBuffer.codeKey}. False for the player's own buffer, whose
   * key must only ever be written by an explicit Save or Reset.
   */
  readonly writesStarterOnOpen: boolean;
}

/** Describes one slot of the player's own program; its first slot is the editor's initial buffer. */
function playerBuffer(slot: CodeSlot): EditorBuffer {
  return {
    codeKey: slotKey(CODE_STORAGE_KEY, slot),
    backupKey: slotKey(BACKUP_STORAGE_KEY, slot),
    get starterCode(): string {
      return defaultCode();
    },
    writesStarterOnOpen: false,
  };
}

/**
 * Describes one slot of a named level's buffer, keyed by the level's stable id
 * rather than its position in the track. Throws if `levelId` is blank.
 */
function namedLevelBuffer(levelId: string, starterCode: string, slot: CodeSlot): EditorBuffer {
  if (levelId.trim() === "") {
    throw new RangeError(`Level id must not be blank, got ${JSON.stringify(levelId)}`);
  }
  return {
    codeKey: slotKey(`${TUTORIAL_CODE_KEY_PREFIX}${levelId}`, slot),
    backupKey: slotKey(`${TUTORIAL_BACKUP_KEY_PREFIX}${levelId}`, slot),
    get starterCode(): string {
      return localizeStarterCode(starterCode);
    },
    writesStarterOnOpen: true,
  };
}

/** Describes one chapter one level's one code slot's buffer. */
function chapter1Buffer(chapter1Index: number, slot: CodeSlot, starterCode: string): EditorBuffer {
  return {
    codeKey: chapter1CodeKey(chapter1Index, slot),
    backupKey: chapter1BackupKey(chapter1Index, slot),
    get starterCode(): string {
      return localizeStarterCode(starterCode);
    },
    writesStarterOnOpen: true,
  };
}

/** The player's program: its text, its storage and its compilation. */
export class CodeEditor extends Observable<CodeEditorEvents> {
  readonly #view: TextEditorView;
  readonly #storage: Storage;
  /** The buffer on screen; every read and write of program text goes to it. */
  #buffer: EditorBuffer = playerBuffer(DEFAULT_CODE_SLOT);
  /**
   * Every key this editor has written, kept in memory for the life of the
   * page. Backs a switch between buffers when the store refuses writes (full
   * quota, private mode), so leaving a buffer never silently drops its program.
   */
  readonly #session = new Map<string, string>();
  /**
   * Whether the document has changed since this buffer was last written.
   * Guards the flush-on-leave: without it, an idle second tab holding a stale
   * document would overwrite a fresher save the moment its player switches levels.
   */
  #unsavedEdits = false;
  #autosaveTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  /**
   * The program {@link getCodeObj} last compiled, or `undefined` if none did.
   * Runtime errors report a line number in *this* text, which may already
   * differ from what is on screen — needed to refuse a stale error mark.
   */
  #runningCode: string | undefined = undefined;

  constructor(createView: TextEditorViewFactory, options: CodeEditorOptions = {}) {
    super();
    this.#storage = options.storage ?? localStorage;
    // Passed to the constructor rather than set afterwards: assigning would
    // raise onChange (queuing an autosave) and land in the undo history, so
    // the first Ctrl+Z would wipe the program the player arrived with.
    const existingCode = this.#read(this.#buffer.codeKey);
    const initialCode =
      existingCode.state === "text"
        ? localizeStarterCode(existingCode.text)
        : this.#buffer.starterCode;
    this.#view = createView(
      {
        onChange: () => {
          this.#unsavedEdits = true;
          this.#scheduleSave();
        },
        onApply: () => {
          this.trigger("apply_code");
        },
        onSave: () => {
          this.save();
        },
      },
      initialCode,
    );
    // Also raised on this object by the app when a compiled program throws
    // while running, so both failure paths reach the mark through one path.
    this.on("usercode_error", (error) => {
      this.#markThrownAt(error);
    });
  }

  /**
   * Underlines where a thrown error came from. Refused unless the document is
   * still the program that was compiled — a stale line number would underline
   * whatever the player has since typed there.
   */
  #markThrownAt(error: unknown): void {
    const running = this.#runningCode;
    if (running === undefined || running !== this.getCode()) {
      return;
    }
    this.#view.markError(locateCodeError(error, running));
  }

  /** Queues an autosave, restarting the countdown if one is already pending. */
  #scheduleSave(): void {
    this.#cancelSave();
    this.#autosaveTimer = setTimeout(() => {
      this.save();
    }, AUTOSAVE_DELAY_MS);
  }

  /**
   * Drops a pending autosave. Callers that have just written this buffer's
   * text themselves must call this, or the timer fires after a buffer switch
   * and overwrites the *new* buffer's text with the old one's.
   */
  #cancelSave(): void {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = undefined;
  }

  /**
   * Reads a key, preferring this session's copy over the store: the store may
   * be holding stale text if it previously refused a write.
   */
  #read(key: string): StoredText {
    const remembered = this.#session.get(key);
    return remembered === undefined ? readStorage(this.#storage, key) : storedText(remembered);
  }

  /**
   * Writes a key to the session and the store, announcing `storage_refused`
   * on failure so no caller can forget to handle it. Still returns whether it
   * succeeded, for the callers that must act on a refusal.
   */
  #write(key: string, value: string): boolean {
    this.#session.set(key, value);
    if (writeStorage(this.#storage, key, value)) {
      return true;
    }
    this.trigger("storage_refused");
    return false;
  }

  /** The current program text. */
  getCode(): string {
    return this.#view.getValue();
  }

  /** Replaces the program text. */
  setCode(code: string): void {
    this.#view.setValue(code);
  }

  /** Compiles the program, returning `null` if it did not compile. */
  getCodeObj(): UserCodeObject | null {
    const code = this.getCode();
    // Cleared first: any existing mark is a claim about a run that just
    // ended, and a fresh throw on the same line will mark it again.
    this.#view.markError(undefined);
    try {
      const codeObj = getCodeObjFromCode(code);
      this.#runningCode = code;
      this.trigger("code_success");
      return codeObj;
    } catch (e) {
      // Cleared rather than left at the last program that did compile: a
      // failed compilation still ends the previous run, so nothing here is
      // running that could throw.
      this.#runningCode = undefined;
      this.trigger("usercode_error", e);
      return null;
    }
  }

  /** Writes the program to storage and announces the change. */
  save(): void {
    this.#cancelSave();
    // Cleared regardless of success: `#write` remembers the text in-session
    // either way, so nothing is lost even if the store refuses.
    this.#unsavedEdits = false;
    // "saved" fires only on success: after a refusal the program survives
    // only for this tab, and the message would promise otherwise.
    if (this.#write(this.#buffer.codeKey, this.getCode())) {
      this.trigger("saved", new Date());
    }
    this.trigger("change");
  }

  /** Shows one slot of the player's own program, keeping whatever was on screen. */
  openPlayerBuffer(slot: CodeSlot = DEFAULT_CODE_SLOT): void {
    this.#openBuffer(playerBuffer(slot));
  }

  /**
   * Shows a level's own attempt in one slot, or `starterCode` if that slot has
   * none, keeping whatever was on screen. The storage prefix is
   * `develevateTutorialCode_` for legacy reasons and must not be renamed, or
   * every saved attempt is lost.
   */
  openNamedLevelBuffer(
    levelId: string,
    starterCode: string,
    slot: CodeSlot = DEFAULT_CODE_SLOT,
  ): void {
    this.#openBuffer(namedLevelBuffer(levelId, starterCode, slot));
  }

  /** Shows one chapter one level's one code slot, keeping whatever was on screen. */
  openChapter1Buffer(chapter1Index: number, slot: CodeSlot = DEFAULT_CODE_SLOT): void {
    // Flushed before resolving the starter code: the legacy fallback key can
    // be the very key still on screen, and resolving first would read it
    // before this keystroke's text reaches it.
    this.#flush();
    const starterCode = this.#resolveChapter1StarterCode(chapter1Index, slot);
    this.#openBuffer(chapter1Buffer(chapter1Index, slot, starterCode));
  }

  /**
   * The starter code for a chapter one level's slot when the slot itself is empty: the
   * newest lower-numbered level's same slot that has one, or — for the
   * default slot only — the legacy single-buffer program, or else the bare default.
   */
  #resolveChapter1StarterCode(chapter1Index: number, slot: CodeSlot): string {
    for (let i = chapter1Index - 1; i >= 0; i -= 1) {
      const stored = this.#read(chapter1CodeKey(i, slot));
      if (stored.state === "text") {
        return stored.text;
      }
    }
    if (slot === DEFAULT_CODE_SLOT) {
      const stored = this.#read(CODE_STORAGE_KEY);
      if (stored.state === "text") {
        return stored.text;
      }
    }
    return defaultCode();
  }

  /** Puts `next` on screen, flushing the buffer currently on screen first. */
  #openBuffer(next: EditorBuffer): void {
    if (next.codeKey === this.#buffer.codeKey) {
      // Same key already on screen: skip the reload (it would move the caret
      // and clear undo for nothing) but still take the new starter text,
      // since a language change may have translated it since last time.
      this.#buffer = next;
      return;
    }
    // Flushed before the switch: this is the last chance, since the pending
    // autosave is about to be canceled.
    this.#flush();
    this.#buffer = next;
    const stored = this.#read(next.codeKey);
    if (stored.state === "text") {
      // Localized because this may be a starter program this editor wrote in
      // another language; the player's own text passes through unchanged.
      this.#swapDocument(localizeStarterCode(stored.text));
    } else {
      // Nothing stored. An empty entry may be written with the starter code;
      // a refusal to answer may be hiding unsaved work, so only "empty" is
      // treated as safe to write.
      if (stored.state === "empty" && next.writesStarterOnOpen) {
        // Written immediately rather than waiting for an autosave, so the
        // level shown is the level a player returns to even untouched.
        this.#write(next.codeKey, next.starterCode);
      }
      this.#swapDocument(next.starterCode);
    }
    // Nothing here is unsaved: this text just came from storage or was just
    // written to it, not typed.
    this.#unsavedEdits = false;
    this.#cancelSave();
    // Raised even though nobody typed: listeners describing the editor's
    // contents (e.g. the fitness measurement) are stale until they see this.
    this.trigger("change");
  }

  /**
   * Puts another buffer's program on screen, never via {@link CodeEditor.setCode}:
   * an edit can be undone, which would leak one buffer's program into another's key.
   */
  #swapDocument(code: string): void {
    this.#view.setValue(code, "swap");
  }

  /**
   * Writes the text on screen back to its buffer, silently, if the player has
   * changed it. Does nothing when nothing has been typed.
   */
  #flush(): void {
    if (!this.#unsavedEdits) {
      return;
    }
    const code = this.getCode();
    const stored = this.#read(this.#buffer.codeKey);
    if (stored.state !== "text" && code === this.#buffer.starterCode) {
      // Guards the player who typed and then deleted back to the starter
      // text: `#unsavedEdits` is true, but writing now would create their key
      // on their behalf, making an untouched install look like a played one.
      return;
    }
    this.#write(this.#buffer.codeKey, code);
  }

  /**
   * Backs the program up and replaces it with the starter program. Returns
   * `false` if the store refused the backup, in which case nothing is changed.
   */
  reset(): boolean {
    const code = this.getCode();
    if (code === "" || code === this.#buffer.starterCode) {
      // Skips the backup: there is nothing here worth saving, and backing up
      // the starter program itself would overwrite a real backup from an
      // earlier reset, making "Undo reset" bring back nothing.
      this.setCode(this.#buffer.starterCode);
      return true;
    }
    if (
      !this.#write(this.#buffer.backupKey, code) &&
      // Reads the store directly (not `#read`) because the question is what
      // the store itself holds: a store that refuses writes, or refuses
      // reads too, has nothing to lose by "failing" this check.
      readStorage(this.#storage, this.#buffer.codeKey).state === "text"
    ) {
      // A quota looks like exactly this: the store took the program but
      // refuses a second key. Resetting anyway would let the next autosave
      // overwrite the stored program with the (smaller) starter text.
      return false;
    }
    this.setCode(this.#buffer.starterCode);
    return true;
  }

  /** Restores the program to before the last {@link CodeEditor.reset} of this buffer, or does nothing if there is no backup. */
  undoReset(): void {
    const backup = this.#read(this.#buffer.backupKey);
    if (backup.state !== "text") {
      return;
    }
    this.setCode(backup.text);
  }

  /**
   * Whether {@link CodeEditor.undoReset} would restore something: the
   * document is exactly the starter program, with a backup behind it — not
   * "backup differs from current text", which one keystroke could re-arm.
   */
  canUndoReset(): boolean {
    if (this.getCode() !== this.#buffer.starterCode) {
      return false;
    }
    return this.#read(this.#buffer.backupKey).state === "text";
  }

  /**
   * Re-renders the on-screen program in the active language, but only if it is
   * a starter program the game wrote (never the player's own text). Storage is
   * left alone; {@link localizeStarterCode} makes stale copies harmless to read.
   * The surface's own labels are re-read either way — they belong to the game.
   */
  relocalize(): void {
    this.#view.relocalize();
    const code = this.getCode();
    const localized = localizeStarterCode(code);
    if (localized === code) {
      return;
    }
    // A swap, not an edit: the player didn't do this, and an undo that
    // brought back the other language would be a puzzle, not a mercy.
    this.#swapDocument(localized);
    // The program changed without a keystroke, so anything measuring or
    // compiling the old text is now stale.
    this.trigger("change");
  }

  /** Puts the caret back in the editing surface. */
  focus(): void {
    this.#view.focus();
  }

  /**
   * Marks where the running program failed, or clears the mark. Not derived
   * from {@link CodeEditor.getCodeObj}: most failures surface long after
   * compilation, once the world is running and something throws mid-frame.
   */
  markError(location: CodeErrorLocation | undefined): void {
    this.#view.markError(location);
  }
}

/**
 * Carries a new error mark, or `undefined` to clear it. A state effect
 * because CodeMirror state can only change through a transaction.
 */
const showErrorMark = StateEffect.define<CodeErrorLocation | undefined>();

/**
 * How a failing line is underlined: a wavy line in `--ds-bad`, not a
 * background wash — the code palette has no contrast headroom left to tint
 * text without pushing a comment below its required contrast ratio.
 */
const errorMark = Decoration.mark({ class: "cm-errorMark" });

/**
 * The range to underline for a reported failure: from the failing column to
 * the end of its line (the stack gives no end position). Returns `undefined`
 * for a line the document no longer has, or an empty one, since there is
 * nothing there to clamp a mark to.
 */
function errorRange(
  doc: Text,
  location: CodeErrorLocation,
): { from: number; to: number } | undefined {
  if (location.line < 1 || location.line > doc.lines) {
    return undefined;
  }
  const line = doc.line(location.line);
  if (line.from === line.to) {
    return undefined;
  }
  // Clamped at both ends: past the line's end would mark nothing; before its
  // start would reach into the line above.
  const from = Math.min(line.from + Math.max(0, location.column - 1), line.to - 1);
  return { from, to: line.to };
}

/**
 * Holds the error mark; any document edit clears it, since the mark's claim
 * about failing text is void the moment that text changes.
 */
const errorMarkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (marks, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(showErrorMark)) {
        const location = effect.value;
        const range = location === undefined ? undefined : errorRange(transaction.newDoc, location);
        return range === undefined
          ? Decoration.none
          : Decoration.set([errorMark.range(range.from, range.to)]);
      }
    }
    return transaction.docChanged ? Decoration.none : marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * The `basicSetup` bundle from `codemirror`, spelled out and trimmed: no
 * `lintKeymap` (nothing here configures a linter) and no fallback highlight
 * style ({@link editorSyntaxTheme} is registered as the real one below).
 */
const BASE_EXTENSIONS: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
  ]),
];

/**
 * CodeMirror's own labels — the search panel, the fold gutter, what it announces to a screen
 * reader — keyed by the English phrase its packages pass to `state.phrase()`. Anything missing
 * here is shown in English, whatever language the page is in.
 */
function editorPhrases(): Record<string, string> {
  return {
    // @codemirror/search: the panel Mod-F opens, and the one Mod-Alt-G opens.
    Find: t("editor.phrase.find"),
    Replace: t("editor.phrase.replace"),
    next: t("editor.phrase.next"),
    previous: t("editor.phrase.previous"),
    all: t("editor.phrase.all"),
    "match case": t("editor.phrase.matchCase"),
    regexp: t("editor.phrase.regexp"),
    "by word": t("editor.phrase.byWord"),
    replace: t("editor.phrase.replaceOne"),
    "replace all": t("editor.phrase.replaceAll"),
    "Go to line": t("editor.phrase.goToLine"),
    go: t("editor.phrase.go"),
    "current match": t("editor.phrase.currentMatch"),
    "on line": t("editor.phrase.onLine"),
    "replaced $ matches": t("editor.phrase.replacedMatches"),
    "replaced match on line $": t("editor.phrase.replacedOnLine"),
    // @codemirror/view: the search panel's close button, and a control character's placeholder.
    close: t("editor.phrase.close"),
    "Control character": t("editor.phrase.controlCharacter"),
    // @codemirror/language: the fold gutter, its placeholder, and what folding announces.
    "Fold line": t("editor.phrase.foldLine"),
    "Unfold line": t("editor.phrase.unfoldLine"),
    "folded code": t("editor.phrase.foldedCode"),
    unfold: t("editor.phrase.unfold"),
    // Both run "<phrase> 3 <to> 7.", so the Russian puts its preposition in the first half.
    "Folded lines": t("editor.phrase.foldedLines"),
    "Unfolded lines": t("editor.phrase.unfoldedLines"),
    to: t("editor.phrase.to"),
    // @codemirror/autocomplete, then @codemirror/commands.
    Completions: t("editor.phrase.completions"),
    "Selection deleted": t("editor.phrase.selectionDeleted"),
  };
}

/** Builds a factory that mounts a CodeMirror 6 editing surface into `parent`. */
export function codeMirrorView(parent: HTMLElement): TextEditorViewFactory {
  return (handlers: TextEditorHandlers, initialValue: string): TextEditorView => {
    // In a compartment so `relocalize` can swap the labels without rebuilding the view.
    const localized = new Compartment();
    /** Every label the surface reads from the catalog, at the language active right now. */
    const localizedExtensions = (): Extension => [
      EditorView.contentAttributes.of({ "aria-label": t("editor.label") }),
      EditorState.phrases.of(editorPhrases()),
    ];
    // Kept in a variable, not inlined: a "swap" below rebuilds a second
    // state from these same extensions.
    const extensions = [
      BASE_EXTENSIONS,
      javascript(),
      // Added as a completion source, not via `autocompletion({override})`,
      // which would replace the language's own keyword/snippet/identifier
      // completions instead of adding to them.
      javascriptLanguage.data.of({ autocomplete: playerApiCompletionSource }),
      // The editor's only highlighter, tuned for its near-black surface.
      syntaxHighlighting(editorSyntaxTheme),
      indentUnit.of(INDENT),
      EditorState.tabSize.of(INDENT.length),
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
            // Inserts spaces rather than moving focus; Escape (below) is the way out.
            key: "Tab",
            preventDefault: true,
            run: (target) => {
              target.dispatch(target.state.replaceSelection(INDENT));
              return true;
            },
          },
          {
            // Tab is bound above, so without this the editor is a keyboard
            // trap; Escape moves focus to the wrapper so Tab can continue out.
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
      errorMarkField,
      EditorView.theme({
        ".cm-errorMark": {
          // Wavy, not a straight rule, so it cannot be misread as an
          // underscore or a link.
          textDecoration: "underline wavy var(--ds-bad)",
          // A fixed length, not an em: the wave's amplitude doesn't scale
          // with font size, so neither should the offset that clears it.
          textUnderlineOffset: "3px",
        },
      }),
    ];
    /** The whole configuration, with the labels read at whatever language is active now. */
    const stateExtensions = (): Extension => [extensions, localized.of(localizedExtensions())];
    const view = new EditorView({ parent, doc: initialValue, extensions: stateExtensions() });
    view.dom.tabIndex = -1;

    return {
      getValue: () => view.state.doc.toString(),
      setValue: (value: string, replacement: TextReplacement = "edit") => {
        if (replacement === "swap") {
          // A whole new state, not a filtered one: CodeMirror offers no
          // command that empties `history()`, and a fresh state guarantees no
          // stale history from the previous buffer can resurface.
          view.setState(EditorState.create({ doc: value, extensions: stateExtensions() }));
          return;
        }
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value },
          selection: { anchor: 0 },
        });
      },
      focus: () => {
        view.focus();
      },
      relocalize: () => {
        view.dispatch({ effects: localized.reconfigure(localizedExtensions()) });
        // A search panel already on screen wrote its labels in its constructor and re-reads
        // them only when rebuilt. Its query is restored by hand, since reopening a panel
        // otherwise takes the query from whatever happens to be selected.
        if (searchPanelOpen(view.state)) {
          const query = getSearchQuery(view.state);
          closeSearchPanel(view);
          openSearchPanel(view);
          view.dispatch({ effects: setSearchQuery.of(query) });
        }
      },
      markError: (location: CodeErrorLocation | undefined) => {
        const range = location === undefined ? undefined : errorRange(view.state.doc, location);
        view.dispatch({
          effects:
            range === undefined
              ? [showErrorMark.of(location)]
              : // Scrolled into view as well as drawn: the mark is useless if
                // the editor is short enough that nobody can see it.
                [showErrorMark.of(location), EditorView.scrollIntoView(range.from)],
        });
      },
    };
  };
}
