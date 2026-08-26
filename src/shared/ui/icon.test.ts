// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import fontAwesome from "./fontawesome-glyphs.json";
import {
  createIcon,
  createSpriteIcon,
  ICON_ASCENT,
  ICON_EM_UNITS,
  ICONS,
  iconMarkup,
  iconWidthEm,
  SPRITE_ICONS,
  spriteIconMarkup,
} from "./icon.ts";
import type { IconName, SpriteIconName } from "./icon.ts";

/** Every `fa-*` glyph still drawn, with the codepoint that class resolved to. */
const LEGACY_GLYPHS: Readonly<Record<IconName, string>> = {
  "caret-right": "U+F0DA",
  minus: "U+F068",
  plus: "U+F067",
};

/** The icon names, in the order the fixture and the icon set agree on. */
const ICON_NAMES = Object.keys(LEGACY_GLYPHS) as IconName[];

describe("ICONS", () => {
  it("covers exactly the glyphs the game still draws", () => {
    expect(Object.keys(ICONS).toSorted()).toEqual(ICON_NAMES.toSorted());
  });

  // Nothing in the game reads the webfont at runtime any more, so a swapped,
  // truncated, or nudged outline would leave every other test passing.
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
    expect(iconWidthEm("caret-right")).toBe("0.3571em");
    expect(iconWidthEm("plus")).toBe("0.7857em");
  });
});

describe("createIcon", () => {
  it("builds an svg sized like the webfont glyph", () => {
    const icon = createIcon("caret-right");
    expect(icon.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(icon.getAttribute("viewBox")).toBe(`0 0 640 ${String(ICON_EM_UNITS)}`);
    expect(icon.getAttribute("width")).toBe("0.3571em");
    expect(icon.getAttribute("height")).toBe("1em");
  });

  it("inherits its color and stays out of the accessibility tree", () => {
    const icon = createIcon("caret-right");
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

  it("carries the base class alone when no extra classes were asked for", () => {
    // An icon without an extra class must come out `class="icon"`, not `class="icon undefined"`.
    const template = document.createElement("template");
    template.innerHTML = iconMarkup("caret-right");
    expect(template.content.firstElementChild?.outerHTML).toBe(createIcon("caret-right").outerHTML);
  });
});

/** The sprite icon names, in the order `SPRITE_ICONS` declares them. */
const SPRITE_ICON_NAMES = Object.keys(SPRITE_ICONS) as SpriteIconName[];

/** The default paint every stroked sprite glyph shares, spelled out per shape. */
const STROKE_DEFAULTS = (strokeWidth: string) => ({
  fill: "none",
  stroke: "currentColor",
  "stroke-width": strokeWidth,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
});

// These outlines are drawn by hand and read by nothing else at runtime, so
// a truncated or nudged path would leave every other test passing.
describe("SPRITE_ICONS", () => {
  it("reproduces the star glyph exactly", () => {
    expect(SPRITE_ICONS.star).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: {
            d: "M8 2 9.76 6.17 14.28 6.56 10.85 9.53 11.88 13.94 8 11.6 4.12 13.94 5.15 9.53 1.72 6.56 6.24 6.17Z",
            fill: "currentColor",
            stroke: "none",
          },
        },
      ],
    });
  });

  it("reproduces the check/x/dash glyphs exactly", () => {
    expect(SPRITE_ICONS.check).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m3.5 8.5 3 3 6-7", ...STROKE_DEFAULTS("2") } }],
    });
    expect(SPRITE_ICONS.x).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m4 4 8 8M12 4l-8 8", ...STROKE_DEFAULTS("2") } }],
    });
    expect(SPRITE_ICONS.dash).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "M4 8h8", ...STROKE_DEFAULTS("2") } }],
    });
  });

  it("reproduces the lamp glyph exactly", () => {
    expect(SPRITE_ICONS.lamp).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: {
            d: "M8 2v1.5M3.5 8H2m12 0h-1.5M4.6 4.6 3.5 3.5m8.9 1.1 1.1-1.1",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "circle", attrs: { cx: "8", cy: "8.5", r: "3", ...STROKE_DEFAULTS("1.6") } },
        { tag: "path", attrs: { d: "M6.5 13h3", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  it("reproduces the book glyph exactly", () => {
    expect(SPRITE_ICONS.book).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: {
            d: "M2.5 3.5h4a2 2 0 0 1 2 2v8a1.6 1.6 0 0 0-1.6-1.5H2.5v-8.5Z",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        {
          tag: "path",
          attrs: {
            d: "M13.5 3.5h-4a2 2 0 0 0-2 2v8a1.6 1.6 0 0 1 1.6-1.5h4.4v-8.5Z",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
      ],
    });
  });

  it("reproduces the copy glyph exactly", () => {
    expect(SPRITE_ICONS.copy).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "5.5",
            y: "5.5",
            width: "8",
            height: "8",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "path", attrs: { d: "M10.5 3.5h-7a1 1 0 0 0-1 1v7", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  // The pip dots are filled solid, not stroked, unlike the outer die.
  it("reproduces the dice glyph exactly", () => {
    expect(SPRITE_ICONS.dice).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "2.5",
            y: "2.5",
            width: "11",
            height: "11",
            rx: "2.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        {
          tag: "circle",
          attrs: { cx: "5.8", cy: "5.8", r: ".9", fill: "currentcolor", stroke: "none" },
        },
        {
          tag: "circle",
          attrs: { cx: "10.2", cy: "10.2", r: ".9", fill: "currentcolor", stroke: "none" },
        },
        {
          tag: "circle",
          attrs: { cx: "8", cy: "8", r: ".9", fill: "currentcolor", stroke: "none" },
        },
      ],
    });
  });

  it("reproduces the keys glyph exactly", () => {
    expect(SPRITE_ICONS.keys).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "1.5",
            y: "3.5",
            width: "13",
            height: "9",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        {
          tag: "path",
          attrs: {
            d: "M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M4 9.5h.01M11.5 9.5h.01",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "path", attrs: { d: "M6.5 9.5h3", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  it("reproduces the link glyph exactly", () => {
    expect(SPRITE_ICONS.link).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        { tag: "path", attrs: { d: "M9.5 3h3.5v3.5", ...STROKE_DEFAULTS("1.6") } },
        { tag: "path", attrs: { d: "M13 3 7.5 8.5", ...STROKE_DEFAULTS("1.6") } },
        {
          tag: "path",
          attrs: {
            d: "M11 9.5V12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 2 12V6a1.5 1.5 0 0 1 1.5-1.5H6",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
      ],
    });
  });

  // These share their outer frame with split-left/split-right.
  it("reproduces the only-code/only-game glyphs exactly", () => {
    expect(SPRITE_ICONS["only-code"]).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "1.5",
            y: "2.5",
            width: "13",
            height: "11",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        {
          tag: "path",
          attrs: { d: "M5.5 6.5 3.8 8l1.7 1.5m5-3L12.2 8l-1.7 1.5", ...STROKE_DEFAULTS("1.6") },
        },
      ],
    });
    expect(SPRITE_ICONS["only-game"]).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "1.5",
            y: "2.5",
            width: "13",
            height: "11",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "path", attrs: { d: "M5 11V7m3 4V5m3 6V9", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  it("reproduces the slider glyph exactly", () => {
    expect(SPRITE_ICONS.slider).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        { tag: "path", attrs: { d: "M2 5h8M2 11h4", ...STROKE_DEFAULTS("1.6") } },
        { tag: "circle", attrs: { cx: "12", cy: "5", r: "1.8", ...STROKE_DEFAULTS("1.6") } },
        { tag: "circle", attrs: { cx: "8", cy: "11", r: "1.8", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  // These share their outer frame with only-code/only-game.
  it("reproduces the split-left/split-right glyphs exactly", () => {
    expect(SPRITE_ICONS["split-left"]).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "1.5",
            y: "2.5",
            width: "13",
            height: "11",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "path", attrs: { d: "M6.5 2.5v11", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
    expect(SPRITE_ICONS["split-right"]).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "rect",
          attrs: {
            x: "1.5",
            y: "2.5",
            width: "13",
            height: "11",
            rx: "1.5",
            ...STROKE_DEFAULTS("1.6"),
          },
        },
        { tag: "path", attrs: { d: "M9.5 2.5v11", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  // The disclosure chevron, and its mirror used as the speed control's "slower" arrow.
  it("reproduces the right and left glyphs exactly", () => {
    expect(SPRITE_ICONS.right).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m6 3 5 5-5 5", ...STROKE_DEFAULTS("1.6") } }],
    });
    expect(SPRITE_ICONS.left).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m10 3-5 5 5 5", ...STROKE_DEFAULTS("1.6") } }],
    });
  });

  // `play` overrides `fill` without turning `stroke` off, keeping the stroke
  // defaults on top of a fill; `pause` is the only glyph with a heavier stroke.
  it("reproduces the play, pause and restart glyphs exactly", () => {
    expect(SPRITE_ICONS.play).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: {
            d: "M5 3.5v9l8-4.5-8-4.5Z",
            ...STROKE_DEFAULTS("1.6"),
            fill: "currentColor",
          },
        },
      ],
    });
    expect(SPRITE_ICONS.pause).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "M6 3.5v9M10 3.5v9", ...STROKE_DEFAULTS("2.4") } }],
    });
    expect(SPRITE_ICONS.restart).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: { d: "M13 8a5 5 0 1 1-1.6-3.7M13 3v3h-3", ...STROKE_DEFAULTS("1.6") },
        },
      ],
    });
  });

  // `redo` is mirrored out of `undo` rather than drawn, so it has no shape of its own to test here.
  it("reproduces the undo and warn glyphs exactly", () => {
    expect(SPRITE_ICONS.undo).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        {
          tag: "path",
          attrs: { d: "M3 8h7a3 3 0 0 1 0 6H6M3 8l3-3M3 8l3 3", ...STROKE_DEFAULTS("1.6") },
        },
      ],
    });
    expect(SPRITE_ICONS.warn).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        { tag: "path", attrs: { d: "M8 2.5 15 14H1L8 2.5Z", ...STROKE_DEFAULTS("1.6") } },
        { tag: "path", attrs: { d: "M8 6.5v3.2M8 11.8v.6", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });
});

describe("createSpriteIcon", () => {
  it("builds an svg at the glyph's native viewBox", () => {
    const icon = createSpriteIcon("star");
    expect(icon.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(icon.getAttribute("viewBox")).toBe("0 0 16 16");
  });

  it("stays out of the accessibility tree", () => {
    const icon = createSpriteIcon("star");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
  });

  it("draws each shape with its own paint attributes", () => {
    const icon = createSpriteIcon("star");
    const path = icon.firstElementChild;
    expect(path?.tagName).toBe("path");
    expect(path?.getAttribute("fill")).toBe("currentColor");
    expect(path?.getAttribute("stroke")).toBe("none");
    expect(path?.getAttribute("d")).toBe(SPRITE_ICONS.star.shapes[0].attrs.d);
  });

  it("keeps the base class and appends any extra classes", () => {
    expect(createSpriteIcon("star").getAttribute("class")).toBe("ds-icon");
    expect(createSpriteIcon("star", "up activated").getAttribute("class")).toBe(
      "ds-icon up activated",
    );
  });
});

describe("spriteIconMarkup", () => {
  it("parses into the same element createSpriteIcon builds", () => {
    for (const name of SPRITE_ICON_NAMES) {
      const template = document.createElement("template");
      template.innerHTML = spriteIconMarkup(name, "extra");
      const parsed = template.content.firstElementChild;
      const built = createSpriteIcon(name, "extra");
      expect(parsed?.outerHTML, name).toBe(built.outerHTML);
    }
  });
});
