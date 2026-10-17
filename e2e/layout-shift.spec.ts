/**
 * The static shell's header stands where the app bar goes until the bundle
 * swaps the bar in, and the game below stays invisible while it is built over
 * several tasks; either slip would show the page jumping or half-drawn on load.
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

test("shows the game only once it is whole", async ({ page }) => {
  await page.addInitScript(() => {
    const partial: string[] = [];
    Object.assign(window, { partialFrames: partial });
    const sample = (): void => {
      const main = document.querySelector("main");
      if (main !== null && getComputedStyle(main).visibility === "visible") {
        const missing = ["header.appbar", ".cm-line", ".floor"].filter(
          (selector) => document.querySelector(selector) === null,
        );
        if (missing.length === 0) {
          return;
        }
        partial.push(missing.join(" "));
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("/");
  await expect(page.locator(".floor").first()).toBeVisible();

  expect(
    await page.evaluate(() => (window as Window & { partialFrames?: string[] }).partialFrames),
  ).toEqual([]);
});
