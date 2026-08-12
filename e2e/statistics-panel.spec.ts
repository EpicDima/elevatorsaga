/**
 * The statistics panel is drawn whole, whatever building it stands beside.
 *
 * The panel is positioned out of the flow inside `.worldtrack`, which clips
 * what it holds and takes its height from the building; so in a short building
 * the rows below the roof were simply cut off, and nothing in the markup or in
 * the panel's own rules objected. That makes it a browser question rather than
 * a stylesheet one -- the arithmetic is checked in `src/styles/style.test.ts`,
 * and what is checked here is the result of laying it out.
 *
 * Two buildings, because they were cut off by different amounts: the learning
 * track's two-floor rooms lost the last three rows, and a three-floor challenge
 * had lost the eighth until the row pitch came down. The tallest building in
 * the game is not measured -- it has 500px of slack and would pass a panel
 * twice this size.
 */

import { expect, test } from "@playwright/test";

/** The shortest buildings the game draws, and how tall each one is. */
const SHORT_BUILDINGS = [
  { name: "a two-floor learning task", hash: "#challenge=tutorial-1", floors: 2 },
  { name: "a three-floor challenge", hash: "#challenge=1", floors: 3 },
] as const;

for (const { name, hash, floors } of SHORT_BUILDINGS) {
  test(`shows every statistic beside ${name}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await expect(page.locator(".statscontainer .stat").first()).toBeVisible();

    const measured = await page.evaluate(() => {
      const track = document.querySelector(".worldtrack");
      const building = document.querySelector(".innerworld");
      if (track === null || building === null) {
        throw new Error("The page has no building to measure the panel against");
      }
      const clip = track.getBoundingClientRect();
      return {
        buildingHeight: Math.round(building.getBoundingClientRect().height),
        rows: [...document.querySelectorAll(".statscontainer .stat")].map((row) => ({
          label: (row.querySelector(".key")?.textContent ?? "").trim(),
          // How far the row's last pixel falls short of the clip's, so that a
          // failure names the rows that were cut and by how much rather than
          // only reporting that a count came out wrong.
          room: Math.round(clip.bottom - row.getBoundingClientRect().bottom),
        })),
      };
    });

    // The building really is the short one this case is about: a floor is 50px,
    // and a fix that quietly made every building taller would otherwise pass.
    expect(measured.buildingHeight).toBe(floors * 50);
    // That there are rows at all, so an empty panel cannot satisfy the line
    // below. How many there should be is pinned against `index.html` in
    // `src/styles/style.test.ts`, which is where the count is a fact about the
    // markup rather than about what a browser did with it.
    expect(measured.rows.length).toBeGreaterThan(0);
    expect(measured.rows.filter((row) => row.room < 0)).toEqual([]);
  });
}
