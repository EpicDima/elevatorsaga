/** Checks what a screen reader is told when the browser refuses to store the program. */

import { expect, test, type Locator, type Page } from "@playwright/test";

import { editor } from "./game-page.ts";

declare global {
  interface Window {
    /** Restores the original localStorage.setItem; installed by {@link breakWrites}. */
    restoreStorageWrites: () => void;
  }
}

/**
 * Makes every localStorage write fail like a full quota.
 *
 * Restores via the saved property descriptor rather than `delete`: since `setItem` is an own
 * property of `Storage.prototype`, deleting it would leave calls throwing `TypeError` instead of
 * simply working again.
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

/** Locator for the live region announcing storage refusals. */
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

  // Forces a write via the shortcut, rather than waiting out the debounced autosave.
  await page.keyboard.press("ControlOrMeta+s");

  await expect(storageStatus(page)).toHaveText(/^Not saved/);
  // role="status" reaches a screen reader; .visually-hidden keeps it off the page.
  await expect(storageStatus(page)).toHaveAttribute("role", "status");
  await expect(storageStatus(page)).toHaveClass("visually-hidden");
  // The refusal must not crash the page as well as being announced.
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

  // The quota is not permanent, so the warning must retract once writes succeed again. Emptying
  // the region announces nothing, which is right: a working save is not news either.
  await page.evaluate(() => {
    window.restoreStorageWrites();
  });
  await editor(page).click();
  await page.keyboard.insertText("\n// and again");
  await page.keyboard.press("ControlOrMeta+s");

  await expect(storageStatus(page)).toHaveText("");
});
