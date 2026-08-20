/**
 * The way past the building (WCAG 2.4.1).
 *
 * The editor is what the page is for, and it is behind everything the building
 * contains: the scroll container, and a button for every call and every floor.
 * On the eighteenth level that is 255 tab stops past the link, 208 of them
 * buttons. The count is measured here rather than asserted from the markup
 * because most of those stops are drawn by the presenters at run time and do
 * not exist in `index.html` at all.
 */

import { expect, test } from "@playwright/test";

import { editor, unlockLevel } from "./game-page.ts";

/** The busiest level: 8 elevators, 21 floors, and a call button per direction. */
const BUSIEST = "#level=18";

/** Which level {@link BUSIEST} names, for the browser that has to have earned it. */
const BUSIEST_NUMBER = 18;

test("reaches the editor in one tab stop, from the busiest level", async ({ page }) => {
  await unlockLevel(page, BUSIEST_NUMBER);
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
  await unlockLevel(page, BUSIEST_NUMBER);
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
  // to say about it. 208 of the 255 are buttons -- eight cars of 21 floors,
  // plus a call each way at every floor except the roof, which has no way up,
  // and the lobby, which has no way down -- and the other 47 are the rest of
  // the chrome above the building, the building's own scroll container, each
  // floor's own row and each car's own container, the statistics panel's
  // summary and the splitter below the building, and the code slot switcher.
  // Adding a level link, or anything else above the building, moves this
  // by one, and then the number has to be looked at rather than guessed at.
  // It was 240 until the run controls gained "Start over" and "Reset code",
  // two more stops above the building, 242 until the same row gained "Run
  // instantly", a third, and 246 once the code slot switcher's own three
  // buttons landed between the building and the editor. It was 249 once the
  // app bar's two openers (Help, Settings) sat above the building and the
  // workspace's own splitter -- a third pane control, resizable the same way
  // the editor's height grip is -- sat below it, between the building and the
  // code slot switcher. It was 263 once widgets/level-switcher's three
  // controls (Previous level, the switcher itself, Next level) and
  // widgets/goal-bar's tier popover trigger stood where the old level
  // bar's plain heading used to, four more stops above the building, and
  // widgets/stats-panel's "All figures" summary sat between the building and
  // the splitter, a fifth -- and Reset code moved out of the run controls row
  // and into widgets/editor-pane, landing after the code slot switcher
  // instead of beside Start over, which added nothing and only moved a stop
  // within the count. It fell to 258 when the shipped header went: the
  // learning-track link, the three help links and the language `<select>`
  // were five stops between the skip link and the building, and the track is
  // reached from the level switcher and the language from the settings
  // popover, neither of which is a stop of its own.
  //
  // It rose to 259 when the building began scrolling inside its own `.stage`
  // rather than inside `.world`. A scroll container a keyboard cannot reach is
  // WCAG 2.1.1, so `widgets/building-stage` puts the stage in the tab order --
  // and only while there is something left to scroll to, which on a twenty-one
  // floor building there always is. `.world` keeps the `tabindex` it was given
  // back when it was the scroller, which is `index.html`'s to take away; until
  // it does, this level has one stop that no longer moves anything.
  //
  // It fell to 258 when "Run instantly" became a stop of the speed control
  // rather than a button of its own: the last step past the fastest speed,
  // reached with the "Faster" arrow that was already a stop, so the row lost
  // one and gained none.
  //
  // And to 256 once `entities/floor` stopped drawing the call that could never
  // be made -- there is no way up from the roof and no way down from the
  // lobby, so those two lamps were two tab stops that led to a button which
  // could light but never mean anything. Two per building, whatever its
  // height, which is why this fell by exactly two and not by two per floor.
  //
  // And to 255 once the perpetual demo left the level list -- not because its
  // tile was a stop, since the switcher's popover is `hidden` while closed and
  // no tile in it is ever reached by tabbing, but because of what that tile
  // did to the "Next level" arrow. The demo sat last in the level block
  // and was the one tile there that never locked, so from any level at all
  // there was somewhere forward to step to and the arrow was enabled. The
  // eighteenth is now second-to-last with the nineteenth locked behind it,
  // nothing further on is open, and `presentLevelSwitcher` disables an arrow
  // with nowhere to go -- which takes it out of the tab order.
  expect(stops).toBe(255);
});
