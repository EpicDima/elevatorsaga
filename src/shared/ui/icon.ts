/**
 * The inline SVG icon set, replacing the Font Awesome 4.1 webfont.
 *
 * The legacy markup drew its icons from the bundled `font-awesome-4.1-1.0`
 * webfont (`.eot`/`.svg`/`.ttf`/`.woff`). Shipping an entire icon font — plus a
 * render-blocking stylesheet — for a handful of glyphs is a lot of bytes, so
 * the outlines are inlined here and the font is dropped.
 *
 * Attribution: the path data below is copied verbatim from the glyph outlines in
 * `font-awesome-4.1-1.0/fonts/fontawesome-webfont.svg` by Dave Gandy
 * (https://fontawesome.com). Font Awesome 4 icon outlines are licensed under the
 * SIL OFL 1.1 (https://scripts.sil.org/OFL); the same artwork as shipped in Font
 * Awesome Free 5 and later is licensed under CC BY 4.0
 * (https://creativecommons.org/licenses/by/4.0/), which is not the license this
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
  // The verdict toast's "next level" arrow.
  "caret-right": {
    advance: 640,
    path: "M0 192v896q0 26 19 45t45 19t45 -19l448 -448q19 -19 19 -45t-19 -45l-448 -448q-19 -19 -45 -19t-45 19t-19 45z",
  },
  // The reference page's two floor-button glyphs. It is static HTML and writes
  // them out by hand; these entries are what `src/page.test.ts` holds the
  // hand-written pair to.
  minus: {
    advance: 1408,
    path: "M0 608v192q0 40 28 68t68 28h1216q40 0 68 -28t28 -68v-192q0 -40 -28 -68t-68 -28h-1216q-40 0 -68 28t-28 68z",
  },
  plus: {
    advance: 1408,
    path: "M0 608v192q0 40 28 68t68 28h416v416q0 40 28 68t68 28h192q40 0 68 -28t28 -68v-416h416q40 0 68 -28t28 -68v-192q0 -40 -28 -68t-68 -28h-416v-416q0 -40 -28 -68t-68 -28h-192q-40 0 -68 28t-28 68v416h-416q-40 0 -68 28t-28 68z",
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
 * @returns A detached `<svg>` element that takes its color from `currentColor`.
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
 * The stroked icon family: flat 16x16 outlines drawn for this design rather
 * than traced from a webfont. Kept apart from {@link ICONS} because the two do
 * not share a shape — an entry here is one or more raw SVG shapes at native
 * 16x16 size, some with their own paint overrides (a filled star, a
 * heavier-stroked check mark), where every {@link ICONS} entry is exactly one
 * path flipped out of a webfont's y-up em box. Consumers wear a `ds-icon`
 * wrapper class rather than `icon`: this family is fixed-pixel, not
 * em-relative, and the two would fight over one class.
 */
export const SPRITE_ICONS = {
  // `.ds-icon` already carries the stroked default (no fill, `currentcolor`,
  // 1.6 wide, round caps and joins), but every stroked shape below spells it
  // out anyway, the same reason `star` spells out its own paint rather than
  // leaving it to inherited CSS.
  //
  // The docs opener's glyph: an open book, split down the spine.
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
  // The copy-link glyph. `features/manage-seed` draws it on the seed row's
  // link while the run is unpinned: pinning this draw into the address bar is
  // the same gesture under another name.
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
  // The seed block's reroll glyph. `features/manage-seed` draws it on the seed
  // row's link once the run is pinned: throwing this draw away and starting
  // again without it is the reroll.
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
  // A floor's "call a car going down" lamp, and the lower of the two boarding
  // lamps on a car's header. Both are this one glyph at two sizes.
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
  // A stylized keyboard, on the settings popover's row that opens the hotkeys
  // dialog.
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
  // The goal bar's "nothing to meter here" mark, for the sandbox's own
  // never-resolving level condition.
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
  // A passenger. Two filled shapes rather than an outline, and the only glyphs
  // in this table whose viewBox is not 16x16:
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
  // The other two of `game/world.ts`'s three `displayType`s. Every passenger
  // carries a type so that a crowd on a floor reads as a crowd of people
  // rather than one repeated stamp. Both are drawn in this family's flat-fill
  // idiom: an outline reads as a smudge at the size a figure gets here.
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
  // The run button's glyph while a run is stopped. Filled *and* stroked,
  // unlike {@link SPRITE_ICONS.star}, which turns the stroke off when it turns
  // the fill on: keeping the round-joined stroke gives the triangle the same
  // softened corners and optical weight as the pause bars it swaps with.
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
  // mirrored about the middle of the box, arrowhead and all, so the pair reads
  // as one control turned around -- which is what the two buttons are.
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
  // The generic disclosure chevron: the settings popover's `keysOpen` row
  // (`.chev`) among other places, and the speed control's "faster" arrow.
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
  // See `down` above for where the pair is drawn.
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

/** Name of a sprite icon in {@link SPRITE_ICONS}. */
export type SpriteIconName = keyof typeof SPRITE_ICONS;

/** One shape making up a {@link SpriteIconDefinition} — a direct, typed stand-in for an SVG element. */
interface SpriteShape {
  /** The SVG element to build. */
  readonly tag: "circle" | "path" | "rect";
  /** Attributes to set on it verbatim. */
  readonly attrs: Readonly<Record<string, string>>;
}

/** One sprite icon: its native viewBox and the shapes that draw it. */
interface SpriteIconDefinition {
  readonly viewBox: string;
  readonly shapes: readonly SpriteShape[];
}

/**
 * Builds a sprite icon element.
 *
 * Decorative and out of the tab order for the same reason {@link createIcon}
 * is: every control that carries one also carries its own visible text or
 * `aria-label`.
 *
 * @param name - Icon to draw.
 * @param className - Extra classes to add alongside `ds-icon`.
 * @returns A detached `<svg>` element that takes its color from `currentColor`
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
 * Markup for a sprite icon, for embedding in a template literal.
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
