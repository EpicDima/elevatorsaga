import { describe, expect, it } from "vitest";

import { translate } from "./catalog.ts";
import { EN_MESSAGES } from "./en.ts";
import { decimal, PLURAL_CATEGORIES } from "./format.ts";
import { LOCALES, type Locale } from "./locale.ts";
import { RU_MESSAGES } from "./ru.ts";

/** A catalog entry as this test looks at it: a string, or forms by category. */
type Entry = string | Readonly<Record<string, string>>;

/**
 * Both catalogs behind their loosest type, so the tests can walk them by
 * string key. The strict types are what {@link translate} is checked against;
 * here the point is to look for what the types cannot see.
 */
const CATALOGS: Readonly<Record<Locale, Readonly<Record<string, Entry>>>> = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
};

/** Every string an entry can render. */
function forms(entry: Entry): readonly string[] {
  return typeof entry === "string" ? [entry] : Object.values(entry);
}

/** The `{name}`s a set of strings interpolates. */
function placeholders(strings: readonly string[]): readonly string[] {
  const names = new Set<string>();
  for (const text of strings) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) {
      const name = match[1];
      if (name !== undefined) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

/** The tag names an HTML string opens and closes, in order. */
function tags(text: string): readonly string[] {
  return [...text.matchAll(/<(\/?)([a-z]+)/g)].map((match) => `${match[1] ?? ""}${match[2] ?? ""}`);
}

/**
 * An example code block with every `//` comment emptied of its words.
 *
 * Emptied rather than removed, and that is the whole of what this helper is for.
 * Removing a comment removes the evidence that it was there: strip `// …` off
 * `elevator.goToFloor(0); // …` and what is left is the line the other locale
 * has anyway, so a comment written into one language and not the other passed a
 * comparison of the stripped text unseen. Only a comment on a line of its own
 * was ever caught, and only incidentally — by the line it added.
 *
 * Keeping the two slashes where they stood makes the comparison one about the
 * comments as well as the code: both locales must open a comment on the same
 * line at the same column, or neither may. Nothing weakens, since the code
 * either side of the slashes is compared exactly as before.
 *
 * @param code - An example program.
 * @returns The same program with every comment reduced to the `//` that opened
 * it.
 */
function withEmptiedComments(code: string): string {
  return code
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "//"))
    .join("\n");
}

const KEYS = Object.keys(EN_MESSAGES);
const CODE_KEYS = KEYS.filter((key) => key.endsWith(".code"));
const HTML_KEYS = KEYS.filter((key) => key.endsWith(".html"));

/** An entry that must exist, since every key comes from the English catalog. */
function entry(locale: Locale, key: string): Entry {
  const found = CATALOGS[locale][key];
  if (found === undefined) {
    throw new Error(`${locale} has no message for ${key}`);
  }
  return found;
}

describe("catalog shape", () => {
  it("has the same keys in every locale", () => {
    // The types already refuse a catalog with a key missing or a key too many.
    // This says so out loud, and catches the day someone loosens them.
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGS[locale]).sort()).toEqual([...KEYS].sort());
    }
  });

  it("keeps the keys in one order, so two catalogs can be read side by side", () => {
    expect(Object.keys(RU_MESSAGES)).toEqual(KEYS);
  });

  it("has something to say for every key", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        for (const text of forms(entry(locale, key))) {
          expect(text.length, `${locale} ${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("pluralises the same messages in every locale", () => {
    for (const key of KEYS) {
      const isPlural = typeof entry("en", key) !== "string";
      expect(typeof entry("ru", key) !== "string", key).toBe(isPlural);
    }
  });

  it("gives every plural message exactly the forms its language has", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const found = entry(locale, key);
        if (typeof found !== "string") {
          expect(Object.keys(found).sort(), `${locale} ${key}`).toEqual(
            [...PLURAL_CATEGORIES[locale]].sort(),
          );
        }
      }
    }
  });

  it("asks every locale for the same parameters", () => {
    // A translation that drops {waitTime} silently loses a number from the
    // sentence, and a translation that invents {waitTme} silently prints the
    // braces. Neither is visible to the compiler, which only knows the English
    // placeholders.
    for (const key of KEYS.filter((candidate) => !candidate.endsWith(".code"))) {
      const expected = placeholders(forms(entry("en", key)));
      expect(placeholders(forms(entry("ru", key))), key).toEqual(expected);
    }
  });
});

describe("catalog markup", () => {
  it("keeps markup to the keys that admit to it", () => {
    // A `.html` suffix is a promise to the call site that the string is safe to
    // put in innerHTML, and a plain key is a promise that it is not needed.
    for (const locale of LOCALES) {
      for (const key of KEYS.filter((candidate) => !candidate.endsWith(".html"))) {
        for (const text of forms(entry(locale, key))) {
          expect(tags(text), `${locale} ${key}`).toEqual([]);
        }
      }
    }
  });

  it("opens and closes the same tags in every locale", () => {
    // Every form of a message wraps the same things in the same elements —
    // Russian has four forms where English has two, and all six mark up the
    // count identically. A dropped `</span>` would leak into the rest of the
    // sentence, and no type can see it.
    for (const key of HTML_KEYS) {
      const english = forms(entry("en", key));
      const expected = tags(english[0] ?? "");
      for (const [locale, text] of [
        ...english.map((text) => ["en", text] as const),
        ...forms(entry("ru", key)).map((text) => ["ru", text] as const),
      ]) {
        expect(tags(text), `${locale} ${key}: the markup changed`).toEqual(expected);
      }
    }
  });
});

describe("example code", () => {
  it("is the same code in every locale, with its comments in the same places", () => {
    // The rule the translation follows: prose is translated, code never is. An
    // example whose identifiers were translated would not run.
    //
    // Where the comments sit is part of the same statement rather than a second
    // one. A translation that adds a remark of its own, or drops one it did not
    // know what to do with, hands the two languages different programs — the
    // Russian reader is shown a line the English reader is not, or told less
    // than they were promised — and it does it without touching a line of code,
    // which is exactly the edit a check on the code alone cannot see.
    for (const key of CODE_KEYS) {
      const english = entry("en", key);
      const russian = entry("ru", key);
      expect(typeof english).toBe("string");
      expect(typeof russian).toBe("string");
      if (typeof english === "string" && typeof russian === "string") {
        expect(withEmptiedComments(russian), key).toBe(withEmptiedComments(english));
      }
    }
  });

  it("has its comments translated", () => {
    for (const key of CODE_KEYS) {
      const english = entry("en", key);
      const russian = entry("ru", key);
      if (typeof english === "string" && typeof russian === "string" && english.includes("//")) {
        expect(russian, `${key}: the comments were left in English`).toMatch(/\/\/.*[а-яё]/i);
      }
    }
  });
});

describe("Russian typography", () => {
  const prose = KEYS.filter((key) => !key.endsWith(".code")).flatMap((key) =>
    forms(entry("ru", key)).map((text) => [key, text] as const),
  );

  it("quotes with «ёлочки», in pairs", () => {
    for (const [key, text] of prose) {
      expect(text.split("«").length, `${key}: unbalanced «»`).toBe(text.split("»").length);
      expect(text, `${key}: straight or English quotes`).not.toMatch(/[“”„]/);
    }
  });

  it("uses an em dash with a space on each side, never a hyphen", () => {
    for (const [key, text] of prose) {
      expect(text, `${key}: a hyphen used as a dash`).not.toMatch(/ - /);
      expect(text, `${key}: an em dash without its spaces`).not.toMatch(/\S—|—\S/);
    }
  });

  it("spells ё", () => {
    // The catalog writes ё wherever it belongs, so the words that are only
    // ever spelled with one must never turn up without it.
    const YO_LESS =
      /(?<![а-яё])(еще|ее|нее|идет|ждет|берет|живет|встает|подъем|черный|тяжелый)(?![а-яё])/i;
    for (const [key, text] of prose) {
      expect(text, `${key}: ё written as е`).not.toMatch(YO_LESS);
    }
    expect(prose.map(([, text]) => text).join("")).toContain("ё");
  });

  it("has no double spaces and no trailing space", () => {
    for (const [key, text] of prose) {
      expect(text, `${key}: doubled space`).not.toMatch(/ {2}/);
      expect(text, `${key}: trailing space`).not.toMatch(/\s$/);
    }
  });
});

describe("translate", () => {
  it("renders a message that takes no parameters", () => {
    expect(translate("en", EN_MESSAGES, "game.button.start")).toBe("Start");
    expect(translate("ru", RU_MESSAGES, "game.button.start")).toBe("Запустить");
  });

  it("fills parameters by name", () => {
    expect(
      translate("en", EN_MESSAGES, "game.level.title.html", {
        number: 3,
        description: "Transport 15 people",
      }),
    ).toBe("Level 3: Transport 15 people");
    expect(
      translate("ru", RU_MESSAGES, "game.level.title.html", {
        number: 3,
        description: "Перевезите 15 пассажиров",
      }),
    ).toBe("Уровень 3: Перевезите 15 пассажиров");
  });

  // The reason this module exists. All four Russian categories, from the same
  // key, with the nominative phrase the sandbox level shows.
  it.each([
    [1, "1</span> пассажир в секунду"],
    [2, "2</span> пассажира в секунду"],
    [5, "5</span> пассажиров в секунду"],
    [11, "11</span> пассажиров в секунду"],
    [21, "21</span> пассажир в секунду"],
    [102, "102</span> пассажира в секунду"],
  ])("counts %i passengers a second in Russian", (count, expected) => {
    expect(translate("ru", RU_MESSAGES, "level.sandbox.spawnRate.html", { count })).toBe(
      `<span class='emphasis-color'>${expected}`,
    );
  });

  it("counts a fraction of a passenger in Russian", () => {
    expect(
      translate("ru", RU_MESSAGES, "level.sandbox.spawnRate.html", { count: decimal(1.5, 1) }),
    ).toBe("<span class='emphasis-color'>1,5</span> пассажира в секунду");
  });

  it("declines the noun the sentence needs, not the noun the key suggests", () => {
    // Accusative after «Перевезите», genitive after «дольше»: the same English
    // word needs different Russian in different sentences, which is why the
    // phrases are messages of their own rather than one shared noun.
    expect(translate("ru", RU_MESSAGES, "level.people.html", { count: 1 })).toContain("пассажира");
    expect(translate("ru", RU_MESSAGES, "level.timeLimit.html", { count: 21 })).toContain(
      "секунду",
    );
    expect(translate("ru", RU_MESSAGES, "level.waitLimit.html", { count: 21 })).toContain(
      "секунды",
    );
  });

  it("keeps English to one form for one and one for the rest", () => {
    expect(translate("en", EN_MESSAGES, "level.people.html", { count: 1 })).toContain("person");
    expect(translate("en", EN_MESSAGES, "level.people.html", { count: 2 })).toContain("people");
  });

  it("falls back to the 'other' form when the one the count asks for is missing", () => {
    // Which categories a locale has is not something the lookup can know, so
    // every form is optional in the shape it reads; `other` is the one category
    // every language has, and so the one answer it can always fall back on. A
    // Russian entry that lost its `many` still has to say something for 5.
    const withoutMany = {
      ...RU_MESSAGES,
      "level.people.html": { one: "одна форма", few: "другая форма", other: "запасная форма" },
    } as unknown as typeof RU_MESSAGES;
    expect(translate("ru", withoutMany, "level.people.html", { count: 5 })).toBe("запасная форма");
    expect(translate("ru", withoutMany, "level.people.html", { count: 1 })).toBe("одна форма");
  });

  it("builds a level description exactly as the game builds it today", () => {
    // Byte for byte what src/game/levels.ts renders, markup included: the
    // wiring agent can swap the template for this call and change nothing on
    // screen.
    const description = translate("en", EN_MESSAGES, "level.transportWithinTime.html", {
      people: translate("en", EN_MESSAGES, "level.people.html", { count: 23 }),
      time: translate("en", EN_MESSAGES, "level.timeLimit.html", { count: 30 }),
    });
    expect(description).toBe(
      "Transport <span class='emphasis-color'>23</span> people in " +
        "<span class='emphasis-color'>30</span> seconds or less",
    );
  });

  it("renders the same description in Russian, with the right forms throughout", () => {
    const description = translate("ru", RU_MESSAGES, "level.transportWithinTimeWithMaxWait.html", {
      people: translate("ru", RU_MESSAGES, "level.people.html", { count: 23 }),
      time: translate("ru", RU_MESSAGES, "level.timeLimit.html", { count: 30 }),
      waitTime: translate("ru", RU_MESSAGES, "level.waitLimit.html", {
        count: decimal(2, 1),
      }),
    });
    expect(description).toBe(
      "Перевезите <span class='emphasis-color'>23</span> пассажира за " +
        "<span class='emphasis-color'>30</span> секунд или быстрее, и пусть доставка каждого " +
        "не длится дольше " +
        "<span class='emphasis-color'>2,0</span> секунды",
    );
  });
});
