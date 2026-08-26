/** Colors JavaScript for both the static learning-track markup and the live CodeMirror editor. */

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

/** Escapes text for safe use as HTML content; mirrors `#shared/ui/markup.ts`'s `escapeHtml`, so keep both in sync. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** The class every line carries, block-displayed by `shared/styles/code.css`. */
export const LINE_CLASS = "codeline";

/** The class a changed line's `<mark>` carries; see {@link highlightJavaScript}. */
export const CHANGED_LINE_CLASS = "tutoriallinechanged";

/**
 * Renders `code` as one `<span>`/`<mark>` per line, with `changed` indices marked.
 * The result's `textContent` must reconstruct `code` exactly — the copy button reads it back out of the DOM.
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
      // index is always valid; the `?? ""` fallback only satisfies noUncheckedIndexedAccess.
      lines[index] = (lines[index] ?? "") + chunk;
    },
    () => {
      lines.push("");
    },
  );
  return lines
    .map((line, index) => {
      const tag = changed.has(index) ? "mark" : "span";
      const cls = changed.has(index) ? `${LINE_CLASS} ${CHANGED_LINE_CLASS}` : LINE_CLASS;
      // Each line ends with its own break, rather than the lines being joined
      // by one: a newline *between* two line boxes is a text node of its own,
      // and a block-displayed line would then leave it a blank row.
      const brk = index === lines.length - 1 ? "" : "\n";
      return `<${tag} class="${cls}">${line}${brk}</${tag}>`;
    })
    .join("");
}

/**
 * The live editor's syntax colors, narrower than {@link highlightJavaScript}'s static mapping:
 * only actual calls get the function color, and punctuation is dimmer than the code, not brighter.
 */
export const editorSyntaxTheme: HighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--ds-code-key)" },
  // bool/null borrow the number color; Lezer otherwise files them under keyword.
  { tag: [tags.bool, tags.null], color: "var(--ds-code-num)" },
  { tag: tags.number, color: "var(--ds-code-num)" },
  {
    tag: [tags.string, tags.special(tags.string), tags.escape, tags.regexp],
    color: "var(--ds-code-str)",
  },
  { tag: tags.comment, color: "var(--ds-code-com)", fontStyle: "italic" },
  // Three call shapes need explicit tags: bare calls, method calls, and named
  // function declarations, whose tag doesn't fall back to a colored one.
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.function(tags.definition(tags.variableName)),
    ],
    color: "var(--ds-code-fn)",
  },
  // Classes, types and labels share the function color too, for parity with other editors.
  {
    tag: [tags.className, tags.definition(tags.className), tags.typeName, tags.labelName],
    color: "var(--ds-code-fn)",
  },
  { tag: [tags.punctuation, tags.operator], color: "var(--ds-code-punc)" },
  // Separate from `.cm-errorMark` in editor.ts, which flags a thrown exception rather than a parse error.
  { tag: tags.invalid, color: "var(--ds-bad)" },
]);
