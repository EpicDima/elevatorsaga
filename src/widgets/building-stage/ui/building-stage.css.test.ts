/**
 * The stage's own jobs, none of which any slice inside it can do for itself: it
 * recolors the focus ring for everything focusable in the building, it stacks
 * the four layers the corridor and the shafts are drawn on, it paints the one
 * flat panel down there, and it is the box the run's verdict card is positioned
 * against and clipped by.
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
    // .world redeclares --ds-focus to --ds-accent-hi, and everything focusable
    // in the building inherits it -- checked directly against the token values,
    // the way the lit call lamp is, since .world does not redeclare
    // --ds-accent-hi itself for themed() to follow its own override through.
    // Three surfaces carry a ring: --ds-shaft is the shafts a car is focused
    // in, --ds-bg is the stage itself once it has something to scroll, and the
    // floor-number column is where a focused floor row's ring is drawn.
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
    // The only thing that widens the column, and `entities/floor` sizes a
    // journey chip to half of whatever it is given -- so at the width two
    // stacked lamps need, the widest chip a twenty-floor building can produce
    // is clipped at the panel's edge instead of drawn.
    const width = (selector: string): number => {
      const stated = declaration(ruleBody(selector), "inline-size", selector);
      const px = /^([\d.]+)px$/.exec(stated);
      expect(px, `${selector} no longer states its width in px`).not.toBeNull();
      return Number(px?.[1]);
    };
    expect(width(".levels.has-destinations")).toBeGreaterThan(width(".levels"));
  });

  it("leaves the shortest floor room for two rows of journey chips", () => {
    // The other half of the same bargain, and the half only this side can
    // check. `entities/floor` draws at most four chips because a full panel is
    // two rows of two, and how short a row gets is decided here: a chip is a
    // fraction of the floor's own height, clamped at both ends, and two of them
    // plus the gap between the rows have to fit the shortest floor a building
    // is ever squeezed to.
    const chip = /^clamp\(([\d.]+)px,[^,]+,\s*([\d.]+)px\)$/.exec(
      declaration(ruleBody(".dest"), "block-size", ".dest"),
    );
    expect(chip, ".dest no longer clamps its height between two lengths in px").not.toBeNull();
    const gap = /^([\d.]+)px$/.exec(declaration(ruleBody(".destinations"), "gap", ".destinations"));
    expect(gap, ".destinations no longer states its gap in px").not.toBeNull();
    // Whatever the clamp resolves to lies between its two ends, so both ends
    // answer for it.
    for (const bound of [chip?.[1], chip?.[2]]) {
      expect(2 * Number(bound) + Number(gap?.[1])).toBeLessThanOrEqual(MIN_FLOOR);
    }
  });
});

describe("the four layers over the tracks", () => {
  it("lets a pointer through to the corridor under the shafts", () => {
    // All four are `inset: 0` over the same box, so each upper layer covers
    // every floor's walkway as well as the thing it was drawn for. Opaque, the
    // shafts layer took every hover along every corridor and a floor card could
    // not be raised by pointing at one at all. The layer is inert; what stands
    // in it is not.
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
    // Same property on the same element as the two zebra rules, so the dark one
    // is decided by source order and the light one -- (0,3,1) against a bare
    // (0,2,0) -- by specificity. Stated before them, or stated once unqualified,
    // every other floor in the light theme keeps its 2% gray and the mark lights
    // half a building.
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
    // The card is the one thing in the building painted on a flat --ds-panel
    // rather than on the shaft, and its body is prose at 12px, so both inks
    // answer to 1.4.3's 4.5:1 rather than the 3:1 everything else down here
    // gets. Read from the rules: the title and the lines are two different
    // tokens on purpose, and a port that collapsed them would still pass an
    // arithmetic check that only looked tokens up by name.
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
    // `.feedbackcontainer` (`widgets/verdict-toast`) is positioned against
    // `.worldtrack`, and the card it holds is the one thing on the stage with a
    // size of its own rather than the pane's -- floored at 420px wide, with a
    // 30px-blur shadow past that -- so with `overflow: visible` a narrow enough
    // pane hands the page scrollbars that lead nowhere at the end of every run.
    // Both halves are asserted because either one alone is useless: an
    // unclipped positioning context overflows, and a clip with no positioning
    // context is not what the card is measured from.
    const body = ruleBody(".worldtrack");
    expect(declaration(body, "position", ".worldtrack")).toBe("relative");
    expect(body).toMatch(/^\s*overflow:\s*hidden;/m);
  });
});
