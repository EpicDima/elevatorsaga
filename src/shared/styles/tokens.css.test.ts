/**
 * Contrast guards for palette pairs used by more than one slice — sitewide
 * text, the shared focus ring, the common control surface, and the
 * `--*-soft` badge family — rather than by any single widget's own tests.
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
    expect([...PALETTE.keys()].filter((name) => name.startsWith("color-"))).toEqual([]);
  });

  it.each(THEMES)("keeps the shared control-surface pairing readable, %s theme", (_, palette) => {
    // --ds-text on --ds-raised: the pairing kbd, .skip-link, .task-open, and .btn all share.
    expect(
      contrast(themed(palette, "ds-text"), themed(palette, "ds-raised")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("keeps secondary prose comfortable on every surface, %s theme", (_, palette) => {
    // --ds-text-muted carries hint, briefing, and caption text at 12-13px, so it
    // answers to WCAG 1.4.6's 7:1 rather than 1.4.3's 4.5:1. These are the three
    // surfaces it is set on: the page, a panel, and a raised card inside one.
    for (const surface of ["ds-bg", "ds-panel", "ds-raised"]) {
      expect(
        contrast(themed(palette, "ds-text-muted"), themed(palette, surface)),
        `--ds-text-muted on --${surface}`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it.each(THEMES)("keeps the sitewide focus ring readable on the page, %s theme", (_, palette) => {
    // A graphical indicator (WCAG 1.4.11's 3:1), not text (1.4.3's 4.5:1);
    // --ds-bg is the palest page surface it can be drawn against.
    expect(contrast(themed(palette, "ds-focus"), themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe("ds palette on the page background", () => {
  // Read from DARK_PALETTE/LIGHT_PALETTE directly: PALETTE collapses a token
  // declared in both to whichever block comes last, which would silently
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
  // --ds-bad-ink, not --ds-bad, is what this text uses: --ds-bad falls short
  // of 4.5:1 once composited over --ds-bad-soft in the light theme.
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
      // A graphical mark (aria-hidden, WCAG 1.4.11's 3:1), not text, since the
      // headline beside it already says won or lost in words.
      const backdrop = over(themed(palette, "ds-ok-soft"), themed(palette, "ds-panel"));
      expect(declaration(ruleBody(".verdict-mark"), "background", ".verdict-mark")).toBe(
        token("ds-ok-soft"),
      );
      expect(contrast(themed(palette, "ds-ok"), backdrop)).toBeGreaterThanOrEqual(3);
    },
  );
});
