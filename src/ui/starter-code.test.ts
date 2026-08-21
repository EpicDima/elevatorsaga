import { afterEach, describe, expect, it } from "vitest";

import { skyscraperLevels } from "../game/skyscraper.ts";
import { tutorialLevels } from "../game/tutorial.ts";
import { DEFAULT_LOCALE, LOCALES, setLocale } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";
import { defaultCode } from "./default-code.ts";
import { localizeStarterCode } from "./starter-code.ts";

/**
 * Every program the game hands a player, in one language.
 *
 * Read through the tables the game itself reads, rather than from the catalog,
 * so that a level added to either block is in this list without anybody
 * remembering to put it there — which is the same reason
 * `starter-code.ts` finds its keys instead of listing them.
 *
 * @param locale - The language to read them in.
 * @returns The default program followed by every level's starting point.
 */
function starterProgramsIn(locale: Locale): readonly string[] {
  setLocale(locale);
  return [
    defaultCode(),
    ...tutorialLevels.map((level) => level.startingCode),
    ...skyscraperLevels.map((level) => level.startingCode),
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
    // The tutorial and the Skyscraper block hand out eighteen programs between
    // them, and a player switching language is owed all of them: their comments
    // are the lesson, not decoration. Both directions, because the fallback in
    // `translateIn` makes English the easy case and Russian the one that can
    // quietly stop working.
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
    // The property the whole design turns on. Text that is not one of the
    // game's own programs is not translated, not reformatted and not
    // recognized as "nearly" anything: a player's work goes through untouched
    // or the editor has no business calling this.
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
    // A program is recognized by being one the game wrote in *any* language it
    // speaks, not by being the one this buffer was opened with. That is what
    // makes a copy written to storage last winter, in a language the player has
    // since left, still answer for what it is.
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
    // The assumption behind taking the first key that matches: when two levels
    // start from the same program -- the Skyscraper block has such a pair --
    // whichever of them is found first must render the same text. Translating
    // one of a pair and not the other would break that silently, and the only
    // symptom would be a player on one level reading the other level's
    // comments.
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
