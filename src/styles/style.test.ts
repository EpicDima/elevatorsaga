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
 * How the floor indicator inside a car is set: the colour it is painted in, and
 * the two properties that decide which bar 1.4.3 holds that colour to.
 *
 * Read out of the rule rather than written down here, and through the palette
 * wherever the rule names a token, because the colour passes only on the
 * strength of the size and the weight. Taking the boldness off, or letting the
 * size drift back towards the 15px it used to be, is the same failure as
 * dimming the number, and this is where both are caught.
 *
 * @returns The size in px, the weight, and the colour.
 */
function carNumber(): { size: number; weight: string; colour: string } {
  const rule = /\.elevator \.floorindicator\s*\{([^}]*)\}/.exec(styleSource);
  expect(rule, ".elevator .floorindicator is no longer a rule of its own").not.toBeNull();
  const read = (property: string): string => {
    const found = new RegExp(`^\\s*${property}:\\s*([^;]+);`, "m").exec(rule?.[1] ?? "");
    expect(found, `.elevator .floorindicator no longer sets ${property}`).not.toBeNull();
    const value = (found?.[1] ?? "").trim();
    const variable = /^var\(--([\w-]+)\)$/.exec(value);
    return variable === null ? value : token(variable[1] ?? "");
  };
  return {
    size: Number.parseFloat(read("font-size")),
    weight: read("font-weight"),
    colour: read("color"),
  };
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
    // The other marking that never lights up, and the one pair no palette value
    // could have carried. On --color-elevator white reaches 4.13:1 and nothing
    // reaches further, so at the 15px this was set at for twelve years -- 1.63:1
    // -- there was no colour that passed; the way out was to stop it being
    // ordinary text. 18.66px and bold is where 1.4.3 calls text large and asks
    // 3:1 of it, which is why the size and the weight are asserted here beside
    // the colour: drop either and the colour no longer clears anything.
    const number = carNumber();
    expect(number.weight).toBe("bold");
    expect(number.size).toBeGreaterThanOrEqual(18.66);
    expect(number.colour).toBe(token("color-car-number"));
    expect(
      number.colour,
      "a translucent car number would have to be composited over the car before it is measured",
    ).toMatch(/^#[0-9a-f]{3,6}$/i);
    expect(contrast(number.colour, token("color-elevator"))).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", token("color-elevator"))).toBeLessThan(4.5);
  });

  it("cannot be fixed by lightening anything that sits on the page", () => {
    // The reason --color-emphasis-on-page exists. The page colour is light
    // enough that white, the lightest foreground there is, reaches 1.91:1 on
    // it: no light emphasis can pass, however it is tuned, so the emphasis on
    // the page has to be darker than the page rather than paler.
    expect(contrast("#ffffff", token("color-page"))).toBeLessThan(3);
  });
});
