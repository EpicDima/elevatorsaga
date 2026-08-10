// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createIcon, ICON_ASCENT, ICON_EM_UNITS, ICONS, iconMarkup, iconWidthEm } from "./icons.ts";
import type { IconName } from "./icons.ts";

/** Every `fa-*` glyph the legacy markup used, by its Font Awesome name. */
const LEGACY_GLYPHS: readonly IconName[] = [
  "arrow-circle-down",
  "arrow-circle-up",
  "caret-right",
  "child",
  "female",
  "male",
  "minus",
  "minus-square",
  "plus",
  "plus-square",
  "repeat",
  "warning",
];

describe("ICONS", () => {
  it("covers exactly the glyphs the legacy markup used", () => {
    expect(Object.keys(ICONS).toSorted()).toEqual([...LEGACY_GLYPHS].toSorted());
  });

  it("has a plausible outline and advance for every icon", () => {
    for (const [name, definition] of Object.entries(ICONS)) {
      expect(definition.advance, name).toBeGreaterThan(0);
      expect(definition.advance, name).toBeLessThanOrEqual(ICON_EM_UNITS);
      expect(definition.path, name).toMatch(/^M[\d\s.-]/);
      expect(definition.path, name).toMatch(/z$/);
    }
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
    for (const name of LEGACY_GLYPHS) {
      const template = document.createElement("template");
      template.innerHTML = iconMarkup(name, "extra");
      const parsed = template.content.firstElementChild;
      const built = createIcon(name, "extra");
      expect(parsed?.outerHTML, name).toBe(built.outerHTML);
    }
  });
});
