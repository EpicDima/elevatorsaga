/**
 * Helpers shared by `shared/ui`'s own unit tests.
 *
 * Not part of the game bundle; excluded from coverage in `vite.config.ts`.
 */

/**
 * Patches `HTMLDialogElement.prototype.showModal`/`close` well enough for a
 * jsdom test to drive a `<dialog>` through `createModal` (`modal.ts`) — jsdom
 * 30 implements only the `open` IDL attribute on the element, leaving
 * `showModal()` and `close()` undefined, so an unpatched jsdom document throws
 * `TypeError: dialog.showModal is not a function`. `showModal` sets the `open`
 * attribute; `close` clears it and dispatches a `close` event, which is enough
 * of the platform's own contract for a unit test to exercise `createModal`'s
 * own wiring.
 *
 * Deliberately not a full implementation: no `::backdrop`, no focus-trapping,
 * no `cancel` event, no Escape handling. `modal.ts`'s own module comment
 * explains why none of that is reimplemented there either — it is native
 * `<dialog>` behavior, exercised for real by Playwright against a real
 * browser rather than faked here.
 *
 * Idempotent, and scoped to whichever jsdom window a `// @vitest-environment
 * jsdom` test file gets of its own, so patching here never reaches a real
 * browser or another test file's document.
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
