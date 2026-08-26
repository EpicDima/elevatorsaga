/** Checks how the router leaves the address bar and the Back button in a real browser. */

import { expect, test } from "@playwright/test";

import { seedField } from "./game-page.ts";

test("takes a parameter the game refused out of the address bar", async ({ page }) => {
  // A seed of "rush hour" is refused: a browser encodes the space as %20, and a percent sign is
  // not a seed.
  await page.goto("/#level=4,seed=rush hour");

  await expect(page).toHaveURL(/#level=4$/);
  await expect(page.getByRole("button", { name: "Level 1-4" })).toBeVisible();
  await expect(await seedField(page)).toBeVisible();
});

test("empties a hash whose every parameter was refused", async ({ page }) => {
  await page.goto("/#level=abc");

  await expect(page.getByRole("button", { name: "Level 1-1" })).toBeVisible();
  // Checked via location.hash, not toHaveURL: an empty fragment still serializes with a
  // trailing "#", which toHaveURL would see.
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});

test("opens a level this browser has never played, and leaves the url saying so", async ({
  page,
}) => {
  // No level is locked, so this address must be kept exactly as given, not corrected to the
  // furthest level reached.
  await page.goto("/#level=18,timescale=8");

  await expect(page).toHaveURL(/#level=18,timescale=8$/);
  await expect(page.getByRole("button", { name: "Level 1-18" })).toBeVisible();
});

test("does not leave the refused url behind the Back button", async ({ page }) => {
  // This is why the correction uses replaceState: a pushed entry would let Back land on the
  // refused URL, get corrected again, and never advance.
  await page.goto("/#level=2");
  await expect(page.getByRole("button", { name: "Level 1-2" })).toBeVisible();

  await page.goto("/#level=abc");
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  await page.goBack();

  await expect(page).toHaveURL(/#level=2$/);
  await expect(page.getByRole("button", { name: "Level 1-2" })).toBeVisible();
});

test("opens a link written with the retired key, and re-spells it", async ({ page }) => {
  // Existing shared links use challenge=; opening one must still work, and the bar should then
  // show the current level= spelling.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Level 1-1" })).toBeVisible();

  await page.goto("/#challenge=4,timescale=8");

  await expect(page).toHaveURL(/#level=4,timescale=8$/);
  await expect(page.getByRole("button", { name: "Level 1-4" })).toBeVisible();

  // Same replaceState behavior: Back lands before the legacy URL, not on it.
  await page.goBack();
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  await expect(page.getByRole("button", { name: "Level 1-1" })).toBeVisible();
});

test("opens a chapter two link written with the level's id, and re-spells it", async ({ page }) => {
  // Chapter two was addressed by id until each chapter started counting from one; those links
  // must still open the level they always did, under the address it is written with now.
  await page.goto("/#level=chapter2-3,timescale=8");

  await expect(page).toHaveURL(/#level=2-3,timescale=8$/);
  await expect(page.getByRole("button", { name: "Level 2-3" })).toBeVisible();
});

test("keeps a value it only clamped, which still names the run on screen", async ({ page }) => {
  // `floors=100000` resolves to sixty floors every time it is read and the bar
  // prints sixty, so the URL and the building agree and there is nothing to
  // correct. Only a refusal leaves the two saying different things.
  await page.goto("/#level=sandbox,floors=100000");

  await expect(page).toHaveURL(/#level=sandbox,floors=100000$/);
  // The sandbox has no requirement to state as a meter, so `widgets/goal-bar`
  // falls back to `.goalfree`'s own prose, the same as the old level bar's
  // heading did.
  await expect(page.locator(".goalfree")).toContainText("60");
});
