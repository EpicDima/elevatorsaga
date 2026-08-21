// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  appBarSettingsTemplate,
  presentAppBarSettings,
  type AppBarSettingsOptions,
} from "./settings-menu.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { MemoryStorage } from "../../../ui/test-helpers.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";

/** A run, the same fixture `seed-panel.test.ts` uses. */
const SEED: SeedLinkData = { seed: "1234567890", url: "#level=1,seed=1234567890" };

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
    onSeed: () => undefined,
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

  it("draws an empty, labeled language select", () => {
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

    expect(parent.querySelector<HTMLInputElement>(".seedrow > .seedvalue")?.value).toBe(
      "1234567890",
    );
    expect(parent.querySelector("a.seedlink")).not.toBeNull();
  });

  it("draws the hotkeys opener with a trailing chevron", () => {
    const parent = document.createElement("div");
    parent.innerHTML = appBarSettingsTemplate(null);

    const keysOpen = requireElement(".keysopen", parent);
    expect(keysOpen.querySelector("svg.ds-icon.chev")).not.toBeNull();
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
    // MIT and OFL both want their notices to travel with the software, and
    // this is the game's only route to the file the build writes them into.
    const licenses = parent.querySelector(".sethint a");
    expect(licenses?.getAttribute("href")).toBe("licenses.txt");
    expect(licenses?.textContent).toBe("MIT");
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

  describe("setSeed", () => {
    it("draws the seed block for a run that started after the popover was mounted", () => {
      const { parent, controller } = setUp(null);
      expect(requireElement('[data-set-block="seed"]', parent).children).toHaveLength(0);

      controller.setSeed(SEED);

      const seedBlock = requireElement('[data-set-block="seed"]', parent);
      expect(seedBlock.querySelector<HTMLInputElement>(".seedrow > .seedvalue")?.value).toBe(
        "1234567890",
      );
    });

    it("clears the seed block once the run it described is gone", () => {
      const { parent, controller } = setUp(SEED);

      controller.setSeed(null);

      expect(requireElement('[data-set-block="seed"]', parent).children).toHaveLength(0);
    });

    it("keeps the row wired after the rebuild, so a second seed can be chosen too", () => {
      // The presenter is wired onto the wrapper, not onto the row inside it,
      // precisely so that this redraw does not take the listeners with it.
      const onSeed = vi.fn();
      const { parent, controller } = setUp(SEED, { onSeed });

      controller.setSeed({ seed: "later", url: "#level=1,seed=later" });
      requireElement(".seednewdraw", parent).click();

      expect(onSeed).toHaveBeenCalledTimes(1);
    });

    it("puts focus back on the control the player was holding", () => {
      // Choosing a seed is usually done from this very row, so the rebuild it
      // triggers lands under the player's own hands. Dropping focus to <body>
      // would leave a keyboard player with an open popover and nothing in it
      // reachable without tabbing in from the top of the page.
      const { parent, controller } = setUp(SEED);
      const field = requireElement(".seedvalue", parent);
      field.focus();

      controller.setSeed({ seed: "later", url: "#level=1,seed=later" });

      const replacement = requireElement(".seedvalue", parent);
      expect(replacement).not.toBe(field);
      expect(document.activeElement).toBe(replacement);
    });

    it("leaves focus where it was when it was never this block's to move", () => {
      const { parent, controller } = setUp(SEED);
      const elsewhere = requireElement(".setopen", parent);
      elsewhere.focus();

      controller.setSeed({ seed: "later", url: "#level=1,seed=later" });

      expect(document.activeElement).toBe(elsewhere);
    });
  });

  describe("update", () => {
    it("redraws every label in the language now active, without disturbing the switches' own state", () => {
      const { parent, controller, options } = setUp();
      requireElement('[data-theme-btn="dark"]', parent).click();
      requireElement('[data-layout-btn="right"]', parent).click();

      setLocale("ru");
      try {
        controller.update();

        expect(requireElement(".docsopen", parent).getAttribute("title")).toBe("Справка");
        expect(requireElement(".docsopen .lbl", parent).textContent).toBe("Справка");
        const setOpen = requireElement(".setopen", parent);
        expect(setOpen.getAttribute("title")).toBe("Настройки");
        expect(setOpen.getAttribute("aria-label")).toBe("Настройки");
        expect(requireElement(".setopen .lbl", parent).textContent).toBe("Настройки");

        const themeBlock = requireElement('[data-set-block="theme"]', parent);
        expect(themeBlock.querySelector(".cap")?.textContent).toBe("Тема");
        expect(themeBlock.querySelector("[role=group]")?.getAttribute("aria-label")).toBe("Тема");
        expect(themeBlock.querySelector('[data-theme-btn="dark"]')?.textContent).toBe("Тёмная");

        const layoutBlock = requireElement('[data-set-block="layout"]', parent);
        expect(layoutBlock.querySelector(".cap")?.textContent).toBe("Раскладка");
        expect(layoutBlock.querySelector("[role=group]")?.getAttribute("aria-label")).toBe(
          "Раскладка",
        );
        expect(layoutBlock.querySelector('[data-layout-btn="right"]')?.getAttribute("title")).toBe(
          "Код справа",
        );

        const languageBlock = requireElement('[data-set-block="language"]', parent);
        expect(languageBlock.querySelector(".cap")?.textContent).toBe("Язык");
        expect(requireElement(".langpick", parent).getAttribute("aria-label")).toBe("Язык");

        expect(requireElement(".keysopen", parent).textContent).toContain("Горячие клавиши");

        const aboutBlock = requireElement('[data-set-block="about"]', parent);
        expect(aboutBlock.querySelector(".cap")?.textContent).toBe("Об игре");
        const links = [...aboutBlock.querySelectorAll("a.setlink b")];
        expect(links.map((link) => link.textContent)).toEqual(["Этот форк", "Оригинал"]);
        expect(aboutBlock.querySelector(".sethint")?.textContent).toBe(
          "Elevator Saga © 2015 Magnus Wolffelt, © 2026 EpicDima, MIT.",
        );

        // The switches' own state is untouched by a relabel.
        expect(options.root.dataset["theme"]).toBe("dark");
        expect(
          layoutBlock.querySelector('[data-layout-btn="right"]')?.getAttribute("aria-pressed"),
        ).toBe("true");
      } finally {
        setLocale(DEFAULT_LOCALE);
      }
    });
  });
});
