/**
 * The learning track's panel, in a browser.
 *
 * What the panel decides is already covered without one:
 * `src/widgets/tutorial-panel/ui/tutorial-panel.test.ts` draws every task and presses every button, and
 * `src/app/app.test.ts` proves the wiring. What jsdom cannot answer is whether
 * any of it is *visible*. It has no layout, so it cannot tell an empty region
 * that is hidden from one that leaves a gap above the building, cannot say
 * whether the answer under the third hint fits a phone or whether a button grew
 * to hold a label of six words, and cannot see that the region is announced as a
 * landmark a player can jump to. Those are the things measured here, in both
 * languages, because the Russian strings are materially longer than the English
 * they render and this panel is more prose than anything else on the page.
 */

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { editor, languagePicker, startButton, storedCode } from "./game-page.ts";

/**
 * Where task 1 lives.
 *
 * The level switcher's first tutorial tile links here, and the test below
 * follows that tile rather than this constant. Everything else goes straight to
 * the address, because a task no tile points at can only be reached that way —
 * and because this is the address `router.ts` sends `#challenge=tutorial-9` and
 * every other wrong one on the track to.
 */
const FIRST_TASK = "/#challenge=tutorial-1";

/** A line only task 1's *starting* program has, so a copy of it is identifiable. */
const TASK_1_MARKER = "this building has two floors";

/**
 * The same line of the same program, as a Russian reader is handed it.
 *
 * The programs on the track are catalogue messages like everything else a
 * player reads — `tutorial.task1.startingCode.code` — and the code inside them
 * is identical in every language, so what changes between this marker and the
 * one above is the comment and nothing else. Two markers rather than one
 * because the interesting failure is not an empty editor: it is an editor
 * holding the English program on a page that is otherwise entirely Russian.
 */
const TASK_1_MARKER_RU = "в этом доме два этажа";

/**
 * The panel's landmark, by the name a screen reader announces it as.
 *
 * By role and name rather than by class, for the reason `game-page.ts` gives:
 * what is asserted is what a player can reach. A `<section>` that has lost its
 * name is not a region at all — it stops being announced and stops being
 * something to jump to, with nothing on screen changing.
 *
 * @param page - The page under test.
 * @param name - The landmark's accessible name in the language on screen.
 * @returns The panel.
 */
function panel(page: Page, name = "Learning track"): Locator {
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
 * Opens the level switcher's menu, where the track's tasks are listed.
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
  // `#challenge=tutorial-1` into the address bar. That the tiles are built is
  // `level-switcher.test.ts`'s to prove and where they point is the level
  // menu model's; what neither can answer is whether a player can open the
  // menu and see them, and whether pressing one starts a task -- the layout,
  // the hash and the router are all outside jsdom, and a tile behind a menu
  // that will not open leaves the track exactly as undiscoverable as no tile
  // at all.
  // `exact`, because the menu this opens holds a locked tile for every other
  // level and "Level 1" is a prefix of "Level 10, locked" and nine more.
  const opener = page.getByRole("button", { name: "Level 1", exact: true });
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");

  const english = page.getByRole("link", { name: "Tutorial task 1", exact: true });
  await expect(english).toBeVisible();

  await switchToRussian(page);

  // Still there under the longer label, on a switcher the language change
  // rebuilt from the catalogue rather than relabelled in place.
  await openLevelMenu(page);
  const link = page.getByRole("link", { name: "Учебное задание 1", exact: true });
  await expect(link).toBeVisible();

  await link.click();

  await expect(panel(page, "Учебная дорожка")).toBeVisible();
});

test("shows the panel on a task and nothing at all off it", async ({ page }) => {
  await page.goto(FIRST_TASK);

  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "The elevator that goes nowhere" })).toBeVisible();
  await expect(page.locator(".tutorialposition")).toHaveText("Learning track Task 1 of 8");
  await expect(page.locator(".tutorialprogress")).toHaveText("0 of 8 tasks done");

  // The region stays in the page shell on every other route, so the stylesheet
  // is what has to take it out of the flow: an empty block with margins is
  // still a 10px gap above the building on all nineteen challenges, the sandbox
  // and the demo.
  await page.goto("/#challenge=1");
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".tutorial")).toHaveCSS("display", "none");
  expect(await page.locator(".tutorial").boundingBox()).toBeNull();
});

test("keeps the answer shut until a player asks for it", async ({ page }) => {
  await page.goto(FIRST_TASK);

  // Three hints and an explanation, every one of them closed: a task whose
  // answer is on screen before its goal has been read is not a task.
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
  // answers is whether `style.css` actually paints those classes as anything
  // and whether the clipboard the button claims to have written to is the one
  // a player would paste from.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(FIRST_TASK);

  await panel(page).getByText("Hint 3", { exact: true }).click();

  const code = panel(page).locator(".tutorialsolution code");
  await expect(code).toBeVisible();
  expect(await code.locator("[class^='tok-']").count()).toBeGreaterThan(0);

  // The one line task 1 actually adds, marked rather than only named in the
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

test("hands the task's program to the editor and stays on the task", async ({ page }) => {
  await page.goto(FIRST_TASK);
  await expect(editor(page)).toContainText(TASK_1_MARKER);
  expect((await storedCode(page)) ?? "").not.toContain(TASK_1_MARKER);

  await panel(page).getByRole("button", { name: "Take this program into your own editor" }).click();

  // Stored under the game's own key, which is where the editor looks when the
  // player leaves the track -- and the task is still on screen, because the
  // button means "I want to keep this", not "I am done here".
  expect(await storedCode(page)).toContain(TASK_1_MARKER);
  await expect(panel(page)).toBeVisible();
  // The write went somewhere the player cannot see from here, so this line is
  // the whole of what they are told -- and `toBeVisible` is the half of that
  // jsdom cannot answer. That it holds the right sentence, and that it is empty
  // until the press, are `tutorial-panel.test.ts`'s and are not repeated here.
  await expect(panel(page).locator(".tutorialtaken")).toBeVisible();

  await panel(page).getByRole("button", { name: "Leave for the levels" }).click();

  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(editor(page)).toContainText(TASK_1_MARKER);
});

test("hands the editor the program in the language the link asks for", async ({ page }) => {
  // `openTutorialBuffer` promises the starter "in the player's current
  // language", and this is the only place that promise can be measured whole:
  // the hash names a language, `resolveLocale` picks it, the Russian catalogue
  // is fetched as its own chunk, and only then is the task opened and the
  // getter on the table read. Every one of those steps is missing from jsdom,
  // and the last two are ordered -- the starter is written into storage as the
  // buffer opens, so a task that opened before the catalogue landed would keep
  // its English program for the rest of the run with the page around it in
  // Russian.
  await page.goto(`${FIRST_TASK},lang=ru`);
  await expect(panel(page, "Учебная дорожка")).toBeVisible();

  const russianEditor = editor(page, "Программа для лифтов");
  await expect(russianEditor).toContainText(TASK_1_MARKER_RU);
  await expect(russianEditor).not.toContainText(TASK_1_MARKER);
  // And it is still the program, not a translation of one: the line the task
  // is about survives the trip through the catalogue exactly as written.
  await expect(russianEditor).toContainText("elevator.goToFloor(0);");
});

test("starts the task again from the run controls without leaving the track", async ({ page }) => {
  await page.goto(FIRST_TASK);

  // Exactly one button on the page says this. The panel used to carry a second
  // one, which restarted the task without starting it, and two buttons under one
  // accessible name doing two things is WCAG 3.2.4 -- the panel sits directly
  // above this row, so both were on screen at once.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Start over", exact: true }).click();

  // The same task, running: "Start over" is pressed by somebody who has decided
  // to go again, so it does not stop to ask a second time.
  await expect(panel(page)).toBeVisible();
  await expect(page.locator(".tutorialposition")).toHaveText("Learning track Task 1 of 8");
  await expect(startButton(page, "Pause")).toBeVisible();
  // And the button survives the restart it caused, so the focus never leaves it.
  // The panel is redrawn whole underneath, but the run controls are drawn once
  // for the life of the page and are not among the regions `#startRun` tears
  // down -- which is the whole reason they were moved out of the challenge bar.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toBeFocused();
});

test("draws the panel again in the language the picker asks for", async ({ page }) => {
  await page.goto(FIRST_TASK);
  await expect(panel(page)).toBeVisible();

  await switchToRussian(page);

  // The landmark's own name is translated too, which is the one part of this
  // panel a sighted player cannot see is still in English.
  await expect(panel(page, "Учебная дорожка")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Лифт, который никуда не едет" })).toBeVisible();
  await expect(page.locator(".tutorialprogress")).toHaveText("Пройдено 0 из 8 заданий");
});

test("paints the panel's own controls as dark as the prose around them", async ({ page }) => {
  // The defect written up at `.tutorialpanel`: <body> paints everything white,
  // and the document rules repair that for `p` and the headings only. A
  // `<summary>` is neither, so the four disclosures would be the palest thing on
  // the page -- 1.91:1 against this background, where WCAG 1.4.3 asks for 4.5:1.
  //
  // `.tutorialpanel` now reads `--ds-text` rather than the fixed `--color-text`
  // it used to, so the colour this asserts is whichever theme Playwright's own
  // default `colorScheme` renders here -- light, per this suite's own default --
  // not a page-wide constant any more. `--ds-text`'s light-theme value is
  // `#1e2227`.
  await page.goto(FIRST_TASK);

  await expect(panel(page).getByText("Hint 1", { exact: true })).toHaveCSS(
    "color",
    "rgb(30, 34, 39)",
  );
  await expect(panel(page).getByText("Why this happens", { exact: true })).toHaveCSS(
    "color",
    "rgb(30, 34, 39)",
  );
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
