/**
 * Syntax-highlighted markup for the JavaScript the learning track shows.
 *
 * `@lezer/javascript` and `@lezer/highlight` rather than a new dependency:
 * both already sit in `node_modules` as transitive dependencies of
 * `@codemirror/lang-javascript`, which the player's own editor
 * (`src/ui/editor.ts`) is built on, so drawing on them here adds no bytes
 * that were not already fetched, parses with the same grammar the editor
 * highlights the player's own code with, and needed nothing beyond listing
 * them as direct dependencies in `package.json` for what was already true of
 * the install.
 *
 * Every character this module puts in an attribute or between tags goes
 * through {@link escapeHtml} first. `highlightCode` hands back which CSS
 * classes apply to a run of source text, not markup — nothing here trusts an
 * HTML string produced elsewhere, including the library's own; the trust
 * boundary is "this function escapes text", not "this library is safe".
 */

import { parser } from "@lezer/javascript";
import { classHighlighter, highlightCode } from "@lezer/highlight";

/** Characters that must not survive into the markup this module builds. */
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes a string for use as element content.
 *
 * A private copy of `src/ui/templates.ts`'s `escapeHtml` rather than an
 * import of it: that module builds the page's markup and this one only ever
 * feeds a string into it (`raw(highlightJavaScript(...))`), so importing the
 * other way round would put a dependency from the templates on the
 * highlighter next to the one already running from the highlighter to the
 * templates. The two functions have to keep agreeing, and `templates.test.ts`
 * and this module's own tests both pin the same five characters, so a
 * disagreement fails a test rather than shipping quietly.
 *
 * @param value - Text to escape.
 * @returns The escaped text.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** The class a changed line's `<mark>` carries; see {@link highlightJavaScript}. */
export const CHANGED_LINE_CLASS = "tutoriallinechanged";

/**
 * Syntax-highlighted markup for a JavaScript program, with selected lines
 * marked as changed.
 *
 * One element per source line, holding the line's tokens each in their own
 * `tok-*`-classed `<span>` (the class names `classHighlighter` — Lezer's own
 * premade highlighter — assigns; `src/styles/style.css` styles the ones this
 * grammar actually produces for the eight tasks' programs). An unchanged line
 * is a plain `<span>`; a changed one is a `<mark>`, which is the element HTML
 * already has for "this run of text matters here, against another context" —
 * exactly what a changed line is, against the program the player started with
 * — so it costs nothing to reach for and needs no invented class to carry the
 * meaning `<span>` cannot. `CHANGED_LINE_CLASS` styles it; nothing depends on
 * the tag name beyond that. Lines are joined with a literal `"\n"` rather than
 * wrapped in `<br>`, and unstyled text is written as plain escaped text rather
 * than an empty-classed `<span>`, so that the element's `textContent`
 * reconstructs `code` exactly — which is what lets the copy button read the
 * program back out of the DOM instead of carrying a second copy of it, and
 * what keeps every existing test that compares `.tutorialsolution code`'s text
 * against `task.solutionCode` passing unchanged.
 *
 * @param code - The program, exactly as it is shown, copied and diffed.
 * @param changed - Zero-based indices of lines to mark, e.g. from
 * {@link "./line-diff.ts"!changedLines}. Defaults to none.
 * @returns Markup for the contents of a `<code>` element.
 */
export function highlightJavaScript(
  code: string,
  changed: ReadonlySet<number> = new Set(),
): string {
  const lines: string[] = [""];
  const tree = parser.parse(code);
  highlightCode(
    code,
    tree,
    classHighlighter,
    (text, classes) => {
      const escaped = escapeHtml(text);
      const chunk = classes === "" ? escaped : `<span class="${classes}">${escaped}</span>`;
      const index = lines.length - 1;
      // `lines` starts as `[""]` and every `putBreak` call only ever pushes a
      // new entry, so `index` is always a real one; the fallback is here only
      // to satisfy `noUncheckedIndexedAccess`.
      lines[index] = (lines[index] ?? "") + chunk;
    },
    () => {
      lines.push("");
    },
  );
  return lines
    .map((line, index) => {
      const tag = changed.has(index) ? "mark" : "span";
      const cls = changed.has(index) ? ` class="${CHANGED_LINE_CLASS}"` : "";
      return `<${tag}${cls}>${line}</${tag}>`;
    })
    .join("\n");
}
