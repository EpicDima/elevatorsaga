/** Checks car text and lamp colors against the shaft's order strip and the cabin's top strip, both composited washes rather than tokens. */

import { describe, expect, it } from "vitest";

import {
  carTop,
  contrast,
  declaration,
  orderStrip,
  over,
  requiredRatio,
  ruleBody,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

/**
 * Reads the car's top-strip floor number: its color, size, and weight.
 * Measures the full-density size; the squeezed 9.5px is smaller but held to
 * the same bar, so the full-density size is the harder case.
 */
function carNumber(): { size: number; weight: string; color: string } {
  const selector = ".car-floor";
  const body = ruleBody(selector);
  expect(
    body,
    `an opacity on ${selector} would dim the number below what its color says`,
  ).not.toMatch(/^\s*opacity:/m);
  return {
    size: Number.parseFloat(declaration(body, "font-size", selector)),
    // Unset font-weight is not bold; read it as "normal" for the bar below.
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    color: declaration(body, "color", selector),
  };
}

describe("the order marks along the shaft", () => {
  it.each(THEMES)(
    "keeps an unlit order mark findable on the shaft's own strip, %s theme",
    (_, palette) => {
      // An unlit mark is still a clickable, tabbable button, so it must be
      // findable, not let off as an unfilled progress track under 1.4.11.
      expect(declaration(ruleBody(".mark::before"), "background", ".mark::before")).toBe(
        token("ds-text-muted"),
      );
      expect(
        contrast(themed(palette, "ds-text-muted"), orderStrip(palette)),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps a lit order mark apart from the strip it sits on, %s theme",
    (_, palette) => {
      // Plain --ds-accent lands at only 2.52:1 here, since the strip is two
      // black washes darker than the --ds-shaft the accent family is tuned
      // against; --ds-accent-hi is the step that clears it.
      expect(
        declaration(ruleBody(".mark.is-lit::before"), "background", ".mark.is-lit::before"),
      ).toBe(token("ds-accent-hi"));
      expect(contrast(themed(palette, "ds-accent-hi"), orderStrip(palette))).toBeGreaterThanOrEqual(
        3,
      );
    },
  );

  it("gives the button a target 24px tall, whatever size the tick is drawn", () => {
    // WCAG 2.5.8. The 3px tick marks which floor; the 24px button around it is
    // the actual pointer target, sized to fit within a floor's minimum height.
    expect(declaration(ruleBody(".mark"), "block-size", ".mark")).toBe("24px");
    expect(declaration(ruleBody(".mark::before"), "block-size", ".mark::before")).toBe("3px");
    // The button carries no color of its own; the tick draws it.
    expect(declaration(ruleBody(".mark"), "background", ".mark")).toBe("none");
  });
});

describe("the car's top strip", () => {
  it.each(THEMES)(
    "keeps the floor a car is at readable on its top strip, %s theme",
    (_, palette) => {
      // Fixed ink, not a themed one: the strip stays dark in both themes (a
      // black wash over --ds-car), so one near-white value clears 4.5:1 in either.
      const number = carNumber();
      expect(number.color).toBe(token("ds-car-ink"));
      expect(contrast(number.color, carTop(palette))).toBeGreaterThanOrEqual(
        requiredRatio(number.size, number.weight),
      );
    },
  );

  it.each(THEMES)(
    "keeps a lit boarding lamp readable on the car's top strip, %s theme",
    (_, palette) => {
      // Not decoration: this lamp decides who may board. The themed accent-hi
      // reaches only 1.35:1 on --ds-car in the light theme, so it needs the
      // same fixed ink as the floor number above.
      expect(declaration(ruleBody(".car-dir.is-on"), "color", ".car-dir.is-on")).toBe(
        token("ds-car-ink"),
      );
      expect(contrast(token("ds-car-ink"), carTop(palette))).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps an unlit boarding lamp visible on the car's top strip, %s theme",
    (_, palette) => {
      // An indicator invisible in its off state indicates nothing, so its alpha
      // is set to still clear 1.4.11's 3:1 while staying dimmer than the lit lamp.
      const unlit = declaration(ruleBody(".car-dir"), "color", ".car-dir");
      expect(unlit, ".car-dir no longer states its own translucent ink").toMatch(
        /^rgb\(.*\/\s*[\d.]+%\s*\)$/,
      );
      expect(contrast(over(unlit, carTop(palette)), carTop(palette))).toBeGreaterThanOrEqual(3);
    },
  );
});
