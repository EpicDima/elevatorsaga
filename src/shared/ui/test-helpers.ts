/**
 * Helpers shared by `shared/ui`'s own unit tests. Not part of the game
 * bundle; excluded from coverage.
 */

/**
 * Patches `HTMLDialogElement.prototype.showModal`/`close` for jsdom, which
 * lacks them: sets/clears the `open` attribute and dispatches `close`. Not a
 * full implementation — real `<dialog>` behavior is exercised by Playwright.
 */
export function polyfillDialogElement(): void {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal === "function") {
    return;
  }
  proto.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement): void {
    if (!this.open) {
      return;
    }
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
