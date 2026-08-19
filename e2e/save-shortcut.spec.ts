/**
 * <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> in the editor (upstream #68).
 *
 * The README credits this fork with answering that issue — the editor takes the
 * binding, keeps the browser's own save dialog out of the way, and writes to
 * storage there and then rather than waiting out the autosave. Nothing tested
 * any of it. It cannot be tested anywhere but here either: the binding is a
 * CodeMirror keymap entry with `preventDefault`, and whether a key press was
 * suppressed is a fact about a real browser's event, not about the editor's
 * own state.
 *
 * `AUTOSAVE_DELAY_MS` in `src/ui/editor.ts` is 1000, and the point of the
 * shortcut is not to wait for it, so both tests below read storage immediately
 * rather than letting an assertion poll: polling for a second would be
 * satisfied by the autosave and would prove nothing about the key.
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

  // The control half of the measurement, and what makes the assertion after the
  // key press mean anything: typing schedules an autosave a second out, so
  // nothing has been written yet — on a page visited for the first time, not
  // even the starting program, so this reads `null`. If it ever stops being
  // true, the assertion below has quietly stopped being about the shortcut.
  expect((await storedCode(page)) ?? "").not.toContain("e2e-save-shortcut-9c21");

  await page.keyboard.press("ControlOrMeta+s");

  expect(await storedCode(page)).toBe(PROGRAM);
});

test("keeps the browser's own save dialog out of it", async ({ page }) => {
  await page.goto("/");
  await editor(page).click();

  // Asked of the browser rather than of the editor. A page cannot see its own
  // chrome, but it can see whether the event that would have opened it was
  // suppressed, and that is the same fact: an unsuppressed Ctrl/Cmd+S is what
  // makes a browser offer to save the HTML of the page.
  //
  // Which half of the keymap entry does the suppressing is deliberately not
  // asserted, because the editor has two and either one is enough. Measured
  // against this test: dropping `preventDefault: true` while `run` still
  // returns true changes nothing here, and neither does having `run` return
  // false while `preventDefault: true` stays. CodeMirror suppresses the default
  // whenever a binding's command returns true, and `preventDefault` is the
  // option for the case where it returns false -- its own documentation says as
  // much. Removing both at once is what fails this test, and that is the fact a
  // player is affected by.
  await page.evaluate(() => {
    // Nothing to reset first: each test gets its own page, so the property is
    // absent until the listener below sets it, and `undefined` afterwards would
    // mean the event never arrived at all.
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
          (window as unknown as { savePrevented?: boolean }).savePrevented = event.defaultPrevented;
        }
      },
      // The last listener to see the event, after CodeMirror's own handler has
      // had it: `defaultPrevented` is only true once something has called
      // `preventDefault`, so reading it on the way down would answer `false`
      // however well the binding works.
      false,
    );
  });

  await page.keyboard.press("ControlOrMeta+s");

  const prevented = await page.evaluate(
    () => (window as unknown as { savePrevented?: boolean }).savePrevented,
  );
  expect(prevented).toBe(true);
});
