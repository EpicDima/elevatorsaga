/**
 * The app bar's level switcher is the only way into a level that is not a URL
 * somebody already knows, so what is checked here is that a player can reach
 * one by pointing at the screen: the trigger and its two chevrons stand on one
 * row, the popover opens where the trigger is rather than somewhere off the
 * page, and a tile in it actually changes the building.
 *
 * All three are laid out entirely by `level-switcher.css`, and all three broke
 * at once when the «уровень» sweep renamed the widget's root element from
 * `task` to `level` and left the stylesheet -- which takes its names from
 * `design/ui-mockup.html` §3 -- saying `.task`. Nothing in the DOM changed
 * shape: the trigger was still a button with a click listener, the popover was
 * still built, still unhidden on click, still full of the right tiles, and
 * every unit test in `level-switcher.test.ts` still passed. What changed was
 * where the browser put them, because the root had stopped being the
 * `display: flex` that puts the three controls in a row and the
 * `position: relative` that `.taskmenu`'s `position: absolute` measures from.
 * The chevrons stacked into a column the bar clipped away and the popover
 * opened a full viewport below the fold; on screen that is a switcher with no
 * arrows whose button does nothing when pressed, which is how it was reported.
 *
 * So these are position assertions rather than markup ones on purpose --
 * `toBeInViewport` and two rectangles -- since a widget that is present,
 * correct and somewhere else is exactly the failure that got through. The
 * root's own class is pinned next door in `level-switcher.test.ts`, where it
 * costs no browser; this file covers whatever else could put the popover
 * off screen.
 *
 * The sandbox is where it is measured because that is the route it was
 * reported from, and because it is the one route where both chevrons are
 * disabled -- `stepHref` steps within a block, and the sandbox is alone in
 * "Other" -- so a spec that read them as arrows to click would have nothing
 * to click. Disabled is not invisible, and where they are is the question.
 */

import { expect, test, type Locator } from "@playwright/test";

import { building } from "./game-page.ts";

/** The switcher's trigger: the button naming the level on screen. */
const TRIGGER = ".task-open";

/** The popover it opens. */
const MENU = ".taskmenu";

/**
 * One element's box, refusing to measure something that is not on screen —
 * `boxOf` in `tutorial.spec.ts`, for the reason given there: `boundingBox()`
 * answers `null` for an element with no layout, and a comparison against
 * `null` passes on exactly the failure these tests are written for.
 *
 * @param locator - The element to measure.
 * @param what - What it is, for the message if it is not there.
 * @returns Its box in page coordinates, which are the viewport's here — the
 * page never scrolls (`body.app` sets `overflow: hidden`).
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

  // One row: same top, same height, left to right in document order. A column
  // satisfies none of the three, and a column is what a root with no
  // `display: flex` produced.
  expect(open.y).toBeCloseTo(prev.y, 0);
  expect(next.y).toBeCloseTo(prev.y, 0);
  expect(open.height).toBeCloseTo(prev.height, 0);
  expect(prev.x + prev.width).toBeLessThanOrEqual(open.x);
  expect(open.x + open.width).toBeLessThanOrEqual(next.x);
  // On the row *and* in the window: the column the bug drew started above the
  // viewport's own top edge, with the first chevron entirely outside it.
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
  // Below the trigger and overlapping it horizontally: `.taskmenu` is
  // `top: calc(100% + 8px); left: 28px` of a root that is the switcher, so a
  // popover measured from anything else lands somewhere this cannot be true
  // of.
  const triggerBottom = triggerBox.y + triggerBox.height;
  expect(menuBox.y).toBeGreaterThanOrEqual(triggerBottom);
  expect(menuBox.y - triggerBottom).toBeLessThan(triggerBox.height);
  expect(menuBox.x).toBeLessThan(triggerBox.x + triggerBox.width);
  expect(menuBox.x + menuBox.width).toBeGreaterThan(triggerBox.x);
});

test("opens the level a tile names when the tile is clicked", async ({ page }) => {
  await page.goto("/#level=sandbox");
  await page.locator(TRIGGER).click();

  const levelOne = page.locator(`${MENU} a.tasklink[href*="level=1"]`);
  await expect(levelOne).toBeInViewport({ ratio: 1 });
  await levelOne.click();

  await expect(page.locator(TRIGGER)).toHaveText("Level 1");
  await expect(page.locator(MENU)).toBeHidden();
  // Level 1's building, not the sandbox's: three floors against the eight the
  // route this spec started on draws.
  await expect(building(page).locator(".floor")).toHaveCount(3);
});
