// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import fontAwesome from "./fontawesome-glyphs.json";
import { createIcon, ICON_ASCENT, ICON_EM_UNITS, ICONS, iconMarkup, iconWidthEm } from "./icons.ts";
import type { IconName } from "./icons.ts";

/**
 * Every `fa-*` glyph the legacy markup used, with the codepoint that class
 * resolved to in `font-awesome-4.1-1.0/css/font-awesome.css`.
 *
 * `fa-warning` is an alias of `fa-exclamation-triangle`; both are U+F071.
 */
const LEGACY_GLYPHS: Readonly<Record<IconName, string>> = {
  "arrow-circle-down": "U+F0AB",
  "arrow-circle-up": "U+F0AA",
  "caret-right": "U+F0DA",
  child: "U+F1AE",
  female: "U+F182",
  male: "U+F183",
  minus: "U+F068",
  "minus-square": "U+F146",
  plus: "U+F067",
  "plus-square": "U+F0FE",
  repeat: "U+F01E",
  warning: "U+F071",
};

/** The icon names, in the order the fixture and the icon set agree on. */
const ICON_NAMES = Object.keys(LEGACY_GLYPHS) as IconName[];

describe("ICONS", () => {
  it("covers exactly the glyphs the legacy markup used", () => {
    expect(Object.keys(ICONS).toSorted()).toEqual(ICON_NAMES.toSorted());
  });

  // Every one of these outlines is copied verbatim from the Font Awesome 4.1
  // webfont, and nothing in the game reads that webfont at runtime any more, so
  // nothing else would notice if an outline were swapped for another, truncated
  // or nudged: the icons would simply be wrong, and every other test would keep
  // passing. src/ui/fontawesome-glyphs.json is a copy of the twelve glyphs
  // taken from the font itself (not from ICONS, which would make this
  // circular), and this is the assertion that holds ICONS to it.
  it("reproduces the Font Awesome 4.1 outlines exactly", () => {
    expect(Object.keys(fontAwesome.glyphs).toSorted()).toEqual(ICON_NAMES.toSorted());
    for (const name of ICON_NAMES) {
      const glyph = fontAwesome.glyphs[name];
      expect(ICONS[name].path, name).toBe(glyph.path);
      expect(ICONS[name].advance, name).toBe(glyph.advance);
    }
  });

  it("took each glyph from the codepoint the legacy fa-* class resolved to", () => {
    for (const [name, codepoint] of Object.entries(LEGACY_GLYPHS)) {
      expect(fontAwesome.glyphs[name as IconName].codepoint, name).toBe(codepoint);
    }
  });

  it("uses the font's own metrics", () => {
    expect(ICON_EM_UNITS).toBe(fontAwesome.unitsPerEm);
    expect(ICON_ASCENT).toBe(fontAwesome.ascent);
  });
});

describe("iconWidthEm", () => {
  it("derives the width from the glyph advance", () => {
    // The male glyph advances 1024 of 1792 font units.
    expect(iconWidthEm("male")).toBe("0.5714em");
  });

  it("gives a full em to a glyph that advances a full em", () => {
    expect(iconWidthEm("warning")).toBe("1.0000em");
  });
});

describe("createIcon", () => {
  it("builds an svg sized like the webfont glyph", () => {
    const icon = createIcon("male");
    expect(icon.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(icon.getAttribute("viewBox")).toBe(`0 0 1024 ${String(ICON_EM_UNITS)}`);
    expect(icon.getAttribute("width")).toBe("0.5714em");
    expect(icon.getAttribute("height")).toBe("1em");
  });

  it("inherits its colour and stays out of the accessibility tree", () => {
    const icon = createIcon("warning");
    expect(icon.getAttribute("fill")).toBe("currentColor");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
  });

  it("flips the y-up font outline into svg coordinates", () => {
    const path = createIcon("plus").firstElementChild;
    expect(path?.tagName).toBe("path");
    expect(path?.getAttribute("transform")).toBe(`translate(0 ${String(ICON_ASCENT)}) scale(1 -1)`);
    expect(path?.getAttribute("d")).toBe(ICONS.plus.path);
  });

  it("keeps the base class and appends any extra classes", () => {
    expect(createIcon("minus").getAttribute("class")).toBe("icon");
    expect(createIcon("minus", "up activated").getAttribute("class")).toBe("icon up activated");
  });
});

describe("iconMarkup", () => {
  it("parses into the same element createIcon builds", () => {
    for (const name of ICON_NAMES) {
      const template = document.createElement("template");
      template.innerHTML = iconMarkup(name, "extra");
      const parsed = template.content.firstElementChild;
      const built = createIcon(name, "extra");
      expect(parsed?.outerHTML, name).toBe(built.outerHTML);
    }
  });
});
