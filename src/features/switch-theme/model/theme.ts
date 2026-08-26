/**
 * The three-way color theme: follow the system, or pin light or dark.
 *
 * This module is the pure half — type, default, and storage, no DOM and no
 * `matchMedia`. `../ui/theme-switch.ts` draws the buttons and reacts to a system change.
 */

/** Which theme choice is remembered: follow the system, or pin one. */
export type Theme = "system" | "light" | "dark";

/** Every {@link Theme}, for validating a stored one and for drawing the switch. */
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The choice the page opens with until a player has chosen otherwise. */
export const DEFAULT_THEME: Theme = "system";

/** Storage key for the theme choice. */
export const THEME_STORAGE_KEY = "develevateTheme";

/** Whether a stored string names a real theme choice. */
function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * The theme choice remembered from a previous visit.
 *
 * Storage can throw when access is refused; that and any unrecognized value
 * fall back to {@link DEFAULT_THEME} rather than being reported.
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

/** Remembers the chosen theme; a store that refuses the write shouldn't stop the choice from applying now. */
export function saveTheme(storage: Storage, theme: Theme): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignored: a browser that refuses storage should not stop the game.
  }
}

/** Resolves a theme choice to the one of two color schemes it actually draws; `"system"` follows `prefersDark`, a pinned choice ignores it. */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}
