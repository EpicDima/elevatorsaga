/** Switches the language mid-run in a real browser, where the catalog fetch and cross-widget redraw actually happen. */

import { expect, test } from "@playwright/test";

import {
  editor,
  languagePicker,
  seedField,
  startButton,
  statistic,
  statisticValue,
} from "./game-page.ts";

/** Where the choice is remembered between visits. */
const LOCALE_STORAGE_KEY = "elevatorLocale";

/** A busy level run at high speed, so a few real seconds cover a few seconds of simulated time. */
const RUNNING_GAME = "/#level=4,timescale=8";

test("puts the whole page into Russian without disturbing the run", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(RUNNING_GAME);
  await expect(page.getByRole("button", { name: "Level 4" })).toBeVisible();
  await startButton(page).click();

  // Elapsed time must advance before the language change, so a later "not restarted" claim is meaningful.
  await expect.poll(async () => statisticValue(page, "Elapsed time")).toBeGreaterThan(3);
  // inputValue, not innerText: innerText on an <input> is always empty, which would let this pass vacuously.
  const seed = (await (await seedField(page)).inputValue()).trim();
  expect(seed).not.toBe("");
  const elapsedBefore = await statisticValue(page, "Elapsed time");
  const transportedBefore = await statisticValue(page, "Transported");
  const callButtons = await page.getByRole("button", { name: /^Call an elevator/ }).count();
  expect(callButtons).toBeGreaterThan(0);

  await (await languagePicker(page)).selectOption("ru");

  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  // Not getByText: the same caption labels two live elements (goal bar and stats panel), so a
  // page-wide text match would be ambiguous.
  await expect(page.locator('.meter[data-kind="transportedCounter"] .cap')).toHaveText(
    "Перевезено",
  );
  await expect(page.getByRole("button", { name: "Справка" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Уровень 4" })).toBeVisible();
  await expect(startButton(page, "Пауза")).toBeVisible();
  // exact: true, because the dice button's own label also contains "заново" and accessible-name
  // matching is substring-based.
  await expect(page.getByRole("button", { name: "Заново", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Скорость прогона" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вызвать лифт вверх с этажа 0" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Лифт 0" })).toBeVisible();
  await expect(await languagePicker(page)).toHaveValue("ru");
  // Found by its Russian name: the surface's own accessible name follows the change too, so the
  // English one no longer matches anything.
  await expect(editor(page, "Программа для лифтов")).toContainText("Возьмём первый лифт");
  await expect(editor(page, "Программа для лифтов")).not.toContainText(
    "Let's use the first elevator",
  );
  await expect(editor(page)).toHaveCount(0);

  // Same seed confirms the run was not restarted.
  await expect(await seedField(page)).toHaveValue(seed);
  await expect(page.getByRole("button", { name: /^Вызвать лифт/ })).toHaveCount(callButtons);
  // Elapsed time and delivered passengers only increase; the run is still going, not restarted.
  const elapsedAfter = await statisticValue(page, "Прошло времени");
  expect(elapsedAfter).toBeGreaterThanOrEqual(elapsedBefore);
  expect(await statisticValue(page, "Перевезено")).toBeGreaterThanOrEqual(transportedBefore);
  await expect
    .poll(async () => statisticValue(page, "Прошло времени"))
    .toBeGreaterThan(elapsedAfter);

  expect(pageErrors).toEqual([]);
});

test("writes the figures the way a reader of the new language writes them", async ({ page }) => {
  // Labels are shell text and always redrawn; the figures are formatted by Intl and only rewritten
  // when the data changes, so a language switch could miss them.
  await page.goto(RUNNING_GAME);
  await startButton(page).click();
  await expect.poll(async () => statisticValue(page, "Elapsed time")).toBeGreaterThan(3);
  await expect(await statistic(page, "Elapsed time")).toHaveText(/s$/);

  await (await languagePicker(page)).selectOption("ru");

  // A non-breaking space plus "с": Intl's formatting, not a glued-on "s". Escaped rather than
  // typed literally, since the actual character is invisible in source.
  await expect(await statistic(page, "Прошло времени")).toHaveText(/\u00A0с$/);
});

test("remembers the language for the next visit, and only when it was chosen", async ({ page }) => {
  // Startup alone must not write to storage; only an explicit choice does.
  await page.goto("/#level=4");
  expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBeNull();

  await (await languagePicker(page)).selectOption("ru");
  // Wait for the redraw before checking storage: the choice is only persisted after the catalog
  // fetch resolves.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe("ru");

  // A plain visit, with no language in the URL, to confirm the stored choice applies.
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("button", { name: "Уровень 1" })).toBeVisible();
  await expect(await languagePicker(page)).toHaveValue("ru");
});

test("is a keyboard-operable control inside the settings popover", async ({ page }) => {
  // Opens the popover via a real click rather than languagePicker's forcing, since the point here
  // is proving the control is reachable at all.
  await page.goto("/#level=4");

  await page.getByRole("button", { name: "Settings" }).click();
  const picker = await languagePicker(page);
  await expect(picker).toBeVisible();

  // Focused via the keyboard: a control only a pointer can reach is not accessible.
  await picker.focus();
  await expect(picker).toBeFocused();
  // Each language names itself, since the reader who needs this control most can't read the
  // page's current language.
  await expect(picker.locator("option")).toHaveText(["English", "Русский"]);
});
