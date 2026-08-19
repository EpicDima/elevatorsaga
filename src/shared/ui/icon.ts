/**
 * The inline SVG icon set, replacing the Font Awesome 4.1 webfont.
 *
 * The legacy markup used twelve glyphs from the bundled `font-awesome-4.1-1.0`
 * webfont (`.eot`/`.svg`/`.ttf`/`.woff`). Shipping an entire icon font — plus a
 * render-blocking stylesheet — for twelve glyphs is a lot of bytes, so the
 * outlines are inlined here and the font is dropped.
 *
 * Attribution: the path data below is copied verbatim from the glyph outlines in
 * `font-awesome-4.1-1.0/fonts/fontawesome-webfont.svg` by Dave Gandy
 * (https://fontawesome.com). Font Awesome 4 icon outlines are licensed under the
 * SIL OFL 1.1 (https://scripts.sil.org/OFL); the same artwork as shipped in Font
 * Awesome Free 5 and later is licensed under CC BY 4.0
 * (https://creativecommons.org/licenses/by/4.0/), which is not the licence this
 * artwork arrives under. See `fontawesome-license.txt` for the full text and
 * `fontawesome-glyphs.json` for which glyph came from which codepoint.
 *
 * Coordinate system: font outlines are y-up with the baseline at y = 0. Each
 * icon is emitted with a `viewBox` of `0 0 <advance> {@link ICON_EM_UNITS}` and
 * its path is flipped into SVG's y-down space by translating down to the ascent
 * and mirroring. Drawing an icon at `height: 1em` with the advance-derived width
 * therefore reproduces the metrics the webfont glyph had at the same font size.
 */

/** SVG namespace, needed because icons are built with `createElementNS`. */
const SVG_NS = "http://www.w3.org/2000/svg";

/** Font units per em in the Font Awesome 4 outlines. */
export const ICON_EM_UNITS = 1792;

/** Distance from the baseline to the top of the em box, in font units. */
export const ICON_ASCENT = 1536;

/** Transform that flips a y-up font outline into SVG's y-down space. */
const FLIP_TRANSFORM = `translate(0 ${String(ICON_ASCENT)}) scale(1 -1)`;

/** One icon: its horizontal advance in font units and its outline. */
interface IconDefinition {
  /** Horizontal advance in font units; drives the rendered width. */
  readonly advance: number;
  /** Outline path data, in y-up font units. */
  readonly path: string;
}

/** Every icon the game draws, keyed by the legacy `fa-*` class suffix. */
export const ICONS = {
  "arrow-circle-down": {
    advance: 1536,
    path: "M0 640q0 209 103 385.5t279.5 279.5t385.5 103t385.5 -103t279.5 -279.5t103 -385.5t-103 -385.5t-279.5 -279.5t-385.5 -103t-385.5 103t-279.5 279.5t-103 385.5zM252 639q0 -27 18 -45l362 -362l91 -91q18 -18 45 -18t45 18l91 91l362 362q18 18 18 45t-18 45l-91 91 q-18 18 -45 18t-45 -18l-189 -189v502q0 26 -19 45t-45 19h-128q-26 0 -45 -19t-19 -45v-502l-189 189q-19 19 -45 19t-45 -19l-91 -91q-18 -18 -18 -45z",
  },
  "arrow-circle-up": {
    advance: 1536,
    path: "M0 640q0 209 103 385.5t279.5 279.5t385.5 103t385.5 -103t279.5 -279.5t103 -385.5t-103 -385.5t-279.5 -279.5t-385.5 -103t-385.5 103t-279.5 279.5t-103 385.5zM252 641q0 -27 18 -45l91 -91q18 -18 45 -18t45 18l189 189v-502q0 -26 19 -45t45 -19h128q26 0 45 19 t19 45v502l189 -189q19 -19 45 -19t45 19l91 91q18 18 18 45t-18 45l-362 362l-91 91q-18 18 -45 18t-45 -18l-91 -91l-362 -362q-18 -18 -18 -45z",
  },
  "caret-right": {
    advance: 640,
    path: "M0 192v896q0 26 19 45t45 19t45 -19l448 -448q19 -19 19 -45t-19 -45l-448 -448q-19 -19 -45 -19t-45 19t-19 45z",
  },
  child: {
    advance: 1280,
    path: "M64 1056q0 40 28 68t68 28t68 -28l228 -228h368l228 228q28 28 68 28t68 -28t28 -68t-28 -68l-292 -292v-824q0 -46 -33 -79t-79 -33t-79 33t-33 79v384h-64v-384q0 -46 -33 -79t-79 -33t-79 33t-33 79v824l-292 292q-28 28 -28 68zM416 1152q0 93 65.5 158.5t158.5 65.5 t158.5 -65.5t65.5 -158.5t-65.5 -158.5t-158.5 -65.5t-158.5 65.5t-65.5 158.5z",
  },
  female: {
    advance: 1280,
    path: "M0 480q0 29 16 53l256 384q73 107 176 107h384q103 0 176 -107l256 -384q16 -24 16 -53q0 -40 -28 -68t-68 -28q-51 0 -80 43l-227 341h-45v-132l247 -411q9 -15 9 -33q0 -26 -19 -45t-45 -19h-192v-272q0 -46 -33 -79t-79 -33h-160q-46 0 -79 33t-33 79v272h-192 q-26 0 -45 19t-19 45q0 18 9 33l247 411v132h-45l-227 -341q-29 -43 -80 -43q-40 0 -68 28t-28 68zM416 1280q0 93 65.5 158.5t158.5 65.5t158.5 -65.5t65.5 -158.5t-65.5 -158.5t-158.5 -65.5t-158.5 65.5t-65.5 158.5z",
  },
  male: {
    advance: 1024,
    path: "M0 416v416q0 80 56 136t136 56h640q80 0 136 -56t56 -136v-416q0 -40 -28 -68t-68 -28t-68 28t-28 68v352h-64v-912q0 -46 -33 -79t-79 -33t-79 33t-33 79v464h-64v-464q0 -46 -33 -79t-79 -33t-79 33t-33 79v912h-64v-352q0 -40 -28 -68t-68 -28t-68 28t-28 68z M288 1280q0 93 65.5 158.5t158.5 65.5t158.5 -65.5t65.5 -158.5t-65.5 -158.5t-158.5 -65.5t-158.5 65.5t-65.5 158.5z",
  },
  minus: {
    advance: 1408,
    path: "M0 608v192q0 40 28 68t68 28h1216q40 0 68 -28t28 -68v-192q0 -40 -28 -68t-68 -28h-1216q-40 0 -68 28t-28 68z",
  },
  "minus-square": {
    advance: 1536,
    path: "M0 160v960q0 119 84.5 203.5t203.5 84.5h960q119 0 203.5 -84.5t84.5 -203.5v-960q0 -119 -84.5 -203.5t-203.5 -84.5h-960q-119 0 -203.5 84.5t-84.5 203.5zM256 576q0 -26 19 -45t45 -19h896q26 0 45 19t19 45v128q0 26 -19 45t-45 19h-896q-26 0 -45 -19t-19 -45v-128 z",
  },
  plus: {
    advance: 1408,
    path: "M0 608v192q0 40 28 68t68 28h416v416q0 40 28 68t68 28h192q40 0 68 -28t28 -68v-416h416q40 0 68 -28t28 -68v-192q0 -40 -28 -68t-68 -28h-416v-416q0 -40 -28 -68t-68 -28h-192q-40 0 -68 28t-28 68v416h-416q-40 0 -68 28t-28 68z",
  },
  "plus-square": {
    advance: 1536,
    path: "M0 160v960q0 119 84.5 203.5t203.5 84.5h960q119 0 203.5 -84.5t84.5 -203.5v-960q0 -119 -84.5 -203.5t-203.5 -84.5h-960q-119 0 -203.5 84.5t-84.5 203.5zM256 576q0 -26 19 -45t45 -19h320v-320q0 -26 19 -45t45 -19h128q26 0 45 19t19 45v320h320q26 0 45 19t19 45 v128q0 26 -19 45t-45 19h-320v320q0 26 -19 45t-45 19h-128q-26 0 -45 -19t-19 -45v-320h-320q-26 0 -45 -19t-19 -45v-128z",
  },
  repeat: {
    advance: 1536,
    path: "M0 640q0 156 61 298t164 245t245 164t298 61q147 0 284.5 -55.5t244.5 -156.5l130 129q29 31 70 14q39 -17 39 -59v-448q0 -26 -19 -45t-45 -19h-448q-42 0 -59 40q-17 39 14 69l138 138q-148 137 -349 137q-104 0 -198.5 -40.5t-163.5 -109.5t-109.5 -163.5 t-40.5 -198.5t40.5 -198.5t109.5 -163.5t163.5 -109.5t198.5 -40.5q119 0 225 52t179 147q7 10 23 12q14 0 25 -9l137 -138q9 -8 9.5 -20.5t-7.5 -22.5q-109 -132 -264 -204.5t-327 -72.5q-156 0 -298 61t-245 164t-164 245t-61 298z",
  },
  warning: {
    advance: 1792,
    path: "M16 61l768 1408q17 31 47 49t65 18t65 -18t47 -49l768 -1408q35 -63 -2 -126q-17 -29 -46.5 -46t-63.5 -17h-1536q-34 0 -63.5 17t-46.5 46q-37 63 -2 126zM752 992l17 -457q0 -10 10 -16.5t24 -6.5h185q14 0 23.5 6.5t10.5 16.5l18 459q0 12 -10 19q-13 11 -24 11h-220 q-11 0 -24 -11q-10 -7 -10 -21zM768 161q0 -14 9.5 -23.5t22.5 -9.5h192q13 0 22.5 9.5t9.5 23.5v190q0 14 -9.5 23.5t-22.5 9.5h-192q-13 0 -22.5 -9.5t-9.5 -23.5v-190z",
  },
} as const satisfies Record<string, IconDefinition>;

/** Name of an icon in {@link ICONS}; matches the legacy `fa-*` class suffix. */
export type IconName = keyof typeof ICONS;

/**
 * Rendered width of an icon, in `em`, matching the webfont glyph advance.
 *
 * @param name - Icon to measure.
 * @returns The width as a CSS `em` length, rounded to four decimals.
 */
export function iconWidthEm(name: IconName): string {
  return `${(ICONS[name].advance / ICON_EM_UNITS).toFixed(4)}em`;
}

/**
 * Builds an icon element.
 *
 * Icons are decorative: they are hidden from assistive technology and kept out
 * of the tab order, because every control that carries one also carries either
 * visible text or an `aria-label`.
 *
 * @param name - Icon to draw.
 * @param className - Extra classes to add alongside `icon`.
 * @returns A detached `<svg>` element that takes its colour from `currentColor`.
 */
export function createIcon(name: IconName, className?: string): SVGSVGElement {
  const { advance, path } = ICONS[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className === undefined ? "icon" : `icon ${className}`);
  svg.setAttribute("viewBox", `0 0 ${String(advance)} ${String(ICON_EM_UNITS)}`);
  svg.setAttribute("width", iconWidthEm(name));
  svg.setAttribute("height", "1em");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const pathEl = document.createElementNS(SVG_NS, "path");
  pathEl.setAttribute("transform", FLIP_TRANSFORM);
  pathEl.setAttribute("d", path);
  svg.append(pathEl);
  return svg;
}

/**
 * Markup for an icon, for embedding in a template literal.
 *
 * The result is trusted markup: it is built only from this module's constants
 * and the caller-supplied class name, never from player input.
 *
 * @param name - Icon to draw.
 * @param className - Extra classes to add alongside `icon`.
 * @returns The `<svg>` markup.
 */
export function iconMarkup(name: IconName, className?: string): string {
  const { advance, path } = ICONS[name];
  const classes = className === undefined ? "icon" : `icon ${className}`;
  return (
    `<svg class="${classes}" viewBox="0 0 ${String(advance)} ${String(ICON_EM_UNITS)}"` +
    ` width="${iconWidthEm(name)}" height="1em" fill="currentColor" aria-hidden="true"` +
    ` focusable="false"><path transform="${FLIP_TRANSFORM}" d="${path}"/></svg>`
  );
}

/**
 * `design/ui-mockup.html`'s own icon family: flat 16x16 outlines, drawn from
 * scratch for this redesign rather than traced from a webfont. Kept as its
 * own table rather than folded into {@link ICONS} because the two do not
 * share a shape — a mockup glyph is one or more raw SVG shapes at native
 * 16x16 size, some with their own paint overrides (a filled star, a
 * heavier-stroked check mark), where every {@link ICONS} entry is exactly one
 * path, flipped out of a webfont's y-up em box. A consumer gets its own
 * `ds-icon` wrapper class rather than reusing `icon` for the same reason
 * `style.css`'s design tokens went in under a `--ds-` prefix: this family's
 * sizing is fixed-pixel, not em-relative like the legacy glyphs already
 * styled through `.icon`, and the two would fight over that class once either
 * gets a stylesheet rule.
 *
 * Grows one glyph at a time, as this migration's widgets actually need one,
 * rather than transcribing the mockup's whole sprite sheet up front.
 */
export const SPRITE_ICONS = {
  // The mockup draws every stroked glyph in this family through one shared
  // ".icon" CSS rule (fill: none; stroke: currentcolor; stroke-width: 1.6;
  // round caps/joins) rather than per-shape attributes. `style.css`'s own
  // `.ds-icon` rule now carries that same default too, but each stroked
  // shape below still spells it out explicitly — the same reason `star`
  // spells out its own paint rather than leaving it to inherited CSS.
  //
  // The docs opener's glyph (`#docsOpen`): an open book, split down the
  // spine.
  book: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M2.5 3.5h4a2 2 0 0 1 2 2v8a1.6 1.6 0 0 0-1.6-1.5H2.5v-8.5Z",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M13.5 3.5h-4a2 2 0 0 0-2 2v8a1.6 1.6 0 0 1 1.6-1.5h4.4v-8.5Z",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  check: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "m3.5 8.5 3 3 6-7",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The mockup's own copy-link glyph, `#seedCopy`. Kept alongside `dice` even
  // though `features/manage-seed` does not wire either affordance up — see
  // that slice's module comment for why: the mockup's own `#seedCopy` has no
  // click handler anywhere in its script, and there is no arbitrary-seed
  // text field in production to reroll in the first place.
  copy: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "5.5",
          y: "5.5",
          width: "8",
          height: "8",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M10.5 3.5h-7a1 1 0 0 0-1 1v7",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The tier popover's "not decided yet" mark, between check and x — the
  // requirement it sits on is neither held nor lost while a run is live.
  dash: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M4 8h8",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The seed block's reroll glyph, `#seedRoll`. Kept alongside `copy` even
  // though `features/manage-seed` does not wire either affordance up — see
  // that slice's module comment for why: production has no arbitrary-seed
  // text input to reroll in the first place, only the URL-driven seed the
  // mockup's own `#seedVal` field has no real equivalent for.
  dice: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "2.5",
          y: "2.5",
          width: "11",
          height: "11",
          rx: "2.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "circle",
        attrs: { cx: "5.8", cy: "5.8", r: ".9", fill: "currentcolor", stroke: "none" },
      },
      {
        tag: "circle",
        attrs: { cx: "10.2", cy: "10.2", r: ".9", fill: "currentcolor", stroke: "none" },
      },
      {
        tag: "circle",
        attrs: { cx: "8", cy: "8", r: ".9", fill: "currentcolor", stroke: "none" },
      },
    ],
  },
  // The mockup's `#i-down` (§6): a floor's "call a car going down" lamp, and
  // the lower of the two boarding lamps drawn on a car's own header. Both are
  // the same glyph at two sizes, exactly as the mockup draws them.
  down: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M8 3v9m0 0 4-4m-4 4-4-4",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The settings popover's own trigger row for its seed help disclosure's
  // sibling block — the mockup's `#keysOpen` glyph, a stylised keyboard.
  keys: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "1.5",
          y: "3.5",
          width: "13",
          height: "9",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M4 9.5h.01M11.5 9.5h.01",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M6.5 9.5h3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The goal bar's "nothing to meter here" mark, for the demo/sandbox tiles'
  // never-resolving challenge condition.
  lamp: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M8 2v1.5M3.5 8H2m12 0h-1.5M4.6 4.6 3.5 3.5m8.9 1.1 1.1-1.1",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "circle",
        attrs: {
          cx: "8",
          cy: "8.5",
          r: "3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M6.5 13h3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The speed control's "slower" arrow, `#i-left` — {@link SPRITE_ICONS.right}
  // mirrored, so that the pair either side of the speed reading reads as one
  // control pointing two ways.
  left: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "m10 3-5 5 5 5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The About block's own glyph, next to the two `.setlink` anchors out to
  // this fork's and the original game's repositories.
  link: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M9.5 3h3.5v3.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M13 3 7.5 8.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M11 9.5V12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 2 12V6a1.5 1.5 0 0 1 1.5-1.5H6",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `features/switch-layout`'s "code only" button — the workspace collapsed
  // to just its editor pane.
  "only-code": {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "1.5",
          y: "2.5",
          width: "13",
          height: "11",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M5.5 6.5 3.8 8l1.7 1.5m5-3L12.2 8l-1.7 1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `features/switch-layout`'s "game only" button — the workspace collapsed
  // to just its building pane.
  "only-game": {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "1.5",
          y: "2.5",
          width: "13",
          height: "11",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M5 11V7m3 4V5m3 6V9",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The run button's glyph while a run is playing, `#i-pause`. Two bars, drawn
  // at 2.4 rather than the family's 1.6: a pause mark is read as two solid
  // blocks, and at 16px the shared stroke width draws it as two hairlines.
  pause: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M6 3.5v9M10 3.5v9",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // A passenger, the mockup's `#i-person` (§6). Two filled shapes rather than
  // an outline, and the only glyphs in this table whose viewBox is not 16x16:
  // a person is drawn 11 wide by 20 tall so the figure fills its box at every
  // size the building scales it to, from a rider squeezed into a narrow cabin
  // to a full-height figure waiting in a roomy corridor. An outline at those
  // sizes is the same blob `star`'s own comment describes.
  person: {
    viewBox: "0 0 11 20",
    shapes: [
      {
        tag: "circle",
        attrs: { cx: "5.5", cy: "3.6", r: "2.6", fill: "currentColor", stroke: "none" },
      },
      {
        tag: "path",
        attrs: {
          d: "M5.5 7.4c-2 0-3 1.3-3 3v4.2h1.3V20h3.4v-5.4h1.3v-4.2c0-1.7-1-3-3-3Z",
          fill: "currentColor",
          stroke: "none",
        },
      },
    ],
  },
  // The other two of `game/world.ts`'s three `displayType`s, which the mockup
  // has no equivalent for at all — it draws one figure and gives its people no
  // types. Dropping the distinction would have been the closer port and the
  // worse one: the simulation has assigned every passenger a type since the
  // original game, purely so a crowd on a floor reads as a crowd of people
  // rather than a row of one repeated stamp, and a redesign is no reason to
  // quietly delete a thing that already works. So the two extra silhouettes are
  // drawn in this family's own flat-fill idiom rather than kept as the Font
  // Awesome outlines they used to be (`ICONS.female`/`ICONS.child`), which read
  // as smudges at the 9-20px a figure actually gets here.
  //
  // A child stands in the same 11x20 box as an adult, occupying only its lower
  // two-thirds, so that both are sized by one CSS height and still stand on the
  // same line — the box is the floor, not the figure.
  "person-child": {
    viewBox: "0 0 11 20",
    shapes: [
      {
        tag: "circle",
        attrs: { cx: "5.5", cy: "9.2", r: "2.2", fill: "currentColor", stroke: "none" },
      },
      {
        tag: "path",
        attrs: {
          d: "M5.5 12.4c-1.7 0-2.5 1.1-2.5 2.5v2.6h1.1V20h2.8v-2.5h1.1v-2.6c0-1.4-.8-2.5-2.5-2.5Z",
          fill: "currentColor",
          stroke: "none",
        },
      },
    ],
  },
  "person-female": {
    viewBox: "0 0 11 20",
    shapes: [
      {
        tag: "circle",
        attrs: { cx: "5.5", cy: "3.6", r: "2.6", fill: "currentColor", stroke: "none" },
      },
      {
        tag: "path",
        attrs: {
          d: "M5.5 7.4c-1.8 0-2.7 1.1-3 2.6L1.8 14.6h1.9V20h3.6v-5.4h1.9L8.5 10c-.3-1.5-1.2-2.6-3-2.6Z",
          fill: "currentColor",
          stroke: "none",
        },
      },
    ],
  },
  // The run button's glyph while a run is stopped, `#i-play`. Filled *and*
  // stroked, unlike {@link SPRITE_ICONS.star}, which turns the family's stroke
  // off when it turns the fill on: the mockup's own `#i-play` overrides only
  // `fill`, so the 1.6 round-joined stroke stays and the triangle draws with
  // the same softened corners and the same optical weight as the pause bars it
  // swaps with.
  play: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M5 3.5v9l8-4.5-8-4.5Z",
          fill: "currentColor",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `widgets/editor-pane`'s "Undo reset" glyph: {@link SPRITE_ICONS.undo}
  // mirrored about the middle of the box, arrowhead and all. The mockup has no
  // such button — bringing back the program a reset threw away is a production
  // affordance its static page never needed — so this is the one glyph in this
  // table drawn rather than copied, and it is drawn from the mockup's own undo
  // path so that the pair reads as one control turned around, which is what
  // the two buttons are.
  redo: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M13 8h-7a3 3 0 0 0 0 6h4M13 8l-3-3M13 8l-3 3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The "Start over" button's glyph, `#i-restart`: a circle open at the top
  // with an arrowhead turning back into it. Distinct from {@link
  // SPRITE_ICONS.undo}, which the editor pane uses for throwing an edit away —
  // this one throws a *run* away, and the two sit in the same bar.
  restart: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M13 8a5 5 0 1 1-1.6-3.7M13 3v3h-3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The mockup's generic disclosure chevron, `#i-right` — used by the
  // settings popover's `keysOpen` row (`.chev`) among other places, and as the
  // speed control's own "faster" arrow.
  right: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "m6 3 5 5-5 5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The settings trigger's own glyph, `#setOpen` — sliders standing in for
  // "preferences" the same way a gear does elsewhere.
  slider: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M2 5h8M2 11h4",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "circle",
        attrs: {
          cx: "12",
          cy: "5",
          r: "1.8",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "circle",
        attrs: {
          cx: "8",
          cy: "11",
          r: "1.8",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `features/switch-layout`'s "code left" button — the divider drawn on the
  // right two-thirds of the way across.
  "split-left": {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "1.5",
          y: "2.5",
          width: "13",
          height: "11",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M6.5 2.5v11",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `features/switch-layout`'s "code right" button — the divider drawn on the
  // left third of the way across.
  "split-right": {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "rect",
        attrs: {
          x: "1.5",
          y: "2.5",
          width: "13",
          height: "11",
          rx: "1.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M9.5 2.5v11",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // Filled solid rather than outlined, unlike every other glyph in this
  // table: at the 10-11px a star draws in a tile or a tier badge, an
  // outlined star is a blob, not a star.
  star: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M8 2 9.76 6.17 14.28 6.56 10.85 9.53 11.88 13.94 8 11.6 4.12 13.94 5.15 9.53 1.72 6.56 6.24 6.17Z",
          fill: "currentColor",
          stroke: "none",
        },
      },
    ],
  },
  // `widgets/editor-pane`'s "Reset code" glyph, `#i-undo`: an arrow curling
  // back on itself, the mark every editor uses for "put it back the way it
  // was".
  undo: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M3 8h7a3 3 0 0 1 0 6H6M3 8l3-3M3 8l3 3",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The mockup's `#i-up` (§6); see `down` above for where the pair is drawn.
  up: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M8 13V4m0 0L4 8m4-4 4 4",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // `widgets/editor-pane`'s error banner glyph, `#i-warn`: a hollow triangle
  // with a bang in it. Outlined rather than the solid Font Awesome
  // `warning` triangle the banner drew before, so that it sits at the same
  // weight as `undo` and `redo` a row above it, and so that the tinted
  // `--ds-bad-soft` band shows through it instead of being blotted out by a
  // 16px block of `--ds-bad`.
  warn: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M8 2.5 15 14H1L8 2.5Z",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
      {
        tag: "path",
        attrs: {
          d: "M8 6.5v3.2M8 11.8v.6",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.6",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
  // The tier popover's "requirement missed" mark, once a run has ended.
  x: {
    viewBox: "0 0 16 16",
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "m4 4 8 8M12 4l-8 8",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ],
  },
} as const satisfies Record<string, SpriteIconDefinition>;

/** Name of a mockup-family icon in {@link SPRITE_ICONS}. */
export type SpriteIconName = keyof typeof SPRITE_ICONS;

/** One shape making up a {@link SpriteIconDefinition} — a direct, typed stand-in for an SVG element. */
interface SpriteShape {
  /** The SVG element to build. */
  readonly tag: "circle" | "path" | "rect";
  /** Attributes to set on it verbatim, copied from the mockup's own markup. */
  readonly attrs: Readonly<Record<string, string>>;
}

/** One mockup-family icon: its native viewBox and the shapes that draw it. */
interface SpriteIconDefinition {
  readonly viewBox: string;
  readonly shapes: readonly SpriteShape[];
}

/**
 * Builds a mockup-family icon element.
 *
 * Decorative and out of the tab order for the same reason {@link createIcon}
 * is: every control that carries one also carries its own visible text or
 * `aria-label`.
 *
 * @param name - Icon to draw.
 * @param className - Extra classes to add alongside `ds-icon`.
 * @returns A detached `<svg>` element that takes its colour from `currentColor`
 * unless one of its shapes overrides that.
 */
export function createSpriteIcon(name: SpriteIconName, className?: string): SVGSVGElement {
  const { viewBox, shapes } = SPRITE_ICONS[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className === undefined ? "ds-icon" : `ds-icon ${className}`);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const shape of shapes) {
    const element = document.createElementNS(SVG_NS, shape.tag);
    for (const [attribute, value] of Object.entries(shape.attrs)) {
      element.setAttribute(attribute, value);
    }
    svg.append(element);
  }
  return svg;
}

/**
 * Markup for a mockup-family icon, for embedding in a template literal.
 *
 * The result is trusted markup, built only from {@link SPRITE_ICONS} and the
 * caller-supplied class name, never from player input.
 *
 * @param name - Icon to draw.
 * @param className - Extra classes to add alongside `ds-icon`.
 * @returns The `<svg>` markup.
 */
export function spriteIconMarkup(name: SpriteIconName, className?: string): string {
  const { viewBox, shapes } = SPRITE_ICONS[name];
  const classes = className === undefined ? "ds-icon" : `ds-icon ${className}`;
  const inner = shapes
    .map((shape) => {
      const attrs = Object.entries(shape.attrs)
        .map(([attribute, value]) => `${attribute}="${value}"`)
        .join(" ");
      return `<${shape.tag} ${attrs}/>`;
    })
    .join("");
  return (
    `<svg class="${classes}" viewBox="${viewBox}" aria-hidden="true" focusable="false">` +
    `${inner}</svg>`
  );
}
