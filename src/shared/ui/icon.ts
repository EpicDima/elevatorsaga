/**
 * Inline SVG icon set, replacing the Font Awesome 4.1 webfont. Path data is
 * copied verbatim from the Font Awesome 4 glyph outlines (SIL OFL 1.1), not
 * the CC BY 4.0 artwork in Font Awesome 5+.
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
  // Hand-duplicated in the reference page's static HTML; keep them in sync.
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
 * Rendered width of an icon in `em`, matching the webfont glyph's advance.
 *
 * @returns A CSS `em` length, rounded to four decimals.
 */
export function iconWidthEm(name: IconName): string {
  return `${(ICONS[name].advance / ICON_EM_UNITS).toFixed(4)}em`;
}

/**
 * Builds an icon element. Decorative: hidden from assistive tech and out of
 * the tab order, since every control with one also carries visible text or
 * an `aria-label`.
 *
 * @param className - Added alongside the `icon` class, not in place of it.
 * @returns A detached `<svg>` that takes its color from `currentColor`.
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
 * Markup for an icon, for embedding in a template literal. Trusted markup:
 * built only from this module's constants and the caller's class name, never
 * from player input.
 *
 * @param className - Added alongside the `icon` class, not in place of it.
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
 * The stroked icon family: flat 16x16 outlines, distinct from {@link ICONS}'s
 * webfont-traced paths. Uses a `ds-icon` wrapper class, not `icon`, since this
 * family is fixed-pixel rather than em-relative.
 */
export const SPRITE_ICONS = {
  // Docs opener glyph.
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
  // The seed row's copy-link glyph.
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
  // Tier popover's "not decided yet" mark, between check and x.
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
  // The seed row's reroll glyph, shown once the run is pinned.
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
  // Down-call lamp; also the lower boarding lamp on a car's header.
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
  // Keyboard glyph for the hotkeys-dialog row.
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
  // Goal bar's "nothing to meter" mark, for sandbox levels.
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
  // Speed control's "slower" arrow; mirror of {@link SPRITE_ICONS.right}.
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
  // The source block's glyph, next to the repository links.
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
  // Switch-layout's "code only" button.
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
  // Switch-layout's "game only" button.
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
  // Run button's "playing" glyph. Stroke-width 2.4, not the family's 1.6, so
  // the bars read as solid blocks rather than hairlines.
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
  // Passenger glyph. Filled, not outlined, and 11x20, not this family's usual
  // 16x16, so the figure fills its box at any scale the building draws it at.
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
  // Child and female passenger variants, flat-filled like `person`. A child
  // sits in the box's lower two-thirds so both share one baseline.
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
  // Run button's "stopped" glyph. Filled and stroked, unlike `star`, so its
  // corners match the pause bars it swaps with.
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
  // Editor pane's "redo" glyph; mirror of {@link SPRITE_ICONS.undo}.
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
  // "Start over" button's glyph; distinct from `undo`, which discards an edit
  // rather than a run.
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
  // Disclosure chevron; also the speed control's "faster" arrow.
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
  // Settings trigger's glyph.
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
  // Switch-layout's "code left" button.
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
  // Switch-layout's "code right" button.
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
  // Filled solid, not outlined: at the ~10px this draws, an outline is a blob.
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
  // Editor pane's "reset code" glyph.
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
  // Up-call lamp; pair of `down`.
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
  // Editor pane's error-banner glyph. Outlined, not solid, so the tinted
  // `--ds-bad-soft` band shows through it.
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
 * Builds a sprite icon element. Decorative, same as {@link createIcon}.
 *
 * @param className - Added alongside the `ds-icon` class, not in place of it.
 * @returns A detached `<svg>`; color is `currentColor` unless a shape overrides it.
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
 * Markup for a sprite icon, for embedding in a template literal. Trusted
 * markup, built only from {@link SPRITE_ICONS} and the caller's class name,
 * never from player input.
 *
 * @param className - Added alongside the `ds-icon` class, not in place of it.
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
