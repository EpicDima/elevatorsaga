/** Browser checks for the tutorial panel's layout, visibility, and accessibility, in both languages. */

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { editor, languagePicker, startButton } from "./game-page.ts";

/** Where level 1 lives, and where every wrong level on the track falls back to. */
const FIRST_LEVEL = "/#level=tutorial-1";

/** A line only level 1's *starting* program has, and only in English. */
const LEVEL_1_MARKER = "this building has two floors";

/**
 * The same line, as a Russian reader sees it. Two markers, not one, because
 * the failure worth catching is an editor stuck in English on an otherwise
 * Russian page, not just an empty editor.
 */
const LEVEL_1_MARKER_RU = "в этом доме два этажа";

/** What level 1 is called, in both languages; also the panel's default landmark name. */
const LEVEL_1_TITLE = "The elevator that goes nowhere";
const LEVEL_1_TITLE_RU = "Лифт, который никуда не едет";

/**
 * The panel's landmark, found by role and accessible name rather than class:
 * a `<section>` that has lost its name stops being announced or reachable,
 * with nothing on screen changing to show it.
 */
function panel(page: Page, name = LEVEL_1_TITLE): Locator {
  return page.getByRole("region", { name });
}

/** Switches the page to Russian through the control a player would use. */
async function switchToRussian(page: Page): Promise<void> {
  await (await languagePicker(page)).selectOption("ru");
}

/**
 * One element's box, refusing to measure something not on screen.
 * `boundingBox()` returns null for an element with no layout, and comparing
 * null against a number would silently pass on the exact failure this exists to catch.
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
 * Makes every clipboard write fail the way a browser without the permission does.
 *
 * Defined on `navigator` itself, which shadows the `Navigator.prototype` getter
 * the real API is served from, so nothing has to be put back afterwards.
 */
function refuseClipboardWrites(): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (): Promise<never> =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
    },
  });
}

/**
 * Force-opens the level switcher's menu (not via click, which toggles) so it
 * can be called on both sides of a language change that redraws the switcher.
 */
async function openLevelMenu(page: Page): Promise<void> {
  await page.locator(".taskmenu").evaluate((menu) => {
    (menu as HTMLElement).hidden = false;
  });
}

test("opens the track from the level switcher, in the language on screen", async ({ page }) => {
  await page.goto("/");

  // The switcher's tutorial block is the only entrance to the track now that
  // the shell's own link is gone. `exact` avoids matching "Level 10" and the rest.
  const opener = page.getByRole("button", { name: "Level 1", exact: true });
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");

  const english = page.getByRole("link", { name: "Tutorial level 1", exact: true });
  await expect(english).toBeVisible();

  await switchToRussian(page);

  // Still there under the longer label: the switcher rebuilds from the
  // catalog rather than relabeling in place.
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

  // No leftover track chrome (position, steps, progress): the app bar's level
  // switcher already shows all of that. Checked on the rendered page, not just
  // jsdom, since either a template or a stylesheet rule could bring it back.
  await expect(
    panel(page).locator(".tutorialposition, .tutorialsteps, .tutorialprogress, .tutorialtaken"),
  ).toHaveCount(0);
  await expect(panel(page).locator("button")).toHaveCount(1);

  // The stylesheet has to take the region out of flow on other routes: an
  // empty block with margins would still leave a gap above the building.
  await page.goto("/#level=1");
  await expect(page.getByRole("button", { name: "Level 1" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".tutorial")).toHaveCSS("display", "none");
  expect(await page.locator(".tutorial").boundingBox()).toBeNull();
});

test("keeps the answer shut until a player asks for it", async ({ page }) => {
  await page.goto(FIRST_LEVEL);

  // Three hints and an explanation, all closed: the answer must not show before the goal is read.
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
  // jsdom already proves the markup and the clipboard call happen; only a real
  // browser proves the CSS actually paints those classes and that the
  // clipboard written to is the one a player would paste from.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(FIRST_LEVEL);

  await panel(page).getByText("Hint 3", { exact: true }).click();

  const code = panel(page).locator(".tutorialsolution code");
  await expect(code).toBeVisible();
  expect(await code.locator("[class^='tok-']").count()).toBeGreaterThan(0);

  // The one line level 1 actually adds, marked rather than only named in the hint's prose.
  const marked = code.locator(".tutoriallinechanged");
  await expect(marked).toHaveCount(1);
  await expect(marked).toHaveText("elevator.goToFloor(1);");

  const copyButton = panel(page).locator("button.tutorialcopycode");
  const status = panel(page).locator(".tutorialcopied");
  await expect(copyButton).toHaveAccessibleName("Copy this program");
  await expect(status).toHaveText("");
  // The button is drawn on the block it copies, in its top corner, and stays
  // put there while a wide answer scrolls under it.
  const block = await boxOf(code, "the answer's code block");
  const control = await boxOf(copyButton, "the copy button");
  expect(control.y).toBeGreaterThanOrEqual(block.y);
  expect(control.y + control.height).toBeLessThan(block.y + block.height);
  expect(control.x + control.width).toBeLessThanOrEqual(block.x + block.width);
  expect(control.x).toBeGreaterThan(block.x + block.width / 2);

  await copyButton.click();

  // The mark on the button is the whole visible report; the sentence behind it
  // is announced, not shown, so a player is not left reading a status line.
  await expect(copyButton).toHaveAttribute("data-copied", "yes");
  await expect(status).toHaveText("Copied to your clipboard.");
  // Clipped to a pixel by `.visually-hidden`, which is the whole point of it:
  // announced, and taking up no room on the card. Measured through `boxOf`,
  // since `display: none` would kill the announcement and return no box at all.
  expect((await boxOf(status, "the copy announcement")).height).toBeLessThanOrEqual(1);
  // The name says what the control does, through all of it: a name that turned
  // into the outcome would be read out again by a screen reader, unasked.
  await expect(copyButton).toHaveAccessibleName("Copy this program");

  // And it goes back to being a copy button, so the answer is left as it was found.
  await expect(copyButton).not.toHaveAttribute("data-copied", /.*/);
  await expect(status).toHaveText("");

  // Read once the mark is gone, since what was written outlives it. Compared
  // against what's actually rendered, not a second copy kept by the test.
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(await code.evaluate((element) => element.textContent));
  expect(clipboard).toContain("elevator.goToFloor(1);");
});

test("says in words what to do instead when the browser refuses to copy", async ({ page }) => {
  // The success path says everything on the button, but a refusal asks the
  // player to select the code themselves - so that sentence has to be painted,
  // not only announced. Only a browser can prove it takes room on the card.
  await page.addInitScript(refuseClipboardWrites);
  await page.goto(FIRST_LEVEL);

  await panel(page).getByText("Hint 3", { exact: true }).click();
  const copyButton = panel(page).locator("button.tutorialcopycode");
  const status = panel(page).locator(".tutorialcopied");
  await copyButton.click();

  await expect(copyButton).toHaveAttribute("data-copied", "no");
  await expect(status).toBeVisible();
  await expect(status).toHaveText(
    "Your browser refused to copy it. Select the code and copy it yourself.",
  );
  // A real line of prose under the answer, not the clipped pixel the success
  // announcement is; how long it stands is pinned in jsdom, where the clock can be run.
  const line = await boxOf(status, "the refusal");
  const block = await boxOf(panel(page).locator(".tutorialsolution"), "the answer's code block");
  expect(line.height).toBeGreaterThan(1);
  expect(line.y).toBeGreaterThanOrEqual(block.y + block.height);
  // Still a copy button by name, so the way to try again is the same control.
  await expect(copyButton).toHaveAccessibleName("Copy this program");
});

test("hands the editor the program in the language the link asks for", async ({ page }) => {
  // The only place "starter in the player's current language" can be checked
  // end-to-end: language resolution, the catalog fetch, and opening the level
  // are all async and ordered, none of which jsdom exercises.
  await page.goto(`${FIRST_LEVEL},lang=ru`);
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();

  const russianEditor = editor(page, "Программа для лифтов");
  await expect(russianEditor).toContainText(LEVEL_1_MARKER_RU);
  await expect(russianEditor).not.toContainText(LEVEL_1_MARKER);
  // Still the program, not a translation: the line survives the trip through the catalog unchanged.
  await expect(russianEditor).toContainText("elevator.goToFloor(0);");
});

test("starts the level again from the run controls without leaving the track", async ({ page }) => {
  await page.goto(FIRST_LEVEL);

  // Exactly one button says this: a second one doing the same thing under one
  // accessible name would fail WCAG 3.2.4.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Start over", exact: true }).click();

  // "Start over" doesn't ask again - it restarts immediately. `panel` matching
  // level 1's own name confirms the restarted level, not just any panel.
  await expect(panel(page)).toBeVisible();
  await expect(startButton(page, "Pause")).toBeVisible();
  // The button survives the restart it caused: run controls are drawn once for
  // the page's life and aren't among the regions the restart tears down.
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toBeFocused();
});

test("draws the panel again in the language the picker asks for", async ({ page }) => {
  await page.goto(FIRST_LEVEL);
  await expect(panel(page)).toBeVisible();

  await switchToRussian(page);

  // The landmark's name is the level's title, so both translate together or
  // not at all - agreement here is invisible to a sighted player.
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();
  await expect(page.getByRole("heading", { name: LEVEL_1_TITLE_RU })).toBeVisible();
  // The prose under the heading too, which is the bulk of what a language change redraws.
  await expect(
    panel(page, LEVEL_1_TITLE_RU).getByText("Подсказка 1", { exact: true }),
  ).toBeVisible();
});

test("paints the panel's own controls as dark as the prose around them", async ({ page }) => {
  // `<summary>` isn't covered by the document rules that fix contrast for
  // p/headings, so without this rule the disclosures would fail WCAG 1.4.3
  // (white on `--ds-raised`). The RGB below is `--ds-text`'s light-theme
  // value, under Playwright's default color scheme.
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

test("stands the lesson across the pane with the whole house under it, at every width", async ({
  page,
}) => {
  // Guards several layout regressions at once (card beside the building again,
  // double scrollbars, house or stats pushed off-screen). Language is switched
  // via the picker, not `goto`, since a same-hash navigation wouldn't redraw.
  const check = async (where: string, height: number, roomForBoth = true): Promise<void> => {
    const card = page.locator(".tutorial");
    const lesson = await boxOf(card, `the lesson card on ${where}`);
    const world = await boxOf(page.locator(".world"), `the building on ${where}`);

    // Above, not beside: the two stack down the column rather than splitting its width.
    expect(lesson.y + lesson.height, `the lesson card on ${where}`).toBeLessThanOrEqual(world.y);
    expect(lesson.x, `the lesson card on ${where}`).toBeGreaterThanOrEqual(world.x);
    expect(lesson.x + lesson.width, `the lesson card on ${where}`).toBeLessThanOrEqual(
      world.x + world.width,
    );

    // As wide as the pane allows: 640px, or the pane's own content width minus
    // its inset, whichever is smaller. Read off `.stagearea`, since a
    // scrollbar eats into that width, not the window's.
    const room = await page
      .locator(".stagearea")
      .evaluate((area) => (area as HTMLElement).clientWidth);
    expect(lesson.width, `the lesson card on ${where}`).toBeCloseTo(Math.min(640, room - 32), 0);

    // One box holds both and doesn't scroll while there's room for both.
    // Sideways it never scrolls at all: `.stage` owns the inline axis for an oversized building.
    const shared = await page.locator(".stagearea").evaluate((area) => ({
      down: area.scrollHeight - area.clientHeight,
      across: area.scrollWidth - area.clientWidth,
    }));
    expect(shared.across, `the stage area on ${where}`).toBe(0);
    if (roomForBoth) {
      expect(shared.down, `the stage area on ${where}`).toBe(0);
    }

    // The elevators must be in view: the house draws bottom-up, so a too-tall
    // building loses its cars off-screen first. At the narrow end the column
    // scrolls to its foot first, since that's where the fallback promises them.
    const parked = await page.locator(".stagearea").evaluate((area, scroll: boolean) => {
      if (scroll) {
        area.scrollTop = area.scrollHeight;
      }
      const view = area.getBoundingClientRect();
      const cars = [...area.querySelectorAll(".car")].map((car) => car.getBoundingClientRect());
      return {
        cars: cars.length,
        shown: cars.filter((car) => car.top >= view.top - 1 && car.bottom <= view.bottom + 1)
          .length,
      };
    }, !roomForBoth);
    expect(parked.cars, `the building on ${where}`).toBeGreaterThan(0);
    expect(parked.shown, `the elevators on ${where}`).toBe(parked.cars);

    // The card must not be its own scroll container - that was the old
    // layout, with the wheel answering whichever box the pointer was over.
    const inside = await card.evaluate((element) => ({
      down: element.scrollHeight - element.clientHeight,
      across: element.scrollWidth - element.clientWidth,
    }));
    expect(inside, `the lesson card on ${where}`).toEqual({ down: 0, across: 0 });

    // The statistics strip stays inside the viewport, which keeping the
    // scroll inside `.stagearea` (rather than the window) guarantees.
    const stats = await boxOf(page.locator(".statscontainer"), `the statistics on ${where}`);
    expect(stats.y + stats.height, `the statistics on ${where}`).toBeLessThanOrEqual(height);
  };

  const measure = async (language: string): Promise<void> => {
    for (const [width, height] of [
      [1280, 900],
      [1213, 900],
      [1040, 600],
    ] as const) {
      await page.setViewportSize({ width, height });
      await check(`${language} at ${String(width)}x${String(height)}`, height);
    }

    const splitter = page.locator(".splitter");
    await splitter.focus();
    for (let press = 0; press < 15; press += 1) {
      await page.keyboard.press("ArrowLeft");
    }
    // Reading the value back confirms the presses landed and the pane really
    // is at its narrowest, not still at the wide default.
    await expect(splitter).toHaveAttribute("aria-valuenow", "37");
    await check(`${language} at 1040x600 with the game pane dragged to 380px`, 600, false);

    await splitter.dblclick();
    await expect(splitter).toHaveAttribute("aria-valuenow", "62");
  };

  await page.goto(FIRST_LEVEL);
  await expect(panel(page, LEVEL_1_TITLE)).toBeVisible();
  await measure("English");

  await switchToRussian(page);
  await expect(panel(page, LEVEL_1_TITLE_RU)).toBeVisible();
  await measure("Russian");
});

test("numbers the answer's lines beside the program rather than inside it", async ({ page }) => {
  // Level 7's answer is the track's longest at 29 lines, so the column has to
  // hold two digits, and half of them are marked, which is where a number and
  // the band drawn around it can fall out of step. Only a real browser draws
  // CSS counters at all: jsdom has no generated content.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#level=tutorial-7");
  await page
    .locator(".tutorialhint")
    .last()
    .evaluate((hint) => {
      (hint as HTMLDetailsElement).open = true;
    });
  const code = page.locator(".tutorialsolution code");
  await expect(code).toBeVisible();

  const measured = await code.evaluate((block) => ({
    lines: [...block.children].map((line) => {
      // A range over the line's contents, since the line box itself starts at
      // the number, and the number is what this is measuring past.
      const range = document.createRange();
      range.selectNodeContents(line);
      return {
        marked: line.tagName === "MARK",
        text: Math.round(range.getBoundingClientRect().left),
        box: Math.round(line.getBoundingClientRect().left),
      };
    }),
    text: block.textContent,
  }));

  expect(measured.lines).toHaveLength(29);
  expect(measured.lines.filter((line) => line.marked).length).toBeGreaterThan(0);
  // One x for all 29: the column is the same width on every line, and a marked
  // line's band neither shifts its code nor swallows its number.
  expect([...new Set(measured.lines.map((line) => line.text))]).toHaveLength(1);
  for (const line of measured.lines) {
    expect(line.text - line.box, "the line-number column").toBeGreaterThanOrEqual(20);
  }
  // Drawn, not written: what the copy button reads back is still the program,
  // which a number turned into real text would open with a "1".
  expect(measured.text.startsWith("function init(elevators, floors) {\n")).toBe(true);
});

test("shows the longest answer on the track without panning it sideways", async ({ page }) => {
  // Level 7 has the track's longest answer (68 characters). Beside the
  // building the card was 384px, leaving the code block too narrow to read
  // without scrolling sideways; this checks the game's own window isn't one of those cases.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#level=tutorial-7");
  // Opened through the DOM since a shut <details> has no layout to measure.
  await page
    .locator(".tutorialhint")
    .last()
    .evaluate((hint) => {
      (hint as HTMLDetailsElement).open = true;
    });
  await expect(page.locator(".tutorialsolution code")).toBeVisible();

  const measured = await page.locator(".tutorialsolution code").evaluate((block) => ({
    spill: block.scrollWidth - block.clientWidth,
    longest: Math.max(...block.textContent.split("\n").map((line) => line.length)),
  }));
  // A tripwire: if the answer is ever rewritten shorter, the assertion below
  // would keep passing while testing nothing.
  expect(measured.longest, "the longest line of level 7's answer").toBeGreaterThanOrEqual(60);
  expect(measured.spill, "level 7's answer pans sideways").toBe(0);
});

test("scrolls down to the building and back up to the lesson in one box", async ({ page }) => {
  // The other half of the promise: a too-tall card scrolls past, with the
  // building at the foot of the scroll. Level 7 fully expanded is the tallest the track gets.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#level=tutorial-7");
  await expect(page.locator(".tutorialpanel")).toBeVisible();
  // Opened through the DOM, not by clicking each summary: nothing here closes
  // one disclosure when another opens, so all four open is a state a player can reach too.
  await page.locator(".tutorial details").evaluateAll((all) => {
    for (const disclosure of all) {
      (disclosure as HTMLDetailsElement).open = true;
    }
  });

  const scrolled = await page.locator(".stagearea").evaluate((area) => {
    const card = area.querySelector(".tutorial");
    const world = area.querySelector(".world");
    if (card === null || world === null) {
      throw new Error("the stage area is missing the card or the building");
    }
    const view = area.getBoundingClientRect();
    const start = card.getBoundingClientRect().top - view.top;
    area.scrollTop = area.scrollHeight;
    const foot = world.getBoundingClientRect();
    area.scrollTop = 0;
    return {
      room: area.scrollHeight - area.clientHeight,
      taller: card.getBoundingClientRect().height - area.clientHeight,
      start,
      back: card.getBoundingClientRect().top - view.top,
      worldHeight: foot.height,
      worldBottom: foot.bottom - view.bottom,
    };
  });

  expect(scrolled.room, "the stage area has nothing to scroll").toBeGreaterThan(0);
  expect(scrolled.taller, "level 7 with every hint open still fits the pane").toBeGreaterThan(0);
  // At the foot of the scroll the building's own foot should land on the
  // box's, since it's the last thing in the column.
  expect(
    Math.abs(scrolled.worldBottom),
    "the building at the foot of the scroll",
  ).toBeLessThanOrEqual(1);
  // A fully expanded card is the one case where the building sits at its minimum-floor height.
  expect(scrolled.worldHeight, "the building under a fully opened lesson").toBeCloseTo(96, 0);
  // Scrolling back returns to the same reading position - the whole point of
  // sharing one box between the lesson and the building.
  expect(scrolled.start, "the lesson card before the scroll").toBeCloseTo(18, 0);
  expect(scrolled.back, "the lesson card after scrolling back").toBeCloseTo(scrolled.start, 0);
});

test("costs the levels nothing: the widest building in the game still fits its pane", async ({
  page,
}) => {
  // This box affects every route, and levels (not just the tutorial) are
  // where a regression could go unnoticed. Level 18 builds the widest house in
  // the game; it used to size the world to the building instead of the pane, clipping two shafts.
  // Measured at both widths, since the splitter can change the pane size without the window moving.

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
 * Not swept at phone widths: the game page has a 1040x600 floor instead of
 * reflowing for a phone, since a building pane and a code pane side by side
 * need more room than a phone width gives.
 */
