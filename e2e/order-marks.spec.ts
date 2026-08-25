/**
 * The order marks down a shaft are buttons, and this is where their size is
 * really known.
 *
 * A mark asks its car for a floor, so it is a control WCAG 2.5.8 has something
 * to say about, and what it draws is a 3px tick -- the tick's height on the
 * shaft is which floor it stands for, so it cannot grow. The button around it
 * can, and does: `entities/elevator`'s stylesheet gives it 24px of the floor's
 * band and the whole width of the order strip.
 *
 * That the rules say so is checked in `elevator-view.css.test.ts`. What cannot
 * be checked there is whether the boxes those rules produce leave each other
 * room, because the answer is arithmetic between a stylesheet and
 * `layoutBuilding()`'s floor heights, and only a laid-out building has both.
 *
 * The busiest level at the project's own smallest window is the worst case for
 * every distance measured here: eight shafts is the closest two of them ever
 * stand, and twenty-one floors is the shortest a floor is ever drawn.
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
    // Between one floor's mark and the next, in the same shaft. Top to top,
    // because that is the distance two targets have to share.
    const upTheShaft: number[] = [];
    for (const column of columns) {
      for (const [index, rect] of column.entries()) {
        const next = column[index + 1];
        if (next !== undefined) {
          upTheShaft.push(Math.abs(next.top - rect.top));
        }
      }
    }
    // And between one shaft's marks and the next shaft's, at the same floor.
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
      // The tick is a `::before` with no box of its own to query, so it is read
      // off the computed style instead. It has to still be the small thing the
      // shaft is read by.
      tickHeight: getComputedStyle(anyMark, "::before").height,
    };
  });

  // The level really is the busy one, so a route that quietly fell back to
  // level 1 cannot satisfy the distances below by having nothing near anything.
  expect(measured.shaftCount).toBe(8);
  expect(measured.markCount).toBe(21);

  // Tall enough to aim at, and no taller than the floor band it has to share.
  expect(measured.heights).toEqual([TARGET]);
  expect(measured.closestUpTheShaft).toBeGreaterThanOrEqual(TARGET);
  // The width is the strip's, which is nothing like 24px: the car begins at the
  // strip's inner edge and paints over it, and just outside it is the next
  // shaft. That is 2.5.8's spacing exception, and it holds only while a 24px
  // circle centered on one mark misses the circle on the next one across.
  expect(measured.widestMark).toBeLessThan(TARGET);
  expect(measured.closestAcrossShafts).toBeGreaterThanOrEqual(TARGET);

  expect(measured.tickHeight).toBe("3px");
});

test("takes a click anywhere down the mark, not only on the tick", async ({ page }) => {
  await page.setViewportSize({ ...FLOOR });
  await page.goto(`/${BUSIEST}`);

  // A run has to be started, and this one is not: the building is drawn and
  // standing still. That matters here because a passenger crosses the order
  // strip on its way into a car, and a figure over the mark is a real
  // obstruction that would make the clicks below wait for it to move on.
  await expect(startButton(page)).toBeVisible();

  // The top and bottom of the button's own box, which is where the room it was
  // given is. A trial click runs every actionability check -- including that
  // the mark is what really receives events at that point -- and presses
  // nothing, so the car is never actually asked for the floor and there is no
  // race with the order being served again.
  //
  // Short of the file's own timeout, which is written for a spec waiting out a
  // simulated minute of traffic. This one is waiting on a box that is either
  // the size it should be or is not, and a shrunken target should say so in
  // seconds rather than in a minute of retries.
  const mark = page.locator(".shaft").first().locator(".mark").nth(10);
  const aim = { trial: true, timeout: 10_000 } as const;
  await mark.click({ ...aim, position: { x: 1, y: 1 } });
  await mark.click({ ...aim, position: { x: 1, y: TARGET - 1 } });
});
