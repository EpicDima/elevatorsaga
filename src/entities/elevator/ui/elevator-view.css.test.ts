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
 * How the floor number on the car's top strip is set: the colour it is painted
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
 * @returns The size in px, the weight, and the colour.
 */
function carNumber(): { size: number; weight: string; colour: string } {
  const selector = ".car-floor";
  const body = ruleBody(selector);
  expect(
    body,
    `an opacity on ${selector} would dim the number below what its colour says`,
  ).not.toMatch(/^\s*opacity:/m);
  return {
    size: Number.parseFloat(declaration(body, "font-size", selector)),
    // Unset is the initial value, and the initial value is not bold. Optional
    // because the number is ordinary text now and says nothing about weight;
    // reading it as `normal` is what lets the bar below be worked out anyway.
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    colour: declaration(body, "color", selector),
  };
}

describe("the order marks along the shaft", () => {
  it.each(THEMES)(
    "keeps an unlit order mark findable on the shaft's own strip, %s theme",
    (_, palette) => {
      // The floors a car has been asked for used to be a grid of green digits
      // inside the cabin; they are marks along the shaft now. An unlit one is
      // still a <button> -- clickable, tabbable and named -- so it is a control
      // that has to be findable, not the unfilled half of a progress track that
      // 1.4.11 would let off. The mockup paints it --shaft-line, which is the
      // colour of the wall it is drawn on; --ds-text-muted is the same
      // substitution the floor number and the call lamps already make.
      expect(declaration(ruleBody(".mark"), "background", ".mark")).toBe(token("ds-text-muted"));
      expect(
        contrast(themed(palette, "ds-text-muted"), orderStrip(palette)),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(THEMES)(
    "keeps a lit order mark apart from the strip it sits on, %s theme",
    (_, palette) => {
      // The mockup lights a mark with its plain --accent, which lands at 2.52:1
      // on this composite in the light theme: the strip is two black washes
      // darker than the --ds-shaft the accent family is tuned against.
      // --ds-accent-hi is the same colour one step along, and it is what the
      // mockup lights the car's own arrows with.
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
      // The marking that never lights up. It was 15px in 30% white for
      // twelve years -- 1.63:1 -- and the repair is a colour fixed across both
      // themes rather than a themed one: the strip stays a dark surface in both
      // (a black wash over --ds-car, which is already dark in the light theme),
      // so one near-white value clears 4.5:1 in either without needing a
      // light-theme override.
      const number = carNumber();
      expect(number.colour).toBe(token("ds-car-ink"));
      expect(contrast(number.colour, carTop(palette))).toBeGreaterThanOrEqual(
        requiredRatio(number.size, number.weight),
      );
    },
  );

  it.each(THEMES)(
    "keeps a lit boarding lamp readable on the car's top strip, %s theme",
    (_, palette) => {
      // Not decoration: goingUpIndicator/goingDownIndicator are what decide who
      // may board. The mockup lights the arrow with its own themed accent-hi,
      // which is 1.35:1 on --ds-car in the light theme -- drawn on the car, it
      // needs the same fixed ink the floor number above uses.
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
      // before either one of them means something. The mockup's 22% white is
      // about 1.5:1 on this composite, so the alpha is raised until the arrow
      // clears 1.4.11's 3:1 -- still visibly dimmer than the lit one beside it,
      // which is 9.5:1 on the same strip.
      const unlit = declaration(ruleBody(".car-dir"), "color", ".car-dir");
      expect(unlit, ".car-dir no longer states its own translucent ink").toMatch(
        /^rgb\(.*\/\s*[\d.]+%\s*\)$/,
      );
      expect(contrast(over(unlit, carTop(palette)), carTop(palette))).toBeGreaterThanOrEqual(3);
    },
  );
});
