/**
 * Captures the README screenshot.
 *
 * Not part of the smoke suite: it writes a tracked file, which is not something
 * a test run should do behind anyone's back, so `playwright.config.ts` ignores
 * it and only `playwright.screenshot.config.ts` collects it. Run it with
 * `npm run screenshot` after a change that alters how the game looks, then look
 * at the result and commit it.
 *
 * The composition mirrors the original 2013 screenshot: challenge #5, six
 * floors and four elevators, caught mid-run with passengers still waiting.
 */

import { expect, test } from "@playwright/test";

import { DEV_TEST_CODE } from "../src/ui/default-code.ts";
import { seedLevelCode, startButton, statistic, statisticValue, unlockLevel } from "./game-page.ts";

/**
 * Where the README expects to find it.
 *
 * Under `public/` rather than beside it, because the same picture is the site's
 * `og:image`: Vite copies everything in `public/` to the root of `dist/`, so one
 * file serves both the README and the link preview.
 */
const OUTPUT_PATH = "public/images/screenshot.png";

/**
 * Passengers to deliver before the picture is taken.
 *
 * Enough that the statistics panel has real numbers in it and the building is
 * busy; far enough from the challenge's 100 that the "challenge failed" overlay
 * cannot appear over the top of the shot.
 */
const TRANSPORTED_BEFORE_CAPTURE = 18;

/**
 * The seed the picture is drawn from.
 *
 * Pinned so that regenerating the image after a change to the look of the game
 * shows the change and not a different game: without it every capture drew its
 * own passengers, and the diff on a tracked PNG was a fresh crowd every time.
 *
 * What a seed pins is the cast: who walks in, when, and where they are going.
 * It does not pin the run, and `seedHelpTemplate` in `src/ui/templates.ts` says
 * why — `dt` comes from `requestAnimationFrame`, so the cars are elsewhere as
 * each passenger appears and the outcome moves with them. That caveat holds
 * here too; what makes the picture steady anyway is that a headless Chromium
 * with nothing else to do delivers very regular frames. Seven captures from
 * this seed all came out at 27 transported in 24s and 68 moves, with the cars
 * at floors 4, 2, 0 and 0 and the same passengers waiting on the same floors;
 * the rate read 1.13 a second or 1.12, the average delivery 7.5s or 7.4s and
 * the worst 14.9s or 14.8s, which is the whole of the difference between them
 * -- the rate is 27 over an elapsed time the panel prints rounded, so the two
 * readings are a fraction of a second apart. Other seeds tried were not all
 * this steady — `tower` landed on 23 transported once and 25 twice — so the
 * steadiness is a property of the seed picked, not a promise of the mechanism,
 * and a regenerated picture that differs in a car or two is the run wobbling
 * rather than anything being wrong.
 *
 * Chosen over the others tried for the composition at 1280x1000: passengers
 * left waiting on four of the six floors, cars caught at three different
 * heights rather than parked in a row, and the one marked by `waiting-longest`
 * near the middle of the frame, level with the "Max delivery time" it explains.
 */
const SEED = "office";

/** The challenge in the picture: the six floors and four cars of the original. */
const LEVEL = 5;

test.describe("README screenshot", () => {
  // 1280 wide is the shell's own 1220px plus a margin, at a device pixel ratio
  // of 1: large enough to show the whole game, small enough to drop into a
  // README without scaling.
  test.use({ viewport: { width: 1280, height: 1000 } });

  test("captures the game mid-challenge", async ({ page }) => {
    // The line the page prints as a run starts, which is what the seed is read
    // from below. Registered before the first navigation, because the run is
    // started a few lines further down and the line is printed with it.
    const logs: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "log") {
        logs.push(message.text());
      }
    });

    // A browser that has played its way to level 5, because the router now
    // answers an address for a level nobody has earned with the furthest one
    // they have — and the picture would quietly become level 1.
    await unlockLevel(page, LEVEL);

    // A real program in the editor rather than the two-line starter, planted in
    // the slot this level opens: `#devtest` used to load it from the URL, and
    // that key is gone.
    await seedLevelCode(page, LEVEL, DEV_TEST_CODE);

    await page.goto(`/#challenge=${String(LEVEL)},timescale=6,seed=${SEED}`);

    // The seed took. A seed the router refuses is swapped for a fresh one with
    // nothing but a console warning to show for it, and the picture would go
    // quietly back to being a different game on every capture. Read from the
    // console rather than from the seed row in the settings popover, which is
    // where the seed is written on screen: the popover is closed in the picture
    // and opening it to read the row would put it in the picture too.
    await expect.poll(() => logs.some((line) => line.includes(SEED))).toBe(true);

    await startButton(page).click();

    await expect
      .poll(async () => statisticValue(page, "Transported"), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(TRANSPORTED_BEFORE_CAPTURE);

    // Freeze the simulation so nothing is halfway through a transition, and so
    // the numbers in the panel match the pixels above them. The button reads
    // "Resume" rather than "Start" afterwards: the run is standing still
    // part-way through rather than waiting to begin.
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(startButton(page, "Resume")).toBeVisible();

    // The panel as a player finds it. Reading a statistic forces the "All
    // figures" disclosure open, which is right for a test asking what a number
    // is and wrong for a picture: it is shut on arrival, and left open it fills
    // the lower half of the frame with the nine figures behind it while the
    // building the game is about shrinks to fit what is left.
    await page.locator(".statspanel .more").evaluate((details) => {
      (details as HTMLDetailsElement).open = false;
    });

    // The interface is set in the system UI face and the bundle ships no
    // webfont, so there is normally nothing outstanding here -- but the editor
    // asks for a monospace stack of its own, and waiting costs a tick against
    // a promise that is already resolved.
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: OUTPUT_PATH, fullPage: true, animations: "disabled" });

    await expect(await statistic(page, "Transported")).not.toHaveText("0");
  });
});
