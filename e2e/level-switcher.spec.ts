/**
 * Checks that a player can reach a level by pointing at the screen: the
 * trigger and its two chevrons stand on one row, the popover opens where the
 * trigger is, and a tile in it changes the building. These are position
 * assertions rather than markup ones on purpose - a widget that is present,
 * correct, and simply drawn somewhere else is a failure markup checks miss.
 * Measured in the sandbox, the last tile in the menu, so the forward chevron is
 * disabled there; nothing below clicks a chevron either way.
 */

import { expect, test, type Locator } from "@playwright/test";

import { building } from "./game-page.ts";

/** The switcher's trigger: the button naming the level on screen. */
const TRIGGER = ".task-open";

/** The popover it opens. */
const MENU = ".taskmenu";

/**
 * One element's box, refusing to measure an element with no layout:
 * `boundingBox()` returns `null` there, and comparing against `null` would
 * pass on exactly the failure these tests exist to catch.
 */
async function boxOf(
  locator: Locator,
  what: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${what} has no box on screen`);
  }
  return box;
}

test("stands the trigger between its two step buttons on one row", async ({ page }) => {
  await page.goto("/#level=sandbox");
  const prevButton = page.locator(".task-prev");
  await expect(page.locator(TRIGGER)).toBeVisible();

  const prev = await boxOf(prevButton, "the previous-level button");
  const open = await boxOf(page.locator(TRIGGER), "the trigger");
  const next = await boxOf(page.locator(".task-next"), "the next-level button");

  // One row: same top, same height, left to right in document order.
  expect(open.y).toBeCloseTo(prev.y, 0);
  expect(next.y).toBeCloseTo(prev.y, 0);
  expect(open.height).toBeCloseTo(prev.height, 0);
  expect(prev.x + prev.width).toBeLessThanOrEqual(open.x);
  expect(open.x + open.width).toBeLessThanOrEqual(next.x);
  await expect(prevButton).toBeInViewport({ ratio: 1 });
});

test("opens the level popover under its trigger, on screen", async ({ page }) => {
  await page.goto("/#level=sandbox");
  const trigger = page.locator(TRIGGER);
  const menu = page.locator(MENU);

  await expect(menu).toBeHidden();
  await trigger.click();

  await expect(menu).toBeVisible();
  await expect(menu).toBeInViewport({ ratio: 1 });

  const triggerBox = await boxOf(trigger, "the trigger");
  const menuBox = await boxOf(menu, "the popover");
  // Below the trigger and overlapping it horizontally.
  const triggerBottom = triggerBox.y + triggerBox.height;
  expect(menuBox.y).toBeGreaterThanOrEqual(triggerBottom);
  expect(menuBox.y - triggerBottom).toBeLessThan(triggerBox.height);
  expect(menuBox.x).toBeLessThan(triggerBox.x + triggerBox.width);
  expect(menuBox.x + menuBox.width).toBeGreaterThan(triggerBox.x);
});

test("opens the level a tile names when the tile is clicked", async ({ page }) => {
  await page.goto("/#level=sandbox");
  await page.locator(TRIGGER).click();

  // Exact, not `href*=`: a substring match on `level=1` also picks up ten through eighteen.
  const levelOne = page.locator(`${MENU} a.tasklink[href="#level=1"]`);
  await expect(levelOne).toBeInViewport({ ratio: 1 });
  await levelOne.click();

  await expect(page.locator(TRIGGER)).toHaveText("Level 1-1");
  await expect(page.locator(MENU)).toBeHidden();
  await expect(building(page).locator(".floor")).toHaveCount(3);
});
