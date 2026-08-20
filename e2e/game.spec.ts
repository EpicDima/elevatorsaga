/**
 * The game itself: does the built page come up, and does pressing Start
 * actually play a challenge through to its end?
 */

import { expect, test } from "@playwright/test";

import { DEV_TEST_CODE } from "../src/ui/default-code.ts";
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

test("boots the first challenge with an editor and a building", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle(/Elevator Saga/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elevator Saga");
  // The challenge bar's own prose sentence ("Transport 15 people in 60
  // seconds or less") is gone: `widgets/goal-bar` states the same
  // requirement as two meters instead, one per field the condition reads.
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  await expect(page.locator('.meter[data-kind="transportedCounter"] .meter-val')).toHaveText(
    "0 / 15",
  );
  await expect(page.locator('.meter[data-kind="elapsedTime"] .meter-val')).toContainText("60");

  // The editor is the ~92% of the bundle that lives in its own chunks, so this
  // doubles as the check that they loaded: no CodeMirror, no text box.
  await expect(editor(page)).toContainText('elevator.on("idle", function() {');
  await expect(editor(page)).toContainText("elevator.goToFloor(1);");

  // Challenge 1 is three floors and one elevator, which is one in-car button
  // per floor and a call button on every floor but the ends.
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();
  await expect(building(page).getByRole("button", { name: /^Go to floor / })).toHaveCount(3);
  await expect(
    building(page).getByRole("button", { name: "Call an elevator going up from floor 0" }),
  ).toBeVisible();
  // Which is the whole of the ground floor's call panel: nothing is called
  // down from the bottom of the building, so there is no lamp there to press.
  await expect(
    building(page).getByRole("button", { name: "Call an elevator going down from floor 0" }),
  ).toHaveCount(0);

  await expect(startButton(page)).toBeVisible();
  await expect(await statistic(page, "Transported")).toHaveText("0");
  await expect(await statistic(page, "Elapsed time")).toHaveText("0s");

  expect(pageErrors).toEqual([]);
});

test("plays a challenge to completion when Start is pressed", async ({ page }) => {
  // A program that wins: {@link DEV_TEST_CODE} is the naive dispatcher the
  // challenge tiers are calibrated against, and it clears challenge 1 with room
  // to spare. Planted in storage rather than asked for by URL — `#devtest` did
  // that until the key was retired — so the page comes up with it already in
  // the editor. `#timescale=16` gets the simulated minute over with in a few
  // real seconds without changing the physics, which are substepped at a fixed
  // rate whatever the clock says.
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

  // The challenge wants 15 people inside 60 simulated seconds.
  await expect(page.getByRole("heading", { name: "Success!" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Next level/ })).toBeVisible();
  // The primary button says "Start" again rather than "Resume": there is
  // nothing left to resume, and what a press offers now is to throw the
  // result on screen away, which is what its title says in the words the
  // label has no room for.
  await expect(startButton(page)).toHaveAttribute("title", "Run it again from the beginning");
  expect(await statisticValue(page, "Transported")).toBeGreaterThanOrEqual(15);
});

test("crunches a challenge instantly and shows the outcome over the building it ended in", async ({
  page,
}) => {
  // Same program and challenge as the animated run above, so the two tests are
  // asking the same question of the same program — only how it is driven
  // differs. No `timescale`: that only paces animation, and a crunch draws
  // none, so it would change nothing here.
  await seedCode(page, DEV_TEST_CODE);
  await page.goto("/#level=1");

  // Before the crunch, the reference solution's elevator is on screen exactly
  // as any other run's would be.
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();

  // A crunch is a speed rather than a button of its own: the last stop past
  // the fastest one, chosen before the run and realised when it starts.
  await selectInstantSpeed(page);
  await expect(speedValue(page)).toHaveText("∞x");
  await startButton(page).click();

  // The button waits out "Crunching..." on its own — this is one assertion
  // doing two jobs, since it can only pass once the crunch has both reached a
  // verdict and handed the button back. The title rather than the label,
  // because "Start" is what the button reads at both ends of a crunch and only
  // the ended run has something to offer running again. Well under the 30s the
  // animated test budgets for the same challenge: nothing here waits on
  // simulated time passing in real time, only on however long the CPU actually
  // needs.
  await expect(startButton(page)).toHaveAttribute("title", "Run it again from the beginning", {
    timeout: 15_000,
  });
  await expect(startButton(page)).toBeEnabled();

  // The same outcome, and the same final statistics, an animated run of this
  // challenge already proves it reaches.
  await expect(page.getByRole("heading", { name: "Success!" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next level/ })).toBeVisible();
  expect(await statisticValue(page, "Transported")).toBeGreaterThanOrEqual(15);

  // And the run it is reporting on is on screen behind it. Nothing is drawn
  // for the frames of a crunch, which nobody watches; the last one is drawn
  // once it is over, because the verdict is a card in the corner and the pane
  // it leaves uncovered has to be the building the verdict is about --
  // passengers included, since a challenge is won long before its stream of
  // them dries up.
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();
  await expect(building(page).locator(".person").first()).toBeVisible();
});

test("does not offer the instant stop in the sandbox, and plays it animated at the fastest speed", async ({
  page,
}) => {
  // Free play has no condition to resolve, so a crunch there could only run out
  // the ceiling `driveInstantly` gives up at and announce a failure for a run
  // with no goal to fail. The stop is withheld instead, which makes 20x the end
  // of the control rather than the top of the ladder.
  await page.goto("/#level=sandbox");
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();

  // Presses "Faster" until it dims, wherever that turns out to be.
  await selectInstantSpeed(page);
  await expect(speedValue(page)).toHaveText("20x");

  await startButton(page).click();

  // An ordinary animated run: the building stays on screen and time passes in
  // it, and no verdict is ever reached, which is the whole point of the place.
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect
    .poll(async () => statisticValue(page, "Elapsed time"), { timeout: 15_000 })
    .toBeGreaterThan(5);
  await expect(building(page).getByRole("group", { name: "Elevator 1" })).toBeVisible();
  await expect(page.locator(".verdict")).toHaveCount(0);
});

test("colours the passenger whose time the statistics panel is reporting", async ({ page }) => {
  // The chain behind "Max delivery time" end to end: the world picks the passenger,
  // the presenter puts a class on them, and the stylesheet turns that into a
  // colour. Only the last of those three is out of reach of the unit tests, and
  // it is the only one the player can see.
  await seedCode(page, DEV_TEST_CODE);
  await page.goto("/#level=1,timescale=16");
  await startButton(page).click();

  // Everything in one evaluation -- the crowd, the mark, and the colour of the
  // marked passenger -- because a running world answers two questions about two
  // different moments. The mark belongs to whoever has waited longest, so it
  // moves the instant an elevator takes them, and every round trip to the
  // browser is a frame or more in which that can happen.
  //
  // This case used to ask in three: poll for the mark, press Pause, then read
  // the colour off it. Pausing was meant to be what made it safe, and it is
  // what made it fail. Twice in eleven runs of the whole suite -- and never in
  // twenty-four runs of this case by itself, because it takes a loaded machine
  // to widen the gap -- the pause landed in the moment after the marked
  // passenger had boarded and before anyone else had started waiting. A paused
  // world never grows the mark back, so the colour assertion sat out its entire
  // timeout waiting for an element that was not coming.
  //
  // Exactly one is marked, never two: there is one longest wait, and the mark
  // is handed from passenger to passenger rather than handed out.
  //
  // Yellow rather than the grey of everybody else. That particular value --
  // --ds-car-attention, at `.person.is-rider.is-waiting-long` in
  // src/entities/passenger/ui/passenger-view.css -- is the *boarded* one,
  // because the mark follows its
  // passenger into the car (src/game/world.ts's `#setLongestWaitingUser` keeps
  // it through the ride, not just through the wait) and a car needs its own
  // colours, so the poll settles on a frame where the marked passenger is
  // riding. Waiting, they are --ds-accent, which is themed and so not one
  // literal to assert. Reading the colour computed is the same question
  // `toHaveCSS` asks.
  await expect
    .poll(
      async () =>
        building(page).evaluate((where) => {
          const marked = where.querySelectorAll(".person.is-waiting-long");
          const only = marked[0];
          return {
            inACrowd: where.querySelectorAll(".person").length > 1,
            marked: marked.length,
            colour: only === undefined ? null : getComputedStyle(only).color,
          };
        }),
      { timeout: 30_000 },
    )
    .toEqual({ inACrowd: true, marked: 1, colour: "rgb(255, 255, 0)" });
});
