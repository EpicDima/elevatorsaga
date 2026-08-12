/**
 * The red underline under the line a program threw on, end to end.
 *
 * The unit tests for this drive real thrown errors, but they run under Vitest,
 * which runs under Node, which is V8 — the same engine, reached a different way.
 * What no unit test can reach is the shape of a stack a browser actually
 * produces for code the page itself `eval`ed, and every number this feature
 * shows comes out of parsing that string. So this spec asserts a column, not
 * just that something is underlined: a regex that matched the wrong one of the
 * two positions in a V8 `eval` frame, or a wrap correction applied to the wrong
 * line, would still light up a mark and would light it in the wrong place.
 *
 * Only Chromium is configured in `playwright.config.ts`, so what is proved here
 * is the V8 half. The JavaScriptCore half is covered by transcribed recordings
 * in `src/ui/error-location.test.ts`, and no browser in this suite exercises it.
 */

import { expect, test } from "@playwright/test";

import { editor, seedCode } from "./game-page.ts";

/**
 * A program that compiles and then throws on line 4, at column 9.
 *
 * The call is indented eight spaces, so the mark — which runs from the failing
 * column to the end of its line — should cover exactly `missingHelperE2E();`
 * and nothing of the indentation. That is what makes the assertion a check on
 * the column rather than on the line: an off-by-anything in the column
 * arithmetic drags leading spaces in or cuts the call short.
 *
 * `update` rather than `init`, so that the error arrives from inside a running
 * simulation, which is the path the app forwards to the editor.
 */
const THROWS_ON_LINE_4 = `{
    init: function (elevators, floors) {},
    update: function (dt, elevators, floors) {
        missingHelperE2E();
    },
}`;

/** The banner the app shows for any failure in the player's program. */
const errorBanner = "There is a problem with your code";

/** The decoration the editor draws under the failing text. */
const errorMark = ".cm-errorMark";

test("underlines the line a running program threw on", async ({ page }) => {
  await seedCode(page, THROWS_ON_LINE_4);

  await page.goto("/");

  // It compiles, so there is nothing to underline until it runs.
  await expect(page.locator(errorMark)).toHaveCount(0);

  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText(errorBanner)).toBeVisible();
  const mark = page.locator(errorMark);
  await expect(mark).toBeVisible();
  // Read rather than matched with `toHaveText`, which normalises whitespace and
  // would therefore see the same string whether the mark began at the call or
  // eight spaces to the left of it — which is to say, it could not tell a
  // correct column from no column arithmetic at all. Checked: with the mark
  // pinned to the start of the line instead, `toHaveText` still passed.
  expect(await mark.textContent()).toBe("missingHelperE2E();");
});

test("takes the underline off as soon as the player edits", async ({ page }) => {
  await seedCode(page, THROWS_ON_LINE_4);
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator(errorMark)).toBeVisible();

  // The player's first move on seeing the mark is to edit the line under it,
  // and a mark left there would sit beneath their correction.
  await editor(page).click();
  await page.keyboard.type("x");

  await expect(page.locator(errorMark)).toHaveCount(0);
});

test("underlines nothing when the program never compiled", async ({ page }) => {
  // A syntax error has no position in a V8 stack — the code never ran, so there
  // is no frame describing it. The banner still has to say what is wrong.
  //
  // A guard rather than a live check, and measured as one: breaking the editor
  // so that a failed compilation is remembered as the running program leaves
  // this passing, because there is still no position to be found. What it holds
  // is that a future attempt to point at a syntax error has to be deliberate.
  await seedCode(page, "{ init: function () { , }, update: function () {} }");

  await page.goto("/");

  await expect(page.getByText(errorBanner)).toBeVisible();
  await expect(page.locator(errorMark)).toHaveCount(0);
});
