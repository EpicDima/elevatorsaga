/**
 * What the editor pane paints that a token alone can't vouch for: the mark
 * under a failing line, the error banner, and the completion popup, a
 * surface CodeMirror owns until this pane's stylesheet restates it.
 */

import { describe, expect, it } from "vitest";

import { contrast, declaration, ruleBody, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("the failing line's own mark", () => {
  it.each(THEMES)(
    "keeps the error squiggle readable on the editor's background, %s theme",
    (_, palette) => {
      // A graphical indicator, so WCAG 1.4.11's 3:1 floor applies, not 1.4.3's 4.5:1.
      expect(
        contrast(themed(palette, "ds-bad"), themed(palette, "ds-code-bg")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("the error banner", () => {
  it("wraps a failure that has nowhere to break", () => {
    // The quoted failure is player text and can be one unbroken token of any
    // length, which without this overflows the pane and scrolls the whole page.
    expect(
      declaration(ruleBody(".errorline .errormessage"), "overflow-wrap", ".errormessage"),
    ).toBe("anywhere");
  });
});

describe("the completion popup", () => {
  it.each(THEMES)(
    "keeps the offered names readable on the card under them, %s theme",
    (_, palette) => {
      // CodeMirror paints its tooltips from its own light base theme regardless
      // of page theme, so this pane repaints them as the page's other floating cards.
      expect(
        contrast(themed(palette, "ds-text"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(THEMES)(
    "marks the entry Enter would take by more than the color of its text, %s theme",
    (_, palette) => {
      // A solid accent bar, not the soft wash used for other "this one is on"
      // states, since the wash fails contrast in a list that moves under every keystroke.
      expect(
        contrast(themed(palette, "ds-accent"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)("keeps that entry's own label readable on the mark, %s theme", (_, palette) => {
    // Matches `.btn-primary`'s own accent-ink-on-accent pairing.
    expect(
      contrast(themed(palette, "ds-accent-ink"), themed(palette, "ds-accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gives the kind glyph the strength of the row it sits in", () => {
    // CodeMirror dims this glyph to 0.6 opacity, which drops below WCAG 1.4.3's
    // text threshold on the highlighted row; this asserts it stays at full strength.
    expect(
      declaration(ruleBody(".cm-editor .cm-completionIcon"), "opacity", ".cm-completionIcon"),
    ).toBe("1");
  });
});
