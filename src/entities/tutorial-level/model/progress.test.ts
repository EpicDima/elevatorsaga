import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../../ui/test-helpers.ts";
import {
  TUTORIAL_PROGRESS_STORAGE_KEY,
  countClearedTutorialLevels,
  readClearedTutorialLevels,
  recordClearedTutorialLevel,
} from "./progress.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import type { TutorialLevel } from "#game/tutorial.ts";

/**
 * A `Storage` that throws from everything, as Safari does in private mode.
 *
 * @returns The refusing store.
 */
function deniedStorage(): Storage {
  const denied = (): never => {
    throw new Error("denied");
  };
  return {
    get length(): number {
      return denied();
    },
    clear: denied,
    getItem: denied,
    key: denied,
    removeItem: denied,
    setItem: denied,
  };
}

/**
 * A `Storage` that reads back but refuses every write, as a full quota does.
 *
 * @param entries - What the store is already holding.
 * @returns The full store.
 */
function fullStorage(entries: Readonly<Record<string, string>> = {}): Storage {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(entries)) {
    storage.setItem(key, value);
  }
  return {
    get length(): number {
      return storage.length;
    },
    clear: () => {
      storage.clear();
    },
    getItem: (key: string) => storage.getItem(key),
    key: (index: number) => storage.key(index),
    removeItem: (key: string) => {
      storage.removeItem(key);
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

describe("TUTORIAL_PROGRESS_STORAGE_KEY", () => {
  it("is under the fork's own prefix, not the inherited one", () => {
    // A player may have this game and the game it was forked from in one
    // browser profile. Everything this fork invented stays out of the
    // `elevatorCrush*` namespace, which means something else over there.
    expect(TUTORIAL_PROGRESS_STORAGE_KEY).toBe("develevateTutorialProgress");
    expect(TUTORIAL_PROGRESS_STORAGE_KEY.startsWith("elevator")).toBe(false);
  });
});

describe("recordClearedTutorialLevel", () => {
  it("stores the identifier of the level, and not its position", () => {
    // The property that survives the track being reordered: a ninth level
    // inserted at number two must not hand every stored number to a different
    // lesson.
    const storage = new MemoryStorage();

    recordClearedTutorialLevel(storage, "tutorial-3");

    expect(JSON.parse(storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY) ?? "null")).toEqual([
      "tutorial-3",
    ]);
    expect(readClearedTutorialLevels(storage)).toEqual(new Set(["tutorial-3"]));
  });

  it("adds to what is already there rather than replacing it", () => {
    const storage = new MemoryStorage();

    recordClearedTutorialLevel(storage, "tutorial-1");
    recordClearedTutorialLevel(storage, "tutorial-4");

    expect(readClearedTutorialLevels(storage)).toEqual(new Set(["tutorial-1", "tutorial-4"]));
  });

  it("keeps a level cleared once cleared, however often it is replayed", () => {
    const storage = new MemoryStorage();
    recordClearedTutorialLevel(storage, "tutorial-1");
    const afterFirstWin = storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY);

    recordClearedTutorialLevel(storage, "tutorial-1");

    expect(storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY)).toBe(afterFirstWin);
    expect(readClearedTutorialLevels(storage)).toEqual(new Set(["tutorial-1"]));
  });

  it("keeps an identifier this build has never heard of", () => {
    // A cached older build loaded after a newer one has run. It cannot show
    // level 9, and deleting what it cannot show is the one loss that cannot be
    // undone.
    const storage = new MemoryStorage();
    storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify(["tutorial-9"]));

    recordClearedTutorialLevel(storage, "tutorial-1");

    expect(readClearedTutorialLevels(storage)).toEqual(new Set(["tutorial-9", "tutorial-1"]));
  });

  it("does not throw when the store refuses to be written to", () => {
    // A won run may not be turned into an exception by the bookkeeping that
    // follows it.
    const storage = fullStorage();

    expect(() => {
      recordClearedTutorialLevel(storage, "tutorial-1");
    }).not.toThrow();
  });

  it("does not throw when the store refuses to be read", () => {
    const storage = deniedStorage();

    expect(() => {
      recordClearedTutorialLevel(storage, "tutorial-1");
    }).not.toThrow();
  });
});

describe("readClearedTutorialLevels", () => {
  it("has nothing to report on a browser that has never played the track", () => {
    expect(readClearedTutorialLevels(new MemoryStorage())).toEqual(new Set());
  });

  it("reads nothing out of a store that will not answer", () => {
    expect(readClearedTutorialLevels(deniedStorage())).toEqual(new Set());
  });

  it("reads nothing out of an entry that is not a list of identifiers", () => {
    // Whatever wrote these, a corrupt entry is not something a player can act
    // on and no run depends on the answer, so it reads as "nothing yet" and the
    // next win rewrites it.
    for (const corrupt of ["", "not json at all", "7", '"tutorial-1"', '{"tutorial-1":true}']) {
      const storage = new MemoryStorage();
      storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, corrupt);
      expect(readClearedTutorialLevels(storage)).toEqual(new Set());
    }
  });

  it("drops entries of a list that cannot be anybody's identifier", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TUTORIAL_PROGRESS_STORAGE_KEY,
      JSON.stringify(["tutorial-2", 3, null, "", { id: "tutorial-4" }]),
    );

    expect(readClearedTutorialLevels(storage)).toEqual(new Set(["tutorial-2"]));
  });
});

describe("countClearedTutorialLevels", () => {
  it("counts the levels of the track that were cleared", () => {
    const cleared = new Set(["tutorial-1", "tutorial-3"]);
    expect(countClearedTutorialLevels(cleared, tutorialLevels)).toBe(2);
  });

  it("counts nothing twice and nothing that is not on the track", () => {
    // Otherwise the panel says "9 of 8 levels done" to a player who once ran a
    // newer deployment.
    const cleared = new Set(["tutorial-1", "tutorial-9", "elevatorCrushCode_v5"]);
    expect(countClearedTutorialLevels(cleared, tutorialLevels)).toBe(1);
  });

  it("counts every level when the whole track has been cleared", () => {
    const cleared = new Set(tutorialLevels.map((level) => level.id));
    expect(countClearedTutorialLevels(cleared, tutorialLevels)).toBe(tutorialLevels.length);
  });

  it("follows the levels it is given, so a reordered track still counts one each", () => {
    // The count is an intersection by identifier: reversing the table changes
    // nothing, which is the property a stored position would not have.
    const reordered: readonly TutorialLevel[] = [...tutorialLevels].reverse();
    const cleared = new Set(["tutorial-8"]);

    expect(countClearedTutorialLevels(cleared, reordered)).toBe(1);
  });
});
