import { describe, expect, it } from "vitest";

import { translate } from "./catalogue.ts";
import { EN_MESSAGES } from "./en.ts";
import { decimal, PLURAL_CATEGORIES } from "./format.ts";
import { LOCALES, type Locale } from "./locale.ts";
import { RU_MESSAGES } from "./ru.ts";

/** A catalogue entry as this test looks at it: a string, or forms by category. */
type Entry = string | Readonly<Record<string, string>>;

/**
 * Both catalogues behind their loosest type, so the tests can walk them by
 * string key. The strict types are what {@link translate} is checked against;
 * here the point is to look for what the types cannot see.
 */
const CATALOGUES: Readonly<Record<Locale, Readonly<Record<string, Entry>>>> = {
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

/** An entry that must exist, since every key comes from the English catalogue. */
function entry(locale: Locale, key: string): Entry {
  const found = CATALOGUES[locale][key];
  if (found === undefined) {
    throw new Error(`${locale} has no message for ${key}`);
  }
  return found;
}

describe("catalogue shape", () => {
  it("has the same keys in every locale", () => {
    // The types already refuse a catalogue with a key missing or a key too many.
    // This says so out loud, and catches the day someone loosens them.
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGUES[locale]).sort()).toEqual([...KEYS].sort());
    }
  });

  it("keeps the keys in one order, so two catalogues can be read side by side", () => {
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

describe("catalogue markup", () => {
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

describe("accessible names", () => {
  /**
   * Controls whose visible text and accessible name are different messages, as
   * `[visible, name]`. A control that shows one thing and announces another has
   * to announce a superset: WCAG 2.5.3 asks it so that someone driving the page
   * by voice can say the words they can see and have the control respond.
   *
   * The pairs are written out here rather than derived from a key suffix because
   * the relationship is a fact about the markup, not about the catalogue, and the
   * markup is where it would be broken. A new pair added to a template and not
   * added here is the gap this test cannot close; a `.name` suffix convention
   * would close it, and is worth doing if a third pair ever appears.
   */
  const PAIRS: readonly (readonly [string, string])[] = [
    ["game.seed.newDraw", "game.seed.newDrawLink"],
  ];

  it("says the visible words inside the spoken ones, in every locale", () => {
    // A translator has no way to see the constraint at all: the two messages sit
    // on adjacent lines of a catalogue of several hundred keys and nothing marks
    // them as a pair, so it
    // holds only as long as whoever edits one thinks to edit the other. Rewording
    // «новый розыгрыш» to «новый сид» meant changing both, which is exactly the
    // edit where one gets missed.
    for (const locale of LOCALES) {
      for (const [visibleKey, nameKey] of PAIRS) {
        const visible = forms(entry(locale, visibleKey));
        const name = forms(entry(locale, nameKey));
        for (const label of visible) {
          for (const spoken of name) {
            expect(spoken, `${locale}: ${nameKey} does not contain ${visibleKey}`).toContain(label);
          }
        }
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
    // The catalogue writes ё wherever it belongs, so the words that are only
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
    expect(translate("ru", RU_MESSAGES, "game.button.start")).toBe("Старт");
  });

  it("fills parameters by name", () => {
    expect(
      translate("en", EN_MESSAGES, "game.challenge.title.html", {
        number: 3,
        description: "Transport 15 people",
      }),
    ).toBe("Challenge #3: Transport 15 people");
    expect(
      translate("ru", RU_MESSAGES, "game.challenge.title.html", {
        number: 3,
        description: "Перевезите 15 пассажиров",
      }),
    ).toBe("Задание №3: Перевезите 15 пассажиров");
  });

  // The reason this module exists. All four Russian categories, from the same
  // key, with the nominative phrase the sandbox challenge shows.
  it.each([
    [1, "1</span> пассажир в секунду"],
    [2, "2</span> пассажира в секунду"],
    [5, "5</span> пассажиров в секунду"],
    [11, "11</span> пассажиров в секунду"],
    [21, "21</span> пассажир в секунду"],
    [102, "102</span> пассажира в секунду"],
  ])("counts %i passengers a second in Russian", (count, expected) => {
    expect(translate("ru", RU_MESSAGES, "challenge.sandbox.spawnRate.html", { count })).toBe(
      `<span class='emphasis-color'>${expected}`,
    );
  });

  it("counts a fraction of a passenger in Russian", () => {
    expect(
      translate("ru", RU_MESSAGES, "challenge.sandbox.spawnRate.html", { count: decimal(1.5, 1) }),
    ).toBe("<span class='emphasis-color'>1,5</span> пассажира в секунду");
  });

  it("declines the noun the sentence needs, not the noun the key suggests", () => {
    // Accusative after «Перевезите», genitive after «дольше»: the same English
    // word needs different Russian in different sentences, which is why the
    // phrases are messages of their own rather than one shared noun.
    expect(translate("ru", RU_MESSAGES, "challenge.people.html", { count: 1 })).toContain(
      "пассажира",
    );
    expect(translate("ru", RU_MESSAGES, "challenge.timeLimit.html", { count: 21 })).toContain(
      "секунду",
    );
    expect(translate("ru", RU_MESSAGES, "challenge.waitLimit.html", { count: 21 })).toContain(
      "секунды",
    );
  });

  it("keeps English to one form for one and one for the rest", () => {
    expect(translate("en", EN_MESSAGES, "challenge.people.html", { count: 1 })).toContain("person");
    expect(translate("en", EN_MESSAGES, "challenge.people.html", { count: 2 })).toContain("people");
  });

  it("builds a challenge description exactly as the game builds it today", () => {
    // Byte for byte what src/game/challenges.ts renders, markup included: the
    // wiring agent can swap the template for this call and change nothing on
    // screen.
    const description = translate("en", EN_MESSAGES, "challenge.transportWithinTime.html", {
      people: translate("en", EN_MESSAGES, "challenge.people.html", { count: 23 }),
      time: translate("en", EN_MESSAGES, "challenge.timeLimit.html", { count: 30 }),
    });
    expect(description).toBe(
      "Transport <span class='emphasis-color'>23</span> people in " +
        "<span class='emphasis-color'>30</span> seconds or less",
    );
  });

  it("renders the same description in Russian, with the right forms throughout", () => {
    const description = translate(
      "ru",
      RU_MESSAGES,
      "challenge.transportWithinTimeWithMaxWait.html",
      {
        people: translate("ru", RU_MESSAGES, "challenge.people.html", { count: 23 }),
        time: translate("ru", RU_MESSAGES, "challenge.timeLimit.html", { count: 30 }),
        waitTime: translate("ru", RU_MESSAGES, "challenge.waitLimit.html", {
          count: decimal(2, 1),
        }),
      },
    );
    expect(description).toBe(
      "Перевезите <span class='emphasis-color'>23</span> пассажира за " +
        "<span class='emphasis-color'>30</span> секунд или быстрее, и пусть доставка каждого " +
        "не длится дольше " +
        "<span class='emphasis-color'>2,0</span> секунды",
    );
  });
});
