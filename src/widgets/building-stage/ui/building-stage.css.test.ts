/**
 * Tests the stage's own CSS jobs: recoloring the focus ring for everything focusable in the
 * building, stacking the four layers the corridor and shafts are drawn on, and clipping the
 * box the run's verdict card is positioned against.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  levelsColumn,
  paletteIn,
  ruleBody,
  styleSource,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

import { MIN_FLOOR } from "../lib/layout-building.ts";

describe("the building's own focus ring", () => {
  it.each(THEMES)("keeps the focus ring readable inside .world, %s theme", (_, palette) => {
    // .world redeclares --ds-focus, so everything focusable inherits it; checked against token
    // values directly since .world doesn't redeclare --ds-accent-hi for themed() to follow.
    // Three surfaces carry the ring: the shafts, the scrolled stage, and the floor-number column.
    expect(paletteIn(".world").get("ds-focus")).toBe("var(--ds-accent-hi)");
    for (const surface of [
      themed(palette, "ds-shaft"),
      themed(palette, "ds-bg"),
      levelsColumn(palette),
    ]) {
      expect(contrast(themed(palette, "ds-accent-hi"), surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the floor-number column", () => {
  it("gives a destination-dispatch building's floors more room than two call lamps need", () => {
    // A journey chip is sized to half the column's width, so at the width two stacked call
    // lamps need, the widest chip would be clipped at the panel's edge instead of drawn.
    const width = (selector: string): number => {
      const stated = declaration(ruleBody(selector), "inline-size", selector);
      const px = /^([\d.]+)px$/.exec(stated);
      expect(px, `${selector} no longer states its width in px`).not.toBeNull();
      return Number(px?.[1]);
    };
    expect(width(".levels.has-destinations")).toBeGreaterThan(width(".levels"));
  });

  it("leaves the shortest floor room for two rows of journey chips", () => {
    // A full panel is two rows of two chips, so two chip heights plus the row gap must fit
    // the shortest floor a building is ever squeezed to (MIN_FLOOR).
    const chip = /^clamp\(([\d.]+)px,[^,]+,\s*([\d.]+)px\)$/.exec(
      declaration(ruleBody(".dest"), "block-size", ".dest"),
    );
    expect(chip, ".dest no longer clamps its height between two lengths in px").not.toBeNull();
    const gap = /^([\d.]+)px$/.exec(declaration(ruleBody(".destinations"), "gap", ".destinations"));
    expect(gap, ".destinations no longer states its gap in px").not.toBeNull();
    // Whatever the clamp resolves to lies between its two ends, so both ends answer for it.
    for (const bound of [chip?.[1], chip?.[2]]) {
      expect(2 * Number(bound) + Number(gap?.[1])).toBeLessThanOrEqual(MIN_FLOOR);
    }
  });
});

describe("the four layers over the tracks", () => {
  it("lets a pointer through to the corridor under the shafts", () => {
    // All four layers are `inset: 0` over the same box; an opaque shafts layer would take
    // every hover along the corridor, so a floor card could never be raised.
    expect(declaration(ruleBody(".shafts"), "pointer-events", ".shafts")).toBe("none");
    expect(declaration(ruleBody(".shafts > .shaft"), "pointer-events", ".shafts > .shaft")).toBe(
      "auto",
    );
  });

  it("washes the marked floor's band over the zebra beneath it in both themes", () => {
    const selector = '.floorline.is-hot,\nhtml[data-theme="light"] .floorline.is-hot';
    expect(ruleBody(selector)).toMatch(
      /^\s*background:\s*color-mix\(in srgb, var\(--ds-accent\) \d+%, transparent\);/m,
    );
    // Same property as the two zebra rules: the dark theme wins by source order, the light
    // theme by specificity (0,3,1) beating (0,2,0). Get either wrong and the mark disappears
    // into the zebra stripe on half the floors.
    for (const zebra of [
      ".floorline:nth-child(odd)",
      'html[data-theme="light"] .floorline:nth-child(odd)',
    ]) {
      expect(ruleBody(zebra)).toContain("background:");
      expect(styleSource.indexOf(selector)).toBeGreaterThan(styleSource.indexOf(zebra));
    }
  });
});

describe("the car's hover card", () => {
  it.each(THEMES)("keeps the hover card's own two inks readable on it, %s theme", (_, palette) => {
    // The card is painted on a flat --ds-panel with 12px prose, so both inks answer to WCAG
    // 1.4.3's 4.5:1 text contrast rather than the 3:1 everything else in the building gets.
    expect(declaration(ruleBody(".carcard"), "background", ".carcard")).toBe(token("ds-panel"));
    expect(declaration(ruleBody(".carcard"), "color", ".carcard")).toBe(token("ds-text"));
    expect(declaration(ruleBody(".carcard-lines"), "color", ".carcard-lines")).toBe(
      token("ds-text-muted"),
    );
    for (const ink of ["ds-text", "ds-text-muted"]) {
      expect(contrast(themed(palette, ink), themed(palette, "ds-panel"))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("the track the verdict card stands in", () => {
  it("keeps the clip the run verdict is drawn inside", () => {
    // The run's verdict card is floored at 420px wide with a 30px-blur shadow, so without this
    // clip a narrow pane would open page scrollbars that lead nowhere. Both properties are
    // asserted since a clip with no positioning context isn't what the card measures from.
    const body = ruleBody(".worldtrack");
    expect(declaration(body, "position", ".worldtrack")).toBe("relative");
    expect(body).toMatch(/^\s*overflow:\s*hidden;/m);
  });
});
