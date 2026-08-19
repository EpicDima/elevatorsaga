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
  // passing. src/shared/ui/fontawesome-glyphs.json is a copy of the twelve glyphs
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

/** The mockup-family icon names, in the order `SPRITE_ICONS` declares them. */
const SPRITE_ICON_NAMES = Object.keys(SPRITE_ICONS) as SpriteIconName[];

/** The default paint every stroked mockup-family glyph shares, spelled out per shape (see icon.ts). */
const STROKE_DEFAULTS = (strokeWidth: string) => ({
  fill: "none",
  stroke: "currentColor",
  "stroke-width": strokeWidth,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
});

describe("SPRITE_ICONS", () => {
  // design/ui-mockup.html's own <symbol id="i-star"> — copied verbatim, the
  // same reason ICONS is held to fontawesome-glyphs.json above.
  it("reproduces the mockup's star glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-check">/<symbol id="i-x">/
  // <symbol id="i-dash"> — copied verbatim, with the mockup's shared ".icon"
  // stroke defaults spelled out per shape (see icon.ts's doc comment on why).
  it("reproduces the mockup's check/x/dash glyphs exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-lamp"> — copied verbatim,
  // three shapes at the mockup's own default (unoverridden) stroke width.
  it("reproduces the mockup's lamp glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-book"> — copied verbatim, two
  // shapes at the mockup's own default stroke.
  it("reproduces the mockup's book glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-copy"> — copied verbatim.
  it("reproduces the mockup's copy glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-dice"> — copied verbatim. The
  // three pip dots are filled solid, not stroked, unlike the outer die.
  it("reproduces the mockup's dice glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-keys"> — copied verbatim.
  it("reproduces the mockup's keys glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-link"> — copied verbatim.
  it("reproduces the mockup's link glyph exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-only-code">/<symbol id="i-only-game">
  // — copied verbatim, sharing the same outer frame as split-left/split-right.
  it("reproduces the mockup's only-code/only-game glyphs exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-slider"> — copied verbatim.
  it("reproduces the mockup's slider glyph exactly", () => {
    expect(SPRITE_ICONS.slider).toEqual({
      viewBox: "0 0 16 16",
      shapes: [
        { tag: "path", attrs: { d: "M2 5h8M2 11h4", ...STROKE_DEFAULTS("1.6") } },
        { tag: "circle", attrs: { cx: "12", cy: "5", r: "1.8", ...STROKE_DEFAULTS("1.6") } },
        { tag: "circle", attrs: { cx: "8", cy: "11", r: "1.8", ...STROKE_DEFAULTS("1.6") } },
      ],
    });
  });

  // design/ui-mockup.html's own <symbol id="i-split-left">/<symbol id="i-split-right">
  // — copied verbatim, sharing the same outer frame as only-code/only-game.
  it("reproduces the mockup's split-left/split-right glyphs exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-right">/<symbol id="i-left"> —
  // the generic disclosure chevron the settings popover's keysOpen row draws,
  // and its mirror, which the speed control uses as its "slower" arrow.
  it("reproduces the mockup's right and left glyphs exactly", () => {
    expect(SPRITE_ICONS.right).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m6 3 5 5-5 5", ...STROKE_DEFAULTS("1.6") } }],
    });
    expect(SPRITE_ICONS.left).toEqual({
      viewBox: "0 0 16 16",
      shapes: [{ tag: "path", attrs: { d: "m10 3-5 5 5 5", ...STROKE_DEFAULTS("1.6") } }],
    });
  });

  // design/ui-mockup.html's own <symbol id="i-play">/<symbol id="i-pause">/
  // <symbol id="i-restart"> — the run controls' three glyphs. `play` is the
  // one glyph here that overrides `fill` without turning `stroke` off, so it
  // keeps the family's stroke defaults on top of a fill; `pause` is the only
  // one at 2.4.
  it("reproduces the mockup's play, pause and restart glyphs exactly", () => {
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

  // design/ui-mockup.html's own <symbol id="i-undo">/<symbol id="i-warn"> —
  // the two glyphs widgets/editor-pane draws, its "Reset code" arrow and its
  // error banner's triangle. `redo` has no clause here on purpose: it is the
  // one glyph in this table the mockup does not contain, mirrored out of
  // `undo` rather than copied, so there is nothing to hold it to.
  it("reproduces the mockup's undo and warn glyphs exactly", () => {
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
