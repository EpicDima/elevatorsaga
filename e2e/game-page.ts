/**
 * Shared locators for the end-to-end smoke tests, anchored on what a player
 * can see or a screen reader can announce rather than on class names.
 * {@link statistic} is the one exception, explained where it's defined.
 */

import type { Locator, Page } from "@playwright/test";

/**
 * Where the player's program was persisted, and still is once, as level 1's
 * fallback starter. Spelled out rather than imported from `src/ui/editor.ts`
 * deliberately: a rename there should fail this test, not follow it.
 */
export const CODE_STORAGE_KEY = "elevatorCrushCode_v5";

/**
 * Where level 1's first code slot is persisted - the buffer open by default.
 * Spelled out for the same reason {@link CODE_STORAGE_KEY} is.
 */
export const LEVEL_ONE_SLOT_ONE_STORAGE_KEY = "develevateChallengeCode_0_1";

/**
 * Plants a program in one of a level's code slots before the page's own
 * scripts run. `slot` defaults to 1, the slot every level opens on; only a
 * spec about the switcher needs another.
 */
export async function seedLevelCode(
  page: Page,
  number: number,
  code: string,
  slot = 1,
): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; code: string }) => {
      localStorage.setItem(seed.key, seed.code);
    },
    { key: `develevateChallengeCode_${String(number - 1)}_${String(slot)}`, code },
  );
}

/**
 * Plants a program in one of a lesson's code slots, the same way
 * {@link seedLevelCode} does for a numbered level. Only the second and third
 * slots carry a suffix, so `slot` defaults to the bare key the first opens on.
 */
export async function seedLessonCode(
  page: Page,
  levelId: string,
  code: string,
  slot = 1,
): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; code: string }) => {
      localStorage.setItem(seed.key, seed.code);
    },
    {
      key: `develevateTutorialCode_${levelId}${slot === 1 ? "" : `_${String(slot)}`}`,
      code,
    },
  );
}

/**
 * The CodeMirror editing surface, found by its accessible name - a translated
 * string, so a spec in another language must pass the name it expects.
 */
export function editor(page: Page, name = "Elevator program"): Locator {
  return page.getByRole("textbox", { name });
}

/** The building region: floors, elevators and passengers. */
export function building(page: Page): Locator {
  return page.getByRole("region", { name: "Building" });
}

/**
 * The button that starts, pauses and resumes the run. `exact` matters: the
 * same row has "Start over", and accessible-name matching is a substring
 * match, so `{ name: "Start" }` alone would match both and fail as ambiguous.
 */
export function startButton(page: Page, name = "Start"): Locator {
  return page.getByRole("button", { name, exact: true });
}

/** The run speed's group, holding both arrows and the reading between them. */
export function speedControl(page: Page, name = "Run speed"): Locator {
  return page.getByRole("group", { name });
}

/**
 * The speed the control is currently on, as shown on screen. Found by class,
 * since the reading is a live region with no role or name of its own to
 * search by (like {@link statistic}).
 */
export function speedValue(page: Page, name = "Run speed"): Locator {
  return speedControl(page, name).locator(".speed-val");
}

/**
 * Puts the speed control on its last stop, running headlessly to the result.
 * Pressed, not set via URL, since the stop is app state with no
 * `#timescale=` reaching it; "Faster" disables itself on arrival, ending the loop.
 */
export async function selectInstantSpeed(page: Page, name = "Faster"): Promise<void> {
  const faster = page.getByRole("button", { name, exact: true });
  while (await faster.isEnabled()) {
    await faster.click();
  }
}

/**
 * The game's language picker, in the app bar's settings popover. Opened the
 * same way {@link seedField} is, since a `<select>` inside a hidden panel
 * can't be operated. Found by class, not name: the specs assert the name itself.
 */
export async function languagePicker(page: Page): Promise<Locator> {
  await openSettingsMenu(page);
  return page.locator(".setmenu .langpick");
}

/**
 * One value from the statistics panel, found by its tile's caption (`exact`, since
 * "Transported" prefixes "Transported per sec") since the value itself has no accessible
 * name. Opens the "All figures" disclosure directly, so repeated calls don't race a redraw.
 */
export async function statistic(page: Page, label: string): Promise<Locator> {
  await page.locator(".statspanel .more").evaluate((details) => {
    (details as HTMLDetailsElement).open = true;
  });
  return page
    .locator(".tile")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator(".tile-val");
}

/** Reads a statistic as a number, dropping units (so `"12s"` reads as `12`). */
export async function statisticValue(page: Page, label: string): Promise<number> {
  const value = await statistic(page, label);
  const text = (await value.innerText()).replace(/[^\d.-]/g, "");
  return Number.parseFloat(text);
}

/**
 * Opens the app bar's settings popover (theme, layout, language, seed).
 * Forced open directly rather than clicked, so it's idempotent regardless of
 * a previous call's state and unaffected by the popover's outside-click listener.
 */
export async function openSettingsMenu(page: Page): Promise<void> {
  await page.locator(".setmenu").evaluate((menu) => {
    (menu as HTMLElement).hidden = false;
  });
}

/**
 * The current run's seed, in the settings popover. A text `<input>`, so read
 * it with `inputValue()`/`toHaveValue` - `innerText` on an `<input>` is empty
 * and would make an assertion compare nothing to nothing.
 */
export async function seedField(page: Page): Promise<Locator> {
  await openSettingsMenu(page);
  return page.locator(".setmenu .seedvalue");
}

/** Reads the program persisted for level 1's first slot - the default route's buffer. */
export function storedCode(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), LEVEL_ONE_SLOT_ONE_STORAGE_KEY);
}

/**
 * Seeds a program into storage before the page's own scripts run, to put the
 * editor in a known state (a broken program, in particular) without typing it in.
 */
export async function seedCode(page: Page, code: string): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; code: string }) => {
      localStorage.setItem(seed.key, seed.code);
    },
    { key: CODE_STORAGE_KEY, code },
  );
}
