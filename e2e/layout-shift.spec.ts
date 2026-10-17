/**
 * The static shell's header stands where the app bar goes until the bundle
 * swaps the bar in; were it any taller, the whole stage would jump up on load.
 */

import { expect, test } from "@playwright/test";

test("loads the game without shifting its layout", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.assign(window, { layoutShifts: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        shifts.push((entry as PerformanceEntry & { value: number }).value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await expect(page.locator("header.appbar")).toBeVisible();
  await expect(page.locator(".floor").first()).toBeVisible();

  expect(
    await page.evaluate(() => (window as Window & { layoutShifts?: number[] }).layoutShifts),
  ).toEqual([]);
});
