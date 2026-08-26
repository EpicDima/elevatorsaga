/**
 * The workspace's two panes and the splitter between them, wired for
 * Pointer Events drag, keyboard resize (`separator` role), and a
 * double-click reset to the mode's default split.
 */

import {
  clampSplitPercent,
  defaultSplitPercentForMode,
  mirroredSplitOnLayoutChange,
  readLayoutMode,
  readSplitPercent,
  saveLayoutMode,
  saveSplitPercent,
  splitRange,
  SPLIT_STEP_PERCENT,
  type LayoutMode,
} from "../model/layout-mode.ts";

/** The custom property the chosen split is written to, read by the CSS grid. */
export const SPLIT_PERCENT_PROPERTY = "--split-x";

/** The text read out for each part of the skeleton; supplied by the caller so
 * this module stays free of any one locale. */
export interface WorkspaceLayoutLabels {
  /** `aria-label` of the pane that holds the building. */
  readonly gamePane: string;
  /** `aria-label` of the pane that holds the editor. */
  readonly codePane: string;
  /** `aria-label` of the splitter between them. */
  readonly splitter: string;
}

/** The elements {@link buildWorkspaceLayoutSkeleton} builds. */
export interface WorkspaceLayoutElements {
  /** The grid that holds both panes and the splitter. */
  readonly workspace: HTMLElement;
  /** Where the building widget mounts, once it exists. */
  readonly gamePane: HTMLElement;
  /** Where the editor pane widget mounts, once it exists. */
  readonly codePane: HTMLElement;
  /** The draggable/keyboard-resizable boundary between the two panes. */
  readonly splitter: HTMLElement;
}

/** Builds the workspace's DOM skeleton, detached from any document, with both panes empty. */
export function buildWorkspaceLayoutSkeleton(
  document: Document,
  labels: WorkspaceLayoutLabels,
): WorkspaceLayoutElements {
  const gamePane = document.createElement("section");
  gamePane.className = "pane pane-game";
  gamePane.setAttribute("aria-label", labels.gamePane);

  const codePane = document.createElement("section");
  codePane.className = "pane pane-code";
  codePane.setAttribute("aria-label", labels.codePane);

  const splitter = document.createElement("div");
  splitter.className = "splitter";
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-orientation", "vertical");
  splitter.setAttribute("aria-label", labels.splitter);
  splitter.tabIndex = 0;

  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.append(gamePane, splitter, codePane);

  return { workspace, gamePane, codePane, splitter };
}

/** What a mounted workspace layout hands back for later phases to drive. */
export interface WorkspaceLayoutController {
  /**
   * Switches to a layout mode, mirroring the split boundary and re-applying it.
   *
   * @param mode - The mode to switch to.
   */
  readonly setLayoutMode: (mode: LayoutMode) => void;
}

/** What {@link presentWorkspaceLayout} needs to wire the skeleton up. */
export interface WorkspaceLayoutOptions {
  /** The elements from {@link buildWorkspaceLayoutSkeleton}. */
  readonly elements: WorkspaceLayoutElements;
  /**
   * The element the split percentage and layout mode are written to —
   * `document.documentElement` in the page, so that every rule in
   * `workspace-layout.css` reading `--split-x`/`data-layout` sees them.
   */
  readonly root: HTMLElement;
  /** Where the mode and split are remembered between visits. */
  readonly storage: Storage;
}

/** Wires the splitter and restores the mode and split a player left behind. */
export function presentWorkspaceLayout(options: WorkspaceLayoutOptions): WorkspaceLayoutController {
  const { elements, root, storage } = options;
  const { workspace, splitter } = elements;

  let mode: LayoutMode = readLayoutMode(storage);
  let split = readSplitPercent(storage);

  /** Tells assistive technology where the boundary is now, and where it may go. */
  const describe = (range: readonly [number, number]): void => {
    splitter.setAttribute("aria-valuenow", String(Math.round(split)));
    splitter.setAttribute("aria-valuemin", String(Math.round(range[0])));
    splitter.setAttribute("aria-valuemax", String(Math.round(range[1])));
  };

  /**
   * Clamps `split` to what the current window allows, then writes both the
   * split and the mode onto {@link WorkspaceLayoutOptions.root}. The
   * `aria-valuemin`/`aria-valuemax` range is computed from the workspace's
   * actual width so it never claims a bound a drag would immediately reject.
   */
  const apply = (): void => {
    const range = splitRange(workspace.clientWidth);
    split = clampSplitPercent(split, range);
    root.style.setProperty(SPLIT_PERCENT_PROPERTY, `${String(split)}%`);
    root.dataset["layout"] = mode;
    describe(range);
  };

  const persist = (): void => {
    saveLayoutMode(storage, mode);
    saveSplitPercent(storage, split);
  };

  apply();

  const setLayoutMode = (nextMode: LayoutMode): void => {
    if (nextMode === mode) {
      return;
    }
    split = mirroredSplitOnLayoutChange(split, mode, nextMode);
    mode = nextMode;
    apply();
    persist();
  };

  /** Whether the splitter is currently being dragged. */
  let dragging = false;

  splitter.addEventListener("pointerdown", (event: PointerEvent) => {
    // Only the primary button of the primary pointer, so a right-click drag
    // never starts one the context menu would then fight with.
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    dragging = true;
    splitter.setPointerCapture(event.pointerId);
    // Stops the drag selecting the text on either side of the splitter.
    event.preventDefault();
  });

  splitter.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    const box = workspace.getBoundingClientRect();
    // The boundary follows the pointer's absolute position, not the distance
    // dragged from the pointer's starting point.
    split = ((event.clientX - box.left) / box.width) * 100;
    apply();
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) {
      return;
    }
    dragging = false;
    if (splitter.hasPointerCapture(event.pointerId)) {
      splitter.releasePointerCapture(event.pointerId);
    }
    persist();
  };

  splitter.addEventListener("pointerup", endDrag);
  splitter.addEventListener("pointercancel", endDrag);

  // Double-click gives the mode's default split back.
  splitter.addEventListener("dblclick", () => {
    split = defaultSplitPercentForMode(mode);
    apply();
    persist();
  });

  splitter.addEventListener("keydown", (event: KeyboardEvent) => {
    // A modified arrow key belongs to the browser or OS, e.g. Alt+ArrowLeft
    // is back/forward navigation.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    split += event.key === "ArrowLeft" ? -SPLIT_STEP_PERCENT : SPLIT_STEP_PERCENT;
    apply();
    event.preventDefault();
    persist();
  });

  return { setLayoutMode };
}
