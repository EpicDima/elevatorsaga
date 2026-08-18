// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../../ui/test-helpers.ts";
import { THEME_STORAGE_KEY } from "../model/theme.ts";
import {
  buildThemeSwitchSkeleton,
  presentThemeSwitch,
  type ThemeSwitchElements,
  type ThemeSwitchLabels,
} from "./theme-switch.ts";

const LABELS: ThemeSwitchLabels = {
  group: "Theme",
  buttons: { system: "System", light: "Light", dark: "Dark" },
};

function baseElements(): ThemeSwitchElements {
  return buildThemeSwitchSkeleton(document, LABELS);
}

describe("buildThemeSwitchSkeleton", () => {
  it("labels the group and the three buttons", () => {
    const elements = baseElements();

    expect(elements.group.getAttribute("role")).toBe("group");
    expect(elements.group.getAttribute("aria-label")).toBe("Theme");
    expect(elements.system.textContent).toBe("System");
    expect(elements.light.textContent).toBe("Light");
    expect(elements.dark.textContent).toBe("Dark");
  });

  it("marks each button with its own data-theme-btn and an explicit type", () => {
    const elements = baseElements();

    expect(elements.system.getAttribute("data-theme-btn")).toBe("system");
    expect(elements.light.getAttribute("data-theme-btn")).toBe("light");
    expect(elements.dark.getAttribute("data-theme-btn")).toBe("dark");
    for (const button of [elements.system, elements.light, elements.dark]) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("nests the three buttons inside the group, in system/light/dark order", () => {
    const elements = baseElements();

    expect([...elements.group.children]).toEqual([elements.system, elements.light, elements.dark]);
  });
});

describe("presentThemeSwitch", () => {
  it("defaults to system and resolves it against the system preference", () => {
    const elements = baseElements();
    const root = document.createElement("html");

    presentThemeSwitch({ elements, root, storage: new MemoryStorage(), prefersDark: () => true });

    expect(root.dataset["theme"]).toBe("dark");
    expect(elements.system.getAttribute("aria-pressed")).toBe("true");
    expect(elements.light.getAttribute("aria-pressed")).toBe("false");
    expect(elements.dark.getAttribute("aria-pressed")).toBe("false");
  });

  it("restores a theme a player left behind", () => {
    const elements = baseElements();
    const root = document.createElement("html");
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, "light");

    presentThemeSwitch({ elements, root, storage, prefersDark: () => true });

    expect(root.dataset["theme"]).toBe("light");
    expect(elements.light.getAttribute("aria-pressed")).toBe("true");
  });

  it("applies and persists the theme a button is clicked for", () => {
    const elements = baseElements();
    const root = document.createElement("html");
    const storage = new MemoryStorage();

    presentThemeSwitch({ elements, root, storage, prefersDark: () => false });
    elements.dark.click();

    expect(root.dataset["theme"]).toBe("dark");
    expect(elements.dark.getAttribute("aria-pressed")).toBe("true");
    expect(elements.system.getAttribute("aria-pressed")).toBe("false");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("ignores the system preference once a theme is pinned", () => {
    const elements = baseElements();
    const root = document.createElement("html");
    let prefersDark = false;

    const controller = presentThemeSwitch({
      elements,
      root,
      storage: new MemoryStorage(),
      prefersDark: () => prefersDark,
    });
    elements.light.click();
    prefersDark = true;
    controller.notifySystemChange();

    expect(root.dataset["theme"]).toBe("light");
  });

  describe("notifySystemChange", () => {
    it("re-resolves while the choice is system", () => {
      const elements = baseElements();
      const root = document.createElement("html");
      let prefersDark = false;

      const controller = presentThemeSwitch({
        elements,
        root,
        storage: new MemoryStorage(),
        prefersDark: () => prefersDark,
      });
      expect(root.dataset["theme"]).toBe("light");

      prefersDark = true;
      controller.notifySystemChange();

      expect(root.dataset["theme"]).toBe("dark");
    });

    it("does nothing once a theme is pinned", () => {
      const elements = baseElements();
      const root = document.createElement("html");
      let prefersDark = false;

      const controller = presentThemeSwitch({
        elements,
        root,
        storage: new MemoryStorage(),
        prefersDark: () => prefersDark,
      });
      elements.dark.click();
      prefersDark = true;
      controller.notifySystemChange();

      // Dark was pinned while the system preference was still light; a
      // system change afterwards must not touch it.
      expect(root.dataset["theme"]).toBe("dark");
      expect(elements.dark.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
