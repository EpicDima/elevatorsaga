/**
 * Markup helpers: an escaping template tag and the two ways to turn its
 * output into DOM.
 *
 * `riot.render`, which every template in this codebase replaces, interpolated
 * `{placeholders}` without escaping anything, which is fine for the numbers
 * the game feeds it and decidedly not fine for text that can carry a
 * player's own input. The {@link markup} tag escapes every interpolated value
 * unless it is explicitly wrapped in {@link raw}, and anything that can carry
 * player-authored text — error messages in particular — is written with
 * `textContent` by its presenter rather than templated at all.
 *
 * The tag is deliberately *not* called `html`: Prettier reformats `html`-tagged
 * template literals as embedded HTML, and several of this codebase's templates
 * are whitespace sensitive (the in-car floor buttons sit flush against each
 * other, and the floor call buttons are separated by exactly one space).
 */

/** Markup that is inserted as-is, without escaping. */
export class RawHtml {
  /** The trusted markup. */
  readonly value: string;

  /**
   * @param value - Trusted markup, never derived from player input.
   */
  constructor(value: string) {
    this.value = value;
  }
}

/**
 * Marks a string as trusted markup for {@link markup}.
 *
 * @param value - Trusted markup, never derived from player input.
 * @returns A wrapper {@link markup} inserts verbatim.
 */
export function raw(value: string): RawHtml {
  return new RawHtml(value);
}

/** Characters that must not survive interpolation into markup. */
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes a string for use in element content or a quoted attribute value.
 *
 * @param value - Text to escape.
 * @returns The escaped text.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * Tagged template that escapes every interpolated value.
 *
 * Values wrapped in {@link raw} are inserted verbatim; everything else is
 * stringified and escaped.
 *
 * @param strings - The literal parts of the template.
 * @param values - The interpolated values.
 * @returns The assembled markup.
 */
export function markup(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  let result = strings[0] ?? "";
  for (const [index, value] of values.entries()) {
    result += value instanceof RawHtml ? value.value : escapeHtml(String(value));
    result += strings[index + 1] ?? "";
  }
  return result;
}

/**
 * Parses markup into a detached fragment.
 *
 * Uses a `<template>` element, so the markup is parsed but nothing in it runs
 * or loads.
 *
 * @param source - Markup to parse.
 * @returns The parsed nodes.
 */
export function renderFragment(source: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = source;
  return template.content;
}

/**
 * Parses markup that describes exactly one element.
 *
 * @param source - Markup to parse.
 * @returns The single parsed element.
 * @throws {Error} When the markup does not describe exactly one element.
 */
export function renderElement(source: string): HTMLElement {
  const [element, ...rest] = renderFragment(source).children;
  if (!(element instanceof HTMLElement) || rest.length > 0) {
    throw new Error("Expected markup describing exactly one element");
  }
  return element;
}
