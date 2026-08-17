// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { CHANGED_LINE_CLASS, highlightJavaScript } from "./code-highlight.ts";

describe("highlightJavaScript", () => {
  it("wraps a keyword, a property, a number and a comment in their own token classes", () => {
    const html = highlightJavaScript("if (x) { elevator.goToFloor(1); } // done");

    expect(html).toContain('<span class="tok-keyword">if</span>');
    expect(html).toContain('<span class="tok-propertyName">goToFloor</span>');
    expect(html).toContain('<span class="tok-number">1</span>');
    expect(html).toContain('<span class="tok-comment">// done</span>');
  });

  it("escapes every character markup cares about, within the one token that holds them", () => {
    // The same five characters `src/ui/templates.ts`'s own `escapeHtml` escapes,
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
    // and every operator and punctuation mark is still its own token, just one
    // `style.css` leaves the default colour rather than giving a rule of its own.
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
