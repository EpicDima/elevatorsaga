/**
 * A trigger button and the panel it shows or hides, toggled through `hidden`
 * and the trigger's `aria-expanded` rather than a class, so a caller with no
 * stylesheet rule still gets working show/hide.
 */

/** A trigger and the panel it opens, already open or already closed. */
export interface Disclosure {
  /** Whether the panel is currently shown. */
  isOpen(): boolean;
  /** Hides the panel, as if the trigger had been clicked while open. */
  close(): void;
}

/**
 * Whether the event belongs to a dialog rather than to the page under it. A modal dialog makes
 * everything below it inert, so its Escape and its backdrop click are never a disclosure's to act on.
 */
function insideDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("dialog") !== null;
}

/**
 * Wires a trigger and a panel into one disclosure, closed to start. Listens
 * on `trigger`'s own `ownerDocument`, not the global `document`, so a pair
 * built inside another `Document` isn't wired to a page it was never part of.
 * A panel left open behind a dialog is still open once the dialog closes.
 *
 * @param trigger - Must carry `aria-haspopup`; this only ever writes its `aria-expanded`.
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

  trigger.addEventListener("click", () => {
    // `!!`, not a direct pass-through: `hidden`'s DOM type widens to
    // `boolean | "hidden" | "until-found"`, though `setOpen` only ever writes a plain boolean.
    setOpen(!!panel.hidden);
  });
  ownerDocument.addEventListener("click", (event) => {
    // A click on `trigger` or inside `panel` isn't "outside" this disclosure.
    // Checking `contains()` here, rather than `stopPropagation()`, scopes the
    // exemption to this disclosure, so several can share one page.
    const target = event.target;
    if (target instanceof Node && (trigger.contains(target) || panel.contains(target))) {
      return;
    }
    if (!insideDialog(target)) {
      close();
    }
  });
  ownerDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !insideDialog(event.target)) {
      close();
    }
  });

  setOpen(false);

  return { isOpen: () => !panel.hidden, close };
}
