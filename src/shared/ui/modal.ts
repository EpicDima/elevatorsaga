/**
 * Turns a `<dialog>` and its own close button into an open/close pair — the
 * behaviour behind every `<dialog>` `design/ui-mockup.html` draws (the help
 * window, the hotkeys window): `showModal()` unless it is already open, a
 * close button, and a click on the dialog's own backdrop.
 *
 * Escape is deliberately not wired here, unlike `disclosure.ts`'s own Escape
 * listener: a native `<dialog>` already closes on it (dispatching `cancel`
 * then `close`), which is the one thing `disclosure.ts`'s `hidden`-toggled
 * panel cannot do for itself because it is not a `<dialog>` at all.
 * Reimplementing that here would be a second, redundant listener racing the
 * platform's own.
 */

/** A dialog, already open or already closed. */
export interface Modal {
  /** Shows the dialog modally, unless it is already open. */
  open(): void;
  /** Hides the dialog, as `<dialog>`'s own `close()` does. */
  close(): void;
}

/**
 * Wires a dialog and its close button into one modal, closed to start.
 *
 * A click on the dialog element itself, outside its content box, is a click
 * on its `::backdrop` — `design/ui-mockup.html`'s own dialogs close on
 * exactly that (`if (event.target === docs) docs.close();`), which this ports
 * directly.
 *
 * @param dialog - The `<dialog>` to open and close.
 * @param closeButton - The button inside it that closes it.
 * @returns The modal, already wired.
 */
export function createModal(dialog: HTMLDialogElement, closeButton: HTMLElement): Modal {
  function close(): void {
    dialog.close();
  }

  function open(): void {
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  return { open, close };
}
