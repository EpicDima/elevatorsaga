/**
 * The palette's own contrast guards: the pairs that belong to no single slice
 * because more than one slice paints them.
 *
 * A pair that only one widget ever draws is measured beside that widget's own
 * stylesheet instead. What is left here is the sitewide work — the page's own
 * text, the focus ring every control shares, the control surface `kbd`,
 * `.skip-link`, `.task-open` and `.btn` all reach for, and the `--*-soft`
 * badge family three different slices paint.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  DARK_PALETTE,
  LIGHT_PALETTE,
  PALETTE,
  ruleBody,
  THEMES,
  themed,
  token,
  over,
} from "#shared/styles/test-helpers.ts";

describe("the palette", () => {
  it("declares no --color-* token at all, the legacy palette having been retired", () => {
    // The migration onto --ds-* is finished: the last holdout was
    // --color-error, read by name from `src/ui/editor.ts` for the wavy
    // underline under a failing line, and that rule reads --ds-bad now. This
    // is here so the palette cannot quietly grow a page-bound color back.
    expect([...PALETTE.keys()].filter((name) => name.startsWith("color-"))).toEqual([]);
  });

  it.each(THEMES)("keeps the shared control-surface pairing readable, %s theme", (_, palette) => {
    // --ds-text on --ds-raised, the pairing kbd, .skip-link, .task-open and
    // .btn all share now. 12.96:1 dark, 15.07:1 light -- far past the 4.5:1
    // that matters, since none of these sit at large-text sizes.
    expect(
      contrast(themed(palette, "ds-text"), themed(palette, "ds-raised")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("keeps the sitewide focus ring readable on the page, %s theme", (_, palette) => {
    // --ds-focus is var(--ds-accent) by default -- see its own comment in
    // tokens.css. A focus ring is a graphical indicator, so 1.4.11's 3:1
    // applies, not 1.4.3's 4.5; --ds-bg is the palest of the three page
    // surfaces it can be drawn against, so the worst case of them.
    // (`.world` redeclares it, and `widgets/building-stage` measures that.)
    expect(contrast(themed(palette, "ds-focus"), themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe("ds palette on the page background", () => {
  // body and .container paint --ds-bg now, not the fixed --color-page,
  // so the text painted directly on it -- h1-h6/p/a/dl (--ds-text,
  // `app/styles/document.css`), .emphasis-color (--ds-accent-hi) and
  // .error-color (--ds-bad), both in `utilities.css` -- has to
  // clear 4.5:1 in both of --ds-bg's themes, not just
  // the one --color-page ever had. These are read from :root and
  // html[data-theme="light"] separately: PALETTE collapses
  // a token declared in both to whichever block comes last, which would silently
  // test only one theme twice.
  it.each([
    ["ds-text", "ds-bg", 4.5],
    ["ds-accent-hi", "ds-bg", 4.5],
    ["ds-bad", "ds-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});

describe("text on a --*-soft badge", () => {
  // .errorline (`widgets/editor-pane`) and .tierrow.is-lost .tierstate
  // (`widgets/goal-bar`) both paint --ds-bad-soft as an
  // opaque background and used to read the same --ds-bad their icon/border
  // still does for their own text too -- close enough to the text's own hue,
  // composited over a page surface, to fall short of 4.5:1 in the light
  // theme even though --ds-bad on a flat page surface clears it on its own
  // (see .error-color's comment in utilities.css). --ds-bad-ink is what the text
  // reads instead; this is what catches either regressing back to --ds-bad,
  // or the composite falling out of tolerance some other way -- raising
  // --ds-bad-soft's alpha, for instance -- since both would still be an
  // arithmetic pass if this measured the declared token by name instead of
  // the composite it actually sits on.
  //
  // All three cases live here rather than beside any one of those slices
  // because they are one argument about two token families, and the third
  // reads its surface off the second's.
  it.each(THEMES)("keeps the error line's label and link readable, %s theme", (_, palette) => {
    const backdrop = over(themed(palette, "ds-bad-soft"), themed(palette, "ds-code-bg"));
    expect(contrast(themed(palette, "ds-bad-ink"), backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("keeps a lost tier's badge readable, %s theme", (_, palette) => {
    const backdrop = over(themed(palette, "ds-bad-soft"), themed(palette, "ds-panel"));
    expect(contrast(themed(palette, "ds-bad-ink"), backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)(
    "keeps the verdict card's own mark visible on its badge, %s theme",
    (_, palette) => {
      // The same two soft badges one more time, this time 38px across at the
      // head of the run's verdict card (`widgets/verdict-toast`). The cross is
      // the pair measured directly above -- --ds-bad-ink on --ds-bad-soft over
      // --ds-panel, the same surface -- so only the check needs its own case
      // here. 1.4.11's 3:1, not 4.5:1:
      // the mark is aria-hidden and the headline beside it says won or lost in
      // words, so it is a graphical object rather than text. The light theme is
      // the tight one at 3.97:1, which is what makes the composite worth
      // measuring: --ds-ok reads 4.63:1 on the bare panel there, and the badge
      // it is actually painted on is the greener surface.
      const backdrop = over(themed(palette, "ds-ok-soft"), themed(palette, "ds-panel"));
      expect(declaration(ruleBody(".verdict-mark"), "background", ".verdict-mark")).toBe(
        token("ds-ok-soft"),
      );
      expect(contrast(themed(palette, "ds-ok"), backdrop)).toBeGreaterThanOrEqual(3);
    },
  );
});
