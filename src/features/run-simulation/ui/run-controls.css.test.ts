/** Tests that the run controls' width doesn't reflow the app bar under repeated presses. */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("run controls", () => {
  it("keeps both run buttons one width, so the bar is not recut on every press", () => {
    // The floor is the widest label in any locale: Russian's "Прогоняем…", 137px.
    const body = ruleBody(".runbox .btn");
    expect(declaration(body, "min-width", ".runbox .btn")).toBe("140px");
    expect(declaration(body, "justify-content", ".runbox .btn")).toBe("center");
  });

  it("gives the mount the app bar's own gap, so the pair sits like any two of its children", () => {
    // The gap must match .appbar's own, so nesting doesn't change the spacing.
    expect(declaration(ruleBody(".controls"), "gap", ".controls")).toBe(
      declaration(ruleBody(".appbar"), "gap", ".appbar"),
    );
  });

  it("lets only Start over collapse when the bar narrows, since its label never changes", () => {
    // Resetting `.runbox .btn` instead would drop the primary's floor too and
    // recut the bar on every press. Read off the source, since ruleBody() sees
    // only top-level rules and this one lives inside an `@media` block.
    expect(styleSource).toMatch(/\.runbox \.startover\s*\{\s*min-width:\s*0;/);
    expect(styleSource).not.toMatch(/\.runbox \.btn\s*\{\s*min-width:\s*0;/);
  });
});
