/**
 * The red underline under the line a program threw on. Asserts a column, not
 * just that something is underlined: a regex matching the wrong position in a
 * V8 `eval` frame would still light up a mark, just in the wrong place.
 */

import { expect, test } from "@playwright/test";

import { editor, seedCode, startButton } from "./game-page.ts";

/**
 * Compiles, then throws on line 4, column 9. Indented eight spaces so the
 * mark - which runs from the failing column to the line's end - should cover
 * exactly `missingHelperE2E();` and none of the indentation. In `update`, not
 * `init`, so the error arrives from inside a running simulation.
 */
const THROWS_ON_LINE_4 = `{
    init: function (elevators, floors) {},
    update: function (dt, elevators, floors) {
        missingHelperE2E();
    },
}`;

/** The banner the app shows for any failure in the player's program. */
const errorBanner = "There is an error in your program";

/** The decoration the editor draws under the failing text. */
const errorMark = ".cm-errorMark";

test("underlines the line a running program threw on", async ({ page }) => {
  await seedCode(page, THROWS_ON_LINE_4);

  await page.goto("/");

  await expect(page.locator(errorMark)).toHaveCount(0);

  await startButton(page).click();

  await expect(page.getByText(errorBanner)).toBeVisible();
  const mark = page.locator(errorMark);
  await expect(mark).toBeVisible();
  // `textContent`, not `toHaveText`: the latter normalizes whitespace, so it
  // couldn't tell a correct column from the mark starting eight spaces early.
  expect(await mark.textContent()).toBe("missingHelperE2E();");
});

test("takes the underline off as soon as the player edits", async ({ page }) => {
  await seedCode(page, THROWS_ON_LINE_4);
  await page.goto("/");
  await startButton(page).click();
  await expect(page.locator(errorMark)).toBeVisible();

  await editor(page).click();
  await page.keyboard.type("x");

  await expect(page.locator(errorMark)).toHaveCount(0);
});

test("underlines nothing when the program never compiled", async ({ page }) => {
  // A syntax error has no position in a V8 stack: the code never ran, so
  // there's no frame describing it, though the banner still says what's wrong.
  await seedCode(page, "{ init: function () { , }, update: function () {} }");

  await page.goto("/");

  await expect(page.getByText(errorBanner)).toBeVisible();
  await expect(page.locator(errorMark)).toHaveCount(0);
});
