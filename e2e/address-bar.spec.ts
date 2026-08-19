/**
 * The address bar as the router leaves it.
 *
 * `src/app/router.test.ts` proves the correction against a stand-in whose
 * `replaceState` this repository wrote. What it cannot prove is the part that
 * belongs to the browser: what a real `history.replaceState` does to
 * `location.hash`, and what the Back button does afterwards. Both are the whole
 * reason the correction is a replacement and not a navigation.
 */

import { expect, test } from "@playwright/test";

/**
 * The seed shown in the challenge bar while following it still pins the run.
 *
 * Scoped to `.challengeseed` rather than bare `.seedlink`: the settings
 * popover's own seed block, behind its still-closed `.setmenu`, reuses the
 * same class -- see its own module comment -- so the bare class now resolves
 * two elements.
 */
const SEED_LINK = ".challengeseed .seedlink";

/** The heading the challenge bar prints, which says which run is being played. */
const CHALLENGE_TITLE = ".challengetitle";

test("takes a parameter the game refused out of the address bar", async ({ page }) => {
  // The URL said `seed=rush hour` while the game drew somebody else, because a
  // browser writes the space as %20 and a percent sign is not a seed. A URL
  // that names a run nobody is playing is the one a player bookmarks and
  // shares.
  await page.goto("/#challenge=4,seed=rush hour");

  await expect(page).toHaveURL(/#challenge=4$/);
  // Still the run that was asked for, minus the part that could not be had.
  await expect(page.locator(CHALLENGE_TITLE)).toContainText("Challenge #4");
  await expect(page.locator(SEED_LINK)).toBeVisible();
});

test("empties a hash whose every parameter was refused", async ({ page }) => {
  await page.goto("/#challenge=abc");

  await expect(page.locator(CHALLENGE_TITLE)).toContainText("Challenge #1");
  // Asserted on location.hash rather than on the whole URL: "#" resolves to a
  // URL whose fragment is empty, which still serialises with the "#" on the end
  // and is what page.url() would show.
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});

test("does not leave the refused url behind the Back button", async ({ page }) => {
  // The reason the correction is `replaceState`. Written as a navigation it
  // would push an entry, so Back would land on the URL that was just refused,
  // be corrected again, and never get past it -- a page the player cannot leave
  // backwards.
  await page.goto("/#challenge=2");
  await expect(page.locator(CHALLENGE_TITLE)).toContainText("Challenge #2");

  await page.goto("/#challenge=abc");
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  await page.goBack();

  await expect(page).toHaveURL(/#challenge=2$/);
  await expect(page.locator(CHALLENGE_TITLE)).toContainText("Challenge #2");
});

test("keeps a value it only clamped, which still names the run on screen", async ({ page }) => {
  // `floors=100000` resolves to sixty floors every time it is read and the bar
  // prints sixty, so the URL and the building agree and there is nothing to
  // correct. Only a refusal leaves the two saying different things.
  await page.goto("/#challenge=sandbox,floors=100000");

  await expect(page).toHaveURL(/#challenge=sandbox,floors=100000$/);
  await expect(page.locator(CHALLENGE_TITLE)).toContainText("60");
});
