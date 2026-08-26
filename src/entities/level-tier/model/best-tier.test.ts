import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../../ui/test-helpers.ts";
import { LEVEL_TIER_STORAGE_KEY, readBestLevelTiers, recordLevelTier } from "./best-tier.ts";

/** A `Storage` that throws from everything, as Safari does in private mode. */
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

/** A `Storage` that reads back but refuses every write, as a full quota does. */
function fullStorage(): Storage {
  const storage = new MemoryStorage();
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

describe("LEVEL_TIER_STORAGE_KEY", () => {
  it("is under the fork's own prefix, not the inherited one", () => {
    expect(LEVEL_TIER_STORAGE_KEY).toBe("develevateChallengeTiers");
    expect(LEVEL_TIER_STORAGE_KEY.startsWith("elevator")).toBe(false);
  });
});

describe("recordLevelTier", () => {
  it("stores the tier a level was just won at", () => {
    const storage = new MemoryStorage();

    recordLevelTier(storage, 4, "silver");

    expect(readBestLevelTiers(storage)).toEqual(new Map([[4, "silver"]]));
  });

  it("adds to what is already there rather than replacing it", () => {
    const storage = new MemoryStorage();

    recordLevelTier(storage, 0, "bronze");
    recordLevelTier(storage, 1, "gold");

    expect(readBestLevelTiers(storage)).toEqual(
      new Map([
        [0, "bronze"],
        [1, "gold"],
      ]),
    );
  });

  it("upgrades a record when a later run does better", () => {
    const storage = new MemoryStorage();

    recordLevelTier(storage, 2, "bronze");
    recordLevelTier(storage, 2, "gold");

    expect(readBestLevelTiers(storage)).toEqual(new Map([[2, "gold"]]));
  });

  it("never lets a worse run erase a better one already on record", () => {
    const storage = new MemoryStorage();

    recordLevelTier(storage, 2, "gold");
    recordLevelTier(storage, 2, "bronze");

    expect(readBestLevelTiers(storage)).toEqual(new Map([[2, "gold"]]));
  });

  it("does not rewrite the key when the run does not improve on the record", () => {
    const storage = new MemoryStorage();
    recordLevelTier(storage, 2, "silver");
    const afterFirstWin = storage.getItem(LEVEL_TIER_STORAGE_KEY);

    recordLevelTier(storage, 2, "silver");

    expect(storage.getItem(LEVEL_TIER_STORAGE_KEY)).toBe(afterFirstWin);
  });

  it("does not throw when the store refuses to be written to", () => {
    expect(() => {
      recordLevelTier(fullStorage(), 0, "gold");
    }).not.toThrow();
  });

  it("does not throw when the store refuses to be read", () => {
    expect(() => {
      recordLevelTier(deniedStorage(), 0, "gold");
    }).not.toThrow();
  });
});

describe("readBestLevelTiers", () => {
  it("has nothing to report on a browser that has never won a level", () => {
    expect(readBestLevelTiers(new MemoryStorage())).toEqual(new Map());
  });

  it("reads nothing out of a store that will not answer", () => {
    expect(readBestLevelTiers(deniedStorage())).toEqual(new Map());
  });

  it("reads nothing out of an entry that is not a level-to-tier record", () => {
    for (const corrupt of ["", "not json at all", "7", '"gold"', "[1,2,3]"]) {
      const storage = new MemoryStorage();
      storage.setItem(LEVEL_TIER_STORAGE_KEY, corrupt);
      expect(readBestLevelTiers(storage)).toEqual(new Map());
    }
  });

  it("drops entries whose key is not a level index or whose value is not a tier", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEVEL_TIER_STORAGE_KEY,
      JSON.stringify({
        "0": "gold",
        "1": "platinum",
        notAnIndex: "silver",
        "-1": "bronze",
        "2.5": "bronze",
      }),
    );

    expect(readBestLevelTiers(storage)).toEqual(new Map([[0, "gold"]]));
  });

  it("keeps an entry for a level this build no longer has", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEVEL_TIER_STORAGE_KEY, JSON.stringify({ "99": "gold" }));

    expect(readBestLevelTiers(storage)).toEqual(new Map([[99, "gold"]]));
  });
});
