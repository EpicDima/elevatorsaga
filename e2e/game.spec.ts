/**
 * The game itself: does the built page come up, and does pressing Start
 * actually play a level through to its end?
 */

import { expect, test } from "@playwright/test";

import { DEV_TEST_CODE } from "../src/ui/default-code.ts";
import { MAX_ZOOM } from "../src/widgets/building-stage/lib/shaft-scale.ts";
import {
  building,
  editor,
  seedCode,
  selectInstantSpeed,
  speedValue,
  startButton,
  statistic,
  statisticValue,
} from "./game-page.ts";

test("boots the first level with an editor and a building", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle(/Elevator Saga/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elevator Saga");
  // The requirement is stated as two meters, one per condition field, not a prose sentence.
  await expect(page.getByRole("button", { name: "Level 1-1" })).toBeVisible();
  await expect(page.locator('.meter[data-kind="transportedCounter"] .meter-val')).toHaveText(
    "0 / 15",
  );
  await expect(page.locator('.meter[data-kind="elapsedTime"] .meter-val')).toContainText("60");

  // The editor is most of the bundle, in its own chunk, so this doubles as
  // checking it loaded: no CodeMirror, no text box.
  await expect(editor(page)).toContainText('elevator.on("idle", function() {');
  await expect(editor(page)).toContainText("elevator.goToFloor(1);");

  // Level 1 is three floors and one elevator: one in-car button per floor,
  // one call button per floor but the ends.
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
  await expect(building(page).getByRole("button", { name: /^Go to floor / })).toHaveCount(3);
  await expect(
    building(page).getByRole("button", { name: "Call an elevator going up from floor 0" }),
  ).toBeVisible();
  // The ground floor has no down call: nothing is ever called down from the bottom.
  await expect(
    building(page).getByRole("button", { name: "Call an elevator going down from floor 0" }),
  ).toHaveCount(0);

  await expect(startButton(page)).toBeVisible();
  await expect(await statistic(page, "Transported")).toHaveText("0");
  await expect(await statistic(page, "Elapsed time")).toHaveText("0s");

  expect(pageErrors).toEqual([]);
});

test("draws the cars half again their world units when the pane has the room", async ({ page }) => {
  // MAX_ZOOM's actual effect on screen, measurable only in a browser: the fit
  // reads `.stage`'s clientWidth. Level 1's car (capacity 4, so 40 world
  // units) draws at 60px at the default window size, not 40.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#level=1");
  const car = building(page).locator(".car");
  await expect(car).toBeVisible();

  const drawn = await car.boundingBox();
  expect(drawn?.width).toBeCloseTo(4 * 10 * MAX_ZOOM, 0);

  // The zoom stops growing at the pane's edge: outgrowing it would show as a
  // sideways scrollbar rather than a clipped house.
  const spill = await page
    .locator(".stage")
    .evaluate((stage) => stage.scrollWidth - stage.clientWidth);
  expect(spill).toBe(0);
});

test("plays a level to completion when Start is pressed", async ({ page }) => {
  // DEV_TEST_CODE is the naive dispatcher the level tiers are calibrated
  // against; it clears level 1 with room to spare. Planted in storage, not
  // via URL, so the page loads with it already in the editor. `timescale=16`
  // speeds up real time, not the physics.
  await seedCode(page, DEV_TEST_CODE);
  await page.goto("/#level=1,timescale=16");

  await expect(await statistic(page, "Transported")).toHaveText("0");
  await expect(await statistic(page, "Moves")).toHaveText("0");

  await startButton(page).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // Passengers are actually being carried, not merely animated.
  await expect
    .poll(async () => statisticValue(page, "Transported"), { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(await statisticValue(page, "Elapsed time")).toBeGreaterThan(0);
  expect(await statisticValue(page, "Moves")).toBeGreaterThan(0);

  // The level wants 15 people inside 60 simulated seconds.
  await expect(page.getByRole("heading", { name: "Success!" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Next level/ })).toBeVisible();
  // Says "Start" again, not "Resume": there's nothing left to resume, and a
  // press now discards the result on screen (per its title).
  await expect(startButton(page)).toHaveAttribute("title", "Run it again from the beginning");
  expect(await statisticValue(page, "Transported")).toBeGreaterThanOrEqual(15);
});

test("crunches a level instantly and shows the outcome over the building it ended in", async ({
  page,
}) => {
  // Same program and level as the animated run, so both tests ask the same
  // question; only how it's driven differs. No timescale: a crunch draws nothing to pace.
  await seedCode(page, DEV_TEST_CODE);
  await page.goto("/#level=1");

  // Before the crunch, the elevator is on screen exactly as in any other run.
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();

  // A crunch is a speed, not its own button: the last stop past the fastest one.
  await selectInstantSpeed(page);
  await expect(speedValue(page)).toHaveText("∞x");
  await startButton(page).click();

  // Waits out "Crunching..." itself, doing double duty: this can only pass
  // once the crunch has reached a verdict and handed the button back. The
  // title, not the label, since "Start" reads the same at both ends of a crunch.
  await expect(startButton(page)).toHaveAttribute("title", "Run it again from the beginning", {
    timeout: 15_000,
  });
  await expect(startButton(page)).toBeEnabled();

  // The same outcome an animated run of this level already proves it reaches.
  await expect(page.getByRole("heading", { name: "Success!" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next level/ })).toBeVisible();
  expect(await statisticValue(page, "Transported")).toBeGreaterThanOrEqual(15);

  // The run it's reporting on stays on screen behind the verdict: a crunch
  // draws no frames, but the last one is drawn once it's over, since the
  // verdict card leaves the building - passengers included - uncovered.
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
  await expect(building(page).locator(".person").first()).toBeVisible();
});

test("does not offer the instant stop in the sandbox, and plays it animated at the fastest speed", async ({
  page,
}) => {
  // Free play has no condition to resolve, so a crunch would just run out and
  // announce a failure with no goal to fail; the stop is withheld instead.
  await page.goto("/#level=sandbox");
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();

  // Presses "Faster" until it dims, wherever that turns out to be.
  await selectInstantSpeed(page);
  await expect(speedValue(page)).toHaveText("16x");

  await startButton(page).click();

  // An ordinary animated run: time passes and no verdict is ever reached.
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect
    .poll(async () => statisticValue(page, "Elapsed time"), { timeout: 15_000 })
    .toBeGreaterThan(5);
  await expect(building(page).getByRole("group", { name: "Elevator 0" })).toBeVisible();
  await expect(page.locator(".verdict")).toHaveCount(0);
});

test("colors the passenger whose time the statistics panel is reporting", async ({ page }) => {
  // The chain behind "Max delivery time" end to end: the world picks the
  // passenger, the presenter marks them, and the stylesheet colors it - only
  // the last step is out of unit tests' reach, and it's the only one a player sees.
  await seedCode(page, DEV_TEST_CODE);
  await page.goto("/#level=1,timescale=16");
  await startButton(page).click();

  // Everything read in one evaluation, since the world keeps moving between
  // round trips to the browser: exactly one passenger is ever marked, and
  // yellow (--ds-car-attention) is specifically the boarded color, not the waiting --ds-accent.
  await expect
    .poll(
      async () =>
        building(page).evaluate((where) => {
          const marked = where.querySelectorAll(".person.is-waiting-long");
          const only = marked[0];
          return {
            inACrowd: where.querySelectorAll(".person").length > 1,
            marked: marked.length,
            color: only === undefined ? null : getComputedStyle(only).color,
          };
        }),
      { timeout: 30_000 },
    )
    .toEqual({ inACrowd: true, marked: 1, color: "rgb(255, 255, 0)" });
});
