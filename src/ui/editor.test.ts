// @vitest-environment jsdom

import { CompletionContext } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playerApiCompletionSource } from "./completions.ts";
import { DEFAULT_CODE, DEV_TEST_CODE } from "./default-code.ts";
import {
  AUTOSAVE_DELAY_MS,
  BACKUP_STORAGE_KEY,
  CODE_STORAGE_KEY,
  CodeEditor,
  codeMirrorView,
} from "./editor.ts";
import { FakeTextEditorView, MemoryStorage } from "./test-helpers.ts";

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
      view = new FakeTextEditorView(handlers, initialValue);
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
    expect(view.getValue()).toBe(DEFAULT_CODE);
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

  it("keeps working when the browser refuses storage", () => {
    // Safari in private mode throws from both getItem and setItem.
    const { editor, view } = setUp(deniedStorage());
    const saved = vi.fn();
    editor.on("saved", saved);

    expect(view.getValue()).toBe(DEFAULT_CODE);
    expect(() => {
      editor.save();
    }).not.toThrow();
    expect(saved).not.toHaveBeenCalled();
  });
});

describe("CodeEditor buffers", () => {
  it("gives every learning-track task a storage key of its own", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer(3, "// task 3 skeleton");
    view.type("// my attempt at task 3");
    editor.openTutorialBuffer(4, "// task 4 skeleton");

    // Pinned as literals for the same reason the two keys above are: the
    // spelling is what a half-finished attempt is found under a week later, and
    // asserting through the editor's own constant would let a rename pass every
    // test while quietly orphaning the work of everyone who had started.
    expect(storage.getItem("develevateTutorialCode_3")).toBe("// my attempt at task 3");
    expect(storage.getItem("develevateTutorialCode_4")).toBe("// task 4 skeleton");
  });

  it("opens a task nobody has started with the program it hands out", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer(1, "// fill this in");

    expect(view.getValue()).toBe("// fill this in");
    // Stored at once, so closing the tab without typing loses nothing and does
    // not reopen the task on someone else's text.
    expect(storage.getItem("develevateTutorialCode_1")).toBe("// fill this in");
  });

  it("keeps the attempt a task already holds instead of the starter program", () => {
    const storage = new MemoryStorage();
    storage.setItem("develevateTutorialCode_2", "// where I got to last time");
    const { editor, view } = setUp(storage);

    editor.openTutorialBuffer(2, "// fill this in");

    expect(view.getValue()).toBe("// where I got to last time");
    expect(storage.getItem("develevateTutorialCode_2")).toBe("// where I got to last time");
  });

  it("saves what is on screen before leaving, without waiting for the autosave", () => {
    const { editor, view, storage } = setUp();
    view.type("// typed a second ago");

    editor.openTutorialBuffer(1, "// fill this in");

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// typed a second ago");
  });

  it("hands every buffer back its own text, in both directions", () => {
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.openTutorialBuffer(1, "// task 1");
    view.type("// my task 1");
    editor.openTutorialBuffer(2, "// task 2");
    view.type("// my task 2");

    editor.openTutorialBuffer(1, "// task 1");
    expect(view.getValue()).toBe("// my task 1");
    editor.openTutorialBuffer(2, "// task 2");
    expect(view.getValue()).toBe("// my task 2");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// my own program");
  });

  it("loses nothing for a player who walks the track without typing", () => {
    const { editor, view, storage } = setUp();

    editor.openTutorialBuffer(1, "// task 1");
    expect(view.getValue()).toBe("// task 1");
    editor.openTutorialBuffer(2, "// task 2");
    editor.openPlayerBuffer();

    expect(view.getValue()).toBe(DEFAULT_CODE);
    // Nobody typed, so nothing claimed the player's key on their behalf: an
    // untouched install still looks untouched after a walk through the track.
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("never lets the track write over the player's own program", () => {
    const { editor, view, storage } = setUp();
    view.type("// the program I care about");
    editor.save();

    editor.openTutorialBuffer(1, "// task 1");
    view.type("// my task 1");
    editor.reset();
    editor.undoReset();
    editor.openTutorialBuffer(2, "// task 2");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem(CODE_STORAGE_KEY)).toBe("// the program I care about");
    editor.openPlayerBuffer();
    expect(view.getValue()).toBe("// the program I care about");
  });

  it("does not let a countdown started in one buffer go off in the next", () => {
    // The autosave is debounced by a second, so a switch always happens with a
    // write pending. It must land in the buffer whose text it is, and once.
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer(1, "// task 1");
    view.type("// typed in task 1");

    editor.openTutorialBuffer(2, "// task 2");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(storage.getItem("develevateTutorialCode_1")).toBe("// typed in task 1");
    expect(storage.getItem("develevateTutorialCode_2")).toBe("// task 2");
    expect(view.getValue()).toBe("// task 2");
  });

  it("autosaves later typing into the buffer that is open", () => {
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer(1, "// task 1");

    view.type("// typed after the switch");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(storage.getItem("develevateTutorialCode_1")).toBe("// typed after the switch");
    expect(storage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });

  it("leaves the buffer already on screen alone when it is opened again", () => {
    // Routers and interfaces repeat themselves; a redundant open must not
    // replace the document under a player who is typing in it.
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer(1, "// task 1");
    view.type("// half a thought");
    const changed = vi.fn();
    editor.on("change", changed);

    editor.openTutorialBuffer(1, "// task 1");

    expect(view.getValue()).toBe("// half a thought");
    expect(changed).not.toHaveBeenCalled();
    // The autosave the typing started is still coming.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.getItem("develevateTutorialCode_1")).toBe("// half a thought");
  });

  it("takes the newest starter program for the task on screen", () => {
    // Only the comments in a task's starter program are translated, but that is
    // enough: the same task hands over different text after a language switch,
    // and "Reset" owes the player the version they can read.
    const { editor, view } = setUp();
    editor.openTutorialBuffer(1, "// task 1 in English");
    view.type("// half a thought");

    editor.openTutorialBuffer(1, "// task 1 in another language");

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

    editor.openTutorialBuffer(1, "// task 1");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    // The program in the editor is a different program, so anything describing
    // it is stale. Nothing was saved on the player's behalf, though, and
    // claiming otherwise in the "Code saved ..." line would be a lie.
    expect(changed).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });

  it("refuses a task that is not a positive whole number", () => {
    // The number is parsed out of a URL the player can type by hand. A NaN or a
    // zero must not spell a key that several malformed routes share.
    const { editor, view, storage } = setUp();

    for (const task of [Number.NaN, 0, -1, 1.5]) {
      expect(() => {
        editor.openTutorialBuffer(task, "// task");
      }).toThrow(RangeError);
    }

    expect(view.getValue()).toBe(DEFAULT_CODE);
    expect(storage.getItem("develevateTutorialCode_NaN")).toBeNull();
    expect(storage.getItem("develevateTutorialCode_0")).toBeNull();
  });

  it("still switches buffers when the browser refuses storage", () => {
    // Nothing can be kept, but the editor must stay usable: every task opens on
    // its starter program instead of on an exception.
    const { editor, view } = setUp(deniedStorage());

    expect(() => {
      editor.openTutorialBuffer(1, "// task 1");
    }).not.toThrow();
    expect(view.getValue()).toBe("// task 1");
    view.type("// typed with nowhere to keep it");
    expect(() => {
      editor.openPlayerBuffer();
    }).not.toThrow();
    expect(view.getValue()).toBe(DEFAULT_CODE);
  });
});

describe("CodeEditor reset", () => {
  it("backs the program up before replacing it, and can bring it back", () => {
    const { editor, view, storage } = setUp();
    view.value = "// worth keeping";

    editor.reset();
    expect(view.getValue()).toBe(DEFAULT_CODE);
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
    editor.openTutorialBuffer(5, "// task 5 skeleton");
    view.type("// the wrong turn I took");

    editor.reset();

    expect(view.getValue()).toBe("// task 5 skeleton");
    editor.undoReset();
    expect(view.getValue()).toBe("// the wrong turn I took");
  });

  it("keeps a separate backup per buffer", () => {
    const { editor, view, storage } = setUp();
    editor.openTutorialBuffer(1, "// task 1");
    view.type("// my task 1");
    editor.reset();
    editor.openTutorialBuffer(2, "// task 2");
    view.type("// my task 2");
    editor.reset();
    expect(view.getValue()).toBe("// task 2");

    editor.openTutorialBuffer(1, "// task 1");
    editor.undoReset();

    // Task 1's own attempt, not task 2's, and the player's backup slot is
    // untouched by any of it.
    expect(view.getValue()).toBe("// my task 1");
    expect(storage.getItem("develevateTutorialBackupCode_1")).toBe("// my task 1");
    expect(storage.getItem(BACKUP_STORAGE_KEY)).toBeNull();
  });

  it("never brings one buffer's backup back into another", () => {
    const { editor, view } = setUp();
    view.type("// my own program");
    editor.reset();

    editor.openTutorialBuffer(1, "// task 1");
    editor.undoReset();

    expect(view.getValue()).toBe("// task 1");
    editor.openPlayerBuffer();
    editor.undoReset();
    expect(view.getValue()).toBe("// my own program");
  });

  it("loads the reference solution for devtest", () => {
    const { editor, view } = setUp();
    editor.setDevTestCode();
    expect(view.getValue()).toBe(DEV_TEST_CODE);
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

  it("compiles the devtest program", () => {
    const { editor } = setUp();
    editor.setDevTestCode();
    expect(editor.getCodeObj()).not.toBeNull();
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
  } {
    const parent = document.createElement("div");
    document.body.append(parent);
    const storage = new MemoryStorage();
    if (code !== undefined) {
      storage.setItem(CODE_STORAGE_KEY, code);
    }
    const setItem = vi.spyOn(storage, "setItem");
    return { editor: new CodeEditor(codeMirrorView(parent), { storage }), storage, setItem };
  }

  it("does not save, or announce a save, just for having been built", () => {
    // Regression: CodeMirror 6 dispatches a document change for the initial
    // document, so populating the editor after wiring the change listener
    // scheduled an autosave. One second after every single page load the
    // player was told "Code saved ..." and their storage was rewritten,
    // unasked. The legacy game populated the editor first and only then
    // registered its autosaver (app.js:50-55, :77-81).
    const { editor, setItem } = mount("// the program the player left behind");
    // Wired exactly as src/main.ts wires #save_message.
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
});
