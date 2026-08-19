/**
 * What the page says when the browser will not store the program.
 *
 * `CodeEditor` raises `storage_refused` from the one place every write goes
 * through, and `src/main.ts` turns it into the one thing `#storage_status`
 * ever says. Between them is nothing a unit test can hold: the editor's own
 * suite proves the event is raised, and the wiring that carries it lives in the
 * entry point, which has no unit tests by design — it is covered from here.
 *
 * Nothing here asserts about pixels, because there are none to assert about.
 * `#storage_status` is `.visually-hidden` and `role="status"`: the mockup draws
 * no status line under the editor, and a page whose whole height is a workspace
 * has nowhere to put one, but a store that has stopped keeping the player's
 * work still has to be announced. What this checks is what a screen reader is
 * handed — the words in the live region, and the silence after them.
 *
 * The store is broken from `addInitScript`, before any of the page's own script
 * runs, so the first write the game attempts is already refused. Reads are left
 * working: a full quota is the case worth covering, and a store that answers
 * reads while refusing writes is exactly what that looks like. (Safari's
 * private mode, which throws from everything, is covered in
 * `src/ui/editor.test.ts` against a fake.)
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

import { editor } from "./game-page.ts";

declare global {
  interface Window {
    /**
     * Puts the browser's own `setItem` back, for the test that needs the quota
     * to stop being full. Installed by {@link breakWrites}, and nothing the
     * game can see.
     */
    restoreStorageWrites: () => void;
  }
}

/**
 * Makes every write to `localStorage` fail the way a full quota does.
 *
 * `QuotaExceededError` by name as well as by shape, because that is what the
 * browsers throw and what anything reading `error.name` would look for.
 *
 * The original descriptor is kept rather than deleted on the way back:
 * `setItem` is an own property of `Storage.prototype`, so `delete` takes the
 * real one with the override and leaves every write throwing a `TypeError`
 * instead — which looks like a store that is still refusing, and quietly turns
 * the test that wants a working store into a second copy of the test that wants
 * a broken one.
 *
 * @returns Nothing; called for its effect on the page being loaded.
 */
function breakWrites(): void {
  const original = Object.getOwnPropertyDescriptor(Storage.prototype, "setItem");
  window.restoreStorageWrites = (): void => {
    if (original !== undefined) {
      Object.defineProperty(Storage.prototype, "setItem", original);
    }
  };
  Storage.prototype.setItem = function setItem(): never {
    throw new DOMException("quota", "QuotaExceededError");
  };
}

/**
 * The live region the refusal is announced through.
 *
 * @param page - The page under test.
 * @returns A locator for `#storage_status`.
 */
function storageStatus(page: Page): Locator {
  return page.locator("#storage_status");
}

test("announces the refusal rather than reporting a save that did not happen", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(breakWrites);

  await page.goto("/");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("// e2e-storage-refused-4f70");

  // The write the shortcut forces, rather than the autosave, so the assertion
  // is not also waiting out a second of debounce.
  await page.keyboard.press("ControlOrMeta+s");

  await expect(storageStatus(page)).toHaveText(/^Not saved/);
  // Announced, not drawn: `role="status"` is what reaches a screen reader, and
  // `.visually-hidden` is what keeps the page looking like the mockup.
  await expect(storageStatus(page)).toHaveAttribute("role", "status");
  await expect(storageStatus(page)).toHaveClass("visually-hidden");
  // The refusal is a fact about the store, not a crash. A game that threw on
  // the way would have announced the message and then stopped playing.
  expect(pageErrors).toEqual([]);
});

test("takes the announcement back when a write gets through again", async ({ page }) => {
  await page.addInitScript(breakWrites);

  await page.goto("/");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("// e2e-storage-refused-b118");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(storageStatus(page)).toHaveText(/^Not saved/);

  // The quota is not a permanent condition -- another tab closing, or the
  // player clearing something out, is enough -- and a warning left standing
  // after the writes start landing is telling them their work is at risk when
  // it is not. Emptying the region announces nothing, which is right for news
  // that has stopped being news; nothing is put in its place, because a save
  // that worked is not news either.
  await page.evaluate(() => {
    window.restoreStorageWrites();
  });
  await editor(page).click();
  await page.keyboard.insertText("\n// and again");
  await page.keyboard.press("ControlOrMeta+s");

  await expect(storageStatus(page)).toHaveText("");
});
