/**
 * Reflow on a phone-sized screen (WCAG 1.4.10).
 *
 * Neither page may ask to be read by panning in two directions at 320px, the
 * width the success criterion names, or at 390px, which is what most phones in
 * use actually report. This is a browser question rather than a stylesheet one
 * -- what overflowed was a table whose columns were pinned in pixels and a row
 * of buttons that would not wrap, and neither is visible in the CSS on its own
 * -- so it is checked here, against the built site, rather than in Vitest.
 *
 * The building is deliberately not part of it: `.world` is a fixed-scale scene
 * in its own `overflow-x: auto` box and pans on its own axis, which is the
 * two-dimensional-content exception the criterion makes for diagrams.
 */

import { expect, test } from "@playwright/test";

/**
 * The pages the build emits, by the path they are served from.
 *
 * The translated page is measured separately rather than assumed to behave like
 * the one it was translated from. Russian prose runs perceptibly longer than the
 * English it renders — the words are longer and fewer of them break — so the
 * page that fits is not evidence about the page beside it, and the table of API
 * descriptions is exactly where that difference lands.
 */
const PAGES = [
  { name: "the game", path: "/" },
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

      // The document itself: how much wider than the screen it wants to be.
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);

      // And the code samples, which is where the width went: a page that fits
      // by hiding the tail of every example behind a scrollbar of its own has
      // only moved the panning somewhere smaller.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("pre code")]
          .filter((sample) => sample.scrollWidth > sample.clientWidth)
          .map((sample) => sample.textContent.slice(0, 40)),
      );
      expect(clipped).toEqual([]);
    });
  }
}

/**
 * A seed as long as a URL can carry one.
 *
 * `#seed=` takes whatever string is in the address, not the ten digits this game
 * happens to draw, and a seed arrives by being pasted from somewhere else at
 * least as often as it is drawn here. Sixty-four unbreakable characters is a
 * hash, which is what a program that generates seeds tends to hand out.
 */
const LONG_SEED = "a".repeat(64);

/**
 * The states the challenge bar's seed line has, as the hashes that produce them.
 *
 * The line changes shape with the run rather than staying one width: it offers
 * the seed as a link while nothing is pinned, offers "new draw" once something
 * is, and holds a paragraph of prose whenever the player opens the explanation.
 * The default state fitting says nothing about the other two, and it is the
 * other two that carry the long text.
 */
const SEED_STATES = [
  { name: "a run nothing has pinned", hash: "#challenge=4", open: false },
  {
    name: "a pinned run with a 64-character seed",
    hash: `#challenge=4,seed=${LONG_SEED}`,
    open: false,
  },
  { name: "that seed with the caveat open", hash: `#challenge=4,seed=${LONG_SEED}`, open: true },
] as const;

for (const { name, hash, open } of SEED_STATES) {
  for (const width of WIDTHS) {
    test(`the seed line fits a ${String(width)}px screen showing ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${hash}`);
      await expect(page.locator(".challengeseed")).toBeVisible();
      if (open) {
        await page.locator(".seedhelp > summary").click();
        await expect(page.locator(".seedcaveat")).toBeVisible();
      }

      const measurements = await page.evaluate(() => {
        const root = document.documentElement;
        const line = document.querySelector(".challengeseed");
        return {
          // The page, which is what the criterion is about: an unbreakable
          // 64-character seed is 548px of monospace, and before the line was
          // allowed to break one it took the whole document sideways with it.
          overflow: root.scrollWidth - root.clientWidth,
          // And the line itself, so that "fits" cannot be satisfied by an
          // ancestor quietly clipping the tail of the seed off the screen.
          rightEdge: Math.round(line.getBoundingClientRect().right),
          viewport: root.clientWidth,
        };
      });

      expect(measurements.overflow).toBeLessThanOrEqual(0);
      expect(measurements.rightEdge).toBeLessThanOrEqual(measurements.viewport);
    });
  }
}
