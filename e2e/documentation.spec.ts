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
import type { Page } from "@playwright/test";

import { startButton } from "./game-page.ts";

test("serves the help page, whole, at its own address", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Visited directly. The game used to link here from its header and no longer
  // links here at all -- the help it offers is the docs dialog, and these two
  // pages are standalone documents the build still emits. Which is exactly what
  // this file exists to check: an entry point dropped from
  // `rolldownOptions.input` is simply absent, and nothing else would notice.
  await page.goto("/documentation.html");

  await expect(page).toHaveTitle(/help and API documentation/i);
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
 * Widths pinned for the header the two help pages share with each other.
 *
 * `.header` is theirs alone now -- the game page's header became the app bar,
 * which is a fixed `--ds-bar-h` in every language and has its own guards. What
 * is left here is the rule these two pages inherited from it, and the widths
 * are the ones that caught it going wrong. 1440 is a desk and 761 the width
 * just above the phone-sized rule at the foot of `pages/docs/ui/docs-page.css`.
 * 760 is one pixel
 * below that rule -- where the two used to disagree with each other (35px in
 * English, 80.27px in Russian) before the shared rule changed shape for a
 * defect that was never theirs, and now agree at 70.27px. Each help page is a
 * document of its own, so there is no language picker to switch mid-visit,
 * only two separately built pages to compare.
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

  // `src/page.test.ts` holds the href to the first level's id; what it cannot
  // hold is that the address still opens the level, since a level address the
  // router cannot read lands on the track's first level anyway and only a
  // console warning tells the two apart. Landing on the level's own title is
  // the difference, and it is also the only check here that the hash survives
  // being followed from a page that is not the game.
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
  await expect(startButton(page)).toBeVisible();

  expect(pageErrors).toEqual([]);
});
