import { describe, expect, it } from "vitest";

import { fullStorage, MemoryStorage } from "../../../ui/test-helpers.ts";
import {
  SKYSCRAPER_TIER_STORAGE_KEY,
  readBestSkyscraperTiers,
  recordSkyscraperTier,
} from "./progress.ts";

/**
 * A `Storage` that throws from everything, as Safari does in private mode.
 *
 * Written out here rather than taken from `src/ui/test-helpers.ts`, which only
 * shares the store that reads back and refuses writes: a store that cannot even
 * be read is the other half of the failure story, and the two suites that need
 * it each keep their own.
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

describe("SKYSCRAPER_TIER_STORAGE_KEY", () => {
  it("is the name already written on every browser that holds a medal", () => {
    // Spelled out rather than read back through the constant, the argument
    // `e2e/game-page.ts` makes about `CODE_STORAGE_KEY`: the key is an on-disk
    // contract, so a rename should fail here instead of being followed
    // silently and losing every medal earned so far.
    expect(SKYSCRAPER_TIER_STORAGE_KEY).toBe("develevateSkyscraperTiers");
    expect(SKYSCRAPER_TIER_STORAGE_KEY.startsWith("elevator")).toBe(false);
  });

  it("is not the key the numbered levels keep their medals under", () => {
    // That key is read back through `Number(...)`, so a `"sky-N"` row stored
    // there would be dropped on the next read and gone at the next win.
    expect(SKYSCRAPER_TIER_STORAGE_KEY).not.toBe("develevateChallengeTiers");
  });
});

describe("recordSkyscraperTier", () => {
  it("stores the medal against the level's id, not its position in the block", () => {
    // The property that survives the block being reordered: a level inserted
    // in the middle must not hand this medal to its neighbour.
    const storage = new MemoryStorage();

    recordSkyscraperTier(storage, "sky-1", "silver");

    expect(JSON.parse(storage.getItem(SKYSCRAPER_TIER_STORAGE_KEY) ?? "null")).toEqual({
      "sky-1": "silver",
    });
    expect(readBestSkyscraperTiers(storage)).toEqual(new Map([["sky-1", "silver"]]));
  });

  it("adds to what is already there rather than replacing it", () => {
    const storage = new MemoryStorage();

    recordSkyscraperTier(storage, "sky-1", "bronze");
    recordSkyscraperTier(storage, "sky-2", "gold");

    expect(readBestSkyscraperTiers(storage)).toEqual(
      new Map([
        ["sky-1", "bronze"],
        ["sky-2", "gold"],
      ]),
    );
  });

  it("upgrades a record when a later run does better", () => {
    const storage = new MemoryStorage();

    recordSkyscraperTier(storage, "sky-2", "bronze");
    recordSkyscraperTier(storage, "sky-2", "gold");

    expect(readBestSkyscraperTiers(storage)).toEqual(new Map([["sky-2", "gold"]]));
  });

  it("never lets a worse run erase a better one already on record", () => {
    const storage = new MemoryStorage();

    recordSkyscraperTier(storage, "sky-2", "gold");
    recordSkyscraperTier(storage, "sky-2", "bronze");

    expect(readBestSkyscraperTiers(storage)).toEqual(new Map([["sky-2", "gold"]]));
  });

  it("does not rewrite the key when the run only matches the record", () => {
    const storage = new MemoryStorage();
    recordSkyscraperTier(storage, "sky-2", "silver");
    const afterFirstWin = storage.getItem(SKYSCRAPER_TIER_STORAGE_KEY);

    recordSkyscraperTier(storage, "sky-2", "silver");

    expect(storage.getItem(SKYSCRAPER_TIER_STORAGE_KEY)).toBe(afterFirstWin);
  });

  it("keeps a level this build has never heard of", () => {
    // A cached older build loaded after a newer one has run. It has no level
    // to show that medal on, and deleting what it cannot show is the one loss
    // that cannot be undone.
    const storage = new MemoryStorage();
    storage.setItem(SKYSCRAPER_TIER_STORAGE_KEY, JSON.stringify({ "sky-99": "gold" }));

    recordSkyscraperTier(storage, "sky-1", "bronze");

    expect(readBestSkyscraperTiers(storage)).toEqual(
      new Map([
        ["sky-99", "gold"],
        ["sky-1", "bronze"],
      ]),
    );
  });

  it("does not throw when the store refuses to be written to", () => {
    // A won run may not be turned into an exception by the bookkeeping that
    // follows it.
    expect(() => {
      recordSkyscraperTier(fullStorage(), "sky-1", "gold");
    }).not.toThrow();
  });

  it("does not throw when the store refuses to be read", () => {
    expect(() => {
      recordSkyscraperTier(deniedStorage(), "sky-1", "gold");
    }).not.toThrow();
  });
});

describe("readBestSkyscraperTiers", () => {
  it("has nothing to report on a browser that has never played the block", () => {
    expect(readBestSkyscraperTiers(new MemoryStorage())).toEqual(new Map());
  });

  it("reads nothing out of a store that will not answer", () => {
    expect(readBestSkyscraperTiers(deniedStorage())).toEqual(new Map());
  });

  it("reads nothing out of an entry that is not a record of ids to medals", () => {
    // Whatever wrote these, a corrupt entry is not something a player can act
    // on and no run depends on the answer, so it reads as "nothing earned yet"
    // and the next win rewrites it.
    for (const corrupt of ["", "not json at all", "7", '"gold"', "null", '["sky-1"]']) {
      const storage = new MemoryStorage();
      storage.setItem(SKYSCRAPER_TIER_STORAGE_KEY, corrupt);
      expect(readBestSkyscraperTiers(storage)).toEqual(new Map());
    }
  });

  it("drops a row whose key is no level's id or whose value is no medal", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SKYSCRAPER_TIER_STORAGE_KEY,
      JSON.stringify({
        "sky-1": "gold",
        "sky-2": "platinum",
        "sky-3": 3,
        "": "silver",
      }),
    );

    expect(readBestSkyscraperTiers(storage)).toEqual(new Map([["sky-1", "gold"]]));
  });

  it("keeps a row for a level this build does not have", () => {
    // The read side of the same promise the write side keeps: a caller filters
    // against its own level list, this module does not decide what exists.
    const storage = new MemoryStorage();
    storage.setItem(SKYSCRAPER_TIER_STORAGE_KEY, JSON.stringify({ "sky-99": "gold" }));

    expect(readBestSkyscraperTiers(storage)).toEqual(new Map([["sky-99", "gold"]]));
  });
});
