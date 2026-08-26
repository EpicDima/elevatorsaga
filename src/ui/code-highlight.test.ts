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
    const html = highlightJavaScript(`elevator.goToFloor("<img>&'x");`);

    expect(html).not.toContain("<img>");
    expect(html).toContain('<span class="tok-string">&quot;&lt;img&gt;&amp;&#39;x&quot;</span>');
  });

  it("writes the space between tokens as bare text, not an empty-classed span", () => {
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

/** A program exercising every themed token: keyword, call, property, string, number, comment. */
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

/** Resolves each highlighted run in `code` to the `--ds-code-*` suffix the theme paints it, via the real parser and `highlightCode`. */
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
      // Nothing.
    },
  );
  return runs;
}

/**
 * All tokens trimmed runs of `text` are painted in, deduplicated across every match in `code`.
 * Trimming matters: unpainted runs arrive glued to surrounding whitespace, so without it a run could be missed entirely and the assertion would pass vacuously.
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
  it("paints keywords, strings, numbers and comments in their own tokens", () => {
    expect(tokensFor(SAMPLE, "function")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, "const")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, "return")).toEqual(["key"]);
    expect(tokensFor(SAMPLE, '"up_button_pressed"')).toEqual(["str"]);
    expect(tokensFor(SAMPLE, "0.5")).toEqual(["num"]);
    expect(tokensFor(SAMPLE, "// Send the least busy car.")).toEqual(["com"]);
  });

  it("groups the literals with the numbers rather than with the keywords", () => {
    // null/true are atoms under keyword in Lezer's tag tree; this catches the two explicit rows disappearing.
    expect(tokensFor(SAMPLE, "null")).toEqual(["num"]);
    expect(tokensFor("const ok = true;", "true")).toEqual(["num"]);
  });

  it("colors a name where it is a function, and leaves every other name alone", () => {
    expect(tokensFor(SAMPLE, "loadFactor")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "forEach")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "on")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "score")).toEqual(["fn"]);
    expect(tokensFor(SAMPLE, "destinationQueue")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "queue")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "elevators")).toEqual(["«body»"]);
    expect(tokensFor(SAMPLE, "floor")).toEqual(["«body»"]);
  });

  it("colors a function-valued property where it is declared, not only where it is called", () => {
    // `init: function (…)` is tagged `function(definition(propertyName))` by Lezer's grammar.
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
    // A typo in a `var()` name would resolve to nothing and look like a deliberately unpainted run elsewhere.
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
