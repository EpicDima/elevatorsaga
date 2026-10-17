/**
 * A floor's call buttons are WCAG 2.5.8 targets under 24px, which passes only
 * through the spacing exception: a 24px circle centered on one must miss the
 * next. Measured on the busiest level at the smallest window - the worst case.
 */

import { expect, test } from "@playwright/test";

/** The size WCAG 2.5.8 asks of a target. */
const TARGET = 24;

/** `body.app`'s own `min-inline-size`/`min-block-size`. */
const FLOOR = { width: 1040, height: 600 } as const;

/** 8 elevators and 21 floors. */
const BUSIEST = "#level=18";

test("spaces every call button at least a target's width from the next", async ({ page }) => {
  await page.setViewportSize({ ...FLOOR });
  await page.goto(`/${BUSIEST}`);
  await expect(page.locator(".call").first()).toBeVisible();

  const measured = await page.evaluate(() => {
    const centers = [...document.querySelectorAll(".call")].map((call) => {
      const rect = call.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    let closest = Infinity;
    for (const [index, a] of centers.entries()) {
      for (const b of centers.slice(index + 1)) {
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    return { count: centers.length, closest };
  });

  // Confirms the busy level actually loaded: two buttons a floor, but one at either end.
  expect(measured.count).toBe(21 * 2 - 2);
  expect(measured.closest).toBeGreaterThanOrEqual(TARGET);
});
