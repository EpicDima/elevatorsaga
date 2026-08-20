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

import { seedText, unlockLevel } from "./game-page.ts";

test("takes a parameter the game refused out of the address bar", async ({ page }) => {
  // The URL said `seed=rush hour` while the game drew somebody else, because a
  // browser writes the space as %20 and a percent sign is not a seed. A URL
  // that names a run nobody is playing is the one a player bookmarks and
  // shares.
  //
  // Earned first, because level 4 is one of the addresses a browser has to have
  // played its way to: without this the router would refuse the level as well,
  // and the test would be watching the wrong refusal.
  await unlockLevel(page, 4);

  await page.goto("/#level=4,seed=rush hour");

  await expect(page).toHaveURL(/#level=4$/);
  // Still the run that was asked for, minus the part that could not be had.
  await expect(page.getByRole("button", { name: "Level 4" })).toBeVisible();
  await expect(await seedText(page)).toBeVisible();
});

test("empties a hash whose every parameter was refused", async ({ page }) => {
  await page.goto("/#level=abc");

  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  // Asserted on location.hash rather than on the whole URL: "#" resolves to a
  // URL whose fragment is empty, which still serialises with the "#" on the end
  // and is what page.url() would show.
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});

test("sends a level this browser has not earned back to the one it has", async ({ page }) => {
  // The switcher has always drawn level 18 shut until 17 is cleared, and this
  // address used to open it regardless, which made the progression an opinion
  // the interface held rather than a rule of the game.
  //
  // The refusal cannot be a deletion the way `seed=rush hour` is above: a hash
  // with no `level` in it means level 1, not the furthest one reached. So
  // the key is rewritten to the level that opened instead, and the bar goes on
  // naming the game on screen.
  await unlockLevel(page, 4);

  await page.goto("/#level=18,timescale=8");

  await expect(page).toHaveURL(/#level=4,timescale=8$/);
  await expect(page.getByRole("button", { name: "Level 4" })).toBeVisible();
});

test("does not leave the refused url behind the Back button", async ({ page }) => {
  // The reason the correction is `replaceState`. Written as a navigation it
  // would push an entry, so Back would land on the URL that was just refused,
  // be corrected again, and never get past it -- a page the player cannot leave
  // backwards.
  await unlockLevel(page, 2);

  await page.goto("/#level=2");
  await expect(page.getByRole("button", { name: "Level 2" })).toBeVisible();

  await page.goto("/#level=abc");
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  await page.goBack();

  await expect(page).toHaveURL(/#level=2$/);
  await expect(page.getByRole("button", { name: "Level 2" })).toBeVisible();
});

test("opens a link written with the retired key, and re-spells it", async ({ page }) => {
  // Every link this game has ever shared says `challenge=`, and a bookmark is
  // not something a player can be asked to edit. The old spelling opens the run
  // it names, in a real browser and not only against a stand-in; what the bar
  // says afterwards is the spelling the game writes now, so the next thing
  // copied out of it is current.
  await unlockLevel(page, 4);
  // Somewhere for Back to lead, so the entry the legacy URL did or did not
  // leave behind is the only thing between here and there.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();

  await page.goto("/#challenge=4,timescale=8");

  await expect(page).toHaveURL(/#level=4,timescale=8$/);
  await expect(page.getByRole("button", { name: "Level 4" })).toBeVisible();

  // And the correction is a replacement, like every other: Back lands on the
  // page before it rather than on the legacy URL, to be corrected again.
  await page.goBack();
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
});

test("keeps a value it only clamped, which still names the run on screen", async ({ page }) => {
  // `floors=100000` resolves to sixty floors every time it is read and the bar
  // prints sixty, so the URL and the building agree and there is nothing to
  // correct. Only a refusal leaves the two saying different things.
  await page.goto("/#level=sandbox,floors=100000");

  await expect(page).toHaveURL(/#level=sandbox,floors=100000$/);
  // The sandbox has no requirement to state as a meter, so `widgets/goal-bar`
  // falls back to `.goalfree`'s own prose, the same as the old challenge bar's
  // heading did.
  await expect(page.locator(".goalfree")).toContainText("60");
});
