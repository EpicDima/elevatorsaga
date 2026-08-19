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
  CATALOGUE_LOADERS,
} from "./index.ts";

/** The space Russian typography wants between a number and its unit. */
const NBSP = "\u00a0";

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe("CATALOGUE_LOADERS", () => {
  it("has a loader for every locale the game claims to speak", () => {
    expect(Object.keys(CATALOGUE_LOADERS).sort()).toEqual([...LOCALES].sort());
  });

  it("fetches the catalogue the translations are then rendered from", async () => {
    // Not an identity check on a constant any more: the catalogue arrives when
    // its chunk does, so what there is to check is that the one that arrives is
    // the one in `ru.ts` -- rendered through `t`, which is the only way anyone
    // reads it.
    await loadLocale("ru");

    expect(isLocaleLoaded("ru")).toBe(true);
    expect(translateIn("ru", "game.button.start")).toBe(RU_MESSAGES["game.button.start"]);
  });

  it("has the default locale ready without loading anything", () => {
    // The reason English is bundled rather than split: `t` is synchronous and
    // is called from error paths, so something has to be renderable before any
    // fetch has finished.
    expect(isLocaleLoaded(DEFAULT_LOCALE)).toBe(true);
  });
});

describe("a locale whose catalogue has not arrived yet", () => {
  /**
   * The i18n module with nothing but English loaded.
   *
   * A module graph of its own, because the Vitest setup file loads every
   * catalogue into the one this file imported at the top -- which is what keeps
   * the tests below, and in a dozen other files, able to name a language on one
   * line and assert on the next. This is where the state those tests are spared
   * is exercised on purpose.
   *
   * @returns A freshly evaluated `./index.ts`.
   */
  async function unloadedI18n(): Promise<typeof import("./index.ts")> {
    vi.resetModules();
    return await import("./index.ts");
  }

  afterEach(() => {
    vi.doUnmock("./ru.ts");
    // The fresh graph is the one that was just told to speak Russian; leaving
    // it in the registry would hand it to the next dynamic import in this file.
    vi.resetModules();
  });

  it("renders English rather than a raw key", async () => {
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");

    // The guarantee the whole design is for: whatever else is true, a player
    // never reads `game.button.start`.
    expect(i18n.isLocaleLoaded("ru")).toBe(false);
    expect(i18n.t("game.button.start")).toBe("Start");
    expect(i18n.translateIn("ru", "game.button.start")).toBe("Start");
  });

  it("keeps the numbers in the language the words came out in", async () => {
    // Half a sentence in English and its decimal comma in Russian is a worse
    // answer than a whole sentence in English, so formatting follows the
    // catalogue rather than the choice.
    const i18n = await unloadedI18n();

    i18n.setLocale("ru");

    expect(i18n.format(seconds(60))).toBe("60s");
    expect(i18n.format(2675)).toBe("2,675");
  });

  it("still remembers what the player chose", async () => {
    // Which is what the picker shows as selected, what a link carries and what
    // the fitness worker is told -- none of which depend on the fetch.
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

  it("fetches a catalogue once however many callers ask for it", async () => {
    const i18n = await unloadedI18n();

    const first = i18n.loadLocale("ru");

    expect(i18n.loadLocale("ru")).toBe(first);
    await first;
    // And nothing to wait for once it is here.
    expect(i18n.isLocaleLoaded("ru")).toBe(true);
  });

  it("stays in English when the catalogue cannot be fetched", async () => {
    // A dropped response or a half-deployed build. The load resolves either
    // way: a rejection here would travel to the fitness worker, which has no
    // one to report it to and a player waiting on a benchmark.
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
    // And the language is not written off for the session: the next attempt is
    // a new fetch rather than the failure served again from the cache.
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
    // A locale that has not been loaded renders in English, so this also says
    // the switch has to be complete: half a Russian sentence joined by "and"
    // is the failure a bare ", " was chosen to avoid in the first place.
    expect(formatList(["6", "9"])).toBe("6 and 9");
    setLocale("ru");
    expect(formatList(["6", "9"])).toBe("6 и 9");
  });

  it("chooses the plural form of the language it is in", () => {
    setLocale("ru");
    expect(t("challenge.people.html", { count: 2 })).toContain("пассажира");
    expect(t("challenge.people.html", { count: 5 })).toContain("пассажиров");
  });
});

describe("translateIn", () => {
  it("renders a named locale without changing the active one", () => {
    // What a language picker needs: every language's own name, in that
    // language, while the interface is still in another.
    expect(translateIn("ru", "game.button.pause")).toBe("Пауза");
    expect(getLocale()).toBe("en");
    expect(t("game.button.pause")).toBe("Pause");
  });

  it("takes the same parameters whichever locale it renders", () => {
    const args = { number: 4, description: "..." } as const;
    expect(translateIn("en", "game.challenge.title.html", args)).toBe("Level 4: ...");
    expect(translateIn("ru", "game.challenge.title.html", args)).toBe("Уровень 4: ...");
  });
});

describe("locale identity", () => {
  it("recognises the locales it has catalogues for, and nothing else", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("knows what <html lang> should say", () => {
    // The one thing the wiring has to set besides the text itself: assistive
    // technology and the browser's own hyphenation both read it.
    expect(htmlLang("en")).toBe("en");
    expect(htmlLang("ru")).toBe("ru");
  });
});
