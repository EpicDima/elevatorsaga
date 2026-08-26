/**
 * The game pane's scrolling column: the lesson card and the building stand in one box, so a
 * house too tall for the pane lengthens this column rather than scrolling inside itself.
 * Nothing else in the pane scrolls, which leaves this module to say where the column is
 * parked — the lobby is at its foot, and on a lesson that is a screenful below the fold.
 */

/** What a mounted stage column hands back for the shell to drive. */
export interface StageColumnController {
  /** Parks the column for a route just opened: at a lesson's title if one is on screen, at the lobby otherwise. */
  readonly park: () => void;
  /** Drops the column to the lobby — the foot of the building, and of the column. */
  readonly showGround: () => void;
}

/** What {@link presentStageColumn} drives. */
export interface StageColumnOptions {
  /** The scrolling column itself. */
  readonly column: HTMLElement;
  /** The lesson card at the top of it, which levels without a lesson leave empty and hidden. */
  readonly lesson: HTMLElement;
}

/** How near an edge still counts as parked at it, in pixels of rounding. */
const EDGE_SLACK = 1;

/**
 * Wires the column's scroll position and its tab stop.
 *
 * @param options - The column and the lesson card inside it.
 * @returns The controller the shell parks the column with.
 */
export function presentStageColumn(options: StageColumnOptions): StageColumnController {
  const { column, lesson } = options;

  /** How far the column can still scroll down. */
  function room(): number {
    return column.scrollHeight - column.clientHeight;
  }

  /**
   * Whether the column is parked at the lobby, so a resize can put it back there.
   * A shorter pane leaves more to scroll, and a scroll position the browser doesn't
   * have to clamp would strand the view mid-building.
   */
  let atGround = false;

  /**
   * A tab stop exactly while there is somewhere to scroll to: a scrollable region a
   * keyboard cannot reach is WCAG 2.1.1, and so is a tab stop that goes nowhere.
   */
  function updateTabStop(): void {
    if (room() > EDGE_SLACK) {
      column.tabIndex = 0;
    } else {
      column.removeAttribute("tabindex");
    }
  }

  function showGround(): void {
    column.scrollTop = column.scrollHeight;
    atGround = true;
    updateTabStop();
  }

  function park(): void {
    // Measured, not counted: a level's lesson stays mounted in the fullscreen demo, which
    // hides the card rather than emptying it, and there the building is all there is to see.
    if (lesson.offsetHeight > 0) {
      column.scrollTop = 0;
      atGround = room() <= EDGE_SLACK;
      updateTabStop();
      return;
    }
    showGround();
  }

  column.addEventListener("scroll", () => {
    atGround = column.scrollTop >= room() - EDGE_SLACK;
  });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      if (atGround) {
        column.scrollTop = column.scrollHeight;
      }
      updateTabStop();
    });
    observer.observe(column);
  }

  return { park, showGround };
}
