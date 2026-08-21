/**
 * Turns a `<dialog>` and its close button into an open/close pair, the
 * behavior behind the help and hotkeys windows: `showModal()` unless it is
 * already open, a close button, and a click on the backdrop.
 *
 * Escape is not wired here: a native `<dialog>` already closes on it, so a
 * listener would only race the platform's own.
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
 * A click on the dialog element itself, outside its content box, is a click on
 * its `::backdrop`, and closes it.
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
