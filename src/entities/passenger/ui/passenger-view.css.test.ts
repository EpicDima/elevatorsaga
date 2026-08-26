/** A passenger is a graphical object, so 1.4.11's 3:1 is the bar throughout, checked against both surfaces of a trip. */

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
      // Waiting or walking, reads against --ds-shaft (themed); boarded,
      // .is-rider switches to a fixed color tuned against --ds-car instead.
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

  it("leaves a delivered passenger's color alone, because no fade would clear 3:1", () => {
    // --ds-person has only 3.52:1 of room over the light theme's shaft, so any
    // fade at all would drop below 1.4.11's 3:1.
    expect(styleSource).not.toMatch(/^\.person\.is-leaving\s*\{/m);
    const shaft = themed(LIGHT_PALETTE, "ds-shaft");
    for (const percent of [50, 62, 85]) {
      const faded = over(withAlpha(themed(LIGHT_PALETTE, "ds-person"), percent), shaft);
      expect(contrast(faded, shaft), `${String(percent)}% opacity`).toBeLessThan(3);
    }
  });

  it.each(THEMES)("keeps the longest-waiting passenger readable, %s theme", (_, palette) => {
    // Same shaft/car split as the plain passenger: --ds-accent on the shaft,
    // --ds-car-attention (fixed) once boarded.
    expect(
      contrast(themed(palette, "ds-accent"), themed(palette, "ds-shaft")),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(token("ds-car-attention"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});
