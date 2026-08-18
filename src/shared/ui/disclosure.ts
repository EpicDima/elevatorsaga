/**
 * A trigger button and a panel it shows or hides, the behaviour behind every
 * popover `design/ui-mockup.html` draws — the level switcher's menu, the
 * goal bar's tier breakdown, the settings popover. The mockup's own
 * `popover(buttonId, menuId)` names all three at once, which is the four
 * call sites this is ported from rather than a shared primitive invented
 * ahead of a second user.
 *
 * The panel is toggled through `hidden` and the trigger's `aria-expanded`
 * rather than a class, so a caller that never writes a stylesheet rule for
 * either still gets working show/hide — the same reason
 * `RunControlsPresenter.update` writes `undoReset.hidden` instead of a class.
 */

/** A trigger and the panel it opens, already open or already closed. */
export interface Disclosure {
  /** Whether the panel is currently shown. */
  isOpen(): boolean;
  /** Hides the panel, as if the trigger had been clicked while open. */
  close(): void;
}

/**
 * Wires a trigger and a panel into one disclosure, closed to start.
 *
 * Closing on an outside click and on Escape both listen on `trigger`'s own
 * `ownerDocument` rather than the global `document`, so a pair built inside
 * some other `Document` — a test's own, the way `buildAppBarSkeleton` takes
 * one — is not wired to a page it was never part of.
 *
 * @param trigger - The button that shows and hides the panel. Must carry
 * `aria-haspopup`; this only ever writes its `aria-expanded`.
 * @param panel - The element toggled by the trigger, shown or hidden through
 * `hidden`.
 * @returns The disclosure, already wired and closed.
 */
export function createDisclosure(trigger: HTMLElement, panel: HTMLElement): Disclosure {
  const ownerDocument = trigger.ownerDocument;

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }

  function close(): void {
    setOpen(false);
  }

  trigger.addEventListener("click", (event) => {
    // Without this, the same click would reach the document listener below
    // and close the panel it had just opened.
    event.stopPropagation();
    // `!!`, not a direct pass-through: newer DOM typings widen `hidden` to
    // `boolean | "hidden" | "until-found"` for the HTML attribute of that
    // name, even though `setOpen` below only ever writes a plain boolean to
    // it.
    setOpen(!!panel.hidden);
  });
  panel.addEventListener("click", (event) => {
    // A click on the panel itself — its caption, its empty padding — is not
    // outside it. A click on one of its own links or buttons is welcome to
    // call `close()` itself, the way a level tile closes the menu it was
    // opened from before it navigates.
    event.stopPropagation();
  });
  ownerDocument.addEventListener("click", close);
  ownerDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  setOpen(false);

  return { isOpen: () => !panel.hidden, close };
}
