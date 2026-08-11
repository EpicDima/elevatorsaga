// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocale, setLocale, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "../i18n/index.ts";

import { TEXT_KEY_ATTRIBUTE } from "./localise-page.ts";
import { applyPreferredLocale } from "./preferred-locale.ts";

/** A user agent, since the shell's shortcut hint is relabelled for a platform. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * The message the shell in these tests is made of.
 *
 * One word, present in both catalogues, and unmistakable in either: what the
 * button says is the whole evidence of which language the page came out in.
 */
const BUTTON_KEY = "page.button.save";

/** What {@link BUTTON_KEY} says in each of the game's languages. */
const BUTTON = { en: "Save", ru: "Сохранить" };

/** The document under test, rebuilt for each test that writes into it. */
let page: Document;

/** Where the preference would be remembered, rebuilt with each document. */
let storage: Storage;

/**
 * A storage that remembers, since the test environment has no real one.
 *
 * The same double `detect.test.ts` builds, and for the same reason: neither
 * jsdom nor Node gives this environment a `Storage`, so a test that wants one
 * has to bring it.
 *
 * @param initial - What is in it to begin with.
 * @returns The storage.
 */
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

/**
 * A page shell of one button, parsed the way `index.html` itself is.
 *
 * Deliberately not `index.html`: what that file says in Russian is
 * `localise-page.test.ts`'s subject, and this one is about which language is
 * chosen and when, which needs no more markup than a single word.
 *
 * @returns The document it parses to.
 */
function shell(): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html lang="en"><body>` +
      `<button ${TEXT_KEY_ATTRIBUTE}="${BUTTON_KEY}">${BUTTON.en}</button>` +
      `</body></html>`,
    "text/html",
  );
}

/**
 * What the shell's one button reads as.
 *
 * @param shown - The document that was written into.
 * @returns The button's text.
 */
function buttonText(shown: Document): string {
  return shown.querySelector("button")?.textContent ?? "";
}

beforeEach(() => {
  page = shell();
  storage = fakeStorage();
});

afterEach(() => {
  // On the hook, so that a failing assertion cannot leave the rest of the file
  // running in a language, or on a hash, it did not ask for.
  setLocale(DEFAULT_LOCALE);
  location.hash = "";
});

describe("the language the page starts in", () => {
  it("is the one the hash names, over everything else", async () => {
    // The order the whole of `detect.ts` is arranged around, seen from the end
    // it matters at: what a reader is actually shown.
    storage.setItem(LOCALE_STORAGE_KEY, "en");

    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#challenge=3,lang=ru",
      storage,
      languages: ["en-GB", "en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(buttonText(page)).toBe(BUTTON.ru);
  });

  it("is the remembered one when the hash names none", async () => {
    storage.setItem(LOCALE_STORAGE_KEY, "ru");

    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#challenge=3",
      storage,
      languages: ["en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(buttonText(page)).toBe(BUTTON.ru);
  });

  it("is the browser's when nothing is remembered", async () => {
    await applyPreferredLocale(page, USER_AGENT, {
      hash: "",
      storage,
      languages: ["ru-RU", "en"],
    });

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
    expect(buttonText(page)).toBe(BUTTON.ru);
  });

  it("is English when no source names a language the game speaks", async () => {
    await applyPreferredLocale(page, USER_AGENT, {
      hash: "#challenge=3",
      storage,
      languages: ["fr", "de-AT"],
    });

    expect(getLocale()).toBe(DEFAULT_LOCALE);
    expect(page.documentElement.lang).toBe("en");
    expect(buttonText(page)).toBe(BUTTON.en);
  });

  it("comes from this browser when it is not told where to look", async () => {
    // The form `src/main.ts` calls, and the only one in which the hash, the
    // storage and the languages are the real ones.
    location.hash = "#lang=ru";

    await applyPreferredLocale(page, USER_AGENT);

    expect(getLocale()).toBe("ru");
    expect(page.documentElement.lang).toBe("ru");
  });
});

describe("what start-up remembers", () => {
  it("does not remember a language that arrived in somebody else's link", async () => {
    // The recipient of a shared link chose nothing, so `#lang=ru` must not
    // decide the language of every later visit -- including the visits that
    // name no language at all, and with no picker in the interface to undo it.
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

describe("a catalogue that has to be fetched", () => {
  /**
   * The page's language wiring in a graph where only English is loaded.
   *
   * A graph of its own, because the Vitest setup file loads every catalogue
   * into the one this file imported at the top -- which is what lets the tests
   * above name a language on one line and read the page on the next, and which
   * would hide the whole of the waiting this module exists to do.
   *
   * @returns A freshly evaluated `./preferred-locale.ts`, and the `i18n` module
   * it shares its state with.
   */
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
    // The fresh graph is the one that was just told to speak Russian; leaving
    // it in the registry would hand it to the next dynamic import in this file.
    vi.resetModules();
  });

  it("is waited for, so the page is written once and in the reader's language", async () => {
    const { ui, i18n } = await unloadedPage();
    expect(i18n.isLocaleLoaded("ru")).toBe(false);

    await ui.applyPreferredLocale(page, USER_AGENT, { hash: "#lang=ru" });

    // Not "eventually Russian": by the time this settles the page is finished,
    // which is what lets `src/main.ts` draw the game after it and get the same
    // language as the shell without a second pass over either.
    expect(buttonText(page)).toBe(BUTTON.ru);
    expect(page.documentElement.lang).toBe("ru");
  });

  it("leaves a working English page when it cannot be fetched", async () => {
    // A dropped response or a half-deployed build. The reader gets the wrong
    // language, which is a real page; what they must never get is the message
    // keys, which is what the bundled English fallback is for.
    vi.doMock("../i18n/ru.ts", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { ui, i18n } = await unloadedPage();

    await ui.applyPreferredLocale(page, USER_AGENT, { hash: "#lang=ru" });

    expect(buttonText(page)).toBe(BUTTON.en);
    // `<html lang>` follows the words that were written rather than the
    // language they were meant to be in, so a screen reader does not announce
    // English in a Russian voice.
    expect(page.documentElement.lang).toBe("en");
    // The choice is still remembered, so a picker would show it as selected and
    // a later attempt fetches rather than replaying the failure.
    expect(i18n.getLocale()).toBe("ru");
    expect(warn).toHaveBeenCalled();
  });
});
