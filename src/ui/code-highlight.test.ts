// @vitest-environment jsdom

import { parser } from "@lezer/javascript";
import { highlightCode } from "@lezer/highlight";
import { describe, expect, it } from "vitest";

import { CHANGED_LINE_CLASS, editorSyntaxTheme, highlightJavaScript } from "./code-highlight.ts";

describe("highlightJavaScript", () => {
  it("wraps a keyword, a property, a number and a comment in their own token classes", () => {
    const html = highlightJavaScript("if (x) { elevator.goToFloor(1); } // done");

    expect(html).toContain('<span class="tok-keyword">if</span>');
    expect(html).toContain('<span class="tok-propertyName">goToFloor</span>');
    expect(html).toContain('<span class="tok-number">1</span>');
    expect(html).toContain('<span class="tok-comment">// done</span>');
  });

  it("escapes every character markup cares about, within the one token that holds them", () => {
    // The same five characters `#shared/ui/markup.ts`'s own `escapeHtml` escapes,
    // all inside a single string literal -- which is one token, so nothing here
    // depends on where Lezer happens to split the run into spans.
    const html = highlightJavaScript(`elevator.goToFloor("<img>&'x");`);

    expect(html).not.toContain("<img>");
    expect(html).toContain('<span class="tok-string">&quot;&lt;img&gt;&amp;&#39;x&quot;</span>');
  });

  it("writes the space between tokens as bare text, not an empty-classed span", () => {
    // classHighlighter answers "" for the whitespace between tokens, and
    // highlightJavaScript is documented to write unstyled text as plain text
    // rather than an empty-classed <span> -- so nothing here reads `class=""`,
    // while every operator and punctuation mark is still its own token, with a
    // class `style.css` dims to `--ds-code-punc`.
    const html = highlightJavaScript("a < b;");

    expect(html).not.toContain('class=""');
    expect(html).toContain("</span> <span");
    expect(html).toContain('<span class="tok-operator">&lt;</span>');
    expect(html).toContain('<span class="tok-punctuation">;</span>');
  });

  it("puts every line in its own element, joined by real newlines", () => {
    const html = highlightJavaScript("const a = 1;\nconst b = 2;");

    expect(html.split("\n")).toHaveLength(2);
  });

  it("draws an unchanged line as a plain span and a changed one as a marked <mark>", () => {
    const html = highlightJavaScript("const a = 1;\nconst b = 2;\nconst c = 3;", new Set([1]));
    const lines = html.split("\n");

    expect(lines[0]?.startsWith("<span>")).toBe(true);
    expect(lines[1]?.startsWith(`<mark class="${CHANGED_LINE_CLASS}">`)).toBe(true);
    expect(lines[1]?.endsWith("</mark>")).toBe(true);
    expect(lines[2]?.startsWith("<span>")).toBe(true);
  });

  it("marks nothing when no line is reported changed, which is the default", () => {
    const html = highlightJavaScript("const a = 1;\nconst b = 2;");

    expect(html).not.toContain(CHANGED_LINE_CLASS);
    expect(html).not.toContain("<mark");
  });

  it("marks every line that changedLines names, in one call", () => {
    const html = highlightJavaScript("one();\ntwo();\nthree();", new Set([0, 2]));
    const lines = html.split("\n");

    expect(lines.map((line) => line.startsWith("<mark"))).toEqual([true, false, true]);
  });

  it("answers one empty span for an empty program", () => {
    expect(highlightJavaScript("")).toBe("<span></span>");
  });

  it("reads back the exact source through textContent, marked lines included", () => {
    // The invariant `templates.ts` and the copy button both depend on: each
    // line is its own element rather than separated by a <br>, joined by a
    // literal "\n" text node, so the container's own textContent reproduces the
    // program byte for byte -- whether or not a `<mark>` sits around a line.
    const code = 'elevator.on("idle", function() {\n    elevator.goToFloor(0);\n});';
    const html = highlightJavaScript(code, new Set([1]));

    const container = document.createElement("code");
    container.innerHTML = html;

    expect(container.textContent).toBe(code);
    expect(container.querySelector("br")).toBeNull();
  });

  it("reads back a hostile program with no tag surviving into the DOM", () => {
    const hostile = `elevator.goToFloor("<img src=x onerror=alert(1)>");`;
    const html = highlightJavaScript(hostile);

    const container = document.createElement("code");
    container.innerHTML = html;

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(hostile);
  });
});

/**
 * A program shaped like the one the mockup fills its own `#editor` with:
 * a declared function, a called method, a plain property, a string, a number
 * and a comment, so that every row of the theme is exercised by real source
 * rather than by a hand-made tag.
 */
const SAMPLE = `{
    init: function (elevators, floors) {
        function score(elevator) {
            const queue = elevator.destinationQueue.length;
            const load = elevator.loadFactor();
            return load > 0.5 ? 4 : null;
        }
        floors.forEach((floor) => {
            // Send the least busy car.
            floor.on("up_button_pressed", () => score(elevators[0]));
        });
    },
}`;

/**
 * Which `--ds-code-*` token the theme paints each run of a program in.
 *
 * `HighlightStyle` hands out generated class names, not colours, and keeps the
 * declarations behind them in a `StyleModule` — so this reads the rules back
 * out of that module and resolves each class to the custom property it sets.
 * Going through the real parser and the real `highlightCode` is the point: it
 * is what makes these assertions statements about "what colour is `loadFactor`
 * in this program", rather than about which `Tag` object was written down.
 *
 * @param code - A JavaScript program.
 * @returns One entry per highlighted run, in source order, naming the token
 * suffix (`key`, `fn`, …) or `undefined` where the theme leaves the run in the
 * editor's own body colour.
 */
function paintedRuns(code: string): { text: string; token: string | undefined }[] {
  const declarations = new Map(
    [...(editorSyntaxTheme.module?.getRules() ?? "").matchAll(/\.(\S+?)\s*\{([^}]*)\}/g)].map(
      ([, cls = "", body = ""]) => [cls, body],
    ),
  );
  const runs: { text: string; token: string | undefined }[] = [];
  highlightCode(
    code,
    parser.parse(code),
    editorSyntaxTheme,
    (text, classes) => {
      const body = classes === "" ? undefined : declarations.get(classes);
      runs.push({ text, token: /var\(--ds-code-(\w+)\)/.exec(body ?? "")?.[1] });
    },
    () => {
      // Line breaks carry no colour, and nothing here asks about them.
    },
  );
  return runs;
}

/**
 * The token every run of a given text is painted in.
 *
 * A set rather than the first hit: `.` and `(` occur a dozen times each in
 * {@link SAMPLE}, and a check that looked only at the first would pass while
 * the rest were painted otherwise.
 *
 * Runs are trimmed before they are compared, because `highlightCode` hands an
 * unpainted name back glued to the spaces around it — `" queue "` for the
 * `queue` a `const` introduces — while a painted one arrives on its own. Not
 * trimming would make every "this name keeps the body colour" assertion pass
 * vacuously, by finding no run at all.
 *
 * @param code - A JavaScript program.
 * @param text - The source text of the runs to look at, ignoring surrounding
 * whitespace.
 * @returns Every token those runs were painted in, deduplicated.
 */
function tokensFor(code: string, text: string): string[] {
  return [
    ...new Set(
      paintedRuns(code)
        .filter((run) => run.text.trim() === text)
        .map((run) => run.token ?? "«body»"),
    ),
  ];
}

describe("editorSyntaxTheme", () => {
  it("paints keywords, strings, numbers and comments in the mockup's own tokens", () => {
    expect(tokensFor(SAMPLE, "function")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, "const")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, "return")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, '"up_button_pressed"')).toEqual(["str"]);
    expect(tokensFor(SAMPLE, "0.5")).toEqual(["num"]);
    expect(tokensFor(SAMPLE, "// Send the least busy car.")).toEqual(["com"]);
  });

  it("groups the literals with the numbers rather than with the keywords", () => {
    // `null` and `true` are `atom`s in Lezer's tag tree, and `atom` sits under
    // `keyword` -- so this is what catches the two explicit rows going away and
    // the literals silently taking the keyword colour with them.
    expect(tokensFor(SAMPLE, "null")).toEqual(["num"]);
    expect(tokensFor("const ok = true;", "true")).toEqual(["num"]);
  });

  it("colours a name where it is a function, and leaves every other name alone", () => {
    // The mockup's own distinction: `.f` for `loadFactor()` and `score(...)`,
    // plain body text for `destinationQueue` and for the `queue` a `const`
    // introduces.
    expect(tokensFor(SAMPLE, "loadFactor")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "forEach")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "on")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "score")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "destinationQueue")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "queue")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "elevators")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "floor")).toEqual(["«body»"]);
  });

  it("colours a function-valued property where it is declared, not only where it is called", () => {
    // The one place a real grammar knows more than the mockup's regex, pinned
    // so that it stays a decision: `init: function (…)` names a function, and
    // Lezer says so (`function(definition(propertyName))`), where a rule that
    // can only look for a `(` after the name cannot. See the note in
    // `editorSyntaxTheme`.
    expect(tokensFor(SAMPLE, "init")).toEqual(["fn"]);
  });

  it("dims every bracket, separator and operator to the punctuation token", () => {
    expect(tokensFor(SAMPLE, "(")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, ")")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, "{")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, ";")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, ".")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, ",")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, "=>")).toEqual(["punc"]);
    expect(tokensFor(SAMPLE, ">")).toEqual(["punc"]);
  });

  it("names only tokens the stylesheet declares", () => {
    // Every colour this theme writes is a custom property, and a typo in one
    // would not fail anything else here: an unknown `var()` resolves to nothing
    // and the text falls back to the editor's own colour, which looks exactly
    // like a deliberately unpainted run.
    const rules = editorSyntaxTheme.module?.getRules() ?? "";
    const named = [...new Set([...rules.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name))];

    expect(named.toSorted()).toEqual([
      "--ds-bad",
      "--ds-code-com",
      "--ds-code-fn",
      "--ds-code-key",
      "--ds-code-num",
      "--ds-code-punc",
      "--ds-code-str",
    ]);
  });
});
