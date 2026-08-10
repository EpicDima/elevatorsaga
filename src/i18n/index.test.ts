import { afterEach, describe, expect, it } from "vitest";

import { EN_MESSAGES } from "./en.ts";
import { decimal, seconds } from "./format.ts";
import { htmlLang, isLocale, DEFAULT_LOCALE, LOCALES } from "./locale.ts";
import { RU_MESSAGES } from "./ru.ts";
import { format, formatTime, getLocale, setLocale, t, translateIn, CATALOGUES } from "./index.ts";

/** The space Russian typography wants between a number and its unit. */
const NBSP = "\u00a0";

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe("CATALOGUES", () => {
  it("has a catalogue for every locale the game claims to speak", () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...LOCALES].sort());
    expect(CATALOGUES.en).toBe(EN_MESSAGES);
    expect(CATALOGUES.ru).toBe(RU_MESSAGES);
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
    expect(t("game.button.start")).toBe("Старт");
  });

  it("carries into numbers as well as words", () => {
    expect(format(seconds(60))).toBe("60s");
    expect(format(2675)).toBe("2,675");
    setLocale("ru");
    expect(format(seconds(60))).toBe(`60${NBSP}с`);
    expect(format(2675)).toBe(`2${NBSP}675`);
    expect(format(decimal(1.5, 1))).toBe("1,5");
  });

  it("carries into times of day", () => {
    const when = new Date(2024, 0, 2, 21, 3, 57);
    expect(formatTime(when)).toMatch(/^9:03:57\s?PM$/);
    setLocale("ru");
    expect(formatTime(when)).toBe("21:03:57");
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
    expect(translateIn("en", "game.challenge.title.html", args)).toBe("Challenge #4: ...");
    expect(translateIn("ru", "game.challenge.title.html", args)).toBe("Задание №4: ...");
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
