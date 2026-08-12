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

  // Both counts in one evaluation, because they are counted a frame apart
  // otherwise and the frame in between delivers somebody. Exactly one is
  // marked, never two: there is one longest wait, and the mark is handed from
  // passenger to passenger rather than handed out.
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          inACrowd: document.querySelectorAll(".user").length > 1,
          marked: document.querySelectorAll(".user.waiting-longest").length,
        })),
      { timeout: 30_000 },
    )
    .toEqual({ inACrowd: true, marked: 1 });

  // Pausing before reading the colour, so that the assertion is not racing the
  // end of the challenge: once the last passenger is delivered there is nothing
  // marked to read a colour off, and the failure would be about the wrong thing.
  await page.getByRole("button", { name: "Pause" }).click();
  // Yellow rather than the white of everybody else. The value is measured at
  // `.user.waiting-longest` in src/styles/style.css, against every surface a
  // passenger is ever drawn on.
  await expect(building(page).locator(".user.waiting-longest")).toHaveCSS(
    "color",
    "rgb(255, 255, 0)",
  );
});
