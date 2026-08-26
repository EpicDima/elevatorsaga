/** Checks floor-column text and lamp colors against the column's actual translucent background, not a flat token. */

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

/** Reads a rule's font-size (largest value in its clamp()), weight, and color. */
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
      // Resting number text needs 1.4.3's 4.5:1, not the 3:1 large text gets,
      // and --ds-text-faint would fail it here even though the arithmetic below
      // wouldn't catch a slip back to it without checking the token by name.
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
      // Still text while marked, so it answers to 4.5:1, not 1.4.11's 3:1 for
      // indicators; the plain accent wash reaches only 4.11:1 on this column.
      const selector = ".floor.is-hot .level-num";
      const number = textIn(".level-num");
      expect(declaration(ruleBody(selector), "color", selector)).toBe(token("ds-accent-hi"));
      expect(
        contrast(themed(palette, "ds-accent-hi"), levelsColumn(palette)),
      ).toBeGreaterThanOrEqual(requiredRatio(number.size, number.weight));
    },
  );

  it.each(THEMES)("keeps an unlit call lamp visible in its own column, %s theme", (_, palette) => {
    // The border carries no contrast (1.43:1 light), so the glyph alone must
    // clear 1.4.11's 3:1 for a graphical object.
    expect(declaration(ruleBody(".call"), "color", ".call")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(THEMES)(
    "keeps a lit floor call lamp readable on its own badge, %s theme",
    (_, palette) => {
      // Two composites deep: the accent-soft badge is translucent over a column
      // that is itself translucent over the shaft.
      const badge = over(themed(palette, "ds-accent-soft"), levelsColumn(palette));
      expect(contrast(themed(palette, "ds-accent"), badge)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps an unanswered destination chip readable in its own column, %s theme",
    (_, palette) => {
      // A chip is text (4.5:1), unlike the 3:1 lamp beside it; the lit lamp's
      // own badge treatment reaches only 3.58:1 in the light theme here.
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
      // Booked chip and its passenger tally are both numbers at chip size, so
      // both answer to the same bar as the lit chip.
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
    // Wrapping lets four chips form two rows instead of clipping; flex: 1 keeps
    // each floor's half the same width instead of shrinking to fit its content.
    const body = ruleBody(".destinations");
    expect(declaration(body, "flex", ".destinations")).toBe("1");
    expect(declaration(body, "flex-direction", ".destinations")).toBe("row");
    expect(declaration(body, "flex-wrap", ".destinations")).toBe("wrap");
    expect(declaration(body, "overflow", ".destinations")).toBe("hidden");
  });

  it("pairs a destination chip's width with the gap between two of them", () => {
    // Two chips plus the gap between them exactly fill the panel width, which
    // is what forces a third chip onto its own row.
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
    // A chip is a fixed half of the panel rather than sized to its content, and
    // min-inline-size overrides a flex item's default max-content minimum;
    // without it a wide chip wraps its neighbor onto a row of its own.
    const body = ruleBody(".dest");
    expect(declaration(body, "flex", ".dest")).toBe("0 0 calc(50% - 1.5px)");
    expect(declaration(body, "min-inline-size", ".dest")).toBe("0");
  });

  it("never dims a destination chip's tally with opacity", () => {
    // Opacity would drop the tally below the 4.5:1 just verified above, without
    // the arithmetic there noticing.
    expect(ruleBody(".dest-count")).not.toMatch(/opacity/);
  });
});
