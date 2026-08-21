/**
 * The run controls sit in the app bar and are pressed more than anything else
 * on the page, so what they cost is measured in reflows: a box that changes
 * width between two presses of the same button recuts the whole bar under the
 * pointer.
 */

import { describe, expect, it } from "vitest";

import { contrast, declaration, ruleBody, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("run controls", () => {
  it("keeps both run buttons one width, so the bar is not recut on every press", () => {
    // The primary button says four different things -- Start, Pause, Resume,
    // Crunching... -- and the widest of them is what decides the box. Without
    // a floor under it the whole bar reflows under the pointer between two
    // presses of the same button -- the worst thing that can happen to a bar.
    const body = ruleBody(".runbox .btn");
    expect(declaration(body, "min-width", ".runbox .btn")).toBe("152px");
    expect(declaration(body, "justify-content", ".runbox .btn")).toBe("center");
  });

  it("gives the mount the app bar's own gap, so the pair sits like any two of its children", () => {
    // .controls wraps .runbox and .speed, and earns its place by being
    // invisible: 14px inside it is 14px between any two of the bar's own
    // children, so the geometry does not depend on the nesting.
    expect(declaration(ruleBody(".controls"), "gap", ".controls")).toBe(
      declaration(ruleBody(".appbar"), "gap", ".appbar"),
    );
  });

  it.each(THEMES)(
    "keeps the primary button's own label readable on the accent it is painted with, %s theme",
    (_, palette) => {
      // --ds-accent-ink on --ds-accent, and on the hover shade too: light theme
      // darkens the accent on hover where dark theme lightens it, so the ink is
      // only safe if both are measured.
      for (const background of ["ds-accent", "ds-accent-hi"]) {
        expect(
          contrast(themed(palette, "ds-accent-ink"), themed(palette, background)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
