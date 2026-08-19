/**
 * The app bar's trailing toolbar: `design/ui-mockup.html`'s `#docsOpen`
 * button and its `.setwrap` settings popover (§A), sitting beside the brand
 * `app-bar.ts` already builds and the `.task` level switcher
 * `widgets/level-switcher` builds.
 *
 * `presentAppBarSettings` is mounted live from `src/main.ts`, composed with
 * `app-bar.ts`'s brand and `level-switcher.ts`'s `.task` into the one app bar
 * row the workspace shell draws.
 *
 * ## What this composes
 *
 * The popover is where `features/switch-theme`, `features/switch-layout`,
 * `features/switch-language` and `features/manage-seed` all end up mounted —
 * this module's whole job is gluing those four independently-built-and-tested
 * slices, plus two openers and a static block, into the one `.setmenu`
 * `design/ui-mockup.html` draws:
 *
 * - Theme and layout are DOM-skeleton-and-presenter pairs
 *   ({@link import("#features/switch-theme/index.ts").buildThemeSwitchSkeleton}/
 *   `presentThemeSwitch`, the layout equivalents), so this module builds their
 *   elements with the caller's own `document` and appends them into the
 *   `.setblock` placeholders {@link appBarSettingsTemplate} leaves for them
 *   — the same "template leaves an empty slot, the presenter fills it" shape
 *   `presentLevelSwitcher` uses for `.taskblocks`.
 * - Language is `presentLanguagePicker`, which fills a `<select>` this
 *   module's own template already drew empty, matching `src/main.ts`'s own
 *   call to it against `index.html`'s `.languagepicker`.
 * - Seed is `seedPanelTemplate`, a plain markup function with nothing to
 *   wire — see its own module comment — so it is inserted with `raw()`
 *   straight into {@link appBarSettingsTemplate}'s returned markup, inside a
 *   `[data-set-block="seed"]` wrapper the presenter half below re-renders
 *   into whenever a later run's seed differs from this one, the same
 *   fill-a-placeholder shape the theme and layout blocks use.
 *
 * ## The two openers
 *
 * `docsOpen` and the popover's own `keysOpen` row both carry an
 * `aria-haspopup="dialog"` and an injected click callback
 * ({@link AppBarSettingsOptions.onOpenDocs}/`onOpenHotkeys`) rather than any
 * dialog-opening logic of their own: Phase 10 is where the docs modal and the
 * hotkeys modal actually get built, and this phase only has to leave the two
 * buttons that will open them. `keysOpen`'s handler closes the settings
 * popover before calling `onOpenHotkeys`, ported from the mockup's own
 * `keysOpen` listener (`closeSetMenu(); if (!keys.open) keys.showModal();`)
 * — a dialog opening behind a popover that is still open would leave two
 * layers on screen at once. `docsOpen` needs no such close: it sits beside
 * `.setwrap` in the mockup, not inside it, so there is no popover under it to
 * close.
 *
 * ## The mockup ids this module does not keep
 *
 * `#docsOpen`, `#setOpen`, `#keysOpen` and `#langPick` are ids in
 * `design/ui-mockup.html`, one static page with exactly one of each. This
 * module is a widget that a caller — a test, eventually `widgets/app-bar`
 * itself — can build more than once, so each becomes a class instead
 * (`.docsopen`, `.setopen`, `.keysopen`), the same substitution
 * `presentLevelSwitcher` already makes for the mockup's own `.task-*` ids.
 * `.langpick` needed no substitution: the mockup already gives `#langPick`
 * that class alongside its id, and `src/main.ts`'s own lookup already
 * selects on the class (`.languagepicker`) rather than an id for the same
 * reason.
 *
 * ## The About block
 *
 * Entirely static: two real `<a class="setlink">` links to this fork and to
 * the game this is forked from, and a copyright line — ported verbatim from
 * the mockup's own `.setblock`, `target="_blank" rel="noreferrer"` included.
 * The two URLs and the domain text under each link are plain constants
 * rather than catalogue keys: an address is not a translator's business, and
 * `game.appBar.aboutCopyright`'s "Elevator Saga © 2015 Magnus Wolffelt, ©
 * 2026 EpicDima, MIT." is deliberately the same string in both locales, the
 * same way the mockup's own Russian page leaves it in English — a license
 * notice names what it names regardless of the reader's language.
 */

import { seedPanelTemplate } from "#features/manage-seed/index.ts";
import { presentLanguagePicker } from "#features/switch-language/index.ts";
import { buildLayoutSwitchSkeleton, presentLayoutSwitch } from "#features/switch-layout/index.ts";
import type { LayoutModeId } from "#features/switch-layout/index.ts";
import { buildThemeSwitchSkeleton, presentThemeSwitch } from "#features/switch-theme/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createDisclosure } from "#shared/ui/disclosure.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "../../../ui/templates.ts";
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
 * The toolbar's inert markup: `docsOpen`, the settings trigger, and every
 * `.setblock` the popover holds — the theme, layout and language blocks
 * empty and waiting for {@link presentAppBarSettings}, the seed block
 * already whole because {@link seedPanelTemplate} needs no presenting.
 *
 * @param seed - The run in progress' seed, passed straight through to
 * {@link seedPanelTemplate} — `null` renders no seed block at all, the same
 * condition that leaves it out of the challenge bar.
 * @returns The toolbar's markup, ready for {@link presentAppBarSettings}.
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
  const copyright = t("game.appBar.aboutCopyright");

  return markup`<button type="button" class="ghost docsopen" title="${docsLabel}" aria-haspopup="dialog">${raw(spriteIconMarkup("book"))}<span class="lbl">${docsLabel}</span></button><div class="setwrap"><button type="button" class="ghost setopen" aria-expanded="false" aria-haspopup="true" title="${settingsLabel}" aria-label="${settingsLabel}">${raw(spriteIconMarkup("slider"))}<span class="lbl">${settingsLabel}</span></button><div class="setmenu" hidden><div class="setblock" data-set-block="theme"><span class="cap">${themeCaption}</span></div><div class="setblock" data-set-block="layout"><span class="cap">${layoutCaption}</span></div><div class="setblock"><span class="cap">${languageCaption}</span><select class="langpick" aria-label="${languageCaption}"></select></div><div data-set-block="seed">${raw(seedPanelTemplate(seed))}</div><div class="setblock"><button type="button" class="setrow keysopen" aria-haspopup="dialog">${raw(spriteIconMarkup("keys"))}<span>${hotkeysLabel}</span>${raw(spriteIconMarkup("right", "chev"))}</button></div><div class="setblock"><span class="cap">${aboutCaption}</span><a class="setlink" href="${FORK_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${forkLabel}</b><small>${FORK_DOMAIN}</small></span></a><a class="setlink" href="${ORIGINAL_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${originalLabel}</b><small>${ORIGINAL_DOMAIN}</small></span></a><p class="sethint">${copyright}</p></div></div></div>`;
}

/** What {@link presentAppBarSettings} needs in order to drive the toolbar it fills in. */
export interface AppBarSettingsOptions {
  /**
   * The element the resolved theme is written to, as `root.dataset.theme` —
   * passed straight through to `presentThemeSwitch`.
   */
  readonly root: HTMLElement;
  /** Where the theme and the language are each remembered between visits. */
  readonly storage: Storage;
  /** Whether the system's own colour scheme is dark right now — see `presentThemeSwitch`'s option of the same name. */
  readonly prefersDark: () => boolean;
  /** The layout mode the switch opens showing as pressed — the caller's own current layout mode. */
  readonly initialLayoutMode: LayoutModeId;
  /** Called when a layout button is pressed, with the mode it chooses. */
  readonly onSelectLayout: (mode: LayoutModeId) => void;
  /** Puts what is already on screen into the language just chosen — see `presentLanguagePicker`'s option of the same name. */
  readonly redrawLanguage: () => void;
  /** The run in progress' seed, or `null` — must match whatever {@link appBarSettingsTemplate} was called with. */
  readonly seed: SeedLinkData | null;
  /** Called when `docsOpen` is pressed. Does nothing here yet — see this module's own comment on the two openers. */
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
  /**
   * Redraws the seed block for the run now in progress, or clears it for
   * `null` — the popover's own equivalent of {@link setActiveLayoutMode},
   * for the one block {@link appBarSettingsTemplate} otherwise only ever
   * draws once, at mount, from whatever run was current then.
   */
  setSeed(seed: SeedLinkData | null): void;
}

/**
 * Fills in the theme, layout and language blocks, wires the settings
 * popover open and closed, and wires both openers.
 *
 * Called once, against a `parent` already holding {@link appBarSettingsTemplate}'s
 * markup — the same division of labour `presentLevelSwitcher` keeps from
 * `levelSwitcherTemplate`.
 *
 * @param parent - The element the template's markup was written into.
 * @param options - Everything the four composed slices and the two openers need.
 * @returns The controller for keeping the theme and layout blocks in step
 * with state that changed elsewhere.
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
  const seedBlock = requireElement('[data-set-block="seed"]', parent);
  const keysOpen = requireElement(".keysopen", parent);

  const languageSelect = requireElement(".langpick", parent);
  if (!(languageSelect instanceof HTMLSelectElement)) {
    // Unreachable against `appBarSettingsTemplate`'s own markup, which always
    // draws `.langpick` as a `<select>`; guarded the same way `src/main.ts`
    // guards its own `.languagepicker` lookup, for a caller that hands this
    // presenter some other markup instead.
    throw new TypeError("Expected .langpick to be a <select>");
  }

  const themeElements = buildThemeSwitchSkeleton(document, {
    group: t("game.switchTheme.caption"),
    buttons: {
      system: t("game.switchTheme.system"),
      light: t("game.switchTheme.light"),
      dark: t("game.switchTheme.dark"),
    },
  });
  themeBlock.append(themeElements.group);
  const theme = presentThemeSwitch({
    elements: themeElements,
    root: options.root,
    storage: options.storage,
    prefersDark: options.prefersDark,
  });

  const layoutElements = buildLayoutSwitchSkeleton(document, {
    group: t("game.switchLayout.caption"),
    buttons: {
      left: t("game.switchLayout.left"),
      right: t("game.switchLayout.right"),
      code: t("game.switchLayout.onlyCode"),
      game: t("game.switchLayout.onlyGame"),
    },
  });
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
      seedBlock.innerHTML = seedPanelTemplate(seed);
    },
  };
}
