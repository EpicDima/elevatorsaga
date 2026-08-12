/**
 * The editor: does a program the player typed survive a reload, does a pasted
 * one arrive unaltered, does a broken one say so instead of failing silently,
 * and does the Expand button make it bigger and keep it that way?
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

/**
 * A program indented two spaces to the level, as a player who copied it from
 * somewhere else may well have it.
 *
 * The editor indents by four, so every indented line here is a line the
 * editor's own indenter would have written differently — which is the point.
 * Text the indenter happens to agree with could not tell "left alone" and
 * "reindented" apart.
 */
const PASTED_PROGRAM = `{
  init: function (elevators, floors) {
    // e2e-paste-marker-4b2e
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

test("pastes code without reindenting it", async ({ page, context }) => {
  // magwo/elevatorsaga#119. The legacy editor hooked CodeMirror 5's paste and
  // ran the "smart" indenter over every line that arrived, so pasting a snippet
  // reformatted it; CodeMirror 6 is configured to leave pasted text alone.
  //
  // This has to be a real paste — clipboard, then the paste shortcut — because
  // the reindenting lived in the editor's paste handling. The `insertText` the
  // reload test above uses never goes near it, so it could not tell the two
  // behaviours apart.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");

  // Clicked first because writing to the clipboard needs the page focused.
  await editor(page).click();
  await page.evaluate((code) => navigator.clipboard.writeText(code), PASTED_PROGRAM);

  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(editor(page)).toContainText("e2e-paste-marker-4b2e");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Code saved /)).toBeVisible();

  // Character for character, whitespace included. Read back out of storage
  // rather than off the screen so that the comparison is against the document
  // the editor actually holds, not against rendered text.
  expect(await storedCode(page)).toBe(PASTED_PROGRAM);
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

test("grows the editor on request, and is still that size next visit", async ({ page }) => {
  // magwo/elevatorsaga#104, asked for in 2016: "the coding area is too small for
  // editing after a few levels". The height is a stylesheet token behind an
  // attribute on `<html>`; this is the only place the whole path from the button
  // to a box on screen is exercised, so it measures pixels rather than trusting
  // the attribute. See `src/ui/editor-size.ts`.
  await page.goto("/");

  const box = page.locator(".cm-editor");
  const expand = page.getByRole("button", { name: "Expand" });
  const heightOf = async (): Promise<number> => (await box.boundingBox())?.height ?? 0;

  // Exactly `--editor-height`, borders and all. This stylesheet leaves
  // `box-sizing` at `content-box`, which would have put the 1px borders outside
  // the 320px, but CodeMirror's own base theme sets `border-box` on the element
  // it mounts as -- measured here rather than reasoned about for that reason.
  const shipped = await heightOf();
  expect(shipped).toBeCloseTo(320, 0);
  await expect(expand).toHaveAttribute("aria-pressed", "false");

  await expand.click();

  // 70vh of Playwright's 720px window, so a little over 500. Asserted as "much
  // bigger" rather than exactly, because the number is a design decision and
  // this test is about whether pressing the button reaches the screen at all.
  await expect.poll(heightOf).toBeGreaterThan(shipped + 100);
  await expect(expand).toHaveAttribute("aria-pressed", "true");

  // The editor still works at the new size. CodeMirror is not told about it --
  // it has a `ResizeObserver` on its own scroller -- and this is what would
  // catch that changing: a view that had not remeasured puts the text it draws
  // somewhere other than where the caret went.
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(PROGRAM);
  await expect(editor(page)).toContainText("e2e-marker-a7f3");

  await page.reload();

  // No click this time: the size is read back before the first frame, so the
  // page comes up tall instead of growing into it.
  await expect.poll(heightOf).toBeGreaterThan(shipped + 100);
  await expect(expand).toHaveAttribute("aria-pressed", "true");

  await expand.click();

  await expect.poll(heightOf).toBeCloseTo(shipped, 0);
  await expect(expand).toHaveAttribute("aria-pressed", "false");
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
