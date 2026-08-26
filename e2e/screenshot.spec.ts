/**
 * Captures the README screenshot. Not part of the smoke suite: it writes a
 * tracked file, so only `playwright.screenshot.config.ts` collects it. Run
 * with `npm run screenshot` after a visual change, then commit the result.
 */

import { expect, test } from "@playwright/test";

import { DEV_TEST_CODE } from "../src/ui/default-code.ts";
import { seedLevelCode, startButton, statistic, statisticValue } from "./game-page.ts";

/** Under `public/` since the same picture doubles as the site's `og:image`. */
const OUTPUT_PATH = "public/images/screenshot.png";

/** Enough for real numbers in the panel, far short of the level's 100 failure threshold. */
const TRANSPORTED_BEFORE_CAPTURE = 18;

/**
 * Pinned so a regenerated picture shows a look change, not a different crowd.
 * A seed pins who arrives and when, not the run itself - a headless browser's
 * regular frame pacing is what actually keeps the outcome steady across captures.
 */
const SEED = "office";

/** The level in the picture: the six floors and four cars of the original. */
const LEVEL = 5;

test.describe("README screenshot", () => {
  // Large enough to show the whole game, small enough for a README without scaling.
  test.use({ viewport: { width: 1280, height: 1000 } });

  test("captures the game mid-level", async ({ page }) => {
    // Registered before navigation, since the run is started (and this printed) below.
    const logs: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "log") {
        logs.push(message.text());
      }
    });

    await seedLevelCode(page, LEVEL, DEV_TEST_CODE);

    await page.goto(`/#level=${String(LEVEL)},timescale=6,seed=${SEED}`);

    // Confirms the seed took: a refused seed is silently swapped for a fresh
    // one. Read from the console, not the (closed) settings popover, so opening it doesn't enter the shot.
    await expect.poll(() => logs.some((line) => line.includes(SEED))).toBe(true);

    await startButton(page).click();

    await expect
      .poll(async () => statisticValue(page, "Transported"), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(TRANSPORTED_BEFORE_CAPTURE);

    // Freezes mid-transition so the panel's numbers match the pixels above them.
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(startButton(page, "Resume")).toBeVisible();

    // Shut on arrival: left open, the "All figures" disclosure would fill the
    // lower half of the frame and shrink the building to fit what's left.
    await page.locator(".statspanel .more").evaluate((details) => {
      (details as HTMLDetailsElement).open = false;
    });

    // The editor's monospace stack is the one font not already resolved by the
    // time the system UI face has loaded.
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: OUTPUT_PATH, fullPage: true, animations: "disabled" });

    await expect(await statistic(page, "Transported")).not.toHaveText("0");
  });
});
