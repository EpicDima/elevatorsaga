/**
 * The editor: does a program the player typed survive a reload, does a pasted
 * one arrive unaltered, does a broken one say so instead of failing silently,
 * and is the program that runs the one on screen?
 */

import { expect, test } from "@playwright/test";

import { building, editor, seedCode, seedLevelCode, startButton, storedCode } from "./game-page.ts";

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
const errorBanner = "There is an error in your program";

test("keeps the player's program across a reload", async ({ page }) => {
  await page.goto("/");

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  // Inserted rather than typed: CodeMirror closes brackets and quotes as you
  // type them, so keystroke-by-keystroke entry would not necessarily leave the
  // document holding what this test thinks it typed.
  await page.keyboard.insertText(PROGRAM);
  await expect(editor(page)).toContainText("e2e-marker-a7f3");

  // Ctrl+S rather than a button: the editor autosaves a second after the last
  // keystroke, so the Save button is gone and this shortcut -- which also stops
  // the browser offering to save the page -- is the only explicit save left.
  await page.keyboard.press("ControlOrMeta+s");

  // The key is level 1's first slot, the buffer the default route opens.
  // Asserted exactly, not merely "something was stored". Polled rather than
  // read once: nothing on screen confirms a save any more -- the mockup draws
  // no status line under the editor and the confirmation went with it -- so
  // storage itself is what says the write landed.
  await expect.poll(() => storedCode(page)).toBe(PROGRAM);

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

  await page.keyboard.press("ControlOrMeta+s");

  // Character for character, whitespace included. Read back out of storage
  // rather than off the screen so that the comparison is against the document
  // the editor actually holds, not against rendered text.
  await expect.poll(() => storedCode(page)).toBe(PASTED_PROGRAM);
});

test("surfaces a program that will not compile", async ({ page }) => {
  await seedCode(page, "{ init: function () { this is not javascript }, update: function () {} }");

  await page.goto("/");

  // `.errorline` rather than `getByText(errorBanner)`: the label and the
  // program's own message are two separate elements now (`.errorline-label`
  // and `.errormessage`), so a text-content locator resolves to the label
  // alone and never sees the message beside it.
  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(errorBanner);
  await expect(banner).toContainText("SyntaxError");

  // The page is still a game: the legacy version handed `null` to the world
  // controller here and died on the first frame with a TypeError instead.
  await expect(startButton(page)).toBeVisible();
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();
});

test("starts the code slot that is open, not the one the level opened on", async ({ page }) => {
  // Reported as "I choose another code slot, press run, and it runs the first
  // slot's program". It did: the editor is compiled as the world is built, and
  // the controller holds that program for the whole run, so everything the
  // player did to the editor before pressing Start — switching slots, or just
  // typing — went unread. Start begins a run that has not begun yet, and a run
  // begins from the program on screen.
  //
  // The second slot's program announces itself by throwing, which is the only
  // way from out here to tell which of the two the building is running: both
  // compile, and an elevator standing still looks the same either way.
  await seedLevelCode(page, 1, "{ init: function () {}, update: function () {} }", 1);
  await seedLevelCode(
    page,
    1,
    '{ init: function () { throw new Error("e2e slot two"); }, update: function () {} }',
    2,
  );

  await page.goto("/");
  await expect(page.getByText(errorBanner)).toBeHidden();

  await page.getByRole("button", { name: "Code 2" }).click();
  await expect(editor(page)).toContainText("e2e slot two");

  await startButton(page).click();

  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("e2e slot two");
});

test("surfaces a program that throws once the simulation is running", async ({ page }) => {
  await seedCode(
    page,
    '{ init: function () { throw new Error("e2e boom"); }, update: function () {} }',
  );

  await page.goto("/");

  // It compiles, so nothing is wrong until it runs.
  await expect(page.getByText(errorBanner)).toBeHidden();

  await startButton(page).click();

  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(errorBanner);
  await expect(banner).toContainText("e2e boom");
  // Paused, not dead: the button is offering to start again.
  await expect(startButton(page)).toBeVisible();
});
