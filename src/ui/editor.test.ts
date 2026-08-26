// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { CompletionContext } from "@codemirror/autocomplete";
import { SearchQuery, getSearchQuery, openSearchPanel, setSearchQuery } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { tutorialLevels } from "../game/tutorial.ts";
import type { TutorialLevel } from "../game/tutorial.ts";
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

/** A fake view where a "swap" replacement, unlike an edit, raises no `onChange` — matching the real surface. */
class SwapAwareView extends FakeTextEditorView {
  override setValue(value: string, replacement: TextReplacement = "edit"): void {
    if (replacement === "swap") {
      this.value = value;
      return;
    }
    super.setValue(value);
  }
}

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

/** The CodeMirror packages this editor mounts that put any label on screen of their own. */
const PHRASE_PACKAGES = [
  "@codemirror/view",
  "@codemirror/language",
  "@codemirror/search",
  "@codemirror/autocomplete",
  "@codemirror/commands",
];

/**
 * Every phrase those packages pass to `state.phrase()`, read out of the copies actually installed.
 * Both call shapes are literal at the call site — `phrase("go")` and `phrase(view, "next")` — so
 * the string literals inside each call's parentheses are the whole set.
 */
function bundledPhrases(): string[] {
  const resolve = createRequire(import.meta.url);
  const found = new Set<string>();
  for (const name of PHRASE_PACKAGES) {
    const source = readFileSync(resolve.resolve(name), "utf8");
    for (const [, call = ""] of source.matchAll(/\bphrase\(([^)]*)\)/g)) {
      for (const [, literal = ""] of call.matchAll(/"([^"]+)"/g)) {
        found.add(literal);
      }
    }
  }
  return [...found];
}

/** A `Storage` that throws from everything, as Safari does in private mode. */
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
 * A `Storage` with room for its existing keys and not one more: overwriting a
 * key with something no longer keeps working after a *new* key has stopped
 * fitting, mirroring a real quota's byte budget.
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
 * A `Storage` that holds text but refuses to reveal it: `getItem` throws while
 * `setItem` works, as with blocked site data (`SecurityError`).
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
  // jsdom has no layout, so CodeMirror's measure cycle throws without a stub
  // for this. It runs from a `requestAnimationFrame` callback outside any
  // test, so it's installed once here rather than reset per test.
  Range.prototype.getClientRects = function getClientRects(): DOMRectList {
    return Object.assign([], { item: () => null });
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("storage keys", () => {
  it("are exactly the keys the legacy game wrote", () => {
    // Pinned as literals, not the constants: renaming a constant must not
    // silently change the on-disk key existing players' saves are under.
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

  it("keeps the program in the page's own store when none is named", () => {
    // What the running game relies on: it names no store, so a player's
    // program survives a reload only if the default is the page's own.
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);

    const editor = new CodeEditor((handlers, initial) => new SwapAwareView(handlers, initial));
    editor.setCode("// mine");
    editor.save();

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// mine");
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
  it("gives every learning-track level a storage key of its own", () => {
    const { editor, view, storage } = setUp();

    editor.openNamedLevelBuffer("tutorial-3", "// level 3 skeleton");
    view.type("// my attempt at level 3");
    editor.openNamedLevelBuffer("tutorial-4", "// level 4 skeleton");

    // Literals again, for the reason above: a rename must not orphan existing attempts.
    expect(storage.getItem("develevateTutorialCode_tutorial-3")).toBe("// my attempt at level 3");
    expect(storage.getItem("develevateTutorialCode_tutorial-4")).toBe("// level 4 skeleton");
  });

  it("opens a level nobody has started with the program it hands out", () => {
    const { editor, view, storage } = setUp();

    editor.openNamedLevelBuffer("tutorial-1", "// fill this in");

    expect(view.getValue()).toBe("// fill this in");
    // Stored at once, so closing the tab without typing loses nothing.
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// fill this in");
  });

  it("keeps the attempt a level already holds instead of the starter program", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "// where I got to last time");
    const { editor, view } = setUp(storage);

    editor.openNamedLevelBuffer("tutorial-2", "// fill this in");

    expect(view.getValue()).toBe("// where I got to last time");
    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe(
      "// where I got to last time",
    );
  });

  it("saves what is on screen before leaving, without waiting for the autosave", () => {
    const { editor, view, storage } = setUp();
    view.type("// typed a second ago");

    editor.openNamedLevelBuffer("tutorial-1", "// fill this in");

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// typed a second ago");
  });

  it("does not claim the player's key for a program they typed and took back", () => {
    // Typed-then-reverted must not write the default program to the player's
    // key, or an untouched install would look like a played one.
    const { editor, view, storage } = setUp();
    view.type("// second thoughts");
    view.type(defaultCode());

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("hands every buffer back its own text, in both directions", () => {
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// my level 1");
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    view.type("// my level 2");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    expect(view.getValue()).toBe("// my level 1");
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    expect(view.getValue()).toBe("// my level 2");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// my own program");
  });

  it("loses nothing for a player who walks the track without typing", () => {
    const { editor, view, storage } = setUp();

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    expect(view.getValue()).toBe("// level 1");
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    editor.openPlayerBuffer();

    expect(view.getValue()).toBe(defaultCode());
    // Walking the track without typing must not claim the player's key.
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("never lets the track write over the player's own program", () => {
    const { editor, view, storage } = setUp();
    view.type("// the program I care about");
    editor.save();

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// my level 1");
    editor.reset();
    editor.undoReset();
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// the program I care about");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// the program I care about");
  });

  it("does not write a buffer nobody edited over another tab's work", () => {
    // Two tabs sharing one store: an idle tab must not write its stale copy
    // back over work saved from another tab just for opening a level link.
    const storage = new MemoryStorage();
    storage.setItem(CODE_STORAGE_KEY, "// version 1");
    const setItem = vi.spyOn(storage, "setItem");
    const idleTab = setUp(storage);
    const workingTab = setUp(storage);

    workingTab.view.type("// version 2, an afternoon of work");
    workingTab.editor.save();
    idleTab.editor.openNamedLevelBuffer("tutorial-1", "// level 1");

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// version 2, an afternoon of work");
    // The idle tab isn't holding a stale in-memory copy either.
    idleTab.editor.openPlayerBuffer();
    expect(idleTab.view.getValue()).toBe("// version 2, an afternoon of work");

    // Leaving the working tab's buffer doesn't write it again: the key was
    // already touched once, by the explicit save.
    workingTab.editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    expect(setItem.mock.calls.filter(([key]) => key === CODE_STORAGE_KEY)).toHaveLength(1);
  });

  it("stops counting the text as edited the moment the buffer is left", () => {
    // A switch must clear the "unsaved" flag with the old buffer, or the next
    // switch would write a buffer nobody has typed in.
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const { editor, view } = setUp(storage);
    view.type("// my own program");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    const writesSoFar = setItem.mock.calls.length;
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");

    // Only level 2's key is touched; level 1 is read but not rewritten.
    expect(setItem.mock.calls.slice(writesSoFar).map(([key]) => key)).toEqual([
      "develevateTutorialCode_tutorial-2",
    ]);
  });

  it("does not let a countdown started in one buffer go off in the next", () => {
    // A pending debounced autosave must land in the buffer it belongs to, not
    // fire after a switch into the next one.
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const { editor, view } = setUp(storage);
    const saved = vi.fn();
    editor.on("saved", saved);
    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// typed in level 1");

    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    const writesBeforeTheCountdown = setItem.mock.calls.length;
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// typed in level 1");
    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe("// level 2");
    expect(view.getValue()).toBe("// level 2");
    // Canceled, not merely harmless: left running it would write the new
    // level's own starter back over itself and falsely announce a save.
    expect(setItem.mock.calls.length).toBe(writesBeforeTheCountdown);
    expect(saved).not.toHaveBeenCalled();
  });

  it("autosaves later typing into the buffer that is open", () => {
    const { editor, view, storage } = setUp();
    editor.openNamedLevelBuffer("tutorial-1", "// level 1");

    view.type("// typed after the switch");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// typed after the switch");
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("leaves the buffer already on screen alone when it is opened again", () => {
    // A redundant open must not replace the document under a player typing in it.
    const { editor, view, storage } = setUp();
    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// half a thought");
    const changed = vi.fn();
    editor.on("change", changed);

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");

    expect(view.getValue()).toBe("// half a thought");
    expect(changed).not.toHaveBeenCalled();
    // The autosave the typing started is still coming.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe("// half a thought");
  });

  it("takes the newest starter program for the level on screen", () => {
    // "Reset" owes the player the version of the starter program they can
    // read, even if the level was opened in a different language.
    const { editor, view } = setUp();
    editor.openNamedLevelBuffer("tutorial-1", "// level 1 in English");
    view.type("// half a thought");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1 in another language");

    expect(view.getValue()).toBe("// half a thought");
    editor.reset();
    expect(view.getValue()).toBe("// level 1 in another language");
  });

  it("reports the change without announcing a save nobody asked for", () => {
    const { editor } = setUp();
    const saved = vi.fn();
    const changed = vi.fn();
    editor.on("saved", saved);
    editor.on("change", changed);

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    // The program changed, but nothing was saved on the player's behalf, and
    // claiming otherwise in the "Code saved ..." line would be a lie.
    expect(changed).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });

  it("refuses a level whose name is blank", () => {
    // A level id reaches the game from a URL the player can type by hand; an
    // empty one would spell the bare key prefix, shared by every malformed
    // route, so any two of them would collide.
    const { editor, view, storage } = setUp();

    for (const levelId of ["", " ", "\t\n"]) {
      expect(() => {
        editor.openNamedLevelBuffer(levelId, "// level");
      }).toThrow(RangeError);
    }

    expect(view.getValue()).toBe(defaultCode());
    expect(storage.getItem("develevateTutorialCode_")).toBeNull();
    expect(storage.getItem("develevateTutorialCode_ ")).toBeNull();
  });

  it("finds a level's attempt under the level's own name, wherever it sits in the track", () => {
    // Keyed by `TutorialLevel.id`, never by position: a level's position is
    // expected to change, and keying by position would let an inserted level
    // silently steal a later level's saved attempt.
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "// my attempt at the old level 2");
    const { editor, view } = setUp(storage);

    editor.openNamedLevelBuffer("tutorial-9", "// the newcomer's skeleton");
    expect(view.getValue()).toBe("// the newcomer's skeleton");

    editor.openNamedLevelBuffer("tutorial-2", "// level 2 skeleton");
    expect(view.getValue()).toBe("// my attempt at the old level 2");
  });

  it("does not put a level's starting point over an attempt it could not read", () => {
    // "The store has nothing" and "the store won't say" must not be treated
    // the same: showing the skeleton on screen is unavoidable, but writing it
    // over an unreadable attempt would destroy that attempt for good.
    const { storage, kept } = unreadableStorage({
      "develevateTutorialCode_tutorial-1": "// three evenings of work",
    });
    const { editor, view } = setUp(storage);

    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");

    expect(view.getValue()).toBe("// level 1 skeleton");
    expect(kept.getItem("develevateTutorialCode_tutorial-1")).toBe("// three evenings of work");
  });

  it("opens a level whose stored attempt was emptied on its starting point", () => {
    // An empty entry is no more use than a missing one.
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_tutorial-2", "");
    const { editor, view } = setUp(storage);

    editor.openNamedLevelBuffer("tutorial-2", "// fill this in");

    expect(view.getValue()).toBe("// fill this in");
  });

  it("still switches buffers when the browser refuses storage", () => {
    // Every level must open on its starter program instead of an exception.
    const { editor, view } = setUp(deniedStorage());

    expect(() => {
      editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    }).not.toThrow();
    expect(view.getValue()).toBe("// level 1");
    expect(() => {
      editor.openPlayerBuffer();
    }).not.toThrow();
    expect(view.getValue()).toBe(defaultCode());
  });

  it("keeps a switch lossless for as long as the tab lives when nothing can be stored", () => {
    // A store that stops accepting writes must not turn a buffer switch into a
    // shredder; whatever was typed stays safe for as long as the page is open.
    const { editor, view } = setUp(fullStorage({ [CODE_STORAGE_KEY]: "// yesterday's program" }));
    view.type("// an afternoon of work");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// my level 1");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// an afternoon of work");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    expect(view.getValue()).toBe("// my level 1");
  });

  it("says nothing was saved when nothing could be", () => {
    // In-page memory isn't persistence; "Code saved ..." would promise a next
    // visit the store can't honor.
    const { editor, view } = setUp(fullStorage());
    const saved = vi.fn();
    editor.on("saved", saved);

    view.type("// typed with nowhere to keep it");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(saved).not.toHaveBeenCalled();
  });
});

describe("CodeEditor level buffers", () => {
  it("gives every level's every slot a storage key of its own", () => {
    const { editor, view, storage } = setUp();

    editor.openChapter1Buffer(6, 2);
    view.type("// level 7, slot 2");
    editor.openChapter1Buffer(6, 3);
    view.type("// level 7, slot 3");
    editor.openChapter1Buffer(7, 2);

    // Literals again, for the reason above.
    expect(storage.getItem("develevateChallengeCode_6_2")).toBe("// level 7, slot 2");
    expect(storage.getItem("develevateChallengeCode_6_3")).toBe("// level 7, slot 3");
  });

  it("opens a slot nobody has used with the default program, writing it at once", () => {
    const { editor, view, storage } = setUp();

    editor.openChapter1Buffer(4, 2);

    expect(view.getValue()).toBe(defaultCode());
    // Stored at once, so leaving without typing loses nothing.
    expect(storage.getItem("develevateChallengeCode_4_2")).toBe(defaultCode());
  });

  it("keeps the attempt a slot already holds instead of the starter program", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_4_2", "// where I got to last time");
    const { editor, view } = setUp(storage);

    editor.openChapter1Buffer(4, 2);

    expect(view.getValue()).toBe("// where I got to last time");
  });

  it("carries a slot's program forward from the newest lower level that has one", () => {
    // An untouched slot falls back to the same slot in the newest lower level that has something.
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_5_2", "// slot 2 as of level 6");
    const { editor, view } = setUp(storage);

    editor.openChapter1Buffer(8, 2);

    expect(view.getValue()).toBe("// slot 2 as of level 6");
  });

  it("reaches past levels with nothing in the slot to the nearest one that has something", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateChallengeCode_3_2", "// slot 2 as of level 4");
    const { editor, view } = setUp(storage);

    // Nothing in levels 4-7's slot 2, so the search must not stop at the
    // immediately preceding level.
    editor.openChapter1Buffer(7, 2);

    expect(view.getValue()).toBe("// slot 2 as of level 4");
  });

  it("does not let a later level's slot reach back into an earlier one already opened", () => {
    const { editor, view } = setUp();
    editor.openChapter1Buffer(0, 2);
    const startedOn = view.getValue();

    editor.openChapter1Buffer(5, 2);
    view.type("// a much later program");
    editor.save();

    editor.openChapter1Buffer(0, 2);

    expect(view.getValue()).toBe(startedOn);
  });

  it("falls back to the legacy single-buffer key only for the first slot", () => {
    const storage = new MemoryStorage();
    storage.setItem(CODE_STORAGE_KEY, "// the program every existing player has");
    const { editor, view } = setUp(storage);

    editor.openChapter1Buffer(3, 1);
    expect(view.getValue()).toBe("// the program every existing player has");

    editor.openChapter1Buffer(3, 2);
    expect(view.getValue()).toBe(defaultCode());
  });

  it("opens the first slot when none is named", () => {
    const { editor, storage } = setUp();

    editor.openChapter1Buffer(2);

    expect(storage.getItem("develevateChallengeCode_2_1")).toBe(defaultCode());
  });

  it("carries typing not yet autosaved into the first level's first slot", () => {
    // The player's own buffer is open by default the first time a numbered
    // level opens, so its starter program must resolve against what's on
    // screen right now, not against whatever the key held before this flush.
    const { editor, view, storage } = setUp();
    view.type("// typed a moment ago, not yet autosaved");

    editor.openChapter1Buffer(0, 1);

    expect(view.getValue()).toBe("// typed a moment ago, not yet autosaved");
    expect(storage.getItem("develevateChallengeCode_0_1")).toBe(
      "// typed a moment ago, not yet autosaved",
    );
  });

  it("keeps a separate reset backup per level slot", () => {
    const { editor, view, storage } = setUp();
    editor.openChapter1Buffer(3, 1);
    view.type("// level 4, slot 1 attempt");
    editor.reset();
    editor.openChapter1Buffer(3, 2);
    view.type("// level 4, slot 2 attempt");
    editor.reset();
    expect(view.getValue()).toBe(defaultCode());

    editor.openChapter1Buffer(3, 1);
    editor.undoReset();

    // Slot 1's own attempt, not slot 2's, and slot 2's backup is untouched.
    expect(view.getValue()).toBe("// level 4, slot 1 attempt");
    expect(storage.getItem("develevateChallengeBackupCode_3_1")).toBe("// level 4, slot 1 attempt");
    expect(storage.getItem("develevateChallengeBackupCode_3_2")).toBe("// level 4, slot 2 attempt");
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
    // "Nothing to undo" is the ordinary state for a level never reset, so
    // pressing "Undo reset" there must not clear the editor.
    const { editor, view, storage } = setUp();
    view.type("// worth keeping");

    editor.undoReset();

    expect(view.getValue()).toBe("// worth keeping");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// worth keeping");
  });

  it("resets a learning-track level to that level's own starting point", () => {
    const { editor, view } = setUp();
    editor.openNamedLevelBuffer("tutorial-5", "// level 5 skeleton");
    view.type("// the wrong turn I took");

    editor.reset();

    expect(view.getValue()).toBe("// level 5 skeleton");
    editor.undoReset();
    expect(view.getValue()).toBe("// the wrong turn I took");
  });

  it("keeps a separate backup per buffer", () => {
    const { editor, view, storage } = setUp();
    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    view.type("// my level 1");
    editor.reset();
    editor.openNamedLevelBuffer("tutorial-2", "// level 2");
    view.type("// my level 2");
    editor.reset();
    expect(view.getValue()).toBe("// level 2");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    editor.undoReset();

    // Level 1's own attempt, not level 2's; the player's backup slot is untouched.
    expect(view.getValue()).toBe("// my level 1");
    expect(storage.getItem("develevateTutorialBackupCode_tutorial-1")).toBe("// my level 1");
    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBeNull();
  });

  it("keeps the first backup when Reset is pressed a second time", () => {
    // A second press must not overwrite the first backup, or "Undo reset"
    // would bring back the skeleton instead of the program Reset replaced.
    const { editor, view, storage } = setUp();
    view.type("// worth keeping");

    editor.reset();
    editor.reset();

    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBe("// worth keeping");
    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("keeps the backup when Reset follows an emptied editor", () => {
    // An empty backup is one `undoReset` refuses to restore, so writing an
    // empty backup over a real one would leave the recovery button doing nothing.
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
    // A silently failed backup followed by the autosave overwriting the
    // stored program would leave it in no copy anywhere, so reset must refuse
    // rather than risk that.
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
    // In a private window every write is refused, so there's no stored
    // program a reset could destroy: refusing here would protect nothing.
    const { editor, view } = setUp(deniedStorage());
    view.type("// worth keeping");
    // Long enough for the autosave to have tried and failed: the check must ask
    // what the store holds, not this page's own memory of what it has written.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(editor.reset()).toBe(true);

    expect(view.getValue()).toBe(defaultCode());
    // Recoverable only for as long as the tab lives, since nothing can be stored.
    editor.undoReset();
    expect(view.getValue()).toBe("// worth keeping");
  });

  it("does not empty the editor undoing a reset of an empty program", () => {
    // An empty program isn't backed up at all, or restoring that backup would
    // clear whatever the player has written since.
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

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    editor.undoReset();

    expect(view.getValue()).toBe("// level 1");
    editor.openPlayerBuffer();
    editor.undoReset();
    expect(view.getValue()).toBe("// my own program");
  });

  it("answers whether there is anything to bring back, buffer by buffer", () => {
    // Asked of the buffer on screen, not the editor as a whole: a level that
    // was reset must not offer to undo it from the player's own program.
    const { editor, view } = setUp();

    expect(editor.canUndoReset()).toBe(false);

    view.type("// my own program");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    editor.openNamedLevelBuffer("tutorial-1", "// level 1");
    expect(editor.canUndoReset()).toBe(false);

    editor.openPlayerBuffer();
    expect(editor.canUndoReset()).toBe(true);
  });

  it("withdraws the offer once the player has written over the skeleton", () => {
    // A player who has started again has something to lose, and "Undo reset" is the button that would lose it.
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    view.type(`${defaultCode()}\n// a second attempt`);

    expect(editor.canUndoReset()).toBe(false);
  });

  it("still offers the way back to a player who reset and came back later", () => {
    // A player returning after closing the tab has only the store to go on;
    // an answer kept in this page's memory would drop the program on the way.
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
    // A refused reset must not offer "Undo reset" just because a backup
    // attempt happened before the refusal was decided.
    const program = "// an afternoon of work";
    const { editor, view } = setUp(crowdedStorage({ [CODE_STORAGE_KEY]: program }));
    view.value = program;

    expect(editor.reset()).toBe(false);

    expect(editor.canUndoReset()).toBe(false);
    // Typing afterward is not a reset either, and must not re-arm the offer.
    view.type("// and another paragraph of it");
    expect(editor.canUndoReset()).toBe(false);
  });

  it("says there is nothing to bring back once it has been brought back", () => {
    // The backup outlives the undo that used it, so the offer must be
    // withdrawn or it would restore the program already on screen.
    const { editor, view } = setUp();
    view.type("// worth keeping");
    editor.reset();
    expect(editor.canUndoReset()).toBe(true);

    editor.undoReset();

    expect(editor.canUndoReset()).toBe(false);
    // Typing after the undo must not re-arm it: its effect would discard
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
    // The position comes from a run already going, not from compilation, so
    // the editor carries it through exactly as given rather than recomputing it.
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

  /** Compiles what is in the editor and runs it until it throws, so the error carries a real stack. */
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
    // A mark left over from the previous attempt must not sit through the whole of the new run.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    editor.trigger("usercode_error", runUntilItThrows(editor));

    editor.getCodeObj();

    expect(view.errorMark).toBeUndefined();
  });

  it("refuses to mark when the player has edited since the program compiled", () => {
    // The error's line 4 belongs to the compiled text, not this document's
    // current line 4; underlining anyway would point at an arbitrary line.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    const thrown = runUntilItThrows(editor);
    view.type(["{", "  init: function () {},", "  update: function () {},", "}"].join("\n"));

    editor.trigger("usercode_error", thrown);

    expect(view.errorMark).toBeUndefined();
    expect(view.errorMarks).toEqual([undefined]);
  });

  it("says nothing about a program that did not compile", () => {
    // A syntax error has no line to give: the code never ran.
    const { editor, view } = setUp();
    view.value = "{ init: function ( }";

    expect(editor.getCodeObj()).toBeNull();
    expect(view.errorMark).toBeUndefined();
  });

  it("leaves the previous run's line alone once a later program fails to compile", () => {
    // A failed compilation doesn't replace the running program, so a runtime
    // error arriving now still belongs to it, not to the broken text on screen.
    const { editor, view } = setUp();
    view.value = THROWS_ON_LINE_4;
    const thrown = runUntilItThrows(editor);
    view.type("{ init: function ( }");
    editor.getCodeObj();

    editor.trigger("usercode_error", thrown);

    expect(view.errorMark).toBeUndefined();
  });

  it("forgets the running program once a later compilation fails", () => {
    // A failed compilation ends the run, so a program's old error must not
    // resurface even if the document is put back to exactly the text that threw.
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
    // No frame of this error is the player's, so the mark is cleared rather than guessed at.
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

  function viewIn(parent: HTMLElement): EditorView {
    const view = EditorView.findFromDOM(parent);
    if (view === null) {
      throw new Error("The editor did not mount");
    }
    return view;
  }

  /** Appends a line via a dispatch on the live view, so it lands in the undo history like a real keystroke. */
  function typeLine(parent: HTMLElement, line: string): void {
    const view = viewIn(parent);
    view.dispatch({ changes: { from: view.state.doc.length, insert: line } });
  }

  function playerWrites(setItem: ReturnType<typeof vi.spyOn<Storage, "setItem">>): string[] {
    return setItem.mock.calls.filter(([key]) => key === CODE_STORAGE_KEY).map(([, value]) => value);
  }

  /** Presses the editor's actual undo shortcut, so the key a player presses is what's pinned, not `undo()` directly. */
  function pressUndo(parent: HTMLElement): void {
    const view = viewIn(parent);
    // Both spellings of Mod: only one is bound on any given platform, and
    // jsdom isn't the platform the player is on.
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", keyCode: 90, bubbles: true, ...modifier }),
      );
    }
  }

  it("does not save, or announce a save, just for having been built", () => {
    // CodeMirror 6 dispatches a document change for the initial document; that
    // must not schedule an autosave, or every page load would autosave unasked.
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
    // The round trip over the surface that ships, not just the fake: a real
    // swap builds a whole new state and raises no change event, unlike the fake.
    const { editor, storage, parent } = mount("// the program the player left behind");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");
    typeLine(parent, "\n// my attempt at level 1");
    editor.openPlayerBuffer();
    expect(editor.getCode()).toBe("// the program the player left behind");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");
    expect(editor.getCode()).toBe("// level 1 skeleton\n// my attempt at level 1");

    editor.openPlayerBuffer();
    typeLine(parent, "\n// and a line of my own");
    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");
    editor.openPlayerBuffer();
    expect(editor.getCode()).toBe("// the program the player left behind\n// and a line of my own");

    // And every buffer's own text is where the next visit will look for it.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(storage.getItem(CODE_STORAGE_KEY)).toBe(
      "// the program the player left behind\n// and a line of my own",
    );
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe(
      "// level 1 skeleton\n// my attempt at level 1",
    );
  });

  it("cannot be undone across a buffer switch", () => {
    // Regression: a buffer switch used to look like an ordinary edit to the
    // undo history, so Ctrl+Z from the player's buffer could bring back a
    // level's skeleton and autosave it over their program, unrecoverably.
    const { editor, storage, setItem, parent } = mount("// the program the player left behind");

    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");
    pressUndo(parent);
    pressUndo(parent);
    expect(editor.getCode()).toBe("// level 1 skeleton");

    typeLine(parent, "\n// my attempt");
    editor.openPlayerBuffer();
    pressUndo(parent);
    pressUndo(parent);
    expect(editor.getCode()).toBe("// the program the player left behind");

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    // The full write history is asserted, not just the final value: a bad
    // write here would otherwise be papered over by a later correct one.
    expect(playerWrites(setItem)).toEqual([]);
    expect(storage.getItem("develevateTutorialCode_tutorial-1")).toBe(
      "// level 1 skeleton\n// my attempt",
    );
  });

  it("saves a half-typed level into that level when the player leaves mid-countdown", () => {
    // A countdown still running at a switch must be canceled and its text
    // written where it was typed, or it fires under the next buffer's key.
    const { editor, storage, setItem, parent } = mount("// the program the player left behind");
    const saved = vi.fn();
    editor.on("saved", saved);

    editor.openNamedLevelBuffer("tutorial-2", "// level 2 skeleton");
    typeLine(parent, "\n// halfway through");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    editor.openPlayerBuffer();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem("develevateTutorialCode_tutorial-2")).toBe(
      "// level 2 skeleton\n// halfway through",
    );
    expect(playerWrites(setItem)).toEqual([]);
    expect(editor.getCode()).toBe("// the program the player left behind");
    // Leaving a buffer isn't something the player asked to have saved.
    expect(saved).not.toHaveBeenCalled();
  });

  it("still undoes the player's own typing within a buffer", () => {
    // Dropping the undo history at a switch must not stop undo from working within a buffer.
    const { editor, parent } = mount();
    editor.openNamedLevelBuffer("tutorial-1", "// level 1 skeleton");

    typeLine(parent, "\n// second thoughts");
    expect(editor.getCode()).toBe("// level 1 skeleton\n// second thoughts");
    pressUndo(parent);

    expect(editor.getCode()).toBe("// level 1 skeleton");
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
    // Pins the wiring, not the completions themselves: registered wrong, the
    // popup either never appears or drops the language's own sources.
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
    // Pins turning line coordinates back into document offsets; get that wrong
    // and the popup inserts over the wrong text.
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

  it("offers nothing where the game's API has no business being", () => {
    // `Math.` and the player's own objects are dotted into far more often than
    // an elevator, and a popup there is in the way.
    vi.useRealTimers();
    const parent = document.createElement("div");
    document.body.append(parent);

    codeMirrorView(parent)(
      { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
      "{\n    init: function() {\n        Math.",
    );
    const state = EditorView.findFromDOM(parent)?.state;
    if (state === undefined) {
      throw new Error("The editor did not mount");
    }

    const result = playerApiCompletionSource(new CompletionContext(state, state.doc.length, false));

    expect(result).toBeNull();
  });

  describe("the keys bound ahead of CodeMirror's own", () => {
    function mount(doc: string): {
      surface: TextEditorView;
      view: EditorView;
      onApply: ReturnType<typeof vi.fn>;
      onSave: ReturnType<typeof vi.fn>;
    } {
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      const onApply = vi.fn();
      const onSave = vi.fn();
      const surface = codeMirrorView(parent)({ onChange: vi.fn(), onApply, onSave }, doc);
      const view = EditorView.findFromDOM(parent);
      if (view === null) {
        throw new Error("The editor did not mount");
      }
      return { surface, view, onApply, onSave };
    }

    /** Presses a key on the live surface; a Mod- binding goes in both spellings, since only one of them is bound on any given platform. */
    function press(view: EditorView, key: string, keyCode: number, mod = false): void {
      for (const modifier of mod ? [{ ctrlKey: true }, { metaKey: true }] : [{}]) {
        view.contentDOM.dispatchEvent(
          new KeyboardEvent("keydown", { key, keyCode, bubbles: true, ...modifier }),
        );
      }
    }

    it("applies the program on Mod-Enter", () => {
      const { view, onApply } = mount("// mine");

      press(view, "Enter", 13, true);

      expect(onApply).toHaveBeenCalledOnce();
      // Bound ahead of the default keymap, whose own Mod-Enter opens a line.
      expect(view.state.doc.toString()).toBe("// mine");
    });

    it("saves the program on Mod-s, rather than the page", () => {
      const { view, onSave } = mount("// mine");

      press(view, "s", 83, true);

      expect(onSave).toHaveBeenCalledOnce();
      expect(view.state.doc.toString()).toBe("// mine");
    });

    it("indents by four spaces on Tab instead of moving focus on", () => {
      const { surface, view } = mount("boom();");
      surface.focus();

      press(view, "Tab", 9);

      expect(view.state.doc.toString()).toBe("    boom();");
      expect(document.activeElement).toBe(view.contentDOM);
    });

    it("lets Escape out of the editor, so Tab is not a keyboard trap", () => {
      const { surface, view } = mount("boom();");
      surface.focus();

      press(view, "Escape", 27);

      // On the wrapper, from where the next Tab continues out of the editor.
      expect(document.activeElement).toBe(view.dom);
      expect(view.state.doc.toString()).toBe("boom();");
    });

    it("focus() puts the caret back in the editing surface", () => {
      const { surface, view } = mount("boom();");

      surface.focus();

      expect(document.activeElement).toBe(view.contentDOM);
    });
  });

  describe("the error mark", () => {
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
      // A red underline left under the player's correction would say the correction is what's wrong.
      const { view, parent } = mount(PROGRAM);
      view.markError({ line: 3, column: 5 });

      view.setValue(PROGRAM.replace("boom();", "elevators[0].goToFloor(0);"));

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    it("marks the last character when the column is past the end of the line", () => {
      // Not nothing: CodeMirror rejects a mark spanning no characters outright.
      const { view, parent } = mount(PROGRAM);

      view.markError({ line: 3, column: 999 });

      expect(parent.querySelector(".cm-errorMark")?.textContent).toBe(";");
    });

    it("marks nothing on a line the program does not have", () => {
      const { view, parent } = mount(PROGRAM);

      view.markError({ line: 99, column: 1 });

      expect(parent.querySelector(".cm-errorMark")).toBeNull();
    });

    // A blank line has no character to underline, so the mark is skipped
    // rather than reaching back over the preceding line break.
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
      // Selecting the failing text would be the obvious way to show it, and the wrong one.
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
      // CodeMirror's content element has no label of its own; without this a
      // screen reader announces it as an unnamed edit box.
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      setLocale("ru");

      codeMirrorView(parent)({ onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() }, "");

      expect(parent.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
        "Программа для лифтов",
      );
    });

    it("says CodeMirror's own labels in that locale too", () => {
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      setLocale("ru");

      codeMirrorView(parent)({ onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() }, "");

      const state = EditorView.findFromDOM(parent)?.state;
      expect(state?.phrase("Find")).toBe("Найти");
      expect(state?.phrase("replace all")).toBe("заменить все");
      expect(state?.phrase("replaced $ matches", 3)).toBe("заменено совпадений: 3");
    });

    it("leaves no phrase its own packages use in English", () => {
      // Scanned rather than listed: an upgrade that adds a phrase is exactly what
      // would otherwise put one English label back on a Russian page, unnoticed.
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      setLocale("ru");

      codeMirrorView(parent)({ onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() }, "");

      const state = EditorView.findFromDOM(parent)?.state;
      if (state === undefined) {
        throw new Error("The editor did not mount");
      }
      const phrases = bundledPhrases();
      expect(phrases.length).toBeGreaterThan(20);
      expect(phrases.filter((phrase) => state.phrase(phrase) === phrase)).toEqual([]);
    });

    it("re-reads them when the language changes under an editor already on screen", () => {
      // Without this the search panel would stay English until the page was reloaded.
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      const view = codeMirrorView(parent)(
        { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
        "",
      );
      expect(EditorView.findFromDOM(parent)?.state.phrase("Find")).toBe("Find");

      setLocale("ru");
      view.relocalize();

      expect(parent.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
        "Программа для лифтов",
      );
      expect(EditorView.findFromDOM(parent)?.state.phrase("Find")).toBe("Найти");
    });

    it("rebuilds a search panel already open, keeping what was typed into it", () => {
      // The panel writes its labels once, in its constructor, so the reconfigure alone leaves an
      // open one in English. Reopening it takes the query from the selection unless it is restored.
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      const view = codeMirrorView(parent)(
        { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
        "elevators[0].goToFloor(3);",
      );
      const surface = EditorView.findFromDOM(parent);
      if (surface === null) {
        throw new Error("The editor did not mount");
      }
      openSearchPanel(surface);
      surface.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: "goToFloor" })),
        selection: { anchor: 0, head: "elevators".length },
      });
      const placeholder = (): string | null | undefined =>
        parent.querySelector(".cm-search input[name='search']")?.getAttribute("placeholder");
      expect(placeholder()).toBe("Find");

      setLocale("ru");
      view.relocalize();

      expect(placeholder()).toBe("Найти");
      expect(getSearchQuery(surface.state).search).toBe("goToFloor");
    });

    it("keeps them through a swap, which builds a whole new state", () => {
      vi.useRealTimers();
      const parent = document.createElement("div");
      document.body.append(parent);
      const view = codeMirrorView(parent)(
        { onChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn() },
        "",
      );

      setLocale("ru");
      view.relocalize();
      view.setValue("// a whole new buffer", "swap");

      expect(parent.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
        "Программа для лифтов",
      );
      expect(EditorView.findFromDOM(parent)?.state.phrase("Find")).toBe("Найти");
    });
  });
});

describe("the starting program", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("is the one in the catalog for the language on screen", () => {
    setLocale("ru");
    const { view } = setUp();

    expect(view.getValue()).toContain("// Возьмём первый лифт");
    expect(view.getValue()).not.toContain("// Let's use the first elevator");
  });

  it("follows the language, rather than the language it was imported in", () => {
    // `PLAYER_BUFFER.starterCode` must be a getter: a module-scope constant
    // would be evaluated at import time, before the locale is known.
    const { editor, view } = setUp();
    expect(view.getValue()).toContain("// Let's use the first elevator");

    setLocale("ru");
    editor.reset();

    expect(view.getValue()).toContain("// Возьмём первый лифт");
  });
});

describe("the program on screen when the language changes", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  function firstLesson(): TutorialLevel {
    const [level] = tutorialLevels;
    if (level === undefined) {
      throw new Error("The learning track has no levels");
    }
    return level;
  }

  it("is said again in the new language when the game is the one that wrote it", () => {
    // The language switch must reach the editor too, not just the rest of the page.
    const { editor, view } = setUp();
    expect(view.getValue()).toContain("// Let's use the first elevator");

    setLocale("ru");
    editor.relocalize();

    expect(view.getValue()).toBe(defaultCode());
    expect(view.getValue()).toContain("// Возьмём первый лифт");
  });

  it("is left exactly as it is when the player wrote it", () => {
    const mine = "// my own dispatcher\nelevators[0].goToFloor(3);";
    const { editor, view } = setUp();
    view.type(mine);

    setLocale("ru");
    editor.relocalize();

    expect(view.getValue()).toBe(mine);
  });

  it("says it changed, without announcing a save nobody asked for", () => {
    // Nothing is written: storage is read back through the same translation,
    // so the language it happens to hold is invisible.
    const { editor, storage } = setUp();
    const changed = vi.fn();
    const saved = vi.fn();
    editor.on("change", changed);
    editor.on("saved", saved);

    setLocale("ru");
    editor.relocalize();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("says nothing at all when there was nothing to translate", () => {
    const { editor } = setUp();
    const changed = vi.fn();
    editor.on("change", changed);

    editor.relocalize();

    expect(changed).not.toHaveBeenCalled();
  });

  it("still re-labels the surface when the program is the player's own", () => {
    // The accessible name and the search panel are the game's to translate, whoever wrote the code.
    const { editor, view } = setUp();
    view.type("// my own dispatcher");

    setLocale("ru");
    editor.relocalize();

    expect(view.relocalizeCount).toBe(1);
    expect(view.getValue()).toBe("// my own dispatcher");
  });

  it("resets a level to its starting point in the language on screen", () => {
    // "Reset" pressed an hour and a language later still owes the player the version they can read.
    const level = firstLesson();
    const { editor, view } = setUp();
    editor.openNamedLevelBuffer(level.id, level.startingCode);
    view.type("// half an idea");

    setLocale("ru");
    editor.reset();

    expect(view.getValue()).toBe(level.startingCode);
    expect(view.getValue()).toContain("//");
  });

  it("shows a level's stored starting point in the language on screen", () => {
    // An untouched buffer must show the level in the language it's reopened
    // in, not the language its skeleton happened to be stored in.
    setLocale("ru");
    const level = firstLesson();
    const russianSkeleton = level.startingCode;
    const { editor, view, storage } = setUp();
    editor.openNamedLevelBuffer(level.id, russianSkeleton);
    expect(storage.getItem(`develevateTutorialCode_${level.id}`)).toBe(russianSkeleton);

    setLocale(DEFAULT_LOCALE);
    editor.openPlayerBuffer();
    editor.openNamedLevelBuffer(level.id, level.startingCode);

    expect(view.getValue()).toBe(level.startingCode);
    expect(view.getValue()).not.toBe(russianSkeleton);
  });

  it("carries a starting point forward into the next level in the language on screen", () => {
    // A level with nothing of its own falls back to the previous level's
    // default, shown in the language on screen now, not the one it was stored in.
    setLocale("ru");
    const { editor, view } = setUp();
    editor.openChapter1Buffer(0, 1);
    expect(view.getValue()).toBe(defaultCode());

    setLocale(DEFAULT_LOCALE);
    editor.openChapter1Buffer(1, 1);

    expect(view.getValue()).toBe(defaultCode());
    expect(view.getValue()).toContain("// Let's use the first elevator");
  });

  it("finds the program the player left, whatever language they left it in", () => {
    // Unlike a starting point, a real attempt comes back byte for byte,
    // regardless of how many locale switches happened since.
    const mine = "// моя попытка\nelevators[0].goToFloor(2);";
    setLocale("ru");
    const { editor, view } = setUp();
    editor.openNamedLevelBuffer("tutorial-4", "// level 4 skeleton");
    view.type(mine);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    setLocale(DEFAULT_LOCALE);
    editor.openPlayerBuffer();
    editor.openNamedLevelBuffer("tutorial-4", "// level 4 skeleton");

    expect(view.getValue()).toBe(mine);
  });
});
