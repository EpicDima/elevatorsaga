// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentGlobalShortcuts } from "./global-shortcuts.ts";

/** Builds the shortcut-driven buttons and callbacks, wired against `document`. */
function setUp(): {
  onStartStop: ReturnType<typeof vi.fn>;
  onStartOver: ReturnType<typeof vi.fn>;
  onSettingsOpen: ReturnType<typeof vi.fn>;
  onOpenDocs: ReturnType<typeof vi.fn>;
  onCycleLayout: ReturnType<typeof vi.fn>;
  other: HTMLDivElement;
  input: HTMLInputElement;
  editorContent: HTMLDivElement;
} {
  const startStopButton = document.createElement("button");
  const startOverButton = document.createElement("button");
  const settingsOpenButton = document.createElement("button");
  const other = document.createElement("div");
  const input = document.createElement("input");
  const editor = document.createElement("div");
  editor.className = "cm-editor";
  const editorContent = document.createElement("div");
  editor.append(editorContent);
  document.body.append(startStopButton, startOverButton, settingsOpenButton, other, input, editor);

  const onStartStop = vi.fn();
  const onStartOver = vi.fn();
  const onSettingsOpen = vi.fn();
  startStopButton.addEventListener("click", onStartStop);
  startOverButton.addEventListener("click", onStartOver);
  settingsOpenButton.addEventListener("click", onSettingsOpen);

  const onOpenDocs = vi.fn();
  const onCycleLayout = vi.fn();

  presentGlobalShortcuts({
    root: document,
    startStopButton,
    startOverButton,
    settingsOpenButton,
    onOpenDocs,
    onCycleLayout,
  });

  return {
    onStartStop,
    onStartOver,
    onSettingsOpen,
    onOpenDocs,
    onCycleLayout,
    other,
    input,
    editorContent,
  };
}

/** Dispatches a bubbling keydown as if `target` were the focused element. */
function keydown(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true }));
}

describe("presentGlobalShortcuts", () => {
  it("starts or pauses on Space when nothing is focused", () => {
    const { onStartStop } = setUp();

    keydown(document.body, { key: " " });

    expect(onStartStop).toHaveBeenCalledOnce();
  });

  it("leaves Space alone when something other than the body is focused", () => {
    const { onStartStop, other } = setUp();

    keydown(other, { key: " " });

    expect(onStartStop).not.toHaveBeenCalled();
  });

  it("starts the run over on Ctrl-Enter", () => {
    const { onStartOver } = setUp();

    keydown(document.body, { key: "Enter", ctrlKey: true });

    expect(onStartOver).toHaveBeenCalledOnce();
  });

  it("starts the run over on Cmd-Enter", () => {
    const { onStartOver } = setUp();

    keydown(document.body, { key: "Enter", metaKey: true });

    expect(onStartOver).toHaveBeenCalledOnce();
  });

  it("leaves plain Enter alone", () => {
    const { onStartOver } = setUp();

    keydown(document.body, { key: "Enter" });

    expect(onStartOver).not.toHaveBeenCalled();
  });

  it("leaves Ctrl-Enter alone while typing in a form field", () => {
    const { onStartOver, input } = setUp();

    keydown(input, { key: "Enter", ctrlKey: true });

    expect(onStartOver).not.toHaveBeenCalled();
  });

  it("leaves Ctrl-Enter alone inside CodeMirror's own editor, which already binds it", () => {
    const { onStartOver, editorContent } = setUp();

    keydown(editorContent, { key: "Enter", ctrlKey: true });

    expect(onStartOver).not.toHaveBeenCalled();
  });

  it("switches the layout on Ctrl-B", () => {
    const { onCycleLayout } = setUp();

    keydown(document.body, { key: "b", ctrlKey: true });

    expect(onCycleLayout).toHaveBeenCalledOnce();
  });

  it("switches the layout on Ctrl-Shift-B too, and with caps lock on", () => {
    // The browser reports the character the keyboard produced, so shift or caps lock sends
    // "B" — the same shortcut either way.
    const { onCycleLayout } = setUp();

    keydown(document.body, { key: "B", ctrlKey: true, shiftKey: true });

    expect(onCycleLayout).toHaveBeenCalledOnce();
  });

  it("switches the layout on Ctrl-B from a Cyrillic keyboard layout", () => {
    const { onCycleLayout } = setUp();

    keydown(document.body, { key: "и", code: "KeyB", ctrlKey: true });

    expect(onCycleLayout).toHaveBeenCalledOnce();
  });

  it("leaves a Latin letter on the B key alone, so Dvorak keeps its own Ctrl-X", () => {
    const { onCycleLayout } = setUp();

    keydown(document.body, { key: "x", code: "KeyB", ctrlKey: true });

    expect(onCycleLayout).not.toHaveBeenCalled();
  });

  it("leaves Ctrl-B alone while typing", () => {
    const { onCycleLayout, input } = setUp();

    keydown(input, { key: "b", ctrlKey: true });

    expect(onCycleLayout).not.toHaveBeenCalled();
  });

  it("opens the docs on F1", () => {
    const { onOpenDocs } = setUp();

    keydown(document.body, { key: "F1" });

    expect(onOpenDocs).toHaveBeenCalledOnce();
  });

  it("leaves F1 alone while typing", () => {
    const { onOpenDocs, input } = setUp();

    keydown(input, { key: "F1" });

    expect(onOpenDocs).not.toHaveBeenCalled();
  });

  it("opens the settings popover on ?", () => {
    const { onSettingsOpen } = setUp();

    keydown(document.body, { key: "?" });

    expect(onSettingsOpen).toHaveBeenCalledOnce();
  });

  it("leaves ? alone while typing", () => {
    const { onSettingsOpen, input } = setUp();

    keydown(input, { key: "?" });

    expect(onSettingsOpen).not.toHaveBeenCalled();
  });

  it("takes a keydown that arrives with no element behind it", () => {
    // A document with nothing focusable in it targets the document itself,
    // which is no more a form field than the body is.
    const { onOpenDocs } = setUp();

    keydown(document, { key: "F1" });

    expect(onOpenDocs).toHaveBeenCalledOnce();
  });

  it("ignores a key with no shortcut of its own", () => {
    const { onStartStop, onStartOver, onSettingsOpen, onOpenDocs, onCycleLayout } = setUp();

    keydown(document.body, { key: "a" });

    expect(onStartStop).not.toHaveBeenCalled();
    expect(onStartOver).not.toHaveBeenCalled();
    expect(onSettingsOpen).not.toHaveBeenCalled();
    expect(onOpenDocs).not.toHaveBeenCalled();
    expect(onCycleLayout).not.toHaveBeenCalled();
  });
});
