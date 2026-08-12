/**
 * Contrast of the palette in `style.css`.
 *
 * The stylesheet states every colour once, as a custom property, which is what
 * makes this checkable without a browser: the pairs that actually meet on
 * screen are few and known, so the WCAG 1.4.3 ratio for each of them is
 * arithmetic over the token values. A browser sweep over the built pages is
 * what found these pairs in the first place; this is what keeps someone from
 * quietly reverting one of them.
 *
 * What it deliberately does not do is discover pairs. If a new rule puts text
 * on a background nobody listed here, this file will not notice — re-measure in
 * a browser when the layout changes, and add the pair.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The stylesheet, as text.
 *
 * Read from disk rather than imported: Vitest does not process CSS, and hands
 * back an empty string for `style.css?raw` as readily as for `style.css`.
 */
const styleSource = readFileSync(new URL("./style.css", import.meta.url), "utf8");

/** The custom properties declared on `:root`, by name without the `--`. */
const PALETTE: ReadonlyMap<string, string> = new Map(
  [...styleSource.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name = "", value = ""]) => [
    name,
    value.trim(),
  ]),
);

/**
 * Relative luminance of an sRGB colour, per WCAG 2.
 *
 * @param hex - A `#rgb` or `#rrggbb` colour.
 * @returns Its relative luminance, 0 to 1.
 */
function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const [red = 0, green = 0, blue = 0] = (expanded.match(/../g) ?? [])
    .map((pair) => parseInt(pair, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Contrast ratio between two colours, per WCAG 2.
 *
 * @param one - One colour.
 * @param other - The other.
 * @returns The ratio, 1 to 21.
 */
function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Looks a palette token up.
 *
 * @param name - Its name, without the leading `--`.
 * @returns Its value.
 */
function token(name: string): string {
  const value = PALETTE.get(name);
  expect(value, `--${name} is missing from style.css`).toBeDefined();
  return value ?? "";
}

/**
 * Paints a translucent colour over an opaque one, the way the browser does.
 *
 * Source-over compositing in sRGB, channel by channel, which is what a
 * `rgb(... / n%)` foreground on an opaque background comes to. WCAG asks for
 * the ratio between what is on screen, and what is on screen here is the
 * result of this, not the value in the declaration.
 *
 * @param foreground - `rgb(r g b / n%)`, the translucent colour.
 * @param background - A `#rgb` or `#rrggbb` colour to paint it on.
 * @returns The composited colour, as `#rrggbb`.
 */
function over(foreground: string, background: string): string {
  const parsed = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)%\s*\)/.exec(foreground);
  expect(parsed, `${foreground} is not an rgb(r g b / n%) colour`).not.toBeNull();
  const [, red = "0", green = "0", blue = "0", percent = "0"] = parsed ?? [];
  const alpha = Number(percent) / 100;
  const digits = background.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const behind = (expanded.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return `#${[red, green, blue]
    .map((channel, index) =>
      Math.round(Number(channel) * alpha + (behind[index] ?? 0) * (1 - alpha)),
    )
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * The lightest the floor band ever gets, which is the worst a floor number
 * ever has to be read against.
 *
 * Taken from `.floor`'s own gradient rather than written down here: the band is
 * white at four alphas over --color-world, and the darker a foreground gets
 * relative to its background the *lighter* the background has to be for the
 * ratio to be worst -- so the peak stop is the one to measure. Reading it out
 * of the rule means someone raising that 24% has to answer to this file.
 *
 * @returns The composited band colour, as `#rrggbb`.
 */
function lightestFloorBand(): string {
  const rule = /\.floor\s*\{([^}]*)\}/.exec(styleSource);
  expect(rule, ".floor is no longer a rule of its own").not.toBeNull();
  const gradient = /background:\s*linear-gradient\(([\s\S]*?)\);/.exec(rule?.[1] ?? "");
  expect(gradient, ".floor no longer paints a linear-gradient").not.toBeNull();
  const alphas = [...(gradient?.[1] ?? "").matchAll(/rgb\(255 255 255 \/ ([\d.]+)%\)/g)].map(
    ([, percent = "0"]) => Number(percent),
  );
  expect(alphas.length, ".floor's gradient is not white at a list of alphas").toBeGreaterThan(1);
  return over(`rgb(255 255 255 / ${String(Math.max(...alphas))}%)`, token("color-world"));
}

/**
 * Reads one declaration out of a rule body, following the palette one step.
 *
 * @param body - The rule's body, braces excluded.
 * @param property - The property to read.
 * @param selector - The rule's selector, for the failure message.
 * @returns The declared value, with a lone `var(--token)` resolved through the
 * palette.
 */
function declaration(body: string, property: string, selector: string): string {
  const found = new RegExp(`^\\s*${property}:\\s*([^;]+);`, "m").exec(body);
  expect(found, `${selector} no longer sets ${property}`).not.toBeNull();
  const value = (found?.[1] ?? "").trim();
  const variable = /^var\(--([\w-]+)\)$/.exec(value);
  return variable === null ? value : token(variable[1] ?? "");
}

/**
 * How the floor indicator inside a car is set: the colour it is painted in, the
 * colour it is painted on, and the size and weight that decide which bar 1.4.3
 * holds that pair to.
 *
 * All of it read out of the rules rather than written down here, and through
 * the palette wherever a rule names a token. The background especially: a
 * colour compared against a token nobody paints with proves nothing, so this
 * takes what `.elevator` actually says its background is.
 *
 * @returns The size in px, the weight, the colour, and the colour behind it.
 */
function carNumber(): { size: number; weight: string; colour: string; on: string } {
  const selector = ".elevator .floorindicator";
  const rules = [...styleSource.matchAll(/\.elevator \.floorindicator\s*\{([^}]*)\}/g)];
  expect(rules.length, `${selector} is no longer exactly one rule`).toBe(1);
  const body = rules[0]?.[1] ?? "";
  expect(
    body,
    `an opacity on ${selector} would dim the number below what its colour says`,
  ).not.toMatch(/^\s*opacity:/m);
  const car = /^\.elevator \{([^}]*)\}/m.exec(styleSource);
  expect(car, ".elevator is no longer a rule of its own").not.toBeNull();
  return {
    size: Number.parseFloat(declaration(body, "font-size", selector)),
    // Unset is the initial value, and the initial value is not bold. Optional
    // because the number is ordinary text now and says nothing about weight;
    // reading it as `normal` is what lets the bar below be worked out anyway.
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    colour: declaration(body, "color", selector),
    on: declaration(car?.[1] ?? "", "background-color", ".elevator"),
  };
}

/**
 * The ratio WCAG 1.4.3 asks of text set at a given size and weight.
 *
 * Worked out rather than written down at each call, so that a rule which grows
 * into large text is held to the 3:1 that large text is really asked for, and
 * one which shrinks back out of it is held to 4.5:1 again. Large is 24px, or
 * 18.66px when bold -- the pixel equivalents WCAG's own Understanding document
 * gives for 18pt and 14pt.
 *
 * @param size - The font size in px.
 * @param weight - The font weight, as the rule states it.
 * @returns 3 or 4.5.
 */
function requiredRatio(size: number, weight: string): number {
  const bold = ["bold", "bolder", "700", "800", "900"].includes(weight);
  return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
}

describe("palette", () => {
  it("declares every colour it is asked about", () => {
    expect([...PALETTE.keys()].filter((name) => name.startsWith("color-")).length).toBeGreaterThan(
      10,
    );
  });

  // Foreground, background, and the ratio WCAG 1.4.3 asks of that pair: 3 for
  // text at 24px, or 18.66px and bold; 4.5 for everything else. Each pair is
  // one that really occurs -- the emphasis colour appears twice because it sits
  // on the page in the headings, the challenge bar and the help prose, and on
  // the building in the end-of-challenge overlay.
  it.each([
    ["color-text", "color-page", 4.5],
    ["color-text-strong", "color-page", 4.5],
    ["color-link", "color-page", 4.5],
    ["color-emphasis-on-page", "color-page", 4.5],
    ["color-emphasis", "color-world", 4.5],
    ["color-stats", "color-world", 4.5],
    ["color-text-strong", "color-control", 4.5],
    ["color-code-text", "color-code-page", 4.5],
  ])("has --%s readable on --%s", (foreground, background, required) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(required);
  });

  it("keeps the floor numbers readable on the brightest part of a floor", () => {
    // The one pair in the building that has to clear a bar, and the one that
    // cannot be checked by comparing two tokens: both sides of it are painted
    // through something else. The number is translucent white on a band that is
    // itself translucent white on --color-world, so the comparison is between
    // two composites -- 32px text, so 1.4.3 asks 3:1 rather than 4.5:1.
    //
    // It sat at 1.40:1 for twelve years, defended by a note saying the building
    // was dim on purpose. That is true of a call button, which says what it has
    // to say by lighting up. A floor number never lights up.
    const band = lightestFloorBand();
    expect(band).toBe("#646464");
    expect(contrast(over(token("color-floor-number"), band), band)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the floor a car is at readable inside the car", () => {
    // The other marking that never lights up. It was 15px in 30% white for
    // twelve years -- 1.63:1 -- and the repair is the colour rather than the
    // size: the car is a mid-tone, so white on it stops at 4.13 and cannot
    // clear the 4.5 ordinary text is asked for, while a near-black number
    // reaches 4.57 at exactly the size the number always was.
    //
    // The bar is worked out from the rule instead of being written down, and
    // both sides of the pair are read from the stylesheet, so nothing here
    // forbids a later repair: setting the number as large text lowers the bar
    // to 3:1 the way 1.4.3 does, and repainting the car is measured rather
    // than refused.
    const number = carNumber();
    expect(number.colour).toBe(token("color-car-number"));
    expect(
      number.colour,
      "a translucent car number would have to be composited over the car before it is measured",
    ).toMatch(/^#[0-9a-f]{3,6}$/i);
    expect(contrast(number.colour, number.on)).toBeGreaterThanOrEqual(
      requiredRatio(number.size, number.weight),
    );
  });

  it("cannot be fixed by lightening anything that sits on the page", () => {
    // The reason --color-emphasis-on-page exists. The page colour is light
    // enough that white, the lightest foreground there is, reaches 1.91:1 on
    // it: no light emphasis can pass, however it is tuned, so the emphasis on
    // the page has to be darker than the page rather than paler.
    expect(contrast("#ffffff", token("color-page"))).toBeLessThan(3);
  });
});
