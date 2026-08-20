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
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";

import { Observable } from "../game/observable.ts";
import { getCodeObjFromCode } from "../game/user-code.ts";
import type { UserCodeObject } from "../game/user-code.ts";
import { t } from "../i18n/index.ts";
import { editorSyntaxTheme } from "./code-highlight.ts";
import { playerApiCompletionSource } from "./completions.ts";
import { defaultCode } from "./default-code.ts";
import { locateCodeError } from "./error-location.ts";
import type { CodeErrorLocation } from "./error-location.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import type { CodeSlot } from "#features/manage-code-slots/model/code-slots.ts";

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
 * The task's identifier is part of the key — one key per task, not one key
 * holding all eight — so that a player who left task 3 half-written finds their
 * own attempt when they come back, "start over" is an operation on exactly one
 * task, and an entry that somehow becomes unreadable cannot take the other
 * seven down with it. Not exported: which keys exist, and how they are spelled,
 * is the editor's business alone.
 *
 * The identifier is the task's own `id` and goes in whole, which spells
 * `develevateTutorialCode_tutorial-3` and repeats the word. The repetition is
 * the cheaper half of the trade: the id is opaque here, and trimming a prefix
 * off it would be this file assuming a shape that `TutorialTask.id` explicitly
 * does not promise to keep.
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

/**
 * Prefix of the storage keys holding a level's three code slots.
 *
 * One key per `(levelIndex, slot)` pair, for the same reason the learning
 * track has one key per task: a player who left level 7 with a program in
 * it must find that program again on level 7, and only there, however
 * many levels they visit in between.
 *
 * The prefix keeps the spelling a level had when the key was first written.
 * Renaming it would say nothing to a player -- nobody reads a storage key --
 * and would lose the program every browser that already holds one saved.
 */
const LEVEL_CODE_KEY_PREFIX = "develevateChallengeCode_";

/** Prefix of the per-`(levelIndex, slot)` "Undo reset" backups. */
const LEVEL_BACKUP_KEY_PREFIX = "develevateChallengeBackupCode_";

/**
 * The storage key of one level's one code slot.
 *
 * @param levelIndex - Zero-based index of the level.
 * @param slot - Which of the level's three slots.
 * @returns The key that slot's program is stored under.
 */
function levelCodeKey(levelIndex: number, slot: CodeSlot): string {
  return `${LEVEL_CODE_KEY_PREFIX}${String(levelIndex)}_${String(slot)}`;
}

/**
 * The storage key of one level's one code slot's "Undo reset" backup.
 *
 * @param levelIndex - Zero-based index of the level.
 * @param slot - Which of the level's three slots.
 * @returns The key that slot's backup is stored under.
 */
function levelBackupKey(levelIndex: number, slot: CodeSlot): string {
  return `${LEVEL_BACKUP_KEY_PREFIX}${String(levelIndex)}_${String(slot)}`;
}

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
  /** The player asked for the program to be applied and the level restarted. */
  apply_code: [];
  /** The program was written to storage. */
  saved: [savedAt: Date];
  /**
   * The store refused a write. The text is in this page and nowhere else.
   *
   * Raised for every refused write, including the ones the player did not ask
   * for, because the fact is the same one every time: nothing typed since is
   * going to survive the tab being closed. An interface that shows when a
   * program was last saved owes the player this too — a line that says "Code
   * saved 14:32" and nothing else while every write fails is worse than no line
   * at all, and the editor is the only thing here that knows.
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
 * What a {@link TextEditorView.setValue} call means for the editing history.
 *
 * `"edit"` — the new text is another state of the program on screen, reached
 * by "Reset" or "Undo reset". The player may undo their way back through it,
 * as they could in the legacy game.
 *
 * `"swap"` — a different program takes the place of this one, because the
 * editor moved to another buffer. The history of the old program has to go with
 * it: undoing across a swap puts one buffer's program on screen while another
 * buffer is open, and the autosave a second later writes it to that buffer's
 * key. The player's own program can be destroyed that way in a single
 * keystroke, which is what makes this a separate kind rather than a flag on
 * the same one.
 */
export type TextReplacement = "edit" | "swap";

/** The editing surface {@link CodeEditor} drives. */
export interface TextEditorView {
  /** Returns the whole document. */
  getValue: () => string;
  /**
   * Replaces the whole document.
   *
   * An `"edit"` is a document change like any other, so the surface raises
   * {@link TextEditorHandlers.onChange} for it — replacing the program from
   * "Reset" or "Undo reset" autosaves, as it did in the legacy game. The document the surface is *built* with does not, which is why it is
   * passed to the factory instead of being assigned afterwards; a `"swap"` is
   * the same thing mid-life, and raises nothing either.
   *
   * @param value - The new document.
   * @param replacement - What the new text has to do with the old; `"edit"`
   * unless said otherwise.
   */
  setValue: (value: string, replacement?: TextReplacement) => void;
  /** Puts the caret back in the editor. */
  focus: () => void;
  /**
   * Marks the place a program failed, or takes an existing mark away.
   *
   * Drawn rather than selected, and it never moves the caret: the mark arrives
   * while the player is reading or typing somewhere else, and an editor that
   * jumps the cursor out from under them to say so has taken more than it gave.
   *
   * @param location - Where the failure was, or `undefined` to clear the mark.
   * A location the document cannot contain — because it has since been edited,
   * or replaced by another buffer — clears it too, rather than being clamped to
   * a line that had nothing to do with the failure.
   */
  markError: (location: CodeErrorLocation | undefined) => void;
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
 * What a store said when it was asked for a program.
 *
 * Three answers rather than two, and a shape the compiler makes callers open
 * before they can read the text. "There is nothing here" and "I will not tell
 * you" used to arrive as the same `null`, and the difference decides whether it
 * is safe to write: a store with nothing in it wants the task's starting point
 * written into it, and a store that would not answer may be holding an
 * afternoon's work that the same write would destroy.
 *
 * `"empty"` covers a missing key and a key holding `""` alike. An entry emptied
 * by hand, or by a write that ran out of room mid-string, is no more use than a
 * missing one, and every caller here treated the two the same way — one rule in
 * one place is one rule that cannot be applied inconsistently.
 */
type StoredText =
  | { readonly state: "text"; readonly text: string }
  | { readonly state: "empty" }
  | { readonly state: "unreadable" };

/**
 * Classifies what a store handed back.
 *
 * @param value - What `getItem` returned.
 * @returns The text, or the fact that there is none.
 */
function storedText(value: string | null): StoredText {
  return value === null || value === "" ? { state: "empty" } : { state: "text", text: value };
}

/**
 * Reads a key from storage, saying so when the store would not answer.
 *
 * Safari in private mode throws from `localStorage.getItem`, and a player whose
 * browser refuses storage should still be able to play.
 *
 * @param storage - The store to read.
 * @param key - The key to read.
 * @returns What the store had, or the fact that it would not say.
 */
function readStorage(storage: Storage, key: string): StoredText {
  try {
    return storedText(storage.getItem(key));
  } catch {
    return { state: "unreadable" };
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

/**
 * The buffer holding the player's own program, which the editor opens with.
 *
 * `starterCode` is a getter, not a value: the program is a translated string,
 * and this object is built when the module is imported, which is before the
 * player's locale has been resolved. Reading it per use is also what makes
 * "is this still the starter program?" mean the right thing after a language
 * change — the English program a player was handed is no longer what Reset
 * would give them, so it counts as theirs and gets backed up rather than
 * silently discarded.
 */
const PLAYER_BUFFER: EditorBuffer = {
  codeKey: CODE_STORAGE_KEY,
  backupKey: BACKUP_STORAGE_KEY,
  get starterCode(): string {
    return defaultCode();
  },
  writesStarterOnOpen: false,
};

/**
 * Describes the buffer of one learning-track task.
 *
 * Keyed by the task's stable identifier rather than by its position in the
 * track, because the position is the one thing about a task that is expected to
 * change. `TutorialTask.id` in `src/game/tutorial.ts` says so itself, and the
 * program a player left half-written is precisely "a task surviving being
 * written down": key it by position and the day a ninth task is inserted at
 * number two, everybody's attempt at task 2 is handed to whoever opens the new
 * one, and the attempts at 3 through 8 all shift by one. Nothing warns anyone —
 * the text is still there, it is simply filed under somebody else's task.
 *
 * The identifier is taken as an opaque string. This file cannot check it
 * against the task table without importing the track it is meant to know
 * nothing about; what it can do is refuse the one value that is nobody's task
 * and would still spell a real key, and let the caller's own lookup — which
 * must already have found the starter program below — answer the rest.
 *
 * @param taskId - The task's stable identifier, such as `tutorial-3`.
 * @param starterCode - The program the task hands the player to complete.
 * @returns The buffer for that task.
 * @throws RangeError When `taskId` has no visible characters. Identifiers reach
 * the game from a URL the player can type by hand, and an empty one spells the
 * bare prefix — one shared key that every malformed route would pour its text
 * into.
 */
function tutorialBuffer(taskId: string, starterCode: string): EditorBuffer {
  if (taskId.trim() === "") {
    throw new RangeError(`Tutorial task id must not be blank, got ${JSON.stringify(taskId)}`);
  }
  return {
    codeKey: `${TUTORIAL_CODE_KEY_PREFIX}${taskId}`,
    backupKey: `${TUTORIAL_BACKUP_KEY_PREFIX}${taskId}`,
    starterCode,
    writesStarterOnOpen: true,
  };
}

/**
 * Describes the buffer of one level's one code slot.
 *
 * @param levelIndex - Zero-based index of the level.
 * @param slot - Which of the level's three slots.
 * @param starterCode - The program to show when the slot has nothing of its
 * own — the resolved carry-forward or legacy program, never the bare default:
 * see {@link CodeEditor.#resolveLevelStarterCode}.
 * @returns The buffer for that level and slot.
 */
function levelBuffer(levelIndex: number, slot: CodeSlot, starterCode: string): EditorBuffer {
  return {
    codeKey: levelCodeKey(levelIndex, slot),
    backupKey: levelBackupKey(levelIndex, slot),
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
  /**
   * Every key this editor has written, kept for as long as the page lives.
   *
   * A store that refuses to be written to — a full quota, a private window —
   * used to cost the player nothing, because the editor never replaced the
   * document behind their back: what they could see was still there. With
   * buffers it would cost them the program. Leaving a buffer would write
   * nowhere, coming back would read nothing, and the starting program would
   * take the screen, all without an error to show for it. Remembering the text
   * in the page keeps a switch lossless for as long as the tab is open, which
   * is as long as anything can be promised when nothing can be stored.
   *
   * The alternative — refusing to leave a buffer whose text could not be
   * written — was rejected: it would jam the learning track completely in
   * exactly the private windows it is supposed to survive.
   */
  readonly #session = new Map<string, string>();
  /**
   * Whether the document has changed since this buffer was last written.
   *
   * The editor writes on the way out of a buffer, and it must write *only* on
   * the way out of a buffer somebody edited. A second tab left open on the same
   * game holds an older program on screen and does not know it: the moment its
   * player clicks into a task, an unconditional write would put that stale
   * program into storage over the afternoon's work the first tab saved there.
   * Before there were buffers there was nothing to leave, so an idle tab wrote
   * nothing until somebody typed in it, and that is the property being kept.
   */
  #unsavedEdits = false;
  #autosaveTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  /**
   * The program {@link getCodeObj} last compiled, or `undefined` if none did.
   *
   * A runtime error arrives from the running world, which may be several
   * seconds and any number of keystrokes after the program that raised it was
   * compiled. Its line numbers count lines of *that* text. Holding on to it is
   * what lets the mark be refused when the document has moved on, rather than
   * underlining whatever has since drifted onto line 4.
   */
  #runningCode: string | undefined = undefined;

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
    const existingCode = this.#read(this.#buffer.codeKey);
    const initialCode =
      existingCode.state === "text" ? existingCode.text : this.#buffer.starterCode;
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
    // The editor listens to its own event. `usercode_error` is raised here for a
    // program that will not compile, and raised on this same object by the app
    // for one that compiled and then threw while the world was running; both
    // reach the mark this way, and neither needs the app to know the mark
    // exists.
    this.on("usercode_error", (error) => {
      this.#markThrownAt(error);
    });
  }

  /**
   * Underlines the line of the program an exception came from.
   *
   * Refused unless the document still is the program that was compiled. The
   * player can edit while the world runs — watching it go wrong is what
   * prompts the edit — and a line number counted in the text they have since
   * changed points at whatever has moved into that position. An underline in
   * the wrong place is worse than none: it is a claim, and the player has no
   * way to tell it is stale.
   *
   * Editing after the mark is drawn is the other half of the same problem, and
   * is handled where the mark lives: any document change clears it.
   *
   * @param error - Whatever the player's code threw.
   */
  #markThrownAt(error: unknown): void {
    const running = this.#runningCode;
    if (running === undefined || running !== this.getCode()) {
      return;
    }
    this.#view.markError(locateCodeError(error, running));
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
   * this, or the countdown started by the keystroke before it fires afterwards.
   * Across a buffer switch that is worse than redundant: by the time it goes
   * off the buffer on screen is the next one, so it writes that buffer's own
   * text back over itself and announces "Code saved ..." for a save nobody
   * asked for — and it is only the writing-back-over-itself that keeps it from
   * being one task's work under another task's key, which is a property of the
   * switch having stored the new text a moment earlier, not of the countdown
   * being harmless.
   */
  #cancelSave(): void {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = undefined;
  }

  /**
   * Reads a key, from this session if this editor has written it.
   *
   * The session wins over the store rather than the other way round: the two
   * agree whenever the store accepts writes, and when it does not, the session
   * holds the newer text. Reading the store first would then hand back the last
   * text that happened to fit, which is a stale program, not a missing one —
   * the harder kind of loss to notice.
   *
   * @param key - The key to read.
   * @returns The text, or `null` when neither remembers any.
   */
  #read(key: string): StoredText {
    const remembered = this.#session.get(key);
    return remembered === undefined ? readStorage(this.#storage, key) : storedText(remembered);
  }

  /**
   * Writes a key, to this session as well as to the store, and says so when the
   * store refuses.
   *
   * Every write in this class comes through here, and the announcement is made
   * here rather than left to the caller on purpose. A refused write used to be
   * a `boolean` that four callers could each forget to look at, and three of
   * them did; TypeScript has no way to insist that a returned value is read, so
   * "remember to check" is all such a design can offer, and it is the kind of
   * promise that holds until the fifth caller is written. What cannot be
   * forgotten is what happens by itself: the failure is announced from the one
   * place every write already goes through, whether or not the caller looks at
   * the answer. The answer is still returned, for the two callers that must
   * *act* on it rather than merely report it.
   *
   * @param key - The key to write.
   * @param value - The text to keep.
   * @returns Whether the text reached the store, and so the next visit.
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

  /**
   * Replaces the program text.
   *
   * @param code - The program to show.
   */
  setCode(code: string): void {
    this.#view.setValue(code);
  }

  /**
   * Compiles the program.
   *
   * @returns The compiled program, or `null` when it did not compile.
   */
  getCodeObj(): UserCodeObject | null {
    const code = this.getCode();
    // Cleared before anything else: whatever the last run underlined, it was a
    // claim about a run that is over. A program that compiles and then throws
    // on the same line marks it again a moment later.
    this.#view.markError(undefined);
    try {
      const codeObj = getCodeObjFromCode(code);
      this.#runningCode = code;
      this.trigger("code_success");
      return codeObj;
    } catch (e) {
      // Forgotten rather than left as it was. It would be tempting to keep the
      // last program that did compile, on the grounds that it is still the one
      // running -- but it is not: the app starts the world with a no-op
      // whenever this returns `null` (`app.ts`, `#startRun`), so a failed
      // compilation ends the previous run as surely as a successful one. What
      // is running afterwards is incapable of throwing, and this field must not
      // claim otherwise.
      this.#runningCode = undefined;
      this.trigger("usercode_error", e);
      return null;
    }
  }

  /** Writes the program to storage and announces the change. */
  save(): void {
    this.#cancelSave();
    // Cleared whether or not the store takes it: `#write` remembers every key
    // it has written for as long as the page lives, so the text is not lost
    // either way, and a store that refused this write will refuse the next one.
    this.#unsavedEdits = false;
    // Announced only when it reached the store: after a refused write the
    // program is safe for as long as the tab is open and no longer, and
    // "Code saved ..." would be promising the player their next visit.
    if (this.#write(this.#buffer.codeKey, this.getCode())) {
      this.trigger("saved", new Date());
    }
    this.trigger("change");
  }

  /**
   * Shows the sandbox's own program again, keeping whatever was on screen.
   *
   * Takes no program to fall back on, and that is the point: the only text this
   * can ever put on screen is the legacy single-buffer program, so no caller
   * can hand its key somebody else's starter code by mistake. The sandbox is
   * the last caller left: every numbered level has its own buffer now (see
   * {@link CodeEditor.openLevelBuffer}), and this key lives on beneath it
   * only as the one-time migration source {@link CodeEditor.#resolveLevelStarterCode}
   * reads for level 1's first slot.
   */
  openPlayerBuffer(): void {
    this.#openBuffer(PLAYER_BUFFER);
  }

  /**
   * Keeps `code` as the player's own program without putting it on screen.
   *
   * For the learning track's "take this program" button, which copies a task's
   * program across while leaving the player on the task. Storing it through the
   * editor rather than in the caller is not tidiness: this class reads the copy
   * it keeps of every key it has written this page *before* it reads the store
   * (see {@link CodeEditor.#read}), so a write that goes round it leaves the two
   * disagreeing, with the store holding the taken program and the editor still
   * believing the player's old one. {@link CodeEditor.openLevelBuffer} would
   * then put that old program back on screen the moment the player left the
   * track, and the next save would write it over the copy they had just taken.
   *
   * Level 1's first slot specifically, never wherever the player happens to
   * be: leaving the track always lands on that slot (see
   * {@link "../pages/game/index.ts"!App.leaveTutorial}), so it is the one buffer
   * guaranteed to be the one on screen the moment they get there.
   *
   * @param code - The program to keep as the player's own.
   * @returns Whether it reached the store, and so the player's next visit.
   */
  writePlayerCode(code: string): boolean {
    return this.#write(levelCodeKey(0, DEFAULT_CODE_SLOT), code);
  }

  /**
   * The program {@link CodeEditor.writePlayerCode} would put on screen.
   *
   * The counterpart of {@link CodeEditor.writePlayerCode}, and there for the
   * same reason: a caller that reads the key out of the store answers a
   * different question from the one it means to ask. What the player would
   * see, and what taking a task's program would replace, is what this class
   * holds — the store agrees with it only while the store is accepting writes.
   * In a private window, or against a full quota, the program the player typed
   * is in this session and nowhere else, and the store's answer is that they
   * have never written one. That is the moment they have most to lose.
   *
   * Level 1's first slot specifically, never whichever buffer is on screen:
   * which buffer is on screen makes no difference to what this returns, so the
   * learning track can ask about the program waiting behind it.
   *
   * @returns The program, or `null` when neither this session nor the store has
   * one — including when the store refuses to say, which is not the same fact
   * but leads to the same answer: nothing recoverable is known to be there.
   */
  readPlayerCode(): string | null {
    const stored = this.#read(levelCodeKey(0, DEFAULT_CODE_SLOT));
    return stored.state === "text" ? stored.text : null;
  }

  /**
   * Shows one learning-track task's program, keeping whatever was on screen.
   *
   * The task's own attempt if there is one, otherwise `starterCode`. Callers
   * name a task, never a storage key: a method taking a key can be handed the
   * player's key together with a task's starter program, and the player's
   * program is gone. There is no such call to make here.
   *
   * @param taskId - The task's stable identifier, as `TutorialTask.id` spells
   * it; the same string the route names, so nothing has to be derived.
   * @param starterCode - The program the task starts from, used only when the
   * task has nothing stored yet. Also what {@link CodeEditor.reset} restores
   * while the task is open, so passing the text in the player's current
   * language keeps "start over" in that language. `TutorialTask.startingCode`
   * renders it at the moment it is read, so a caller that reads it into this
   * call is handing over the language chosen by then; the string is kept as it
   * arrived, and a task opened again hands over a fresh one.
   */
  openTutorialBuffer(taskId: string, starterCode: string): void {
    this.#openBuffer(tutorialBuffer(taskId, starterCode));
  }

  /**
   * Shows one level's one code slot, keeping whatever was on screen.
   *
   * The slot's own attempt if there is one, otherwise the starter program
   * {@link CodeEditor.#resolveLevelStarterCode} resolves for it. Callers
   * name a level and a slot, never a storage key, for the same reason
   * {@link CodeEditor.openTutorialBuffer} does.
   *
   * @param levelIndex - Zero-based index of the level to open.
   * @param slot - Which of the level's three slots to show.
   */
  openLevelBuffer(levelIndex: number, slot: CodeSlot = DEFAULT_CODE_SLOT): void {
    // Ahead of resolving the starter code, and not left to the flush inside
    // `#openBuffer` below: the legacy key `#resolveLevelStarterCode` falls
    // back to is exactly the key the buffer on screen is still writing to, the
    // very first time a player ever opens a numbered level. Resolving
    // first would carry forward whatever that key held before this keystroke
    // rather than what is on screen right now.
    this.#flush();
    const starterCode = this.#resolveLevelStarterCode(levelIndex, slot);
    this.#openBuffer(levelBuffer(levelIndex, slot, starterCode));
  }

  /**
   * The starter program to open a level's slot with, when the slot itself
   * is empty.
   *
   * Walks every lower-numbered level's same slot, newest first, and takes
   * the first one holding a program — the carry-forward a player who has never
   * touched slot 2 of level 9 still expects, because slot 2 of level 8
   * had one. Every lower index, not just the one immediately before this
   * level: a player can land on any level directly, by a bookmark or a
   * typed URL, without ever having opened the ones in between.
   *
   * Only the default slot falls back further, to the legacy single-buffer key.
   * That fallback is what makes slot 1 of whichever level a returning
   * player first opens show the program they saved before slots existed; slots
   * 2 and 3 have no such history to inherit, so they fall straight to the bare
   * default.
   *
   * @param levelIndex - Zero-based index of the level being opened.
   * @param slot - Which of the level's three slots.
   * @returns The carried-forward program, the legacy program, or the bare
   * default — never empty.
   */
  #resolveLevelStarterCode(levelIndex: number, slot: CodeSlot): string {
    for (let i = levelIndex - 1; i >= 0; i -= 1) {
      const stored = this.#read(levelCodeKey(i, slot));
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
      // themselves — a re-render, a restart of the task already open, a second
      // click on the link for it — and none of that may disturb typing. The
      // description is still taken, because a starter program is a translated
      // string: `editor.defaultCode.code` for the player's own buffer and
      // `tutorial.taskN.startingCode.code` for a task's. A repeat after a
      // language change therefore arrives carrying the newer text, and "Reset"
      // owes the player the version they can read.
      this.#buffer = next;
      return;
    }
    // Everything unsaved in the buffer being left goes back to that buffer's
    // own key before anything else happens; the switch is the last chance,
    // since the pending autosave is about to be cancelled.
    this.#flush();
    this.#buffer = next;
    const stored = this.#read(next.codeKey);
    if (stored.state === "text") {
      this.#swapDocument(stored.text);
    } else {
      // Nothing to show but the starting point. Whether it may also be *written*
      // depends on which kind of nothing this is: an empty entry is a task
      // nobody has started, while a store that would not answer may be holding
      // an attempt this write would destroy — and destroy invisibly, since the
      // player is looking at a skeleton and has no way to know their work was
      // ever there. Showing the skeleton is unavoidable; storing it is not.
      if (stored.state === "empty" && next.writesStarterOnOpen) {
        // Stored right away rather than left to the first autosave, so that the
        // task the player is looking at is the task they come back to even if
        // they close the tab without typing a character.
        this.#write(next.codeKey, next.starterCode);
      }
      this.#swapDocument(next.starterCode);
    }
    // The document on screen is not the player's typing any more, and nothing
    // in it is waiting to be written: it came out of storage, or it was just
    // put there. A surface that treats the swap as an edit has queued an
    // autosave of it, which would tell the player "Code saved ..." for a save
    // they did not ask for — the same unasked announcement the constructor
    // goes out of its way to avoid.
    this.#unsavedEdits = false;
    this.#cancelSave();
    // The program in the editor is a different program now, even though nobody
    // typed: listeners that describe the editor's contents, such as the fitness
    // measurement, are stale and say so themselves off this event.
    this.trigger("change");
  }

  /**
   * Puts another buffer's program on screen in place of this one's.
   *
   * Never {@link CodeEditor.setCode}, which is an edit of the program on
   * screen: an edit can be undone, and undoing across a buffer switch is how
   * one buffer's program ends up on screen — and then, through the autosave, in
   * another buffer's key.
   *
   * @param code - The program to show.
   */
  #swapDocument(code: string): void {
    this.#view.setValue(code, "swap");
  }

  /**
   * Writes the text on screen back to the buffer it belongs to, if it is
   * text the player has changed.
   *
   * Deliberately silent, unlike {@link CodeEditor.save}: this is bookkeeping on
   * the way out of a buffer, not a save the player asked for. And deliberately
   * nothing at all when nobody has typed, which is the difference between a
   * second tab sitting idle and a second tab quietly overwriting the first
   * tab's work the moment its player clicks a link.
   */
  #flush(): void {
    if (!this.#unsavedEdits) {
      return;
    }
    const code = this.getCode();
    const stored = this.#read(this.#buffer.codeKey);
    if (stored.state !== "text" && code === this.#buffer.starterCode) {
      // Storage already says exactly this: an entry with nothing in it is read
      // back as the buffer's starter program. What the guard is for, now that
      // an untouched buffer is not written at all, is the player who typed a
      // character and deleted it again before clicking away — the flag says
      // they edited, and they did, but the program is the one they started
      // with. Writing it would create the player's own key on their behalf and
      // make an untouched install start looking like a played one.
      return;
    }
    this.#write(this.#buffer.codeKey, code);
  }

  /**
   * Backs the program up and replaces it with the buffer's starter program.
   *
   * @returns Whether the program was replaced. `false` means the store is
   * holding a program it would not take a copy of, and the reset was refused
   * rather than carried out — see below.
   */
  reset(): boolean {
    const code = this.getCode();
    if (code === "" || code === this.#buffer.starterCode) {
      // There is nothing here to lose, and the backup slot is worth more than a
      // copy of it. Two Resets in a row used to leave the backup holding the
      // starter program, and "Undo reset" bringing back the skeleton is the
      // same as bringing back nothing; worse with an emptied editor in between,
      // where the backup became "" and the guard in `undoReset` then made the
      // one button that could have recovered the program do nothing at all.
      this.setCode(this.#buffer.starterCode);
      return true;
    }
    if (
      !this.#write(this.#buffer.backupKey, code) &&
      // Deliberately not `#read`: the question is what the *store* is holding,
      // and `#read` would answer out of this page's own memory. A store that
      // keeps nothing for anybody — a private window — has nothing to lose
      // here, and refusing to reset there would break the button for a whole
      // class of players to protect a program the store never had.
      //
      // A store that will not answer reads is counted with them, though it may
      // well be holding something. That was measured rather than assumed: when
      // reads throw and writes are taken, the constructor has already shown the
      // starting program, and the first keystroke's autosave overwrites the
      // stored one — with no Reset anywhere in it. Refusing here would save
      // nothing that typing does not destroy a second later, and there is no
      // way from in here to tell that store apart from a private window, which
      // throws from reads exactly the same way. What is left of the program in
      // both cases is the copy `#write` kept in this page, which "Undo reset"
      // reads back for as long as the tab is open.
      readStorage(this.#storage, this.#buffer.codeKey).state === "text"
    ) {
      // The store took the program and will not take a copy of it, which is
      // what a quota looks like from in here: a new key does not fit, while
      // overwriting an old one with something shorter still succeeds. Carrying
      // on would replace the program with the starter and the autosave a second
      // later would write *that* over the stored program — successfully, being
      // smaller — and announce "Code saved ...". An afternoon's work, gone with
      // nothing anywhere to bring it back from. Refusing keeps every copy.
      return false;
    }
    this.setCode(this.#buffer.starterCode);
    return true;
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
    const backup = this.#read(this.#buffer.backupKey);
    if (backup.state !== "text") {
      return;
    }
    this.setCode(backup.text);
  }

  /**
   * Whether there is a reset of this buffer for {@link CodeEditor.undoReset} to
   * take back.
   *
   * Published so that the run controls can keep the button out of the way until
   * it can do something — see
   * {@link "../pages/game/index.ts"!ControlsPresenterOptions.canUndoReset}. Asked
   * afresh every time rather than announced as an event, because it changes
   * with the buffer as well as with a reset: switching to another task swaps
   * the backup slot underneath it.
   *
   * The question is not whether the backup differs from the program on screen,
   * which is the obvious reading and the wrong one. Comparing them offers the
   * button whenever the two have drifted apart *for any reason*, and typing is
   * a reason: after a refused reset, or after an undo, one keystroke made this
   * true again and the button reappeared — at the next pause or speed change,
   * with no visible connection to anything the player had done — behind a
   * dialog that says "as before the last reset" for a reset that either never
   * happened or has already been taken back. Accepting it then throws away
   * every keystroke since. A button that quietly rearms itself into a
   * destructive one is worse than a button that does nothing.
   *
   * What is asked instead is whether the editor still holds what a reset leaves
   * behind: the starter program, with a backup underneath it to bring back.
   * That is true only in the state where the undo restores work and destroys
   * none, it survives a reload — the backup is in the store, so a player who
   * reset yesterday and comes back to the untouched skeleton is still offered
   * the way back — and it stops being true the moment the player writes
   * something worth keeping, which is the moment the offer becomes a trap.
   *
   * @returns Whether the buffer on screen is back at its starter program with a
   * backup behind it.
   */
  canUndoReset(): boolean {
    if (this.getCode() !== this.#buffer.starterCode) {
      return false;
    }
    return this.#read(this.#buffer.backupKey).state === "text";
  }

  /** Puts the caret back in the editing surface. */
  focus(): void {
    this.#view.focus();
  }

  /**
   * Marks where the running program failed, or takes the mark away.
   *
   * Not derived from {@link CodeEditor.getCodeObj}, which is where compilation
   * failures surface, because most of these arrive much later: a program
   * compiles, runs for forty seconds and then reads a property of nothing on
   * one particular frame. Only the caller watching the run knows that happened.
   *
   * @param location - Where the failure was, or `undefined` to clear the mark.
   */
  markError(location: CodeErrorLocation | undefined): void {
    this.#view.markError(location);
  }
}

/**
 * Carries a new error mark, or `undefined` to take the current one away.
 *
 * A state effect rather than a method on the view because CodeMirror keeps no
 * mutable state of its own worth writing to: everything drawn is derived from
 * the document plus fields, and a field can only be changed by a transaction.
 */
const showErrorMark = StateEffect.define<CodeErrorLocation | undefined>();

/**
 * How the failing text is drawn.
 *
 * A wavy underline in `--ds-bad` rather than a wash across the line: tinting
 * what is behind the text costs the program the player is reading its
 * legibility, and the code palette has no headroom to give -- `--ds-code-com`
 * is tuned to 4.51:1 on `--ds-code-bg`, a hundredth over the 4.5:1 that text
 * has to keep, so any wash at all puts a comment under the bar. An underline
 * puts nothing behind the text at all, and the mark itself reads 5.74:1 on the
 * dark editor and 4.94:1 on the light one, well clear of the 3:1 a graphical
 * indicator needs. Ratios measured against the values in `tokens.css`, not
 * estimated, and both keep being measured: the mark's own pair in
 * `src/widgets/editor-pane/ui/editor-pane.css.test.ts`, the comment's in
 * `src/shared/styles/code.css.test.ts`.
 */
const errorMark = Decoration.mark({ class: "cm-errorMark" });

/**
 * Works out what to underline for a reported failure.
 *
 * From the failing character to the end of its line, because the stack says
 * where the failing call *starts* and nothing about where it ends: underlining
 * to the end of the line claims exactly what is known, where guessing at a
 * token's width would sometimes underline half an identifier.
 *
 * @param doc - The document as it now stands, which may no longer be the one
 * the failure came from.
 * @param location - The reported position.
 * @returns The range to mark, or `undefined` when the document has no such
 * place to mark: a line it does not have, or one with nothing on it. Both are
 * refusals rather than best-effort marks, because the clamp below has nowhere
 * to land on an empty line -- backing off the end of one puts the start before
 * the line begins, and the mark would then belong to the line above, or to no
 * line at all in an empty document. Neither draws anything today, so no test
 * can tell the guard from its absence; it is here to keep the range inside the
 * line it names. What CodeMirror does reject outright is a mark spanning
 * nothing at all, with `RangeError: Mark decorations may not be empty` --
 * checked, not assumed -- which is why the range always runs to the line's end.
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
  // Clamped at both ends: a column past the end of the line would mark nothing,
  // and one before its start would reach into the line above.
  const from = Math.min(line.from + Math.max(0, location.column - 1), line.to - 1);
  return { from, to: line.to };
}

/**
 * Holds the error mark, and knows when it has stopped being true.
 *
 * Any edit clears it. The mark points at text that failed, so the moment that
 * text changes the mark is a claim about something that is no longer there --
 * and the player's first move on seeing it is usually to edit the very line it
 * is under, which would leave a red underline sitting beneath their correction.
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
 * Builds a CodeMirror 6 editing surface inside a container.
 *
 * @param parent - Element the editor is appended to.
 * @returns A factory that mounts the editor and returns the surface.
 */
export function codeMirrorView(parent: HTMLElement): TextEditorViewFactory {
  return (handlers: TextEditorHandlers, initialValue: string): TextEditorView => {
    // Held in a variable rather than written into the constructor call because
    // a swap builds a second state out of the same extensions; see `setValue`.
    const extensions = [
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
      // The design's own code colours, over `basicSetup`'s. This is a plain
      // registration rather than a `{ fallback: true }` one, and that is the
      // whole mechanism: `basicSetup` adds `defaultHighlightStyle` as a
      // fallback, which `@codemirror/language` consults only while no ordinary
      // highlighter is configured, so one line here retires a palette drawn
      // for a white page and never re-tuned for the near-black editor the
      // redesign gave the player. See `editorSyntaxTheme` for the mapping.
      syntaxHighlighting(editorSyntaxTheme),
      indentUnit.of(INDENT),
      EditorState.tabSize.of(INDENT.length),
      // Read here rather than at module scope, and read afresh on every mount:
      // this factory runs once per editor, so an editor built after the player
      // has changed language is named in that language. CodeMirror holds the
      // attribute in its own state, so an editor already on screen keeps the
      // name it was given until something rebuilds it.
      EditorView.contentAttributes.of({ "aria-label": t("editor.label") }),
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
      errorMarkField,
      EditorView.theme({
        ".cm-errorMark": {
          // `wavy` rather than a straight rule so the mark cannot be read as
          // part of the program -- an underscore, or a link. `--ds-bad` is the
          // one red the redesign has, and the same one the error banner under
          // the code bar is drawn in, so a squiggle and the message explaining
          // it are visibly the same report.
          textDecoration: "underline wavy var(--ds-bad)",
          // Clear of the descenders, which the wave would otherwise run
          // through at this amplitude. A length rather than the `0.2em` this
          // was: the mockup's `.squiggle` uses 3px, and an em here would
          // scale the offset with the player's font size while the wave's own
          // amplitude, which is what has to be cleared, does not.
          textUnderlineOffset: "3px",
        },
      }),
    ];
    const view = new EditorView({ parent, doc: initialValue, extensions });
    view.dom.tabIndex = -1;

    return {
      getValue: () => view.state.doc.toString(),
      setValue: (value: string, replacement: TextReplacement = "edit") => {
        if (replacement === "swap") {
          // A whole new state, which is the only way to be rid of the undo
          // history: `basicSetup` brings `history()` in, and CodeMirror offers
          // no command that empties it.
          //
          // The alternative of dispatching the swap with
          // `Transaction.addToHistory.of(false)` was measured, not assumed, and
          // it does hold today: the old buffer's recorded changes are mapped
          // through the replacement, and because the replacement covers the
          // whole document they all map to nothing, so undo after a swap does
          // nothing rather than pasting the old buffer's text in. It was
          // rejected because that safety is an accident of the swap being a
          // full-document replacement — the day it becomes a narrower change,
          // to keep the scroll position or to animate, the mapped-away history
          // comes back to life pointing at another buffer's program — and
          // because it leaves the player an undo that is offered and silently
          // does nothing. Dropping the history says what is true: the program
          // they were editing is not on screen any more.
          //
          // Reconfiguring a compartment holding `history()` would also work,
          // but the instance to reconfigure is inside `basicSetup`, out of
          // reach. Building the state has one more property worth having: the
          // swapped-in document is the document the state was *built* with, so
          // it raises no `onChange`, exactly as at construction.
          view.setState(EditorState.create({ doc: value, extensions }));
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
      markError: (location: CodeErrorLocation | undefined) => {
        const range = location === undefined ? undefined : errorRange(view.state.doc, location);
        view.dispatch({
          effects:
            range === undefined
              ? [showErrorMark.of(location)]
              : // Scrolled to as well as drawn: the editor is 320px tall at a
                // 19.6px line, so it shows sixteen lines, and a program with a
                // bug worth hunting is usually longer than that. Drawing a
                // mark where nobody can see it answers nothing.
                [showErrorMark.of(location), EditorView.scrollIntoView(range.from)],
        });
      },
    };
  };
}
