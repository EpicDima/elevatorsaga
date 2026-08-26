/**
 * The seed of a run, from the settings popover to the address bar and back.
 * jsdom proves the wiring; this proves the actual browser mechanism - real
 * navigation, hashchange, and Enter committing an input. Uses `#level=4`
 * throughout, a non-default level, so an asserted address is one the router had to keep.
 */

import { expect, test } from "@playwright/test";

import { openSettingsMenu, speedValue } from "./game-page.ts";

/** The seed row's link, in the settings popover's `.setmenu`. */
const SEED_LINK = ".setmenu .seedlink";

/** The seed's own input; read with `inputValue`/`toHaveValue`, never `innerText`. */
const SEED_VALUE = ".setmenu .seedvalue";

/** The dice: a `<button>` that draws a seed, not a link to an address. */
const NEW_DRAW = ".setmenu .seednewdraw";

test("puts the run a player is looking at in the address bar, and replays it on reload", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#level=4,timescale=8");
  await openSettingsMenu(page);

  const seedLink = page.locator(SEED_LINK);
  await expect(seedLink).toBeVisible();
  const seed = (await page.locator(SEED_VALUE).inputValue()).trim();
  expect(seed).not.toBe("");

  // The link carries the rest of the URL, so naming the seed keeps the level and speed too.
  await expect(seedLink).toHaveAttribute("href", `#level=4,timescale=8,seed=${seed}`);

  await seedLink.click();
  await expect(page).toHaveURL(new RegExp(`#level=4,timescale=8,seed=${seed}$`));

  // Fires from the router's hashchange handling, so the panel redraws without
  // a reload, on the seed already playing.
  await expect(page.locator(SEED_VALUE)).toHaveValue(seed);
  // Both controls stay: they name two different things now, not two states of one run.
  await expect(page.locator(SEED_LINK)).toBeVisible();
  await expect(page.locator(NEW_DRAW)).toBeVisible();

  // A reload replays the run instead of starting fresh - the feature's whole
  // point. Kept as its own assertion since a fresh load builds the popover
  // differently than a live update does; both paths must agree.
  await page.reload();
  await openSettingsMenu(page);
  await expect(page.locator(SEED_VALUE)).toHaveValue(seed);

  expect(pageErrors).toEqual([]);
});

test("plays the seed a player types into the field", async ({ page }) => {
  // The gesture the row was built around, and what jsdom can't vouch for:
  // Enter in a text field outside any <form> is what commits the value.
  await page.goto("/#level=4,timescale=8");
  await openSettingsMenu(page);

  await page.locator(SEED_VALUE).fill("hand-picked");
  await page.locator(SEED_VALUE).press("Enter");

  await expect(page).toHaveURL(/#level=4,timescale=8,seed=hand-picked$/);
  await expect(page.locator(SEED_VALUE)).toHaveValue("hand-picked");
  // The speed came along, exactly as it does through the navigation row.
  await expect(speedValue(page)).toHaveText("8x");
});

test("refuses a typed seed the address bar could not carry, and stays where it was", async ({
  page,
}) => {
  await page.goto("/#level=4,seed=issue-61");
  await openSettingsMenu(page);

  await page.locator(SEED_VALUE).fill("rush hour");
  await page.locator(SEED_VALUE).press("Enter");

  // No navigation; the field itself explains why via its own validation message.
  await expect(page).toHaveURL(/#level=4,seed=issue-61$/);
  await expect(page.locator(SEED_VALUE)).toHaveJSProperty(
    "validationMessage",
    "A seed can be up to 64 letters, digits, dots, hyphens or underscores.",
  );
});

test("draws a new seed from the dice and pins it in the address bar", async ({ page }) => {
  // The way out of a run going nowhere. The draw itself now updates the
  // address, since a seedless URL no longer means "fresh draw."
  await page.goto("/#level=4,timescale=8,seed=issue-61");
  await openSettingsMenu(page);
  await expect(page.locator(SEED_VALUE)).toHaveValue("issue-61");

  await page.locator(NEW_DRAW).click();

  await expect(page).toHaveURL(/#level=4,timescale=8,seed=\w+$/);
  await expect(page).not.toHaveURL(/seed=issue-61$/);
  // The speed came along too, through the same navigation.
  await expect(speedValue(page)).toHaveText("8x");
  await expect(page.locator(SEED_VALUE)).not.toHaveValue("issue-61");

  // Back reaches the earlier run too, since every move here is a real navigation.
  await page.goBack();
  await expect(page).toHaveURL(/#level=4,timescale=8,seed=issue-61$/);
  await expect(page.locator(SEED_VALUE)).toHaveValue("issue-61");
});

test("explains what a seed does on the field the player hovers", async ({ page }) => {
  // The tooltip itself is drawn outside the DOM, so the attribute a browser
  // builds it from is all there is to assert here.
  await page.goto("/#level=4");
  await openSettingsMenu(page);

  await expect(page.locator(SEED_VALUE)).toHaveAttribute("title", /played the same way/);
});

/**
 * Contrast is measured live via `getComputedStyle` against the real popover's
 * own background (`.setmenu`, which paints an opaque background of its own,
 * not `document.body`). The seed field is measured against its own fill
 * instead, since it paints one.
 */
test("keeps every word of the seed line readable", async ({ page }) => {
  // Checked here since the palette's own CSS tests don't know which elements use it.
  await page.goto("/#level=4,seed=issue-61");
  await openSettingsMenu(page);

  const measured = await page.evaluate(() => {
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
    const ratio = (one: number, other: number): number => {
      const [lighter, darker] = one > other ? [one, other] : [other, one];
      return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
    };
    const setmenu = document.querySelector(".setmenu");
    if (setmenu === null) {
      throw new Error("No .setmenu to measure the panel's own background from");
    }
    const panel = luminance(getComputedStyle(setmenu).backgroundColor);
    // The seed block is one of several `.setblock`s in the popover; found by
    // the one child no other `.setblock` has, since position isn't guaranteed.
    const line = document.querySelector(".setmenu .seedvalue")?.closest(".setblock") ?? null;
    const found: Record<string, number> = {};
    for (const selector of [".cap", ".seedvalue", ".seedlink", ".seednewdraw"]) {
      const element = line?.querySelector(selector) ?? null;
      if (element === null) {
        continue;
      }
      const style = getComputedStyle(element);
      // The field paints its own fill; everything else on the row reads off the panel.
      const behind =
        style.backgroundColor === "rgba(0, 0, 0, 0)" ? panel : luminance(style.backgroundColor);
      found[selector] = ratio(luminance(style.color), behind);
    }
    return found;
  });

  // Icons only need WCAG's 3:1, but they inherit `.ghost`'s text color, so
  // there's no reason to hold them to a lower bar than the words beside them.
  expect(Object.keys(measured)).toEqual([".cap", ".seedvalue", ".seedlink", ".seednewdraw"]);
  for (const [selector, found] of Object.entries(measured)) {
    expect(found, selector).toBeGreaterThanOrEqual(4.5);
  }
});

test("keeps the player's own seed across a reload that names none", async ({ page }) => {
  // A seedless URL used to mean "draw one"; now it means "whatever I'm
  // playing" - the dice is the way to get a different one.
  await page.goto("/#level=4");
  await openSettingsMenu(page);
  const first = await page.locator(SEED_VALUE).inputValue();
  expect(first).not.toBe("");

  await page.reload();
  await openSettingsMenu(page);

  await expect(page.locator(SEED_VALUE)).toHaveValue(first);
});

test("prints the seed and a whole URL to the console as a run starts", async ({ page }) => {
  // Makes a run recoverable after it's gone wrong - the only time anyone
  // wants this - since the address bar may have already moved on by then.
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "log") {
      logs.push(message.text());
    }
  });

  await page.goto("/#level=4,seed=issue-61");

  const seedLine = logs.find((line) => line.includes("issue-61"));
  expect(seedLine).toBeDefined();
  // Absolute: a console line can't be copied as a link, so it must work pasted elsewhere.
  expect(seedLine).toContain(`${new URL(page.url()).origin}/#level=4,seed=issue-61`);
});

test("refuses a seed the address bar would have mangled", async ({ page }) => {
  // A browser percent-encodes a space in location.hash, so a URL with one
  // would name a different run than the one shared; refusing it is honest, repairing it isn't.
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });

  await page.goto("/#level=4,seed=rush hour");
  await openSettingsMenu(page);

  await expect(page.locator(SEED_LINK)).toBeVisible();
  await expect(page.locator(SEED_VALUE)).not.toHaveValue(/rush/);
  expect(warnings.some((warning) => warning.includes("Invalid seed"))).toBe(true);
});
