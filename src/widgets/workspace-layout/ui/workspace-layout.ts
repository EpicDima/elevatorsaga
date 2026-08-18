/**
 * The workspace's two panes and the splitter between them.
 *
 * Builds the skeleton `design/ui-mockup.html` calls `.workspace` — the
 * building's pane, the draggable/keyboard-resizable boundary, and the
 * editor's pane — and wires the boundary the same way
 * `src/ui/editor-size.ts` wires the editor's own resize grip: Pointer Events
 * with capture for the drag, the `separator` role for the keyboard, and a
 * double-click back to the default.
 *
 * Nothing here is reachable yet. `buildWorkspaceLayoutSkeleton` is not called
 * from `index.html` or `src/app/app.ts` — this widget is staged the way
 * `src/styles/style.css`'s design tokens were staged, built and tested ahead
 * of anything that mounts or reads it — and `presentWorkspaceLayout`'s
 * `setLayoutMode` has no caller: the segmented control that would call it is
 * `features/switch-layout`, a later phase of the same migration. Dragging and
 * resizing the boundary already works in full once the skeleton is on a real
 * page; only *choosing a mode* is unreachable until that control exists.
 *
 * Three places deliberately outgrow the mockup's own script rather than port
 * it literally:
 *
 * - The pointer handlers ignore a non-primary pointer and a non-primary
 *   button, exactly as `presentEditorResize` does and the mockup's splitter
 *   does not — a right-click drag on the mockup's splitter starts a drag the
 *   browser's own context menu then fights with.
 * - The percentage is written to storage once, when a drag or a key press
 *   ends, not on every `pointermove` — the mockup calls its equivalent of
 *   {@link import("../model/layout-mode.ts").saveSplitPercent} from inside
 *   the move handler, which can fire dozens of times a second during a single
 *   drag. The value that ends up stored is identical either way; only the
 *   number of writes differs.
 * - The keyboard handler bails on Alt/Ctrl/Meta/Shift, exactly as
 *   `presentEditorResize`'s does and the mockup's does not — the mockup's
 *   arrow-key handler calls `preventDefault()` unconditionally, which on
 *   Alt+ArrowLeft/Right also swallows the browser's own back/forward
 *   navigation.
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

/**
 * Builds the workspace's DOM skeleton, detached from any document.
 *
 * Both panes are built empty: what goes inside each is later phases of this
 * migration (`widgets/building-stage`, `widgets/editor-pane`), and this
 * module knows only where they go, not what they hold.
 *
 * @param document - The document to create the elements in, so a caller can
 * build into a document other than the global one — the same reason
 * `src/ui/editor-size.ts`'s options take an already-created `root` rather than
 * reaching for `document` themselves.
 * @param labels - The localised `aria-label` text for each part.
 * @returns The workspace element and the three children a caller mounts
 * content into or wires up.
 */
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
   * Switches to a layout mode, mirroring the split boundary and re-applying
   * it exactly as the mockup's `setLayout()` does.
   *
   * Unreachable until `features/switch-layout` calls it from a real control.
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
   * `document.documentElement` in the page, the same place
   * `src/ui/editor-size.ts` writes the editor's chosen height.
   */
  readonly root: HTMLElement;
  /** Where the mode and split are remembered between visits. */
  readonly storage: Storage;
}

/**
 * Wires the splitter and restores the mode and split a player left behind.
 *
 * @param options - The skeleton, the element to write onto, and the store.
 * @returns A controller for switching layout modes, for a later phase to use.
 */
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
   * split and the mode onto {@link WorkspaceLayoutOptions.root}.
   *
   * `aria-valuemin`/`aria-valuemax` are computed from the workspace's actual
   * width rather than fixed at the mockup's static `20`/`85`: a range that
   * only ever widens or narrows the *reachable* bound would tell a screen
   * reader user the boundary can go somewhere a drag would immediately pull
   * it back from.
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
    // Only the primary button of the primary pointer: see the module comment
    // for why this is not what the mockup's own handler checks.
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
    // The boundary follows the pointer's absolute position across the
    // workspace, not the distance dragged from where the pointer went down —
    // ported as-is from the mockup, which places the boundary under the
    // pointer rather than offsetting it from the drag start.
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
    // A modified arrow key belongs to the browser or the operating system;
    // see `src/ui/editor-size.ts`'s identical guard for why.
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
