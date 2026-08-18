// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  appBarSettingsTemplate,
  presentAppBarSettings,
  type AppBarSettingsOptions,
} from "./settings-menu.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { MemoryStorage } from "../../../ui/test-helpers.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";

/** A run nobody pinned, the same fixture `seed-panel.test.ts` uses. */
const SEED: SeedLinkData = {
  seed: "1234567890",
  url: "#challenge=1,seed=1234567890",
  newDrawUrl: null,
};

/**
 * A mounted toolbar, its parent and the options it was built with.
 *
 * @param seed - What {@link appBarSettingsTemplate} and the presenter are
 * both given — the two must agree, the same way a real caller would give
 * both the same run.
 * @param overrides - Fields to replace on the base options fixture.
 * @returns The mounted parent, the controller and the options used.
 */
function setUp(
  seed: SeedLinkData | null = null,
  overrides: Partial<AppBarSettingsOptions> = {},
): {
  parent: HTMLElement;
  options: AppBarSettingsOptions;
  controller: ReturnType<typeof presentAppBarSettings>;
} {
  const parent = document.createElement("div");
  parent.innerHTML = appBarSettingsTemplate(seed);
  document.body.append(parent);
  const options: AppBarSettingsOptions = {
    root: document.createElement("html"),
    storage: new MemoryStorage(),
    prefersDark: () => false,
    initialLayoutMode: "left",
    onSelectLayout: () => undefined,
    redrawLanguage: () => undefined,
    seed,
    onOpenDocs: () => undefined,
    onOpenHotkeys: () => undefined,
    ...overrides,
  };
  const controller = presentAppBarSettings(parent, options);
  return { parent, options, controller };
}

describe("appBarSettingsTemplate", () => {
  it("draws docsOpen beside a trigger that opens a closed, hidden menu", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    expect(requireElement(".docsopen", parent).getAttribute("aria-haspopup")).toBe("dialog");
    const setOpen = requireElement(".setopen", parent);
    expect(setOpen.getAttribute("aria-expanded")).toBe("false");
    expect(setOpen.getAttribute("aria-haspopup")).toBe("true");
    expect(requireElement(".setmenu", parent).hasAttribute("hidden")).toBe(true);
  });

  it("leaves the theme and layout blocks empty, tagged for the presenter to fill", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const themeBlock = requireElement('[data-set-block="theme"]', parent);
    const layoutBlock = requireElement('[data-set-block="layout"]', parent);
    expect(themeBlock.querySelector(".cap")?.textContent).toBe("Theme");
    expect(themeBlock.children).toHaveLength(1);
    expect(layoutBlock.querySelector(".cap")?.textContent).toBe("Layout");
    expect(layoutBlock.children).toHaveLength(1);
  });

  it("draws an empty, labelled language select", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const select = requireElement(".langpick", parent);
    expect(select.tagName).toBe("SELECT");
    expect(select.children).toHaveLength(0);
    expect(select.getAttribute("aria-label")).toBe("Language");
  });

  it("omits the seed block when there is no seed to show", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const captions = [...parent.querySelectorAll(".setblock .cap")].map((cap) => cap.textContent);
    expect(captions).not.toContain("Seed");
  });

  it("draws the seed block when there is a seed to show", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(SEED);

    expect(parent.querySelector("a.seedlink")?.textContent).toBe("1234567890");
  });

  it("draws the hotkeys opener with a trailing chevron, reusing the legacy caret icon", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const keysOpen = requireElement(".keysopen", parent);
    expect(keysOpen.querySelector("svg.chev")).not.toBeNull();
    expect(keysOpen.textContent).toContain("Hotkeys");
  });

  it("draws two real links in the About block, pointing at this fork and the original game", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const links = [...parent.querySelectorAll("a.setlink")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://github.com/EpicDima/elevatorsaga",
      "https://github.com/magwo/elevatorsaga",
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    }
    expect(links[0]?.querySelector("b")?.textContent).toBe("This fork");
    expect(links[1]?.querySelector("b")?.textContent).toBe("Original");
    expect(parent.querySelector(".sethint")?.textContent).toContain("Elevator Saga");
  });
});

describe("presentAppBarSettings", () => {
  it("opens and closes the popover from its trigger", () => {
    const { parent } = setUp();
    const setOpen = requireElement(".setopen", parent);
    const setMenu = requireElement(".setmenu", parent);

    setOpen.click();
    expect(setMenu.hidden).toBe(false);
    expect(setOpen.getAttribute("aria-expanded")).toBe("true");

    setOpen.click();
    expect(setMenu.hidden).toBe(true);
    expect(setOpen.getAttribute("aria-expanded")).toBe("false");
  });

  it("fills the theme block with a working three-way switch", () => {
    const { parent, options } = setUp();
    const themeBlock = requireElement('[data-set-block="theme"]', parent);
    const buttons = themeBlock.querySelectorAll<HTMLButtonElement>("[data-theme-btn]");
    expect(buttons).toHaveLength(3);

    const dark = themeBlock.querySelector<HTMLButtonElement>('[data-theme-btn="dark"]');
    dark?.click();

    expect(options.root.dataset["theme"]).toBe("dark");
  });

  it("fills the layout block with a working four-way switch, opening on the given initial mode", () => {
    const selected: string[] = [];
    const { parent } = setUp(null, {
      initialLayoutMode: "right",
      onSelectLayout: (mode) => selected.push(mode),
    });
    const layoutBlock = requireElement('[data-set-block="layout"]', parent);

    expect(
      layoutBlock.querySelector('[data-layout-btn="right"]')?.getAttribute("aria-pressed"),
    ).toBe("true");

    layoutBlock.querySelector<HTMLButtonElement>('[data-layout-btn="game"]')?.click();

    expect(selected).toEqual(["game"]);
  });

  it("fills the language select with every language the game speaks", () => {
    const { parent } = setUp();
    const select = requireElement(".langpick", parent);
    expect(select instanceof HTMLSelectElement).toBe(true);
    const options = [...(select as HTMLSelectElement).options].map((option) => option.value);

    expect(options).toEqual(["en", "ru"]);
  });

  it("invokes onOpenDocs when docsOpen is clicked", () => {
    const onOpenDocs = vi.fn();
    const { parent } = setUp(null, { onOpenDocs });

    requireElement(".docsopen", parent).click();

    expect(onOpenDocs).toHaveBeenCalledTimes(1);
  });

  it("closes the popover before invoking onOpenHotkeys when keysOpen is clicked", () => {
    let menuHiddenAtCall: boolean | undefined;
    const onOpenHotkeys = vi.fn(() => {
      // `!!`, not a direct pass-through: newer DOM typings widen `hidden` to
      // `boolean | "hidden" | "until-found"`, even though `presentAppBarSettings`
      // only ever writes a plain boolean to it through `createDisclosure`.
      menuHiddenAtCall = !!setMenu.hidden;
    });
    const { parent } = setUp(null, { onOpenHotkeys });
    const setOpen = requireElement(".setopen", parent);
    const setMenu = requireElement(".setmenu", parent);
    setOpen.click();
    expect(setMenu.hidden).toBe(false);

    requireElement(".keysopen", parent).click();

    expect(onOpenHotkeys).toHaveBeenCalledTimes(1);
    expect(menuHiddenAtCall).toBe(true);
    expect(setMenu.hidden).toBe(true);
  });

  describe("notifySystemThemeChange", () => {
    it("delegates to the theme switch, re-resolving while the choice is system", () => {
      let prefersDark = false;
      const { options, controller } = setUp(null, { prefersDark: () => prefersDark });
      expect(options.root.dataset["theme"]).toBe("light");

      prefersDark = true;
      controller.notifySystemThemeChange();

      expect(options.root.dataset["theme"]).toBe("dark");
    });
  });

  describe("setActiveLayoutMode", () => {
    it("delegates to the layout switch, without calling onSelectLayout", () => {
      const selected: string[] = [];
      const { parent, controller } = setUp(null, {
        onSelectLayout: (mode) => selected.push(mode),
      });

      controller.setActiveLayoutMode("code");

      const layoutBlock = requireElement('[data-set-block="layout"]', parent);
      expect(
        layoutBlock.querySelector('[data-layout-btn="code"]')?.getAttribute("aria-pressed"),
      ).toBe("true");
      expect(selected).toEqual([]);
    });
  });
});
