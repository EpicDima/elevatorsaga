/**
 * App bar's trailing toolbar: the docs opener and the settings popover, gluing together
 * the theme, layout, language, and seed features plus a static About block.
 */

import { presentSeedPanel, seedPanelTemplate } from "#features/manage-seed/index.ts";
import { presentLanguagePicker } from "#features/switch-language/index.ts";
import { buildLayoutSwitchSkeleton, presentLayoutSwitch } from "#features/switch-layout/index.ts";
import type { LayoutModeId, LayoutSwitchLabels } from "#features/switch-layout/index.ts";
import { buildThemeSwitchSkeleton, presentThemeSwitch } from "#features/switch-theme/index.ts";
import type { ThemeSwitchLabels } from "#features/switch-theme/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createDisclosure } from "#shared/ui/disclosure.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";

/** This fork's own repository, linked from the About block. */
const FORK_URL = "https://github.com/EpicDima/elevatorsaga";
/** {@link FORK_URL}'s address, as the reader sees it under the link's name. */
const FORK_DOMAIN = "github.com/EpicDima/elevatorsaga";
/** The game this is forked from, linked from the About block. */
const ORIGINAL_URL = "https://github.com/magwo/elevatorsaga";
/** {@link ORIGINAL_URL}'s address, as the reader sees it under the link's name. */
const ORIGINAL_DOMAIN = "github.com/magwo/elevatorsaga";

/**
 * Toolbar's inert markup — theme/layout/language blocks empty, ready for {@link presentAppBarSettings}.
 * @param seed - `null` renders no seed block at all.
 */
export function appBarSettingsTemplate(seed: SeedLinkData | null): string {
  const docsLabel = t("game.appBar.docsOpenLabel");
  const settingsLabel = t("game.appBar.settingsLabel");
  const hotkeysLabel = t("game.appBar.hotkeysOpenLabel");
  const themeCaption = t("game.switchTheme.caption");
  const layoutCaption = t("game.switchLayout.caption");
  const languageCaption = t("page.language.label");
  const aboutCaption = t("game.appBar.aboutCaption");
  const forkLabel = t("game.appBar.aboutForkLabel");
  const originalLabel = t("game.appBar.aboutOriginalLabel");
  const copyright = t("game.appBar.aboutCopyright.html");

  return markup`<button type="button" class="ghost docsopen" title="${docsLabel}" aria-haspopup="dialog">${raw(spriteIconMarkup("book"))}<span class="lbl">${docsLabel}</span></button><div class="setwrap"><button type="button" class="ghost setopen" aria-expanded="false" aria-haspopup="true" title="${settingsLabel}" aria-label="${settingsLabel}">${raw(spriteIconMarkup("slider"))}<span class="lbl">${settingsLabel}</span></button><div class="setmenu" hidden><div class="setblock" data-set-block="theme"><span class="cap">${themeCaption}</span></div><div class="setblock" data-set-block="layout"><span class="cap">${layoutCaption}</span></div><div class="setblock" data-set-block="language"><span class="cap">${languageCaption}</span><select class="langpick" aria-label="${languageCaption}"></select></div><div data-set-block="seed">${raw(seedPanelTemplate(seed))}</div><div class="setblock" data-set-block="hotkeys"><button type="button" class="setrow keysopen" aria-haspopup="dialog">${raw(spriteIconMarkup("keys"))}<span>${hotkeysLabel}</span>${raw(spriteIconMarkup("right", "chev"))}</button></div><div class="setblock" data-set-block="about"><span class="cap">${aboutCaption}</span><a class="setlink" href="${FORK_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${forkLabel}</b><small>${FORK_DOMAIN}</small></span></a><a class="setlink" href="${ORIGINAL_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${originalLabel}</b><small>${ORIGINAL_DOMAIN}</small></span></a><p class="sethint">${raw(copyright)}</p></div></div></div>`;
}

/** What {@link presentAppBarSettings} needs in order to drive the toolbar it fills in. */
export interface AppBarSettingsOptions {
  /** Where the resolved theme is written, as `root.dataset.theme`. */
  readonly root: HTMLElement;
  /** Where the theme and the language are each remembered between visits. */
  readonly storage: Storage;
  /** Whether the system's own color scheme is dark right now — see `presentThemeSwitch`'s option of the same name. */
  readonly prefersDark: () => boolean;
  /** The layout mode the switch opens showing as pressed — the caller's own current layout mode. */
  readonly initialLayoutMode: LayoutModeId;
  /** Called when a layout button is pressed, with the mode it chooses. */
  readonly onSelectLayout: (mode: LayoutModeId) => void;
  /** Puts what is already on screen into the language just chosen — see `presentLanguagePicker`'s option of the same name. */
  readonly redrawLanguage: () => void;
  /** The run in progress' seed, or `null` — must match whatever {@link appBarSettingsTemplate} was called with. */
  readonly seed: SeedLinkData | null;
  /** Called with a player-chosen seed already validated against `#shared/lib/seed.ts`. */
  readonly onSeed: (seed: string) => void;
  /** Called when `docsOpen` is pressed. */
  readonly onOpenDocs: () => void;
  /** Called when the popover's `keysOpen` row is pressed, after the popover has already closed. */
  readonly onOpenHotkeys: () => void;
}

/** What a mounted toolbar hands back, for keeping it in step with state that changed elsewhere. */
export interface AppBarSettingsController {
  /** Re-resolves and re-applies the theme, while the player's own choice is "system" — see `ThemeSwitchController.notifySystemChange`. */
  notifySystemThemeChange(): void;
  /** Marks a layout mode as the pressed one, without calling {@link AppBarSettingsOptions.onSelectLayout} — see `LayoutSwitchController.setActiveMode`. */
  setActiveLayoutMode(mode: LayoutModeId): void;
  /** Redraws the seed block for the run in progress, or clears it for `null`. */
  setSeed(seed: SeedLinkData | null): void;
  /**
   * Re-derives every `t()`-sourced label this toolbar drew, for a language change.
   * Touches only text — applied theme, pressed layout mode, and popover open state are untouched.
   */
  update(): void;
}

/**
 * Fills in the theme, layout and language blocks, and wires the popover and both openers.
 * Call once, against a `parent` already holding {@link appBarSettingsTemplate}'s markup.
 */
export function presentAppBarSettings(
  parent: HTMLElement,
  options: AppBarSettingsOptions,
): AppBarSettingsController {
  const document = parent.ownerDocument;

  const docsOpen = requireElement(".docsopen", parent);
  const setOpen = requireElement(".setopen", parent);
  const setMenu = requireElement(".setmenu", parent);
  const themeBlock = requireElement('[data-set-block="theme"]', parent);
  const layoutBlock = requireElement('[data-set-block="layout"]', parent);
  const languageBlock = requireElement('[data-set-block="language"]', parent);
  const seedBlock = requireElement('[data-set-block="seed"]', parent);
  const hotkeysBlock = requireElement('[data-set-block="hotkeys"]', parent);
  const aboutBlock = requireElement('[data-set-block="about"]', parent);
  const keysOpen = requireElement(".keysopen", parent);

  const docsLabelEl = requireElement(".lbl", docsOpen);
  const setLabelEl = requireElement(".lbl", setOpen);
  const themeCaptionEl = requireElement(".cap", themeBlock);
  const layoutCaptionEl = requireElement(".cap", layoutBlock);
  const languageCaptionEl = requireElement(".cap", languageBlock);
  const hotkeysLabelEl = requireElement("span", hotkeysBlock);
  const aboutCaptionEl = requireElement(".cap", aboutBlock);
  const setLinks = aboutBlock.querySelectorAll("a.setlink");
  const [forkLinkEl, originalLinkEl] = setLinks;
  if (forkLinkEl === undefined || originalLinkEl === undefined) {
    // Unreachable against this module's own markup; guarded for a caller that hands in something else.
    throw new TypeError("Expected two a.setlink elements in the about block");
  }
  const forkLabelEl = requireElement("b", forkLinkEl);
  const originalLabelEl = requireElement("b", originalLinkEl);
  const copyrightEl = requireElement(".sethint", aboutBlock);

  const languageSelect = requireElement(".langpick", parent);
  if (!(languageSelect instanceof HTMLSelectElement)) {
    // Unreachable against this module's own markup; guarded for a caller that hands in something else.
    throw new TypeError("Expected .langpick to be a <select>");
  }

  /** Freshly `t()`-sourced, for both the initial build and every {@link AppBarSettingsController.update}. */
  const themeLabels = (): ThemeSwitchLabels => ({
    group: t("game.switchTheme.caption"),
    buttons: {
      system: t("game.switchTheme.system"),
      light: t("game.switchTheme.light"),
      dark: t("game.switchTheme.dark"),
    },
  });
  /** Freshly `t()`-sourced, for both the initial build and every {@link AppBarSettingsController.update}. */
  const layoutLabels = (): LayoutSwitchLabels => ({
    group: t("game.switchLayout.caption"),
    buttons: {
      left: t("game.switchLayout.left"),
      right: t("game.switchLayout.right"),
      code: t("game.switchLayout.onlyCode"),
      game: t("game.switchLayout.onlyGame"),
    },
  });

  const themeElements = buildThemeSwitchSkeleton(document, themeLabels());
  themeBlock.append(themeElements.group);
  const theme = presentThemeSwitch({
    elements: themeElements,
    root: options.root,
    storage: options.storage,
    prefersDark: options.prefersDark,
  });

  const layoutElements = buildLayoutSwitchSkeleton(document, layoutLabels());
  layoutBlock.append(layoutElements.group);
  const layout = presentLayoutSwitch({
    elements: layoutElements,
    initialMode: options.initialLayoutMode,
    onSelect: options.onSelectLayout,
  });

  presentLanguagePicker({
    select: languageSelect,
    storage: options.storage,
    redraw: options.redrawLanguage,
  });

  presentSeedPanel(seedBlock, { onSeed: options.onSeed });

  const disclosure = createDisclosure(setOpen, setMenu);

  docsOpen.addEventListener("click", () => {
    options.onOpenDocs();
  });
  keysOpen.addEventListener("click", () => {
    disclosure.close();
    options.onOpenHotkeys();
  });

  return {
    notifySystemThemeChange(): void {
      theme.notifySystemChange();
    },
    setActiveLayoutMode(mode: LayoutModeId): void {
      layout.setActiveMode(mode);
    },
    setSeed(seed: SeedLinkData | null): void {
      // Restores focus by selector: rebuilding the block would otherwise drop it to
      // <body>, stranding a keyboard player behind a still-open popover.
      const focused = seedBlock.ownerDocument.activeElement;
      const owned =
        focused instanceof HTMLElement && seedBlock.contains(focused)
          ? [".seedvalue", ".seednewdraw", ".seedlink"].find((selector) =>
              focused.matches(selector),
            )
          : undefined;

      seedBlock.innerHTML = seedPanelTemplate(seed);

      if (owned !== undefined) {
        const replacement = seedBlock.querySelector(owned);
        if (replacement instanceof HTMLElement) {
          replacement.focus();
        }
      }
    },
    update(): void {
      const docsLabel = t("game.appBar.docsOpenLabel");
      const settingsLabel = t("game.appBar.settingsLabel");
      const hotkeysLabel = t("game.appBar.hotkeysOpenLabel");
      const languageCaption = t("page.language.label");

      docsOpen.title = docsLabel;
      docsLabelEl.textContent = docsLabel;
      setOpen.title = settingsLabel;
      setOpen.setAttribute("aria-label", settingsLabel);
      setLabelEl.textContent = settingsLabel;
      themeCaptionEl.textContent = t("game.switchTheme.caption");
      layoutCaptionEl.textContent = t("game.switchLayout.caption");
      languageCaptionEl.textContent = languageCaption;
      languageSelect.setAttribute("aria-label", languageCaption);
      hotkeysLabelEl.textContent = hotkeysLabel;
      aboutCaptionEl.textContent = t("game.appBar.aboutCaption");
      forkLabelEl.textContent = t("game.appBar.aboutForkLabel");
      originalLabelEl.textContent = t("game.appBar.aboutOriginalLabel");
      // `innerHTML`, not `textContent`: the `.html` key suffix marks this as trusted markup.
      copyrightEl.innerHTML = t("game.appBar.aboutCopyright.html");

      theme.relabel(themeLabels());
      layout.relabel(layoutLabels());
    },
  };
}
