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
 *   module's own template already drew empty. This is the game's only language
 *   control: the header `index.html` used to ship carried a second one, and it
 *   went with the rest of that header.
 * - Seed is `seedPanelTemplate`, inserted with `raw()` straight into
 *   {@link appBarSettingsTemplate}'s returned markup, inside a
 *   `[data-set-block="seed"]` wrapper the presenter half below re-renders
 *   into whenever a later run's seed differs from this one, the same
 *   fill-a-placeholder shape the theme and layout blocks use. Its own
 *   `presentSeedPanel` is then wired *onto that wrapper* rather than onto the
 *   markup inside it, because the markup inside it is what
 *   {@link AppBarSettingsController.setSeed} throws away — see that slice's
 *   module comment.
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
 * that class alongside its id, which is the selector this module's own
 * presenter uses.
 *
 * ## The About block
 *
 * Entirely static: two real `<a class="setlink">` links to this fork and to
 * the game this is forked from, and a copyright line — ported verbatim from
 * the mockup's own `.setblock`, `target="_blank" rel="noreferrer"` included.
 * The two URLs and the domain text under each link are plain constants
 * rather than catalogue keys: an address is not a translator's business, and
 * `game.appBar.aboutCopyright.html`'s "Elevator Saga © 2015 Magnus Wolffelt,
 * © 2026 EpicDima, MIT." is deliberately the same string in both locales, the
 * same way the mockup's own Russian page leaves it in English — a license
 * notice names what it names regardless of the reader's language.
 *
 * One word of that line is a link, and that is the whole of this port's
 * departure from the mockup here: "MIT" points at `licenses.txt`, the notice
 * file `vite.config.ts` writes into `dist/`. The page footer that used to
 * carry that link is gone — `design/ui-mockup.html` draws no footer, and a
 * page whose whole height is a workspace has nowhere to put one — and MIT
 * and OFL both ask for their notices to travel with the software, so the
 * game needs one reachable route to the file. A third `.setlink` row would
 * have been the obvious place and is deliberately not taken: it would change
 * the block's shape, and the licence name in a line that already says "MIT"
 * is the same destination for none of the space.
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
  const copyright = t("game.appBar.aboutCopyright.html");

  return markup`<button type="button" class="ghost docsopen" title="${docsLabel}" aria-haspopup="dialog">${raw(spriteIconMarkup("book"))}<span class="lbl">${docsLabel}</span></button><div class="setwrap"><button type="button" class="ghost setopen" aria-expanded="false" aria-haspopup="true" title="${settingsLabel}" aria-label="${settingsLabel}">${raw(spriteIconMarkup("slider"))}<span class="lbl">${settingsLabel}</span></button><div class="setmenu" hidden><div class="setblock" data-set-block="theme"><span class="cap">${themeCaption}</span></div><div class="setblock" data-set-block="layout"><span class="cap">${layoutCaption}</span></div><div class="setblock" data-set-block="language"><span class="cap">${languageCaption}</span><select class="langpick" aria-label="${languageCaption}"></select></div><div data-set-block="seed">${raw(seedPanelTemplate(seed))}</div><div class="setblock" data-set-block="hotkeys"><button type="button" class="setrow keysopen" aria-haspopup="dialog">${raw(spriteIconMarkup("keys"))}<span>${hotkeysLabel}</span>${raw(spriteIconMarkup("right", "chev"))}</button></div><div class="setblock" data-set-block="about"><span class="cap">${aboutCaption}</span><a class="setlink" href="${FORK_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${forkLabel}</b><small>${FORK_DOMAIN}</small></span></a><a class="setlink" href="${ORIGINAL_URL}" target="_blank" rel="noreferrer">${raw(spriteIconMarkup("link"))}<span><b>${originalLabel}</b><small>${ORIGINAL_DOMAIN}</small></span></a><p class="sethint">${raw(copyright)}</p></div></div></div>`;
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
  /**
   * Called with a seed the player chose in the seed row — typed into its field
   * or drawn by its dice — already checked against `#shared/lib/seed.ts`.
   *
   * Passed straight through to `presentSeedPanel`; this widget has no more idea
   * what playing a seed involves than it has what a layout mode does.
   */
  readonly onSeed: (seed: string) => void;
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
  /**
   * Re-derives every `t()`-sourced label this toolbar drew — its own
   * captions plus the theme and layout switches' — for a caller redrawing
   * after a language change. {@link appBarSettingsTemplate} and the theme
   * and layout skeletons all bake their text in once, at construction; this
   * is what keeps it current instead, the same role `RunControlsPresenter.update`
   * plays for the run controls. Which theme is applied, which layout mode is
   * pressed, and whether the popover is open are all untouched — this
   * touches only text.
   */
  update(): void;
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
    // Unreachable against `appBarSettingsTemplate`'s own markup, which always
    // draws exactly two `a.setlink`s — guarded the same way `.langpick`'s
    // type is guarded below, for a caller that hands this presenter some
    // other markup instead.
    throw new TypeError("Expected two a.setlink elements in the about block");
  }
  const forkLabelEl = requireElement("b", forkLinkEl);
  const originalLabelEl = requireElement("b", originalLinkEl);
  const copyrightEl = requireElement(".sethint", aboutBlock);

  const languageSelect = requireElement(".langpick", parent);
  if (!(languageSelect instanceof HTMLSelectElement)) {
    // Unreachable against `appBarSettingsTemplate`'s own markup, which always
    // draws `.langpick` as a `<select>`; guarded all the same, for a caller
    // that hands this presenter some other markup instead.
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
      // The one rebuild in this popover that can happen under the player's own
      // hands: the seed row is what changes a run's seed, so the control that
      // asked for the change is usually still focused when the new row replaces
      // it. Without this, choosing a seed drops focus to <body> -- which for a
      // keyboard player means the popover is still open and nothing in it is
      // reachable except by tabbing in from the top of the page again.
      //
      // Restored by selector rather than by node, since every node here is
      // about to be discarded, and only for a control this block actually owns:
      // an element focused elsewhere in the document is none of this method's
      // business.
      const focused = seedBlock.ownerDocument.activeElement;
      const owned =
        focused instanceof HTMLElement && seedBlock.contains(focused)
          ? [".seedvalue", ".seednewdraw", ".seedlink", ".seedhelp > summary"].find((selector) =>
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
      // `innerHTML`, not `textContent`: the line carries the `licenses.txt`
      // link, and the `.html` suffix is this codebase's own mark for a
      // catalogue value that is trusted markup rather than text.
      copyrightEl.innerHTML = t("game.appBar.aboutCopyright.html");

      theme.relabel(themeLabels());
      layout.relabel(layoutLabels());
    },
  };
}
