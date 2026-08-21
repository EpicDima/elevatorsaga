/**
 * Where the building's hover card lands, and what pointing at a floor lights
 * up.
 *
 * Both are questions only a browser can answer. jsdom lays nothing out, so the
 * widget's own tests can check the placement arithmetic against boxes they
 * invented but not against a building that has really been drawn -- and the
 * defect this file exists for was exactly a real box being the wrong one: a
 * card anchored to a shaft, which is the whole height of the house, came up
 * floors away from the car it was describing, and the layer the shafts stand in
 * quietly ate every hover meant for a corridor.
 *
 * The card, the corridor strips and the mark are all reached by class. They are
 * the exception this suite otherwise avoids, for the reason `statistic` in
 * `game-page.ts` is: none of the three is a control or has an accessible name,
 * because none of them is addressed to a screen reader at all -- the card
 * duplicates what `aria-describedby` already says, and the mark is decoration
 * over information the row states in text.
 */

import { expect, test, type Locator } from "@playwright/test";

/** A viewport tall enough that a ten-floor building overflows its pane. */
const VIEWPORT = { width: 1280, height: 900 } as const;

/**
 * An element's box on screen, failing the test if it has none.
 *
 * @param locator - The element to measure.
 * @returns Its bounding box in page coordinates.
 */
async function boxOf(locator: Locator): Promise<{ y: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, "the element is not laid out on screen").not.toBeNull();
  return box ?? { y: 0, height: 0 };
}

/**
 * The vertical middle of an element's box.
 *
 * @param locator - The element to measure.
 * @returns Its center's page y.
 */
async function centerY(locator: Locator): Promise<number> {
  const box = await boxOf(locator);
  return box.y + box.height / 2;
}

test("puts a car's card beside the cabin, not in the middle of its shaft", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/#level=9");

  const shaft = page.getByRole("group", { name: "Elevator 0" });
  await expect(shaft).toBeVisible();
  await shaft.hover();

  const card = page.locator(".carcard");
  await expect(card).toBeVisible();

  const cardCenter = await centerY(card);
  const carCenter = await centerY(page.locator(".car").first());
  const shaftCenter = await centerY(shaft);

  // Level by level with the cabin, which is standing on the ground floor.
  expect(Math.abs(cardCenter - carCenter)).toBeLessThanOrEqual(8);
  // And nowhere near the middle of the shaft -- a card anchored to the shaft
  // came up there, half a building away from the car it names, and in a taller
  // house than this one was clamped against the top edge of the pane besides.
  expect(Math.abs(cardCenter - shaftCenter)).toBeGreaterThan(100);
});

test("raises a floor's card from the corridor and marks the floor at both ends", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/#level=9");
  await expect(page.locator(".car").first()).toBeVisible();

  // The strip of walkway beside floor 4, which is where that floor's
  // passengers are standing and so what a player pointing at the floor is
  // really pointing at.
  const queue = page.locator(".queue").nth(4);
  await queue.hover();

  const card = page.locator(".carcard");
  await expect(card).toBeVisible();
  const cardBox = await boxOf(card);
  const queueBox = await boxOf(queue);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(queueBox.y);

  // One floor marked, in both of the two layers a floor is split across: its
  // row over in the number column, and its band drawn through the building.
  await expect(page.locator(".floor.is-hot")).toHaveCount(1);
  await expect(page.locator(".floorline.is-hot")).toHaveCount(1);
  await expect(page.locator(".floor.is-hot .level-num")).toHaveText("4");

  await page.mouse.move(0, 0);
  await expect(page.locator(".is-hot")).toHaveCount(0);
  await expect(card).toBeHidden();
});
