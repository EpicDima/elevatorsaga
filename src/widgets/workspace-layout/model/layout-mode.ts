/**
 * Four-way workspace layout and the splitter boundary between panes: pure arithmetic and
 * storage, no DOM.
 */

/** Which panes the workspace shows, and on which side. */
export type LayoutMode = "right" | "left" | "code" | "game";

/** Every {@link LayoutMode}, for validating a stored or requested one. */
const LAYOUT_MODES: readonly LayoutMode[] = ["right", "left", "code", "game"];

/** The mode the workspace opens in until a player has chosen otherwise. */
export const DEFAULT_LAYOUT_MODE: LayoutMode = "right";

/** Default split, as a percent of workspace width — the building's share in "right" mode. */
export const DEFAULT_SPLIT_PERCENT = 62;

/** The split may not be dragged narrower than this, whatever the window. */
export const MIN_SPLIT_PERCENT = 20;

/** The split may not be dragged wider than this, whatever the window. */
export const MAX_SPLIT_PERCENT = 85;

/**
 * Narrowest either pane may be driven to, in pixels — below this a pane is unusable before
 * it's invisible. {@link splitRange} tightens the percent bounds when they'd allow less.
 */
export const MIN_PANE_WIDTH = 380;

/** How far one press of the splitter's arrow keys moves it, in percent. */
export const SPLIT_STEP_PERCENT = 2;

/** Where the chosen layout mode is remembered between visits. */
export const LAYOUT_MODE_STORAGE_KEY = "develevateLayoutMode";

/** Where the chosen split percentage is remembered between visits. */
export const SPLIT_PERCENT_STORAGE_KEY = "develevateSplitPercent";

/** Whether a stored or requested string names a real {@link LayoutMode}. */
function isLayoutMode(value: string): value is LayoutMode {
  return (LAYOUT_MODES as readonly string[]).includes(value);
}

/**
 * Layout mode remembered from a previous visit; anything unreadable or unrecognized is
 * treated as "nothing chosen yet" rather than reported.
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

/** Remembers the chosen layout mode; a store that refuses the write is not treated as an error. */
export function saveLayoutMode(storage: Storage, mode: LayoutMode): void {
  try {
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    // As above: a browser that refuses storage should not stop the game.
  }
}

/**
 * Split percent remembered from a previous visit, or {@link DEFAULT_SPLIT_PERCENT}.
 * Not yet clamped to the current window — see {@link splitRange}.
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

/** Remembers the chosen split percentage; a store that refuses the write is not treated as an error. */
export function saveSplitPercent(storage: Storage, percent: number): void {
  try {
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, String(percent));
  } catch {
    // As above.
  }
}

/**
 * How far the splitter may be dragged in a workspace of the given width, tightening the
 * default percent bounds so neither pane drops under {@link MIN_PANE_WIDTH}.
 * @param workspaceWidth - Pixels; non-positive (unmeasured) falls back to 1440.
 */
export function splitRange(workspaceWidth: number): readonly [number, number] {
  const width = workspaceWidth > 0 ? workspaceWidth : 1440;
  const edge = Math.min(40, (MIN_PANE_WIDTH / width) * 100);
  return [Math.max(MIN_SPLIT_PERCENT, edge), Math.min(MAX_SPLIT_PERCENT, 100 - edge)];
}

export function clampSplitPercent(percent: number, range: readonly [number, number]): number {
  const [low, high] = range;
  return Math.min(high, Math.max(low, percent));
}

/**
 * Split percent to keep on screen after a mode change. The stored percent is always in
 * "right"'s terms except while the mode is "left" — mirrored when leaving "left" for anywhere,
 * or entering it from "right", but not from a single-pane mode, which never touched it.
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

/** {@link DEFAULT_SPLIT_PERCENT}, mirrored for "left" since it's "right" reflected. */
export function defaultSplitPercentForMode(mode: LayoutMode): number {
  return mode === "left" ? 100 - DEFAULT_SPLIT_PERCENT : DEFAULT_SPLIT_PERCENT;
}
