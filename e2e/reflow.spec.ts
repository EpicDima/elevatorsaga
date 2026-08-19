/**
 * Reflow on a phone-sized screen (WCAG 1.4.10) -- and, for the main game
 * page only, the hard floor it adopted instead.
 *
 * The two help pages may not ask to be read by panning in two directions at
 * 320px, the width the success criterion names, or at 390px, which is what
 * most phones in use actually report. This is a browser question rather than
 * a stylesheet one -- what overflowed was a table whose columns were pinned
 * in pixels and a row of buttons that would not wrap, and neither is visible
 * in the CSS on its own -- so it is checked here, against the built site,
 * rather than in Vitest.
 *
 * The main game page is checked differently, per decision #1 of the
 * FSD/mockup-port migration (see the migration plan's own §0): a building
 * pane and a code pane side by side need more room than a phone screen has
 * to give, and shrinking them to fit was never asked for, so the page adopts
 * `design/ui-mockup.html`'s own hard floor -- `body { min-inline-size:
 * 1040px; min-block-size: 600px }`, in `src/styles/style.css` -- as its
 * minimum supported viewport instead of reflowing under it. What is checked
 * below, in place of the 320/390px sweep the other two pages still get, is
 * that the floor holds: the page fits without horizontal overflow exactly at
 * 1040x600, the smallest viewport it now promises to support. The seed
 * line's own narrow-width checks and the Russian game page's are gone for
 * the same reason -- both only ever existed to cover widths this page no
 * longer offers to support.
 *
 * The building is deliberately not part of either check: `.world` is a
 * fixed-scale scene in its own `overflow-x: auto` box and pans on its own
 * axis, which is the two-dimensional-content exception the criterion makes
 * for diagrams.
 */

import { expect, test } from "@playwright/test";

/**
 * The help pages the build emits, by the path they are served from.
 *
 * The translated page is measured separately rather than assumed to behave like
 * the one it was translated from. Russian prose runs perceptibly longer than the
 * English it renders — the words are longer and fewer of them break — so the
 * page that fits is not evidence about the page beside it, and the table of API
 * descriptions is exactly where that difference lands.
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
 * The main game page's own floor (decision #1), rather than the 320/390px
 * sweep the two help pages above still get.
 *
 * 1040x600 is the smallest viewport the page now promises to fit -- see the
 * file's own doc comment -- so what is worth checking is not a range of
 * widths but that this one, the edge of what `src/styles/style.css` allows
 * the viewport to shrink to, does not itself overflow.
 */
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
