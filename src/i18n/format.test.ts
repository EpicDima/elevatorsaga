import { describe, expect, it } from "vitest";

import {
  decimal,
  exact,
  formatNumber,
  formatTimeOfDay,
  formatValue,
  interpolate,
  quantity,
  seconds,
  selectPlural,
  PLURAL_CATEGORIES,
} from "./format.ts";
import { LOCALES } from "./locale.ts";

/** The space Russian typography wants between a number and its unit. */
const NBSP = "\u00a0";

describe("PLURAL_CATEGORIES", () => {
  it.each(LOCALES)("lists exactly the categories ICU has for %s", (locale) => {
    const fromIcu = [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort();
    expect([...PLURAL_CATEGORIES[locale]].sort()).toEqual(fromIcu);
  });

  it("gives Russian four categories and English two", () => {
    expect(PLURAL_CATEGORIES.ru).toHaveLength(4);
    expect(PLURAL_CATEGORIES.en).toHaveLength(2);
  });
});

describe("selectPlural", () => {
  // The four Russian categories, and the numbers that make `count === 1 ? a : b`
  // wrong: 2 is not 1 and is not "many" either, and 21 is "one" despite being
  // plural in English.
  it.each([
    [1, "one"],
    [21, "one"],
    [101, "one"],
    [2, "few"],
    [3, "few"],
    [23, "few"],
    [5, "many"],
    [11, "many"],
    [0, "many"],
    [100, "many"],
    [2675, "many"],
  ])("puts %i in the Russian category %s", (count, category) => {
    expect(selectPlural("ru", count)).toBe(category);
  });

  it("puts a fraction in the Russian 'other' category", () => {
    expect(selectPlural("ru", decimal(1.5, 1))).toBe("other");
  });

  it("follows the digits that will be printed, not the number", () => {
    // 21 is "one" as it stands (21 секунда) and "other" once a decimal is shown
    // (21,0 секунды). The formatter options travel with the count for exactly
    // this reason.
    expect(selectPlural("ru", 21)).toBe("one");
    expect(selectPlural("ru", decimal(21, 1))).toBe("other");
  });

  it("keeps English to its two categories", () => {
    expect(selectPlural("en", 1)).toBe("one");
    expect(selectPlural("en", 0)).toBe("other");
    expect(selectPlural("en", 2)).toBe("other");
    expect(selectPlural("en", decimal(1, 1))).toBe("other");
  });
});

describe("formatNumber", () => {
  it("groups thousands the way each locale does", () => {
    expect(formatNumber("en", 2675)).toBe("2,675");
    expect(formatNumber("ru", 2675)).toBe(`2${NBSP}675`);
  });

  it("writes the decimal separator each locale writes", () => {
    expect(formatNumber("en", 1.5, { minimumFractionDigits: 1 })).toBe("1.5");
    expect(formatNumber("ru", 1.5, { minimumFractionDigits: 1 })).toBe("1,5");
  });

  it("keeps a unit on the same line as its number", () => {
    // CLDR's Russian pattern is "{0} с" with an ordinary space, which would be
    // free to break; the game's own English "60s" is unaffected.
    expect(formatNumber("en", 60, { style: "unit", unit: "second", unitDisplay: "narrow" })).toBe(
      "60s",
    );
    expect(formatNumber("ru", 60, { style: "unit", unit: "second", unitDisplay: "narrow" })).toBe(
      `60${NBSP}с`,
    );
  });
});

describe("quantity helpers", () => {
  it("renders a fixed number of decimals, as toFixed did", () => {
    expect(formatValue("en", decimal(1.4732, 1))).toBe("1.5");
    expect(formatValue("ru", decimal(1.4732, 1))).toBe("1,5");
    expect(formatValue("en", decimal(12, 0))).toBe("12");
  });

  it("keeps every digit of a number somebody typed", () => {
    // The default is three decimals, which quietly rewrites the two numbers
    // below. They reach the screen from the address bar, where the player put
    // them, and a bar that rounds them is describing a different run.
    expect(formatValue("en", exact(0.0625))).toBe("0.0625");
    expect(formatValue("en", exact(9.9999))).toBe("9.9999");
    expect(formatValue("ru", exact(0.0625))).toBe("0,0625");
    // Nothing is padded on the way: an integer is still an integer, and a
    // thousand is still grouped.
    expect(formatValue("en", exact(8))).toBe("8");
    expect(formatValue("en", exact(2675))).toBe("2,675");
  });

  it("chooses the plural form the digits it will print deserve", () => {
    // 1,0004 is not «1 пассажир»: what makes a Russian noun singular here is
    // the digits on screen, and asking for all of them changes which they are.
    expect(selectPlural("ru", exact(1.0004))).toBe("other");
    expect(selectPlural("ru", 1.0004)).toBe("one");
    expect(selectPlural("ru", exact(1))).toBe("one");
  });

  it("renders durations with their unit", () => {
    expect(formatValue("en", seconds(60))).toBe("60s");
    expect(formatValue("ru", seconds(60))).toBe(`60${NBSP}с`);
    expect(formatValue("ru", seconds(1.5, 1))).toBe(`1,5${NBSP}с`);
  });

  it("carries its formatting into the plural choice", () => {
    expect(selectPlural("ru", seconds(21))).toBe("one");
    expect(selectPlural("ru", seconds(21, 1))).toBe("other");
  });

  it("defaults to no formatting options", () => {
    expect(quantity(7)).toEqual({ value: 7, format: {} });
  });
});

describe("formatValue", () => {
  it("passes a string through untouched", () => {
    expect(formatValue("ru", "<span>already rendered</span>")).toBe(
      "<span>already rendered</span>",
    );
  });

  it("renders a bare number for the locale", () => {
    expect(formatValue("ru", 2675)).toBe(`2${NBSP}675`);
  });
});

describe("formatTimeOfDay", () => {
  // A local-time date, so the assertion holds in every time zone the tests run in.
  const when = new Date(2024, 0, 2, 21, 3, 57);

  it("writes a Russian time the way Russian writes it", () => {
    expect(formatTimeOfDay("ru", when)).toBe("21:03:57");
  });

  it("writes an English time the way English writes it", () => {
    expect(formatTimeOfDay("en", when)).toMatch(/^9:03:57\s?PM$/);
  });
});

describe("interpolate", () => {
  it("fills placeholders by name", () => {
    expect(interpolate("en", "Elevator {number}", { number: 3 })).toBe("Elevator 3");
  });

  it("lets a translation reorder them", () => {
    const params = { first: "one", second: "two" };
    expect(interpolate("en", "{first} then {second}", params)).toBe("one then two");
    expect(interpolate("en", "{second} then {first}", params)).toBe("two then one");
  });

  it("fills a placeholder used more than once", () => {
    expect(interpolate("en", "{floor} to {floor}", { floor: 4 })).toBe("4 to 4");
  });

  it("renders numeric parameters for the locale", () => {
    expect(interpolate("ru", "{count} этажей", { count: 2675 })).toBe(`2${NBSP}675 этажей`);
    expect(interpolate("ru", "дольше {time}", { time: decimal(21, 1) })).toBe("дольше 21,0");
  });

  it("leaves a placeholder it was given nothing for", () => {
    // Better a visible {floor} than a sentence with a hole in it; the types
    // keep this out of the game's own call sites.
    expect(interpolate("en", "Go to floor {floor}", {})).toBe("Go to floor {floor}");
  });

  it("leaves text that only looks like a placeholder", () => {
    expect(interpolate("en", "function() { init: 1 }", {})).toBe("function() { init: 1 }");
  });
});
