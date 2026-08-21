/**
 * The three markings a floor puts in the building's left-hand column, measured
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
 * How a floor's number is set: the color, and the size and weight that decide
 * which bar 1.4.3 holds the pair to.
 *
 * The size is a `clamp()`, since a floor is not always the same height. The
 * largest length in it is the one that matters: the bar steps *down* at 24px,
 * so a rule that can be drawn small has to clear the small-text bar.
 *
 * @returns The size in px, the weight, and the color.
 */
function levelNumber(): { size: number; weight: string; color: string } {
  const selector = ".level-num";
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
      const number = levelNumber();
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
      const number = levelNumber();
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
});
