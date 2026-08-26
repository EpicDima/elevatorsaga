/**
 * The statistics strip is always drawn whole: when the pane is too short, the
 * building gives way (it's the only row that can scroll, via `.stage`), not
 * the strip. Both tests keep the "All figures" disclosure open, the worst case.
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
 * Opens "Все показатели" and waits for the nine tiles behind it. Clicked
 * through the summary, not set via `open`, so the click path is exercised too.
 */
async function openEveryFigure(page: import("@playwright/test").Page): Promise<void> {
  // Waits for a car (not a tile) so the measurements below read a building
  // the presenter has already sized, avoiding a flaky failure unrelated to what's being tested.
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
  // Closed by default, so the nine secondary tiles aren't in the layout at all until this opens it.
  await page.locator(".statspanel .more > summary").click();
  await expect(page.locator(".tiles-secondary .tile").first()).toBeVisible();
}

for (const { name, hash } of SHORT_BUILDINGS) {
  test(`shows every statistic below ${name}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await openEveryFigure(page);

    const measured = await page.evaluate(() => {
      // `.building`, not `.innerworld`: the wrappers around the stage fill
      // the pane now, so `.building` is the box that's really as tall as its floors.
      const built = document.querySelector(".building");
      const world = document.querySelector(".world");
      if (built === null || world === null) {
        throw new Error("The page has no building to measure the strip against");
      }
      return {
        // The window is the clip: body.app's overflow: hidden simply doesn't
        // draw anything past its foot.
        buildingHeight: Math.round(built.getBoundingClientRect().height),
        worldHeight: Math.round(world.getBoundingClientRect().height),
        tiles: [...document.querySelectorAll(".statspanel .tile")].map((tile) => ({
          label: (tile.querySelector(".cap")?.textContent ?? "").trim(),
          // How far short of the window the tile's last pixel falls, so a
          // failure names which tiles were cut and by how much.
          room: Math.round(window.innerHeight - tile.getBoundingClientRect().bottom),
        })),
      };
    });

    // Confirms the building really is the short one here, not given the whole pane.
    expect(measured.buildingHeight).toBeGreaterThan(0);
    expect(measured.buildingHeight).toBeLessThan(measured.worldHeight);
    // Confirms tiles exist at all; the expected count is TILES's own concern, not this test's.
    expect(measured.tiles.length).toBeGreaterThan(0);
    expect(measured.tiles.filter((tile) => tile.room < 0)).toEqual([]);
  });
}

test("takes its own height out of the pane before the building takes any", async ({ page }) => {
  // At the project's floor, four rows (goal bar, lesson panel, building,
  // figures) compete for less height than they want. The column's priorities
  // only show here - at the default viewport there's room for all four.
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
      // scrollHeight is what the content wants; the rendered height is what
      // the column gave it - a squeezed strip is where the second is smaller.
      wanted: strip.scrollHeight,
      given: Math.round(strip.getBoundingClientRect().height),
      worldHeight: Math.round(world.getBoundingClientRect().height),
    };
  });

  expect(measured.given).toBe(measured.wanted);
  // The building pays for it: nothing's left for the stage, which is fine
  // since `.stage` scrolls but a cut-off figure wouldn't.
  expect(measured.worldHeight).toBeLessThan(measured.given);
});

test("explains a figure to a keyboard, above the strip and over the building", async ({ page }) => {
  // The card that replaced the tiles' title attributes. Where it lands is a
  // browser question, not jsdom's: this card is placed to leave its own
  // container, a case a made-up box in a unit test can't pose.
  await page.goto("/#level=9");
  const card = page.locator(".statcard");
  await expect(card).toBeHidden();

  const tile = page.locator('.tile[data-stat="avgWaitTime"]');
  await tile.focus();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Avg delivery time");

  const boxes = await page.evaluate(() => {
    const rectOf = (selector: string): DOMRect => {
      const found = document.querySelector(selector);
      if (found === null) {
        throw new Error(`The page has no ${selector} to measure`);
      }
      return found.getBoundingClientRect();
    };
    const shown = rectOf(".statcard");
    const middle = document.elementFromPoint(
      shown.left + shown.width / 2,
      shown.top + shown.height / 2,
    );
    return {
      card: { top: shown.top, bottom: shown.bottom, left: shown.left },
      strip: rectOf(".statspanel").top,
      tile: rectOf('.tile[data-stat="avgWaitTime"]').top,
      // Confirms the card, not something the building paints over it, is
      // what's actually drawn at its center.
      onTop: middle !== null && document.querySelector(".statcard")?.contains(middle) === true,
    };
  });

  // No gap to the tile, so a pointer can travel up onto it without the card
  // closing first (WCAG 1.4.13).
  expect(boxes.card.bottom).toBeCloseTo(boxes.tile, 0);
  // Out through the top of the strip: the card is taller than the strip's two rows.
  expect(boxes.card.top).toBeLessThan(boxes.strip);
  expect(boxes.card.left).toBeGreaterThanOrEqual(0);
  expect(boxes.onTop).toBe(true);
  await expect(card).toBeInViewport();

  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // The card goes; the figure keeps the focus.
  await expect(tile).toBeFocused();
});

test("keeps a figure's card up while the pointer travels onto it", async ({ page }) => {
  await page.goto("/#level=9");

  const tile = page.locator('.tile[data-stat="transportedPerSec"]');
  await tile.hover();
  const card = page.locator(".statcard");
  await expect(card).toBeVisible();

  // Straight up from the figure onto the card: the two boxes touch, so the
  // pointer never leaves both at once.
  await card.hover();
  await expect(card).toBeVisible();

  // Away, to the building above: nothing holds it open any more.
  await page.locator(".building").hover();
  await expect(card).toBeHidden();
});
