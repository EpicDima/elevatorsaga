/**
 * The language the game starts in, in a real browser: that the Russian
 * catalog is an actual fetchable chunk, and that the shell and the widgets
 * around the building - rewritten by different code at different moments -
 * end up agreeing on one language. Russian words below are asserted as a
 * reader sees them, not imported from the catalog, since a test reading the
 * same catalog the page does would pass on one that had quietly gone stale.
 */

import { expect, test } from "@playwright/test";

import { startButton } from "./game-page.ts";

test("shows the whole game in the language a link asks for", async ({ page }) => {
  await page.goto("/#lang=ru");

  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  // The skip link: the shell's one remaining piece of rewritten text.
  await expect(page.getByRole("link", { name: "Перейти к редактору кода" })).toBeAttached();
  // Not `getByText`: the same caption key labels two live elements (the goal
  // bar's meter and the statistics panel's tile), so a page-wide match is ambiguous.
  await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
    "Перевезено",
  );
  await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
  await expect(startButton(page, "Запустить")).toBeVisible();
  // A caption pasted together from two catalog keys could still leak one's English into the other's.
  await expect(page.locator(".task-name")).not.toContainText("Level");
});

test("carries the language into the links the game builds", async ({ page }) => {
  // The router keeps parameters it doesn't recognize, so `lang` survives every
  // navigation the level switcher offers without being written to storage.
  await page.goto("/#lang=ru");

  // `exact`, since the open popover also holds tiles like "Учебный уровень 2"
  // that contain the numbered one's whole name.
  await page.getByRole("button", { name: "Уровень 1" }).click();
  await page.getByRole("link", { name: "Уровень 2", exact: true }).click();

  await expect(page).toHaveURL(/lang=ru/);
  await expect(page.getByRole("button", { name: "Уровень 2" })).toBeVisible();
});

test.describe("a browser that says it reads Russian", () => {
  // Sets `Accept-Language` and `navigator.languages`, the fallback source once URL and storage say nothing.
  test.use({ locale: "ru-RU" });

  test("gets Russian without being asked", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
    await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
      "Перевезено",
    );
  });

  test("gets the language the link names instead, when it names one", async ({ page }) => {
    await page.goto("/#lang=en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
    await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
      "Transported",
    );
  });
});
