/**
 * The help pages: mostly static documents a unit test can check from source,
 * except whether each is actually emitted to `dist/` at all - a page left out
 * of `rolldownOptions.input` is simply absent, with links to it still 404ing.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { startButton } from "./game-page.ts";

test("serves the help page, whole, at its own address", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Visited directly: nothing in the game links here any more, so only this file notices if it disappears.
  await page.goto("/documentation.html");

  await expect(page).toHaveTitle(/API reference/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Help and API documentation");

  // Not blank, and not a shell that failed to load its content: the prose, the
  // API reference and its tables are all there.
  await expect(page.getByRole("heading", { level: 2, name: "About the game" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "API documentation" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "goToFloor", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "loadFactor", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back to the game" }).click();
  await expect(startButton(page)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

/**
 * Widths pinned for the header the two help pages share: a desk width (1440)
 * and the widths just above and below the phone-sized breakpoint (761, 760)
 * where English and Russian once disagreed on height.
 */
const HEADER_WIDTHS = [1440, 761, 760] as const;

/** The height the header renders at, in the page loaded last. */
async function headerHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const header = document.querySelector(".header");
    if (header === null) {
      throw new Error("The page has no header to measure");
    }
    return Math.round(header.getBoundingClientRect().height * 100) / 100;
  });
}

test("renders its header at the same height as its Russian twin, at every width that caught it", async ({
  page,
}) => {
  for (const width of HEADER_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/documentation.html");
    const english = await headerHeight(page);

    await page.goto("/documentation.ru.html");
    const russian = await headerHeight(page);

    expect(russian, `header height at ${String(width)}px`).toBe(english);
  }
});

test("sends a beginner from the help page into the learning track", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/documentation.html");
  await page.getByRole("link", { name: "learning track" }).click();

  // A router that can't read the level address falls back to the track's
  // first level anyway, so landing on this title is what actually proves it opened.
  await expect(page).toHaveURL(/\/index\.html#level=tutorial-1$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "The elevator that goes nowhere" }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("serves the Russian help page, and links the two together both ways", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/documentation.html");
  await page.getByRole("link", { name: "Русский" }).click();

  // Confirms it's a real page of its own, not a hashed copy under `assets/`.
  await expect(page).toHaveURL(/\/documentation\.ru\.html$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  await expect(page.getByRole("heading", { level: 2, name: "Об игре" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Документация по API" })).toBeVisible();
  // The API names stay in English on both pages: they're what the player types.
  await expect(page.getByRole("cell", { name: "goToFloor", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/documentation\.html$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("link", { name: "Русский" }).click();
  await page.getByRole("link", { name: "Вернуться к игре" }).click();
  await expect(startButton(page)).toBeVisible();

  expect(pageErrors).toEqual([]);
});
