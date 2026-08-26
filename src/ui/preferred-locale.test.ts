// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocale, setLocale, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "../i18n/index.ts";

import { TEXT_KEY_ATTRIBUTE } from "./localize-page.ts";
import { applyPreferredLocale } from "./preferred-locale.ts";

/** A user agent, since the shell's shortcut hint is relabeled for a platform. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** The message key these tests read to tell which language the page came out in. */
const LINK_KEY = "page.skipLink";

/** What {@link LINK_KEY} says in each of the game's languages. */
const LINK = { en: "Skip to the code editor", ru: "Перейти к редактору кода" };

/** The document under test, rebuilt for each test that writes into it. */
let page: Document;

/** Where the preference would be remembered, rebuilt with each document. */
let storage: Storage;

/** A minimal in-memory `Storage` stand-in, since neither jsdom nor Node provides a real one. */
function fakeStorage(initial: Readonly<Record<string, string>> = {}): Storage {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    get length(): number {
      return values.size;
    },
    clear: (): void => {
      values.clear();
    },
    getItem: (key: string): string | null => values.get(key) ?? null,
    key: (index: number): string | null => [...values.keys()][index] ?? null,
    removeItem: (key: string): void => {
      values.delete(key);
    },
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
}

/** A minimal page shell with one localizable link, parsed the way `index.html` is. */
function shell(): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html lang="en"><body>` +
      `<a href="#editor" ${TEXT_KEY_ATTRIBUTE}="${LINK_KEY}">${LINK.en}</a>` +
      `</body></html>`,
    "text/html",
  );
}

function linkText(shown: Document): string {
  return shown.querySelector("a")?.textContent ?? "";
}

beforeEach(() => {
  page = shell();
  storage = fakeStorage();
});

afterEach(() => {
  // Resets even after a failing assertion, so later tests don't inherit the wrong locale/hash.
  setLocale(DEFAULT_LOCALE);
  location.hash = "";
});

describe("the language the page starts in", () => {
  it("is the one the hash names, over everything else", async () => {
    storage.setItem(LOCALE_STORAGE_KEY, "en");

    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#level=3,lang=ru",
      storage,
      languages: ["en-GB", "en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(linkText(page)).toBe(LINK.ru);
  });

  it("is the remembered one when the hash names none", async () => {
    storage.setItem(LOCALE_STORAGE_KEY, "ru");

    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#level=3",
      storage,
      languages: ["en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(linkText(page)).toBe(LINK.ru);
  });

  it("is the browser's when nothing is remembered", async () => {
    await applyPreferredLocale(page, USER_AGENT, {
      hash: "",
      storage,
      languages: ["ru-RU", "en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(linkText(page)).toBe(LINK.ru);
  });

  it("is English when no source names a language the game speaks", async () => {
    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#level=3",
      storage,
      languages: ["fr", "de-AT"],
    });

    expect(getLocale()).toBe(DEFAULT_LOCALE);
    expect(page.documentElement.lang).toBe("en");
    expect(linkText(page)).toBe(LINK.en);
  });

  it("comes from this browser when it is not told where to look", async () => {
    location.hash = "#lang=ru";

    await applyPreferredLocale(page, USER_AGENT);

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
  });
});

describe("what start-up remembers", () => {
  it("does not remember a language that arrived in somebody else's link", async () => {
    const written = vi.spyOn(storage, "setItem");

    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#lang=ru",
      storage,
      languages: ["en"],
    });

    expect(getLocale()).toBe("ru");
    expect(written).not.toHaveBeenCalled();
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });
});

describe("a catalog that has to be fetched", () => {
  /** A fresh module graph where the target locale's catalog has not been loaded yet. */
  async function unloadedPage(): Promise<{
    ui: typeof import("./preferred-locale.ts");
    i18n: typeof import("../i18n/index.ts");
  }> {
    vi.resetModules();
    return {
      ui: await import("./preferred-locale.ts"),
      i18n: await import("../i18n/index.ts"),
    };
  }

  afterEach(() => {
    vi.doUnmock("../i18n/ru.ts");
    // Otherwise the next dynamic import in this file would inherit this graph.
    vi.resetModules();
  });

  it("is waited for, so the page is written once and in the reader's language", async () => {
    const { ui, i18n } = await unloadedPage();
    expect(i18n.isLocaleLoaded("ru")).toBe(false);

    await ui.applyPreferredLocale(page, USER_AGENT, { hash: "#lang=ru" });

    expect(linkText(page)).toBe(LINK.ru);
    expect(page.documentElement.lang).toBe("ru");
  });

  it("leaves a working English page when it cannot be fetched", async () => {
    vi.doMock("../i18n/ru.ts", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { ui, i18n } = await unloadedPage();

    await ui.applyPreferredLocale(page, USER_AGENT, { hash: "#lang=ru" });

    expect(linkText(page)).toBe(LINK.en);
    // `<html lang>` follows the words actually written, not the intended locale.
    expect(page.documentElement.lang).toBe("en");
    // The choice is still remembered, so a later attempt retries the fetch instead of replaying the failure.
    expect(i18n.getLocale()).toBe("ru");
    expect(warn).toHaveBeenCalled();
  });
});
