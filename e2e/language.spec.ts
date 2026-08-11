/**
 * The language the game starts in, in a real browser.
 *
 * `src/ui/preferred-locale.test.ts` proves which language is chosen and that
 * the page shell comes out in it, against a document it parsed itself. What it
 * cannot prove is the half that only exists in the built site: that the Russian
 * catalogue is a chunk a browser can actually fetch — until the page asked for
 * one there was nothing in the game that reached it at all — and that what the
 * reader ends up looking at agrees with itself. The shell is rewritten from the
 * catalogue and the challenge bar is drawn from it, by different code at
 * different moments; a Russian shell around an English challenge bar is worse
 * than either language on its own, and this is the only place it would show.
 *
 * The Russian words below are asserted as a reader sees them, like every other
 * spec here, rather than imported from `src/i18n/ru.ts`. A test that reads the
 * same catalogue the page does would pass just as happily on a catalogue that
 * had quietly stopped being Russian.
 */

import { expect, test } from "@playwright/test";

/** The challenge bar's heading, which the game draws rather than the shell. */
const CHALLENGE_TITLE = ".challengetitle";

test("shows the whole game in the language a link asks for", async ({ page }) => {
  await page.goto("/#lang=ru");

  // What a screen reader picks its voice from, and what a crawler is told.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  // The shell: shipped in English by `index.html`, rewritten from the catalogue.
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeVisible();
  await expect(page.getByText("Перевезено", { exact: true })).toBeVisible();
  // The game the shell frames, drawn through the same catalogue by the
  // presenters -- and only after it had arrived, which is what keeps the two
  // halves of the page in one language.
  await expect(page.getByRole("heading", { name: /^Задание №1:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Старт" })).toBeVisible();
  await expect(page.locator(CHALLENGE_TITLE)).not.toContainText("Challenge");
});

test("carries the language into the links the game builds", async ({ page }) => {
  // The reason a language that arrived in somebody else's link is not written
  // to storage: it does not need to be. The router keeps parameters it does not
  // recognise, so `lang` survives every navigation the challenge bar offers and
  // stays in the address bar to be copied out of again.
  await page.goto("/#lang=ru");

  await page.getByRole("link", { name: "Задание 2" }).click();

  await expect(page).toHaveURL(/lang=ru/);
  await expect(page.getByRole("heading", { name: /^Задание №2:/ })).toBeVisible();
});

test.describe("a browser that says it reads Russian", () => {
  // Sets both the `Accept-Language` header and `navigator.languages`, which is
  // the source `resolveLocale` reads when the URL and the storage say nothing.
  test.use({ locale: "ru-RU" });

  test("gets Russian without being asked", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { name: /^Задание №1:/ })).toBeVisible();
    await expect(page.getByText("Перевезено", { exact: true })).toBeVisible();
  });

  test("gets the language the link names instead, when it names one", async ({ page }) => {
    // The order the sources are in, in the only place it is visible: a link
    // sent to a Russian-speaking reader by somebody who meant them to see the
    // English game.
    await page.goto("/#lang=en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: /^Challenge #1:/ })).toBeVisible();
    await expect(page.getByText("Transported", { exact: true })).toBeVisible();
  });
});
