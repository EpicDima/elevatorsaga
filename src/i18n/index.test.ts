import { afterEach, describe, expect, it, vi } from "vitest";

import { decimal, seconds } from "./format.ts";
import { htmlLang, isLocale, DEFAULT_LOCALE, LOCALES } from "./locale.ts";
import { RU_MESSAGES } from "./ru.ts";
import {
  format,
  formatList,
  getLocale,
  isLocaleLoaded,
  loadLocale,
  setLocale,
  t,
  translateIn,
  CATALOG_LOADERS,
} from "./index.ts";

/** The space Russian typography wants between a number and its unit. */
const NBSP = "\u00a0";

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe("CATALOG_LOADERS", () => {
  it("has a loader for every locale the game claims to speak", () => {
    expect(Object.keys(CATALOG_LOADERS).sort()).toEqual([...LOCALES].sort());
  });

  it("fetches the catalog the translations are then rendered from", async () => {
    // Checked by rendering through `t`, not by identity, since the catalog
    // arrives whenever its chunk does.
    await loadLocale("ru");

    expect(isLocaleLoaded("ru")).toBe(true);
    expect(translateIn("ru", "game.button.start")).toBe(RU_MESSAGES["game.button.start"]);
  });

  it("has the default locale ready without loading anything", () => {
    // English is bundled, not split, since `t` is synchronous and called from error paths.
    expect(isLocaleLoaded(DEFAULT_LOCALE)).toBe(true);
  });
});

describe("a locale whose catalog has not arrived yet", () => {
  /** The i18n module with nothing but English loaded, in a module graph of its own. */
  async function unloadedI18n(): Promise<typeof import("./index.ts")> {
    vi.resetModules();
    return await import("./index.ts");
  }

  afterEach(() => {
    vi.doUnmock("./ru.ts");
    vi.resetModules();
  });

  it("renders English rather than a raw key", async () => {
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");

    expect(i18n.isLocaleLoaded("ru")).toBe(false);
    expect(i18n.t("game.button.start")).toBe("Start");
    expect(i18n.translateIn("ru", "game.button.start")).toBe("Start");
  });

  it("keeps the numbers in the language the words came out in", async () => {
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");

    expect(i18n.format(seconds(60))).toBe("60s");
    expect(i18n.format(2675)).toBe("2,675");
  });

  it("still remembers what the player chose", async () => {
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");

    expect(i18n.getLocale()).toBe("ru");
  });

  it("starts the fetch itself, so setting a locale is enough to get there", async () => {
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");
    // The same load `setLocale` started, not a second one.
    await i18n.loadLocale("ru");

    expect(i18n.t("game.button.start")).toBe(
      "\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c",
    );
    expect(i18n.format(seconds(60))).toBe(`60${NBSP}\u0441`);
  });

  it("fetches a catalog once however many callers ask for it", async () => {
    const i18n = await unloadedI18n();

    const first = i18n.loadLocale("ru");

    expect(i18n.loadLocale("ru")).toBe(first);
    await first;
    // And nothing to wait for once it is here.
    expect(i18n.isLocaleLoaded("ru")).toBe(true);
  });

  it("stays in English when the catalog cannot be fetched", async () => {
    // The load resolves either way: a rejection would reach the fitness
    // worker, which has no one to report it to.
    vi.doMock("./ru.ts", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const i18n = await unloadedI18n();

    const failed = i18n.loadLocale("ru");
    await expect(failed).resolves.toBeUndefined();

    i18n.setLocale("ru");
    expect(i18n.t("game.button.start")).toBe("Start");
    expect(warn).toHaveBeenCalled();
    // The next attempt is a new fetch, not the cached failure served again.
    expect(i18n.loadLocale("ru")).not.toBe(failed);
  });
});

describe("the active locale", () => {
  it("starts as the default", () => {
    expect(getLocale()).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("is what t answers in", () => {
    expect(t("game.button.start")).toBe("Start");
    setLocale("ru");
    expect(getLocale()).toBe("ru");
    expect(t("game.button.start")).toBe("Запустить");
  });

  it("carries into numbers as well as words", () => {
    expect(format(seconds(60))).toBe("60s");
    expect(format(2675)).toBe("2,675");
    setLocale("ru");
    expect(format(seconds(60))).toBe(`60${NBSP}с`);
    expect(format(2675)).toBe(`2${NBSP}675`);
    expect(format(decimal(1.5, 1))).toBe("1,5");
  });

  it("carries into the punctuation between listed items", () => {
    expect(formatList(["6", "9"])).toBe("6 and 9");
    setLocale("ru");
    expect(formatList(["6", "9"])).toBe("6 и 9");
  });

  it("chooses the plural form of the language it is in", () => {
    setLocale("ru");
    expect(t("level.people.html", { count: 2 })).toContain("пассажира");
    expect(t("level.people.html", { count: 5 })).toContain("пассажиров");
  });
});

describe("translateIn", () => {
  it("renders a named locale without changing the active one", () => {
    expect(translateIn("ru", "game.button.pause")).toBe("Пауза");
    expect(getLocale()).toBe("en");
    expect(t("game.button.pause")).toBe("Pause");
  });

  it("takes the same parameters whichever locale it renders", () => {
    const args = { occupied: 4, capacity: 6 } as const;
    expect(translateIn("en", "game.buildingStage.elevatorOccupancy", args)).toBe("Occupied: 4/6");
    expect(translateIn("ru", "game.buildingStage.elevatorOccupancy", args)).toBe("Занято: 4/6");
  });
});

describe("locale identity", () => {
  it("recognizes the locales it has catalogs for, and nothing else", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("knows what <html lang> should say", () => {
    expect(htmlLang("en")).toBe("en");
    expect(htmlLang("ru")).toBe("ru");
  });
});
