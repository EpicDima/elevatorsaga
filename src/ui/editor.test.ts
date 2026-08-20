// @vitest-environment jsdom

import { CompletionContext } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import { playerApiCompletionSource } from "./completions.ts";
import { defaultCode } from "./default-code.ts";
import {
  AUTOSAVE_DELAY_MS,
  BACKUP_STORAGE_KEY,
  CODE_STORAGE_KEY,
  CodeEditor,
  codeMirrorView,
} from "./editor.ts";
import type { TextEditorView, TextReplacement } from "./editor.ts";
import { FakeTextEditorView, MemoryStorage, fullStorage } from "./test-helpers.ts";

/**
 * The shared fake, taught the difference between an edit and a swap.
 *
 * {@link FakeTextEditorView} predates {@link TextReplacement} and raises
 * `onChange` for every replacement, while the surface that ships raises nothing
 * for a swap — it builds a new state, and a document a state is built with is
 * not a document change. A fake that is wrong in that direction hides exactly
 * the bugs this file is here to catch: an autosave the editor is supposed to
 * cancel gets rescheduled by the fake's spurious `onChange` and cancelled
 * again, so removing the cancellation breaks nothing that the fake can see.
 *
 * It belongs in `test-helpers.ts` beside the fake it corrects, but that file is
 * shared with tests being written next door; this subclass is the version that
 * only affects this file, and it should disappear into the shared fake once the
 * dust settles.
 */
class SwapAwareView extends FakeTextEditorView {
  override setValue(value: string, replacement: TextReplacement = "edit"): void {
    if (replacement === "swap") {
      this.value = value;
      return;
    }
    super.setValue(value);
  }
}

/**
 * Builds an editor over a fake view and hands both back.
 *
 * @param storage - Where the editor should persist the program.
 * @returns The editor and the view it is driving.
 */
function setUp(storage: Storage = new MemoryStorage()): {
  editor: CodeEditor;
  view: FakeTextEditorView;
  storage: Storage;
} {
  let view: FakeTextEditorView | undefined;
  const editor = new CodeEditor(
    (handlers, initialValue) => {
      view = new SwapAwareView(handlers, initialValue);
      return view;
    },
    { storage },
  );
  if (view === undefined) {
    throw new Error("The editor did not build its view");
  }
  return { editor, view, storage };
}

/**
 * A `Storage` that throws from everything, as Safari does in private mode.
 *
 * @returns The refusing store.
 */
function deniedStorage(): Storage {
  const denied = (): never => {
    throw new Error("denied");
  };
  return {
    get length(): number {
      return denied();
    },
    clear: denied,
    getItem: denied,
    key: denied,
    removeItem: denied,
    setItem: denied,
  };
}

/**
 * A `Storage` with room for the keys it already has and not one more.
 *
 * What a real quota does, rather than what the crude version of it does: the
 * budget is a number of bytes, so overwriting an existing key with something no
 * longer keeps working long after a *new* key has stopped fitting. That
 * asymmetry is the whole hazard — a failed backup followed by a successful
 * overwrite of the program it was meant to protect.
 *
 * @param entries - What the store is already holding.
 * @returns The crowded store.
 */
function crowdedStorage(entries: Readonly<Record<string, string>> = {}): Storage {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(entries)) {
    storage.setItem(key, value);
  }
  return {
    get length(): number {
      return storage.length;
    },
    clear: () => {
      storage.clear();
    },
    getItem: (key: string) => storage.getItem(key),
    key: (index: number) => storage.key(index),
    removeItem: (key: string) => {
      storage.removeItem(key);
    },
    setItem: (key: string, value: string) => {
      if (storage.getItem(key) === null) {
        throw new Error("QuotaExceededError");
      }
      storage.setItem(key, value);
    },
  };
}

/**
 * A `Storage` that is holding text and will not say what it is.
 *
 * `getItem` throwing while `setItem` works is what a store looks like when the
 * page is not allowed to read it — blocked site data, a `SecurityError` — and
 * it is the case where "the store said nothing" and "the store has nothing" are
 * different facts about somebody's afternoon.
 *
 * @param entries - What the store is holding, out of sight.
 * @returns The store, and a way for the test to see what is really in it.
 */
function unreadableStorage(entries: Readonly<Record<string, string>> = {}): {
  storage: Storage;
  kept: MemoryStorage;
} {
  const kept = new MemoryStorage();
  for (const [key, value] of Object.entries(entries)) {
    kept.setItem(key, value);
  }
  return {
    kept,
    storage: {
      get length(): number {
        return kept.length;
      },
      clear: () => {
        kept.clear();
      },
      getItem: (): never => {
        throw new Error("SecurityError");
      },
      key: (index: number) => kept.key(index),
      removeItem: (key: string) => {
        kept.removeItem(key);
      },
      setItem: (key: string, value: string) => {
        kept.setItem(key, value);
      },
    },
  };
}

beforeAll(() => {
  // jsdom lays nothing out, so `Range.getClientRects` is missing from it
  // altogether, and CodeMirror's measure cycle throws without it. That cycle
  // runs from a `requestAnimationFrame` callback, long after the test that
  // scheduled it has finished — out of reach of any `expect`, and out of reach
  // of a hook that would put jsdom back, which is why this is installed once
  // for the file and left in place. An empty list is the truthful answer for a
  // document nothing ever laid out: measurement returns zeroes and scrolling
  // becomes the no-op it always was here.
  Range.prototype.getClientRects = function getClientRects(): DOMRectList {
    return Object.assign([], { item: () => null });
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("storage keys", () => {
  it("are exactly the keys the legacy game wrote", () => {
    // These two strings are an on-disk compatibility contract with the browser
    // of every player who has ever played: their program is under this exact
    // key in their own localStorage, and the game only finds it again if the
    // key never changes. Renaming either constant compiles, and every test
    // that goes through the constant keeps passing, while silently destroying
    // the saved program of every existing player — so the literals are pinned
    // here. Do not "fix" these to match a constant; change nothing at all.
    expect(CODE_STORAGE_KEY).toBe("elevatorCrushCode_v5");
    expect(BACKUP_STORAGE_KEY).toBe("develevateBackupCode");
  });
});

describe("CodeEditor storage", () => {
  it("starts a new player off with the default program", () => {
    const { view } = setUp();
    expect(view.getValue()).toBe(defaultCode());
  });

  it("restores the program from the v5 key players already have", () => {
    const storage = new MemoryStorage();
    storage.setItem(CODE_STORAGE_KEY, "{ init: function() {} }");
    const { view } = setUp(storage);
    expect(view.getValue()).toBe("{ init: function() {} }");
  });

  it("saves under the v5 key and announces when it did", () => {
    const { editor, view, storage } = setUp();
    const saved = vi.fn();
    const changed = vi.fn();
    editor.on("saved", saved);
    editor.on("change", changed);

    view.value = "// mine";
    editor.save();

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// mine");
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0]?.[0]).toBeInstanceOf(Date);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("autosaves once, a second after the typing stops", () => {
    const { editor, view, storage } = setUp();
    const changed = vi.fn();
    editor.on("change", changed);

    view.type("a");
    view.type("ab");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("ab");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("does not autosave again after an explicit save", () => {
    const { editor, view } = setUp();
    const changed = vi.fn();
    editor.on("change", changed);

    view.type("a");
    editor.save();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("says out loud that a write was refused", () => {
    // Every refused write announces itself, from the one place all writes go
    // through. A player whose quota filled up mid-session otherwise has a
    // "Code saved 14:32" line on screen, no reason to doubt it, and nothing
    // written since — the failure is silent exactly when it costs the most.
    const { editor, view } = setUp(fullStorage());
    const refused = vi.fn();
    const saved = vi.fn();
    editor.on("storage_refused", refused);
    editor.on("saved", saved);

    view.type("// typed with nowhere to keep it");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(refused).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });

  it("says nothing of the sort when the store takes it", () => {
    const { editor, view } = setUp();
    const refused = vi.fn();
    editor.on("storage_refused", refused);

    view.type("// mine");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    editor.save();

    expect(refused).not.toHaveBeenCalled();
  });

  it("keeps working when the browser refuses storage", () => {
    // Safari in private mode throws from both getItem and setItem.
    const { editor, view } = setUp(deniedStorage());
    const saved = vi.fn();
    editor.on("saved", saved);

    expect(view.getValue()).toBe(defaultCode());
    expect(() => {
      editor.save();
    }).not.toThrow();
    expect(saved).not.toHaveBeenCalled();
  });
});

describe("CodeEditor buffers", () => {
  it("gives every learning-track task a storage key of its own", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer("tutorial-3", "// task 3 skeleton");
    view.type("// my attempt at task 3");
    editor.openTutorialBuffer("tutorial-4", "// task 4 skeleton");

    // Pinned as literals for the same reason the two keys above are: the
    // spelling is what a half-finished attempt is found under a week later, and
    // asserting through the editor's own constant would let a rename pass every
    // test while quietly orphaning the work of everyone who had started.
    expect(storage.getItem("develevateTutorialCode_tutorial-3")).toBe("// my attempt at task 3");
    expect(storage.getItem("develevateTutorialCode_tutorial-4")).toBe("// task 4 skeleton");
  });

  it("opens a task nobody has started with the program it hands out", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer("tutorial-1", "// fill this in");

    expect(view.getValue()).toBe("// fill this in");
    // Stored at once, so closing the tab without typing loses nothing and does
    // not reopen the task on someone else's text.
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// fill this in");
  });

  it("keeps the attempt a task already holds instead of the starter program", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "// where I got to last time");
    const { editor, view } = setUp(storage);

    editor.openTutorialBuffer("tutorial-2", "// fill this in");

    expect(view.getValue()).toBe("// where I got to last time");
    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe(
      "// where I got to last time",
    );
  });

  it("saves what is on screen before leaving, without waiting for the autosave", () => {
    const { editor, view, storage } = setUp();
    view.type("// typed a second ago");

    editor.openTutorialBuffer("tutorial-1", "// fill this in");

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// typed a second ago");
  });

  it("does not claim the player's key for a program they typed and took back", () => {
    // Typed and undone is not the same as written. The editor knows an edit
    // happened, and one did, but what is on screen is the program every
    // untouched install starts with, and storage saying nothing already says
    // exactly that. Writing it would claim the player's own key on their
    // behalf, and an install nobody has written a program in would start
    // looking like a played one.
    const { editor, view, storage } = setUp();
    view.type("// second thoughts");
    view.type(defaultCode());

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("hands every buffer back its own text, in both directions", () => {
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// my task 1");
    editor.openTutorialBuffer("tutorial-2", "// task 2");
    view.type("// my task 2");

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    expect(view.getValue()).toBe("// my task 1");
    editor.openTutorialBuffer("tutorial-2", "// task 2");
    expect(view.getValue()).toBe("// my task 2");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// my own program");
  });

  it("loses nothing for a player who walks the track without typing", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    expect(view.getValue()).toBe("// task 1");
    editor.openTutorialBuffer("tutorial-2", "// task 2");
    editor.openPlayerBuffer();

    expect(view.getValue()).toBe(defaultCode());
    // Nobody typed, so nothing claimed the player's key on their behalf: an
    // untouched install still looks untouched after a walk through the track.
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("never lets the track write over the player's own program", () => {
    const { editor, view, storage } = setUp();
    view.type("// the program I care about");
    editor.save();

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// my task 1");
    editor.reset();
    editor.undoReset();
    editor.openTutorialBuffer("tutorial-2", "// task 2");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// the program I care about");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// the program I care about");
  });

  it("does not write a buffer nobody edited over another tab's work", () => {
    // Two tabs, one store. The second was opened before the afternoon's work
    // happened in the first and still shows the older program, with no way to
    // know. Before there were buffers an idle tab wrote nothing until somebody
    // typed in it, and one click on a task link must not be what changes that:
    // writing the screen back on the way out of a buffer is right for text the
    // player changed and is somebody else's work destroyed for text they never
    // touched.
    const storage = new MemoryStorage();
    storage.setItem(CODE_STORAGE_KEY, "// version 1");
    const setItem = vi.spyOn(storage, "setItem");
    const idleTab = setUp(storage);
    const workingTab = setUp(storage);

    workingTab.view.type("// version 2, an afternoon of work");
    workingTab.editor.save();
    idleTab.editor.openTutorialBuffer("tutorial-1", "// task 1");

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// version 2, an afternoon of work");
    // Nor is the idle tab holding a stale copy in its own memory of what it has
    // written: coming back to the player's buffer shows the other tab's work.
    idleTab.editor.openPlayerBuffer();
    expect(idleTab.view.getValue()).toBe("// version 2, an afternoon of work");

    // The working tab leaving its buffer does not write it a second time
    // either. It was written a moment ago and nothing has changed since; the
    // key is touched once, by the save the player asked for.
    workingTab.editor.openTutorialBuffer("tutorial-1", "// task 1");
    expect(setItem.mock.calls.filter(([key]) => key === CODE_STORAGE_KEY)).toHaveLength(1);
  });

  it("stops counting the text as edited the moment the buffer is left", () => {
    // "There is typing here that has not been written" is a fact about the
    // buffer on screen, and a switch hands the screen to another buffer. Left
    // standing, the *next* switch writes a buffer nobody has typed in -- the
    // same stale write that costs the other tab its work, one buffer along.
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const { editor, view } = setUp(storage);
    view.type("// my own program");

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    const writesSoFar = setItem.mock.calls.length;
    editor.openTutorialBuffer("tutorial-2", "// task 2");

    // Task 2's own key, holding the starter it was just opened on, and nothing
    // else: task 1 was read, looked at and left alone.
    expect(setItem.mock.calls.slice(writesSoFar).map(([key]) => key)).toEqual([
      "develevateTutorialCode_tutorial-2",
    ]);
  });

  it("does not let a countdown started in one buffer go off in the next", () => {
    // The autosave is debounced by a second, so a switch always happens with a
    // write pending. It must land in the buffer whose text it is, and once.
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const { editor, view } = setUp(storage);
    const saved = vi.fn();
    editor.on("saved", saved);
    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// typed in task 1");

    editor.openTutorialBuffer("tutorial-2", "// task 2");
    const writesBeforeTheCountdown = setItem.mock.calls.length;
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// typed in task 1");
    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe("// task 2");
    expect(view.getValue()).toBe("// task 2");
    // Cancelled, not merely harmless. A countdown left running fires with the
    // next task open; today it would write that task's own starter program back
    // over itself, which looks like nothing, and announce "Code saved ..." for a
    // save nobody asked for. The day the switch stops seeding storage up front
    // it would be one task's work under the other's key instead, so what is
    // pinned is that nothing at all happens a second after a switch.
    expect(setItem.mock.calls.length).toBe(writesBeforeTheCountdown);
    expect(saved).not.toHaveBeenCalled();
  });

  it("autosaves later typing into the buffer that is open", () => {
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer("tutorial-1", "// task 1");

    view.type("// typed after the switch");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// typed after the switch");
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("leaves the buffer already on screen alone when it is opened again", () => {
    // Routers and interfaces repeat themselves; a redundant open must not
    // replace the document under a player who is typing in it.
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// half a thought");
    const changed = vi.fn();
    editor.on("change", changed);

    editor.openTutorialBuffer("tutorial-1", "// task 1");

    expect(view.getValue()).toBe("// half a thought");
    expect(changed).not.toHaveBeenCalled();
    // The autosave the typing started is still coming.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// half a thought");
  });

  it("takes the newest starter program for the task on screen", () => {
    // Only the comments in a task's starter program are translated, but that is
    // enough: the same task hands over different text after a language switch,
    // and "Reset" owes the player the version they can read.
    const { editor, view } = setUp();
    editor.openTutorialBuffer("tutorial-1", "// task 1 in English");
    view.type("// half a thought");

    editor.openTutorialBuffer("tutorial-1", "// task 1 in another language");

    expect(view.getValue()).toBe("// half a thought");
    editor.reset();
    expect(view.getValue()).toBe("// task 1 in another language");
  });

  it("reports the change without announcing a save nobody asked for", () => {
    const { editor } = setUp();
    const saved = vi.fn();
    const changed = vi.fn();
    editor.on("saved", saved);
    editor.on("change", changed);

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    // The program in the editor is a different program, so anything describing
    // it is stale. Nothing was saved on the player's behalf, though, and
    // claiming otherwise in the "Code saved ..." line would be a lie.
    expect(changed).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });

  it("refuses a task whose name is blank", () => {
    // Identifiers reach the game from a URL the player can type by hand, and an
    // empty one spells the bare prefix: one key that every malformed route
    // would pour its text into, and the first two to try it would each find the
    // other's program waiting.
    const { editor, view, storage } = setUp();

    for (const taskId of ["", " ", "\t\n"]) {
      expect(() => {
        editor.openTutorialBuffer(taskId, "// task");
      }).toThrow(RangeError);
    }

    expect(view.getValue()).toBe(defaultCode());
    expect(storage.getItem("develevateTutorialCode_")).toBeNull();
    expect(storage.getItem("develevateTutorialCode_ ")).toBeNull();
  });

  it("finds a task's attempt under the task's own name, wherever it sits in the track", () => {
    // Keyed by the task's identifier and never by its position. The track's
    // `TutorialTask.id` exists for exactly this: the position is the one thing
    // about a task that is expected to change, and a half-written attempt is
    // precisely a task surviving being written down. Keyed by position, a ninth
    // task inserted at number two would hand its opener everybody's attempt at
    // the old task 2, and shift the six after it by one — no error, no warning,
    // every program filed under somebody else's task.
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "// my attempt at the old task 2");
    const { editor, view } = setUp(storage);

    editor.openTutorialBuffer("tutorial-9", "// the newcomer's skeleton");
    expect(view.getValue()).toBe("// the newcomer's skeleton");

    editor.openTutorialBuffer("tutorial-2", "// task 2 skeleton");
    expect(view.getValue()).toBe("// my attempt at the old task 2");
  });

  it("does not put a task's starting point over an attempt it could not read", () => {
    // "The store has nothing" and "the store would not say" arrive as the same
    // silence and mean opposite things. Read as "nothing", a store that has
    // simply refused to answer gets the skeleton written into it, over an
    // attempt that was there all along — and the player, looking at a skeleton,
    // has no way to know anything was lost. The skeleton on screen is
    // unavoidable; nothing can show text nobody is allowed to read. Storing it
    // is not.
    const { storage, kept } = unreadableStorage({
      "develevateTutorialCode_tutorial-1": "// three evenings of work",
    });
    const { editor, view } = setUp(storage);

    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");

    expect(view.getValue()).toBe("// task 1 skeleton");
    expect(kept.getItem("develevateTutorialCode_tutorial-1")).toBe("// three evenings of work");
  });

  it("opens a task whose stored attempt was emptied on its starting point", () => {
    // An empty entry is no more use than a missing one, and a task that opens
    // on a blank page has no way back to its own starting point.
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "");
    const { editor, view } = setUp(storage);

    editor.openTutorialBuffer("tutorial-2", "// fill this in");

    expect(view.getValue()).toBe("// fill this in");
  });

  it("still switches buffers when the browser refuses storage", () => {
    // Nothing can be kept past this page, but the editor must stay usable:
    // every task opens on its starter program instead of on an exception.
    const { editor, view } = setUp(deniedStorage());

    expect(() => {
      editor.openTutorialBuffer("tutorial-1", "// task 1");
    }).not.toThrow();
    expect(view.getValue()).toBe("// task 1");
    expect(() => {
      editor.openPlayerBuffer();
    }).not.toThrow();
    expect(view.getValue()).toBe(defaultCode());
  });

  it("keeps a switch lossless for as long as the tab lives when nothing can be stored", () => {
    // A store that has been working and stops — a full quota, or a private
    // window — must not turn a buffer switch into a shredder: leaving writes
    // nowhere, coming back reads nothing, and the starting program would take
    // the screen. Whatever was typed is safe for as long as the page is open.
    const { editor, view } = setUp(fullStorage({ [CODE_STORAGE_KEY]: "// yesterday's program" }));
    view.type("// an afternoon of work");

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// my task 1");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// an afternoon of work");

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    expect(view.getValue()).toBe("// my task 1");
  });

  it("says nothing was saved when nothing could be", () => {
    // The in-page memory is not persistence, and "Code saved ..." would be
    // promising the player a next visit that the store cannot honour.
    const { editor, view } = setUp(fullStorage());
    const saved = vi.fn();
    editor.on("saved", saved);

    view.type("// typed with nowhere to keep it");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(saved).not.toHaveBeenCalled();
  });
});

describe("CodeEditor challenge buffers", () => {
  it("gives every challenge's every slot a storage key of its own", () => {
    const { editor, view, storage } = setUp();

    editor.openChallengeBuffer(6, 2);
    view.type("// challenge 7, slot 2");
    editor.openChallengeBuffer(6, 3);
    view.type("// challenge 7, slot 3");
    editor.openChallengeBuffer(7, 2);

    // Pinned as literals for the reason the tutorial keys above are: the
    // spelling is what a half-finished attempt is found under later, and
    // asserting through a helper would let a rename pass every test while
    // quietly orphaning every slot already in play.
    expect(storage.getItem("develevateChallengeCode_6_2")).toBe("// challenge 7, slot 2");
    expect(storage.getItem("develevateChallengeCode_6_3")).toBe("// challenge 7, slot 3");
  });

  it("opens a slot nobody has used with the default program, writing it at once", () => {
    const { editor, view, storage } = setUp();

    editor.openChallengeBuffer(4, 2);

    expect(view.getValue()).toBe(defaultCode());
    // Stored at once, so leaving without typing loses nothing and does not
    // reopen the slot on someone else's text.
    expect(storage.getItem("develevateChallengeCode_4_2")).toBe(defaultCode());
  });

  it("keeps the attempt a slot already holds instead of the starter program", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_4_2", "// where I got to last time");
    const { editor, view } = setUp(storage);

    editor.openChallengeBuffer(4, 2);

    expect(view.getValue()).toBe("// where I got to last time");
  });

  it("carries a slot's program forward from the newest lower challenge that has one", () => {
    // A player who has never touched slot 2 of challenge 9 still expects to
    // find slot 2 of challenge 8's program there, the same way starting
    // challenge 9 for the first time in the legacy game picked up wherever
    // challenge 8 left off.
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_5_2", "// slot 2 as of challenge 6");
    const { editor, view } = setUp(storage);

    editor.openChallengeBuffer(8, 2);

    expect(view.getValue()).toBe("// slot 2 as of challenge 6");
  });

  it("reaches past challenges with nothing in the slot to the nearest one that has something", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_3_2", "// slot 2 as of challenge 4");
    const { editor, view } = setUp(storage);

    // Nothing under challenges 4 through 7's second slot, so the search must
    // not stop at the challenge immediately before the one being opened.
    editor.openChallengeBuffer(7, 2);

    expect(view.getValue()).toBe("// slot 2 as of challenge 4");
  });

  it("does not let a later challenge's slot reach back into an earlier one already opened", () => {
    const { editor, view } = setUp();
    editor.openChallengeBuffer(0, 2);
    const startedOn = view.getValue();

    editor.openChallengeBuffer(5, 2);
    view.type("// a much later program");
    editor.save();

    editor.openChallengeBuffer(0, 2);

    expect(view.getValue()).toBe(startedOn);
  });

  it("falls back to the legacy single-buffer key only for the first slot", () => {
    const storage = new MemoryStorage();
    storage.setItem(CODE_STORAGE_KEY, "// the program every existing player has");
    const { editor, view } = setUp(storage);

    editor.openChallengeBuffer(3, 1);
    expect(view.getValue()).toBe("// the program every existing player has");

    editor.openChallengeBuffer(3, 2);
    expect(view.getValue()).toBe(defaultCode());
  });

  it("opens the first slot when none is named", () => {
    const { editor, storage } = setUp();

    editor.openChallengeBuffer(2);

    expect(storage.getItem("develevateChallengeCode_2_1")).toBe(defaultCode());
  });

  it("carries typing not yet autosaved into the first challenge's first slot", () => {
    // The legacy key `#resolveChallengeStarterCode` falls back to is exactly
    // the key the buffer on screen is still writing to the first time a
    // player ever opens a numbered challenge -- the player's own buffer is
    // open by default. Resolving the starter program before flushing that
    // buffer would carry forward whatever the key held before this keystroke
    // rather than what is on screen right now.
    const { editor, view, storage } = setUp();
    view.type("// typed a moment ago, not yet autosaved");

    editor.openChallengeBuffer(0, 1);

    expect(view.getValue()).toBe("// typed a moment ago, not yet autosaved");
    expect(storage.getItem("develevateChallengeCode_0_1")).toBe(
      "// typed a moment ago, not yet autosaved",
    );
  });

  it("keeps a separate reset backup per challenge slot", () => {
    const { editor, view, storage } = setUp();
    editor.openChallengeBuffer(3, 1);
    view.type("// challenge 4, slot 1 attempt");
    editor.reset();
    editor.openChallengeBuffer(3, 2);
    view.type("// challenge 4, slot 2 attempt");
    editor.reset();
    expect(view.getValue()).toBe(defaultCode());

    editor.openChallengeBuffer(3, 1);
    editor.undoReset();

    // Slot 1's own attempt, not slot 2's, and slot 2's backup is untouched.
    expect(view.getValue()).toBe("// challenge 4, slot 1 attempt");
    expect(storage.getItem("develevateChallengeBackupCode_3_1")).toBe(
      "// challenge 4, slot 1 attempt",
    );
    expect(storage.getItem("develevateChallengeBackupCode_3_2")).toBe(
      "// challenge 4, slot 2 attempt",
    );
  });
});

describe("CodeEditor reset", () => {
  it("backs the program up before replacing it, and can bring it back", () => {
    const { editor, view, storage } = setUp();
    view.value = "// worth keeping";

    editor.reset();
    expect(view.getValue()).toBe(defaultCode());
    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBe("// worth keeping");

    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("leaves the program where it is when there is nothing to undo", () => {
    // The legacy game emptied the editor here, and the autosave a second later
    // made that permanent. The button is offered whether or not anything was
    // reset, and now that every buffer has a backup slot of its own, "nothing
    // to undo" is the ordinary state of every task never reset — pressing it
    // there must not be the quickest way to lose an afternoon's work.
    const { editor, view, storage } = setUp();
    view.type("// worth keeping");

    editor.undoReset();

    expect(view.getValue()).toBe("// worth keeping");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// worth keeping");
  });

  it("resets a learning-track task to that task's own starting point", () => {
    const { editor, view } = setUp();
    editor.openTutorialBuffer("tutorial-5", "// task 5 skeleton");
    view.type("// the wrong turn I took");

    editor.reset();

    expect(view.getValue()).toBe("// task 5 skeleton");
    editor.undoReset();
    expect(view.getValue()).toBe("// the wrong turn I took");
  });

  it("keeps a separate backup per buffer", () => {
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer("tutorial-1", "// task 1");
    view.type("// my task 1");
    editor.reset();
    editor.openTutorialBuffer("tutorial-2", "// task 2");
    view.type("// my task 2");
    editor.reset();
    expect(view.getValue()).toBe("// task 2");

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    editor.undoReset();

    // Task 1's own attempt, not task 2's, and the player's backup slot is
    // untouched by any of it.
    expect(view.getValue()).toBe("// my task 1");
    expect(storage.getItem("develevateTutorialBackupCode_tutorial-1")).toBe("// my task 1");
    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBeNull();
  });

  it("keeps the first backup when Reset is pressed a second time", () => {
    // Reset asks for confirmation, so a second press is a real possibility --
    // the dialog dismissed twice, or a player making sure. Backing the starter
    // program up over the first backup would mean "Undo reset" brings back the
    // skeleton, which is the same as bringing back nothing, and the program the
    // first Reset replaced is then in no copy anywhere.
    const { editor, view, storage } = setUp();
    view.type("// worth keeping");

    editor.reset();
    editor.reset();

    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBe("// worth keeping");
    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("keeps the backup when Reset follows an emptied editor", () => {
    // The same slot, lost the other way: select-all, delete, Reset. An empty
    // backup is one `undoReset` refuses to restore, so writing it would leave
    // the recovery button doing nothing at all -- the worst version of this,
    // because the player is looking straight at the thing that should help.
    const { editor, view, storage } = setUp();
    view.type("// worth keeping");
    editor.reset();

    view.type("");
    editor.reset();

    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBe("// worth keeping");
    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("refuses to reset a program the store will not take a copy of", () => {
    // A quota is a byte budget, and a *new* key is what stops fitting first
    // while overwriting an old one with something shorter still succeeds. So
    // the backup silently fails, the starter program takes the screen, and the
    // autosave a second later writes it over the stored program -- successfully
    // -- and announces "Code saved ...". The program is then in no copy
    // anywhere. Resetting is worth nothing next to that; refusing is free.
    const program = "// an afternoon of work";
    const storage = crowdedStorage({ [CODE_STORAGE_KEY]: program });
    const { editor, view } = setUp(storage);
    const saved = vi.fn();
    editor.on("saved", saved);

    expect(editor.reset()).toBe(false);

    expect(view.getValue()).toBe(program);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe(program);
    expect(saved).not.toHaveBeenCalled();
  });

  it("resets anyway when the store is holding nothing to lose", () => {
    // The other side of that refusal, and the reason it is not simply "reset
    // fails when the backup fails". In a private window every write is refused
    // and the store holds nothing for anybody, so there is no stored program a
    // reset could destroy -- and a Reset button that never works for a whole
    // class of players would be protecting nothing.
    const { editor, view } = setUp(deniedStorage());
    view.type("// worth keeping");
    // Long enough for the autosave to have tried and failed, which is what puts
    // the program in this page's own memory of what it has written. Asking that
    // memory whether the program is stored would answer yes and refuse the
    // reset; the question is what the store is holding, and it is holding
    // nothing.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(editor.reset()).toBe(true);

    expect(view.getValue()).toBe(defaultCode());
    // Recoverable for as long as the tab lives, which is as long as anything
    // can be promised when nothing can be stored.
    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("does not empty the editor undoing a reset of an empty program", () => {
    // An empty program is not backed up at all -- there is nothing in it to
    // bring back -- and restoring an empty backup would clear the program the
    // player has written since.
    const { editor, view } = setUp();
    view.type("");
    editor.reset();
    view.type("// written since");

    editor.undoReset();

    expect(view.getValue()).toBe("// written since");
  });

  it("never brings one buffer's backup back into another", () => {
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.reset();

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    editor.undoReset();

    expect(view.getValue()).toBe("// task 1");
    editor.openPlayerBuffer();
    editor.undoReset();
    expect(view.getValue()).toBe("// my own program");
  });

  it("answers whether there is anything to bring back, buffer by buffer", () => {
    // What the run controls hide the "Undo reset" button on, so a wrong answer
    // is either a button that does nothing or a way back that is not offered.
    // Asked of the buffer on screen rather than of the editor as a whole, for
    // the same reason the backup slot is per buffer: a task that was reset must
    // not offer to undo it from the player's own program.
    const { editor, view } = setUp();

    expect(editor.canUndoReset()).toBe(false);

    view.type("// my own program");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    editor.openTutorialBuffer("tutorial-1", "// task 1");
    expect(editor.canUndoReset()).toBe(false);

    editor.openPlayerBuffer();
    expect(editor.canUndoReset()).toBe(true);
  });

  it("withdraws the offer once the player has written over the skeleton", () => {
    // The state the offer is for is "the reset happened and I have not started
    // again yet". A player who has started again has something to lose, and
    // "Undo reset" is the button that would lose it.
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    view.type(`${defaultCode()}\n// a second attempt`);

    expect(editor.canUndoReset()).toBe(false);
  });

  it("still offers the way back to a player who reset and came back later", () => {
    // The backup is in the store, not in the page, and this is what that is
    // for: the reset is autosaved a second after it happens, so a player who
    // closes the tab and returns finds the skeleton -- and nothing else to go
    // on. An answer that lived only in this page's memory would have quietly
    // dropped the program on the way.
    const storage = new MemoryStorage();
    const first = setUp(storage);
    first.view.type("// an afternoon of work");
    first.editor.reset();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    const returning = setUp(storage);

    expect(returning.view.getValue()).toBe(defaultCode());
    expect(returning.editor.canUndoReset()).toBe(true);
    returning.editor.undoReset();
    expect(returning.view.getValue()).toBe("// an afternoon of work");
  });

  it("says there is nothing to bring back when the reset was refused", () => {
    // A refused reset leaves the program where it was -- and the copy `#write`
    // kept in this page behind it, since the write is attempted before the
    // refusal is decided. Asking only whether the slot holds something would
    // put "Undo reset" on screen offering to undo a reset that never happened.
    const program = "// an afternoon of work";
    const { editor, view } = setUp(crowdedStorage({ [CODE_STORAGE_KEY]: program }));
    view.value = program;

    expect(editor.reset()).toBe(false);

    expect(editor.canUndoReset()).toBe(false);
    // And goes on saying so. Typing is not a reset: an answer that compared the
    // slot with the screen would say `true` again from here, and the button
    // would surface at the next pause offering to undo something that never
    // happened -- taking this line with it.
    view.type("// and another paragraph of it");
    expect(editor.canUndoReset()).toBe(false);
  });

  it("says there is nothing to bring back once it has been brought back", () => {
    // The backup outlives the undo that used it, so the button would sit there
    // afterwards restoring the program already in front of the player.
    const { editor, view } = setUp();
    view.type("// worth keeping");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    editor.undoReset();

    expect(editor.canUndoReset()).toBe(false);
    // The dangerous half of the same question. The undo is done; carrying on
    // from the restored program must not re-arm a button whose dialog still
    // says "as before the last reset" and whose effect is now to discard
    // everything written since.
    view.type("// written since");
    expect(editor.canUndoReset()).toBe(false);
  });
});

describe("CodeEditor compilation", () => {
  it("compiles the program and reports success", () => {
    const { editor, view } = setUp();
    const success = vi.fn();
    editor.on("code_success", success);
    view.value = "{ init: function() {}, update: function() {} }";

    const codeObj = editor.getCodeObj();

    expect(typeof codeObj?.init).toBe("function");
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("reports a program that does not compile, without throwing", () => {
    const { editor, view } = setUp();
    const failure = vi.fn();
    editor.on("usercode_error", failure);
    view.value = "{ this is not javascript";

    expect(editor.getCodeObj()).toBeNull();
    expect(failure).toHaveBeenCalledTimes(1);
  });

  it("compiles the default program every player starts with", () => {
    const { editor } = setUp();
    expect(editor.getCodeObj()).not.toBeNull();
  });

  it("puts an error mark on the surface, and takes it off again", () => {
    // The position comes from a run that was already going, not from
    // compilation, so the editor has no way to work it out and no business
    // second-guessing it — it carries it through exactly as given.
    const { editor, view } = setUp();

    editor.markError({ line: 4, column: 9 });
    editor.markError(undefined);

    expect(view.errorMarks).toEqual([{ line: 4, column: 9 }, undefined]);
  });
});

describe("CodeEditor marking what threw", () => {
  const THROWS_ON_LINE_4 = [
    "{",
    "  init: function (elevators, floors) {},",
    "  update: function (dt, elevators, floors) {",
    "    missingHelper();",
    "  },",
    "}",
  ].join("\n");

  /**
   * Compiles what is in the editor and runs it until it throws.
   *
   * The error is the engine's own, carrying a real stack, because that is what
   * the app forwards: a hand-made object would only prove the editor passes
   * objects along.
   *
   * @param editor - The editor holding the program.
   * @returns Whatever the program threw.
   * @throws {Error} When it compiled and then did not throw, since the test
   * after that would be asserting about nothing.
   */
  function runUntilItThrows(editor: CodeEditor): unknown {
    const codeObj = editor.getCodeObj();
    if (codeObj === null) {
      throw new Error("The program was expected to compile and did not");
    }
    try {
      codeObj.update(0.1, [], []);
    } catch (error: unknown) {
      return error;
    }
    throw new Error("The program was expected to throw and did not");
  }

  it("marks the line a running program threw on", () => {
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;

    editor.trigger("usercode_error", runUntilItThrows(editor));

    expect(view.errorMark).toEqual({ line: 4, column: 5 });
  });

  it("takes the last run's mark off before the next one starts", () => {
    // Applying is the player saying they have changed something. Whatever the
    // old mark was under, it is being reconsidered, and a mark left over from
    // the previous attempt would sit there through the whole of the new run.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    editor.trigger("usercode_error", runUntilItThrows(editor));

    editor.getCodeObj();

    expect(view.errorMark).toBeUndefined();
  });

  it("refuses to mark when the player has edited since the program compiled", () => {
    // The error belongs to the text that was compiled, and its line 4 is not
    // this document's line 4 any more. Underlining anyway would point at a line
    // chosen by how far the edit happened to shift things.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    const thrown = runUntilItThrows(editor);
    view.type(["{", "  init: function () {},", "  update: function () {},", "}"].join("\n"));

    editor.trigger("usercode_error", thrown);

    expect(view.errorMark).toBeUndefined();
    expect(view.errorMarks).toEqual([undefined]);
  });

  it("says nothing about a program that did not compile", () => {
    // A syntax error has no line to give -- the code never ran -- and the
    // banner says what is wrong without one.
    const { editor, view } = setUp();
    view.value = "{ init: function ( }";

    expect(editor.getCodeObj()).toBeNull();
    expect(view.errorMark).toBeUndefined();
  });

  it("leaves the previous run's line alone once a later program fails to compile", () => {
    // The failed compilation did not replace the running program, so a runtime
    // error arriving now still belongs to the one that is running -- but the
    // document on screen is the broken text, and nothing in it is that line.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    const thrown = runUntilItThrows(editor);
    view.type("{ init: function ( }");
    editor.getCodeObj();

    editor.trigger("usercode_error", thrown);

    expect(view.errorMark).toBeUndefined();
  });

  it("forgets the running program once a later compilation fails", () => {
    // The document is put back to exactly the text that threw, so the "has the
    // player edited?" guard would let this through. What stops it is that a
    // failed compilation ends the run: the app starts the world with a no-op
    // when `getCodeObj` returns null, so this program is not running any more
    // and its old error is not about anything on screen.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    const thrown = runUntilItThrows(editor);
    view.type("{ init: function ( }");
    editor.getCodeObj();
    view.type(THROWS_ON_LINE_4);

    editor.trigger("usercode_error", thrown);

    expect(view.errorMark).toBeUndefined();
  });

  it("says nothing about an error that arrives before anything has been compiled", () => {
    const { editor, view } = setUp();

    editor.trigger("usercode_error", new Error("from somewhere else entirely"));

    expect(view.errorMarks).toEqual([]);
  });

  it("marks nothing when the failure has no line to point at", () => {
    // "Code must contain an init function" is thrown after the program was
    // evaluated, from the game's own module, so no frame on it is the
    // player's. The mark is cleared rather than guessed at.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    runUntilItThrows(editor);

    editor.trigger("usercode_error", new Error("Code must contain an init function"));

    expect(view.errorMark).toBeUndefined();
    expect(view.errorMarks).toEqual([undefined, undefined]);
  });
});

describe("CodeEditor events", () => {
  it("passes an in-editor apply on to its listeners", () => {
    const { editor, view } = setUp();
    const apply = vi.fn();
    editor.on("apply_code", apply);

    view.handlers.onApply();

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("saves when the view asks it to", () => {
    const { editor, view, storage } = setUp();
    view.value = "// via shortcut";
    view.handlers.onSave();
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// via shortcut");
    expect(editor.getCode()).toBe("// via shortcut");
  });

  it("forwards focus to the view", () => {
    const { editor, view } = setUp();
    editor.focus();
    expect(view.focusCount).toBe(1);
  });
});

describe("CodeEditor over a real editing surface", () => {
  /**
   * Mounts a CodeMirror-backed editor over a storage holding `code`.
   *
   * @param code - The program already in storage, if any.
   * @returns The editor, its storage and a spy on writes to that storage.
   */
  function mount(code?: string): {
    editor: CodeEditor;
    storage: MemoryStorage;
    setItem: ReturnType<typeof vi.spyOn<Storage, "setItem">>;
    parent: HTMLElement;
  } {
    const parent = document.createElement("div");
    document.body.append(parent);
    const storage = new MemoryStorage();
    if (code !== undefined) {
      storage.setItem(CODE_STORAGE_KEY, code);
    }
    const setItem = vi.spyOn(storage, "setItem");
    return {
      editor: new CodeEditor(codeMirrorView(parent), { storage }),
      storage,
      setItem,
      parent,
    };
  }

  /**
   * Finds the editing surface the editor mounted.
   *
   * @param parent - The element the editor was mounted in.
   * @returns The live view.
   */
  function viewIn(parent: HTMLElement): EditorView {
    const view = EditorView.findFromDOM(parent);
    if (view === null) {
      throw new Error("The editor did not mount");
    }
    return view;
  }

  /**
   * Adds a line to the end of the document, as typing there would.
   *
   * Through a dispatch on the live view rather than through `setCode`, because
   * what these tests need is an ordinary edit of the kind the undo history
   * records — the same thing a keystroke produces, and the thing a buffer
   * switch must not be.
   *
   * @param parent - The element the editor was mounted in.
   * @param line - The text to append.
   */
  function typeLine(parent: HTMLElement, line: string): void {
    const view = viewIn(parent);
    view.dispatch({ changes: { from: view.state.doc.length, insert: line } });
  }

  /**
   * Everything ever written to the player's own key, in order.
   *
   * @param setItem - The spy on the storage the editor was given.
   * @returns The programs written, oldest first.
   */
  function playerWrites(setItem: ReturnType<typeof vi.spyOn<Storage, "setItem">>): string[] {
    return setItem.mock.calls.filter(([key]) => key === CODE_STORAGE_KEY).map(([, value]) => value);
  }

  /**
   * Presses the editor's own undo shortcut, as a player would.
   *
   * Through a keystroke rather than by calling `undo()` from
   * `@codemirror/commands`, which is only in the tree as a dependency of
   * `codemirror` and which the game itself never imports: what is worth pinning
   * is that the key the player actually presses cannot reach across a buffer
   * switch, whichever command `basicSetup` has bound to it.
   *
   * @param parent - The element the editor was mounted in.
   */
  function pressUndo(parent: HTMLElement): void {
    const view = viewIn(parent);
    // Both spellings of Mod, since only one of them is bound on any given
    // platform and jsdom is not the platform the player is on.
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", keyCode: 90, bubbles: true, ...modifier }),
      );
    }
  }

  it("does not save, or announce a save, just for having been built", () => {
    // Regression: CodeMirror 6 dispatches a document change for the initial
    // document, so populating the editor after wiring the change listener
    // scheduled an autosave. One second after every single page load the
    // player was told "Code saved ..." and their storage was rewritten,
    // unasked. The legacy game populated the editor first and only then
    // registered its autosaver (app.js:50-55, :77-81).
    const { editor, setItem } = mount("// the program the player left behind");
    // A stand-in for whatever a page hangs off the `saved` event.
    const saveMessage = document.createElement("span");
    editor.on("saved", (savedAt) => {
      saveMessage.textContent = `Code saved ${savedAt.toTimeString()}`;
    });

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 5);

    expect(setItem).not.toHaveBeenCalled();
    expect(saveMessage.textContent).toBe("");
    expect(editor.getCode()).toBe("// the program the player left behind");
  });

  it("still autosaves a document change that follows", () => {
    const { editor, storage, setItem } = mount();
    const saved = vi.fn();
    editor.on("saved", saved);

    editor.setCode("// edited");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// edited");
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it("hands a real editing surface its own text back, in both directions", () => {
    // The round trip over the surface that ships, not only over the fake. The
    // fake cannot get a swap wrong in the way that matters: CodeMirror's swap
    // builds a whole new state, which is the one operation in this file that
    // raises no change event, and everything the editor does about writing text
    // back hangs off change events.
    const { editor, storage, parent } = mount("// the program the player left behind");

    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");
    typeLine(parent, "\n// my attempt at task 1");
    editor.openPlayerBuffer();
    expect(editor.getCode()).toBe("// the program the player left behind");

    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");
    expect(editor.getCode()).toBe("// task 1 skeleton\n// my attempt at task 1");

    editor.openPlayerBuffer();
    typeLine(parent, "\n// and a line of my own");
    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");
    editor.openPlayerBuffer();
    expect(editor.getCode()).toBe("// the program the player left behind\n// and a line of my own");

    // And every buffer's own text is where the next visit will look for it.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe(
      "// the program the player left behind\n// and a line of my own",
    );
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe(
      "// task 1 skeleton\n// my attempt at task 1",
    );
  });

  it("cannot be undone across a buffer switch", () => {
    // Regression, and the worst one this file has seen: a buffer switch used to
    // replace the document with an ordinary edit, which the undo history
    // recorded like any other. One Ctrl+Z with the player's own buffer open
    // then put a tutorial task's skeleton on screen, and the autosave a second
    // later wrote it into `elevatorCrushCode_v5` — the player's program
    // destroyed by a single keystroke, with no backup written, so "Undo reset"
    // could not bring it back either. Measured before the fix: undo applied,
    // document "// task 1 skeleton", storage the same a second later.
    //
    // The line typed into the task is what gives the test its teeth. Undo can
    // only reach back through a history that has something in it, so a switch
    // made with nothing typed since the last one is undoable-in-principle and
    // harmless-in-practice, and a test that never types passes under
    // implementations that do let the history cross.
    const { editor, storage, setItem, parent } = mount("// the program the player left behind");

    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");
    pressUndo(parent);
    pressUndo(parent);
    expect(editor.getCode()).toBe("// task 1 skeleton");

    typeLine(parent, "\n// my attempt");
    editor.openPlayerBuffer();
    pressUndo(parent);
    pressUndo(parent);
    expect(editor.getCode()).toBe("// the program the player left behind");

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    // Nothing was ever written to the player's key: the player never typed in
    // that buffer, and leaving a buffer nobody edited writes nowhere. Asserting
    // the whole list of writes and not just the value left behind is
    // deliberate — the damage this test exists to catch is a write of the wrong
    // text, which a later correct write would paper over by the time the run
    // ends.
    expect(playerWrites(setItem)).toEqual([]);
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe(
      "// task 1 skeleton\n// my attempt",
    );
  });

  it("saves a half-typed task into that task when the player leaves mid-countdown", () => {
    // The autosave is debounced by a second, so a player who types and clicks
    // straight through to the next task leaves with a countdown still running.
    // It has to be cancelled at the switch and the text written where it was
    // typed: left running, it fires with the next buffer open and writes one
    // task's work under the other's key — and if the next buffer is the
    // player's own, over the program they came back for.
    const { editor, storage, setItem, parent } = mount("// the program the player left behind");
    const saved = vi.fn();
    editor.on("saved", saved);

    editor.openTutorialBuffer("tutorial-2", "// task 2 skeleton");
    typeLine(parent, "\n// halfway through");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    editor.openPlayerBuffer();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe(
      "// task 2 skeleton\n// halfway through",
    );
    expect(playerWrites(setItem)).toEqual([]);
    expect(editor.getCode()).toBe("// the program the player left behind");
    // Leaving a buffer is not something the player asked to have saved, so the
    // "Code saved ..." line stays as it was.
    expect(saved).not.toHaveBeenCalled();
  });

  it("still undoes the player's own typing within a buffer", () => {
    // The other half of the regression above: the cure is dropping the editing
    // history at the switch, and it has to stop there. Undo is how a player
    // takes back the line they just wrote, in a tutorial task as anywhere else.
    const { editor, parent } = mount();
    editor.openTutorialBuffer("tutorial-1", "// task 1 skeleton");

    typeLine(parent, "\n// second thoughts");
    expect(editor.getCode()).toBe("// task 1 skeleton\n// second thoughts");
    pressUndo(parent);

    expect(editor.getCode()).toBe("// task 1 skeleton");
  });
});

describe("codeMirrorView", () => {
  it("mounts an editor that round-trips the document", () => {
    vi.useRealTimers();
    const parent = document.createElement("div");
    document.body.append(parent);
    const changes = vi.fn();

    const view = codeMirrorView(parent)(
      {
        onChange: changes,
        onApply: vi.fn(),
        onSave: vi.fn(),
      },
      "// start\n",
    );
    expect(view.getValue()).toBe("// start\n");
    expect(changes).not.toHaveBeenCalled();

    view.setValue("var a = 1;\n");

    expect(view.getValue()).toBe("var a = 1;\n");
    expect(changes).toHaveBeenCalled();
    expect(parent.querySelector(".cm-editor")).not.toBeNull();
    expect(parent.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
      "Elevator program",
    );
    expect(parent.querySelector<HTMLElement>(".cm-editor")?.tabIndex).toBe(-1);
  });

  it("offers the player API from the editor's own completion sources", () => {
    // The completions themselves are `completions.test.ts`'s business; what
    // this pins is the wiring, which is easy to get wrong in a way nothing else
    // notices: registered on the wrong language, or through
    // `autocompletion({override})`, the popup either never appears or appears
    // with the language's own keywords and locals thrown out.
    vi.useRealTimers();
    const parent = document.createElement("div");
    document.body.append(parent);

    codeMirrorView(parent)(
      { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
      "var elevator = elevators[0];\n",
    );

    const view = EditorView.findFromDOM(parent);
    expect(view).not.toBeNull();
    const sources = view?.state.languageDataAt<unknown>("autocomplete", 1) ?? [];
    expect(sources).toContain(playerApiCompletionSource);
    // The JavaScript language's own sources are still there beside ours.
    expect(sources.length).toBeGreaterThan(1);
  });

  it("completes a member deep in a real document, at the right offset", () => {
    // `completions.test.ts` works in line coordinates; this is the one thing it
    // cannot check, that the source turns them back into document offsets. Get
    // that wrong and the popup inserts over the wrong text.
    vi.useRealTimers();
    const parent = document.createElement("div");
    document.body.append(parent);

    codeMirrorView(parent)(
      { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
      "{\n    init: function(elevators, floors) {\n        elevators[0].goT",
    );
    const state = EditorView.findFromDOM(parent)?.state;
    if (state === undefined) {
      throw new Error("The editor did not mount");
    }

    const result = playerApiCompletionSource(new CompletionContext(state, state.doc.length, false));

    expect(result?.from).toBe(state.doc.length - "goT".length);
    expect(result?.options.map((option) => option.label)).toContain("goToFloor");
  });

  describe("the error mark", () => {
    /**
     * Mounts a real editor on a program.
     *
     * @param doc - The program to put in it.
     * @returns The surface, and the element it was mounted in.
     */
    function mount(doc: string): { view: TextEditorView; parent: HTMLElement } {
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      const view = codeMirrorView(parent)(
        { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
        doc,
      );
      return { view, parent };
    }

    const PROGRAM = ["{", "  update: function () {", "    boom();", "  },", "}"].join("\n");

    it("underlines from the failing character to the end of its line", () => {
      const { view, parent } = mount(PROGRAM);

      view.markError({ line: 3, column: 5 });

      expect(parent.querySelector(".cm-errorMark")?.textContent).toBe("boom();");
    });

    it("takes the mark away when asked for nothing", () => {
      const { view, parent } = mount(PROGRAM);
      view.markError({ line: 3, column: 5 });

      view.markError(undefined);

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    it("takes the mark away as soon as the program is edited", () => {
      // The player's first move on seeing the mark is to fix the line it is
      // under, and a red underline left beneath their correction says the
      // correction is what is wrong.
      const { view, parent } = mount(PROGRAM);
      view.markError({ line: 3, column: 5 });

      view.setValue(PROGRAM.replace("boom();", "elevators[0].goToFloor(0);"));

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    it("marks the last character when the column is past the end of the line", () => {
      // Rather than nothing: a mark spanning no characters is one CodeMirror
      // rejects outright, and a position at the very end of a line is what a
      // failure in a call that closes it reports.
      const { view, parent } = mount(PROGRAM);

      view.markError({ line: 3, column: 999 });

      expect(parent.querySelector(".cm-errorMark")?.textContent).toBe(";");
    });

    it("marks nothing on a line the program does not have", () => {
      const { view, parent } = mount(PROGRAM);

      view.markError({ line: 99, column: 1 });

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    // These two are regression guards rather than proofs: a line with nothing
    // on it has no character to underline, and the mark is skipped for it so
    // that the range never has to start before the line it belongs to. Removing
    // that guard was tried, and neither test noticed -- CodeMirror accepts the
    // resulting range, which reaches back over the preceding line break, and
    // draws nothing for it. They are here for the version of this that stops
    // being tolerant, and because "nothing is drawn" is the contract either way.
    it("marks nothing on a line with nothing on it", () => {
      const { view, parent } = mount("{\n\n}");

      view.markError({ line: 2, column: 1 });

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    it("marks nothing in an empty program", () => {
      const { view, parent } = mount("");

      expect(() => {
        view.markError({ line: 1, column: 1 });
      }).not.toThrow();
      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    it("leaves the caret where the player left it", () => {
      // The mark arrives while they are typing somewhere else. Selecting the
      // failing text would be the obvious way to show it and the wrong one.
      const { view, parent } = mount(PROGRAM);
      const editor = EditorView.findFromDOM(parent);
      editor?.dispatch({ selection: { anchor: 1 } });

      view.markError({ line: 3, column: 5 });

      expect(editor?.state.selection.main.anchor).toBe(1);
    });
  });

  describe("the language the editing surface is named in", () => {
    afterEach(() => {
      setLocale(DEFAULT_LOCALE);
    });

    it("names the surface in the locale the editor was mounted in", () => {
      // The one string the editor owns, and the only name the editing surface
      // has: CodeMirror's content element is a `contenteditable` div with no
      // label anywhere near it, so without this a screen reader announces the
      // whole game as an unnamed edit box.
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      setLocale("ru");

      codeMirrorView(parent)({ onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() }, "");

      expect(parent.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
        "Программа для лифтов",
      );
    });
  });
});

describe("the starting program", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("is the one in the catalogue for the language on screen", () => {
    // `editor.defaultCode.code` sat in both catalogues, fully translated, with
    // no caller: a Russian player was handed English comments in the first
    // JavaScript they ever see of this API, next to a Help page walking through
    // that same program in Russian.
    setLocale("ru");
    const { view } = setUp();

    expect(view.getValue()).toContain("// Возьмём первый лифт");
    expect(view.getValue()).not.toContain("// Let's use the first elevator");
  });

  it("follows the language, rather than the language it was imported in", () => {
    // The reason `PLAYER_BUFFER.starterCode` is a getter. A module-scope
    // constant is evaluated once, when this module is first imported, which is
    // before anything has resolved the player's locale -- so it would answer
    // English for the rest of the session no matter what the page says.
    const { editor, view } = setUp();
    expect(view.getValue()).toContain("// Let's use the first elevator");

    setLocale("ru");
    editor.reset();

    expect(view.getValue()).toContain("// Возьмём первый лифт");
  });

  // That the two versions are the same program with only the comments
  // translated is deliberately not asserted here. `catalogue.test.ts` already
  // asserts it for every `.code` key in the catalogue, of which this is one,
  // and a second copy would be a second thing to keep in step.
});
