import { describe, expect, it } from "vitest";

import { fullStorage, MemoryStorage } from "../../../ui/test-helpers.ts";
import {
  DEFAULT_THEME,
  readTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
  THEMES,
} from "./theme.ts";

/** A store whose `getItem` throws, as Safari's private mode does. */
function throwingStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    getItem: () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };
}

describe("THEMES", () => {
  it("lists system, light and dark", () => {
    expect(THEMES).toEqual(["system", "light", "dark"]);
  });
});

describe("readTheme", () => {
  it("defaults when nothing is stored", () => {
    expect(readTheme(new MemoryStorage())).toBe(DEFAULT_THEME);
  });

  it("reads back a stored choice", () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, "dark");

    expect(readTheme(storage)).toBe("dark");
  });

  it("ignores a value that is not a real choice", () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, "purple");

    expect(readTheme(storage)).toBe(DEFAULT_THEME);
  });

  it("defaults when the store cannot be read at all", () => {
    expect(readTheme(throwingStorage())).toBe(DEFAULT_THEME);
  });
});

describe("saveTheme", () => {
  it("writes the choice", () => {
    const storage = new MemoryStorage();

    saveTheme(storage, "light");

    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("does not throw when the store refuses the write", () => {
    expect(() => {
      saveTheme(fullStorage(), "dark");
    }).not.toThrow();
  });
});

describe("resolveTheme", () => {
  it("follows the system preference when the choice is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ignores the system preference when a theme is pinned", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
