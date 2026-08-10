/**
 * The editor: does a program the player typed survive a reload, and does a
 * broken one say so instead of failing silently?
 */

import { expect, test } from "@playwright/test";

import { building, editor, seedCode, storedCode } from "./game-page.ts";

/** A short, valid program with something distinctive to look for. */
const PROGRAM = `{
    init: function (elevators, floors) {
        // e2e-marker-a7f3
        elevators[0].on("idle", function () {
            elevators[0].goToFloor(0);
        });
    },
    update: function (dt, elevators, floors) {}
}`;

/** The banner the game raises when the player's program misbehaves. */
const errorBanner = "There is a problem with your code";

test("keeps the player's program across a reload", async ({ page }) => {
  await page.goto("/");

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  // Inserted rather than typed: CodeMirror closes brackets and quotes as you
  // type them, so keystroke-by-keystroke entry would not necessarily leave the
  // document holding what this test thinks it typed.
  await page.keyboard.insertText(PROGRAM);
  await expect(editor(page)).toContainText("e2e-marker-a7f3");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Code saved /)).toBeVisible();

  // The key is `elevatorCrushCode_v5`, unchanged from the legacy game so that
  // anyone with a program saved in the original still finds it here. Asserted
  // exactly, not merely "something was stored".
  expect(await storedCode(page)).toBe(PROGRAM);

  await page.reload();

  await expect(editor(page)).toContainText("e2e-marker-a7f3");
  expect(await storedCode(page)).toBe(PROGRAM);
  await expect(page.getByText(errorBanner)).toBeHidden();
});

test("surfaces a program that will not compile", async ({ page }) => {
  await seedCode(page, "{ init: function () { this is not javascript }, update: function () {} }");

  await page.goto("/");

  const banner = page.getByText(errorBanner);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("SyntaxError");

  // The page is still a game: the legacy version handed `null` to the world
  // controller here and died on the first frame with a TypeError instead.
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();
});

test("surfaces a program that throws once the simulation is running", async ({ page }) => {
  await seedCode(
    page,
    '{ init: function () { throw new Error("e2e boom"); }, update: function () {} }',
  );

  await page.goto("/");

  // It compiles, so nothing is wrong until it runs.
  await expect(page.getByText(errorBanner)).toBeHidden();

  await page.getByRole("button", { name: "Start" }).click();

  const banner = page.getByText(errorBanner);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("e2e boom");
  // Paused, not dead: the button is offering to start again.
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
});
