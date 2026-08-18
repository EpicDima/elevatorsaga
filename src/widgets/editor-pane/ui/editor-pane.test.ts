// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { CodeSlot } from "#features/manage-code-slots/index.ts";
import { requireElement, queryAll } from "#shared/lib/dom.ts";

import { editorPaneTemplate, presentEditorPane } from "./editor-pane.ts";

function baseOptions(overrides: Partial<Parameters<typeof presentEditorPane>[1]> = {}) {
  return {
    currentSlot: (): CodeSlot => 1,
    onSelectSlot: vi.fn(),
    canUndoReset: () => false,
    onResetCode: vi.fn(),
    onUndoReset: vi.fn(),
    onGotoLine: vi.fn(),
    ...overrides,
  };
}

describe("editorPaneTemplate", () => {
  it("draws the slots container, the codetools, the error banner and the editor mount", () => {
    const parent = document.createElement("div");
    parent.innerHTML = editorPaneTemplate();

    expect(requireElement(".slots", parent).getAttribute("role")).toBe("group");
    expect(requireElement(".resetcode", parent).tagName).toBe("BUTTON");
    expect(requireElement(".undoreset", parent).tagName).toBe("BUTTON");
    expect(requireElement(".errorline", parent)).not.toBeNull();
    expect(requireElement(".editor", parent).children).toHaveLength(0);
  });

  it("ships the undo-reset button, the error banner and the goto link hidden", () => {
    const parent = document.createElement("div");
    parent.innerHTML = editorPaneTemplate();

    expect(requireElement(".undoreset", parent).hidden).toBe(true);
    expect(requireElement(".errorline", parent).hidden).toBe(true);
    expect(requireElement(".goto", parent).hidden).toBe(true);
  });

  it("gives every button an explicit type, so none of them submit a form", () => {
    const parent = document.createElement("div");
    parent.innerHTML = editorPaneTemplate();

    for (const button of parent.querySelectorAll("button")) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });
});

describe("presentEditorPane", () => {
  it("draws the code slot switcher, marking the open slot", () => {
    const parent = document.createElement("div");
    presentEditorPane(parent, baseOptions({ currentSlot: () => 2 }));

    const buttons = queryAll(".codeslot", parent);
    expect(buttons.map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("reports the slot pressed to onSelectSlot", () => {
    const onSelectSlot = vi.fn();
    const parent = document.createElement("div");
    presentEditorPane(parent, baseOptions({ onSelectSlot }));

    queryAll(".codeslot", parent)[2]?.click();

    expect(onSelectSlot).toHaveBeenCalledTimes(1);
    expect(onSelectSlot).toHaveBeenCalledWith(3);
  });

  it("labels the codetools buttons on the first draw", () => {
    const parent = document.createElement("div");
    presentEditorPane(parent, baseOptions());

    expect(requireElement(".resetcode", parent).textContent).toBe("Reset code");
    expect(requireElement(".undoreset", parent).textContent).toBe("Undo reset");
  });

  it("calls onResetCode when reset code is clicked", () => {
    const onResetCode = vi.fn();
    const parent = document.createElement("div");
    presentEditorPane(parent, baseOptions({ onResetCode }));

    requireElement(".resetcode", parent).click();

    expect(onResetCode).toHaveBeenCalledOnce();
  });

  it("calls onUndoReset when undo reset is clicked", () => {
    const onUndoReset = vi.fn();
    const parent = document.createElement("div");
    presentEditorPane(parent, baseOptions({ canUndoReset: () => true, onUndoReset }));

    requireElement(".undoreset", parent).click();

    expect(onUndoReset).toHaveBeenCalledOnce();
  });

  it("hides undo reset until canUndoReset says there is one to take back", () => {
    let canUndo = false;
    const parent = document.createElement("div");
    const presenter = presentEditorPane(parent, baseOptions({ canUndoReset: () => canUndo }));

    expect(requireElement(".undoreset", parent).hidden).toBe(true);

    canUndo = true;
    presenter.update();

    expect(requireElement(".undoreset", parent).hidden).toBe(false);
  });

  it("moves the slot mark on update, same as the standalone switcher", () => {
    let slot: CodeSlot = 1;
    const parent = document.createElement("div");
    const presenter = presentEditorPane(parent, baseOptions({ currentSlot: () => slot }));

    slot = 3;
    presenter.update();

    expect(
      queryAll(".codeslot", parent).map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "false", "true"]);
  });

  it("exposes the editor mount point, empty, for a later phase to fill", () => {
    const parent = document.createElement("div");
    const presenter = presentEditorPane(parent, baseOptions());

    expect(presenter.editorMount.className).toBe("editor");
    expect(presenter.editorMount.children).toHaveLength(0);
  });

  describe("showError", () => {
    it("shows the banner with the thrown error's message, as text rather than markup", () => {
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions());
      const error = new Error("<img src=x onerror=alert(1)>");
      error.stack = "";

      presenter.showError(error, "");

      const errorLine = requireElement(".errorline", parent);
      expect(errorLine.hidden).toBe(false);
      const message = requireElement(".errormessage", errorLine);
      expect(message.textContent).toBe("Error: <img src=x onerror=alert(1)>");
      expect(message.children).toHaveLength(0);
    });

    it("shows the goto link and points it at the located line", () => {
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions());
      const code = "line one\nline two\nthrow new Error('boom')\n";
      const error = new Error("boom");
      error.stack = "Error: boom\n    at eval (eval at run (code.js), <anonymous>:3:7)";

      presenter.showError(error, code);

      const goto = requireElement(".goto", parent);
      expect(goto.hidden).toBe(false);
      expect(goto.textContent).toBe("Line 3 →");
    });

    it("calls onGotoLine with the located line when the goto link is clicked", () => {
      const onGotoLine = vi.fn();
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions({ onGotoLine }));
      const code = "line one\nline two\nthrow new Error('boom')\n";
      const error = new Error("boom");
      error.stack = "Error: boom\n    at eval (eval at run (code.js), <anonymous>:3:7)";

      presenter.showError(error, code);
      requireElement(".goto", parent).click();

      expect(onGotoLine).toHaveBeenCalledTimes(1);
      expect(onGotoLine).toHaveBeenCalledWith(3);
    });

    it("hides the goto link when no location can be found", () => {
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions());

      presenter.showError("plain string failure", "");

      expect(requireElement(".goto", parent).hidden).toBe(true);
    });

    it("replaces any previous banner", () => {
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions());

      presenter.showError(new Error("first"), "");
      presenter.showError("second", "");

      expect(requireElement(".errormessage", parent).textContent).toBe("second");
    });
  });

  describe("clearError", () => {
    it("hides the banner", () => {
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions());

      presenter.showError(new Error("boom"), "");
      presenter.clearError();

      expect(requireElement(".errorline", parent).hidden).toBe(true);
    });

    it("stops a stale goto click from firing after the banner is cleared", () => {
      const onGotoLine = vi.fn();
      const parent = document.createElement("div");
      const presenter = presentEditorPane(parent, baseOptions({ onGotoLine }));
      const code = "line one\nline two\nthrow new Error('boom')\n";
      const error = new Error("boom");
      error.stack = "Error: boom\n    at eval (eval at run (code.js), <anonymous>:3:7)";

      presenter.showError(error, code);
      const goto = requireElement(".goto", parent);
      presenter.clearError();
      // The banner is hidden, not removed, so its now-unreachable goto button
      // could still be clicked programmatically -- this makes sure that
      // doesn't fire a stale line.
      goto.click();

      expect(onGotoLine).not.toHaveBeenCalled();
    });
  });
});
