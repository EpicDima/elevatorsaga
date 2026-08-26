/**
 * An order mark is a WCAG 2.5.8 target: its 3px tick can't grow (its height is
 * which floor it names), but the button around it can, and does. Whether the
 * resulting boxes leave each other room is arithmetic between a stylesheet and
 * a laid-out building, so it's checked here rather than in a unit test.
 * Measured on the busiest level at the smallest window - the worst case.
 */

import { expect, test } from "@playwright/test";

import { startButton } from "./game-page.ts";

/** The size WCAG 2.5.8 asks of a target, and the size the button is given. */
const TARGET = 24;

/** `body.app`'s own `min-inline-size`/`min-block-size`. */
const FLOOR = { width: 1040, height: 600 } as const;

/** 8 elevators and 21 floors. */
const BUSIEST = "#level=18";

test("gives every order mark a target that clears its neighbors", async ({ page }) => {
  await page.setViewportSize({ ...FLOOR });
  await page.goto(`/${BUSIEST}`);
  await expect(page.locator(".shaft").first()).toBeVisible();

  const measured = await page.evaluate(() => {
    const shafts = [...document.querySelectorAll(".shaft")];
    const anyMark = document.querySelector(".mark");
    if (anyMark === null) {
      throw new Error("The building has no order marks to measure");
    }
    const columns = shafts.map((shaft) =>
      [...shaft.querySelectorAll(".mark")].map((mark) => mark.getBoundingClientRect()),
    );
    // Top to top: the distance two targets in the same shaft have to share.
    const upTheShaft: number[] = [];
    for (const column of columns) {
      for (const [index, rect] of column.entries()) {
        const next = column[index + 1];
        if (next !== undefined) {
          upTheShaft.push(Math.abs(next.top - rect.top));
        }
      }
    }
    const acrossShafts: number[] = [];
    for (const [index, column] of columns.entries()) {
      const here = column[0];
      const next = columns[index + 1]?.[0];
      if (here !== undefined && next !== undefined) {
        acrossShafts.push(Math.abs(next.left - here.left));
      }
    }
    const rects = columns.flat();
    return {
      shaftCount: shafts.length,
      markCount: columns[0]?.length ?? 0,
      heights: [...new Set(rects.map((rect) => Math.round(rect.height)))],
      widestMark: Math.max(...rects.map((rect) => rect.width)),
      closestUpTheShaft: Math.min(...upTheShaft),
      closestAcrossShafts: Math.min(...acrossShafts),
      // The tick is a `::before` with no box of its own, so read off computed style instead.
      tickHeight: getComputedStyle(anyMark, "::before").height,
    };
  });

  // Confirms the busy level actually loaded, not a fallback with nothing near anything.
  expect(measured.shaftCount).toBe(8);
  expect(measured.markCount).toBe(21);

  expect(measured.heights).toEqual([TARGET]);
  expect(measured.closestUpTheShaft).toBeGreaterThanOrEqual(TARGET);
  // The mark's own width is far under 24px; WCAG 2.5.8's spacing exception
  // covers it as long as a 24px circle centered on one mark misses the next.
  expect(measured.widestMark).toBeLessThan(TARGET);
  expect(measured.closestAcrossShafts).toBeGreaterThanOrEqual(TARGET);

  expect(measured.tickHeight).toBe("3px");
});

test("takes a click anywhere down the mark, not only on the tick", async ({ page }) => {
  await page.setViewportSize({ ...FLOOR });
  await page.goto(`/${BUSIEST}`);

  // Unstarted: a passenger crossing the strip toward a car would obstruct the mark.
  await expect(startButton(page)).toBeVisible();

  // A trial click checks the mark actually receives events at that point
  // without pressing it, so there's no race with the order being served. A
  // short timeout: a shrunken target should fail in seconds, not a minute of retries.
  const mark = page.locator(".shaft").first().locator(".mark").nth(10);
  const aim = { trial: true, timeout: 10_000 } as const;
  await mark.click({ ...aim, position: { x: 1, y: 1 } });
  await mark.click({ ...aim, position: { x: 1, y: TARGET - 1 } });
});
