/**
 * The statistics strip is drawn whole, whatever building stands above it.
 *
 * The figures are the last row of the game pane, below the building and the
 * full width of it. What decides whether every one of them is on screen is
 * which row of that column gives way when the pane is too short for all of
 * them, and the answer has to be the building: it is the only box in the column
 * with somewhere to put a shortfall, because `.stage` scrolls. Left to the
 * browser's own
 * `flex: 0 1 auto` the strip is squeezed instead, and the tiles at the foot of
 * it are cut off by `body.app`'s `overflow: hidden` with nothing in the markup
 * or in the panel's own rules objecting. That makes it a browser question
 * rather than a stylesheet one -- the declarations are checked in
 * `src/widgets/workspace-layout/ui/workspace-layout.css.test.ts` (the column's
 * own flex factors) and in the strip's own `stats-panel.css.test.ts`, and what
 * is checked here is the result of laying them out.
 *
 * Two buildings, both far shorter than the pane, because a short building is
 * what used to break the panel beside it: the strip has to be whole whether the
 * stage above it is asking for room or leaving it. Neither building's floors
 * are a fixed height any more -- `widgets/building-stage`'s own
 * `layoutBuilding()` sizes them to whatever room the stage gives it, and with
 * only two or three floors to spend it on they hit the *upper* clamp, 96px a
 * floor. Nothing taller is measured because a building too tall for the stage
 * does not stretch anything at all: it scrolls inside `.stage`, so the row
 * below it is never the thing that gives way.
 *
 * Both tests hold the disclosure open, which is the worst case and the only one
 * worth measuring: closed, the strip is four tiles and a summary row that fit
 * anywhere.
 */

import { expect, test } from "@playwright/test";

import { building } from "./game-page.ts";

/** The project's own minimum window -- `body.app`'s `min-inline-size`/`min-block-size`. */
const FLOOR = { width: 1040, height: 600 } as const;

/** The shortest buildings the game draws. */
const SHORT_BUILDINGS = [
  { name: "a two-floor learning level", hash: "#level=tutorial-1" },
  { name: "a three-floor level", hash: "#level=1" },
] as const;

/**
 * Opens "Все показатели" and waits for the nine tiles behind it.
 *
 * Opened through the summary rather than by setting `open` so that the click
 * path itself is exercised — it is the only control the strip has.
 *
 * @param page - The page under test.
 */
async function openEveryFigure(page: import("@playwright/test").Page): Promise<void> {
  // A car, and not one of the tiles these tests are about: the cars are drawn
  // by the presenter that sizes the building, in the same pass that draws the
  // strip, so waiting for one lets the measurements below read a building the
  // presenter has already sized rather than one it has not gotten to yet. That
  // is a flaky failure rather than a false pass -- the assertions would catch
  // it -- but a test that fails for a reason it is not about is worth not
  // writing.
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
  // Closed by default, so the nine secondary tiles -- everything past "Avg
  // delivery time", "Max delivery time", "Avg load" and "Transported/s" -- are
  // not in the layout at all until this opens it.
  await page.locator(".statspanel .more > summary").click();
  await expect(page.locator(".tiles-secondary .tile").first()).toBeVisible();
}

for (const { name, hash } of SHORT_BUILDINGS) {
  test(`shows every statistic below ${name}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await openEveryFigure(page);

    const measured = await page.evaluate(() => {
      // `.building` and not `.innerworld`: the wrappers `index.html` puts
      // around the stage all fill the pane now, and the building is the box
      // inside them that is really as tall as its floors.
      const built = document.querySelector(".building");
      const world = document.querySelector(".world");
      if (built === null || world === null) {
        throw new Error("The page has no building to measure the strip against");
      }
      return {
        // The window itself is the clip: `body.app` is a full-height column on
        // `overflow: hidden`, so anything past its foot is simply not drawn.
        buildingHeight: Math.round(built.getBoundingClientRect().height),
        worldHeight: Math.round(world.getBoundingClientRect().height),
        tiles: [...document.querySelectorAll(".statspanel .tile")].map((tile) => ({
          label: (tile.querySelector(".cap")?.textContent ?? "").trim(),
          // How far the tile's last pixel falls short of the window's, so that
          // a failure names the tiles that were cut and by how much rather
          // than only reporting that a count came out wrong.
          room: Math.round(window.innerHeight - tile.getBoundingClientRect().bottom),
        })),
      };
    });

    // The building really is the short one this case is about, so a change that
    // quietly gave every building the whole pane would otherwise pass.
    expect(measured.buildingHeight).toBeGreaterThan(0);
    expect(measured.buildingHeight).toBeLessThan(measured.worldHeight);
    // That there are tiles at all, so an empty strip cannot satisfy the line
    // below. How many there should be is a fact about `widgets/stats-panel`'s
    // own `TILES` array, not about what a browser did with it, so it is not
    // repeated here.
    expect(measured.tiles.length).toBeGreaterThan(0);
    expect(measured.tiles.filter((tile) => tile.room < 0)).toEqual([]);
  });
}

test("takes its own height out of the pane before the building takes any", async ({ page }) => {
  // At the project's own floor, where the pane has less height than its four
  // rows would like: the goal bar, the learning track's panel -- 287px of it on
  // this route -- the building, and the figures. The strip is the row that must
  // not give, so what is measured is that it is drawn at its own content height
  // and that the building is what was spent instead.
  //
  // This is where the column's priorities are visible and nowhere else: at the
  // default 1280x900 there is room for all four and every arrangement looks the
  // same.
  await page.setViewportSize({ ...FLOOR });
  await page.goto("/#level=tutorial-1");
  await openEveryFigure(page);

  const measured = await page.evaluate(() => {
    const strip = document.querySelector(".statscontainer");
    const world = document.querySelector(".world");
    if (strip === null || world === null) {
      throw new Error("The page has no statistics strip to measure");
    }
    return {
      // `scrollHeight` is what the strip's own content asks for; the box's
      // rendered height is what the column gave it. A squeezed strip is the
      // one where the second is smaller than the first.
      wanted: strip.scrollHeight,
      given: Math.round(strip.getBoundingClientRect().height),
      worldHeight: Math.round(world.getBoundingClientRect().height),
    };
  });

  expect(measured.given).toBe(measured.wanted);
  // And the building is what paid for it: at this size there is nothing left
  // for the stage at all, which is the correct answer -- `.stage` scrolls, and
  // a cut-off figure does not.
  expect(measured.worldHeight).toBeLessThan(measured.given);
});
