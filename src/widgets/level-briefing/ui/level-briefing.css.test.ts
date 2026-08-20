/**
 * The briefing card's type, and the surface it deliberately does not draw.
 *
 * The card itself is `.tutorial`, painted by `widgets/tutorial-panel` and
 * measured there; what is left to this file is the two rules that are this
 * widget's own, and the one structural fact the rules are silent about because
 * being silent is what they are for.
 */

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
  // The card is drawn on --ds-panel, and only two inks are read against it: the
  // level's name in the page's own text colour and the briefing itself muted.
  // Both pairs are the lesson card's, since the two cards share the surface --
  // measured in Chromium there, and repeated here so that a token taken under
  // the bar fails beside the rules that read it rather than only beside theirs.
  it.each([
    // The title's ink: 14.04:1 dark, 15.99:1 light.
    ["ds-text", "ds-panel", 4.5],
    // The briefing's: 6.70:1 dark, 5.90:1 light. The mockup's --text-faint was
    // measured on this surface for the lesson and refused at 3.62:1 / 3.14:1.
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
    // Both halves together: the rule really names --ds-text-muted, and that
    // token really clears the bar its own size and weight are held to. Either
    // on its own passes while the card is unreadable -- a rule that names a
    // token nobody measured, or a measurement of a token the rule stopped
    // using.
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
    // `h2` is set to `font-weight: normal` for the whole page, so a title that
    // stopped saying otherwise would render at the weight of the prose beneath
    // it and stop being a title -- silently, since nothing about the words
    // changes. The same trap `.tutorialtitle`'s own comment records.
    const weight = declaration(ruleBody(".briefingtitle"), "font-weight", ".briefingtitle");
    expect(Number.parseFloat(weight)).toBeGreaterThan(400);
  });

  it("keeps the title larger than the briefing under it", () => {
    // Size is the whole of what separates the two, since the ink already
    // differs in the other direction: a muted paragraph under a title the same
    // size reads as two paragraphs.
    const title = declaration(ruleBody(".briefingtitle"), "font-size", ".briefingtitle");
    const prose = declaration(ruleBody(".briefingtext"), "font-size", ".briefingtext");
    expect(Number.parseFloat(prose)).toBeLessThan(Number.parseFloat(title));
  });

  it("holds the briefing to a measure, as the lesson beside it is held", () => {
    // 384px of card beside the building never reached this ceiling; 640px of
    // card above it -- 610px of content, about 74 characters -- does.
    expect(declaration(ruleBody(".briefingtext"), "max-inline-size", ".briefingtext")).toMatch(
      /^\d+ch$/,
    );
  });

  it("draws no card of its own, because it is already inside one", () => {
    // The load-bearing absence. `.tutorial` -- the element this widget and the
    // lesson card are both drawn into -- is the card: 14px of padding, a
    // hairline, the large radius and --ds-panel. A `.briefingpanel` rule
    // repeating any of that would draw a second card inside the first, and a
    // doubled hairline is the kind of thing that reads as a rendering bug
    // rather than as a stylesheet saying something twice.
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
