/**
 * Helpers shared by the presentation and application unit tests.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

import type { TextEditorHandlers, TextEditorView } from "./editor.ts";

/**
 * A `Storage` backed by a map.
 *
 * The test environment does not provide a usable `localStorage`, and an
 * explicit store also makes assertions about *which* keys are written clearer.
 */
export class MemoryStorage implements Storage {
  readonly #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, value);
  }
}

/** A text editing surface that keeps its document in a string. */
export class FakeTextEditorView implements TextEditorView {
  /** The current document. Assigning it does not count as an edit. */
  value = "";
  /** How often the caret has been put back in the editor. */
  focusCount = 0;
  /** The handlers the editor gave this surface. */
  readonly handlers: TextEditorHandlers;

  /**
   * @param handlers - Handlers raised by {@link FakeTextEditorView.type}.
   * @param initialValue - The document the surface is built with, which — as in
   * CodeMirror — is not a document *change* and so raises nothing.
   */
  constructor(handlers: TextEditorHandlers, initialValue = "") {
    this.handlers = handlers;
    this.value = initialValue;
  }

  getValue(): string {
    return this.value;
  }

  /**
   * Replaces the document, raising `onChange` as a real editing surface does.
   *
   * @param value - The new document.
   */
  setValue(value: string): void {
    this.value = value;
    this.handlers.onChange();
  }

  focus(): void {
    this.focusCount += 1;
  }

  /**
   * Simulates the player editing the document.
   *
   * @param value - The new document.
   */
  type(value: string): void {
    this.value = value;
    this.handlers.onChange();
  }
}
