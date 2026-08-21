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
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

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
