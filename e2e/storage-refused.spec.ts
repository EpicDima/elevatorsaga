/**
 * What the page says when the browser will not store the program.
 *
 * `CodeEditor` raises `storage_refused` from the one place every write goes
 * through, and `src/main.ts` turns it into the line under the editor. Between
 * them is nothing a unit test can hold: the editor's own suite proves the event
 * is raised, and the wiring that makes it visible lives in the entry point,
 * which has no unit tests by design — it is covered from here.
 *
 * The store is broken from `addInitScript`, before any of the page's own script
 * runs, so the first write the game attempts is already refused. Reads are left
 * working: a full quota is the case worth covering, and a store that answers
 * reads while refusing writes is exactly what that looks like. (Safari's
 * private mode, which throws from everything, is covered in
 * `src/ui/editor.test.ts` against a fake.)
 */

import { expect, test } from "@playwright/test";

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

test("says so rather than reporting a save that did not happen", async ({ page }) => {
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

  await expect(page.getByText(/^Not saved/)).toBeVisible();
  // And not both at once: the timestamp is a promise about the next visit, and
  // there is no next visit for this text.
  await expect(page.getByText(/^Code saved /)).toHaveCount(0);
  // The refusal is a fact about the store, not a crash. A game that threw on
  // the way would have shown the message and then stopped playing.
  expect(pageErrors).toEqual([]);
});

test("takes the line back when a write gets through again", async ({ page }) => {
  await page.addInitScript(breakWrites);

  await page.goto("/");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("// e2e-storage-refused-b118");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText(/^Not saved/)).toBeVisible();

  // The quota is not a permanent condition -- another tab closing, or the
  // player clearing something out, is enough -- and a line that stays red after
  // the writes start landing is telling them their work is at risk when it is
  // not.
  await page.evaluate(() => {
    window.restoreStorageWrites();
  });
  await editor(page).click();
  await page.keyboard.insertText("\n// and again");
  await page.keyboard.press("ControlOrMeta+s");

  await expect(page.getByText(/^Code saved /)).toBeVisible();
  await expect(page.getByText(/^Not saved/)).toHaveCount(0);
});
