/** Reads the built stylesheet as text so contrast and tokens can be checked without a browser. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "vitest";

/** The repository root. */
export const ROOT = process.cwd();

/** Repository-relative paths `src/styles/index.css` imports, in import order. */
export const IMPORTED: readonly string[] = [
  ...readFileSync(join(ROOT, "src/styles/index.css"), "utf8").matchAll(/^@import "([^"]+)";$/gm),
].map(([, path = ""]) => join("src/styles", path));

/**
 * The stylesheet as text, in the index's import order (the cascade's order).
 * Read from disk because Vitest does not process CSS.
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
 * Custom properties declared inside a top-level rule's braces, merged across
 * every rule with that exact selector (later blocks override earlier ones).
 * Matched unindented, so nested `@media` blocks redeclaring `:root` are excluded.
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

/** Resolves a token's value in one theme's palette, following a `var(--token)` reference within it. */
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

/** Both themes as `it.each` rows: a label for the test title, and the palette to measure. */
export const THEMES: readonly [name: string, palette: ReadonlyMap<string, string>][] = [
  ["dark", DARK_PALETTE],
  ["light", LIGHT_PALETTE],
];

/**
 * Every color the code surface draws text in — the live editor's syntax theme,
 * `.tok-*`, and the gutter. Listed once so each surface washed over the code
 * background (the active line, a marked lesson line) measures all of them; a
 * color added to `editorSyntaxTheme` without being added here goes untested.
 */
export const CODE_INK_TOKENS: readonly string[] = [
  "ds-code-text",
  "ds-code-key",
  "ds-code-fn",
  "ds-code-str",
  "ds-code-num",
  "ds-code-com",
  "ds-code-punc",
  "ds-code-line",
];

/** Relative luminance, 0 to 1, of a `#rgb`/`#rrggbb` sRGB color, per WCAG 2. */
function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const [red = 0, green = 0, blue = 0] = (expanded.match(/../g) ?? [])
    .map((pair) => parseInt(pair, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio, 1 to 21, between two `#rgb`/`#rrggbb` colors. */
export function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Looks up a palette token by name, without the leading `--`. */
export function token(name: string): string {
  const value = PALETTE.get(name);
  expect(value, `--${name} is missing from the palette`).toBeDefined();
  return value ?? "";
}

/** Composites an `rgb(r g b / n%)` foreground over a `#rgb`/`#rrggbb` background, as `#rrggbb`. */
export function over(foreground: string, background: string): string {
  const parsed = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)%\s*\)/.exec(foreground);
  expect(parsed, `${foreground} is not an rgb(r g b / n%) color`).not.toBeNull();
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

/** A `#rrggbb` color as the `rgb(r g b / n%)` string {@link over} composites; `percent` is 0 to 100. */
export function withAlpha(hex: string, percent: number): string {
  const digits = hex.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const channels = (expanded.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return `rgb(${channels.join(" ")} / ${String(percent)}%)`;
}

/** Reads a rule's body out of the stylesheet; `selector` must match exactly one top-level rule. */
export function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...styleSource.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  expect(rules.length, `${selector} is no longer exactly one rule`).toBe(1);
  return rules[0]?.[1] ?? "";
}

/** Reads a declaration's value from a rule body, resolving a lone `var(--token)` through the palette. */
export function declaration(body: string, property: string, selector: string): string {
  const found = new RegExp(`^\\s*${property}:\\s*([^;]+);`, "m").exec(body);
  expect(found, `${selector} no longer sets ${property}`).not.toBeNull();
  const value = (found?.[1] ?? "").trim();
  const variable = /^var\(--([\w-]+)\)$/.exec(value);
  return variable === null ? value : token(variable[1] ?? "");
}

/**
 * The WCAG 1.4.3 ratio (3 or 4.5) required for text at a given size and
 * weight. Large text is >=24px, or >=18.66px bold (18pt/14pt in pixels).
 */
export function requiredRatio(size: number, weight: string): number {
  const bold = ["bold", "bolder", "700", "800", "900"].includes(weight);
  return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
}

/*
 * These composited surfaces have no token of their own: each is a wash over
 * a wash from `widgets/building-stage`, which `entities` may not import.
 */

/**
 * The floor-number column's actual color, as `#rrggbb`: `.levels` washes a
 * token over the building's `--ds-shaft`, read from the rule rather than duplicated here.
 */
export function levelsColumn(palette: ReadonlyMap<string, string>): string {
  const value = declaration(ruleBody(".levels"), "background", ".levels");
  const mix = /color-mix\(in srgb,\s*var\(--([\w-]+)\)\s*([\d.]+)%,\s*transparent\)/.exec(value);
  expect(mix, ".levels no longer paints a token mixed with transparency").not.toBeNull();
  const [, name = "", percent = "0"] = mix ?? [];
  return over(withAlpha(themed(palette, name), Number(percent)), themed(palette, "ds-shaft"));
}

/** The car's top strip's actual color, as `#rrggbb`: a black wash over `--ds-car`, read from the rule rather than duplicated here. */
export function carTop(palette: ReadonlyMap<string, string>): string {
  return over(
    declaration(ruleBody(".car-top"), "background", ".car-top"),
    themed(palette, "ds-car"),
  );
}

/**
 * The order strip's actual color, as `#rrggbb`: two washes deep, over the
 * shaft's own wash over the building's `--ds-shaft`. The shaft's wash opacity
 * differs by theme, so this reads it from the rule rather than assuming a percentage.
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
