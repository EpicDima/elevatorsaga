/**
 * The language the game starts in, in a real browser.
 *
 * `src/ui/preferred-locale.test.ts` proves which language is chosen and that
 * the page shell comes out in it, against a document it parsed itself. What it
 * cannot prove is the half that only exists in the built site: that the Russian
 * catalogue is a chunk a browser can actually fetch — until the page asked for
 * one there was nothing in the game that reached it at all — and that what the
 * reader ends up looking at agrees with itself. The shell is rewritten from the
 * catalogue and the level bar is drawn from it, by different code at
 * different moments; a Russian shell around an English level bar is worse
 * than either language on its own, and this is the only place it would show.
 *
 * The Russian words below are asserted as a reader sees them, like every other
 * spec here, rather than imported from `src/i18n/ru.ts`. A test that reads the
 * same catalogue the page does would pass just as happily on a catalogue that
 * had quietly stopped being Russian.
 */

import { expect, test } from "@playwright/test";

import { startButton } from "./game-page.ts";

test("shows the whole game in the language a link asks for", async ({ page }) => {
  await page.goto("/#lang=ru");

  // What a screen reader picks its voice from, and what a crawler is told.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  // The shell: shipped in English by `index.html`, rewritten from the
  // catalogue. The skip link is the whole of it that is still words -- what the
  // header used to say is the app bar's now, and the app bar writes its own.
  await expect(page.getByRole("link", { name: "Перейти к редактору кода" })).toBeAttached();
  // Not `getByText`: the same caption key now labels two live elements at
  // once, the goal bar's meter and the (currently closed) statistics panel's
  // own tile for the same field, so a page-wide text match is ambiguous.
  await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
    "Перевезено",
  );
  // The game the shell frames, drawn through the same catalogue by the
  // presenters -- and only after it had arrived, which is what keeps the two
  // halves of the page in one language.
  await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
  await expect(startButton(page, "Запустить")).toBeVisible();
  // And nothing here still says it in English -- the button above is found by
  // its exact translated name, but a caption pasted together from two
  // catalogue keys could still leak one's English into the other's row.
  await expect(page.locator(".task-name")).not.toContainText("Level");
});

test("carries the language into the links the game builds", async ({ page }) => {
  // The reason a language that arrived in somebody else's link is not written
  // to storage: it does not need to be. The router keeps parameters it does not
  // recognise, so `lang` survives every navigation the level switcher offers and
  // stays in the address bar to be copied out of again.
  //
  // Level 2 only draws as a link once level 1 has a tier on record --
  // `features/switch-level`'s own gate -- so this seeds that record before the
  // page boots, the same one a real clear of level 1 would leave behind.
  await page.addInitScript(() => {
    localStorage.setItem("develevateChallengeTiers", JSON.stringify({ 0: "bronze" }));
  });
  await page.goto("/#lang=ru");

  // The tile is a real link, but it sits behind the switcher's own closed
  // popover -- opened here the way a player would, by pressing the trigger
  // that already names the level on screen. `exact`, because the open popover
  // also holds the track's own tiles and "Учебный уровень 2" contains the
  // numbered one's whole name.
  await page.getByRole("button", { name: "Уровень 1" }).click();
  await page.getByRole("link", { name: "Уровень 2", exact: true }).click();

  await expect(page).toHaveURL(/lang=ru/);
  await expect(page.getByRole("button", { name: "Уровень 2" })).toBeVisible();
});

test.describe("a browser that says it reads Russian", () => {
  // Sets both the `Accept-Language` header and `navigator.languages`, which is
  // the source `resolveLocale` reads when the URL and the storage say nothing.
  test.use({ locale: "ru-RU" });

  test("gets Russian without being asked", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
    // Not `getByText`: the same caption key now labels two live elements at
    // once, the goal bar's meter and the (currently closed) statistics panel's
    // own tile for the same field, so a page-wide text match is ambiguous.
    await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
      "Перевезено",
    );
  });

  test("gets the language the link names instead, when it names one", async ({ page }) => {
    // The order the sources are in, in the only place it is visible: a link
    // sent to a Russian-speaking reader by somebody who meant them to see the
    // English game.
    await page.goto("/#lang=en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
    // See the same-named field's own Russian-locale note above: the caption
    // key labels two live elements at once, so this is scoped the same way.
    await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
      "Transported",
    );
  });
});
