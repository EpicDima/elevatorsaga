/**
 * The help pages: the build emits three HTML entry points, and every other test
 * in here exercises only the first.
 *
 * A reference page is a static document, so almost everything about it is a
 * question `src/page.test.ts` can answer from the source. What it cannot answer
 * is whether the page is in `dist/` at all — Vite only processes the HTML files
 * named in `rolldownOptions.input`, and one left out is simply absent, with the
 * links to it still in the shipped markup and still 404ing.
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

test("sends a beginner from the help page into the learning track", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/documentation.html");
  await page.getByRole("link", { name: "learning track" }).click();

  // `src/page.test.ts` holds the href to the first task's id; what it cannot
  // hold is that the address still opens the task, since a task address the
  // router cannot read lands on the track's first task anyway and only a
  // console warning tells the two apart. Landing on the task's own title is
  // the difference, and it is also the only check here that the hash survives
  // being followed from a page that is not the game.
  await expect(page).toHaveURL(/\/index\.html#challenge=tutorial-1$/);
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

  // Emitted as a page of its own, rather than as a hashed copy in `assets/`:
  // `<link rel="alternate">` was resolved as an asset regardless of `rel` until
  // the four of them were marked `vite-ignore`, which rewrote both hreflangs to
  // a second, unlinked site. The URL here is what proves that fix still holds.
  await expect(page).toHaveURL(/\/documentation\.ru\.html$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  // Translated, and not an English page under a Russian name.
  await expect(page.getByRole("heading", { level: 2, name: "Об игре" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Документация по API" })).toBeVisible();
  // The API names themselves stay in English on both pages: they are what the
  // player types.
  await expect(page.getByRole("cell", { name: "goToFloor", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/documentation\.html$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // And the way back to the game works from the translated page too.
  await page.getByRole("link", { name: "Русский" }).click();
  await page.getByRole("link", { name: "Вернуться к игре" }).click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
