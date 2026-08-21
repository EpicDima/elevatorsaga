/**
 * What can be checked about the stylesheet without a browser, and the readers
 * that do the checking.
 *
 * The stylesheet states every colour once, as a custom property, which is what
 * makes contrast checkable without a browser: the pairs that actually meet on
 * screen are few and known, so the WCAG 1.4.3 ratio for each of them is
 * arithmetic over the token values. A browser sweep over the built pages is
 * what found those pairs in the first place; the `*.css.test.ts` file beside
 * each slice's stylesheet is what keeps someone from quietly reverting one of
 * them.
 *
 * What those files deliberately do not do is discover pairs. If a new rule puts
 * text on a background nobody listed, nothing here will notice — re-measure in
 * a browser when the layout changes, and add the pair.
 *
 * Everything below reads the stylesheet as one text, in the index's own import
 * order, because one text is what a browser is served: the cascade is stated in
 * `src/styles/index.css` and nowhere else, and a rule in one slice can be
 * overridden by a rule in the next. Reading a slice's file on its own would
 * measure a stylesheet nobody gets.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "vitest";

/**
 * The repository root.
 *
 * Vitest runs from the project root, so the working directory is the one thing
 * that points here whichever environment a test file asks for — the same
 * reasoning, and the same line, as `src/page.test.ts`.
 */
export const ROOT = process.cwd();

/**
 * The paths `src/styles/index.css` imports, in the order it imports them, as
 * repository-relative paths.
 *
 * The index is the one place the cascade is stated, so reading it is how this
 * module measures the same stylesheet a browser assembles rather than a set of
 * files that happen to be on disk.
 */
export const IMPORTED: readonly string[] = [
  ...readFileSync(join(ROOT, "src/styles/index.css"), "utf8").matchAll(/^@import "([^"]+)";$/gm),
].map(([, path = ""]) => join("src/styles", path));

/**
 * The stylesheet, as text: every imported file concatenated in the index's own
 * order, which is the order the cascade sees them in.
 *
 * Read from disk rather than imported: Vitest does not process CSS, and hands
 * back an empty string for `index.css?raw` as readily as for `index.css`.
 */
export const styleSource = IMPORTED.map((path) => readFileSync(join(ROOT, path), "utf8")).join(
  "\n",
);

/** The custom properties declared anywhere in the stylesheet, by name without the `--`. */
export const PALETTE: ReadonlyMap<string, string> = new Map(
  [...styleSource.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name = "", value = ""]) => [
    name,
    value.trim(),
  ]),
);

/**
 * The custom properties declared inside a top-level rule's braces, by name
 * without the `--`, merged across every rule with that exact selector in
 * source order (later overriding earlier, the way the cascade would for
 * rules of equal specificity).
 *
 * {@link PALETTE} above is keyed by name across the whole stylesheet, so a
 * token declared in both `:root` and `html[data-theme="light"]` -- every
 * `--ds-*` token is -- collapses to whichever block comes last. This reads a
 * given selector's own blocks, so the two themes of such a token can be told
 * apart.
 *
 * Anchored to the start of a line, unindented: `:root` also appears, indented,
 * inside narrow-screen `@media` blocks, redeclaring geometry tokens that have
 * nothing to do with either theme, and those are not this.
 *
 * @param selector - The rule's selector, exactly as the stylesheet spells it.
 * @returns Its declared custom properties.
 */
export function paletteIn(selector: string): ReadonlyMap<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...styleSource.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  expect(rules.length, `${selector} is no longer a top-level rule`).toBeGreaterThan(0);
  const merged = new Map<string, string>();
  for (const rule of rules) {
    for (const [, name = "", value = ""] of (rule[1] ?? "").matchAll(
      /^\s*--([\w-]+):\s*([^;]+);/gm,
    )) {
      merged.set(name, value.trim());
    }
  }
  return merged;
}

/**
 * Looks a token up in one theme's palette, following a lone `var(--token)`
 * through the same theme's block -- the way every `--ds-bg` names its own
 * theme's `--ds-n-0`.
 *
 * @param palette - {@link DARK_PALETTE} or {@link LIGHT_PALETTE}.
 * @param name - The token's name, without the leading `--`.
 * @returns Its value.
 */
export function themed(palette: ReadonlyMap<string, string>, name: string): string {
  const value = palette.get(name);
  expect(value, `--${name} is missing from that theme's block`).toBeDefined();
  const variable = /^var\(--([\w-]+)\)$/.exec(value ?? "");
  return variable === null ? (value ?? "") : themed(palette, variable[1] ?? "");
}

/** `:root`'s own values, before `html[data-theme="light"]` overrides any of them. */
export const DARK_PALETTE = paletteIn(":root");

/** What `html[data-theme="light"]` redeclares over `:root`. */
export const LIGHT_PALETTE = paletteIn('html[data-theme="light"]');

/**
 * Both themes as `it.each` rows: a name for the `%s` in the test's title, and
 * the palette to measure.
 *
 * A colour that clears its bar in one theme says nothing about the other, so a
 * pair worth measuring is worth measuring twice. This table makes forgetting
 * the second one a visible omission rather than the default.
 */
export const THEMES: readonly [name: string, palette: ReadonlyMap<string, string>][] = [
  ["dark", DARK_PALETTE],
  ["light", LIGHT_PALETTE],
];

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
export function contrast(one: string, other: string): number {
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
export function token(name: string): string {
  const value = PALETTE.get(name);
  expect(value, `--${name} is missing from the palette`).toBeDefined();
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
export function over(foreground: string, background: string): string {
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
 * A `#rrggbb` colour as the `rgb(r g b / n%)` {@link over} composites.
 *
 * @param hex - The opaque colour.
 * @param percent - The alpha to give it, 0 to 100.
 * @returns The same colour, translucent.
 */
export function withAlpha(hex: string, percent: number): string {
  const digits = hex.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const channels = (expanded.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return `rgb(${channels.join(" ")} / ${String(percent)}%)`;
}

/**
 * Reads a rule's body out of the stylesheet.
 *
 * @param selector - The selector, exactly as the rule spells it.
 * @returns Everything between its braces.
 */
export function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...styleSource.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  expect(rules.length, `${selector} is no longer exactly one rule`).toBe(1);
  return rules[0]?.[1] ?? "";
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
export function declaration(body: string, property: string, selector: string): string {
  const found = new RegExp(`^\\s*${property}:\\s*([^;]+);`, "m").exec(body);
  expect(found, `${selector} no longer sets ${property}`).not.toBeNull();
  const value = (found?.[1] ?? "").trim();
  const variable = /^var\(--([\w-]+)\)$/.exec(value);
  return variable === null ? value : token(variable[1] ?? "");
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
export function requiredRatio(size: number, weight: string): number {
  const bold = ["bold", "bolder", "700", "800", "900"].includes(weight);
  return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
}

/*
 * The three composited surfaces below are the ones no token names, because each
 * is a wash over a wash: what a marking in the building is read against is the
 * result of two or three rules from two or three slices, not a value anyone
 * declared. They live here rather than beside the rule that paints them because
 * they are read from the other side of a layer boundary -- the floor's own
 * numbers and lamps are read against a column the *building* paints, and
 * `entities` may not import from `widgets` (see `eslint.config.js`).
 */

/**
 * The surface the floor-number column really paints, which is what every
 * marking in it -- the number, both call lamps -- is read against.
 *
 * `.levels` (`widgets/building-stage`) is a translucent `--ds-panel` over the
 * building's `--ds-shaft`, so neither token is what is on screen there. Read
 * out of the rule rather than written down here, so that changing the 55% has
 * to answer to a test.
 *
 * @param palette - {@link DARK_PALETTE} or {@link LIGHT_PALETTE}.
 * @returns The composited column colour, as `#rrggbb`.
 */
export function levelsColumn(palette: ReadonlyMap<string, string>): string {
  const value = declaration(ruleBody(".levels"), "background", ".levels");
  const mix = /color-mix\(in srgb,\s*var\(--([\w-]+)\)\s*([\d.]+)%,\s*transparent\)/.exec(value);
  expect(mix, ".levels no longer paints a token mixed with transparency").not.toBeNull();
  const [, name = "", percent = "0"] = mix ?? [];
  return over(withAlpha(themed(palette, name), Number(percent)), themed(palette, "ds-shaft"));
}

/**
 * The surface the car's top strip really paints, which is what the floor number
 * and both boarding lamps are read against.
 *
 * `.car-top` is a flat black wash over the car body, so neither `--ds-car` nor
 * the wash is what is on screen there. Read out of the rule, so that changing
 * the 22% has to answer to a test.
 *
 * @param palette - {@link DARK_PALETTE} or {@link LIGHT_PALETTE}.
 * @returns The composited strip colour, as `#rrggbb`.
 */
export function carTop(palette: ReadonlyMap<string, string>): string {
  return over(
    declaration(ruleBody(".car-top"), "background", ".car-top"),
    themed(palette, "ds-car"),
  );
}

/**
 * The surface the order strip really paints, which is what an order mark is
 * read against.
 *
 * Two washes deep: the strip's own black over the shaft's black over the
 * building's `--ds-shaft`. The shaft's wash is the one thing here that is not
 * the same in both themes -- 18% would swallow the light theme's pale shaft, so
 * the stylesheet drops it to 3% there, and this has to follow that rule rather
 * than assume either figure.
 *
 * @param palette - {@link DARK_PALETTE} or {@link LIGHT_PALETTE}.
 * @returns The composited strip colour, as `#rrggbb`.
 */
export function orderStrip(palette: ReadonlyMap<string, string>): string {
  const lightSelector = 'html[data-theme="light"] .shaft';
  const shaftWash =
    palette === LIGHT_PALETTE
      ? declaration(ruleBody(lightSelector), "background", lightSelector)
      : declaration(ruleBody(".shaft"), "background", ".shaft");
  return over(
    declaration(ruleBody(".shaft-marks"), "background", ".shaft-marks"),
    over(shaftWash, themed(palette, "ds-shaft")),
  );
}
