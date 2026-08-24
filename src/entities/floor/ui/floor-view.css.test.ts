/**
 * The markings a floor puts in the building's left-hand column, measured
 * against what that column actually paints.
 *
 * None of them is read against a token: `.levels` is translucent over the
 * building's shaft, so the surface is a composite -- `levelsColumn` in
 * `#shared/styles/test-helpers.ts` is where it is worked out, and why it lives
 * there rather than here.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  levelsColumn,
  over,
  requiredRatio,
  ruleBody,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

/**
 * How one of this column's rules sets type: the color, and the size and weight
 * that decide which bar 1.4.3 holds the pair to.
 *
 * Every size here is a `clamp()`, since a floor is not always the same height.
 * The largest length in it is the one that matters: the bar steps *down* at
 * 24px, so a rule that can be drawn small has to clear the small-text bar.
 *
 * @param selector - The rule to read, exactly as the stylesheet spells it.
 * @returns The size in px, the weight, and the color.
 */
function textIn(selector: string): { size: number; weight: string; color: string } {
  const body = ruleBody(selector);
  const lengths = [...declaration(body, "font-size", selector).matchAll(/([\d.]+)px/g)].map(
    ([, px = "0"]) => Number(px),
  );
  expect(lengths.length, `${selector}'s font-size states no length at all`).toBeGreaterThan(0);
  return {
    size: Math.max(...lengths),
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    color: declaration(body, "color", selector),
  };
}

describe("the floor column", () => {
  it.each(THEMES)(
    "keeps the floor numbers readable in their own column, %s theme",
    (_, palette) => {
      // Not a comparison of two tokens: the column is a translucent --ds-panel
      // over --ds-shaft, so what the number sits on is a composite, per theme.
      //
      // A call lamp says what it has to say by lighting up; a floor number is
      // read in its resting state -- the accent below comes and goes with a
      // pointer -- and at 17px or less the bar it has to clear is 1.4.3's full
      // 4.5:1 rather than the 3:1 large text is let off with. That is why the
      // color is read from the rule as well: --ds-text-faint reaches only
      // 3.77:1 dark and 2.83:1 light here, and a slip back to it would still
      // pass an arithmetic check that measured --ds-text-muted by name.
      const number = textIn(".level-num");
      expect(number.color).toBe(token("ds-text-muted"));
      expect(
        contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
      ).toBeGreaterThanOrEqual(requiredRatio(number.size, number.weight));
    },
  );

  it.each(THEMES)(
    "keeps the marked floor's number readable in its own column, %s theme",
    (_, palette) => {
      // The number is still a number while it is marked, so the mark answers to
      // the same bar the resting ink does rather than to 1.4.11's 3:1 for an
      // indicator: it is not a lamp beside the text, it is the text. Which is
      // why it is the "hi" step and not the plain accent the band across the
      // building is washed in -- that one reaches only 4.11:1 on this column in
      // the light theme.
      const selector = ".floor.is-hot .level-num";
      const number = textIn(".level-num");
      expect(declaration(ruleBody(selector), "color", selector)).toBe(token("ds-accent-hi"));
      expect(
        contrast(themed(palette, "ds-accent-hi"), levelsColumn(palette)),
      ).toBeGreaterThanOrEqual(requiredRatio(number.size, number.weight));
    },
  );

  it.each(THEMES)("keeps an unlit call lamp visible in its own column, %s theme", (_, palette) => {
    // The arrow is the whole of what says a control is there when the lamp is
    // off: the border around it is --ds-line-strong, 1.55:1 dark and 1.43:1
    // light on this column, so it carries none of that load. 1.4.11's 3:1 for a
    // graphical object therefore has to be cleared by the glyph alone, which is
    // the second reason .call is --ds-text-muted rather than the faint step
    // (2.83:1 light).
    expect(declaration(ruleBody(".call"), "color", ".call")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(THEMES)(
    "keeps a lit floor call lamp readable on its own badge, %s theme",
    (_, palette) => {
      // Unlike the car, the floor column flips light/dark with the theme, so the
      // themed accent that fails on the car (`entities/elevator`) is exactly
      // what belongs here.
      // Two composites deep: the lamp lights its own --ds-accent-soft badge,
      // which is itself translucent, over a column that is translucent over the
      // shaft -- so neither the badge nor the column is a token this can look up.
      const badge = over(themed(palette, "ds-accent-soft"), levelsColumn(palette));
      expect(contrast(themed(palette, "ds-accent"), badge)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps an unanswered destination chip readable in its own column, %s theme",
    (_, palette) => {
      // A chip is a floor number, so 1.4.3's 4.5:1 applies to it and not the
      // 3:1 the lamp beside it is let off with -- which is exactly what rules
      // out the lit lamp's badge here: --ds-accent over --ds-accent-soft over
      // this column reaches 3.58:1 in the light theme. The chip carries no fill
      // and lights in the "hi" step instead, the one a marked floor number
      // already proves at these sizes.
      const chip = textIn(".dest");
      expect(chip.color).toBe(token("ds-accent-hi"));
      expect(
        contrast(themed(palette, "ds-accent-hi"), levelsColumn(palette)),
      ).toBeGreaterThanOrEqual(requiredRatio(chip.size, chip.weight));
    },
  );

  it.each(THEMES)(
    "keeps an answered destination chip and its tally readable, %s theme",
    (_, palette) => {
      // The two quiet inks in this column: a chip whose car is booked, and the
      // count of people hanging off a chip of either kind. Both are numbers at
      // the chip's own size, so both answer to the same bar the lit chip does.
      const chip = textIn(".dest");
      expect(declaration(ruleBody(".dest.is-booked"), "color", ".dest.is-booked")).toBe(
        token("ds-text-muted"),
      );
      expect(declaration(ruleBody(".dest.is-more"), "color", ".dest.is-more")).toBe(
        token("ds-text-muted"),
      );
      expect(declaration(ruleBody(".dest-count"), "color", ".dest-count")).toBe(
        token("ds-text-muted"),
      );
      expect(
        contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
      ).toBeGreaterThanOrEqual(requiredRatio(chip.size, chip.weight));
    },
  );

  it("lays a destination panel out in rows, where a call panel is a column", () => {
    // `.destinations` is a `.calls` as well, and `.calls` is a flex column: no
    // `row` here and four chips stand four rows deep in a row with height for
    // two. Wrapping is what makes the second row exist at all -- without it the
    // four share one row and the clip below cuts half of them away, so a floor
    // with four journeys quietly draws two.
    //
    // `flex: 1` and not the shrink-to-fit a `.calls` gets: the panel takes the
    // whole of what the floor number leaves, so its half is the same half on
    // every floor and the chips stand in two columns down the building instead
    // of sliding about with how much each floor happens to be asking for.
    //
    // `overflow: hidden` is the backstop under all of it: a chip too wide for
    // its half is clipped at the panel's edge rather than pushing its neighbor
    // onto a row of its own.
    const body = ruleBody(".destinations");
    expect(declaration(body, "flex", ".destinations")).toBe("1");
    expect(declaration(body, "flex-direction", ".destinations")).toBe("row");
    expect(declaration(body, "flex-wrap", ".destinations")).toBe("wrap");
    expect(declaration(body, "overflow", ".destinations")).toBe("hidden");
  });

  it("pairs a destination chip's width with the gap between two of them", () => {
    // Two chips and the gap between them come to exactly the panel's width,
    // which is what puts the third chip on a row of its own rather than the
    // second. The two numbers are stated in two rules and are one design, so
    // they are read back as one: a gap widened on its own leaves the pair too
    // wide for the row, and a full panel goes four rows deep in a floor with
    // room for two.
    const gap = /^([\d.]+)px$/.exec(declaration(ruleBody(".destinations"), "gap", ".destinations"));
    expect(gap, ".destinations no longer states its gap in px").not.toBeNull();
    const basis = /^0 0 calc\((\d+)% - ([\d.]+)px\)$/.exec(
      declaration(ruleBody(".dest"), "flex", ".dest"),
    );
    expect(basis, ".dest is no longer a fixed fraction of the panel less an inset").not.toBeNull();
    expect(Number(basis?.[1])).toBe(50);
    expect(Number(basis?.[2]) * 2).toBe(Number(gap?.[1]));
  });

  it("holds a destination panel to two rows whatever is standing on the floor", () => {
    // The panel is as tall as the floor and no taller, and `entities/floor`
    // draws at most four chips into it: two rows of two. What makes that
    // arithmetic hold is here rather than there. A chip is a fixed half of the
    // panel instead of as wide as its contents, and the automatic minimum that
    // would hand the width back to those contents -- a flex item's is its own
    // max-content -- is turned off. Without the second line a wide chip wraps
    // its neighbor onto a row of its own and four chips stand four rows deep,
    // which the shortest floor of a tall building has no room for.
    const body = ruleBody(".dest");
    expect(declaration(body, "flex", ".dest")).toBe("0 0 calc(50% - 1.5px)");
    expect(declaration(body, "min-inline-size", ".dest")).toBe("0");
  });

  it("never dims a destination chip's tally with opacity", () => {
    // The tally is quieter than the floor number it hangs off, and the ink is
    // the only way it is allowed to be: going translucent would take a number
    // that just cleared 4.5:1 back under it, and the arithmetic above would not
    // notice.
    expect(ruleBody(".dest-count")).not.toMatch(/opacity/);
  });
});
