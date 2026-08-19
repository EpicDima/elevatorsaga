// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentGlobalShortcuts } from "./global-shortcuts.ts";

/**
 * Builds the three buttons and two callbacks {@link presentGlobalShortcuts}
 * drives, wires it against `document`, and hands back a click spy for each
 * button alongside two elements for the guards: a plain, unfocused element
 * that is neither the body nor a typing target, and a form field that is one.
 *
 * @returns The wired buttons' click spies, the two callback spies, and the
 * two guard-test elements.
 */
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

/**
 * Dispatches a bubbling keydown as if `target` were the focused element.
 *
 * @param target - Element to dispatch on; becomes the event's own `target`.
 * @param init - The key, and any modifiers, to dispatch.
 */
function keydown(target: Element, init: KeyboardEventInit): void {
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
