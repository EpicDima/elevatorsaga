/**
 * Turns a `<dialog>` and its close button into an open/close pair: `open()`
 * calls `showModal()` unless already open; closing happens via the button or
 * a backdrop click. Escape isn't wired here, since native `<dialog>` already closes on it.
 */

/** A dialog, already open or already closed. */
export interface Modal {
  /** Shows the dialog modally, unless it is already open. */
  open(): void;
  /** Hides the dialog, as `<dialog>`'s own `close()` does. */
  close(): void;
}

/**
 * Wires a dialog and its close button into one modal, closed to start. A
 * click on the dialog element itself, outside its content box, is a click on
 * its `::backdrop`, and closes it.
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
