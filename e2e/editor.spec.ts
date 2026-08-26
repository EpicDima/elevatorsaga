/**
 * The editor: does a program the player typed survive a reload, does a pasted
 * one arrive unaltered, does a broken one say so instead of failing silently,
 * and is the program that runs the one on screen?
 */

import { expect, test } from "@playwright/test";

import {
  building,
  editor,
  languagePicker,
  seedCode,
  seedLessonCode,
  seedLevelCode,
  startButton,
  storedCode,
} from "./game-page.ts";

/** A short, valid program with something distinctive to look for. */
const PROGRAM = `function init(elevators, floors) {
    // e2e-marker-a7f3
    elevators[0].on("idle", function () {
        elevators[0].goToFloor(0);
    });
}

function update(dt, elevators, floors) {}`;

/**
 * Indented two spaces, while the editor itself indents by four - every
 * indented line here is one the editor's indenter would write differently,
 * which is the point: text it happens to agree with can't prove anything.
 */
const PASTED_PROGRAM = `function init(elevators, floors) {
  // e2e-paste-marker-4b2e
  elevators[0].on("idle", function () {
    elevators[0].goToFloor(0);
  });
}

function update(dt, elevators, floors) {}`;

/** The banner the game raises when the player's program misbehaves. */
const errorBanner = "There is an error in your program";

test("keeps the player's program across a reload", async ({ page }) => {
  await page.goto("/");

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  // Inserted, not typed: CodeMirror auto-closes brackets and quotes as you
  // type, so keystroke entry wouldn't necessarily leave this exact text.
  await page.keyboard.insertText(PROGRAM);
  await expect(editor(page)).toContainText("e2e-marker-a7f3");

  // The editor autosaves, so there's no Save button left; this is the only explicit save.
  await page.keyboard.press("ControlOrMeta+s");

  // Polled, not read once: there's no status line, so storage itself is what
  // confirms the write landed.
  await expect.poll(() => storedCode(page)).toBe(PROGRAM);

  await page.reload();

  await expect(editor(page)).toContainText("e2e-marker-a7f3");
  expect(await storedCode(page)).toBe(PROGRAM);
  await expect(page.getByText(errorBanner)).toBeHidden();
});

test("pastes code without reindenting it", async ({ page, context }) => {
  // Must be a real clipboard paste: reindenting bugs live in paste handling,
  // and `insertText` (used above) never goes near it.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");

  // Clicked first because writing to the clipboard needs the page focused.
  await editor(page).click();
  await page.evaluate((code) => navigator.clipboard.writeText(code), PASTED_PROGRAM);

  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(editor(page)).toContainText("e2e-paste-marker-4b2e");

  await page.keyboard.press("ControlOrMeta+s");

  // Read from storage, not the screen, so it's the document the editor holds, not rendered text.
  await expect.poll(() => storedCode(page)).toBe(PASTED_PROGRAM);
});

test("surfaces a program that will not compile", async ({ page }) => {
  await seedCode(page, "function init() { this is not javascript }");

  await page.goto("/");

  // `.errorline`, not `getByText`: the label and message are separate elements now.
  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(errorBanner);
  await expect(banner).toContainText("SyntaxError");

  await expect(startButton(page)).toBeVisible();
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
});

test("starts the code slot that is open, not the one the level opened on", async ({ page }) => {
  // The second slot's program announces itself by throwing, the only way from
  // out here to tell which of the two the building is actually running.
  await seedLevelCode(page, 1, "function init() {}", 1);
  await seedLevelCode(page, 1, 'function init() { throw new Error("e2e slot two"); }', 2);

  await page.goto("/");
  await expect(page.getByText(errorBanner)).toBeHidden();

  await page.getByRole("button", { name: "Code 2" }).click();
  await expect(editor(page)).toContainText("e2e slot two");

  await startButton(page).click();

  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("e2e slot two");
});

test("switches code slots on a lesson as well as on a numbered level", async ({ page }) => {
  await seedLessonCode(page, "tutorial-1", "// e2e lesson slot one", 1);
  await seedLessonCode(page, "tutorial-1", "// e2e lesson slot two", 2);

  await page.goto("/#level=tutorial-1");
  await expect(editor(page)).toContainText("e2e lesson slot one");

  await page.getByRole("button", { name: "Code 2" }).click();
  await expect(editor(page)).toContainText("e2e lesson slot two");

  await page.getByRole("button", { name: "Code 1" }).click();
  await expect(editor(page)).toContainText("e2e lesson slot one");
});

test("surfaces a program that throws once the simulation is running", async ({ page }) => {
  await seedCode(page, 'function init() { throw new Error("e2e boom"); }');

  await page.goto("/");

  await expect(page.getByText(errorBanner)).toBeHidden();

  await startButton(page).click();

  const banner = page.locator(".errorline");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(errorBanner);
  await expect(banner).toContainText("e2e boom");
  // Paused, not dead: the button offers to start again.
  await expect(startButton(page)).toBeVisible();
});

test("gives the player search and folding, not just a text box", async ({ page }) => {
  // The extension list is written by hand, not taken from CodeMirror's full
  // bundle, so dropping a line from it fails silently; neither of these is
  // reachable from a unit test, since jsdom draws no panel to check.
  await page.goto("/");
  await expect(page.locator(".cm-foldGutter")).toBeVisible();

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+f");

  await expect(page.locator(".cm-search input[name='search']")).toBeVisible();
});

test("draws CodeMirror's own panels in the language the page is in", async ({ page }) => {
  // The panel is markup CodeMirror writes, out of reach of the redraw the rest of the page gets,
  // and jsdom draws none of it - so this is the only place the translation can be checked at all.
  await page.goto("/#lang=ru");

  await editor(page, "Программа для лифтов").click();
  await page.keyboard.press("ControlOrMeta+f");

  const search = page.locator(".cm-search");
  await expect(search.locator("input[name='search']")).toHaveAttribute("placeholder", "Найти");
  await expect(search.getByRole("button", { name: "заменить все" })).toBeVisible();
  await expect(search).not.toContainText("match case");
});

test("redraws those panels when the language changes under an open editor", async ({ page }) => {
  // The player's own program, not the starter one: translating a starter program replaces the
  // whole document, which closes the panel before anything can be said about its labels.
  await page.goto("/");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(PROGRAM);
  await page.keyboard.press("ControlOrMeta+f");
  const searchField = page.locator(".cm-search input[name='search']");
  // Typed key by key, not filled: the field commits its query on `keyup`, which `fill` never fires.
  await searchField.pressSequentially("goToFloor");
  await expect(searchField).toHaveAttribute("placeholder", "Find");

  await (await languagePicker(page)).selectOption("ru");

  // Rebuilt, since the panel writes its labels once; the query it was carrying is put back.
  await expect(searchField).toHaveAttribute("placeholder", "Найти");
  await expect(searchField).toHaveValue("goToFloor");
  await expect(editor(page, "Программа для лифтов")).toContainText("e2e-marker-a7f3");
});
