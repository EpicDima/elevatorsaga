/**
 * Changing the language from inside the page, mid-run, in a real browser.
 *
 * `src/features/switch-language/ui/language-picker.test.ts` proves the sequence
 * a choice runs through and `src/app/app.test.ts` proves what `relocalise`
 * redraws, both against a jsdom document. Three things only exist in the built
 * site:
 *
 * - The Russian catalogue is fetched at the moment of the choice rather than
 *   before the first paint, so this is the only place the chunk is loaded into a
 *   page that is already running.
 * - The page is rewritten by four different pieces of code — `localisePage` for
 *   the shell, the challenge bar's presenter, the statistics, the building's
 *   labels — and a page half in each language is worse than either.
 * - "The run was not restarted" is a claim about a simulation that is running.
 *   Nothing in jsdom is running.
 *
 * The Russian is written out as a reader sees it rather than imported from
 * `src/i18n/ru.ts`, like every other spec here: a test that read the same
 * catalogue the page does would pass just as happily on a catalogue that had
 * quietly stopped being Russian.
 */

import { expect, test } from "@playwright/test";

import { languagePicker, seedText, startButton, statistic, statisticValue } from "./game-page.ts";

/** Where the choice is remembered between visits. */
const LOCALE_STORAGE_KEY = "elevatorLocale";

/** A busy challenge, started at speed so the clock is visibly running. */
const RUNNING_GAME = "/#challenge=4,timescale=8,autostart=true";

test("puts the whole page into Russian without disturbing the run", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(RUNNING_GAME);
  await expect(page.getByRole("button", { name: "Level 4" })).toBeVisible();

  // The run has to be under way before the language changes, or "it was not
  // restarted" is a claim about nothing.
  await expect.poll(async () => statisticValue(page, "Elapsed time")).toBeGreaterThan(3);
  const seed = (await (await seedText(page)).innerText()).trim();
  const elapsedBefore = await statisticValue(page, "Elapsed time");
  const transportedBefore = await statisticValue(page, "Transported");
  const callButtons = await page.getByRole("button", { name: /^Call an elevator/ }).count();
  expect(callButtons).toBeGreaterThan(0);

  await languagePicker(page).selectOption("ru");

  // The shell, rewritten from the catalogue.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  // Not `getByText`: the same caption key now labels two live elements at
  // once, the goal bar's meter and the (currently closed) statistics panel's
  // own tile for the same field, so a page-wide text match is ambiguous.
  await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
    "Перевезено",
  );
  await expect(page.getByRole("link", { name: "Документация" })).toBeVisible();
  // The challenge bar, rebuilt by the app; and the run controls, which are not
  // rebuilt at all -- they are drawn once for the life of the page, so every
  // word on them is written by the relabelling this change triggers.
  await expect(page.getByRole("button", { name: "Уровень 4" })).toBeVisible();
  await expect(startButton(page, "Пауза")).toBeVisible();
  await expect(page.getByRole("button", { name: "С начала" })).toBeVisible();
  // The building, renamed in place. This is the part that used to stay English
  // however the page was redrawn: these names are written when the floors are
  // drawn, and the floors are not drawn again.
  await expect(page.getByRole("button", { name: "Вызвать лифт вверх с этажа 0" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Лифт 1" })).toBeVisible();
  // And the control itself, now labelled in the language it just chose.
  await expect(languagePicker(page)).toHaveValue("ru");

  // The same building, and the same one: the seed names the draw, and a restart
  // would have taken another one.
  await expect(await seedText(page)).toHaveText(seed);
  await expect(page.getByRole("button", { name: /^Вызвать лифт/ })).toHaveCount(callButtons);
  // The same run, still running. Time only goes forwards, and the passengers
  // already delivered stay delivered.
  const elapsedAfter = await statisticValue(page, "Прошло времени");
  expect(elapsedAfter).toBeGreaterThanOrEqual(elapsedBefore);
  expect(await statisticValue(page, "Перевезено")).toBeGreaterThanOrEqual(transportedBefore);
  await expect
    .poll(async () => statisticValue(page, "Прошло времени"))
    .toBeGreaterThan(elapsedAfter);

  expect(pageErrors).toEqual([]);
});

test("writes the figures the way a reader of the new language writes them", async ({ page }) => {
  // The labels beside these are shell and are replaced wholesale; the figures
  // are formatted by `Intl` and are only written when the world says they
  // changed, so they are the half that a language change can quietly miss.
  await page.goto(RUNNING_GAME);
  await expect.poll(async () => statisticValue(page, "Elapsed time")).toBeGreaterThan(3);
  await expect(await statistic(page, "Elapsed time")).toHaveText(/s$/);

  await languagePicker(page).selectOption("ru");

  // A non-breaking space and «с», neither of which a glued-on "s" could produce.
  // Written as an escape rather than as the character, which is invisible in a
  // source file and would read as the ordinary space `Intl` does not use.
  await expect(await statistic(page, "Прошло времени")).toHaveText(/\u00A0с$/);
});

test("remembers the language for the next visit, and only when it was chosen", async ({ page }) => {
  // Start-up writes nothing: a language found in the browser's own preferences
  // or in somebody else's link is not a choice made here. This is.
  await page.goto("/#challenge=4");
  expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBeNull();

  await languagePicker(page).selectOption("ru");
  // Waited for rather than read straight away: the choice is written once the
  // catalogue has been fetched, and the redraw is what says it has been.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe("ru");

  // A plain visit afterwards, with nothing in the URL to say what language it
  // should be in.
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
  await expect(languagePicker(page)).toHaveValue("ru");
});

test("sends a Russian reader to the Russian reference page", async ({ page }) => {
  // The defect this closes: the header pointed at `documentation.html` in both
  // languages while the note under the editor -- whose link is inside the
  // translated sentence -- pointed at the Russian page, so two links that say
  // the same thing went to different places.
  await page.goto("/#challenge=4");

  await languagePicker(page).selectOption("ru");

  await expect(page.getByRole("link", { name: "Справка" })).toHaveAttribute(
    "href",
    "documentation.ru.html",
  );
  await page.getByRole("link", { name: "Документация" }).click();

  await expect(page).toHaveURL(/documentation\.ru\.html#docs$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("is one stop in the tab order, right after the links it sits beside", async ({ page }) => {
  // A `<select>` rather than one link per language, and reached the way a
  // keyboard player reaches it: tabbing on from the last of the header links.
  await page.goto("/#challenge=4");

  await page.getByRole("link", { name: "Wiki & Solutions" }).focus();
  await page.keyboard.press("Tab");

  await expect(languagePicker(page)).toBeFocused();
  // Both languages are offered, each named in itself: the reader who most needs
  // this control is the one who cannot read the language the page is in.
  await expect(languagePicker(page).locator("option")).toHaveText(["English", "Русский"]);
});

/**
 * Widths at which the header must come out the same height in either language.
 *
 * 1440 and 1280 are where it used to be worst: the title and the tools shared a
 * row while English fitted and Russian did not, so the choice cost 55px of page.
 * 1024 and 800 are where the two agreed even then, and are here so that a fix
 * that only widened the desktop case would not pass. 675 is the boundary itself,
 * measured — the narrowest width at which the two still agree.
 *
 * Below it they do not, and no assertion here pretends otherwise. Russian words
 * are longer, and on a phone the row of links needs a line English does not; the
 * stylesheet's note on `.header` has the sweep. What this pins is that the shape
 * stops being decided by which language is on screen wherever there is room for
 * it to be the same.
 */
const PARITY_WIDTHS = [1440, 1280, 1024, 800, 675] as const;

test("keeps the header the same height in either language", async ({ page }) => {
  const headerHeight = async (): Promise<number> =>
    await page.evaluate(() => {
      const header = document.querySelector(".header");
      if (header === null) {
        throw new Error("The page has no header to measure");
      }
      return Math.round(header.getBoundingClientRect().height * 100) / 100;
    });

  await page.goto("/#challenge=4");
  await expect(page.getByRole("link", { name: "Wiki & Solutions" })).toBeVisible();
  const english = new Map<number, number>();
  for (const width of PARITY_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    english.set(width, await headerHeight());
  }

  // Switched with the control rather than by loading a Russian URL, because the
  // page a player sees change under them is the one that jumped.
  await page.setViewportSize({ width: PARITY_WIDTHS[0], height: 900 });
  await languagePicker(page).selectOption("ru");
  await expect(page.getByRole("link", { name: "Справка" })).toBeVisible();

  for (const width of PARITY_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    expect(await headerHeight(), `header height at ${String(width)}px`).toBe(english.get(width));
  }
});
