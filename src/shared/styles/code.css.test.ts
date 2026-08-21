/**
 * The code surface's own contrast: one background, three states of it, and the
 * eight inks drawn on all three.
 *
 * Shared rather than the editor's alone -- `pre code` and `.tok-*` set every
 * tutorial answer and every documentation sample in the same colours the live
 * editor uses -- so the palette is measured here, and the editor's own chrome
 * beside `widgets/editor-pane`.
 */

import { describe, expect, it } from "vitest";

import { contrast, over, THEMES, themed } from "#shared/styles/test-helpers.ts";

/**
 * Every colour the editor draws text in — the eight syntax colours plus the
 * line numbers beside them.
 *
 * Listed once because the surface underneath changes and the ink does not: the
 * same eight are measured on the plain background, on the active line, and on
 * a selection, and a ninth colour added to `editorSyntaxTheme` without being
 * added here would be measured on none of them.
 */
const CODE_INK_TOKENS = [
  "ds-code-text",
  "ds-code-key",
  "ds-code-fn",
  "ds-code-str",
  "ds-code-num",
  "ds-code-com",
  "ds-code-punc",
  "ds-code-line",
];

describe("ds code palette on the code background", () => {
  // pre code and .cm-editor both paint --ds-code-bg now, and .tok-* (the
  // eight tutorial answers' syntax colours), `editorSyntaxTheme` (the live
  // editor's, in `src/ui/code-highlight.ts`) and .cm-gutters (the live
  // editor's line numbers) paint straight onto it, at 13px and smaller --
  // 1.4.3 asks 4.5:1 of all of it. --ds-code-com and --ds-code-line had to be
  // retuned to get there; see .tok-comment's and .cm-gutters's own comments.
  it.each([
    ["ds-code-text", "ds-code-bg", 4.5],
    ["ds-code-key", "ds-code-bg", 4.5],
    ["ds-code-fn", "ds-code-bg", 4.5],
    ["ds-code-str", "ds-code-bg", 4.5],
    ["ds-code-num", "ds-code-bg", 4.5],
    ["ds-code-com", "ds-code-bg", 4.5],
    ["ds-code-line", "ds-code-bg", 4.5],
    // The dimmest of them by design -- brackets and operators are meant to
    // recede behind the words -- and so the one worth measuring most: 6.73:1
    // dark, 4.98:1 light.
    ["ds-code-punc", "ds-code-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  // The line the caret is on is not a background the player picks: it follows
  // them, so every line of a program is sooner or later read through
  // --ds-code-active. That makes the lit line as permanent a surface as
  // --ds-code-bg itself, and 1.4.3 applies to it unchanged -- which is what
  // this catches and the block above cannot, since the composite is nowhere
  // in the palette to be named. --ds-code-com and --ds-code-line were each
  // lightened precisely to clear it here; measuring only the unlit background
  // would let both drift back down.
  it.each(THEMES)("keeps every code colour readable on the active line, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    for (const name of CODE_INK_TOKENS) {
      expect(
        contrast(themed(palette, name), lit),
        `--${name} on the active line`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The one number in the gutter that is not --ds-code-line: .cm-activeLineGutter
  // brightens the caret's own line number to --ds-text-muted, and does it on
  // the lit background rather than the plain one. 6.41:1 dark, 5.32:1 light.
  it.each(THEMES)("keeps the active line's own number readable, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    expect(contrast(themed(palette, "ds-text-muted"), lit)).toBeGreaterThanOrEqual(4.5);
  });

  // 3:1, not 4.5:1, and deliberately: see --ds-code-sel's own comment in
  // tokens.css for why a selection cannot be held to 1.4.3 the way the two
  // surfaces above are -- CodeMirror's drawSelection paints behind the text,
  // so no value here can recolour what is selected. The floor exists so that
  // the shortfall stays the bounded, documented one and cannot quietly
  // deepen: the worst pairing is a selection over the active line, where the
  // two washes stack (3.27:1 dark).
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
