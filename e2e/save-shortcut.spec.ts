/**
 * Ctrl/Cmd+S in the editor: takes the binding, keeps the browser's own save
 * dialog out of the way, and writes to storage immediately rather than
 * waiting out the autosave. Only testable here, since whether a key press was
 * suppressed is a fact about a real browser event. Both tests read storage
 * immediately rather than polling, since polling for a second would be
 * satisfied by the autosave and prove nothing about the key.
 */

import { expect, test } from "@playwright/test";

import { editor, storedCode } from "./game-page.ts";

/** A program with something in it no other test would leave behind. */
const PROGRAM = `{
    init: function (elevators, floors) {
        // e2e-save-shortcut-9c21
    },
    update: function (dt, elevators, floors) {}
}`;

test("writes the program to storage the moment the shortcut is pressed", async ({ page }) => {
  await page.goto("/");

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  // Inserted rather than typed, as the editor's other specs do: CodeMirror
  // closes brackets as they are typed.
  await page.keyboard.insertText(PROGRAM);
  await expect(editor(page)).toContainText("e2e-save-shortcut-9c21");

  // Confirms nothing's written yet, since typing only schedules an autosave a
  // second out; without this, the assertion below wouldn't prove the key did it.
  expect((await storedCode(page)) ?? "").not.toContain("e2e-save-shortcut-9c21");

  await page.keyboard.press("ControlOrMeta+s");

  expect(await storedCode(page)).toBe(PROGRAM);
});

test("keeps the browser's own save dialog out of it", async ({ page }) => {
  await page.goto("/");
  await editor(page).click();

  // A page can't see its own chrome, but it can see whether the event that
  // would have opened the save dialog was suppressed - the same fact. Either
  // half of the editor's keymap entry can do the suppressing; only losing both fails this.
  await page.evaluate(() => {
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
          (window as unknown as { savePrevented?: boolean }).savePrevented = event.defaultPrevented;
        }
      },
      // After CodeMirror's own handler, since defaultPrevented only flips once something calls it.
      false,
    );
  });

  await page.keyboard.press("ControlOrMeta+s");

  const prevented = await page.evaluate(
    () => (window as unknown as { savePrevented?: boolean }).savePrevented,
  );
  expect(prevented).toBe(true);
});
