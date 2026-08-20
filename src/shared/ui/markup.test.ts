// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { escapeHtml, markup, raw, renderElement, renderFragment } from "./markup.ts";

describe("escapeHtml", () => {
  it("escapes every character that could break out of markup", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Level #3")).toBe("Level #3");
  });
});

describe("markup", () => {
  it("escapes interpolated values", () => {
    const evil = `"><img src=x onerror=alert(1)>`;
    expect(markup`<a href="${evil}"></a>`).toBe(
      `<a href="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"></a>`,
    );
  });

  it("inserts raw values verbatim", () => {
    expect(markup`<p>${raw("<b>hi</b>")}</p>`).toBe("<p><b>hi</b></p>");
  });

  it("stringifies numbers", () => {
    expect(markup`<div style="top: ${150}px"></div>`).toBe(`<div style="top: 150px"></div>`);
  });

  it("handles a template with no interpolations", () => {
    expect(markup`<hr>`).toBe("<hr>");
  });
});

describe("renderFragment / renderElement", () => {
  it("parses markup without running or loading anything", () => {
    const fragment = renderFragment(`<img src="/nope.png"><span>ok</span>`);
    expect(fragment.children).toHaveLength(2);
  });

  it("returns the single element of a one-element template", () => {
    expect(renderElement("<div class='floor'></div>").className).toBe("floor");
  });

  it("rejects markup that is not exactly one element", () => {
    expect(() => renderElement("<div></div><div></div>")).toThrow("exactly one element");
    expect(() => renderElement("just text")).toThrow("exactly one element");
  });
});
