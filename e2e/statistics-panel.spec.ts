/**
 * The statistics panel is drawn whole, whatever building it stands beside.
 *
 * The panel is positioned out of the flow inside `.worldtrack`, which clips
 * what it holds and takes its height from the building; so in a short building
 * the tiles below the roof were simply cut off, and nothing in the markup or in
 * the panel's own rules objected. That makes it a browser question rather than
 * a stylesheet one -- the arithmetic is checked in `src/styles/style.test.ts`,
 * and what is checked here is the result of laying it out.
 *
 * Two buildings, and neither of them is whole without the fix -- both well
 * short of the panel's own worst case, `--stats-block-size`, sized to the
 * "Все показатели" disclosure held open so all thirteen tiles are on screen,
 * not only the four `.tiles-primary` leads with. Neither building's floors
 * are a fixed height any more: `widgets/building-stage`'s own
 * `layoutBuilding()` sizes them to whatever room the stage gives it, floored
 * at `Math.max(160, stageHeight - 38)` so a short building is never drawn
 * smaller than 160px regardless of the stage around it -- which the
 * two-floor learning task and the three-floor challenge both land on
 * exactly, `SHORTEST_BUILDING_HEIGHT` below.
 *
 * What either case can detect is one failure: `.worldtrack` carries
 * `min-block-size: var(--stats-block-size)`, so the clip these tiles are
 * measured against is held at the panel's own height whatever the building
 * does. Widen the panel -- another secondary tile, or a taller one -- and the
 * clip grows with it, because both read the same token; what would fail here
 * is that wiring going away, not the token's own value.
 *
 * Nothing taller is measured because there is nothing there to measure: the
 * tallest shipped challenge is 21 floors, and `layoutBuilding()` never
 * compresses a floor below its own `MIN_FLOOR`, 48px, so even fully
 * compressed that building is at least 1008px -- comfortably over twice the
 * panel -- and the sandbox will build 60 floors if asked.
 */

import { expect, test } from "@playwright/test";

import { building } from "./game-page.ts";

/**
 * The shortest a building's total height can be, whatever the stage around it
 * measures: `layoutBuilding()`'s own floor on the room it distributes floor
 * height from (module doc comment, above). Both buildings below land on it
 * exactly, at two floors and at three.
 */
const SHORTEST_BUILDING_HEIGHT = 160;

/** The shortest buildings the game draws. */
const SHORT_BUILDINGS = [
  { name: "a two-floor learning task", hash: "#challenge=tutorial-1" },
  { name: "a three-floor challenge", hash: "#challenge=1" },
] as const;

for (const { name, hash } of SHORT_BUILDINGS) {
  test(`shows every statistic beside ${name}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    // A car, and not one of the tiles this test is about: the cars are drawn
    // by the presenter that sizes the building, in the same pass that draws
    // the panel, so waiting for one lets the measurement below read a
    // building the presenter has already sized rather than one it has not
    // gotten to yet. That is a flaky failure rather than a false pass -- the
    // height assertion further down would catch it -- but a test that fails
    // for a reason it is not about is worth not writing.
    await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();

    // Closed by default, so the nine secondary tiles -- everything past
    // "Avg wait time", "Max wait time", "Avg load" and "Rate" -- are not in
    // the layout at all until this opens it.
    await page.locator(".statspanel .more > summary").click();
    await expect(page.locator(".tiles-secondary .tile").first()).toBeVisible();

    const measured = await page.evaluate(() => {
      const track = document.querySelector(".worldtrack");
      const building = document.querySelector(".innerworld");
      if (track === null || building === null) {
        throw new Error("The page has no building to measure the panel against");
      }
      const clip = track.getBoundingClientRect();
      return {
        buildingHeight: Math.round(building.getBoundingClientRect().height),
        tiles: [...document.querySelectorAll(".statspanel .tile")].map((tile) => ({
          label: (tile.querySelector(".cap")?.textContent ?? "").trim(),
          // How far the tile's last pixel falls short of the clip's, so that
          // a failure names the tiles that were cut and by how much rather
          // than only reporting that a count came out wrong.
          room: Math.round(clip.bottom - tile.getBoundingClientRect().bottom),
        })),
      };
    });

    // The building really is the short one this case is about, so a fix that
    // quietly made every building taller would otherwise pass.
    expect(measured.buildingHeight).toBe(SHORTEST_BUILDING_HEIGHT);
    // That there are tiles at all, so an empty panel cannot satisfy the line
    // below. How many there should be is a fact about `widgets/stats-panel`'s
    // own `TILES` array, not about what a browser did with it, so it is not
    // repeated here.
    expect(measured.tiles.length).toBeGreaterThan(0);
    expect(measured.tiles.filter((tile) => tile.room < 0)).toEqual([]);
  });
}
