// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserLocaleSources,
  localeFromLanguages,
  localeFromQuery,
  readStoredLocale,
  resolveLocale,
  storeLocale,
  LOCALE_STORAGE_KEY,
} from "./detect.ts";

/** A storage that remembers, for the tests that only care about the answer. */
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
 * A storage that throws, the way Safari in a private window and a browser told
 * to block site data both do.
 */
function hostileStorage(): Storage {
  const blocked = (): never => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return {
    get length(): number {
      return blocked();
    },
    clear: blocked,
    getItem: blocked,
    key: blocked,
    removeItem: blocked,
    setItem: blocked,
  };
}

/**
 * Runs something with a global that throws on the merest look, then puts the
 * global back.
 *
 * @param name - The global to make unreadable.
 * @param body - What to run while it is.
 * @returns Whatever `body` returned.
 */
function whileUnreadable<T>(name: "localStorage" | "navigator", body: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get(): never {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
  try {
    return body();
  } finally {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, name);
    } else {
      Object.defineProperty(globalThis, name, original);
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("localeFromQuery", () => {
  it.each([
    ["#lang=ru", "ru"],
    ["lang=ru", "ru"],
    ["#challenge=3,lang=ru", "ru"],
    ["#lang=ru,challenge=3,timescale=8", "ru"],
    ["#lang=RU", "ru"],
    ["#lang=ru-RU", "ru"],
    ["#lang=en", "en"],
  ])("reads %s as %s", (hash, expected) => {
    expect(localeFromQuery(hash)).toBe(expected);
  });

  it.each([
    "",
    "#",
    "#challenge=3",
    "#lang",
    "#lang=",
    "#lang=de",
    "#lang=russian",
    "#language=ru",
  ])("reads no locale from %s", (hash) => {
    expect(localeFromQuery(hash)).toBeUndefined();
  });
});

describe("readStoredLocale", () => {
  it("reads back what was stored", () => {
    expect(readStoredLocale(fakeStorage({ [LOCALE_STORAGE_KEY]: "ru" }))).toBe("ru");
  });

  it("ignores an empty storage", () => {
    expect(readStoredLocale(fakeStorage())).toBeUndefined();
  });

  it("ignores a value the game cannot show", () => {
    // Someone else's key, an older format, a hand-edited value: all the same.
    expect(readStoredLocale(fakeStorage({ [LOCALE_STORAGE_KEY]: "klingon" }))).toBeUndefined();
  });

  it("survives a storage that throws", () => {
    expect(() => readStoredLocale(hostileStorage())).not.toThrow();
    expect(readStoredLocale(hostileStorage())).toBeUndefined();
  });
});

describe("storeLocale", () => {
  it("writes the preference where it will be found again", () => {
    const storage = fakeStorage();
    expect(storeLocale(storage, "ru")).toBe(true);
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
    expect(readStoredLocale(storage)).toBe("ru");
  });

  it("says so, without throwing, when it cannot", () => {
    expect(storeLocale(hostileStorage(), "ru")).toBe(false);
  });
});

describe("localeFromLanguages", () => {
  it("takes the first language the game speaks", () => {
    expect(localeFromLanguages(["de-DE", "ru-RU", "en-GB"])).toBe("ru");
  });

  it("ignores the region", () => {
    expect(localeFromLanguages(["ru-BY"])).toBe("ru");
    expect(localeFromLanguages(["EN-us"])).toBe("en");
  });

  it("has no answer when it speaks none of them", () => {
    expect(localeFromLanguages(["de", "fr-CA"])).toBeUndefined();
    expect(localeFromLanguages([])).toBeUndefined();
  });
});

describe("resolveLocale", () => {
  const storage = (): Storage => fakeStorage({ [LOCALE_STORAGE_KEY]: "ru" });

  it("lets the hash win over everything", () => {
    // A shared link carries the language its sender chose.
    expect(resolveLocale({ hash: "#lang=en", storage: storage(), languages: ["ru-RU"] })).toBe(
      "en",
    );
  });

  it("takes the stored preference when the hash says nothing", () => {
    expect(resolveLocale({ hash: "#challenge=3", storage: storage(), languages: ["de"] })).toBe(
      "ru",
    );
  });

  it("takes the browser's languages when nothing is stored", () => {
    expect(resolveLocale({ hash: "", storage: fakeStorage(), languages: ["de", "ru"] })).toBe("ru");
  });

  it("falls back to English when no source has an answer", () => {
    expect(resolveLocale({ hash: "#challenge=3", storage: fakeStorage(), languages: ["de"] })).toBe(
      "en",
    );
    expect(resolveLocale({})).toBe("en");
    expect(resolveLocale()).toBe("en");
  });

  it("carries on past a storage that throws", () => {
    // The whole order still runs: the unreadable source is skipped, not fatal.
    expect(
      resolveLocale({ hash: "#challenge=3", storage: hostileStorage(), languages: ["ru"] }),
    ).toBe("ru");
    expect(resolveLocale({ storage: hostileStorage() })).toBe("en");
    expect(resolveLocale({ hash: "#lang=ru", storage: hostileStorage() })).toBe("ru");
  });
});

describe("browserLocaleSources", () => {
  it("collects the hash, the storage and the languages", () => {
    window.location.hash = "#lang=ru";
    vi.stubGlobal("localStorage", fakeStorage({ [LOCALE_STORAGE_KEY]: "en" }));
    vi.stubGlobal("navigator", { languages: ["de-DE"] });

    const sources = browserLocaleSources();

    expect(sources.hash).toBe("#lang=ru");
    expect(sources.storage?.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(sources.languages).toEqual(["de-DE"]);
    expect(resolveLocale(sources)).toBe("ru");
  });

  it("leaves out a storage it is not allowed to touch", () => {
    // Reading the global itself throws here, before any method is called —
    // which is exactly what a browser with site data blocked does.
    const sources = whileUnreadable("localStorage", browserLocaleSources);

    expect(sources.storage).toBeUndefined();
    expect(resolveLocale(sources)).toBe("en");
  });

  it("leaves out languages it is not allowed to read", () => {
    const sources = whileUnreadable("navigator", browserLocaleSources);

    expect(sources.languages).toBeUndefined();
    expect(resolveLocale(sources)).toBe("en");
  });
});
