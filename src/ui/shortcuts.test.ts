// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { labelModifierKeys, modifierKeyLabel } from "./shortcuts.ts";

/** A user agent string for each platform the game is played on. */
const USER_AGENTS = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  iPad: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  firefoxWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
};

describe("modifierKeyLabel", () => {
  it.each([
    ["macSafari", "⌘"],
    ["macChrome", "⌘"],
    ["iPad", "⌘"],
    ["iPhone", "⌘"],
    ["windows", "Ctrl"],
    ["linux", "Ctrl"],
    ["android", "Ctrl"],
    ["firefoxWindows", "Ctrl"],
  ] as const)("labels the Mod- key on %s as %s", (platform, expected) => {
    expect(modifierKeyLabel(USER_AGENTS[platform])).toBe(expected);
  });
});

describe("labelModifierKeys", () => {
  /**
   * Builds the shortcut hint the way the page shell writes it.
   *
   * @returns The hint element.
   */
  function hint(): HTMLElement {
    const element = document.createElement("p");
    element.innerHTML =
      "In the editor: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program. " +
      "<kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> saves it. <kbd>Tab</kbd> indents.";
    return element;
  }

  it("rewrites the shipped Ctrl for an Apple keyboard", () => {
    // The binding is Mod-Enter, which is Command on a Mac. The page as shipped
    // told Mac players to press a key combination that does nothing.
    const element = hint();
    labelModifierKeys(element, USER_AGENTS.macChrome);
    expect(element.textContent).toContain("⌘+Enter");
    expect(element.textContent).toContain("⌘+S");
    expect(element.textContent).not.toContain("Ctrl");
  });

  it("leaves the shipped markup alone everywhere else", () => {
    const element = hint();
    const before = element.innerHTML;
    labelModifierKeys(element, USER_AGENTS.windows);
    expect(element.innerHTML).toBe(before);
  });

  it("touches only the keys marked as the Mod- key", () => {
    const element = hint();
    labelModifierKeys(element, USER_AGENTS.macChrome);
    expect(element.textContent).toContain("Enter");
    expect(element.textContent).toContain("Tab");
  });
});
