/**
 * A passenger is a graphical object rather than text, so 1.4.11's 3:1 is the
 * bar throughout — but they are drawn on two different surfaces over the course
 * of a trip, and only one of the two follows the theme.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  LIGHT_PALETTE,
  over,
  ruleBody,
  styleSource,
  THEMES,
  themed,
  token,
  withAlpha,
} from "#shared/styles/test-helpers.ts";

describe("a passenger", () => {
  it.each(THEMES)(
    "keeps a passenger readable against the shaft and the car, %s theme",
    (_, palette) => {
      // Waiting or walking, they read against --ds-shaft (themed); boarded,
      // `.is-rider` switches them to a colour fixed across both themes, tuned
      // against --ds-car instead -- see the palette comment above --ds-car-ink.
      expect(declaration(ruleBody(".person"), "color", ".person")).toBe(token("ds-person"));
      expect(declaration(ruleBody(".person.is-rider"), "color", ".person.is-rider")).toBe(
        token("ds-car-person"),
      );
      expect(
        contrast(themed(palette, "ds-person"), themed(palette, "ds-shaft")),
      ).toBeGreaterThanOrEqual(3);
      expect(contrast(token("ds-car-person"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(3);
    },
  );

  it("leaves a delivered passenger's colour alone, because no fade would clear 3:1", () => {
    // The regression guard behind passenger-view.css's note at `.person.is-leaving`:
    // --ds-person has 3.52:1 of room over the light theme's shaft and nothing
    // more, so the mockup's fade -- any fade -- takes a passenger under the bar
    // 1.4.11 sets for a graphical object. This is what would catch someone
    // adding one back, and the arithmetic below is why it should not be added.
    expect(styleSource).not.toMatch(/^\.person\.is-leaving\s*\{/m);
    const shaft = themed(LIGHT_PALETTE, "ds-shaft");
    for (const percent of [50, 62, 85]) {
      const faded = over(withAlpha(themed(LIGHT_PALETTE, "ds-person"), percent), shaft);
      expect(contrast(faded, shaft), `${String(percent)}% opacity`).toBeLessThan(3);
    }
  });

  it.each(THEMES)("keeps the longest-waiting passenger readable, %s theme", (_, palette) => {
    // The same shaft/car split as the plain passenger above, for the marked
    // one: --ds-accent on the shaft (the mockup's own choice for this exact
    // state, `.person.is-waiting-long`), --ds-car-attention -- fixed, like
    // every other car-body colour -- once boarded.
    expect(
      contrast(themed(palette, "ds-accent"), themed(palette, "ds-shaft")),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(token("ds-car-attention"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});
