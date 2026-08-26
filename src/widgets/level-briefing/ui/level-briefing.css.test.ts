/** The briefing card's type, and the surface it deliberately doesn't draw (that's `.tutorial`'s, shared with `widgets/tutorial-panel`). */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  requiredRatio,
  ruleBody,
  styleSource,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

describe("ds palette on the briefing card", () => {
  // These pairs are the lesson card's own, since the two cards share the surface.
  it.each([
    ["ds-text", "ds-panel", 4.5],
    ["ds-text-muted", "ds-panel", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});

describe("the briefing card", () => {
  it("writes the briefing in the muted ink, at the ratio that ink is readable at", () => {
    // Both halves matter together: either alone can pass while the card stays unreadable.
    const prose = ruleBody(".briefingtext");
    expect(declaration(prose, "color", ".briefingtext")).toBe(token("ds-text-muted"));
    const required = requiredRatio(
      Number.parseFloat(declaration(prose, "font-size", ".briefingtext")),
      "normal",
    );
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  it("states a weight on the title, which the document rules would otherwise take away", () => {
    // `h2` is `font-weight: normal` page-wide, so without this the title
    // silently renders at the same weight as the prose beneath it.
    const weight = declaration(ruleBody(".briefingtitle"), "font-weight", ".briefingtitle");
    expect(Number.parseFloat(weight)).toBeGreaterThan(400);
  });

  it("keeps the title larger than the briefing under it", () => {
    const title = declaration(ruleBody(".briefingtitle"), "font-size", ".briefingtitle");
    const prose = declaration(ruleBody(".briefingtext"), "font-size", ".briefingtext");
    expect(Number.parseFloat(prose)).toBeLessThan(Number.parseFloat(title));
  });

  it("holds the briefing to a measure, as the lesson beside it is held", () => {
    expect(declaration(ruleBody(".briefingtext"), "max-inline-size", ".briefingtext")).toMatch(
      /^\d+ch$/,
    );
  });

  it("draws no card of its own, because it is already inside one", () => {
    // `.tutorial`, shared with the lesson card, is the card; restating any of
    // its surface here would draw a visible second card inside the first.
    expect(styleSource, ".briefingpanel now has a rule of its own").not.toMatch(
      /^\.briefingpanel\s*\{/m,
    );
    for (const property of ["padding", "border", "border-radius", "background-color"]) {
      expect(styleSource, `the briefing card restates ${property}`).not.toMatch(
        new RegExp(`^\\.briefing[\\w-]*\\s*\\{[^}]*^\\s*${property}:`, "m"),
      );
    }
  });
});
