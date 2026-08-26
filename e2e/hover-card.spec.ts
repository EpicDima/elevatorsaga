/**
 * Where the building's hover card lands, and what pointing at a floor lights
 * up - only answerable against a really-drawn building, since jsdom lays
 * nothing out. Reached by class, not role: none of the card, strips, or mark
 * is addressed to a screen reader, so none has an accessible name to find them by.
 */

import { expect, test, type Locator } from "@playwright/test";

/** A viewport tall enough that a ten-floor building overflows its pane. */
const VIEWPORT = { width: 1280, height: 900 } as const;

/** An element's box on screen, failing the test if it has none. */
async function boxOf(locator: Locator): Promise<{ y: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, "the element is not laid out on screen").not.toBeNull();
  return box ?? { y: 0, height: 0 };
}

/** The vertical middle of an element's box. */
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

  expect(Math.abs(cardCenter - carCenter)).toBeLessThanOrEqual(8);
  // Not near the shaft's middle: a card anchored there once landed half a building away from the car.
  expect(Math.abs(cardCenter - shaftCenter)).toBeGreaterThan(100);
});

test("raises a floor's card from the corridor and marks the floor at both ends", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/#level=9");
  await expect(page.locator(".car").first()).toBeVisible();

  // The walkway strip beside floor 4, where its passengers stand.
  const queue = page.locator(".queue").nth(4);
  await queue.hover();

  const card = page.locator(".carcard");
  await expect(card).toBeVisible();
  const cardBox = await boxOf(card);
  const queueBox = await boxOf(queue);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(queueBox.y);

  // Marked in both layers a floor is split across: the number column and the band through the building.
  await expect(page.locator(".floor.is-hot")).toHaveCount(1);
  await expect(page.locator(".floorline.is-hot")).toHaveCount(1);
  await expect(page.locator(".floor.is-hot .level-num")).toHaveText("4");

  await page.mouse.move(0, 0);
  await expect(page.locator(".is-hot")).toHaveCount(0);
  await expect(card).toBeHidden();
});
