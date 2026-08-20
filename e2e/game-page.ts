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
 * `CodeEditor.#resolveLevelStarterCode` falls back to for level 1's
 * first slot when nothing has been saved under its own key yet.
 *
 * Spelled out rather than imported from `src/ui/editor.ts` deliberately: the
 * key is a compatibility promise to everyone who has a program saved in the
 * legacy game, so the test should fail if it is ever renamed, not follow it.
 */
export const CODE_STORAGE_KEY = "elevatorCrushCode_v5";

/**
 * Where level 1's first code slot is persisted — the buffer open on the
 * default route, and the one every "take this program" action writes into.
 *
 * Spelled out for the same reason {@link CODE_STORAGE_KEY} is: a rename in
 * `src/ui/editor.ts` should fail a test here rather than pass unnoticed.
 */
export const LEVEL_ONE_SLOT_ONE_STORAGE_KEY = "develevateChallengeCode_0_1";

/**
 * Where the tier earned on each numbered level is remembered between visits,
 * and so where the game reads what this browser has unlocked.
 *
 * Spelled out rather than imported from
 * `src/entities/level-tier/model/best-tier.ts` for the reason
 * {@link CODE_STORAGE_KEY} is: a spec that read the key from the code under
 * test would go on passing after a rename that had silently reset every
 * player's progress.
 */
export const LEVEL_TIER_STORAGE_KEY = "develevateChallengeTiers";

/**
 * Makes this browser one that has already earned its way to a level, so a spec
 * may open the level it is actually about.
 *
 * A numbered level is shut until the one before it has been cleared — in the
 * switcher, which draws it as a disabled button, and in the router, which
 * answers `#level=18` from a browser that has cleared nothing with the
 * first level and a warning. Every spec that opens a level past the first has
 * to be a player who could have opened it, and this is how it becomes one: a
 * bronze on record for each level below, written before any of the page's own
 * scripts run.
 *
 * Bronze because the rule reads presence and not rank — clearing at all is
 * what opens the next one — so this asserts nothing about how well the levels
 * below were played.
 *
 * The record is left alone when there already is one, which matters because an
 * init script runs again on every navigation: a spec that wins a level and then
 * reloads would otherwise have the win overwritten by this fixture on the way
 * back in.
 *
 * @param page - The page under test, before its first `goto`.
 * @param number - The level to open, counting from 1.
 */
export async function unlockLevel(page: Page, number: number): Promise<void> {
  const earned: Record<number, string> = {};
  for (let index = 0; index < number - 1; index += 1) {
    earned[index] = "bronze";
  }
  await page.addInitScript(
    (record: { key: string; tiers: string }) => {
      if (localStorage.getItem(record.key) === null) {
        localStorage.setItem(record.key, record.tiers);
      }
    },
    { key: LEVEL_TIER_STORAGE_KEY, tiers: JSON.stringify(earned) },
  );
}

/**
 * Plants a program in one level's first code slot, before the page's own
 * scripts run.
 *
 * {@link seedCode} does the same for level 1 through the legacy key, which
 * is the migration source for that one slot alone. This is the way to hand a
 * program to any other level: the key is written directly, in the shape
 * `levelCodeKey` builds it, and spelled out here for the reason
 * {@link CODE_STORAGE_KEY} is.
 *
 * @param page - The page under test, before its first `goto`.
 * @param number - The level whose slot to fill, counting from 1.
 * @param code - The program to store.
 */
export async function seedLevelCode(page: Page, number: number, code: string): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; code: string }) => {
      localStorage.setItem(seed.key, seed.code);
    },
    { key: `develevateChallengeCode_${String(number - 1)}_1`, code },
  );
}

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
 * The button that starts, pauses and resumes the run.
 *
 * `exact` is not decoration: the same row carries "Start over", and Playwright's
 * accessible-name matching is a substring match, so `{ name: "Start" }` on its
 * own resolves to both and fails the whole locator as ambiguous.
 *
 * @param page - The page under test.
 * @param name - The button's label in the language on screen: `Start` before a
 * run and once one has ended, `Pause` while the world is drawing, `Resume`
 * where a started run stands still, `Crunching...` during an instant run.
 * @returns The start/pause button.
 */
export function startButton(page: Page, name = "Start"): Locator {
  return page.getByRole("button", { name, exact: true });
}

/**
 * The run speed's group, holding both arrows and the reading between them.
 *
 * @param page - The page under test.
 * @param name - The group's accessible name in the language on screen.
 * @returns The speed control.
 */
export function speedControl(page: Page, name = "Run speed"): Locator {
  return page.getByRole("group", { name });
}

/**
 * The speed the control is currently on, as it is written on screen.
 *
 * By class, inside the group found by its name — the third exception alongside
 * {@link statistic} and {@link languagePicker}, and for {@link statistic}'s
 * reason: the reading is a live region rather than a control, so it has no role
 * and no name of its own to be found by.
 *
 * @param page - The page under test.
 * @param name - The group's accessible name in the language on screen.
 * @returns The `∞x` or `8x` between the two arrows.
 */
export function speedValue(page: Page, name = "Run speed"): Locator {
  return speedControl(page, name).locator(".speed-val");
}

/**
 * Puts the speed control on its last stop, where a run is crunched headlessly
 * to its result instead of being drawn.
 *
 * Pressed rather than jumped to, because there is no other way in: the stop is
 * app state and not a time scale, so no `#timescale=` in the URL reaches it.
 * "Faster" disables itself on arrival, which is what ends the loop — and what
 * makes this safe to call from any speed the URL or a previous step left.
 *
 * @param page - The page under test.
 * @param name - "Faster"'s accessible name in the language on screen.
 */
export async function selectInstantSpeed(page: Page, name = "Faster"): Promise<void> {
  const faster = page.getByRole("button", { name, exact: true });
  while (await faster.isEnabled()) {
    await faster.click();
  }
}

/**
 * The game's language picker, in the app bar's settings popover.
 *
 * The page ships one, and it is behind the popover: the header that used to
 * carry a second one is gone. Opened the same way {@link seedText} opens it,
 * because a `<select>` inside a `hidden` panel cannot be operated. By class
 * rather than by its accessible name ("Language"/"Язык"), the other exception
 * alongside {@link statistic}: the name is what the specs below assert *about*
 * this control, and a locator built out of it could not fail that assertion.
 *
 * @param page - The page under test.
 * @returns The settings popover's language `<select>`.
 */
export async function languagePicker(page: Page): Promise<Locator> {
  await openSettingsMenu(page);
  return page.locator(".setmenu .langpick");
}

/**
 * One value from the statistics panel.
 *
 * The panel pairs a caption and a value as two sibling `<span>`s (`.cap` and
 * `.tile-val`) inside a `.tile`, with no programmatic association between
 * them, so there is no role or accessible name to reach the value by; the
 * tile is found by its visible caption and the value is then taken
 * positionally.
 *
 * Nine of the panel's eleven figures sit behind the "Все показатели"/"All
 * figures" disclosure, closed by default -- opened directly rather than
 * clicked, so this is idempotent regardless of which figure a spec asked for
 * last and does not race a click against the panel's own redraw.
 *
 * @param page - The page under test.
 * @param label - The tile's visible caption, e.g. `"Transported"`.
 * @returns The value cell of that tile.
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

/**
 * Reads a statistic as a number.
 *
 * Units are dropped, so `"12s"` reads as `12`.
 *
 * @param page - The page under test.
 * @param label - The tile's visible caption, e.g. `"Transported"`.
 * @returns The value, or `NaN` while the panel is still empty.
 */
export async function statisticValue(page: Page, label: string): Promise<number> {
  const value = await statistic(page, label);
  const text = (await value.innerText()).replace(/[^\d.-]/g, "");
  return Number.parseFloat(text);
}

/**
 * Opens the app bar's settings popover — the theme, layout, language and seed
 * blocks all live behind it, closed by default (`.setmenu[hidden]`).
 *
 * Forced open directly rather than clicked, the same reason {@link statistic}
 * forces its own disclosure open rather than clicking it: idempotent
 * regardless of what a previous call, or a click a spec made of its own, left
 * the popover in, and unaffected by the outside-click listener `createDisclosure`
 * wires onto `.setopen` — a real click risks re-closing a popover a previous
 * step already opened.
 *
 * @param page - The page under test.
 */
export async function openSettingsMenu(page: Page): Promise<void> {
  await page.locator(".setmenu").evaluate((menu) => {
    (menu as HTMLElement).hidden = false;
  });
}

/**
 * The current run's seed, as shown in the app bar's settings popover.
 *
 * The seed itself is never the control: it sits in the row's own box
 * (`.seedvalue`) whether or not the run is pinned, and the one link beside it
 * is an icon carrying no text at all — see `seedPanelTemplate`'s module
 * comment. So there is exactly one place in the document the seed is written,
 * and this is it.
 *
 * @param page - The page under test.
 * @returns The seed's own text.
 */
export async function seedText(page: Page): Promise<Locator> {
  await openSettingsMenu(page);
  return page.locator(".setmenu .seedvalue");
}

/**
 * Reads the program the page has persisted for level 1's first slot — the
 * one open on the default route, and the one every spec below lands on.
 *
 * @param page - The page under test.
 * @returns The stored program, or `null` when nothing has been stored.
 */
export function storedCode(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), LEVEL_ONE_SLOT_ONE_STORAGE_KEY);
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
