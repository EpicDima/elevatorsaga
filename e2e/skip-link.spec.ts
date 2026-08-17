/**
 * The way past the building (WCAG 2.4.1).
 *
 * The editor is what the page is for, and it is behind everything the building
 * contains: the scroll container, and a button for every call and every floor.
 * On the eighteenth challenge that is 246 tab stops past the link, 208 of them
 * buttons. The count is measured here rather than asserted from the markup
 * because most of those stops are drawn by the presenters at run time and do
 * not exist in `index.html` at all.
 */

import { expect, test } from "@playwright/test";

import { editor } from "./game-page.ts";

/** The busiest challenge: 8 elevators, 21 floors, and a call button per floor. */
const BUSIEST = "#challenge=18";

test("reaches the editor in one tab stop, from the busiest challenge", async ({ page }) => {
  await page.goto(`/${BUSIEST}`);
  await expect(editor(page)).toBeVisible();

  // Nothing focused yet, so this is the first stop on the page.
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to the code editor" });
  await expect(skipLink).toBeFocused();

  // And it can be seen while it has the focus, which is the other half of it:
  // a sighted keyboard user has to be able to tell where they are.
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeFocused();

  // The hash belongs to the router, not to the fragment: following the link as
  // a link would drop `challenge=18` and restart the player on the first one.
  expect(new URL(page.url()).hash).toBe(BUSIEST);
});

test("saves a walk through the whole building", async ({ page }) => {
  await page.goto(`/${BUSIEST}`);
  await expect(editor(page)).toBeVisible();

  // What the link costs, counted the long way: past it, and then one stop at a
  // time until the editor has the focus. This is the number the link exists to
  // replace, and it is here so that a change which quietly re-orders the page
  // has to come and change it.
  await page.keyboard.press("Tab");
  let stops = 0;
  const editorHasFocus = (): Promise<boolean> =>
    editor(page).evaluate((node) => node === document.activeElement);
  while (stops < 400 && !(await editorHasFocus())) {
    await page.keyboard.press("Tab");
    stops += 1;
  }

  // Exact, because a range records nothing: this file's own header claimed 208
  // while the walk was 240, and bounds of 100 and 400 had nothing to say about
  // it. 208 of the 246 are buttons -- eight cars of 21 floors, plus a call each
  // way -- and the other 38 are the rest of the chrome above the building, the
  // building's own scroll container, the code slot switcher below it, and the
  // press that lands on the editor. Adding a challenge link, or anything else
  // above the building, moves this by one, and then the number has to be
  // looked at rather than guessed at. It was 240 until the run controls
  // gained "Start over" and "Reset code", two more stops above the building,
  // 242 until the same row gained "Run instantly", a third, and 246 once the
  // code slot switcher's own three buttons landed between the building and
  // the editor.
  expect(stops).toBe(246);
});
