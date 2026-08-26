/** Helpers shared by the presentation and application unit tests; excluded from coverage. */

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

/** Builds a detached element; test-only, since the game renders through the escaping templates in `templates.ts`. */
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

/** A `Storage` backed by a `Map`, since the test environment has no usable `localStorage`. */
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

/** A `Storage` that reads back normally but throws on every write, as a full quota does. */
export function fullStorage(entries: Readonly<Record<string, string>> = {}): Storage {
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
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

/** A text editing surface that keeps its document in a string. */
export class FakeTextEditorView implements TextEditorView {
  /** The current document. Assigning it does not count as an edit. */
  value = "";
  /** How often the caret has been put back in the editor. */
  focusCount = 0;
  /** How often the surface has been asked to re-read its labels. */
  relocalizeCount = 0;
  /** Where the last error mark was put, if there is one now. */
  errorMark: CodeErrorLocation | undefined = undefined;
  /**
   * Every mark ever asked for, clearings included.
   * Kept alongside {@link FakeTextEditorView.errorMark} since clear-then-set and set-only end in the same final state.
   */
  readonly errorMarks: (CodeErrorLocation | undefined)[] = [];
  /** The handlers the editor gave this surface. */
  readonly handlers: TextEditorHandlers;

  /** `initialValue` is not a document change (matching CodeMirror), so it raises nothing. */
  constructor(handlers: TextEditorHandlers, initialValue = "") {
    this.handlers = handlers;
    this.value = initialValue;
  }

  getValue(): string {
    return this.value;
  }

  /** Replaces the document, raising `onChange` as a real editing surface does. */
  setValue(value: string): void {
    this.value = value;
    this.handlers.onChange();
  }

  focus(): void {
    this.focusCount += 1;
  }

  /** Counts the relocalizations instead of relabeling anything. */
  relocalize(): void {
    this.relocalizeCount += 1;
  }

  /** Records the mark instead of drawing it. */
  markError(location: CodeErrorLocation | undefined): void {
    this.errorMark = location;
    this.errorMarks.push(location);
  }

  /** Simulates the player editing the document. */
  type(value: string): void {
    this.value = value;
    this.handlers.onChange();
  }
}
