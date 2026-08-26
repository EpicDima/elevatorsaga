/**
 * The code surface's own contrast: one background, three states of it, and
 * the eight inks drawn on all three. Shared since `.tok-*` and the live
 * editor's syntax colors are the same palette.
 */

import { describe, expect, it } from "vitest";

import { CODE_INK_TOKENS, contrast, over, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("ds code palette on the code background", () => {
  // pre code, .cm-editor, .tok-*, editorSyntaxTheme, and .cm-gutters all paint
  // straight onto --ds-code-bg at 13px or smaller: WCAG 1.4.3 requires 4.5:1 of all of it.
  it.each([
    ["ds-code-text", "ds-code-bg", 4.5],
    ["ds-code-key", "ds-code-bg", 4.5],
    ["ds-code-fn", "ds-code-bg", 4.5],
    ["ds-code-str", "ds-code-bg", 4.5],
    ["ds-code-num", "ds-code-bg", 4.5],
    ["ds-code-com", "ds-code-bg", 4.5],
    ["ds-code-line", "ds-code-bg", 4.5],
    // The dimmest by design (recedes behind the words), and so the tightest margin.
    ["ds-code-punc", "ds-code-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  // The caret's line is a permanent surface too, since every line is
  // eventually read through --ds-code-active; the composite isn't in the
  // palette by name, so the block above can't catch a regression here.
  it.each(THEMES)("keeps every code color readable on the active line, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    for (const name of CODE_INK_TOKENS) {
      expect(
        contrast(themed(palette, name), lit),
        `--${name} on the active line`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // .cm-activeLineGutter brightens just the caret's own line number, on the
  // lit background rather than the plain one.
  it.each(THEMES)("keeps the active line's own number readable, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    expect(contrast(themed(palette, "ds-text-muted"), lit)).toBeGreaterThanOrEqual(4.5);
  });

  // 3:1, not 4.5:1: CodeMirror's drawSelection paints behind the text, so no
  // token here can recolor what's selected; the floor keeps that shortfall bounded.
  it.each(THEMES)(
    "keeps selected code above 3:1, even over the active line, %s theme",
    (_, palette) => {
      const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
      const selected = over(themed(palette, "ds-code-sel"), lit);
      for (const name of CODE_INK_TOKENS) {
        expect(
          contrast(themed(palette, name), selected),
          `--${name} selected`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );
});
