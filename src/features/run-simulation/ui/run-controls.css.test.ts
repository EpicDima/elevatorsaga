/** Tests that the run controls' width doesn't reflow the app bar under repeated presses. */

import { describe, expect, it } from "vitest";

import { contrast, declaration, ruleBody, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("run controls", () => {
  it("keeps both run buttons one width, so the bar is not recut on every press", () => {
    // The widest label (Crunching...) sets the floor for all of them.
    const body = ruleBody(".runbox .btn");
    expect(declaration(body, "min-width", ".runbox .btn")).toBe("152px");
    expect(declaration(body, "justify-content", ".runbox .btn")).toBe("center");
  });

  it("gives the mount the app bar's own gap, so the pair sits like any two of its children", () => {
    // The gap must match .appbar's own, so nesting doesn't change the spacing.
    expect(declaration(ruleBody(".controls"), "gap", ".controls")).toBe(
      declaration(ruleBody(".appbar"), "gap", ".appbar"),
    );
  });

  it.each(THEMES)(
    "keeps the primary button's own label readable on the accent it is painted with, %s theme",
    (_, palette) => {
      // Checked on both --ds-accent and its hover shade, since hover moves
      // opposite directions in the two themes.
      for (const background of ["ds-accent", "ds-accent-hi"]) {
        expect(
          contrast(themed(palette, "ds-accent-ink"), themed(palette, background)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
