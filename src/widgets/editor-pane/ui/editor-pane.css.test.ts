/**
 * What the editor pane paints that a token on its own cannot vouch for: the
 * mark under a failing line, the banner quoting what failed, and the popup of
 * API names offered under the cursor -- a surface that is CodeMirror's until
 * this pane's stylesheet restates it.
 *
 * The eight syntax colors and the surfaces under them are the shared code
 * palette, measured in `shared/styles/code.css.test.ts`; the banner's own soft
 * badge is measured with the rest of that token family in
 * `shared/styles/tokens.css.test.ts`.
 */

import { describe, expect, it } from "vitest";

import { contrast, declaration, ruleBody, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("the failing line's own mark", () => {
  it.each(THEMES)(
    "keeps the error squiggle readable on the editor's background, %s theme",
    (_, palette) => {
      // `.cm-errorMark` (`src/ui/editor.ts`) underlines the failing text in
      // --ds-bad, on --ds-code-bg. A graphical indicator, so 1.4.11's 3:1 rather
      // than 1.4.3's 4.5 -- and it clears the stricter bar anyway, 5.74:1 dark
      // and 4.94:1 light, which is why the mark needs no size or weight of its
      // own to be found.
      expect(
        contrast(themed(palette, "ds-bad"), themed(palette, "ds-code-bg")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("the error banner", () => {
  it("wraps a failure that has nowhere to break", () => {
    // The quoted failure is the player's own text and can be one unbroken
    // token of any length -- a thrown 400-character string with no spaces in
    // it. Nothing between the <code> and the document clips: a banner without
    // this laid that string out 3010px wide inside a 463px pane and gave the
    // whole page a horizontal scrollbar, which on a frame that is otherwise
    // exactly the window is the one overflow that cannot be lived with.
    expect(
      declaration(ruleBody(".errorline .errormessage"), "overflow-wrap", ".errormessage"),
    ).toBe("anywhere");
  });
});

describe("the completion popup", () => {
  it.each(THEMES)(
    "keeps the offered names readable on the card under them, %s theme",
    (_, palette) => {
      // The list and the card describing the highlighted entry are both
      // `.cm-tooltip`s. CodeMirror paints those from the light half of its base
      // theme whatever this page's theme is, which left them an #f5f5f5 slab
      // under the --ds-code-text they inherit from the editor: 1.29:1 in the
      // dark theme. Painted as the page's other floating cards are, it is the
      // panel's own text on the panel, 14.04:1 dark and 15.99:1 light.
      expect(
        contrast(themed(palette, "ds-text"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(THEMES)(
    "marks the entry Enter would take by more than the color of its text, %s theme",
    (_, palette) => {
      // A solid --ds-accent bar rather than the --ds-accent-soft wash the pane's
      // other "this one is on" states wear: that wash is 1.29:1 over --ds-panel
      // dark and 1.13:1 light, which nobody can find in a list that moves under
      // every keystroke. The fill is 7.92:1 and 4.56:1, a highlight that answers
      // 1.4.11 on its own (WCAG 1.4.1).
      expect(
        contrast(themed(palette, "ds-accent"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)("keeps that entry's own label readable on the mark, %s theme", (_, palette) => {
    // 7.69:1 dark and 4.56:1 light -- the pairing `.btn-primary` already wears
    // for the other control a keypress acts on.
    expect(
      contrast(themed(palette, "ds-accent-ink"), themed(palette, "ds-accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gives the kind glyph the strength of the row it sits in", () => {
    // `𝑓`, `□`, `abc` -- the glyph naming what an entry is. CodeMirror dims it
    // to 0.6, which on the highlighted row is --ds-accent-ink at 2.67:1 in the
    // light theme, and `abc` is three letters rather than a symbol: text, which
    // 1.4.3 asks 4.5:1 of. The ratios above are the ones on screen only while
    // the glyph is at full strength.
    expect(
      declaration(ruleBody(".cm-editor .cm-completionIcon"), "opacity", ".cm-completionIcon"),
    ).toBe("1");
  });
});
