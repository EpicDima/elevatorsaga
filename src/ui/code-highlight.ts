/**
 * How JavaScript is coloured, on both surfaces that show any.
 *
 * Two of them, because the game shows a program in two very different ways.
 * {@link highlightJavaScript} builds static markup for the learning track's
 * answers, which are `<code>` blocks in the page's own DOM; {@link
 * editorSyntaxTheme} colours the live CodeMirror editor
 * (`src/ui/editor.ts`), which draws its own decorations and knows nothing
 * about this page's classes. They sit in one module because they answer the
 * same question — "what colour is a keyword here?" — and a reader who changes
 * one should have the other in front of them.
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

import { HighlightStyle } from "@codemirror/language";
import { parser } from "@lezer/javascript";
import { classHighlighter, highlightCode, tags } from "@lezer/highlight";

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
 * A private copy of `#shared/ui/markup.ts`'s `escapeHtml` rather than an
 * import of it: `src/ui/templates.ts` already depends on this module for
 * `highlightJavaScript`, feeding this module's own output into
 * `raw(highlightJavaScript(...))`, so this module reaching back up into the UI
 * layer for a helper — even one as small and dependency-free as `escapeHtml`
 * — would draw the boundary the wrong way round for a five-line function
 * neither module exclusively owns. The two copies have to keep agreeing, and
 * `markup.test.ts` and this module's own tests both pin the same five
 * characters, so a disagreement fails a test rather than shipping quietly.
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
 * premade highlighter — assigns; `src/shared/styles/code.css` styles the ones
 * this
 * grammar actually produces for the eight levels' programs). An unchanged line
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
 * against `level.solutionCode` passing unchanged.
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

/**
 * The live editor's syntax colours, as `design/ui-mockup.html` assigns them.
 *
 * CodeMirror ships `defaultHighlightStyle`, and `basicSetup` registers it —
 * but only as a *fallback*: `syntaxHighlighting(style, { fallback: true })`
 * puts a highlighter into a facet that `@codemirror/language` reads solely
 * when no ordinary one is registered. Handing `syntaxHighlighting(this)` to
 * the same view therefore replaces the default outright rather than layering
 * over it, which is what {@link "./editor.ts"!codeMirrorView} does. Until it
 * did, the editor ran the stock style — a palette tuned for a white page —
 * over the near-black `--ds-code-bg` the redesign gave it: purple keywords,
 * red strings, and a comment colour nobody chose.
 *
 * The colours are `var(--ds-code-*)` rather than literals, so one editor
 * follows the player between the light and the dark theme with no rebuild:
 * CodeMirror writes these declarations into a stylesheet once, and the
 * custom properties they read are re-resolved by the browser whenever
 * `<html data-theme>` changes, exactly as every hand-written rule in
 * the stylesheets is.
 *
 * The mapping is the mockup's own, read off the spans its `#editor` is filled
 * with (`.k`, `.f`, `.s`, `.n`, `.c`, `.p`, and `.src` for everything else),
 * and it is deliberately narrower than the `.tok-*` rules
 * {@link highlightJavaScript} feeds. Two differences are worth naming,
 * because both look like omissions and neither is:
 *
 * - **A name is blue only where it is a function.** The mockup writes
 *   `elevator.<span class="f">loadFactor</span>()` but
 *   `elevator.destinationQueue` plain, and `<span class="k">const</span>
 *   queue` plain as well — so `tags.function(...)` is what earns
 *   `--ds-code-fn`, and a bare `variableName`/`propertyName` keeps the body
 *   colour. Lezer's own `classHighlighter`, which the static blocks use,
 *   cannot draw that line: it maps the unmodified tags only, so every name in
 *   a learning-track answer is blue. That is a limitation of the other
 *   surface, not a decision repeated here. The mockup's own highlighter has
 *   the mirror-image limitation — it is a regular expression, and its rule is
 *   literally "a name with a `(` after it" — so it leaves the `init` of `init:
 *   function (elevators, floors)` plain where this theme colours it. That
 *   difference is deliberate and it follows the mockup's intent rather than
 *   breaking it: the mockup already colours a *declaration* wherever one
 *   happens to be written with the name against the parenthesis (`function
 *   <span class="f">score</span>(`), and its own comment says the plain colour
 *   is for variables («это переменные»). `init` is a function by any reading;
 *   a grammar can see that where a regular expression cannot.
 * - **Punctuation is dimmer than the code, not brighter.** `--ds-code-punc`
 *   sits below `--ds-code-text` in both themes (6.73:1 dark, 4.70:1 light on
 *   `--ds-code-bg`, both clear of 1.4.3's 4.5:1), so brackets and operators
 *   recede and the words stand out. It is the one token of the mockup's code
 *   palette that had no reader at all before this.
 *
 * `tags.bool` and `tags.null` are pulled out of `tags.keyword` explicitly.
 * Lezer defines both under `atom`, itself under `keyword`, and
 * `tagHighlighter` matches the most specific tag a token carries — so
 * without these two rows `true` and `null` would take the keyword colour,
 * where the mockup groups literals with numbers. `super` and `this` are left
 * to inherit the keyword colour, which is where they belong.
 */
export const editorSyntaxTheme: HighlightStyle = HighlightStyle.define([
  // `const`, `function`, `return`, `import`, `get`/`set`/`async`, `this`,
  // `super` -- everything Lezer files under `keyword`, minus the two literal
  // tags below.
  { tag: tags.keyword, color: "var(--ds-code-key)" },
  { tag: [tags.bool, tags.null], color: "var(--ds-code-num)" },
  { tag: tags.number, color: "var(--ds-code-num)" },
  // Template strings (`special(string)`), escapes and regular expressions all
  // read as string content and are coloured with it.
  {
    tag: [tags.string, tags.special(tags.string), tags.escape, tags.regexp],
    color: "var(--ds-code-str)",
  },
  { tag: tags.comment, color: "var(--ds-code-com)", fontStyle: "italic" },
  // The three shapes a called name takes in this grammar: `nearest(...)`,
  // `elevator.loadFactor()`, and the `score` in `function score(...)`. The
  // last needs its own row -- its tag is `function(definition(variableName))`,
  // and neither of the tags it falls back to is coloured here.
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.function(tags.definition(tags.variableName)),
    ],
    color: "var(--ds-code-fn)",
  },
  // Not a call, but named like one: a class, a TypeScript type, a `foo:`
  // loop label. None occur in the starter program; they are here so that a
  // player who writes one does not get body-coloured text where every other
  // editor they have used gives them a colour.
  {
    tag: [tags.className, tags.definition(tags.className), tags.typeName, tags.labelName],
    color: "var(--ds-code-fn)",
  },
  // `punctuation` covers the brackets and separators, `operator` the
  // arithmetic, comparison, assignment and `.` dereference marks.
  { tag: [tags.punctuation, tags.operator], color: "var(--ds-code-punc)" },
  // What the parser could not make sense of. The mockup underlines a bad call
  // rather than recolouring it (`.squiggle`, which `.cm-errorMark` in
  // `editor.ts` is the live counterpart of), but that mark is drawn from the
  // exception a run threw, so it says nothing at all while the program is
  // merely half-typed; this is the syntax tree's own opinion, and the two do
  // not overlap.
  { tag: tags.invalid, color: "var(--ds-bad)" },
]);
