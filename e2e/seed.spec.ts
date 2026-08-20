/**
 * The seed of a run, from the settings popover to the address bar and back.
 *
 * `src/pages/game/index.test.ts` proves most of this against a jsdom document,
 * which is enough for the wiring. What it cannot prove is the part that belongs
 * to the browser: that a real anchor with a hash `href` navigates, that
 * navigating fires `hashchange` rather than reloading, that the router hears it,
 * and that a real `<input>` commits on Enter. Those are the whole mechanism by
 * which a player chooses a run, and jsdom implements each of them
 * approximately.
 */

import { expect, test } from "@playwright/test";

import { openSettingsMenu, speedValue, unlockLevel } from "./game-page.ts";

/**
 * The level every test below runs the seed against: busy enough that a run
 * goes somewhere, and far enough along that a browser which has cleared
 * nothing cannot open it — hence the {@link unlockLevel} before each `goto`,
 * without which the router would answer with level 1 and every address
 * asserted here would be the wrong one.
 */
const SEEDED_LEVEL = 4;

/**
 * The seed block now lives in the app bar's settings popover
 * (`widgets/app-bar`'s `.setmenu`), behind `.setopen`, rather than in the
 * level bar's old `.levelseed`: `presentLevel`/`levelTemplate`
 * are unwired, so `.levelseed` never reaches the document any more, and
 * `seedPanelTemplate` reuses every one of these class names verbatim without
 * a second copy to disambiguate against — see that module's own comment.
 * Every test below opens the popover with {@link openSettingsMenu} before
 * reading or clicking any of them.
 */
const SEED_LINK = ".setmenu .seedlink";

/**
 * The seed itself, in the row's own box — an `<input>`, so it is read with
 * `inputValue`/`toHaveValue` and never with `innerText`.
 *
 * It was a read-only `<span>` for as long as a seed was drawn for the player
 * rather than chosen by them. Both of the row's controls carry no text at all,
 * so this is still the only place the seed is written down on screen.
 */
const SEED_VALUE = ".setmenu .seedvalue";

/** The dice: a `<button>` that draws a seed, not a link to an address. */
const NEW_DRAW = ".setmenu .seednewdraw";

/** The disclosure that explains what a seed does, and the sentence inside it. */
const HELP_SUMMARY = ".setmenu .seedhelp > summary";
const CAVEAT = ".setmenu .seedcaveat";

test("puts the run a player is looking at in the address bar, and replays it on reload", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,timescale=8");
  await openSettingsMenu(page);

  const seedLink = page.locator(SEED_LINK);
  await expect(seedLink).toBeVisible();
  const seed = (await page.locator(SEED_VALUE).inputValue()).trim();
  expect(seed).not.toBe("");

  // The link carries the rest of the URL, so naming the seed does not throw
  // away the level or the speed the player had chosen.
  await expect(seedLink).toHaveAttribute("href", `#level=4,timescale=8,seed=${seed}`);

  await seedLink.click();
  await expect(page).toHaveURL(new RegExp(`#level=4,timescale=8,seed=${seed}$`));

  // `App.onSeedChange` fires from `#drawLevelBar`, which the router's own
  // `hashchange` handling reaches on every navigation including this one, so
  // the panel is redrawn without a reload -- on the same seed, since the click
  // asked for the run already playing.
  await expect(page.locator(SEED_VALUE)).toHaveValue(seed);
  // Both controls stay: they no longer name two states of one run, they name
  // two different things to do.
  await expect(page.locator(SEED_LINK)).toBeVisible();
  await expect(page.locator(NEW_DRAW)).toBeVisible();

  // A reload is the replay itself, and the case the feature exists for: the
  // player comes back to the run they were failing on rather than to a fresh
  // one. Kept as its own assertion, distinct from the live update above,
  // since a page freshly loaded builds the popover from `app.currentSeedLink`
  // directly rather than through `onSeedChange` -- both paths have to agree.
  await page.reload();
  await openSettingsMenu(page);
  await expect(page.locator(SEED_VALUE)).toHaveValue(seed);

  expect(pageErrors).toEqual([]);
});

test("plays the seed a player types into the field", async ({ page }) => {
  // The gesture the row was rebuilt around, and the one jsdom cannot vouch for:
  // Enter in a text field outside any `<form>` is what commits the value, and
  // whether `change` fires there at all is the browser's business.
  await unlockLevel(page, SEEDED_LEVEL);
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
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,seed=issue-61");
  await openSettingsMenu(page);

  await page.locator(SEED_VALUE).fill("rush hour");
  await page.locator(SEED_VALUE).press("Enter");

  // No navigation, and the field says so itself: `pattern` marks it invalid and
  // the presenter puts the reason on it, in the player's own language.
  await expect(page).toHaveURL(/#level=4,seed=issue-61$/);
  await expect(page.locator(SEED_VALUE)).toHaveJSProperty(
    "validationMessage",
    "A seed can be up to 64 letters, digits, dots, hyphens or underscores.",
  );
});

test("draws a new seed from the dice and pins it in the address bar", async ({ page }) => {
  // The way out of a run that is not going anywhere. It used to be a link to
  // this address without `seed=`, which was a fresh draw only while a seedless
  // address meant one; the seed is the player's own now, so the draw happens
  // here and the address follows it.
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,timescale=8,seed=issue-61");
  await openSettingsMenu(page);
  await expect(page.locator(SEED_VALUE)).toHaveValue("issue-61");

  await page.locator(NEW_DRAW).click();

  await expect(page).toHaveURL(/#level=4,timescale=8,seed=\w+$/);
  await expect(page).not.toHaveURL(/seed=issue-61$/);
  // The speed the player chose came along, exactly as it does through the
  // navigation row.
  await expect(speedValue(page)).toHaveText("8x");
  await expect(page.locator(SEED_VALUE)).not.toHaveValue("issue-61");

  // And the browser's own way back reaches the earlier run again, because
  // every one of these moves is a real navigation.
  await page.goBack();
  await expect(page).toHaveURL(/#level=4,timescale=8,seed=issue-61$/);
  await expect(page.locator(SEED_VALUE)).toHaveValue("issue-61");
});

test("opens the caveat from the keyboard", async ({ page }) => {
  // The sentence about what a seed does and does not bring back used to be a
  // `title` attribute, which is to say a mouse-only tooltip. This is the path it
  // was missing: no pointer at all.
  //
  // Run at the page's own width rather than at WCAG 1.4.10's narrowest named
  // screen, the way this test used to: per decision #1 (see the migration
  // plan's own §0), the main game page adopted `design/ui-mockup.html`'s own
  // 1040x600 floor instead of reflowing for a phone, so 320px is no longer a
  // width it promises to fit -- `reflow.spec.ts` holds that floor. The keyboard
  // path itself has nothing to do with viewport width, so it is still worth
  // its own test.
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4");
  await openSettingsMenu(page);

  await expect(page.locator(CAVEAT)).toBeHidden();

  // Reached by tabbing from the last of the row's controls rather than focused
  // directly: "can be focused" and "is in the tab order" are different
  // questions, and it was the second one that had no answer before.
  await page.locator(SEED_LINK).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(HELP_SUMMARY)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(CAVEAT)).toBeVisible();
  await expect(page.locator(CAVEAT)).toContainText("played the same way");
});

/**
 * "Does not move the caveat's own control when it is opened" used to sweep
 * 1280px down to 320px looking for the widths where the level bar
 * rearranges itself -- 960 and 660 were each just inside a rearrangement, 320
 * was where the seed line itself wrapped -- and assert the disclosure's own
 * `<summary>` held still, or moved a known amount, at each one.
 *
 * It was removed once already, not because decision #1's floor covers it --
 * 1280 (this suite's own default viewport) and 1040 (the floor's own edge)
 * are both still fully supported widths, and the bug this test caught (a
 * `[open] { flex-basis: 100% }` rule dragging the disclosure's `<summary>`
 * out from under the player's pointer) has nothing to do with the width being
 * narrow. It was removed because `widgets/workspace-layout`'s shell, mounted
 * live for the first time in that commit, had no pane-splitting stylesheet of
 * its own yet, so every region it wrapped stacked full height instead of side
 * by side, and opening the disclosure moved the summary by over 2000px, not
 * the hundred or so pixels the old bug moved it by.
 *
 * `widgets/workspace-layout`'s pane-splitting stylesheet landed a phase later
 * -- `.workspace`/`.pane`/`.splitter`, now in
 * `src/widgets/workspace-layout/ui/workspace-layout.css` -- but that
 * alone was not enough: the seed block itself had also moved, from the
 * level bar's `.levelseed` (styled) into the app bar's settings
 * popover, and `.setmenu`/`.setwrap` carried no rule of their own yet, so it
 * rendered in normal document flow and reshuffled the whole page around
 * itself opening the caveat did -- the same 2000px-class jump, for the same
 * missing-`position: absolute` reason, one level up.
 *
 * `.setwrap`/`.setmenu`'s own positioning has since been ported from
 * `design/ui-mockup.html` into `src/widgets/app-bar/ui/settings-menu.css`, so
 * the popover is now a fixed-size overlay the disclosure
 * opens inside rather than a block that reshuffles the page under itself.
 * Un-`fixme`d and confirmed passing at both widths below.
 */
test("does not move the caveat's own control when it is opened", async ({ page }) => {
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4");

  for (const width of [1280, 1040]) {
    await page.setViewportSize({ width, height: 900 });
    await openSettingsMenu(page);
    const summary = page.locator(HELP_SUMMARY);
    const before = await summary.boundingBox();
    if (before === null) {
      throw new Error(`The caveat's control has no box at ${String(width)}px`);
    }

    await summary.click();
    await expect(page.locator(CAVEAT)).toBeVisible();
    const after = await summary.boundingBox();
    if (after === null) {
      throw new Error(
        `The caveat's control lost its box at ${String(width)}px, after being opened`,
      );
    }

    expect(Math.abs(after.x - before.x), `x at ${String(width)}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - before.y), `y at ${String(width)}px`).toBeLessThanOrEqual(2);

    // Back to collapsed, so the next width starts from the same state this
    // one did.
    await summary.click();
  }
});

/**
 * `.cap` and `.seedhelp > summary` used to measure `rgb(255, 255, 255)` on
 * this page's `rgb(191, 189, 159)` body -- the exact 1.91:1-class failure
 * this test was written to catch, reappeared here because `.setblock`/
 * `.setmenu` carried none of `.levelseed`'s old `color: var(--color-text)`.
 * Verified live, not guessed: measured via `getComputedStyle` against the
 * real popover, forced open the same way every test above opens it.
 *
 * Fixed in `src/widgets/app-bar/ui/settings-menu.css` with
 * `color: var(--ds-text)` on `.setmenu` -- not `--color-text`, the token the
 * defect's own original fix used: `--color-text` is not theme-aware, and
 * paired with `--ds-panel`'s dark-theme value it holds at roughly 1.75:1,
 * worse than the bug. `--ds-text` is `--ds-panel`'s own matched companion
 * token, at roughly 14:1 in dark and higher still in light. See that CSS
 * section's own comment for the full account.
 *
 * `page_` (measured against `document.body`) is now `panel` (measured against
 * `.setmenu` itself): `.setmenu` gained its own opaque, positioned background
 * in the same change, so `document.body`'s background is no longer what a
 * reader actually sees behind this text -- `.setmenu` sits over it. Un-`fixme`d
 * and confirmed passing.
 *
 * The seed itself is measured against the field's own `--ds-bg` fill rather
 * than against the panel, because the field paints one: it is the one thing in
 * this block that is not read straight off `.setmenu`.
 */
test("keeps every word of the seed line readable", async ({ page }) => {
  // The seed line was a `<p>`, and `p` is one of the few selectors the
  // stylesheet paints with `--color-text`; it had to become a `<div>` to hold
  // the disclosure, and everything on it that is not a link fell back to
  // whatever was behind it -- 1.91:1 on this page at the time, where WCAG
  // 1.4.3 asks 4.5:1. The characters that went pale were the ones a player
  // transcribes.
  //
  // Measured here rather than in the `*.css.test.ts` file beside each slice's
  // stylesheet, which check that the palette's pairs are legible but not which
  // elements ask for them: this failure was an element quietly asking for
  // neither.
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,seed=issue-61");
  await openSettingsMenu(page);
  await page.locator(HELP_SUMMARY).click();

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
    // The seed block is one `.setblock` among several the settings popover
    // holds (theme, layout, language, seed, hotkeys, about); found by the
    // one child every other `.setblock` lacks rather than by position, which
    // `appBarSettingsTemplate` makes no promise about.
    const line = document.querySelector(".setmenu .seedvalue")?.closest(".setblock") ?? null;
    const found: Record<string, number> = {};
    for (const selector of [
      ".cap",
      ".seedvalue",
      ".seedlink",
      ".seednewdraw",
      ".seedhelp > summary",
      ".seedcaveat",
    ]) {
      const element = line?.querySelector(selector) ?? null;
      if (element === null) {
        continue;
      }
      const style = getComputedStyle(element);
      // The field paints a fill of its own; everything else on the row is read
      // straight off the panel.
      const behind =
        style.backgroundColor === "rgba(0, 0, 0, 0)" ? panel : luminance(style.backgroundColor);
      found[selector] = ratio(luminance(style.color), behind);
    }
    return found;
  });

  // Both controls are icons, so 4.5:1 is stricter than WCAG asks of them --
  // 1.4.11 wants 3:1 of a glyph -- but they inherit `.ghost`'s own text colour
  // and there is no reason to hold them to less than the words beside them.
  expect(Object.keys(measured)).toEqual([
    ".cap",
    ".seedvalue",
    ".seedlink",
    ".seednewdraw",
    ".seedhelp > summary",
    ".seedcaveat",
  ]);
  for (const [selector, found] of Object.entries(measured)) {
    expect(found, selector).toBeGreaterThanOrEqual(4.5);
  }
});

test("keeps the player's own seed across a reload that names none", async ({ page }) => {
  // The reversal this feature turns on. A seedless URL used to mean "draw one",
  // so a reload dealt a different building; it means "whatever I am playing"
  // now, and the way to a different one is the dice. `handleRoute`'s own comment
  // records the whole of the decision and why it was reversed rather than
  // worked around.
  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4");
  await openSettingsMenu(page);
  const first = await page.locator(SEED_VALUE).inputValue();
  expect(first).not.toBe("");

  await page.reload();
  await openSettingsMenu(page);

  await expect(page.locator(SEED_VALUE)).toHaveValue(first);
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

  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,seed=issue-61");

  const seedLine = logs.find((line) => line.includes("issue-61"));
  expect(seedLine).toBeDefined();
  // Absolute, because a console line cannot be copied as a link -- the whole
  // point is that it can be pasted somewhere else and still work.
  expect(seedLine).toContain(`${new URL(page.url()).origin}/#level=4,seed=issue-61`);
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

  await unlockLevel(page, SEEDED_LEVEL);
  await page.goto("/#level=4,seed=rush hour");
  await openSettingsMenu(page);

  await expect(page.locator(SEED_LINK)).toBeVisible();
  await expect(page.locator(SEED_VALUE)).not.toHaveValue(/rush/);
  expect(warnings.some((warning) => warning.includes("Invalid seed"))).toBe(true);
});
