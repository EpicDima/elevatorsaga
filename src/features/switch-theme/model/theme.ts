/**
 * The three-way colour theme: follow the system, or pin light or dark.
 *
 * "Follow the system" is not a fallback but the starting choice, the same way
 * `DEFAULT_LAYOUT_MODE` is a real mode and not a placeholder for "nothing
 * chosen yet" — until a player picks otherwise, the page tracks the browser's
 * own light/dark preference.
 *
 * This module is the pure half — the type, the default, and storage, no DOM
 * and no `matchMedia`. The half that draws the three buttons and reacts to a
 * system change is `../ui/theme-switch.ts`.
 */

/** Which theme choice is remembered: follow the system, or pin one. */
export type Theme = "system" | "light" | "dark";

/** Every {@link Theme}, for validating a stored one and for drawing the switch. */
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The choice the page opens with until a player has chosen otherwise. */
export const DEFAULT_THEME: Theme = "system";

/**
 * Where the chosen theme is remembered between visits.
 *
 * `develevate…` like this fork's other invented keys — see
 * `src/entities/tutorial-level/model/progress.ts` for why the prefix matters.
 */
export const THEME_STORAGE_KEY = "develevateTheme";

/**
 * Whether a stored string names a real theme choice.
 *
 * @param value - The candidate.
 * @returns Whether it is one of {@link THEMES}.
 */
function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * The theme choice remembered from a previous visit.
 *
 * Anything unreadable or unrecognised is treated as "nothing chosen yet"
 * rather than reported, the same trade `readLayoutMode` makes: there is
 * nothing a player can do about a corrupt entry, and the next choice
 * overwrites it.
 *
 * @param storage - Where the choice is remembered.
 * @returns The remembered choice, or {@link DEFAULT_THEME}.
 */
export function readTheme(storage: Storage): Theme {
  let stored: string | null;
  try {
    stored = storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return DEFAULT_THEME;
  }
  return stored !== null && isTheme(stored) ? stored : DEFAULT_THEME;
}

/**
 * Remembers the chosen theme, or does not.
 *
 * A store that refuses the write is not an error here: the choice made just
 * now is what matters for this tab, not whether it survives to the next one.
 *
 * @param storage - Where to remember it.
 * @param theme - The choice to remember.
 */
export function saveTheme(storage: Storage, theme: Theme): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // As above: a browser that refuses storage should not stop the game.
  }
}

/**
 * Resolves a theme choice to the one of two colour schemes it actually draws.
 *
 * `"system"` follows whatever the caller's own media query says right now; a
 * pinned choice ignores it entirely.
 *
 * @param theme - The player's choice.
 * @param prefersDark - Whether the system's own preference is dark right now
 * — the caller's `matchMedia("(prefers-color-scheme: dark)").matches`, taken
 * as a value rather than read from `window` in here so this stays pure; see
 * `ThemeSwitchOptions.prefersDark` for why the DOM half takes it as a
 * function instead of a single snapshot.
 * @returns The scheme to actually draw.
 */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}
