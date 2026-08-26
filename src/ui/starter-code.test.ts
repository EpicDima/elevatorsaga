import { afterEach, describe, expect, it } from "vitest";

import { chapter2Levels } from "../game/chapter2.ts";
import { tutorialLevels } from "../game/tutorial.ts";
import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";
import { defaultCode } from "./default-code.ts";
import { localizeStarterCode } from "./starter-code.ts";

/** Every starter program in one language, read the way the game itself reads them. */
function starterProgramsIn(locale: Locale): readonly string[] {
  setLocale(locale);
  return [
    defaultCode(),
    ...tutorialLevels.map((level) => level.startingCode),
    ...chapter2Levels.map((level) => level.startingCode),
  ];
}

describe("saying a starter program again in another language", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("hands back the default program in the language on screen", () => {
    setLocale("ru");
    const russian = defaultCode();

    setLocale(DEFAULT_LOCALE);

    expect(localizeStarterCode(russian)).toBe(defaultCode());
    expect(localizeStarterCode(russian)).toContain("// Let's use the first elevator");
  });

  it("does the same for every program the two blocks of levels start from", () => {
    // Checks both directions: translateIn's English fallback could mask a broken reverse translation.
    const russian = starterProgramsIn("ru");
    const english = starterProgramsIn(DEFAULT_LOCALE);

    expect(russian.map(localizeStarterCode)).toStrictEqual(english);

    setLocale("ru");

    expect(english.map(localizeStarterCode)).toStrictEqual(russian);
  });

  it("hands back a program that is already in the language on screen", () => {
    expect(localizeStarterCode(defaultCode())).toBe(defaultCode());
  });

  it("leaves a program the player wrote exactly as it is", () => {
    const mine = `{
    init: function(elevators, floors) {
        // мой собственный диспетчер
        elevators[0].goToFloor(3);
    },
    update: function(dt, elevators, floors) {}
}`;

    setLocale(DEFAULT_LOCALE);

    expect(localizeStarterCode(mine)).toBe(mine);
    expect(localizeStarterCode("")).toBe("");
  });

  it("recognizes the starter of a level even after the player has read it in a third language", () => {
    const [firstLesson] = tutorialLevels;
    if (firstLesson === undefined) {
      throw new Error("The learning track has no levels");
    }
    setLocale("ru");
    const russian = firstLesson.startingCode;

    setLocale(DEFAULT_LOCALE);

    expect(localizeStarterCode(russian)).toBe(firstLesson.startingCode);
    expect(localizeStarterCode(russian)).not.toBe(russian);
  });

  it("keeps two levels that share a program sharing it in every language", () => {
    const byLocale = LOCALES.map((locale) => starterProgramsIn(locale));
    const [reference] = byLocale;
    if (reference === undefined) {
      throw new Error("The game speaks no languages");
    }

    for (const programs of byLocale) {
      const sameAsReference = reference.map((program, index) =>
        reference.map((other, otherIndex) => index === otherIndex || program === other),
      );
      const sameHere = programs.map((program, index) =>
        programs.map((other, otherIndex) => index === otherIndex || program === other),
      );
      expect(sameHere).toStrictEqual(sameAsReference);
    }
  });
});
