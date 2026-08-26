/**
 * The three-way theme switch: a group of `system`/`light`/`dark` buttons,
 * composed into `widgets/app-bar`'s settings menu.
 *
 * Split into a skeleton builder and a presenter, so a caller with its own
 * markup can skip the builder. The system preference and the root element to
 * write the scheme onto are both caller-supplied rather than read from
 * `matchMedia`/`document.documentElement` directly.
 */

import { readTheme, resolveTheme, saveTheme, THEMES, type Theme } from "../model/theme.ts";

/** The text read out for each part of the switch; supplied by the caller so this module stays free of any one locale. */
export interface ThemeSwitchLabels {
  /** `aria-label` of the `[role=group]` wrapping the three buttons. */
  readonly group: string;
  /** Visible text of each button, keyed by the theme it chooses. */
  readonly buttons: Readonly<Record<Theme, string>>;
}

/** The elements {@link buildThemeSwitchSkeleton} builds. */
export interface ThemeSwitchElements {
  /** The `[role=group]` wrapping the three buttons. */
  readonly group: HTMLElement;
  /** `data-theme-btn="system"`. */
  readonly system: HTMLElement;
  /** `data-theme-btn="light"`. */
  readonly light: HTMLElement;
  /** `data-theme-btn="dark"`. */
  readonly dark: HTMLElement;
}

/** Builds the theme switch's DOM skeleton, detached from any document. */
export function buildThemeSwitchSkeleton(
  document: Document,
  labels: ThemeSwitchLabels,
): ThemeSwitchElements {
  const group = document.createElement("div");
  group.className = "seg seg-text";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", labels.group);

  const buildButton = (theme: Theme): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["themeBtn"] = theme;
    button.setAttribute("aria-pressed", "false");
    button.textContent = labels.buttons[theme];
    return button;
  };

  const system = buildButton("system");
  const light = buildButton("light");
  const dark = buildButton("dark");
  group.append(system, light, dark);

  return { group, system, light, dark };
}

/** What {@link presentThemeSwitch} needs to drive the switch. */
export interface ThemeSwitchOptions {
  /** The buttons to wire, from {@link buildThemeSwitchSkeleton} or a caller's own markup. */
  readonly elements: ThemeSwitchElements;
  /**
   * The element the resolved scheme is written to, as `root.dataset.theme` —
   * `document.documentElement` on a real page.
   */
  readonly root: HTMLElement;
  /** Where the chosen theme is remembered between visits. */
  readonly storage: Storage;
  /** Whether the system's own color scheme is dark right now; read at construction and on every {@link ThemeSwitchController.notifySystemChange}. */
  readonly prefersDark: () => boolean;
}

/** What a mounted theme switch hands back. */
export interface ThemeSwitchController {
  /** Re-resolves and re-applies the theme, but only while the player's own choice is "system". */
  notifySystemChange(): void;
  /** Re-applies {@link ThemeSwitchLabels} after a language change; touches only text, not the chosen theme. */
  relabel(labels: ThemeSwitchLabels): void;
}

/** Wires the three theme buttons up, restoring the choice a player left behind and applying it immediately. */
export function presentThemeSwitch(options: ThemeSwitchOptions): ThemeSwitchController {
  const { elements, root, storage, prefersDark } = options;
  const buttons: Readonly<Record<Theme, HTMLElement>> = {
    system: elements.system,
    light: elements.light,
    dark: elements.dark,
  };

  let theme: Theme = readTheme(storage);

  /** Writes the resolved scheme onto `root` and updates every `aria-pressed`. */
  const apply = (): void => {
    root.dataset["theme"] = resolveTheme(theme, prefersDark());
    for (const candidate of THEMES) {
      buttons[candidate].setAttribute("aria-pressed", String(candidate === theme));
    }
  };

  apply();

  for (const candidate of THEMES) {
    buttons[candidate].addEventListener("click", () => {
      // Re-applies unconditionally, even for the already-selected button: applying is cheap and idempotent.
      theme = candidate;
      apply();
      saveTheme(storage, theme);
    });
  }

  return {
    notifySystemChange(): void {
      if (theme === "system") {
        apply();
      }
    },
    relabel(labels: ThemeSwitchLabels): void {
      elements.group.setAttribute("aria-label", labels.group);
      for (const candidate of THEMES) {
        buttons[candidate].textContent = labels.buttons[candidate];
      }
    },
  };
}
