/**
 * The seed of a run, from the bar to the address bar and back.
 *
 * `src/app/app.test.ts` proves all of this against a jsdom document, which is
 * enough for the wiring. What it cannot prove is the part that belongs to the
 * browser: that a real anchor with a hash `href` navigates, that navigating
 * fires `hashchange` rather than reloading, and that the router hears it. Those
 * three are the whole mechanism by which a player pins a run, and jsdom
 * implements each of them approximately.
 */

import { expect, test } from "@playwright/test";

/** The seed shown in the challenge bar, while following it still pins the run. */
const SEED_LINK = ".seedlink";

/** The seed shown in the challenge bar once the URL pins it, as plain text. */
const SEED_VALUE = ".seedvalue";

/** The way back out of a pinned run. */
const NEW_DRAW_LINK = ".seednewdraw";

/** The disclosure that explains what a seed does, and the sentence inside it. */
const HELP_SUMMARY = ".seedhelp > summary";
const CAVEAT = ".seedcaveat";

test("pins the run a player is looking at, and replays it on reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#challenge=4,timescale=8");

  const seedLink = page.locator(SEED_LINK);
  await expect(seedLink).toBeVisible();
  const seed = (await seedLink.innerText()).trim();
  expect(seed).not.toBe("");

  // The link carries the rest of the URL, so pinning the seed does not throw
  // away the challenge or the speed the player had chosen.
  await expect(seedLink).toHaveAttribute("href", `#challenge=4,timescale=8,seed=${seed}`);

  await seedLink.click();
  await expect(page).toHaveURL(new RegExp(`#challenge=4,timescale=8,seed=${seed}$`));

  // The run that started is the one that was on screen. What the bar offers now
  // is the way back out: following the seed again would go where the page
  // already is, so the seed is text and the link beside it undoes the pin.
  await expect(page.locator(SEED_VALUE)).toHaveText(seed);
  await expect(page.locator(SEED_LINK)).toHaveCount(0);
  await expect(page.locator(NEW_DRAW_LINK)).toHaveAttribute("href", "#challenge=4,timescale=8");

  // A reload is the case the feature exists for: the player comes back to the
  // building they were failing on rather than to a fresh one.
  await page.reload();
  await expect(page.locator(SEED_VALUE)).toHaveText(seed);

  expect(pageErrors).toEqual([]);
});

test("lets a pinned run go back to a fresh draw, and back again", async ({ page }) => {
  // The other half of the one-way door: pinning costs one click, so unpinning
  // has to, or the address bar is the only way out of the run a player pinned.
  await page.goto("/#challenge=4,timescale=8,seed=issue-61");
  await expect(page.locator(SEED_VALUE)).toHaveText("issue-61");

  await page.locator(NEW_DRAW_LINK).click();

  await expect(page).toHaveURL(/#challenge=4,timescale=8$/);
  const drawn = await page.locator(SEED_LINK).innerText();
  expect(drawn).not.toBe("issue-61");
  // The speed the player chose came along, exactly as it does through the
  // navigation row.
  await expect(page.locator(".timescale_value")).toHaveText("8x");

  // And the browser's own way back reaches the pinned run again, because every
  // one of these moves is a real navigation.
  await page.goBack();
  await expect(page.locator(SEED_VALUE)).toHaveText("issue-61");
});

test("opens the caveat from the keyboard, on a phone-sized screen", async ({ page }) => {
  // The sentence about what a seed does and does not bring back used to be a
  // `title` attribute, which is to say a mouse-only tooltip. This is the path it
  // was missing: no pointer at all, and the narrowest screen WCAG 1.4.10 names.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#challenge=4");

  await expect(page.locator(CAVEAT)).toBeHidden();

  // Reached by tabbing from the seed rather than focused directly: "can be
  // focused" and "is in the tab order" are different questions, and it was the
  // second one that had no answer before.
  await page.locator(SEED_LINK).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(HELP_SUMMARY)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(CAVEAT)).toBeVisible();
  await expect(page.locator(CAVEAT)).toContainText("never quite the same twice");

  // Open, it is a whole sentence of prose in a control strip; if it will not
  // wrap into 320px the page has to be read by panning sideways.
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);

  // The bar is rebuilt from scratch whenever a run starts, and pinning the seed
  // starts one. An explanation that closes itself while the player is reading it
  // is one they have to open again to finish the sentence.
  await page.locator(SEED_LINK).click();
  await expect(page.locator(NEW_DRAW_LINK)).toBeVisible();
  await expect(page.locator(CAVEAT)).toBeVisible();
});

test("keeps every word of the seed line readable, in both of its states", async ({ page }) => {
  // The seed line was a `<p>`, and `p` is one of the few selectors the
  // stylesheet paints with `--color-text`; it had to become a `<div>` to hold
  // the disclosure, and everything on it that is not a link fell back to the
  // `color: white` on `<body>` -- 1.91:1 on this page, where WCAG 1.4.3 asks
  // 4.5:1. The characters that went pale were the ones a player transcribes.
  //
  // Measured here rather than in `src/styles/style.test.ts`, which checks that
  // the palette's pairs are legible but not which elements ask for them: this
  // failure was an element quietly asking for neither.
  const contrasts = async (): Promise<Record<string, number>> =>
    page.evaluate(() => {
      const channel = (value: number): number =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      const luminance = (color: string): number => {
        const [red = 0, green = 0, blue = 0] = [...color.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
          Number(match[0]),
        );
        return (
          0.2126 * channel(red / 255) + 0.7152 * channel(green / 255) + 0.0722 * channel(blue / 255)
        );
      };
      const page_ = luminance(getComputedStyle(document.body).backgroundColor);
      const measured: Record<string, number> = {};
      for (const selector of [
        ".seedlabel",
        ".seedvalue",
        ".seedlink",
        ".seednewdraw",
        ".seedhelp > summary",
        ".seedcaveat",
      ]) {
        const element = document.querySelector(selector);
        if (element === null) {
          continue;
        }
        const text = luminance(getComputedStyle(element).color);
        const [lighter, darker] = text > page_ ? [text, page_] : [page_, text];
        measured[selector] = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
      }
      return measured;
    });

  // Unpinned: the seed is a link, the label and the disclosure are not.
  await page.goto("/#challenge=4");
  await page.locator(HELP_SUMMARY).click();
  const unpinned = await contrasts();
  expect(Object.keys(unpinned)).toContain(".seedlink");
  for (const [selector, ratio] of Object.entries(unpinned)) {
    expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
  }

  // Pinned: the same characters, now plain text, which is the state that failed.
  await page.goto("/#challenge=4,seed=issue-61");
  await page.locator(HELP_SUMMARY).click();
  const pinned = await contrasts();
  expect(Object.keys(pinned)).toContain(".seedvalue");
  for (const [selector, ratio] of Object.entries(pinned)) {
    expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
  }
});

test("gives an unpinned run a fresh building on every reload", async ({ page }) => {
  // The counterpart, and the reason the seed is not remembered on its own: a
  // player stuck on a challenge has to be able to get another draw without
  // editing the address bar.
  await page.goto("/#challenge=4");
  const first = await page.locator(SEED_LINK).innerText();

  await page.reload();

  await expect(page.locator(SEED_LINK)).not.toHaveText(first);
});

test("prints the seed and a whole URL to the console as a run starts", async ({ page }) => {
  // What makes a run recoverable after it has gone wrong, which is the only
  // time anybody wants it: by then the bar has already moved on if the player
  // restarted, and this line is the remaining record.
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "log") {
      logs.push(message.text());
    }
  });

  await page.goto("/#challenge=4,seed=issue-61");

  const seedLine = logs.find((line) => line.includes("issue-61"));
  expect(seedLine).toBeDefined();
  // Absolute, because a console line cannot be copied as a link -- the whole
  // point is that it can be pasted somewhere else and still work.
  expect(seedLine).toContain(`${new URL(page.url()).origin}/#challenge=4,seed=issue-61`);
});

test("refuses a seed the address bar would have mangled", async ({ page }) => {
  // A browser percent-encodes a space on its way into location.hash, so a URL
  // written with one names a different building than the one that was shared.
  // Refusing it is the honest answer; repairing it would replay the wrong run.
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });

  await page.goto("/#challenge=4,seed=rush hour");

  await expect(page.locator(SEED_LINK)).toBeVisible();
  await expect(page.locator(SEED_LINK)).not.toHaveText(/rush/);
  expect(warnings.some((warning) => warning.includes("Invalid seed"))).toBe(true);
});
