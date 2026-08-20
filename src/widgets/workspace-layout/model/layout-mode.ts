/**
 * The four-way workspace layout and the splitter boundary between its panes.
 *
 * Ported from `design/ui-mockup.html`'s layout script (§A, "Раскладка: четыре
 * режима и один разделитель"): the workspace shows the building and the editor
 * side by side, and a player can put the editor on the right (the shipped
 * default), on the left, or drop to a single pane — code only or building
 * only — for a narrower window or a narrower attention span. One `split`
 * percentage is kept rather than one per mode: "left" and "right" are the same
 * boundary reflected, so switching between them moves the panes without
 * changing how wide either one is.
 *
 * This module is the pure half — arithmetic and storage, no DOM. The half that
 * drags the boundary and builds the pane skeleton is
 * `../ui/workspace-layout.ts`.
 */

/** Which panes the workspace shows, and on which side. */
export type LayoutMode = "right" | "left" | "code" | "game";

/** Every {@link LayoutMode}, for validating a stored or requested one. */
const LAYOUT_MODES: readonly LayoutMode[] = ["right", "left", "code", "game"];

/** The mode the workspace opens in until a player has chosen otherwise. */
export const DEFAULT_LAYOUT_MODE: LayoutMode = "right";

/**
 * The default share of the workspace's width the first pane gets, in
 * "right" mode: the building. Named `split` rather than e.g. `codeWidth`
 * because a percentage is what the mockup's own `--split-x` custom property
 * and this module's storage both hold, and both panes read the same number.
 */
export const DEFAULT_SPLIT_PERCENT = 62;

/** The split may not be dragged narrower than this, whatever the window. */
export const MIN_SPLIT_PERCENT = 20;

/** The split may not be dragged wider than this, whatever the window. */
export const MAX_SPLIT_PERCENT = 85;

/**
 * The narrowest either pane may be driven to, in pixels.
 *
 * Below this a pane stops being usable before it stops being visible: the
 * building has nowhere to shrink its shafts, and the editor's gutter alone is
 * wider than this on some screens. {@link splitRange} tightens
 * {@link MIN_SPLIT_PERCENT}/{@link MAX_SPLIT_PERCENT} further whenever the
 * fixed percentages would let a pane fall under it.
 */
export const MIN_PANE_WIDTH = 380;

/** How far one press of the splitter's arrow keys moves it, in percent. */
export const SPLIT_STEP_PERCENT = 2;

/**
 * Where the chosen layout mode is remembered between visits.
 *
 * `develevate…` like this fork's other invented keys — see
 * `src/entities/tutorial-level/model/progress.ts` for why the prefix matters.
 */
export const LAYOUT_MODE_STORAGE_KEY = "develevateLayoutMode";

/** Where the chosen split percentage is remembered between visits. */
export const SPLIT_PERCENT_STORAGE_KEY = "develevateSplitPercent";

/**
 * Whether a stored or requested string names a real layout mode.
 *
 * @param value - The candidate.
 * @returns Whether it is one of {@link LAYOUT_MODES}.
 */
function isLayoutMode(value: string): value is LayoutMode {
  return (LAYOUT_MODES as readonly string[]).includes(value);
}

/**
 * The layout mode remembered from a previous visit.
 *
 * Anything unreadable or unrecognised is treated as "nothing chosen yet"
 * rather than reported, the same trade `readClearedTutorialLevels` makes: there
 * is nothing a player can do about a corrupt entry, and the next choice
 * overwrites it.
 *
 * @param storage - Where the mode is remembered.
 * @returns The remembered mode, or {@link DEFAULT_LAYOUT_MODE}.
 */
export function readLayoutMode(storage: Storage): LayoutMode {
  let stored: string | null;
  try {
    stored = storage.getItem(LAYOUT_MODE_STORAGE_KEY);
  } catch {
    return DEFAULT_LAYOUT_MODE;
  }
  return stored !== null && isLayoutMode(stored) ? stored : DEFAULT_LAYOUT_MODE;
}

/**
 * Remembers the chosen layout mode, or does not.
 *
 * A store that refuses the write is not an error here: the mode chosen just
 * now is what matters for this tab, not whether it survives to the next one.
 *
 * @param storage - Where to remember it.
 * @param mode - The mode to remember.
 */
export function saveLayoutMode(storage: Storage, mode: LayoutMode): void {
  try {
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    // As above: a browser that refuses storage should not stop the game.
  }
}

/**
 * The split percentage remembered from a previous visit.
 *
 * @param storage - Where the split is remembered.
 * @returns The remembered percentage, or {@link DEFAULT_SPLIT_PERCENT} when
 * nothing usable was stored. Not yet clamped to the current window — see
 * {@link splitRange} and {@link clampSplitPercent}.
 */
export function readSplitPercent(storage: Storage): number {
  let stored: string | null;
  try {
    stored = storage.getItem(SPLIT_PERCENT_STORAGE_KEY);
  } catch {
    return DEFAULT_SPLIT_PERCENT;
  }
  if (stored === null) {
    return DEFAULT_SPLIT_PERCENT;
  }
  const parsed = Number.parseFloat(stored);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SPLIT_PERCENT;
}

/**
 * Remembers the chosen split percentage, or does not.
 *
 * @param storage - Where to remember it.
 * @param percent - The percentage to remember.
 */
export function saveSplitPercent(storage: Storage, percent: number): void {
  try {
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, String(percent));
  } catch {
    // As above.
  }
}

/**
 * How far the splitter may be dragged in a workspace of a given width.
 *
 * Ported from the mockup's `splitRange()`: neither pane may be driven under
 * {@link MIN_PANE_WIDTH}, so the usual {@link MIN_SPLIT_PERCENT}/
 * {@link MAX_SPLIT_PERCENT} bounds tighten on a narrow window and relax back
 * to them once the window is wide enough that a bound of its own would matter
 * more.
 *
 * @param workspaceWidth - The workspace's current width in pixels. A
 * non-positive value (an unmeasured or detached element, where `clientWidth`
 * reads `0`) is treated as the mockup's own fallback of 1440 — the point of
 * the fallback is to keep the splitter usable before the first real layout,
 * not to describe any particular screen.
 * @returns `[low, high]`, the narrowest and widest the split may be.
 */
export function splitRange(workspaceWidth: number): readonly [number, number] {
  const width = workspaceWidth > 0 ? workspaceWidth : 1440;
  const edge = Math.min(40, (MIN_PANE_WIDTH / width) * 100);
  return [Math.max(MIN_SPLIT_PERCENT, edge), Math.min(MAX_SPLIT_PERCENT, 100 - edge)];
}

/**
 * Holds a split percentage inside a range.
 *
 * @param percent - The percentage asked for.
 * @param range - The bounds, from {@link splitRange}.
 * @returns The percentage that will actually be applied.
 */
export function clampSplitPercent(percent: number, range: readonly [number, number]): number {
  const [low, high] = range;
  return Math.min(high, Math.max(low, percent));
}

/**
 * The split percentage to keep on screen after a layout mode change.
 *
 * Ported verbatim from the mockup's `setLayout()`, condition and all:
 * `(was === "left") !== (mode === "left") && (was === "right" || was ===
 * "left")`. In words, the boundary is mirrored on *leaving* "left" for
 * anywhere else, and on *entering* "left" from "right" — but not on entering
 * "left" from "code" or "game". That asymmetry looks like it should not be
 * there, and it is kept anyway: "left" and "right" are true mirror images of
 * the same two-pane view, so the percentage stored while in either of them is
 * always in "right"'s terms except while the mode is actually "left", and
 * leaving "left" for any mode — including a single-pane one — converts it
 * back. Entering "left" from a single-pane mode does not convert it because
 * the single-pane mode never touched the split while it was current, so
 * nothing needs undoing. The mockup is the agreed design source for this
 * interaction and has gone through several rounds of hands-on iteration;
 * this is ported to match it exactly, not to relitigate it.
 *
 * @param percent - The current split percentage.
 * @param previousMode - The mode being left.
 * @param nextMode - The mode being entered.
 * @returns `percent`, or `100 - percent` when the change crosses the "left"
 * mirror line.
 */
export function mirroredSplitOnLayoutChange(
  percent: number,
  previousMode: LayoutMode,
  nextMode: LayoutMode,
): number {
  const previousHadASide = previousMode === "right" || previousMode === "left";
  const sideChanged = (previousMode === "left") !== (nextMode === "left");
  return previousHadASide && sideChanged ? 100 - percent : percent;
}

/**
 * The split percentage a double-click on the splitter returns to.
 *
 * @param mode - The current layout mode.
 * @returns {@link DEFAULT_SPLIT_PERCENT}, mirrored for "left" the same way
 * {@link mirroredSplitOnLayoutChange} mirrors a mode change, since "left" is
 * "right" reflected.
 */
export function defaultSplitPercentForMode(mode: LayoutMode): number {
  return mode === "left" ? 100 - DEFAULT_SPLIT_PERCENT : DEFAULT_SPLIT_PERCENT;
}
