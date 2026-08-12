/**
 * Helpers shared by the presentation and application unit tests.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

import type { TextEditorHandlers, TextEditorView } from "./editor.ts";
import type { CodeErrorLocation } from "./error-location.ts";

/** Options accepted by {@link createElement}. */
export interface CreateElementOptions {
  /** Value for the `class` attribute. */
  className?: string;
  /** Text content; set with `textContent`, so it is never parsed as markup. */
  text?: string;
  /** Nodes to append. */
  children?: readonly (Node | string)[];
}

/**
 * Builds a detached element.
 *
 * A test-only convenience: the game itself never creates elements this way. It
 * renders from the escaping templates in `templates.ts`, so this exists purely
 * to stand up the fragments of page shell that the presenter and application
 * tests draw into, without a string of HTML per test.
 *
 * @param tag - Tag name to create.
 * @param options - Class, text and children.
 * @returns The new, detached element.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: CreateElementOptions = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className !== undefined) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  if (options.children !== undefined) {
    element.append(...options.children);
  }
  return element;
}

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
  /** Where the last error mark was put, if there is one now. */
  errorMark: CodeErrorLocation | undefined = undefined;
  /**
   * Every mark ever asked for, clearings included.
   *
   * Kept as well as {@link FakeTextEditorView.errorMark} because "the mark was
   * cleared and then set" and "the mark was only ever set" end in the same
   * place, and a caller that draws a mark before clearing the last one leaves
   * the player's eye on the wrong line for a frame.
   */
  readonly errorMarks: (CodeErrorLocation | undefined)[] = [];
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
   * Records the mark instead of drawing it.
   *
   * @param location - Where the failure was, or `undefined` to clear the mark.
   */
  markError(location: CodeErrorLocation | undefined): void {
    this.errorMark = location;
    this.errorMarks.push(location);
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
