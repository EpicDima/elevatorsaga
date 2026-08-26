/** Checks the chapter one table's shape — length, order, and described conditions — not whether a level is worth playing. */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import { chapter1Levels } from "./chapter1.ts";
import { at } from "./test-helpers.ts";

afterEach(() => {
  // Resets the locale so later specs don't inherit whichever language ran last.
  setLocale(DEFAULT_LOCALE);
});

describe("chapter one table", () => {
  it("keeps the full legacy list, in order", () => {
    expect(chapter1Levels).toHaveLength(19);
  });

  it("ends the list with the moves-and-wait level", () => {
    // These numbers are the ones the reference program was measured against.
    const level = chapter1Levels.at(-1);
    expect(level?.options).toEqual({ floorCount: 8, elevatorCount: 6, spawnRate: 0.9 });
    expect(level?.condition.description).toBe(
      "Transport <span class='emphasis-color'>100</span> people using " +
        "<span class='emphasis-color'>450</span> elevator moves or less and let no one take " +
        "more than <span class='emphasis-color'>30.0</span> seconds to be delivered",
    );
  });

  it("gives every level a described condition and world options", () => {
    for (const level of chapter1Levels) {
      expect(level.condition.description.length).toBeGreaterThan(0);
      expect(typeof level.options.floorCount).toBe("number");
      expect(typeof level.options.elevatorCount).toBe("number");
      expect(typeof level.options.spawnRate).toBe("number");
    }
  });

  it("gives every entry a condition that can actually be met", () => {
    for (const level of chapter1Levels) {
      expect(level.condition.requirements.length).toBeGreaterThan(0);
    }
  });

  it("settles a description's language when it is read, not when the module was loaded", () => {
    // The table is built at import time, before any language is chosen, so
    // each description must be a getter rather than a field computed then.
    const level = at(chapter1Levels, 0);
    expect(level.condition.description).toContain("Transport");

    setLocale("ru");

    expect(level.condition.description).toContain("Перевезите");
  });
});
