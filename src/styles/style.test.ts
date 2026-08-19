/**
 * What can be checked about `style.css` without a browser: the contrast of the
 * palette, and the arithmetic the statistics panel is sized by.
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
 *
 * The panel's geometry is here for the same reason the colours are: the numbers
 * are all in tokens, so what they add up to is arithmetic. Whether a browser
 * then draws the panel where it was told to is `e2e/statistics-panel.spec.ts`.
 * `--stats-rows` is no longer a count of anything in `index.html` --
 * `widgets/stats-panel` draws its rows at runtime, not as static markup --
 * so nothing here counts elements, and nothing needs a parser for one.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The repository root.
 *
 * This file runs under jsdom, where `import.meta.url` is an `http:` URL for the
 * benefit of the DOM and no use at all to `node:fs`. Vitest runs from the
 * project root, so the working directory is the one thing that does point here
 * — the same reasoning, and the same line, as `src/page.test.ts`.
 */
const ROOT = process.cwd();

/**
 * The stylesheet, as text.
 *
 * Read from disk rather than imported: Vitest does not process CSS, and hands
 * back an empty string for `style.css?raw` as readily as for `style.css`.
 */
const styleSource = readFileSync(join(ROOT, "src/styles/style.css"), "utf8");

/** The custom properties declared on `:root`, by name without the `--`. */
const PALETTE: ReadonlyMap<string, string> = new Map(
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
 * `PALETTE` above is keyed by name across the whole file, so a token
 * declared in both `:root` and `html[data-theme="light"]` -- every `--ds-*`
 * token is -- collapses to whichever block comes last. This reads a given
 * selector's own blocks, so the two themes of such a token can be told apart.
 *
 * Anchored to the start of a line, unindented: `:root` also appears, indented,
 * inside the narrow-screen `@media` blocks below, redeclaring geometry tokens
 * that have nothing to do with either theme, and those are not this.
 *
 * @param selector - The rule's selector, exactly as the stylesheet spells it.
 * @returns Its declared custom properties.
 */
function paletteIn(selector: string): ReadonlyMap<string, string> {
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
 * @param palette - `DARK_PALETTE` or `LIGHT_PALETTE`.
 * @param name - The token's name, without the leading `--`.
 * @returns Its value.
 */
function themed(palette: ReadonlyMap<string, string>, name: string): string {
  const value = palette.get(name);
  expect(value, `--${name} is missing from that theme's block`).toBeDefined();
  const variable = /^var\(--([\w-]+)\)$/.exec(value ?? "");
  return variable === null ? (value ?? "") : themed(palette, variable[1] ?? "");
}

/** `:root`'s own values, before `html[data-theme="light"]` overrides any of them. */
const DARK_PALETTE = paletteIn(":root");

/** What `html[data-theme="light"]` redeclares over `:root`. */
const LIGHT_PALETTE = paletteIn('html[data-theme="light"]');

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
 * white at four alphas over --ds-shaft, and the darker a foreground gets
 * relative to its background the *lighter* the background has to be for the
 * ratio to be worst -- so the peak stop is the one to measure. Reading it out
 * of the rule means someone raising that 24% has to answer to this file.
 *
 * @param shaft - That theme's `--ds-shaft` value, from `themed()`.
 * @returns The composited band colour, as `#rrggbb`.
 */
function lightestFloorBand(shaft: string): string {
  const rule = /\.floor\s*\{([^}]*)\}/.exec(styleSource);
  expect(rule, ".floor is no longer a rule of its own").not.toBeNull();
  const gradient = /background:\s*linear-gradient\(([\s\S]*?)\);/.exec(rule?.[1] ?? "");
  expect(gradient, ".floor no longer paints a linear-gradient").not.toBeNull();
  const alphas = [...(gradient?.[1] ?? "").matchAll(/rgb\(255 255 255 \/ ([\d.]+)%\)/g)].map(
    ([, percent = "0"]) => Number(percent),
  );
  expect(alphas.length, ".floor's gradient is not white at a list of alphas").toBeGreaterThan(1);
  return over(`rgb(255 255 255 / ${String(Math.max(...alphas))}%)`, shaft);
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
 * How the floor indicator inside a car is set: the colour it is painted in and
 * the size and weight that decide which bar 1.4.3 holds that pair to.
 *
 * The background is not read here: `--ds-car` has two values, one per theme,
 * and `token()` collapses a name declared in both `:root` and the light
 * override to whichever comes last -- so a caller wanting both themes reads
 * `--ds-car` itself through `themed(DARK_PALETTE, ...)` /
 * `themed(LIGHT_PALETTE, ...)` instead of through this function.
 *
 * @returns The size in px, the weight, and the colour.
 */
function carNumber(): { size: number; weight: string; colour: string } {
  const selector = ".elevator .floorindicator";
  const rules = [...styleSource.matchAll(/\.elevator \.floorindicator\s*\{([^}]*)\}/g)];
  expect(rules.length, `${selector} is no longer exactly one rule`).toBe(1);
  const body = rules[0]?.[1] ?? "";
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

  // Foreground, background, and the ratio the pair is asked for: 4.5 for
  // ordinary text under WCAG 1.4.3, 3 for text at 24px or 18.66px and bold, and
  // 3 for the one graphical indicator here, which is 1.4.11's bar rather than
  // 1.4.3's. Each pair is one that really occurs -- the emphasis colour appears
  // twice because it sits on the page in the headings, the challenge bar and
  // the help prose, and on the building in the end-of-challenge overlay, and
  // the error colour twice because it is a sentence and an icon on the page and
  // the wavy underline under a failing line in the editor.
  it.each([
    ["color-text", "color-page", 4.5],
    ["color-text-strong", "color-page", 4.5],
    ["color-link", "color-page", 4.5],
    ["color-emphasis-on-page", "color-page", 4.5],
    ["color-error-on-page", "color-page", 4.5],
    ["color-error", "color-code-page", 3],
    // --color-stats used to be checked against --color-world here: .statscontainer
    // paints no background of its own, so it reads whatever is behind it, and
    // that used to be the building's fixed background. It is --ds-shaft now,
    // themed, and .statscontainer's own surface is a separate region's rework
    // in flight -- this file does not guess at a background nobody has settled
    // on yet; re-add the pair once that surface is real.
    ["color-text-strong", "color-control", 4.5],
    ["color-code-text", "color-code-page", 4.5],
    ["color-code-keyword", "color-code-page", 4.5],
    ["color-code-string", "color-code-page", 4.5],
    ["color-code-number", "color-code-page", 4.5],
    ["color-code-entity", "color-code-page", 4.5],
    ["color-code-comment", "color-code-page", 4.5],
    // The changed-line border in the learning track's answer, 1.4.11's bar
    // rather than 1.4.3's: nothing is written in this colour there, only drawn.
    // --color-emphasis-on-page is proven readable as text twice already; this
    // is the same colour meeting a background it has not been measured against
    // before, in a role the 4.5:1 rows above do not cover.
    ["color-emphasis-on-page", "color-code-page", 3],
  ])("has --%s readable on --%s", (foreground, background, required) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(required);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])(
    "keeps the floor numbers readable on the brightest part of a floor, %s theme",
    (_, palette) => {
      // The one pair in the building that has to clear a bar, and the one that
      // cannot be checked by comparing two tokens: the background is painted
      // through something else. The number is opaque --ds-text-muted on a band
      // that is translucent white over --ds-shaft, which now differs by theme --
      // so the comparison is against the band's own composite, per theme. 32px
      // text, so 1.4.3 asks 3:1 rather than 4.5:1.
      //
      // It sat at 1.40:1 for twelve years, defended by a note saying the building
      // was dim on purpose. That is true of a call button, which says what it has
      // to say by lighting up. A floor number never lights up.
      const band = lightestFloorBand(themed(palette, "ds-shaft"));
      expect(contrast(themed(palette, "ds-text-muted"), band)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the floor a car is at readable inside the car, %s theme", (_, palette) => {
    // The other marking that never lights up. It was 15px in 30% white for
    // twelve years -- 1.63:1 -- and the repair is a colour fixed across both
    // themes rather than a themed one: the car stays a mid-dark surface in
    // both (--ds-car), so one near-white value clears 15px's 4.5:1 in either
    // (9.97 dark, 7.31 light) without needing a light-theme override.
    const number = carNumber();
    expect(number.colour).toBe(token("ds-car-ink"));
    expect(contrast(number.colour, themed(palette, "ds-car"))).toBeGreaterThanOrEqual(
      requiredRatio(number.size, number.weight),
    );
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lit direction arrow readable inside the car, %s theme", (_, palette) => {
    // The mockup lights this with its own themed accent-hi, which is 1.35:1 on
    // --ds-car in the light theme -- drawn on the car body, it needs the same
    // fixed ink the floor indicator above uses, not a themed accent.
    const body = ruleBody(".elevator .directionindicator .icon.activated");
    expect(declaration(body, "color", ".elevator .directionindicator .icon.activated")).toBe(
      token("ds-car-ink"),
    );
    expect(contrast(token("ds-car-ink"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lit floor call button readable on its band, %s theme", (_, palette) => {
    // Unlike the car, a floor's band flips light/dark with the theme, so the
    // themed accent that fails on the car (above) is exactly what belongs
    // here -- checked against the band's own lightest composite, the same
    // worst case the floor number is held to.
    const band = lightestFloorBand(themed(palette, "ds-shaft"));
    expect(contrast(themed(palette, "ds-accent"), band)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the emphasis colour readable on the feedback overlay, %s theme", (_, palette) => {
    // .feedback's own background used to sit on the building's fixed colour;
    // it is --ds-shaft now, which is light in the light theme, so the overlay
    // has to be dark enough on its own that the pale --color-emphasis painted
    // over it still clears 4.5:1 regardless of what shows through. Read from
    // the rule rather than written down here, so raising --ds-shaft's light
    // value or lowering the overlay's alpha both have to answer to this.
    const translucent = declaration(ruleBody(".feedback"), "background-color", ".feedback");
    const overlay = over(translucent, themed(palette, "ds-shaft"));
    expect(contrast(token("color-emphasis"), overlay)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a passenger readable against the shaft and the car, %s theme", (_, palette) => {
    // A passenger is a graphical object, so 1.4.11's 3:1 applies. Waiting or
    // walking, they read against --ds-shaft (themed); boarded, `.boarded`
    // switches them to a colour fixed across both themes, tuned against
    // --ds-car instead -- see the palette comment above --ds-car-ink.
    expect(
      contrast(themed(palette, "ds-person"), themed(palette, "ds-shaft")),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(token("ds-car-person"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the longest-waiting passenger readable, %s theme", (_, palette) => {
    // The same shaft/car split as the plain passenger above, for the marked
    // one: --ds-accent on the shaft (the mockup's own choice for this exact
    // state, `.person.is-waiting-long`), --ds-car-attention -- fixed, like
    // every other car-body colour -- once boarded.
    expect(
      contrast(themed(palette, "ds-accent"), themed(palette, "ds-shaft")),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(token("ds-car-attention"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(
      3,
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

describe("ds palette on the page background", () => {
  // html,body and .container paint --ds-bg now, not the fixed --color-page,
  // so the text painted directly on it -- h1-h6/p/a/dl (--ds-text),
  // .emphasis-color (--ds-accent-hi) and .error-color/#save_message.refused
  // (--ds-bad) -- has to clear 4.5:1 in both of --ds-bg's themes, not just
  // the one --color-page ever had. Unlike the legacy pairs above, these are
  // read from :root and html[data-theme="light"] separately: PALETTE collapses
  // a token declared in both to whichever block comes last, which would silently
  // test only one theme twice.
  it.each([
    ["ds-text", "ds-bg", 4.5],
    ["ds-accent-hi", "ds-bg", 4.5],
    ["ds-bad", "ds-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});

describe("ds code palette on the code background", () => {
  // pre code and .cm-editor both paint --ds-code-bg now, and .tok-* (the
  // eight tutorial answers' syntax colours) and .cm-gutters (the live
  // editor's line numbers) paint straight onto it, at 13px and smaller --
  // 1.4.3 asks 4.5:1 of all of it. --ds-code-key/-fn/-str/-num/-text are the
  // mockup's own values, already clearing the bar; --ds-code-com and
  // --ds-code-line are not the mockup's own -- see .tok-comment's and
  // .cm-gutters's own comments in style.css for the two numbers each was
  // retuned from.
  it.each([
    ["ds-code-text", "ds-code-bg", 4.5],
    ["ds-code-key", "ds-code-bg", 4.5],
    ["ds-code-fn", "ds-code-bg", 4.5],
    ["ds-code-str", "ds-code-bg", 4.5],
    ["ds-code-num", "ds-code-bg", 4.5],
    ["ds-code-com", "ds-code-bg", 4.5],
    ["ds-code-line", "ds-code-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});

describe("docs and hotkeys dialogs", () => {
  // The dialog's own panel, not --ds-bg: .docs/.keys paint --ds-panel, and
  // .docsclear/.keyrow kbd paint --ds-bg, the search field's own background
  // -- neither pairing "ds palette on the page background" above covers.
  it.each([
    ["ds-text", "ds-panel", 4.5],
    ["ds-text-muted", "ds-panel", 4.5],
    ["ds-code-fn", "ds-panel", 4.5],
    ["ds-text-muted", "ds-bg", 4.5],
    ["ds-text", "ds-raised", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  it("holds the chevron to the 3:1 a graphical indicator is asked for, not 4.5:1", () => {
    // The one place this file's own --ds-text-faint still appears: a
    // rotating icon, which WCAG 1.4.11 holds to 3:1 rather than 1.4.3's
    // 4.5:1 -- the bar the same pair clears without --ds-text-muted's help
    // (style.css's own comment on .docs-body h3 has the numbers for both).
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, "ds-text-faint"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the group heading, the empty-search message and the clear icon off --ds-text-faint", () => {
    // Regression guard for the deviations style.css's own comments document:
    // a revert to --ds-text-faint would still be an arithmetic pass if this
    // read the token by name instead of the declaration, since nothing would
    // then stop it from measuring the *wrong* token.
    for (const selector of [".docs-body h3", ".docs-empty", ".docsclear"]) {
      expect(declaration(ruleBody(selector), "color", selector)).toBe(token("ds-text-muted"));
    }
  });
});

/**
 * Reads a rule's body out of the stylesheet.
 *
 * Declared here, ahead of its first use below, because both `describe("kbd")`
 * and `describe("statistics panel")` need it and only one of them can carry
 * the definition. `function` is hoisted, so where this sits in the file does
 * not change when either suite can call it.
 *
 * @param selector - The selector, exactly as the rule spells it.
 * @returns Everything between its braces.
 */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...styleSource.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  expect(rules.length, `${selector} is no longer exactly one rule`).toBe(1);
  return rules[0]?.[1] ?? "";
}

describe("kbd and .hint", () => {
  it("draws a key cap instead of the browser default", () => {
    // <kbd> ships with no border, background or radius of its own -- only a
    // monospace font, which the rule above already sets. Reusing the run
    // buttons' own tokens (see .runbuttons button) means a key reads as the
    // same kind of control-shaped mark those buttons already draw, rather
    // than a colour this file would have no test for. The pair is
    // --color-text-strong on --color-control, which the "readable on" cases
    // above already hold to 4.5:1 by way of .runbuttons button and
    // .skip-link, both painting the same two tokens over each other.
    const body = ruleBody("kbd");
    expect(declaration(body, "border-radius", "kbd")).toBe("4px");
    expect(declaration(body, "color", "kbd")).toBe(token("color-text-strong"));
    expect(declaration(body, "background-color", "kbd")).toBe(token("color-control"));
    expect(body).toMatch(/^\s*font-weight:\s*bold;/m);
  });

  it("keeps the hint paragraph off the page's smallest text", () => {
    // .hint used to sit at 12px, the same size as #save_message and
    // #fitness_message -- but unlike those two, every word in it is either a
    // key combination or the sentence naming one, including a Mac player's
    // lone ⌘. 14px is what the rest of the page's secondary text is set at
    // (.tutorialprogress among it).
    expect(declaration(ruleBody(".hint"), "font-size", ".hint")).toBe("14px");
  });
});

describe("statistics panel", () => {
  it("counts the primary grid, the disclosure summary, the secondary grid and the card border into its height", () => {
    // Pinned as the expression rather than as the 503px it comes to, because
    // what matters is which quantities are in it: a height worked out from
    // less than all three regions, or missing the card's own border, is the
    // same defect in a new form as the eleven-row panel this replaced once
    // had, in `--stats-rows`/`--stats-row-pitch`/`--stats-padding` (above),
    // now orphaned. Sized to the disclosure held open, the worst case -- see
    // `style.css`'s own comment above these tokens for why.
    expect(token("stats-block-size")).toBe(
      "calc(\n    var(--stats-primary-h) + var(--stats-summary-h) + var(--stats-secondary-h) + 2px\n  )",
    );
  });

  it("holds open the box that clips it", () => {
    // The panel is positioned out of the flow, so it adds nothing to the height
    // of `.worldtrack` -- and `.worldtrack` takes its height from the building
    // and clips what does not fit. A two-floor building is 100px, which is
    // six rows short of the panel. Both boxes are stated in the same token so
    // that the clip cannot be left behind when the panel changes size.
    expect(declaration(ruleBody(".statscontainer"), "block-size", ".statscontainer")).toBe(
      token("stats-block-size"),
    );
    expect(declaration(ruleBody(".worldtrack"), "min-block-size", ".worldtrack")).toBe(
      token("stats-block-size"),
    );
    // Nothing moves on screen if this is dropped today: `.statscontainer`
    // carries no padding or border of its own any more for `box-sizing` to
    // interpret one way or the other -- widgets/stats-panel draws its own
    // box (`.statspanel`, in the same rule) rather than the padded text list
    // this replaced. The assertion stays as the guard it always was, in case
    // a later change gives the box either back: on the panel this replaced,
    // `box-sizing: border-box` on a box with 20px padding all round was the
    // difference between a 216px clip and 256px of panel, 40px past it.
    expect(declaration(ruleBody(".statscontainer"), "box-sizing", ".statscontainer")).toBe(
      "border-box",
    );
    // And the clipping stays, for the reason `style.css` gives: the feedback
    // overlay is wider than the track it is drawn in.
    expect(ruleBody(".worldtrack")).toMatch(/^\s*overflow:\s*hidden;/m);
  });
});
