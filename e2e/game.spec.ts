/**
 * The game itself: does the built page come up, and does pressing Start
 * actually play a challenge through to its end?
 */

import { expect, test } from "@playwright/test";

import { building, editor, statistic, statisticValue } from "./game-page.ts";

test("boots the first challenge with an editor and a building", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle(/Elevator Saga/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elevator Saga");
  await expect(page.getByRole("heading", { name: /^Challenge #1:/ })).toContainText(
    "Transport 15 people in 60 seconds or less",
  );

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

  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(statistic(page, "Transported")).toHaveText("0");
  await expect(statistic(page, "Elapsed time")).toHaveText("0s");

  expect(pageErrors).toEqual([]);
});

test("plays a challenge to completion when Start is pressed", async ({ page }) => {
  // `#devtest` loads the reference solution, which clears challenge 1 with room
  // to spare; `#timescale=16` gets the simulated minute over with in a few real
  // seconds without changing the physics, which are substepped at a fixed rate
  // whatever the clock says.
  await page.goto("/#challenge=1,devtest,timescale=16");

  await expect(statistic(page, "Transported")).toHaveText("0");
  await expect(statistic(page, "Moves")).toHaveText("0");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // Passengers are actually being carried, not merely animated.
  await expect
    .poll(async () => statisticValue(page, "Transported"), { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(await statisticValue(page, "Elapsed time")).toBeGreaterThan(0);
  expect(await statisticValue(page, "Moves")).toBeGreaterThan(0);

  // The challenge wants 15 people inside 60 simulated seconds.
  await expect(page.getByRole("heading", { name: "Success!" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Next challenge/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Restart/ })).toBeVisible();
  expect(await statisticValue(page, "Transported")).toBeGreaterThanOrEqual(15);
});

test("colours the passenger whose time the statistics panel is reporting", async ({ page }) => {
  // The chain behind "Max delivery time" end to end: the world picks the passenger,
  // the presenter puts a class on them, and the stylesheet turns that into a
  // colour. Only the last of those three is out of reach of the unit tests, and
  // it is the only one the player can see.
  await page.goto("/#challenge=1,devtest,timescale=16");
  await page.getByRole("button", { name: "Start" }).click();

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
  // is handed from passenger to passenger rather than handed out. Yellow rather
  // than the white of everybody else; the value is set at
  // `.user.waiting-longest` in src/styles/style.css, and reading it computed is
  // the same question `toHaveCSS` asks.
  await expect
    .poll(
      async () =>
        building(page).evaluate((where) => {
          const marked = where.querySelectorAll(".user.waiting-longest");
          const only = marked[0];
          return {
            inACrowd: where.querySelectorAll(".user").length > 1,
            marked: marked.length,
            colour: only === undefined ? null : getComputedStyle(only).color,
          };
        }),
      { timeout: 30_000 },
    )
    .toEqual({ inACrowd: true, marked: 1, colour: "rgb(255, 255, 0)" });
});
