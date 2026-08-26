import { describe, expect, it } from "vitest";

import { fullStorage, MemoryStorage } from "../../../ui/test-helpers.ts";
import {
  CHAPTER2_TIER_STORAGE_KEY,
  readBestChapter2Tiers,
  recordChapter2Tier,
} from "./progress.ts";

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

describe("CHAPTER2_TIER_STORAGE_KEY", () => {
  it("is the name already written on every browser that holds a medal", () => {
    // Spelled out rather than compared to itself: the key is an on-disk
    // contract, so a rename should fail here rather than silently lose medals.
    expect(CHAPTER2_TIER_STORAGE_KEY).toBe("develevateChapter2Tiers");
    expect(CHAPTER2_TIER_STORAGE_KEY.startsWith("elevator")).toBe(false);
  });

  it("is not the key the numbered levels keep their medals under", () => {
    // That key is read back through Number(...), so a "chapter2-N" row stored there
    // would be dropped on the next read.
    expect(CHAPTER2_TIER_STORAGE_KEY).not.toBe("develevateChallengeTiers");
  });
});

describe("recordChapter2Tier", () => {
  it("stores the medal against the level's id, not its position in the block", () => {
    // Survives the block being reordered: a level inserted in the middle must
    // not hand this medal to its neighbor.
    const storage = new MemoryStorage();

    recordChapter2Tier(storage, "chapter2-1", "silver");

    expect(JSON.parse(storage.getItem(CHAPTER2_TIER_STORAGE_KEY) ?? "null")).toEqual({
      "chapter2-1": "silver",
    });
    expect(readBestChapter2Tiers(storage)).toEqual(new Map([["chapter2-1", "silver"]]));
  });

  it("adds to what is already there rather than replacing it", () => {
    const storage = new MemoryStorage();

    recordChapter2Tier(storage, "chapter2-1", "bronze");
    recordChapter2Tier(storage, "chapter2-2", "gold");

    expect(readBestChapter2Tiers(storage)).toEqual(
      new Map([
        ["chapter2-1", "bronze"],
        ["chapter2-2", "gold"],
      ]),
    );
  });

  it("upgrades a record when a later run does better", () => {
    const storage = new MemoryStorage();

    recordChapter2Tier(storage, "chapter2-2", "bronze");
    recordChapter2Tier(storage, "chapter2-2", "gold");

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([["chapter2-2", "gold"]]));
  });

  it("never lets a worse run erase a better one already on record", () => {
    const storage = new MemoryStorage();

    recordChapter2Tier(storage, "chapter2-2", "gold");
    recordChapter2Tier(storage, "chapter2-2", "bronze");

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([["chapter2-2", "gold"]]));
  });

  it("does not rewrite the key when the run only matches the record", () => {
    const storage = new MemoryStorage();
    recordChapter2Tier(storage, "chapter2-2", "silver");
    const afterFirstWin = storage.getItem(CHAPTER2_TIER_STORAGE_KEY);

    recordChapter2Tier(storage, "chapter2-2", "silver");

    expect(storage.getItem(CHAPTER2_TIER_STORAGE_KEY)).toBe(afterFirstWin);
  });

  it("keeps a level this build has never heard of", () => {
    // A cached older build has no level to show this medal on; deleting what
    // it can't show would be unrecoverable.
    const storage = new MemoryStorage();
    storage.setItem(CHAPTER2_TIER_STORAGE_KEY, JSON.stringify({ "chapter2-99": "gold" }));

    recordChapter2Tier(storage, "chapter2-1", "bronze");

    expect(readBestChapter2Tiers(storage)).toEqual(
      new Map([
        ["chapter2-99", "gold"],
        ["chapter2-1", "bronze"],
      ]),
    );
  });

  it("does not throw when the store refuses to be written to", () => {
    expect(() => {
      recordChapter2Tier(fullStorage(), "chapter2-1", "gold");
    }).not.toThrow();
  });

  it("does not throw when the store refuses to be read", () => {
    expect(() => {
      recordChapter2Tier(deniedStorage(), "chapter2-1", "gold");
    }).not.toThrow();
  });
});

describe("readBestChapter2Tiers", () => {
  it("has nothing to report on a browser that has never played the block", () => {
    expect(readBestChapter2Tiers(new MemoryStorage())).toEqual(new Map());
  });

  it("reads nothing out of a store that will not answer", () => {
    expect(readBestChapter2Tiers(deniedStorage())).toEqual(new Map());
  });

  it("reads nothing out of an entry that is not a record of ids to medals", () => {
    // A corrupt entry reads as "nothing earned yet"; the next win rewrites it.
    for (const corrupt of ["", "not json at all", "7", '"gold"', "null", '["chapter2-1"]']) {
      const storage = new MemoryStorage();
      storage.setItem(CHAPTER2_TIER_STORAGE_KEY, corrupt);
      expect(readBestChapter2Tiers(storage)).toEqual(new Map());
    }
  });

  it("drops a row whose key is no level's id or whose value is no medal", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CHAPTER2_TIER_STORAGE_KEY,
      JSON.stringify({
        "chapter2-1": "gold",
        "chapter2-2": "platinum",
        "chapter2-3": 3,
        "": "silver",
      }),
    );

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([["chapter2-1", "gold"]]));
  });

  it("keeps a row for a level this build does not have", () => {
    const storage = new MemoryStorage();
    storage.setItem(CHAPTER2_TIER_STORAGE_KEY, JSON.stringify({ "chapter2-99": "gold" }));

    expect(readBestChapter2Tiers(storage)).toEqual(new Map([["chapter2-99", "gold"]]));
  });
});
