import { describe, expect, it } from "vitest";

import {
  decimal,
  exact,
  formatList,
  formatNumber,
  formatValue,
  formatValueParts,
  interpolate,
  percent,
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
  // The four Russian categories: 21 is "one" despite being plural in English.
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
    // 21 is "one" (21 секунда) but "other" once a decimal is shown (21,0 секунды).
    expect(selectPlural("ru", 21)).toBe("one");
    expect(selectPlural("ru", decimal(21, 1))).toBe("other");
  });

  it("counts a quantity written without formatting options", () => {
    // `{ value }` alone is a legal count and must mean what a bare number means.
    expect(selectPlural("ru", { value: 21 })).toBe("one");
    expect(selectPlural("ru", { value: 5 })).toBe("many");
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
    // CLDR's Russian pattern is "{0} с" with an ordinary, breakable space.
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
    // The default of three decimals would quietly round a value the player typed into the address bar.
    expect(formatValue("en", exact(0.0625))).toBe("0.0625");
    expect(formatValue("en", exact(9.9999))).toBe("9.9999");
    expect(formatValue("ru", exact(0.0625))).toBe("0,0625");
    expect(formatValue("en", exact(8))).toBe("8");
    expect(formatValue("en", exact(2675))).toBe("2,675");
  });

  it("chooses the plural form the digits it will print deserve", () => {
    // 1,0004 is not «1 пассажир»: showing every digit changes what's on screen.
    expect(selectPlural("ru", exact(1.0004))).toBe("other");
    expect(selectPlural("ru", 1.0004)).toBe("one");
    expect(selectPlural("ru", exact(1))).toBe("one");
  });

  it("renders a fraction of one as a percentage", () => {
    expect(formatValue("en", percent(0.485))).toBe("49%");
    expect(formatValue("en", percent(0))).toBe("0%");
    expect(formatValue("en", percent(1))).toBe("100%");
    expect(formatValue("en", percent(0.5694, 1))).toBe("56.9%");
  });

  it("puts the space before a Russian percent sign, and none in English", () => {
    // CLDR's percent space is already non-breaking, unlike its unit space.
    expect(formatValue("ru", percent(0.721))).toBe(`72${NBSP}%`);
    expect(formatValue("ru", percent(0.5694, 1))).toBe(`56,9${NBSP}%`);
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

  it("renders a quantity written without formatting options like the bare number", () => {
    expect(formatValue("ru", { value: 2675 })).toBe(formatValue("ru", 2675));
  });
});

describe("formatValueParts", () => {
  it("hands back the digits and the unit apart, with the gap on the unit's side", () => {
    // The gap belongs to the unit, since that's the part the stats tiles style down a size.
    expect(formatValueParts("ru", seconds(3.9, 1))).toEqual({
      number: "3,9",
      unit: `${NBSP}с`,
    });
    expect(formatValueParts("en", seconds(3.9, 1))).toEqual({ number: "3.9", unit: "s" });
  });

  it("counts a percent sign as the unit, in either locale's punctuation", () => {
    expect(formatValueParts("ru", percent(0.23))).toEqual({ number: "23", unit: `${NBSP}%` });
    expect(formatValueParts("en", percent(0.23))).toEqual({ number: "23", unit: "%" });
  });

  it("gives a quantity with no unit an empty one, rather than guessing at a suffix", () => {
    expect(formatValueParts("ru", decimal(1.5, 2))).toEqual({ number: "1,50", unit: "" });
    expect(formatValueParts("ru", 2675)).toEqual({ number: `2${NBSP}675`, unit: "" });
    expect(formatValueParts("ru", "already rendered")).toEqual({
      number: "already rendered",
      unit: "",
    });
    expect(formatValueParts("ru", { value: 2675 })).toEqual({ number: `2${NBSP}675`, unit: "" });
  });

  it("splits exactly what formatValue joins, for every quantity the panel draws", () => {
    const values = [seconds(0), seconds(61.44, 1), percent(0), percent(1), decimal(0.5, 2), 0, 21];
    for (const locale of LOCALES) {
      for (const value of values) {
        const parts = formatValueParts(locale, value);
        expect(parts.number + parts.unit, `${locale} ${JSON.stringify(value)}`).toBe(
          formatValue(locale, value),
        );
      }
    }
  });

  it("leaves no ordinary space for a line to break the unit off at", () => {
    for (const locale of LOCALES) {
      expect(formatValueParts(locale, seconds(1.5, 1)).unit, locale).not.toContain(" ");
    }
  });
});

describe("formatList", () => {
  it("ends a Russian list with a word, so a comma cannot be read as a decimal", () => {
    // «6, 9» is how six point nine is written in Russian, so ", " would be ambiguous.
    expect(formatList("ru", ["6", "9"])).toBe("6 и 9");
    expect(formatList("ru", ["4", "5", "6"])).toBe("4, 5 и 6");
  });

  it("ends an English list with a word too", () => {
    expect(formatList("en", ["6", "9"])).toBe("6 and 9");
    expect(formatList("en", ["4", "5", "6"])).toBe("4, 5, and 6");
  });

  it("adds nothing to a list with nothing to separate", () => {
    for (const locale of LOCALES) {
      expect(formatList(locale, ["4"]), locale).toBe("4");
      expect(formatList(locale, []), locale).toBe("");
    }
  });

  it("leaves the items exactly as they were handed over", () => {
    expect(formatList("en", ["<span class='emphasis-color'>6</span>", "<b>9</b>"])).toBe(
      "<span class='emphasis-color'>6</span> and <b>9</b>",
    );
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
    expect(interpolate("en", "Go to floor {floor}", {})).toBe("Go to floor {floor}");
  });

  it("leaves text that only looks like a placeholder", () => {
    expect(interpolate("en", "function() { init: 1 }", {})).toBe("function() { init: 1 }");
  });
});
