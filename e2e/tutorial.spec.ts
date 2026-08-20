/**
 * The learning track's panel, in a browser.
 *
 * What the panel decides is already covered without one:
 * `src/widgets/tutorial-panel/ui/tutorial-panel.test.ts` draws every level and
 * presses everything it can press, and `src/pages/game/index.test.ts` proves the
 * wiring. What jsdom cannot answer is whether any of it is *visible*. It has no
 * layout, so it cannot tell an empty region that is hidden from one that leaves
 * a gap above the building, cannot say whether the answer under the third hint
 * fits the pane it is given, and cannot see that the region is announced as a
 * landmark a player can jump to. Those are the things measured here, in both
 * languages, because the Russian strings are materially longer than the English
 * they render and this panel is more prose than anything else on the page.
 */

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { editor, languagePicker, startButton } from "./game-page.ts";

/**
 * Where level 1 lives.
 *
 * The level switcher's first tutorial tile links here, and the test below
 * follows that tile rather than this constant. Everything else goes straight to
 * the address, because a level no tile points at can only be reached that way —
 * and because this is the address `router.ts` sends `#level=tutorial-9` and
 * every other wrong one on the track to.
 */
const FIRST_LEVEL = "/#level=tutorial-1";

/** A line only level 1's *starting* program has, and only in English. */
const LEVEL_1_MARKER = "this building has two floors";

/**
 * The same line of the same program, as a Russian reader is handed it.
 *
 * The programs on the track are catalogue messages like everything else a
 * player reads — `tutorial.level1.startingCode.code` — and the code inside them
 * is identical in every language, so what changes between this marker and the
 * one above is the comment and nothing else. Two markers rather than one
 * because the interesting failure is not an empty editor: it is an editor
 * holding the English program on a page that is otherwise entirely Russian.
 */
const LEVEL_1_MARKER_RU = "в этом доме два этажа";

/**
 * What level 1 is called, in both languages.
 *
 * The panel is named after the level it is teaching rather than after the
 * track, so these are also the name its landmark is announced under, and the
 * level the tests below open is level 1 unless they say otherwise.
 */
const LEVEL_1_TITLE = "The elevator that goes nowhere";
const LEVEL_1_TITLE_RU = "Лифт, который никуда не едет";

/**
 * The panel's landmark, by the name a screen reader announces it as.
 *
 * By role and name rather than by class, for the reason `game-page.ts` gives:
 * what is asserted is what a player can reach. A `<section>` that has lost its
 * name is not a region at all — it stops being announced and stops being
 * something to jump to, with nothing on screen changing.
 *
 * There is no one name the eight lessons share any more, so the default is
 * level 1's own title: naming the landmark after the track told a player who
 * jumped to it that they were on the track, which they knew, and left the
 * question they do have — which of the eight lessons is this — to be read off
 * the heading inside.
 *
 * @param page - The page under test.
 * @param name - The landmark's accessible name in the language on screen.
 * @returns The panel.
 */
function panel(page: Page, name = LEVEL_1_TITLE): Locator {
  return page.getByRole("region", { name });
}

/**
 * Switches the page to Russian through the control a player would use.
 *
 * @param page - The page under test.
 */
async function switchToRussian(page: Page): Promise<void> {
  await (await languagePicker(page)).selectOption("ru");
}

/**
 * One element's box, refusing to measure something that is not on screen.
 *
 * `boundingBox()` answers `null` for an element with no layout, and a test that
 * compares `null` against a number silently passes on the very failure it was
 * written for -- the card pushed under the building is also the card that has
 * been laid out to nothing.
 *
 * @param locator - The element to measure.
 * @param what - What it is, for the message if it is not there.
 * @returns Its box in page coordinates.
 */
async function boxOf(
  locator: Locator,
  what: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${what} has no box on screen`);
  }
  return box;
}

/**
 * Opens the level switcher's menu, where the track's levels are listed.
 *
 * Forced open rather than clicked, for the reason `openSettingsMenu` in
 * `game-page.ts` gives: a click toggles, and this is called on both sides of a
 * language change that redraws the switcher underneath it. The one click that
 * proves a player can open the menu at all is in the test below, made once.
 *
 * @param page - The page under test.
 */
async function openLevelMenu(page: Page): Promise<void> {
  await page.locator(".taskmenu").evaluate((menu) => {
    (menu as HTMLElement).hidden = false;
  });
}

test("opens the track from the level switcher, in the language on screen", async ({ page }) => {
  await page.goto("/");

  // The way in. The shell used to ship a "Learning track" link of its own in
  // the header, and the header is gone; the switcher's tutorial block is what
  // is left, and it is the only entrance that does not involve knowing to type
  // `#level=tutorial-1` into the address bar. That the tiles are built is
  // `level-switcher.test.ts`'s to prove and where they point is the level
  // menu model's; what neither can answer is whether a player can open the
  // menu and see them, and whether pressing one starts a level -- the layout,
  // the hash and the router are all outside jsdom, and a tile behind a menu
  // that will not open leaves the track exactly as undiscoverable as no tile
  // at all.
  // `exact`, because the menu this opens holds a tile for every other level
  // and "Level 1" is a prefix of "Level 10" and nine more.
  const opener = page.getByRole("button", { name: "Level 1", exact: true });
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");

  const english = page.getByRole("link", { name: "Tutorial level 1", exact: true });
  await expect(english).toBeVisible();

  await switchToRussian(page);

  // Still there under the longer label, on a switcher the language change
  // rebuilt from the catalogue rather than relabelled in place.
  await openLevelMenu(page);
  const link = page.getByRole("link", { name: "Учебный уровень 1", exact: true });
  await expect(link).toBeVisible();

  await link.click();

  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();
});

test("shows the panel on a level and nothing at all off it", async ({ page }) => {
  await page.goto(FIRST_LEVEL);

  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: LEVEL_1_TITLE })).toBeVisible();

  // And nothing at all about the track the level belongs to. The card used to
  // open on a row naming the track and counting the player's place in it, close
  // on a footnote counting the cleared levels again, and carry two buttons that
  // left the level between the two; the app bar's level switcher says all of
  // that already, so on the one surface whose whole job is the level in front of
  // the player none of it is left. Counted here rather than only in jsdom
  // because it is the rendered page that is asked, and a rule or a template that
  // put any of it back would be answered here whichever of the two did it.
  await expect(
    panel(page).locator(".tutorialposition, .tutorialsteps, .tutorialprogress, .tutorialtaken"),
  ).toHaveCount(0);
  await expect(panel(page).locator("button")).toHaveCount(1);

  // The region stays in the page shell on every other route, so the stylesheet
  // is what has to take it out of the flow: an empty block with margins is
  // still a 10px gap above the building on all nineteen levels and the
  // sandbox.
  await page.goto("/#level=1");
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".tutorial")).toHaveCSS("display", "none");
  expect(await page.locator(".tutorial").boundingBox()).toBeNull();
});

test("keeps the answer shut until a player asks for it", async ({ page }) => {
  await page.goto(FIRST_LEVEL);

  // Three hints and an explanation, every one of them closed: a level whose
  // answer is on screen before its goal has been read is not a level.
  await expect(panel(page).locator("details")).toHaveCount(4);
  await expect(panel(page).locator("details[open]")).toHaveCount(0);
  await expect(panel(page).locator(".tutorialsolution code")).toBeHidden();

  await panel(page).getByText("Hint 3", { exact: true }).click();

  const answer = panel(page).locator(".tutorialsolution code");
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("elevator.goToFloor(1);");
});

test("highlights the answer, marks the line it adds, and copies it to the clipboard", async ({
  page,
  context,
}) => {
  // What `src/ui/code-highlight.test.ts`, `src/ui/line-diff.test.ts` and
  // `src/ui/templates.test.ts` prove against jsdom: that the markup carries
  // `tok-*` classes and a `.tutoriallinechanged` mark, and that
  // `navigator.clipboard.writeText` is called at all. What only a real browser
  // answers is whether `code.css` and `tutorial-panel.css` really paint those
  // classes as anything
  // and whether the clipboard the button claims to have written to is the one
  // a player would paste from.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(FIRST_LEVEL);

  await panel(page).getByText("Hint 3", { exact: true }).click();

  const code = panel(page).locator(".tutorialsolution code");
  await expect(code).toBeVisible();
  expect(await code.locator("[class^='tok-']").count()).toBeGreaterThan(0);

  // The one line level 1 actually adds, marked rather than only named in the
  // hint's prose above it.
  const marked = code.locator(".tutoriallinechanged");
  await expect(marked).toHaveCount(1);
  await expect(marked).toHaveText("elevator.goToFloor(1);");

  const copyButton = panel(page).getByRole("button", { name: "Copy this program" });
  const status = panel(page).locator(".tutorialcopied");
  await expect(status).toHaveText("");

  await copyButton.click();

  await expect(status).toHaveText("Copied to your clipboard.");
  // Character for character against what is actually on screen, not a second
  // copy of the program kept by the test -- the same reason
  // `editor.spec.ts`'s paste test reads storage back rather than trusting the
  // keystrokes that produced it.
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(await code.evaluate((element) => element.textContent));
  expect(clipboard).toContain("elevator.goToFloor(1);");
});

test("hands the editor the program in the language the link asks for", async ({ page }) => {
  // `openTutorialBuffer` promises the starter "in the player's current
  // language", and this is the only place that promise can be measured whole:
  // the hash names a language, `resolveLocale` picks it, the Russian catalogue
  // is fetched as its own chunk, and only then is the level opened and the
  // getter on the table read. Every one of those steps is missing from jsdom,
  // and the last two are ordered -- the starter is written into storage as the
  // buffer opens, so a level that opened before the catalogue landed would keep
  // its English program for the rest of the run with the page around it in
  // Russian.
  await page.goto(`${FIRST_LEVEL},lang=ru`);
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();

  const russianEditor = editor(page, "Программа для лифтов");
  await expect(russianEditor).toContainText(LEVEL_1_MARKER_RU);
  await expect(russianEditor).not.toContainText(LEVEL_1_MARKER);
  // And it is still the program, not a translation of one: the line the level
  // is about survives the trip through the catalogue exactly as written.
  await expect(russianEditor).toContainText("elevator.goToFloor(0);");
});

test("starts the level again from the run controls without leaving the track", async ({ page }) => {
  await page.goto(FIRST_LEVEL);

  // Exactly one button on the page says this. The panel used to carry a second
  // one, which restarted the level without starting it, and two buttons under one
  // accessible name doing two things is WCAG 3.2.4 -- this row is in the app bar
  // above the panel, and the page never scrolls, so both were on screen at once.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Start over", exact: true }).click();

  // The same level, running: "Start over" is pressed by somebody who has decided
  // to go again, so it does not stop to ask a second time. `panel` finds it by
  // level 1's own name, so the panel being there is also the panel being drawn
  // for the level that was restarted rather than for another one.
  await expect(panel(page)).toBeVisible();
  await expect(startButton(page, "Pause")).toBeVisible();
  // And the button survives the restart it caused, so the focus never leaves it.
  // The panel is redrawn whole underneath, but the run controls are drawn once
  // for the life of the page and are not among the regions `#startRun` tears
  // down -- which is the whole reason they were moved out of the level bar.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toBeFocused();
});

test("draws the panel again in the language the picker asks for", async ({ page }) => {
  await page.goto(FIRST_LEVEL);
  await expect(panel(page)).toBeVisible();

  await switchToRussian(page);

  // The landmark's own name is the level's title, so the two are translated by
  // the same redraw or not at all -- and that they still agree is the one part
  // of this panel a sighted player cannot see.
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();
  await expect(page.getByRole("heading", { name: LEVEL_1_TITLE_RU })).toBeVisible();
  // And the prose under the heading, which is the bulk of what a language
  // change has to redraw here.
  await expect(
    panel(page, LEVEL_1_TITLE_RU).getByText("Подсказка 1", { exact: true }),
  ).toBeVisible();
});

test("paints the panel's own controls as dark as the prose around them", async ({ page }) => {
  // The defect written up at `.tutorialpanel`: <body> paints everything white,
  // and the document rules repair that for `p` and the headings only. A
  // `<summary>` is neither, so the four disclosures would be the palest thing on
  // the page -- white on the `--ds-raised` the hints are now drawn on is 1.03:1
  // in the light theme, where WCAG 1.4.3 asks for 4.5:1.
  //
  // `.tutorialpanel` now reads `--ds-text` rather than the fixed `--color-text`
  // it used to, so the colour this asserts is whichever theme Playwright's own
  // default `colorScheme` renders here -- light, per this suite's own default --
  // not a page-wide constant any more. `--ds-text`'s light-theme value is
  // `#1e2227`.
  await page.goto(FIRST_LEVEL);

  await expect(panel(page).getByText("Hint 1", { exact: true })).toHaveCSS(
    "color",
    "rgb(30, 34, 39)",
  );
  await expect(panel(page).getByText("Why this happens", { exact: true })).toHaveCSS(
    "color",
    "rgb(30, 34, 39)",
  );
});

test("stands the lesson beside the building where the pane has room, and above it where it has not", async ({
  page,
}) => {
  // Four things can go wrong in this row and jsdom can see none of them: the
  // card can be pushed under the building where there was room beside it, a
  // line longer than the card can push a horizontal scrollbar into a box that
  // already scrolls vertically, a lesson with no ceiling can take the whole of
  // a short pane and leave the building nothing, and the statistics strip can
  // be pushed off the bottom of the window by the pair of them.
  //
  // Three widths, because the row has two shapes and the edge between them is
  // its own way of failing. 1280x900 is the default window and a 794px pane,
  // wide enough for the 384px aside and the widest house the track builds;
  // 1040x600 is the floor `design/ui-mockup.html` builds to, and there the pane
  // is 645px and the row stacks -- which is the mockup's own answer at that
  // width, measured in it: its `.stagerow` computes to `column` at 1040 and to
  // `row` at 1280.
  //
  // 1213x900 is the one between them, and the only one of the three that has
  // ever failed. The shipped 62% split makes it a 752px pane: 12px above the
  // 740px a row needs at its narrowest, and 8px below the 760px the container
  // query used to stack at, because that threshold was the 740 rounded up
  // against a house wider than any the track builds. Inside that 20px the
  // lesson stood above the building with room beside it going spare, and both
  // of the widths above are outside it -- which is how a reported bug sat in a
  // suite that measures this row at two widths and says nothing.
  //
  // Both languages, because the Russian is the long one: every line of this
  // card is prose or a disclosure's summary, the Russian of each runs half
  // again the English, and a card whose whole height is prose is a card whose
  // height the language sets.
  //
  // One document for all four measurements, and the language changed through
  // the picker rather than the address bar: a `goto` differing only in the hash
  // is a same-document navigation, so a second route asking for a language the
  // page is not already in would be measured before anything had redrawn.
  const measure = async (language: string): Promise<void> => {
    for (const [width, height, shape] of [
      [1280, 900, "beside"],
      [1213, 900, "beside"],
      [1040, 600, "above"],
    ] as const) {
      await page.setViewportSize({ width, height });

      const where = `${language} at ${String(width)}x${String(height)}`;
      const card = page.locator(".tutorial");
      const lesson = await boxOf(card, `the lesson card on ${where}`);
      const world = await boxOf(page.locator(".world"), `the building on ${where}`);

      if (shape === "beside") {
        // Beside, not above: the card ends before the building begins, and the
        // two share the row rather than following one another down it. Not an
        // equal `y` -- the card carries its own 18px margin and the building
        // takes the same inset from inside `.stage`, so the boxes start 18px
        // apart and the two *contents* start on one line.
        expect(lesson.x + lesson.width).toBeLessThanOrEqual(world.x);
        expect(lesson.y).toBeLessThan(world.y + world.height);
        expect(world.y).toBeLessThan(lesson.y + lesson.height);
      } else {
        // Above, and bounded. The gap is real -- the card's bottom edge is
        // clear of the building's box -- and the building still has a box at
        // all: level 7 with its answer open asks for 1290px of a row that has
        // 399px to give here, and before the ceiling in the container query it
        // took all of it -- `.world` came out 0px tall, which is the building
        // gone from a page about a building.
        expect(lesson.y + lesson.height).toBeLessThanOrEqual(world.y);
        expect(world.height).toBeGreaterThan(0);
      }

      // Nothing escapes the card sideways. `scrollWidth` is what a horizontal
      // scrollbar is made of, and this box already scrolls vertically, so a
      // second bar across the bottom of a column of prose is the failure. It
      // used to be measured against the two buttons under the answer as well --
      // the only children with labels long enough to make one -- and they are
      // gone; everything left is prose that wraps, a summary that wraps, or the
      // answer's own `<pre>`, which scrolls inside itself.
      const overflow = await card.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, `the lesson card on ${where}`).toBe(0);

      // And the whole of the stage row fits the window, which is what moving
      // the lesson into a row of its own bought: the statistics strip under it
      // used to be pushed off the bottom of a 600px window by a lesson with a
      // disclosure open.
      const stats = await boxOf(page.locator(".statscontainer"), `the statistics on ${where}`);
      expect(stats.y + stats.height).toBeLessThanOrEqual(height);
    }
  };

  await page.goto(FIRST_LEVEL);
  await expect(panel(page, LEVEL_1_TITLE)).toBeVisible();
  await measure("English");

  await switchToRussian(page);
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();
  await measure("Russian");
});

test("costs the levels nothing: the widest building in the game still fits its pane", async ({
  page,
}) => {
  // The row this feature added is on every route, lesson or no lesson, and the
  // levels are where it can do damage without anyone on the learning track ever
  // seeing it. Level 18 builds the widest house in the game -- 1030px of it
  // -- and `.stagearea > .world` refuses to shrink, so with no ceiling on that
  // refusal the world sized itself to the building instead of to the pane:
  // 1062px inside a 794px pane, 268px of it clipped away by the pane's own
  // overflow, and `.stage` with nothing to scroll because it was never narrower
  // than what was inside it. Two whole shafts were unreachable.
  //
  // Measured at both widths, because the pane is what the ceiling is a
  // percentage of and the splitter can change it without the window moving.

  for (const [width, height] of [
    [1280, 900],
    [1040, 600],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/#level=18");
    await expect(page.locator(".building")).toBeVisible();

    const fit = await page.locator(".pane-game").evaluate((pane) => {
      const stage = pane.querySelector(".stage");
      const building = pane.querySelector(".building");
      return {
        paneOverflow: pane.scrollWidth - pane.clientWidth,
        buildingEscapes:
          stage === null || building === null
            ? true
            : building.getBoundingClientRect().right >
              stage.getBoundingClientRect().right + stage.scrollWidth - stage.clientWidth,
      };
    });
    expect(fit).toEqual({ paneOverflow: 0, buildingEscapes: false });
  }
});

/**
 * The panel used to be swept at phone widths (320/390px, in both languages)
 * the same way `reflow.spec.ts` still sweeps the two help pages -- until
 * decision #1 (see the migration plan's own §0). The main game page, this
 * panel included, adopted `design/ui-mockup.html`'s own 1040x600 floor
 * instead of reflowing for a phone: a building pane and a code pane side by
 * side need more room than either width has to give, and shrinking them to
 * fit was never asked for. `reflow.spec.ts` now holds the floor itself; there
 * is no narrower width left for this panel to be swept at.
 */
