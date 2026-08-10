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

  it("cannot be fixed by lightening anything that sits on the page", () => {
    // The reason --color-emphasis-on-page exists. The page colour is light
    // enough that white, the lightest foreground there is, reaches 1.91:1 on
    // it: no light emphasis can pass, however it is tuned, so the emphasis on
    // the page has to be darker than the page rather than paler.
    expect(contrast("#ffffff", token("color-page"))).toBeLessThan(3);
  });
});
