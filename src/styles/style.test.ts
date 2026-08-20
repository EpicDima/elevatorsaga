/**
 * What can be checked about `style.css` without a browser: the contrast of the
 * palette, and the handful of declarations the statistics strip's own layout
 * hangs on.
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
 * The strip's layout is here for a narrower reason. It used to be arithmetic —
 * a stack of `--stats-*` tokens adding up to the height of a floating card —
 * and now it is three wirings that fail silently rather than loudly: an
 * `@container` naming a container nobody opens never matches, a flex row left
 * on the browser's own `flex: 0 1 auto` is squeezed instead of the box that
 * scrolls, and a positioning context that stops clipping hands the page
 * scrollbars from the verdict card standing in it. None of the three shows up
 * as an error anywhere; each shows up as a layout that is merely wrong.
 * Whether a browser then draws the strip whole is
 * `e2e/statistics-panel.spec.ts`.
 *
 * The run's verdict card is here for the same reason, in a describe of its
 * own: it is a sheet stretched over the whole building, and the difference
 * between one that lets the pointer through and one that does not is invisible
 * until a player tries to press a call button.
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
 * A `#rrggbb` colour as the `rgb(r g b / n%)` {@link over} composites.
 *
 * @param hex - The opaque colour.
 * @param percent - The alpha to give it, 0 to 100.
 * @returns The same colour, translucent.
 */
function withAlpha(hex: string, percent: number): string {
  const digits = hex.replace("#", "");
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const channels = (expanded.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return `rgb(${channels.join(" ")} / ${String(percent)}%)`;
}

/**
 * The surface the floor-number column really paints, which is what every
 * marking in it -- the number, both call lamps -- is read against.
 *
 * `.levels` is a translucent `--ds-panel` over the building's `--ds-shaft`, so
 * neither token is what is on screen there. Read out of the rule rather than
 * written down here, so that changing the 55% has to answer to this file, the
 * way the verdict mark's own soft badges do below.
 *
 * @param palette - `DARK_PALETTE` or `LIGHT_PALETTE`.
 * @returns The composited column colour, as `#rrggbb`.
 */
function levelsColumn(palette: ReadonlyMap<string, string>): string {
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
 * the 22% has to answer to this file.
 *
 * @param palette - `DARK_PALETTE` or `LIGHT_PALETTE`.
 * @returns The composited strip colour, as `#rrggbb`.
 */
function carTop(palette: ReadonlyMap<string, string>): string {
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
 * @param palette - `DARK_PALETTE` or `LIGHT_PALETTE`.
 * @returns The composited strip colour, as `#rrggbb`.
 */
function orderStrip(palette: ReadonlyMap<string, string>): string {
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

/**
 * How a floor's number is set: the colour, and the size and weight that decide
 * which bar 1.4.3 holds the pair to.
 *
 * The size is a `clamp()`, since a floor is not always the same height. The
 * largest length in it is the one that matters: the bar steps *down* at 24px,
 * so a rule that can be drawn small has to clear the small-text bar.
 *
 * @returns The size in px, the weight, and the colour.
 */
function levelNumber(): { size: number; weight: string; colour: string } {
  const selector = ".level-num";
  const body = ruleBody(selector);
  const lengths = [...declaration(body, "font-size", selector).matchAll(/([\d.]+)px/g)].map(
    ([, px = "0"]) => Number(px),
  );
  expect(lengths.length, `${selector}'s font-size states no length at all`).toBeGreaterThan(0);
  return {
    size: Math.max(...lengths),
    weight: /^\s*font-weight:/m.test(body) ? declaration(body, "font-weight", selector) : "normal",
    colour: declaration(body, "color", selector),
  };
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
 * How the floor number on the car's top strip is set: the colour it is painted
 * in and the size and weight that decide which bar 1.4.3 holds that pair to.
 *
 * The background is not read here: it is a composite that differs per theme,
 * so a caller wanting both themes reads {@link carTop} instead.
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
  it("declares no --color-* token at all, the legacy palette having been retired", () => {
    // The migration onto --ds-* is finished: the last holdout was
    // --color-error, read by name from `src/ui/editor.ts` for the wavy
    // underline under a failing line, and that rule reads --ds-bad now. This
    // is here so the palette cannot quietly grow a page-bound colour back.
    expect([...PALETTE.keys()].filter((name) => name.startsWith("color-"))).toEqual([]);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the error squiggle readable on the editor's background, %s theme", (_, palette) => {
    // `.cm-errorMark` (`src/ui/editor.ts`) underlines the failing text in
    // --ds-bad, on --ds-code-bg. A graphical indicator, so 1.4.11's 3:1 rather
    // than 1.4.3's 4.5 -- and it clears the stricter bar anyway, 5.74:1 dark
    // and 4.94:1 light, which is why the mark needs no size or weight of its
    // own to be found.
    expect(
      contrast(themed(palette, "ds-bad"), themed(palette, "ds-code-bg")),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the shared control-surface pairing readable, %s theme", (_, palette) => {
    // --ds-text on --ds-raised, the pairing kbd, .skip-link, .task-open,
    // .btn, .tutorialbuttons button and .tutorialcopycode all
    // share now. 12.96:1 dark, 15.07:1 light -- far past the 4.5:1 that
    // matters, since none of these sit at large-text sizes.
    expect(
      contrast(themed(palette, "ds-text"), themed(palette, "ds-raised")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the sitewide focus ring readable on the page, %s theme", (_, palette) => {
    // --ds-focus is var(--ds-accent) by default -- see its own comment in
    // style.css. A focus ring is a graphical indicator, so 1.4.11's 3:1
    // applies, not 1.4.3's 4.5; --ds-bg is the palest of the three page
    // surfaces it can be drawn against, so the worst case of them.
    expect(contrast(themed(palette, "ds-focus"), themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(
      3,
    );
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the focus ring readable inside .world, %s theme", (_, palette) => {
    // .world redeclares --ds-focus to --ds-accent-hi, and everything focusable
    // in the building inherits it -- checked directly against the token values,
    // the way the lit call lamp above is, since .world does not redeclare
    // --ds-accent-hi itself for themed() to follow its own override through.
    // Three surfaces carry a ring: --ds-shaft is the shafts a car is focused
    // in, --ds-bg is the stage itself once it has something to scroll, and the
    // floor-number column is where a focused floor row's ring is drawn.
    expect(paletteIn(".world").get("ds-focus")).toBe("var(--ds-accent-hi)");
    for (const surface of [
      themed(palette, "ds-shaft"),
      themed(palette, "ds-bg"),
      levelsColumn(palette),
    ]) {
      expect(contrast(themed(palette, "ds-accent-hi"), surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps an unlit order mark findable on the shaft's own strip, %s theme", (_, palette) => {
    // The floors a car has been asked for used to be a grid of green digits
    // inside the cabin; they are marks along the shaft now. An unlit one is
    // still a <button> -- clickable, tabbable and named -- so it is a control
    // that has to be findable, not the unfilled half of a progress track that
    // 1.4.11 would let off. The mockup paints it --shaft-line, which is the
    // colour of the wall it is drawn on; --ds-text-muted is the same
    // substitution the floor number and the call lamps already make.
    expect(declaration(ruleBody(".mark"), "background", ".mark")).toBe(token("ds-text-muted"));
    expect(contrast(themed(palette, "ds-text-muted"), orderStrip(palette))).toBeGreaterThanOrEqual(
      3,
    );
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lit order mark apart from the strip it sits on, %s theme", (_, palette) => {
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
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the floor numbers readable in their own column, %s theme", (_, palette) => {
    // Not a comparison of two tokens: the column is a translucent --ds-panel
    // over --ds-shaft, so what the number sits on is a composite, per theme.
    //
    // The number sat at 1.40:1 for twelve years, defended by a note saying the
    // building was dim on purpose. That is true of a call lamp, which says what
    // it has to say by lighting up. A floor number never lights up -- and it is
    // no longer 32px either, so the bar it has to clear is 1.4.3's full 4.5:1
    // rather than the 3:1 large text is let off with. That is why the colour is
    // read from the rule as well: --ds-text-faint, which is what
    // design/ui-mockup.html paints it, reaches 3.77:1 dark and 2.83:1 light
    // here, and reverting to it would still be an arithmetic pass if this
    // measured --ds-text-muted by name instead.
    const number = levelNumber();
    expect(number.colour).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
    ).toBeGreaterThanOrEqual(requiredRatio(number.size, number.weight));
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps an unlit call lamp visible in its own column, %s theme", (_, palette) => {
    // The arrow is the whole of what says a control is there when the lamp is
    // off: the border around it is --ds-line-strong, 1.55:1 dark and 1.43:1
    // light on this column, so it carries none of that load. 1.4.11's 3:1 for a
    // graphical object therefore has to be cleared by the glyph alone, which is
    // the second reason .call deviates from the mockup's --text-faint (2.83:1
    // light) to --ds-text-muted.
    expect(declaration(ruleBody(".call"), "color", ".call")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), levelsColumn(palette)),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the floor a car is at readable on its top strip, %s theme", (_, palette) => {
    // The other marking that never lights up. It was 15px in 30% white for
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
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lit boarding lamp readable on the car's top strip, %s theme", (_, palette) => {
    // Not decoration: goingUpIndicator/goingDownIndicator are what decide who
    // may board. The mockup lights the arrow with its own themed accent-hi,
    // which is 1.35:1 on --ds-car in the light theme -- drawn on the car, it
    // needs the same fixed ink the floor number above uses.
    expect(declaration(ruleBody(".car-dir.is-on"), "color", ".car-dir.is-on")).toBe(
      token("ds-car-ink"),
    );
    expect(contrast(token("ds-car-ink"), carTop(palette))).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps an unlit boarding lamp visible on the car's top strip, %s theme", (_, palette) => {
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
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lit floor call lamp readable on its own badge, %s theme", (_, palette) => {
    // Unlike the car, the floor column flips light/dark with the theme, so the
    // themed accent that fails on the car (above) is exactly what belongs here.
    // Two composites deep: the lamp lights its own --ds-accent-soft badge,
    // which is itself translucent, over a column that is translucent over the
    // shaft -- so neither the badge nor the column is a token this can look up.
    const badge = over(themed(palette, "ds-accent-soft"), levelsColumn(palette));
    expect(contrast(themed(palette, "ds-accent"), badge)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a passenger readable against the shaft and the car, %s theme", (_, palette) => {
    // A passenger is a graphical object, so 1.4.11's 3:1 applies. Waiting or
    // walking, they read against --ds-shaft (themed); boarded, `.is-rider`
    // switches them to a colour fixed across both themes, tuned against
    // --ds-car instead -- see the palette comment above --ds-car-ink.
    expect(declaration(ruleBody(".person"), "color", ".person")).toBe(token("ds-person"));
    expect(declaration(ruleBody(".person.is-rider"), "color", ".person.is-rider")).toBe(
      token("ds-car-person"),
    );
    expect(
      contrast(themed(palette, "ds-person"), themed(palette, "ds-shaft")),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(token("ds-car-person"), themed(palette, "ds-car"))).toBeGreaterThanOrEqual(3);
  });

  it("leaves a delivered passenger's colour alone, because no fade would clear 3:1", () => {
    // The regression guard behind style.css's own note at `.person.is-leaving`:
    // --ds-person has 3.52:1 of room over the light theme's shaft and nothing
    // more, so the mockup's fade -- any fade -- takes a passenger under the bar
    // 1.4.11 sets for a graphical object. This is what would catch someone
    // adding one back, and the arithmetic below is why it should not be added.
    expect(styleSource).not.toMatch(/^\.person\.is-leaving\s*\{/m);
    const shaft = themed(LIGHT_PALETTE, "ds-shaft");
    for (const percent of [50, 62, 85]) {
      const faded = over(withAlpha(themed(LIGHT_PALETTE, "ds-person"), percent), shaft);
      expect(contrast(faded, shaft), `${String(percent)}% opacity`).toBeLessThan(3);
    }
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

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the hover card's own two inks readable on it, %s theme", (_, palette) => {
    // The card is the one thing in the building painted on a flat --ds-panel
    // rather than on the shaft, and its body is prose at 12px, so both inks
    // answer to 1.4.3's 4.5:1 rather than the 3:1 everything else down here
    // gets. Read from the rules: the title and the lines are two different
    // tokens on purpose, and a port that collapsed them would still pass an
    // arithmetic check that only looked tokens up by name.
    expect(declaration(ruleBody(".carcard"), "background", ".carcard")).toBe(token("ds-panel"));
    expect(declaration(ruleBody(".carcard"), "color", ".carcard")).toBe(token("ds-text"));
    expect(declaration(ruleBody(".carcard-lines"), "color", ".carcard-lines")).toBe(
      token("ds-text-muted"),
    );
    for (const ink of ["ds-text", "ds-text-muted"]) {
      expect(contrast(themed(palette, ink), themed(palette, "ds-panel"))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("ds palette on the page background", () => {
  // body and .container paint --ds-bg now, not the fixed --color-page,
  // so the text painted directly on it -- h1-h6/p/a/dl (--ds-text),
  // .emphasis-color (--ds-accent-hi) and .error-color (--ds-bad) -- has to
  // clear 4.5:1 in both of --ds-bg's themes, not just
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

/**
 * Every colour the editor draws text in — the eight syntax colours plus the
 * line numbers beside them.
 *
 * Listed once because the surface underneath changes and the ink does not: the
 * same eight are measured on the plain background, on the active line, and on
 * a selection, and a ninth colour added to `editorSyntaxTheme` without being
 * added here would be measured on none of them.
 */
const CODE_INK_TOKENS = [
  "ds-code-text",
  "ds-code-key",
  "ds-code-fn",
  "ds-code-str",
  "ds-code-num",
  "ds-code-com",
  "ds-code-punc",
  "ds-code-line",
];

describe("ds code palette on the code background", () => {
  // pre code and .cm-editor both paint --ds-code-bg now, and .tok-* (the
  // eight tutorial answers' syntax colours), `editorSyntaxTheme` (the live
  // editor's, in `src/ui/code-highlight.ts`) and .cm-gutters (the live
  // editor's line numbers) paint straight onto it, at 13px and smaller --
  // 1.4.3 asks 4.5:1 of all of it. --ds-code-key/-fn/-str/-num/-text/-punc are
  // the mockup's own values, already clearing the bar; --ds-code-com and
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
    // The dimmest of them by design -- brackets and operators are meant to
    // recede behind the words -- and so the one worth measuring most: 6.73:1
    // dark, 4.98:1 light.
    ["ds-code-punc", "ds-code-bg", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  // The line the caret is on is not a background the player picks: it follows
  // them, so every line of a program is sooner or later read through
  // --ds-code-active. That makes the lit line as permanent a surface as
  // --ds-code-bg itself, and 1.4.3 applies to it unchanged -- which is what
  // this catches and the block above cannot, since the composite is nowhere
  // in the palette to be named. --ds-code-com and --ds-code-line were each
  // lightened past the mockup's own value precisely to clear it here (4.62:1
  // and 4.67:1 dark, 4.58:1 and 4.59:1 light); measuring only the unlit
  // background would have let both back down again.
  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps every code colour readable on the active line, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    for (const name of CODE_INK_TOKENS) {
      expect(
        contrast(themed(palette, name), lit),
        `--${name} on the active line`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The one number in the gutter that is not --ds-code-line: .cm-activeLineGutter
  // brightens the caret's own line number to --ds-text-muted, and does it on
  // the lit background rather than the plain one. 6.41:1 dark, 5.32:1 light.
  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the active line's own number readable, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    expect(contrast(themed(palette, "ds-text-muted"), lit)).toBeGreaterThanOrEqual(4.5);
  });

  // 3:1, not 4.5:1, and deliberately: see --ds-code-sel's own comment in
  // style.css for why a selection cannot be held to 1.4.3 the way the two
  // surfaces above are -- CodeMirror's drawSelection paints behind the text,
  // so no value here can recolour what is selected. The floor exists so that
  // the shortfall stays the bounded, documented one and cannot quietly
  // deepen: the worst pairing is a selection over the active line, where the
  // two washes stack (3.27:1 dark).
  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps selected code above 3:1, even over the active line, %s theme", (_, palette) => {
    const lit = over(themed(palette, "ds-code-active"), themed(palette, "ds-code-bg"));
    const selected = over(themed(palette, "ds-code-sel"), lit);
    for (const name of CODE_INK_TOKENS) {
      expect(
        contrast(themed(palette, name), selected),
        `--${name} selected`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("text on a --*-soft badge", () => {
  // .errorline and .tierrow.is-lost .tierstate both paint --ds-bad-soft as an
  // opaque background and used to read the same --ds-bad their icon/border
  // still does for their own text too -- close enough to the text's own hue,
  // composited over a page surface, to fall short of 4.5:1 in the light
  // theme even though --ds-bad on a flat page surface clears it on its own
  // (see .error-color's comment in style.css). --ds-bad-ink is what the text
  // reads instead; this is what catches either regressing back to --ds-bad,
  // or the composite falling out of tolerance some other way -- raising
  // --ds-bad-soft's alpha, for instance -- since both would still be an
  // arithmetic pass if this measured the declared token by name instead of
  // the composite it actually sits on.
  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the error line's label and link readable, %s theme", (_, palette) => {
    const backdrop = over(themed(palette, "ds-bad-soft"), themed(palette, "ds-code-bg"));
    expect(contrast(themed(palette, "ds-bad-ink"), backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps a lost tier's badge readable, %s theme", (_, palette) => {
    const backdrop = over(themed(palette, "ds-bad-soft"), themed(palette, "ds-panel"));
    expect(contrast(themed(palette, "ds-bad-ink"), backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the verdict card's own mark visible on its badge, %s theme", (_, palette) => {
    // The same two soft badges one more time, this time 38px across at the
    // head of the run's verdict card. The cross is the pair measured directly
    // above -- --ds-bad-ink on --ds-bad-soft over --ds-panel, the same surface
    // -- so only the check needs its own case here. 1.4.11's 3:1, not 4.5:1:
    // the mark is aria-hidden and the headline beside it says won or lost in
    // words, so it is a graphical object rather than text. The light theme is
    // the tight one at 3.97:1, which is what makes the composite worth
    // measuring: --ds-ok reads 4.63:1 on the bare panel there, and the badge
    // it is actually painted on is the greener surface.
    const backdrop = over(themed(palette, "ds-ok-soft"), themed(palette, "ds-panel"));
    expect(declaration(ruleBody(".verdict-mark"), "background", ".verdict-mark")).toBe(
      token("ds-ok-soft"),
    );
    expect(contrast(themed(palette, "ds-ok"), backdrop)).toBeGreaterThanOrEqual(3);
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

  it("brightens .docsclose/.keysclose's border to the neutral --ds-n-5 on hover, not the accent", () => {
    // .btn shares its resting shape with .task-open (style.css's own comment
    // says so), but not its hover colour: .task-open opens the level switcher
    // and brightens to the themed accent to draw the eye; .btn only ever
    // closes a dialog the player already opened, and design/ui-mockup.html's
    // own .btn:hover reaches for the neutral --n-5 instead. Regression guard
    // for the two reading the same token by coincidence of an early port.
    expect(declaration(ruleBody(".btn:hover"), "border-color", ".btn:hover")).toBe(token("ds-n-5"));
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

describe("kbd", () => {
  it("draws a key cap instead of the browser default", () => {
    // <kbd> ships with no border, background or radius of its own -- only a
    // monospace font, which the rule above already sets. Reusing the learning
    // track's buttons' own tokens (see .tutorialbuttons button) means a key
    // reads as the same kind of control-shaped mark those buttons draw, rather
    // than a colour this file would have no test for. The pair is --ds-text
    // on --ds-raised, which the shared control-surface case in
    // describe("palette") already holds to 4.5:1 -- not read through
    // declaration()/token() here, since both are themed and token() would
    // silently collapse to the light theme's value only.
    const body = ruleBody("kbd");
    expect(declaration(body, "border-radius", "kbd")).toBe("4px");
    expect(body).toMatch(/^\s*color:\s*var\(--ds-text\);/m);
    expect(body).toMatch(/^\s*background-color:\s*var\(--ds-raised\);/m);
    expect(body).toMatch(/^\s*font-weight:\s*bold;/m);
  });
});

describe("run controls", () => {
  it("keeps both run buttons one width, so the bar is not recut on every press", () => {
    // The primary button says four different things -- Start, Pause, Resume,
    // Crunching... -- and the widest of them is what decides the box. Without
    // a floor under it the whole bar reflows under the pointer between two
    // presses of the same button, which design/ui-mockup.html calls "худшее,
    // что может случиться с шапкой".
    const body = ruleBody(".runbox .btn");
    expect(declaration(body, "min-width", ".runbox .btn")).toBe("152px");
    expect(declaration(body, "justify-content", ".runbox .btn")).toBe("center");
  });

  it("gives the mount the app bar's own gap, so the pair sits where the mockup puts it", () => {
    // .controls is this port's own wrapper -- the mockup makes .runbox and
    // .speed direct children of .appbar -- and it earns its place by being
    // invisible: 14px inside it is 14px between any two of the bar's own
    // children, so the geometry is the mockup's whichever way the markup is
    // nested.
    expect(declaration(ruleBody(".controls"), "gap", ".controls")).toBe(
      declaration(ruleBody(".appbar"), "gap", ".appbar"),
    );
  });

  it("stands the speed group level with the buttons beside it", () => {
    // 28px of button plus 1px of padding and 1px of border on each side is
    // --ds-ctl-h exactly, which is the height .appbar > * gives everything
    // else in the row. Asserted as the arithmetic rather than as 32px,
    // because what would break this is one of the three moving.
    const group = ruleBody(".speed");
    const button = ruleBody(".speed button");
    const height = Number.parseFloat(declaration(button, "height", ".speed button"));
    const padding = Number.parseFloat(declaration(group, "padding", ".speed"));
    const border = Number.parseFloat(declaration(group, "border", ".speed"));
    expect(height + 2 * padding + 2 * border).toBe(Number.parseFloat(token("ds-ctl-h")));
  });

  it("holds the speed reading and its arrows readable against the group's own background", () => {
    // .speed paints --ds-bg rather than the page's --ds-panel, so neither
    // pairing is one "ds palette on the page background" above covers. The
    // reading is text (1.4.3, 4.5:1); a resting arrow is a graphical control
    // (1.4.11, 3:1), and hovering brightens it to the reading's own colour.
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(contrast(themed(palette, "ds-text"), themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-bg")),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the primary button's own label readable on the accent it is painted with", () => {
    // --ds-accent-ink on --ds-accent, and on the hover shade too: light theme
    // darkens the accent on hover where dark theme lightens it, so the ink is
    // only safe if both are measured.
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      for (const background of ["ds-accent", "ds-accent-hi"]) {
        expect(
          contrast(themed(palette, "ds-accent-ink"), themed(palette, background)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("statistics strip", () => {
  it("measures the tile grids against the pane rather than the window", () => {
    // The figures are as wide as the game pane, and the splitter can take two
    // thirds of that away without the window changing by a pixel -- so the
    // two-column fallback the grids drop to has to be asked of the strip
    // itself. A `@media` query in its place would collapse the strip only
    // when the whole window narrowed, which on this page is the one thing
    // that cannot happen: `body.app` floors it at 1040px.
    expect(declaration(ruleBody(".statscontainer"), "container", ".statscontainer")).toBe(
      "panel / inline-size",
    );
    // Same name in the query as in the container, which is the whole of the
    // wiring: an `@container` naming something no ancestor opens does not
    // fail, it silently never matches, and the four- and three-column layouts
    // above it would then be the only ones a narrow pane ever got.
    expect(styleSource).toMatch(/^@container panel \(max-width: 520px\) \{$/m);
  });

  it("leaves the building the only row of the game pane that gives way", () => {
    // The goal bar and the figures each take their own content's height and
    // keep it; `.stagearea` is `flex: 1 1 auto` with a zero minimum, so a pane
    // too short for all three shrinks the stage -- the one box here with
    // somewhere to put a shortfall, since `.stage` scrolls. Without this the
    // browser's own `flex: 0 1 auto` would let the strip be squeezed instead,
    // and the figures at the foot of it cut in half.
    expect(styleSource).toMatch(
      /^\.pane-game > \.challenge,\n\.pane-game > \.statscontainer \{\n {2}flex: 0 0 auto;\n\}$/m,
    );
    const stageArea = ruleBody(".stagearea");
    expect(declaration(stageArea, "flex", ".stagearea")).toBe("1 1 auto");
    expect(declaration(stageArea, "min-block-size", ".stagearea")).toBe("0");
    // And the learning track's panel is not a row of that column any more --
    // it is an item of `.stagearea` beside the building. A rule putting it
    // back among the pane's own children would be the old layout returning by
    // the back door, with the panel sized twice and by two different boxes.
    expect(styleSource).not.toMatch(/\.pane-game > \.tutorial\b/);
  });

  it("takes a narrow pane out of the lesson and never out of the building", () => {
    // The two flex factors are one decision written in two places, and either
    // half alone inverts it: the aside states a 384px basis it is allowed to
    // shrink from, and the building states that it is not. Reversed, a pane
    // narrower than both would hold the lesson at its full measure and clip
    // the house the lesson is describing, which is the one box on this page
    // that has to stay whole.
    expect(declaration(ruleBody(".stagearea > .tutorial"), "flex", ".stagearea > .tutorial")).toBe(
      "0 1 384px",
    );
    expect(declaration(ruleBody(".stagearea > .world"), "flex-shrink", ".stagearea > .world")).toBe(
      "0",
    );
    // The ceiling is the other half of that refusal, and it is what keeps it
    // from turning into a licence: a zero shrink factor on an `auto` basis is a
    // *content* size, and this box's content is a building. Challenge 18's is
    // 1030px wide, and unbounded it made a 1062px `.world` inside a 794px pane
    // -- 268px of it clipped away with nothing to scroll, because `.stage` only
    // scrolls what it is narrower than. Capped at the row, the stage is
    // narrower again and its own `ResizeObserver` compresses the shafts to fit.
    expect(
      declaration(ruleBody(".stagearea > .world"), "max-inline-size", ".stagearea > .world"),
    ).toBe("100%");
    // Below the width where both fit, the row stacks instead of overflowing,
    // and it asks the pane rather than the window -- same reasoning as the
    // figures above, and the same failure if the names disagree: an
    // `@container` naming something no ancestor opens never matches and never
    // says so.
    //
    // The container is the pane and not the row, which is the part that has
    // already been got wrong once here: a query container is never the subject
    // of its own query, so `container: stage` on `.stagearea` left the
    // `flex-direction: column` inside the query matching nothing while the
    // rules for its children matched, and a 1040px window drew a lesson at its
    // full measure beside an 83px-wide building.
    expect(declaration(ruleBody(".pane-game"), "container", ".pane-game")).toBe(
      "stage / inline-size",
    );
    expect(ruleBody(".stagearea")).not.toMatch(/container/);
    expect(styleSource).toMatch(/^@container stage \(max-width: 760px\) \{$/m);
    // And stacked, the same priority has to be stated again in the other axis,
    // because the row's flex factors are about width and the two boxes are now
    // competing for height. The lesson is the one with no natural end: task 7
    // with its answer open asks for 1290px of the 399px row a 1040x600 window
    // leaves, and unbounded it took all of it -- the building measured 0px
    // tall. The ceiling is inside the query, so it is matched at that indent
    // rather than through `ruleBody`, which reads the unstacked rule.
    expect(styleSource).toMatch(/^ {2}\.stagearea > \.tutorial \{[^}]*\n {4}max-block-size: 50%;/m);
  });

  it("keeps the clip the run verdict is drawn inside", () => {
    // `.feedbackcontainer` is positioned against `.worldtrack`, and the card
    // it holds is the one thing on the stage with a size of its own rather
    // than the pane's -- floored at 420px wide, with a 30px-blur shadow past
    // that -- so with `overflow: visible` a narrow enough pane hands the page
    // scrollbars that lead nowhere at the end of every run. Both halves are
    // asserted because either one alone is useless: an unclipped positioning
    // context overflows, and a clip with no positioning context is not what
    // the card is measured from.
    const body = ruleBody(".worldtrack");
    expect(declaration(body, "position", ".worldtrack")).toBe("relative");
    expect(body).toMatch(/^\s*overflow:\s*hidden;/m);
  });
});

describe("the run verdict card", () => {
  it("lets the pointer through the sheet the card stands on", () => {
    // `.feedbackcontainer` is opened over the whole stage so the card inside
    // it can be centred on the building, and it stays open for the whole run,
    // empty. A sheet that could take the pointer would swallow every hover and
    // click the floors, the shafts and the cars live on -- silently, since a
    // transparent box looks like nothing at all -- so it passes the pointer
    // down and the card takes it back for itself.
    const container = ruleBody(".feedbackcontainer");
    expect(declaration(container, "inset", ".feedbackcontainer")).toBe("0");
    expect(declaration(container, "pointer-events", ".feedbackcontainer")).toBe("none");
    expect(declaration(ruleBody(".verdict"), "pointer-events", ".verdict")).toBe("auto");
  });

  it("stands the card over the stage's own bottom fade rather than under it", () => {
    // `.stagewrap::after` is the shadow that says a tall building carries on
    // below the fold, it is 22px tall, and the card sits 22px off the bottom
    // -- so the two overlap exactly. Neither box establishes a stacking
    // context of its own, which is what puts their z-indexes in competition
    // across the DOM, and a fade drawn over the verdict would grey out its
    // lower edge for no reason a reader could see.
    const fade = ruleBody(".stagewrap::before,\n.stagewrap::after");
    expect(Number(declaration(ruleBody(".verdict"), "z-index", ".verdict"))).toBeGreaterThan(
      Number(declaration(fade, "z-index", ".stagewrap::after")),
    );
  });

  it.each([
    ["dark", DARK_PALETTE],
    ["light", LIGHT_PALETTE],
  ])("keeps the verdict's message and its hint readable, %s theme", (_, palette) => {
    // The mockup paints the hint --text-faint, 3.62:1 dark and 3.14:1 light on
    // the card's own --ds-panel -- short of 1.4.3's 4.5:1 in both, which is
    // the same deviation `.meter-head .cap` and `.tierneed .now` already make.
    expect(declaration(ruleBody(".verdict p"), "color", ".verdict p")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-panel")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves the hint quieter than the message it hangs under", () => {
    // Written compound, `.verdict .verdict-more`, and that is the point of the
    // test: the mockup's own rule is a bare `.verdict-more`, which loses both
    // of its declarations to `.verdict p` on specificity and renders the hint
    // at the message's own size there. Since the ink is now the same for both
    // (above), size is the whole of what separates them.
    expect(styleSource, ".verdict-more is a bare rule again, and loses to .verdict p").not.toMatch(
      /^\.verdict-more\s*\{/m,
    );
    const message = declaration(ruleBody(".verdict p"), "font-size", ".verdict p");
    const hint = declaration(ruleBody(".verdict .verdict-more"), "font-size", ".verdict-more");
    expect(Number.parseFloat(hint)).toBeLessThan(Number.parseFloat(message));
  });

  it("drops the card's entrance for a reader who asked for no motion", () => {
    // The rise says nothing the mark, the headline and the live region do not
    // already say, so it goes entirely rather than being shortened -- the same
    // treatment `.blink`, `.meter-fill` and the car doors get.
    expect(styleSource).toMatch(
      /^@media \(prefers-reduced-motion: reduce\) \{\n {2}\.verdict \{\n {4}animation: none;\n {2}\}\n\}$/m,
    );
  });
});

describe("the error banner", () => {
  it("wraps a failure that has nowhere to break", () => {
    // The quoted failure is the player's own text and can be one unbroken
    // token of any length -- a thrown 400-character string with no spaces in
    // it. Nothing between the <code> and the document clips: a banner without
    // this laid that string out 3010px wide inside a 463px pane and gave the
    // whole page a horizontal scrollbar, which on a frame that is otherwise
    // exactly the window is the one overflow that cannot be lived with.
    expect(
      declaration(ruleBody(".errorline .errormessage"), "overflow-wrap", ".errormessage"),
    ).toBe("anywhere");
  });
});

describe("the fullscreen demo", () => {
  it("hides everything beside the building, starting at the body's own children", () => {
    // `#fullscreen` hides the page a link at a time -- body, main, workspace,
    // pane -- and each link is a selector that has to name the box the one
    // above it actually has. The first link is the one that has already been
    // wrong once: it read `.container > *:not(main)` while the game page still
    // wrapped its contents in one, and unwrapping that wrapper left it
    // matching nothing at all, so the app bar and the skip link stayed on
    // screen through a mode whose whole purpose is that they do not. Nothing
    // in the built page fails a check when this happens -- the demo is a route
    // flag with no assertion of its own -- so the chain is pinned here.
    const chain = /\.fullscreen-demo body > \*:not\(main\),\s*\.fullscreen-demo main > \*/;
    expect(styleSource).toMatch(chain);
    // The last two links are the same hazard one box deeper. `.world` is a
    // child of `.stagearea` now, so a chain that stopped at
    // `.pane-game > *:not(.world)` would match the box the building is inside
    // and hide the building with it -- the demo showing an empty pane, again
    // with nothing in the built page to fail.
    expect(styleSource).toMatch(
      /\.fullscreen-demo \.pane-game > \*:not\(\.stagearea\),\s*\.fullscreen-demo \.stagearea > \*:not\(\.world\)/,
    );
    // And the wrapper is not named anywhere in the demo's rules any more. A
    // leftover `.fullscreen-demo .container` would be dead rather than wrong,
    // but dead in a way that reads as though the mode still covers a box the
    // game page has not had since the app bar landed.
    expect(styleSource).not.toMatch(/\.fullscreen-demo[^,{]*\.container/);
  });
});
