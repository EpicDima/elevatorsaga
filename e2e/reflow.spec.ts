/**
 * Reflow on a phone-sized screen (WCAG 1.4.10). The help pages are swept at
 * 320px/390px against the built site, since what overflows (a fixed-width
 * table, a row of buttons that won't wrap) isn't visible in CSS alone. The
 * game page instead has a hard floor (`min-inline-size`/`min-block-size` on
 * `body.app`) as its minimum supported viewport, checked separately below.
 */

import { expect, test } from "@playwright/test";

import { openSettingsMenu } from "./game-page.ts";

/**
 * The help pages the build emits, measured separately: Russian prose runs
 * perceptibly longer than the English it's translated from, so one page
 * fitting isn't evidence about the other.
 */
const PAGES = [
  { name: "the help page", path: "/documentation.html" },
  { name: "the Russian help page", path: "/documentation.ru.html" },
] as const;

/** Viewport widths a phone reader is likely to arrive with. */
const WIDTHS = [320, 390] as const;

for (const { name, path } of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} fits a ${String(width)}px screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);

      // A page that fits by hiding an example's tail behind its own scrollbar
      // has only moved the panning somewhere smaller.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("pre code")]
          .filter((sample) => sample.scrollWidth > sample.clientWidth)
          .map((sample) => sample.textContent.slice(0, 40)),
      );
      expect(clipped).toEqual([]);
    });
  }
}

/** 1040x600 is the smallest viewport the page promises to fit without overflow. */
test("the game fits its own 1040x600 floor", async ({ page }) => {
  await page.setViewportSize({ width: 1040, height: 600 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

/**
 * The app bar's popovers overflow downward without widening the column above,
 * and `body.app`'s `overflow: hidden` means a popover past the window's
 * bottom is simply unreachable - no wheel, no key, no scrollbar reaches it.
 */
test.describe("at that floor, the app bar's popovers", () => {
  test.use({ viewport: { width: 1040, height: 600 } });

  test("open the level list inside the window, last tile and all", async ({ page }) => {
    // The sandbox route draws every block, so the popover is at its tallest.
    await page.goto("/#level=sandbox");
    await page.locator(".task-open").click();

    const menu = page.locator(".taskmenu");
    await expect(menu).toBeVisible();
    await expect(menu).toBeInViewport({ ratio: 1 });

    // Inside the window isn't enough alone: clipping its own tail would also
    // fit. The sandbox tile is last, so scrolling to the end must reveal it.
    await menu.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.locator(`.taskmenu a.tasklink[href="#level=sandbox"]`)).toBeInViewport({
      ratio: 1,
    });
  });

  // Russian, since the seed disclosure's prose runs longer there.
  for (const [language, hash] of [
    ["English", "#level=sandbox"],
    ["Russian", "#level=sandbox,lang=ru"],
  ] as const) {
    test(`open the settings in ${language} inside the window, seed block open`, async ({
      page,
    }) => {
      await page.goto(`/${hash}`);
      await openSettingsMenu(page);

      const menu = page.locator(".setmenu");
      await expect(menu).toBeVisible();
      await menu
        .locator("details")
        .first()
        .evaluate((element: HTMLDetailsElement) => {
          element.open = true;
        });

      await expect(menu).toBeInViewport({ ratio: 1 });
      // The About block at the foot is what the overflow put out of reach.
      await menu.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(menu.locator(".setlink").last()).toBeInViewport({ ratio: 1 });
    });
  }
});
