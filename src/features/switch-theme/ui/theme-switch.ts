/**
 * The three-way theme switch: `design/ui-mockup.html`'s `.seg.seg-text`
 * group of `system`/`light`/`dark` buttons (§A).
 *
 * Nothing here is reachable yet. `presentThemeSwitch` is built and tested
 * ahead of the widget that will compose it — `widgets/app-bar`'s settings
 * menu, a later step of this same phase — the same "build inert first" staged
 * migration every other `features/*` slice in this batch follows.
 *
 * Split into a skeleton builder and a presenter, the same shape
 * `buildWorkspaceLayoutSkeleton`/`presentWorkspaceLayout` use: the builder
 * bakes in the labels once, and the presenter only wires behaviour, so a
 * caller that already has its own markup (a widget's own template literal,
 * say) can skip the builder and hand `presentThemeSwitch` elements it built
 * itself.
 *
 * The mockup reads and writes `window.matchMedia` and `document.documentElement`
 * directly; this module takes both as caller-supplied values instead —
 * {@link ThemeSwitchOptions.prefersDark} rather than calling `matchMedia` in
 * here, and {@link ThemeSwitchOptions.root} rather than reaching for
 * `document.documentElement` — the same reason `presentWorkspaceLayout` takes
 * a `root` option instead of assuming one. `prefersDark` is a function, not a
 * single boolean snapshot, because the choice can be "system" for the whole
 * time this switch is mounted: {@link ThemeSwitchController.notifySystemChange}
 * re-reads it whenever the caller's own `matchMedia(...).addEventListener("change", ...)`
 * fires, exactly as the mockup's own `darkQuery.addEventListener("change", ...)`
 * does.
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

/**
 * Builds the theme switch's DOM skeleton, detached from any document.
 *
 * @param document - The document to create the elements in, so a caller can
 * build into a document other than the global one — see
 * `buildWorkspaceLayoutSkeleton` for why.
 * @param labels - The localised text for the group and its three buttons.
 * @returns The group and its three buttons, ready for {@link presentThemeSwitch}.
 */
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
   * `document.documentElement` on a real page, matching the mockup's own
   * `html.dataset.theme`.
   */
  readonly root: HTMLElement;
  /** Where the chosen theme is remembered between visits. */
  readonly storage: Storage;
  /**
   * Whether the system's own colour scheme is dark right now. Read once at
   * construction and again on every {@link ThemeSwitchController.notifySystemChange}
   * call — never read spontaneously in here, so this module never touches
   * `window.matchMedia` itself.
   */
  readonly prefersDark: () => boolean;
}

/** What a mounted theme switch hands back. */
export interface ThemeSwitchController {
  /**
   * Re-resolves and re-applies the theme, but only while the player's own
   * choice is "system" — ported from the mockup's own `darkQuery`
   * `"change"` listener, `if (themeChoice === "system") applyTheme();`.
   *
   * Call this from the caller's own `matchMedia("(prefers-color-scheme: dark)")`
   * `"change"` listener; this module does not register one itself, for the
   * same reason it does not call `matchMedia` itself — see the module comment.
   */
  notifySystemChange(): void;
  /**
   * Re-applies {@link ThemeSwitchLabels} to the group and its three buttons,
   * for a caller redrawing after a language change — `buildThemeSwitchSkeleton`
   * only writes them once, at construction, so nothing else keeps them current.
   * Touches only text; which theme is chosen and applied is untouched.
   */
  relabel(labels: ThemeSwitchLabels): void;
}

/**
 * Wires the three theme buttons up, restoring the choice a player left
 * behind and applying it immediately.
 *
 * @param options - The buttons to wire, the element to write the resolved
 * scheme onto, the store, and the system preference reader.
 * @returns A controller for reacting to a system theme change.
 */
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
      // Ported from the mockup's own `setTheme`, which re-applies and
      // re-persists unconditionally rather than bailing out early when the
      // same button is pressed again — there is nothing to skip here, since
      // applying is cheap and idempotent.
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
