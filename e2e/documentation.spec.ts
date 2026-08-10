/**
 * The help page: the build emits two HTML entry points, and only one of them is
 * exercised by every other test in here.
 */

import { expect, test } from "@playwright/test";

test("serves the help page from the game's own navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("link", { name: "Help", exact: true }).click();

  await expect(page).toHaveURL(/documentation\.html$/);
  await expect(page).toHaveTitle(/help and API documentation/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Help and API documentation");

  // Not blank, and not a shell that failed to load its content: the prose, the
  // API reference and its tables are all there.
  await expect(page.getByRole("heading", { level: 2, name: "About the game" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "API documentation" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "goToFloor", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "loadFactor", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back to the game" }).click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
