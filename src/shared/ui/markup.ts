/**
 * Markup helpers: an escaping template tag and the two ways to turn its
 * output into DOM. Every interpolated value is escaped unless wrapped in
 * {@link raw}; the tag isn't named `html` since Prettier reformats those.
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

/** Marks a string as trusted markup for {@link markup}; never wrap player input. */
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

/** Escapes a string for use in element content or a quoted attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * Tagged template that escapes every interpolated value, except those
 * wrapped in {@link raw}, which are inserted verbatim.
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
 * Parses markup into a detached fragment, using a `<template>` element so
 * nothing in it runs or loads.
 */
export function renderFragment(source: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = source;
  return template.content;
}

/**
 * Parses markup that describes exactly one element.
 *
 * @throws {Error} When the markup does not describe exactly one element.
 */
export function renderElement(source: string): HTMLElement {
  const [element, ...rest] = renderFragment(source).children;
  if (!(element instanceof HTMLElement) || rest.length > 0) {
    throw new Error("Expected markup describing exactly one element");
  }
  return element;
}
