/**
 * The way past the building (WCAG 2.4.1).
 *
 * The editor is what the page is for, and it is behind everything the building
 * contains: the scroll container, and a button for every call and every floor.
 * On the eighteenth level that is 259 tab stops past the link, 208 of them
 * buttons. The count is measured here rather than asserted from the markup
 * because most of those stops are drawn by the presenters at run time and do
 * not exist in `index.html` at all.
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

  // And it can be seen while it has the focus, which is the other half of it:
  // a sighted keyboard user has to be able to tell where they are.
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeFocused();

  // The hash belongs to the router, not to the fragment: following the link as
  // a link would drop `level=18` and restart the player on the first one.
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

  // Exact, because a range records nothing: this file's own header once
  // claimed 208 while the walk was 240, and bounds of 100 and 400 had nothing
  // to say about it.
  //
  // 208 of the 259 are buttons -- eight cars of 21 floors, plus a call each
  // way at every floor except the roof, which has no way up, and the lobby,
  // which has no way down. The other 51 are the chrome above the building, the
  // stage the building scrolls inside, each floor's own row and each car's own
  // container, the statistics panel's summary and the four figures on show
  // beside it, the splitter below the building, and the code slot switcher.
  //
  // Four figures and not thirteen: the other nine are inside a closed
  // `<details>`, which a browser skips whole.
  //
  // Adding a control anywhere between the link and the editor moves this by
  // one, and then the new number has to be measured rather than guessed at.
  expect(stops).toBe(259);
});
