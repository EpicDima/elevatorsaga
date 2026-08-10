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

import { statistic, statisticValue } from "./game-page.ts";

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

test.describe("README screenshot", () => {
  // 1280 wide is the shell's own 1220px plus a margin, at a device pixel ratio
  // of 1: large enough to show the whole game, small enough to drop into a
  // README without scaling.
  test.use({ viewport: { width: 1280, height: 1000 } });

  test("captures the game mid-challenge", async ({ page }) => {
    // The reference solution, so the editor shows a real program rather than
    // the two-line starter, running the challenge the original screenshot used.
    await page.goto("/#challenge=5,devtest,timescale=6,autostart");

    await expect
      .poll(async () => statisticValue(page, "Transported"), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(TRANSPORTED_BEFORE_CAPTURE);

    // Freeze the simulation so nothing is halfway through a transition, and so
    // the numbers in the panel match the pixels above them.
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

    // Oswald is self-hosted and loaded by the bundle; without this the headings
    // can still be in the fallback face when the shutter comes down.
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: OUTPUT_PATH, fullPage: true, animations: "disabled" });

    await expect(statistic(page, "Transported")).not.toHaveText("0");
  });
});
