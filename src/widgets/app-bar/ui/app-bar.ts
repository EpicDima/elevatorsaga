/**
 * The app bar's brand: its mark and the game's name.
 *
 * `src/main.ts` mounts this over the `<header>` `index.html` ships, so the bar
 * built here is the live page's own banner and the brand name is its `<h1>`.
 * The alternative — leaving `index.html`'s `<h1>` in place and nesting the
 * brand inside it — puts a heading-shaped box with the user agent's own
 * margins into a fixed-height flex row.
 *
 * Only the brand. The `.task` level switcher beside it is
 * `widgets/level-switcher`, the trailing toolbar is `settings-menu.ts`, and
 * `src/main.ts` composes the three into one row.
 */

/** SVG namespace, needed because the brand mark is built with `createElementNS`. */
const SVG_NS = "http://www.w3.org/2000/svg";

/** The text read out for the brand; supplied by the caller so this module
 * stays free of any one locale, the same reason
 * `widgets/workspace-layout`'s `WorkspaceLayoutLabels` takes its text this
 * way. */
export interface AppBarLabels {
  /** The game's name, shown next to the mark and read as the page's heading — `page.brand` today. */
  readonly brandName: string;
}

/** The elements {@link buildAppBarSkeleton} builds. */
export interface AppBarElements {
  /** The bar itself, ready for its caller to append the rest of the row beside the brand. */
  readonly appBar: HTMLElement;
  /** The mark and name together. */
  readonly brand: HTMLElement;
}

/**
 * Builds the app bar's brand, detached from any document.
 *
 * @param document - The document to create the elements in, so a caller can
 * build into a document other than the global one — see
 * `buildWorkspaceLayoutSkeleton`'s parameter of the same name for why.
 * @param labels - The localised brand text.
 * @returns The bar and the brand group inside it.
 */
export function buildAppBarSkeleton(document: Document, labels: AppBarLabels): AppBarElements {
  const mark = document.createElementNS(SVG_NS, "svg");
  mark.setAttribute("class", "brand-mark");
  mark.setAttribute("viewBox", "0 0 22 22");
  mark.setAttribute("aria-hidden", "true");

  const frame = document.createElementNS(SVG_NS, "rect");
  frame.setAttribute("x", "2");
  frame.setAttribute("y", "1.5");
  frame.setAttribute("width", "18");
  frame.setAttribute("height", "19");
  frame.setAttribute("rx", "2.5");
  frame.setAttribute("fill", "none");
  frame.setAttribute("stroke", "currentcolor");
  frame.setAttribute("stroke-width", "1.5");

  const nearShaft = document.createElementNS(SVG_NS, "rect");
  nearShaft.setAttribute("x", "5");
  nearShaft.setAttribute("y", "9");
  nearShaft.setAttribute("width", "5.5");
  nearShaft.setAttribute("height", "8.5");
  nearShaft.setAttribute("rx", "1");
  nearShaft.setAttribute("fill", "currentcolor");
  nearShaft.setAttribute("opacity", ".9");

  const farShaft = document.createElementNS(SVG_NS, "rect");
  farShaft.setAttribute("x", "12");
  farShaft.setAttribute("y", "4");
  farShaft.setAttribute("width", "5");
  farShaft.setAttribute("height", "8.5");
  farShaft.setAttribute("rx", "1");
  farShaft.setAttribute("fill", "currentcolor");
  farShaft.setAttribute("opacity", ".45");

  mark.append(frame, nearShaft, farShaft);

  // The page's one `<h1>` is the brand name itself, not a wrapper around it.
  const name = document.createElement("h1");
  name.className = "brand-name";
  name.textContent = labels.brandName;

  const brand = document.createElement("div");
  brand.className = "brand";
  brand.append(mark, name);

  const appBar = document.createElement("header");
  appBar.className = "appbar";
  appBar.append(brand);

  return { appBar, brand };
}
