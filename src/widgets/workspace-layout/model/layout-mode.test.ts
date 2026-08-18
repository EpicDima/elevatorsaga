import { describe, expect, it } from "vitest";

import {
  clampSplitPercent,
  defaultSplitPercentForMode,
  DEFAULT_LAYOUT_MODE,
  DEFAULT_SPLIT_PERCENT,
  LAYOUT_MODE_STORAGE_KEY,
  MAX_SPLIT_PERCENT,
  MIN_SPLIT_PERCENT,
  mirroredSplitOnLayoutChange,
  readLayoutMode,
  readSplitPercent,
  saveLayoutMode,
  saveSplitPercent,
  splitRange,
  SPLIT_PERCENT_STORAGE_KEY,
  type LayoutMode,
} from "./layout-mode.ts";
import { fullStorage, MemoryStorage } from "../../../ui/test-helpers.ts";

/** A store whose `getItem` throws, as Safari's private mode does. */
function throwingStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    getItem: () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };
}

describe("readLayoutMode", () => {
  it("defaults when nothing is stored", () => {
    expect(readLayoutMode(new MemoryStorage())).toBe(DEFAULT_LAYOUT_MODE);
  });

  it("reads back a stored mode", () => {
    const storage = new MemoryStorage();
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, "code");

    expect(readLayoutMode(storage)).toBe("code");
  });

  it("ignores a value that is not a real mode", () => {
    const storage = new MemoryStorage();
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, "sideways");

    expect(readLayoutMode(storage)).toBe(DEFAULT_LAYOUT_MODE);
  });

  it("defaults when the store cannot be read at all", () => {
    expect(readLayoutMode(throwingStorage())).toBe(DEFAULT_LAYOUT_MODE);
  });
});

describe("saveLayoutMode", () => {
  it("writes the mode", () => {
    const storage = new MemoryStorage();

    saveLayoutMode(storage, "game");

    expect(storage.getItem(LAYOUT_MODE_STORAGE_KEY)).toBe("game");
  });

  it("does not throw when the store refuses the write", () => {
    expect(() => {
      saveLayoutMode(fullStorage(), "left");
    }).not.toThrow();
  });
});

describe("readSplitPercent", () => {
  it("defaults when nothing is stored", () => {
    expect(readSplitPercent(new MemoryStorage())).toBe(DEFAULT_SPLIT_PERCENT);
  });

  it("reads back a stored percentage", () => {
    const storage = new MemoryStorage();
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, "45.5");

    expect(readSplitPercent(storage)).toBe(45.5);
  });

  it("defaults on a value that is not a number", () => {
    const storage = new MemoryStorage();
    storage.setItem(SPLIT_PERCENT_STORAGE_KEY, "wide");

    expect(readSplitPercent(storage)).toBe(DEFAULT_SPLIT_PERCENT);
  });

  it("defaults when the store cannot be read at all", () => {
    expect(readSplitPercent(throwingStorage())).toBe(DEFAULT_SPLIT_PERCENT);
  });
});

describe("saveSplitPercent", () => {
  it("writes the percentage", () => {
    const storage = new MemoryStorage();

    saveSplitPercent(storage, 40);

    expect(storage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBe("40");
  });

  it("does not throw when the store refuses the write", () => {
    expect(() => {
      saveSplitPercent(fullStorage(), 40);
    }).not.toThrow();
  });
});

describe("splitRange", () => {
  it("gives the full 20-85 range on a wide window", () => {
    // 380 / 3000 * 100 ≈ 12.7, well under the 40-point edge cap.
    expect(splitRange(3000)).toEqual([MIN_SPLIT_PERCENT, MAX_SPLIT_PERCENT]);
  });

  it("tightens the range as the window narrows", () => {
    const [low, high] = splitRange(1000);

    // 380 / 1000 * 100 = 38.
    expect(low).toBeCloseTo(38);
    expect(high).toBeCloseTo(62);
  });

  it("never asks for an edge wider than 40 points a side", () => {
    // 380 / 200 * 100 = 190, capped to 40 before the 20/85 clamp.
    expect(splitRange(200)).toEqual([40, 60]);
  });

  it("falls back to a 1440px window when the width is not measured yet", () => {
    expect(splitRange(0)).toEqual(splitRange(1440));
    expect(splitRange(-10)).toEqual(splitRange(1440));
  });
});

describe("clampSplitPercent", () => {
  it("leaves a percentage inside the range alone", () => {
    expect(clampSplitPercent(50, [20, 85])).toBe(50);
  });

  it("holds a percentage below the range at its low end", () => {
    expect(clampSplitPercent(5, [20, 85])).toBe(20);
  });

  it("holds a percentage above the range at its high end", () => {
    expect(clampSplitPercent(95, [20, 85])).toBe(85);
  });
});

describe("mirroredSplitOnLayoutChange", () => {
  const cases: readonly [LayoutMode, LayoutMode, boolean][] = [
    // Direct right/left swaps mirror, in either direction.
    ["right", "left", true],
    ["left", "right", true],
    // Leaving "left" for a single-pane mode mirrors too.
    ["left", "code", true],
    ["left", "game", true],
    // Entering "left" from a single-pane mode does not.
    ["code", "left", false],
    ["game", "left", false],
    // "right" is not mirrored against a single-pane mode either way.
    ["right", "code", false],
    ["code", "right", false],
    ["right", "game", false],
    ["game", "right", false],
    // Between the two single-pane modes, or a mode and itself: never.
    ["code", "game", false],
    ["game", "code", false],
    ["right", "right", false],
    ["left", "left", false],
  ];

  it.each(cases)("from %s to %s, mirrors: %s", (previousMode, nextMode, mirrors) => {
    const result = mirroredSplitOnLayoutChange(62, previousMode, nextMode);

    expect(result).toBe(mirrors ? 38 : 62);
  });
});

describe("defaultSplitPercentForMode", () => {
  it("is the shipped default outside left mode", () => {
    expect(defaultSplitPercentForMode("right")).toBe(DEFAULT_SPLIT_PERCENT);
    expect(defaultSplitPercentForMode("code")).toBe(DEFAULT_SPLIT_PERCENT);
    expect(defaultSplitPercentForMode("game")).toBe(DEFAULT_SPLIT_PERCENT);
  });

  it("is mirrored in left mode", () => {
    expect(defaultSplitPercentForMode("left")).toBe(100 - DEFAULT_SPLIT_PERCENT);
  });
});
