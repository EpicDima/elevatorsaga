/**
 * The way past the building (WCAG 2.4.1): the editor sits behind every call
 * and floor button the building draws. Counted here, not asserted from
 * markup, since most of those stops exist only once the presenters run.
 */

import { expect, test } from "@playwright/test";

import { editor } from "./game-page.ts";

/** The busiest level: 8 elevators, 21 floors, and a call button per direction. */
const BUSIEST = "#level=18";

test("reaches the editor in one tab stop, from the busiest level", async ({ page }) => {
  await page.goto(`/${BUSIEST}`);
  await expect(editor(page)).toBeVisible();

  // Nothing focused yet, so this is the first stop on the page.
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to the code editor" });
  await expect(skipLink).toBeFocused();

  // A sighted keyboard user has to be able to tell where they are.
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeFocused();

  // Following the link as a link would drop `level=18` and restart on the first level.
  expect(new URL(page.url()).hash).toBe(BUSIEST);
});

test("saves a walk through the whole building", async ({ page }) => {
  await page.goto(`/${BUSIEST}`);
  await expect(editor(page)).toBeVisible();

  // Counted the long way: past the link, then one stop at a time until the editor has focus.
  await page.keyboard.press("Tab");
  let stops = 0;
  const editorHasFocus = (): Promise<boolean> =>
    editor(page).evaluate((node) => node === document.activeElement);
  while (stops < 400 && !(await editorHasFocus())) {
    await page.keyboard.press("Tab");
    stops += 1;
  }

  // Exact, not a range: a range wouldn't have caught this drifting before. Any
  // new control between the link and the editor moves it, and the new number
  // has to be measured rather than guessed at.
  expect(stops).toBe(260);
});
