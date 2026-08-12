/**
 * The learning track's panel, in a browser.
 *
 * What the panel decides is already covered without one:
 * `src/ui/tutorial-panel.test.ts` draws every task and presses every button, and
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

import { editor, storedCode } from "./game-page.ts";

/**
 * Where task 1 lives.
 *
 * Nothing on the page links into the track yet — no entry point has been built —
 * so the address is how a task is reached, and it is the address `router.ts`
 * sends `#challenge=tutorial-9` and every other wrong one on the track to.
 */
const FIRST_TASK = "/#challenge=tutorial-1";

/** A line only task 1's *starting* program has, so a copy of it is identifiable. */
const TASK_1_MARKER = "this building has two floors";

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
  await page.getByLabel("Language").selectOption("ru");
}

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
  await expect(page.getByRole("heading", { name: /^Challenge #1:/ })).toBeVisible();
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

  await panel(page).getByRole("button", { name: "Leave for the challenges" }).click();

  await expect(page.getByRole("heading", { name: /^Challenge #1:/ })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(editor(page)).toContainText(TASK_1_MARKER);
});

test("starts the task again from the panel without leaving it", async ({ page }) => {
  await page.goto(FIRST_TASK);
  await panel(page).getByRole("button", { name: "Start over" }).click();

  // The same task, and a new run of it waiting to be started.
  await expect(panel(page)).toBeVisible();
  await expect(page.locator(".tutorialposition")).toHaveText("Learning track Task 1 of 8");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  // The button that was pressed no longer exists: the panel is redrawn whole,
  // and a keyboard player whose focus went with it would be back at <body> with
  // the entire page to tab through again (WCAG 2.4.3). Where it goes was
  // measured rather than assumed -- the start button, not the redrawn "Start
  // over" -- because the panel is one of the three regions `#startRun` asks
  // about before it tears a run down, so the bar takes the focus first and the
  // panel then finds it already outside itself. That is the same place pressing
  // "leave" lands, and it is where the next press has to happen anyway.
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeFocused();
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
  await page.goto(FIRST_TASK);

  await expect(panel(page).getByText("Hint 1", { exact: true })).toHaveCSS(
    "color",
    "rgb(68, 68, 68)",
  );
  await expect(panel(page).getByText("Why this happens", { exact: true })).toHaveCSS(
    "color",
    "rgb(68, 68, 68)",
  );
});

/** Viewport widths a phone reader is likely to arrive with (see reflow.spec). */
const WIDTHS = [320, 390] as const;

/** The two languages the panel is read in, and the words that identify it. */
const LANGUAGES = [
  { name: "English", region: "Learning track", hint: "Hint 3", russian: false },
  { name: "Russian", region: "Учебная дорожка", hint: "Подсказка 3", russian: true },
] as const;

/**
 * How much wider than the screen the document wants to be, and how the panel
 * sits inside it.
 *
 * @param page - The page under test.
 * @returns The measurements, all in CSS pixels.
 */
function measurePanel(page: Page): Promise<{
  overflow: number;
  rightEdge: number;
  viewport: number;
  clippedAnswers: number;
  spilledButtons: number;
  escapedButtons: number;
}> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const drawn = document.querySelector(".tutorialpanel");
    if (drawn === null) {
      throw new Error("The learning track drew no panel to measure");
    }
    const panelRight = drawn.getBoundingClientRect().right;
    return {
      // The document, which is what WCAG 1.4.10 is about.
      overflow: root.scrollWidth - root.clientWidth,
      // And the panel itself, so that "fits" cannot be satisfied by an ancestor
      // clipping the tail of a hint off the screen.
      rightEdge: Math.round(drawn.getBoundingClientRect().right),
      viewport: root.clientWidth,
      // The answer wraps at this width rather than growing a scrollbar of its
      // own, which would answer a page that pans sideways with a block that
      // pans sideways instead.
      clippedAnswers: [...document.querySelectorAll(".tutorialsolution code")].filter(
        (block) => block.scrollWidth > block.clientWidth,
      ).length,
      // And the buttons hold their labels: the shared chrome pins a button to a
      // 30px content box, which is right for "Start over" and wrong for a label
      // that takes two lines at this width.
      spilledButtons: [...document.querySelectorAll(".tutorialbuttons button")].filter(
        (button) => button.scrollHeight > button.clientHeight,
      ).length,
      // And they stay inside the panel. A row that may not wrap keeps the three
      // on one line by squeezing each to its longest word, which does not widen
      // the page -- so the two measurements above would both pass -- and in
      // Russian at 320px hangs the last of them over the panel's edge.
      escapedButtons: [...document.querySelectorAll(".tutorialbuttons button")].filter(
        (button) => button.getBoundingClientRect().right > panelRight + 0.5,
      ).length,
    };
  });
}

/**
 * The same measurement of the document alone, on a route with no panel on it.
 *
 * @param page - The page under test.
 * @returns How much wider than the screen the document wants to be.
 */
function measureShell(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const { name, region, hint, russian } of LANGUAGES) {
  for (const width of WIDTHS) {
    test(`the panel in ${name} fits a ${String(width)}px screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });

      // The shell's own width first, on a challenge, where this region is
      // empty. The Russian page already overflows 320px by 57px without any
      // panel on it -- the header's three links and the language picker are
      // 367px of one unbreakable row -- so "the document does not overflow" is
      // a claim about the header rather than about the panel at that width, and
      // it is measured here so that what is asserted below is the panel's own
      // contribution. The header is written up in the report; it is not this
      // panel's to fix.
      await page.goto("/#challenge=1");
      if (russian) {
        await switchToRussian(page);
        await expect(page.getByRole("heading", { name: /^Задание №1:/ })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: /^Challenge #1:/ })).toBeVisible();
      }
      const shellOverflow = await measureShell(page);

      await page.goto(FIRST_TASK);
      await expect(panel(page, region)).toBeVisible();
      // Its widest state: the answer is a line of monospace as long as any on
      // the track, and the three buttons carry sentences rather than words.
      await panel(page, region).getByText(hint, { exact: true }).click();
      await expect(panel(page, region).locator(".tutorialsolution code")).toBeVisible();

      const measurements = await measurePanel(page);

      expect(measurements.overflow).toBeLessThanOrEqual(shellOverflow);
      expect(measurements.rightEdge).toBeLessThanOrEqual(measurements.viewport);
      expect(measurements.clippedAnswers).toBe(0);
      expect(measurements.spilledButtons).toBe(0);
      expect(measurements.escapedButtons).toBe(0);
    });
  }
}
