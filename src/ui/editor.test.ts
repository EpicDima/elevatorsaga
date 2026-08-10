// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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
    const denied = (): never => {
      throw new Error("denied");
    };
    const storage: Storage = {
      get length(): number {
        return denied();
      },
      clear: denied,
      getItem: denied,
      key: denied,
      removeItem: denied,
      setItem: denied,
    };
    const { editor, view } = setUp(storage);
    const saved = vi.fn();
    editor.on("saved", saved);

    expect(view.getValue()).toBe(DEFAULT_CODE);
    expect(() => {
      editor.save();
    }).not.toThrow();
    expect(saved).not.toHaveBeenCalled();
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

  it("undoes to an empty document when there is no backup", () => {
    const { editor, view } = setUp();
    editor.undoReset();
    expect(view.getValue()).toBe("");
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
});
