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
 * Two buildings, and only the first of them was ever cut: the learning track's
 * two-floor rooms are 100px, which took `Max delivery time`, `Moves` and
 * `Avg load` off the bottom of a 168px panel. That case is the guard. The
 * three-floor challenge is 150px, its bottom row ends 143px down, and it was
 * whole even before the fix -- so it is documentation, not a second guard, and
 * saying otherwise would be claiming a failure it cannot detect: `.worldtrack`
 * carries `min-block-size: var(--stats-block-size)`, so the clip these rows are
 * measured against is held at 168px whatever the building does, and the margin
 * the assertion below sees is 25px rather than the 7px the building has. Widen
 * the panel -- a ninth row, or a pitch back at the 20px it was drawn at until
 * `ea9b51c` -- and the floor rises with it, leaving `room` at `pitch + 9` for
 * every building. What would fail here is the `min-block-size` line going away.
 *
 * Nothing taller is measured because there is nothing there to measure: the
 * tallest shipped challenge is 21 floors, 1050px, six times the panel, and the
 * sandbox will build 60 floors if asked.
 */

import { expect, test } from "@playwright/test";

import { building } from "./game-page.ts";

/** The shortest buildings the game draws, and how tall each one is. */
const SHORT_BUILDINGS = [
  { name: "a two-floor learning task", hash: "#challenge=tutorial-1", floors: 2 },
  { name: "a three-floor challenge", hash: "#challenge=1", floors: 3 },
] as const;

for (const { name, hash, floors } of SHORT_BUILDINGS) {
  test(`shows every statistic beside ${name}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    // A car, and not one of the rows this test is about: the rows are written
    // into `index.html` and are on screen before any of our code has run, so
    // waiting for one would let the measurement below read a building the
    // presenter has not sized yet. That is a flaky failure rather than a false
    // pass -- the height assertion further down would catch it, and the clip
    // would measure 168px, not 0, thanks to that same `min-block-size` -- but
    // a test that fails for a reason it is not about is worth not writing. The
    // cars are drawn by the presenter that sizes the building, in the same pass.
    await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();

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
