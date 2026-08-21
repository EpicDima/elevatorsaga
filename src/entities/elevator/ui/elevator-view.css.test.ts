/**
 * Everything a car says about itself, measured against the two dark surfaces it
 * says it on: the marks along the shaft, and the strip across the top of the
 * cabin.
 *
 * Neither surface is a token — both are washes over washes — so both are worked
 * out by `orderStrip` and `carTop` in `#shared/styles/test-helpers.ts`.
 */

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
 * How the floor number on the car's top strip is set: the color it is painted
 * in and the size and weight that decide which bar 1.4.3 holds that pair to.
 *
 * The background is not read here: it is a composite that differs per theme,
 * so a caller wanting both themes reads `carTop` instead.
 *
 * The size is the full-density one. `.building:not([data-density="full"])`
 * drops it to 9.5px on squeezed floors, which is smaller and therefore held to
 * the same 4.5:1 -- the bar only ever steps down at 24px, so measuring the
 * larger of the two is measuring the easier case of the same requirement.
 *
 * @returns The size in px, the weight, and the color.
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
    // Unset is the initial value, and the initial value is not bold. Optional
    // because the number is ordinary text now and says nothing about weight;
    // reading it as `normal` is what lets the bar below be worked out anyway.
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    color: declaration(body, "color", selector),
  };
}

describe("the order marks along the shaft", () => {
  it.each(THEMES)(
    "keeps an unlit order mark findable on the shaft's own strip, %s theme",
    (_, palette) => {
      // An unlit mark is still a <button> -- clickable, tabbable and named --
      // so it is a control that has to be findable, not the unfilled half of a
      // progress track that 1.4.11 would let off. Hence --ds-text-muted rather
      // than the wall's own color, which would read as nothing at all.
      expect(declaration(ruleBody(".mark"), "background", ".mark")).toBe(token("ds-text-muted"));
      expect(
        contrast(themed(palette, "ds-text-muted"), orderStrip(palette)),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps a lit order mark apart from the strip it sits on, %s theme",
    (_, palette) => {
      // Plain --accent lands at 2.52:1 on this composite in the light theme:
      // the strip is two black washes darker than the --ds-shaft the accent
      // family is tuned against. --ds-accent-hi is the same color one step
      // along, and it is what the car's own arrows light up in.
      expect(declaration(ruleBody(".mark.is-lit"), "background", ".mark.is-lit")).toBe(
        token("ds-accent-hi"),
      );
      expect(contrast(themed(palette, "ds-accent-hi"), orderStrip(palette))).toBeGreaterThanOrEqual(
        3,
      );
    },
  );
});

describe("the car's top strip", () => {
  it.each(THEMES)(
    "keeps the floor a car is at readable on its top strip, %s theme",
    (_, palette) => {
      // The marking that never lights up, in a color fixed across both themes
      // rather than a themed one: the strip stays a dark surface in both (a
      // black wash over --ds-car, which is already dark in the light theme), so
      // one near-white value clears 4.5:1 in either without needing a
      // light-theme override.
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
      // Not decoration: goingUpIndicator/goingDownIndicator are what decide who
      // may board. The themed accent-hi is 1.35:1 on --ds-car in the light
      // theme, so a lamp drawn on the car needs the same fixed ink the floor
      // number above uses.
      expect(declaration(ruleBody(".car-dir.is-on"), "color", ".car-dir.is-on")).toBe(
        token("ds-car-ink"),
      );
      expect(contrast(token("ds-car-ink"), carTop(palette))).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps an unlit boarding lamp visible on the car's top strip, %s theme",
    (_, palette) => {
      // An indicator that cannot be found in its off state does not indicate
      // anything: a player reading a car has to see that there are two lamps
      // before either one of them means something. So the alpha is set where
      // the arrow clears 1.4.11's 3:1 -- still visibly dimmer than the lit one
      // beside it, which is 9.5:1 on the same strip.
      const unlit = declaration(ruleBody(".car-dir"), "color", ".car-dir");
      expect(unlit, ".car-dir no longer states its own translucent ink").toMatch(
        /^rgb\(.*\/\s*[\d.]+%\s*\)$/,
      );
      expect(contrast(over(unlit, carTop(palette)), carTop(palette))).toBeGreaterThanOrEqual(3);
    },
  );
});
