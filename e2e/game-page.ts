/**
 * Shared locators for the end-to-end smoke tests.
 *
 * Everything here is anchored on what a player can see or a screen reader can
 * announce — roles, accessible names, visible text — rather than on the class
 * names the presenters happen to use. The one exception is
 * {@link statistic}, which is explained where it is defined.
 */

import type { Locator, Page } from "@playwright/test";

/**
 * Where the player's program used to be persisted, and still is, once: as the
 * starter {@link seedCode} plants for a page visited for the first time, which
 * `CodeEditor.#resolveChallengeStarterCode` falls back to for challenge 1's
 * first slot when nothing has been saved under its own key yet.
 *
 * Spelled out rather than imported from `src/ui/editor.ts` deliberately: the
 * key is a compatibility promise to everyone who has a program saved in the
 * legacy game, so the test should fail if it is ever renamed, not follow it.
 */
export const CODE_STORAGE_KEY = "elevatorCrushCode_v5";

/**
 * Where challenge 1's first code slot is persisted — the buffer open on the
 * default route, and the one every "take this program" action writes into.
 *
 * Spelled out for the same reason {@link CODE_STORAGE_KEY} is: a rename in
 * `src/ui/editor.ts` should fail a test here rather than pass unnoticed.
 */
export const CHALLENGE_ONE_SLOT_ONE_STORAGE_KEY = "develevateChallengeCode_0_1";

/**
 * The CodeMirror editing surface.
 *
 * Found by the name it is announced under, which is a translated string like
 * every other label on the page — so a spec reading the editor in another
 * language has to say which name it expects, the way `tutorial.spec.ts` does
 * for the learning track's landmark.
 *
 * @param page - The page under test.
 * @param name - The text box's accessible name in the language on screen.
 * @returns The editor's text box.
 */
export function editor(page: Page, name = "Elevator program"): Locator {
  return page.getByRole("textbox", { name });
}

/**
 * The building, including its floors, elevators and passengers.
 *
 * @param page - The page under test.
 * @returns The building region.
 */
export function building(page: Page): Locator {
  return page.getByRole("region", { name: "Building" });
}

/**
 * The button that starts, pauses and restarts the run.
 *
 * `exact` is not decoration: the same row carries "Start over", and Playwright's
 * accessible-name matching is a substring match, so `{ name: "Start" }` on its
 * own resolves to both and fails the whole locator as ambiguous.
 *
 * @param page - The page under test.
 * @param name - The button's label in the language on screen, which is `Start`,
 * `Pause` or `Restart` depending on the run.
 * @returns The start/pause button.
 */
export function startButton(page: Page, name = "Start"): Locator {
  return page.getByRole("button", { name, exact: true });
}

/**
 * The button that crunches the current challenge headlessly and shows its
 * outcome, without ever drawing the building while it runs.
 *
 * `exact` for the same reason {@link startButton} needs it: "Run instantly"
 * and "Crunching..." are not substrings of anything else in the row, but the
 * two labels this one button carries are each other's whole story, and a
 * locator that matched loosely could not tell "not running yet" from "still
 * running" apart.
 *
 * @param page - The page under test.
 * @param name - The button's label in the language on screen, `Run instantly`
 * or `Crunching...` depending on whether a crunch is under way.
 * @returns The instant-run button.
 */
export function runInstantButton(page: Page, name = "Run instantly"): Locator {
  return page.getByRole("button", { name, exact: true });
}

/**
 * The header's own language picker.
 *
 * By class rather than by its accessible name ("Language"/"Язык"), the other
 * exception alongside {@link statistic}: the settings popover's language
 * block carries the same label on a `<select>` of its own, and a locator is
 * not narrowed by an element being behind a closed `hidden` panel, so
 * `getByLabel` resolves both and fails as ambiguous. The two are one control
 * apart in every other way -- this is the one the header always shows.
 *
 * @param page - The page under test.
 * @returns The header's language `<select>`.
 */
export function languagePicker(page: Page): Locator {
  return page.locator(".languagepicker");
}

/**
 * One value from the statistics panel.
 *
 * The panel pairs a label and a value as two sibling `<span>`s with no
 * programmatic association between them, so there is no role or accessible name
 * to reach the value by; the row is found by its visible label and the value is
 * then taken positionally.
 *
 * @param page - The page under test.
 * @param label - The row's visible label, e.g. `"Transported"`.
 * @returns The value cell of that row.
 */
export function statistic(page: Page, label: string): Locator {
  return page
    .locator(".stat")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator(".value");
}

/**
 * Reads a statistic as a number.
 *
 * Units are dropped, so `"12s"` reads as `12`.
 *
 * @param page - The page under test.
 * @param label - The row's visible label, e.g. `"Transported"`.
 * @returns The value, or `NaN` while the panel is still empty.
 */
export async function statisticValue(page: Page, label: string): Promise<number> {
  const text = (await statistic(page, label).innerText()).replace(/[^\d.-]/g, "");
  return Number.parseFloat(text);
}

/**
 * Reads the program the page has persisted for challenge 1's first slot — the
 * one open on the default route, and the one every spec below lands on.
 *
 * @param page - The page under test.
 * @returns The stored program, or `null` when nothing has been stored.
 */
export function storedCode(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), CHALLENGE_ONE_SLOT_ONE_STORAGE_KEY);
}

/**
 * Seeds a program into storage before the page's own scripts run.
 *
 * Used to put the editor into a known state — a broken program, in particular —
 * without typing one in character by character.
 *
 * @param page - The page under test.
 * @param code - The program to store.
 */
export async function seedCode(page: Page, code: string): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; code: string }) => {
      localStorage.setItem(seed.key, seed.code);
    },
    { key: CODE_STORAGE_KEY, code },
  );
}
