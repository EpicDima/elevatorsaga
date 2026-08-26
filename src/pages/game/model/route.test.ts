import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SandboxOptions } from "#game/levels.ts";
import { chapter2Levels } from "#game/chapter2.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import { createParamsUrl, parseQuery, type RouteQuery } from "#shared/lib/route-query.ts";
import {
  DEFAULT_TIME_SCALE,
  TIME_SCALE_MAX,
  TIME_SCALE_MIN,
} from "#features/adjust-speed/model/time-scale.ts";
import {
  LEGACY_LEVEL_KEY,
  LEVEL_KEY,
  renameLegacyLevelKey,
  resolveRoute,
  SANDBOX_LEVEL,
  CHAPTER2_LEVEL_PREFIX,
  startRouter,
  TUTORIAL_LEVEL_PREFIX,
  type RouteParams,
  type RouterTarget,
} from "./route.ts";

/** The context a route is resolved against in these tests. */
const CONTEXT = {
  levelCount: 18,
  defaultTimeScale: DEFAULT_TIME_SCALE,
};

/** Resolves a location hash the way the running game does. */
function route(hash: string): ReturnType<typeof resolveRoute> {
  return resolveRoute(parseQuery(hash), CONTEXT);
}

/** A window stand-in whose hash and events the test drives. */
class FakeTarget implements RouterTarget {
  location = { hash: "" };
  /** Every url the router has rewritten the address bar to, in order. */
  readonly replaced: string[] = [];
  /**
   * Mimics a real `History`: `replaceState` updates `location`, since the router reads the
   * hash back from there, and a real browser resolves `"#"` to an empty fragment, so this
   * stand-in must too.
   */
  readonly history = {
    state: null as unknown,
    replaceState: (data: unknown, _unused: string, url: string): void => {
      this.history.state = data;
      this.location = { hash: url === "#" ? "" : url };
      this.replaced.push(url);
    },
  };
  readonly #listeners = new Map<string, Set<() => void>>();

  addEventListener(type: "hashchange" | "popstate", listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: "hashchange" | "popstate", listener: () => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  /** Navigates, then raises the event a browser would raise. */
  navigate(hash: string, type: "hashchange" | "popstate" = "hashchange"): void {
    this.location = { hash };
    for (const listener of this.#listeners.get(type) ?? []) {
      listener();
    }
  }

  /** How many listeners are currently registered, across all events. */
  get listenerCount(): number {
    return [...this.#listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

beforeEach(() => {
  // Cleared as well as silenced: the spy outlives the spec, so uncleared warnings from
  // earlier tests would leak into later assertions.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
});

describe("createParamsUrl composed with resolveRoute", () => {
  it("keeps a round-tripped level address opening the same level", () => {
    const hash = "#level=tutorial-3,timescale=8,fullscreen=true";
    expect(route(createParamsUrl(parseQuery(hash))).tutorialIndex).toBe(2);
  });

  it("takes a player on a level off the track when the navigation row rewrites the key", () => {
    const query = parseQuery("#level=tutorial-3,timescale=8");
    const url = createParamsUrl(query, { [LEVEL_KEY]: 5, seed: null });
    expect(url).toBe("#level=5,timescale=8");
    expect(route(url).tutorialIndex).toBeNull();
    expect(route(url).levelIndex).toBe(4);
  });
});

describe("the legacy level key", () => {
  it("renames the key in place, so a corrected url reads in the order it was written", () => {
    expect([...renameLegacyLevelKey(parseQuery("#challenge=5,timescale=8"))]).toEqual([
      [LEVEL_KEY, "5"],
      ["timescale", "8"],
    ]);
  });

  it("hands back the very query it was given when there is nothing to rename", () => {
    // Object identity, not equality: startRouter compares by reference to decide whether a
    // hash needs correcting, so a fresh copy here would rewrite the address bar on every visit.
    for (const hash of ["#level=5,timescale=8", "#timescale=8", ""]) {
      const query = parseQuery(hash);
      expect(renameLegacyLevelKey(query), hash).toBe(query);
    }
  });

  it("keeps the modern key when a url names both", () => {
    // `level` reflects the player's most recent click; keeping the legacy value instead
    // would let a link carrying both spellings persist forever.
    const both = renameLegacyLevelKey(parseQuery("#challenge=5,level=9,timescale=8"));
    expect([...both]).toEqual([
      [LEVEL_KEY, "9"],
      ["timescale", "8"],
    ]);
    expect(both.has(LEGACY_LEVEL_KEY)).toBe(false);
  });

  it("opens exactly what the same url spelled the new way opens", () => {
    for (const value of ["5", "sandbox", "tutorial-3", "chapter2-1", "abc", "19"]) {
      expect(route(`#challenge=${value}`), value).toEqual(route(`#level=${value}`));
    }
  });

  it("carries the rest of a legacy url through untouched", () => {
    expect(route("#challenge=sandbox,floors=9,elevators=3,timescale=8,seed=issue-61")).toEqual(
      route("#level=sandbox,floors=9,elevators=3,timescale=8,seed=issue-61"),
    );
  });

  it("opens a legacy level address exactly as the new spelling opens", () => {
    expect(route("#challenge=18")).toEqual(route("#level=18"));
  });
});

describe("resolveRoute defaults", () => {
  it("starts the first level, paused, at the default speed", () => {
    expect(route("")).toEqual({
      levelIndex: 0,
      sandbox: null,
      tutorialIndex: null,
      chapter2Index: null,
      timeScale: DEFAULT_TIME_SCALE,
      fullscreen: false,
      seed: null,
      refusedKeys: [],
    });
  });

  it("reads every parameter the game supports", () => {
    expect(route("#level=4,timescale=8,fullscreen=true,seed=abc")).toEqual({
      levelIndex: 3,
      sandbox: null,
      tutorialIndex: null,
      chapter2Index: null,
      timeScale: 8,
      fullscreen: true,
      seed: "abc",
      refusedKeys: [],
    });
  });

  it("reads a route written in capitals", () => {
    const params = route("#LEVEL=4,SEED=issue-61,TIMESCALE=8,FULLSCREEN");
    expect(params).toMatchObject({
      levelIndex: 3,
      seed: "issue-61",
      timeScale: 8,
      fullscreen: true,
    });
    expect(route("#LEVEL=SANDBOX").sandbox).not.toBeNull();
  });

  it("treats a flag as off only when it says false", () => {
    expect(route("#fullscreen=false").fullscreen).toBe(false);
    expect(route("#fullscreen=whatever").fullscreen).toBe(true);
    expect(route("#fullscreen").fullscreen).toBe(true);
  });
});

describe("resolveRoute level validation", () => {
  it("accepts an in-range level number and makes it zero-based", () => {
    expect(route("#level=1").levelIndex).toBe(0);
    expect(route("#level=18").levelIndex).toBe(17);
  });

  it("falls back to the first level for a number that is not one", () => {
    for (const hash of ["#level=abc", "#level=", "#level=NaN"]) {
      expect(route(hash).levelIndex, hash).toBe(0);
    }
  });

  it("falls back to the first level for a number out of range", () => {
    for (const hash of ["#level=0", "#level=-3", "#level=19", "#level=1e9"]) {
      expect(route(hash).levelIndex, hash).toBe(0);
    }
  });

  it("refuses a level number with anything else attached to it", () => {
    // Number reads the whole string or nothing, unlike parseInt, which would read "3abc" as 3.
    for (const value of ["3abc", "3.5", "3px", "0x"]) {
      expect(route(`#level=${value}`).levelIndex, value).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid level "${value}", starting the first level instead`,
      );
    }
  });

  it("refuses an exponent instead of landing on the first level by accident", () => {
    // The warning is what proves this is a refusal, not an accidental landing on level one.
    expect(route("#level=1e9").levelIndex).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid level "1e9", starting the first level instead`,
    );
  });
});

describe("resolveRoute with no level locking", () => {
  it("opens any level in range, whatever this browser has cleared", () => {
    for (const number of [1, 5, 18]) {
      const params = route(`#level=${String(number)}`);

      expect(params.levelIndex, String(number)).toBe(number - 1);
      expect(params.refusedKeys, String(number)).toEqual([]);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("still refuses a number that names no level", () => {
    const params = route("#level=99");

    expect(params.levelIndex).toBe(0);
    expect(params.refusedKeys).toEqual(["level"]);
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid level "99", starting the first level instead`,
    );
  });
});

describe("resolveRoute sandbox selection", () => {
  it("is off unless the url asks for it", () => {
    expect(route("").sandbox).toBeNull();
    expect(route("#level=4").sandbox).toBeNull();
  });

  it("ignores sandbox parameters while a numbered level is being played", () => {
    // Carried across by the level switcher's link rewrite, so the values stay inert here but
    // are still there if the player returns to the sandbox.
    const params = route("#level=4,floors=50,elevators=9,spawnrate=7");
    expect(params.sandbox).toBeNull();
    expect(params.levelIndex).toBe(3);
  });

  it("plays the sandbox for level=sandbox, in any casing", () => {
    for (const hash of ["#level=sandbox", "#level=Sandbox", "#level=SANDBOX"]) {
      expect(route(hash).sandbox, hash).not.toBeNull();
    }
  });

  it("does not complain that the sandbox is not a level number", () => {
    route("#level=sandbox");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("is not selected by something that merely looks like it", () => {
    expect(route("#level=sandboxes").sandbox).toBeNull();
    expect(route("#level=sandboxes").levelIndex).toBe(0);
  });

  it("starts a building known to be playable when no parameters are given", () => {
    // Mirrors level 4's shape, so a bare sandbox default is worth watching, not degenerate.
    expect(route("#level=sandbox").sandbox).toEqual({
      floorCount: 8,
      elevatorCount: 2,
      elevatorCapacities: [4],
      spawnRate: 0.6,
    });
  });

  it("reads every sandbox parameter", () => {
    expect(
      route("#level=sandbox,floors=20,elevators=3,capacities=6-9,spawnrate=1.5").sandbox,
    ).toEqual({
      floorCount: 20,
      elevatorCount: 3,
      elevatorCapacities: [6, 9],
      spawnRate: 1.5,
    });
  });

  it("keeps the rest of the url working alongside it", () => {
    const params = route("#level=sandbox,floors=12,timescale=8,fullscreen");
    expect(params.sandbox?.floorCount).toBe(12);
    expect(params.timeScale).toBe(8);
    expect(params.fullscreen).toBe(true);
  });
});

describe("resolveRoute sandbox validation", () => {
  /**
   * Resolves a sandbox hash, which always names a building.
   *
   * @param hash - The sandbox parameters, without `level=sandbox`.
   */
  function sandbox(hash: string): SandboxOptions {
    const params = route(`#level=${SANDBOX_LEVEL},${hash}`);
    if (params.sandbox === null) {
      throw new Error(`Expected ${hash} to resolve a sandbox`);
    }
    return params.sandbox;
  }

  it("falls back for a floor count that is not a whole number", () => {
    // Refused rather than rounded, so a typo like 8.5 doesn't silently start a different building.
    for (const value of ["abc", "", "NaN", "Infinity", "8.5", "8px"]) {
      expect(sandbox(`floors=${value}`).floorCount, value).toBe(8);
    }
    expect(console.warn).toHaveBeenCalled();
  });

  it("clamps a floor count the page cannot draw", () => {
    // A single floor makes spawnUserRandomly draw a destination floor that doesn't exist, so
    // nobody is ever delivered.
    expect(sandbox("floors=1").floorCount).toBe(2);
    expect(sandbox("floors=0").floorCount).toBe(2);
    expect(sandbox("floors=-20").floorCount).toBe(2);
    // 100000 floors means millions of DOM elements and a tab that never draws a frame.
    expect(sandbox("floors=100000").floorCount).toBe(60);
    expect(sandbox("floors=1e9").floorCount).toBe(60);
  });

  it("falls back for an elevator count that is not a whole number", () => {
    for (const value of ["abc", "", "NaN", "2.5"]) {
      expect(sandbox(`elevators=${value}`).elevatorCount, value).toBe(2);
    }
  });

  it("clamps an elevator count that would not fit in the building", () => {
    expect(sandbox("elevators=0").elevatorCount).toBe(1);
    expect(sandbox("elevators=-4").elevatorCount).toBe(1);
    // Twelve cars at the default capacity end at x=900 in a 938px building.
    expect(sandbox("elevators=13").elevatorCount).toBe(12);
    expect(sandbox("elevators=100000").elevatorCount).toBe(12);
  });

  it("keeps only the elevators that fit once the capacities widen them", () => {
    // A car is capacity * 10 px wide; clamping elevator count and capacities separately
    // could still overflow the building, drawing cars through the wall where .worldtrack
    // clips them — simulated and controllable, but invisible.
    expect(sandbox("elevators=12,capacities=30").elevatorCount).toBe(2);
    expect(sandbox("elevators=12,capacities=5").elevatorCount).toBe(10);
    // Mixed widths are measured car by car, not by the widest one.
    expect(sandbox("elevators=5,capacities=30-1").elevatorCount).toBe(4);
    expect(console.warn).toHaveBeenCalledWith(
      "Sandbox elevators 12 do not fit the building at these capacities, using 2 instead",
    );
  });

  it("leaves an elevator count alone when the cars do fit", () => {
    expect(sandbox("elevators=12").elevatorCount).toBe(12);
    expect(sandbox("elevators=2,capacities=30").elevatorCount).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reads one capacity or a whole cycle of them", () => {
    expect(sandbox("capacities=6").elevatorCapacities).toEqual([6]);
    expect(sandbox("elevators=3,capacities=6-9-2").elevatorCapacities).toEqual([6, 9, 2]);
    // Fewer capacities than cars is the cycling case the world supports, so it's left as
    // written.
    expect(sandbox("elevators=5,capacities=6-9").elevatorCapacities).toEqual([6, 9]);
  });

  it("rejects the whole capacity list when one entry is unreadable", () => {
    // Dropping just the bad entry would slide every capacity after it onto a different elevator.
    for (const value of ["abc", "", "6-abc", "6-", "-6", "6--9"]) {
      expect(sandbox(`capacities=${value}`).elevatorCapacities, value).toEqual([4]);
    }
  });

  it("clamps a capacity to a car that can exist and can be drawn", () => {
    // Zero is the value Elevator reads as "unset" and silently turns into 4.
    expect(sandbox("capacities=0-31").elevatorCapacities).toEqual([1, 30]);
  });

  it("keeps only as many capacities as there are elevators", () => {
    // The world reads capacities[i % capacities.length] per car, so entries past the last
    // car never get used — but the sandbox's own description would still print them.
    expect(sandbox("elevators=1,capacities=6-9").elevatorCapacities).toEqual([6]);
    expect(sandbox("elevators=3,capacities=6-9-2-7-8").elevatorCapacities).toEqual([6, 9, 2]);
    expect(console.warn).toHaveBeenCalledWith(
      "Sandbox capacities lists 2 cars for 1 elevator, keeping the first 1",
    );
  });

  it("stops parsing a capacity list long before it can slow the page down", () => {
    // Cut to the twelve-elevator ceiling before clamping, so a hash listing thousands of
    // cars costs thousands of Number calls, not thousands of console warnings.
    const long = `capacities=${Array.from({ length: 40 }, () => "99").join("-")}`;
    expect(sandbox(`elevators=12,${long}`).elevatorCapacities).toHaveLength(2);
    expect(vi.mocked(console.warn).mock.calls).toHaveLength(
      // One for the 40 entries, twelve for clamping each to 30, one for the ten cars that
      // don't fit, one for the capacities they took with them.
      1 + 12 + 1 + 1,
    );
  });

  it("falls back for a spawn rate that is not a number", () => {
    for (const value of ["abc", "", "NaN", "Infinity"]) {
      expect(sandbox(`spawnrate=${value}`).spawnRate, value).toBe(0.6);
    }
  });

  it("never lets the spawn rate freeze or empty the world", () => {
    // World.update loops `while (elapsedSinceSpawn > 1 / spawnRate)`, subtracting `1 /
    // spawnRate` each time: a negative rate turns that into an infinite loop that hangs the
    // tab, and zero divides to Infinity so nobody ever spawns.
    expect(sandbox("spawnrate=-1").spawnRate).toBe(0.01);
    expect(sandbox("spawnrate=0").spawnRate).toBe(0.01);
    expect(sandbox("spawnrate=100000").spawnRate).toBe(10);
  });

  it("accepts a fractional spawn rate, which is the interesting range", () => {
    expect(sandbox("spawnrate=0.25").spawnRate).toBe(0.25);
    expect(sandbox("spawnrate=1.9").spawnRate).toBe(1.9);
  });

  it("warns about everything it had to change", () => {
    sandbox("floors=100000,elevators=0,capacities=99,spawnrate=-1");
    expect(vi.mocked(console.warn).mock.calls.map(([message]) => String(message))).toEqual([
      "Sandbox floors 100000 is outside 2-60, using 60 instead",
      "Sandbox elevators 0 is outside 1-12, using 1 instead",
      "Sandbox capacity 99 is outside 1-30, using 30 instead",
      "Sandbox spawnrate -1 is outside 0.01-10, using 0.01 instead",
    ]);
  });

  it("survives a hash that is nothing but rubbish", () => {
    expect(sandbox("floors=<script>,elevators=%%%,capacities=!,spawnrate=,")).toEqual({
      floorCount: 8,
      elevatorCount: 2,
      elevatorCapacities: [4],
      spawnRate: 0.6,
    });
  });
});

describe("resolveRoute tutorial selection", () => {
  it("is off unless the url asks for it", () => {
    expect(route("").tutorialIndex).toBeNull();
    expect(route("#level=4").tutorialIndex).toBeNull();
    expect(route("#level=sandbox").tutorialIndex).toBeNull();
  });

  it("opens the level its address names, zero-based", () => {
    // Spelled out rather than generated from the table: these are the exact addresses
    // shared in links, and a link already out there has to keep working.
    for (let number = 1; number <= 8; number += 1) {
      const hash = `#level=tutorial-${String(number)}`;
      expect(route(hash).tutorialIndex, hash).toBe(number - 1);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reaches every level in the table by the id it carries", () => {
    // A level renamed or moved takes its address with it, instead of handing somebody's
    // bookmark to a different level.
    tutorialLevels.forEach((level, index) => {
      expect(route(`#level=${level.id}`).tutorialIndex, level.id).toBe(index);
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("spells every level id the way it recognizes one", () => {
    // The prefix is what tells a mistyped address from a level number; a level renamed out
    // of this shape wouldn't be oddly named, it would be unreachable.
    for (const level of tutorialLevels) {
      expect(level.id.startsWith(TUTORIAL_LEVEL_PREFIX), level.id).toBe(true);
    }
  });

  it("reads a level address however it is capitalized", () => {
    // Case-folded where it's read, as `sandbox` is, not normalized up front.
    expect(route("#level=TUTORIAL-3").tutorialIndex).toBe(2);
    expect(route("#LEVEL=Tutorial-3").tutorialIndex).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not complain that a level address is not a level number", () => {
    // resolveLevelIndex would read `tutorial-3` as NaN and say so, which is
    // noise about a number the player never wrote.
    const params = route("#level=tutorial-3");
    expect(params.refusedKeys).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("never resolves a level and a sandbox at once", () => {
    // One key names one of four things; nothing spells two at once.
    const level = route("#level=tutorial-3");
    expect(level.tutorialIndex).toBe(2);
    expect(level.sandbox).toBeNull();
    expect(level.chapter2Index).toBeNull();
    const sandbox = route("#level=sandbox");
    expect(sandbox.sandbox).not.toBeNull();
    expect(sandbox.tutorialIndex).toBeNull();
    expect(sandbox.chapter2Index).toBeNull();
  });

  it("ignores sandbox parameters while a level is being played", () => {
    // Carried across by the navigation row, inert here, and still there if the player goes
    // back to the sandbox, exactly as on a numbered level.
    const params = route("#level=tutorial-3,floors=50,elevators=9");
    expect(params.tutorialIndex).toBe(2);
    expect(params.sandbox).toBeNull();
    expect(params.refusedKeys).toEqual([]);
  });

  it("is not selected by something that merely looks like it", () => {
    // The prefix is exact, as `sandboxes` is not the sandbox: a value that isn't a level
    // address is a level number, and is refused as one.
    for (const value of ["tutorial", "tutorials-1", "atutorial-1"]) {
      const params = route(`#level=${value}`);
      expect(params.tutorialIndex, value).toBeNull();
      expect(params.levelIndex, value).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid level "${value}", starting the first level instead`,
      );
    }
  });
});

describe("resolveRoute tutorial validation", () => {
  it("lands a wrong level address on the first level, not on the first level", () => {
    // The player asked for the track, so the closest thing to what they asked for is where
    // the track starts. Landing on level 1 would answer a question about the track with a level.
    for (const value of [
      "tutorial-0",
      "tutorial-9",
      "tutorial-abc",
      "tutorial-",
      "tutorial-1.5",
      "tutorial--1",
      "tutorial- 1",
      "tutorial-<script>",
    ]) {
      const params = route(`#level=${value}`);
      expect(params.tutorialIndex, value).toBe(0);
      expect(params.refusedKeys, value).toEqual(["level"]);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid tutorial level "${value}", starting the first one instead`,
      );
    }
  });

  it("refuses the numbers Number() would have read for a name", () => {
    // `tutorial-01`, `tutorial-1e0` and `tutorial-1.0` are numeric spellings of one, not of
    // the name `tutorial-1` — ids are matched as strings, not parsed as numbers, so none of
    // these resolve to level one by accident.
    for (const value of ["tutorial-01", "tutorial-1e0", "tutorial-1.0", "tutorial-0x1"]) {
      const params = route(`#level=${value}`);
      expect(params.tutorialIndex, value).toBe(0);
      expect(params.refusedKeys, value).toEqual(["level"]);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid tutorial level "${value}", starting the first one instead`,
      );
    }
  });

  it("keeps the rest of the url working on the track", () => {
    // Every parameter but `seed` behaves on a level address exactly as it does on a
    // numbered level.
    expect(route("#level=tutorial-3,seed=issue-61,timescale=8,fullscreen=true")).toEqual({
      levelIndex: 0,
      sandbox: null,
      tutorialIndex: 2,
      chapter2Index: null,
      timeScale: 8,
      fullscreen: true,
      seed: null,
      refusedKeys: ["seed"],
    });
  });

  it("refuses an unusable value on the track exactly as anywhere else", () => {
    // Two different reasons to refuse a key — an unusable value and the track's own seed
    // policy — arrive in one list, in the order the URL wrote them.
    const params = route("#level=tutorial-3,timescale=fast,seed=rush hour");
    expect(params.tutorialIndex).toBe(2);
    expect(params.timeScale).toBe(DEFAULT_TIME_SCALE);
    expect(params.seed).toBeNull();
    expect(params.refusedKeys).toEqual(["timescale", "seed"]);
  });
});

describe("resolveRoute chapter two selection", () => {
  it("is off unless the url asks for it", () => {
    expect(route("").chapter2Index).toBeNull();
    expect(route("#level=4").chapter2Index).toBeNull();
    expect(route("#level=sandbox").chapter2Index).toBeNull();
    expect(route("#level=tutorial-3").chapter2Index).toBeNull();
  });

  it("opens the level its address names, zero-based", () => {
    expect(route("#level=chapter2-1").chapter2Index).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reaches every level in the table by the id it carries", () => {
    // Iterated from the table rather than a fixed count, since the block's entries are
    // still being added.
    chapter2Levels.forEach((level, index) => {
      expect(route(`#level=${level.id}`).chapter2Index, level.id).toBe(index);
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("spells every level id the way it recognizes one", () => {
    // As with the track's addresses, a level renamed out of this prefix would be
    // unreachable rather than oddly named.
    for (const level of chapter2Levels) {
      expect(level.id.startsWith(CHAPTER2_LEVEL_PREFIX), level.id).toBe(true);
    }
  });

  it("reads a chapter two address however it is capitalized", () => {
    expect(route("#level=CHAPTER2-1").chapter2Index).toBe(0);
    expect(route("#LEVEL=Chapter2-1").chapter2Index).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not complain that a chapter two address is not a level number", () => {
    // resolveLevelIndex would read `chapter2-1` as NaN and say so, which is noise
    // about a number the player never wrote.
    const params = route("#level=chapter2-1");
    expect(params.refusedKeys).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("never resolves a chapter two level beside another thing the key can name", () => {
    // No value spells two of the four things this key can name.
    const params = route("#level=chapter2-1,floors=50,elevators=9");
    expect(params.chapter2Index).toBe(0);
    expect(params.tutorialIndex).toBeNull();
    expect(params.sandbox).toBeNull();
    // Carried across by the switcher's links, inert here, exactly as on a level of the track.
    expect(params.refusedKeys).toEqual([]);
  });

  it("is not selected by something that merely looks like it", () => {
    // The prefix has to start the value and end in its hyphen: a bare `chapter2`, a
    // longer word around it and a value merely containing it are level numbers here,
    // and are refused as ones.
    for (const value of ["chapter2", "chapter2x-1", "achapter2-1"]) {
      const params = route(`#level=${value}`);
      expect(params.chapter2Index, value).toBeNull();
      expect(params.levelIndex, value).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid level "${value}", starting the first level instead`,
      );
    }
  });
});

describe("resolveRoute chapter two validation", () => {
  it("lands a wrong chapter two address on the block's first level", () => {
    // `chapter2-01`, `chapter2-1e0` and `chapter2- 1` are ways of writing the number one, not the name
    // `chapter2-1` — each lands where `chapter2-1` lands, so only the warning and the refusal tell a
    // wrong address from a right one.
    for (const value of [
      "chapter2-0",
      "chapter2-99",
      "chapter2-abc",
      "chapter2-",
      "chapter2-1.5",
      "chapter2--1",
      "chapter2- 1",
      "chapter2-<script>",
      "chapter2-01",
      "chapter2-1e0",
    ]) {
      const params = route(`#level=${value}`);
      expect(params.chapter2Index, value).toBe(0);
      expect(params.refusedKeys, value).toEqual(["level"]);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid chapter two level "${value}", starting the first one instead`,
      );
    }
  });

  it("keeps the rest of the url working in the block", () => {
    // Every parameter but `seed` behaves on a chapter two address exactly as it does on a
    // numbered level.
    expect(route("#level=chapter2-1,timescale=8,fullscreen=true")).toEqual({
      levelIndex: 0,
      sandbox: null,
      tutorialIndex: null,
      chapter2Index: 0,
      timeScale: 8,
      fullscreen: true,
      seed: null,
      refusedKeys: [],
    });
  });
});

describe("resolveRoute refusals", () => {
  it("names nothing when the url asks for nothing", () => {
    expect(route("").refusedKeys).toEqual([]);
  });

  it("names nothing when every value is usable", () => {
    expect(route("#level=3,timescale=4,seed=issue-61").refusedKeys).toEqual([]);
  });

  it("names each key whose value it would not use", () => {
    expect(route("#level=abc,timescale=fast,seed=rush hour").refusedKeys).toEqual([
      "level",
      "timescale",
      "seed",
    ]);
  });

  it("names the sandbox parameters it refused, and not the ones it clamped", () => {
    // The distinction the whole list rests on: `floors=100000` still describes the building
    // on screen (it always reads as sixty), but `elevators=many` describes nothing.
    expect(route("#level=sandbox,floors=100000,elevators=many").refusedKeys).toEqual(["elevators"]);
  });

  it("does not name a key that was simply absent", () => {
    // A refusal and an absence resolve to the same value, so the resolvers record refusals
    // themselves rather than a later pass working it out.
    expect(route("#level=abc").levelIndex).toBe(route("").levelIndex);
    expect(route("").refusedKeys).toEqual([]);
  });

  it("refuses a key to exactly the value its absence would have given", () => {
    // The invariant behind the whole refusedKeys list: dropping a refused key must resolve
    // to the same route, or correcting the address bar would change the run the player is
    // watching.
    const refused = route("#level=abc,timescale=fast,seed=rush hour,floors=none");
    const absent = route("");
    expect(refused.refusedKeys.length).toBeGreaterThan(0);
    expect({ ...refused, refusedKeys: [] }).toEqual(absent);
  });
});

describe("resolveRoute seed validation", () => {
  it("pins nothing unless the url asks for it", () => {
    expect(route("").seed).toBeNull();
    expect(route("#level=4").seed).toBeNull();
  });

  it("keeps a numeric seed as the string the url spells it with", () => {
    // Kept as a string, not converted to a Number: Number would read `0123` as 123 and
    // `1e3` as 1000, collapsing distinct URLs onto the same run.
    expect(route("#seed=1234567890").seed).toBe("1234567890");
    expect(route("#seed=0123").seed).toBe("0123");
    expect(route("#seed=1e3").seed).toBe("1e3");
  });

  it("accepts a label somebody can read out", () => {
    expect(route("#seed=issue-61").seed).toBe("issue-61");
    expect(route("#seed=rush_hour.2").seed).toBe("rush_hour.2");
  });

  it("reads a seed the same whichever side the space is on", () => {
    // parseQuery trims whitespace around every value, so these look alike but neither is
    // reachable from a browser: a real space becomes %20, which is refused instead.
    expect(route("#seed= 5").seed).toBe("5");
    expect(route("#seed=5 ").seed).toBe("5");
    expect(route("#seed=%205").seed).toBeNull();
  });

  it("refuses a seed that could not survive the address bar", () => {
    // A browser percent-encodes anything outside the ASCII token set on its way into
    // location.hash, so "rush hour" becomes "rush%20hour" and hashes to a different stream
    // than the one a shared link was meant to replay.
    for (const hash of ["#seed=rush hour", "#seed=привет", "#seed=a/b", "#seed=100%"]) {
      expect(route(hash).seed, hash).toBeNull();
    }
  });

  it("refuses an empty seed and a seed too long to carry", () => {
    // The seed is written into every tile of the level switcher, so a long one bloats the
    // page many times over.
    expect(route("#seed").seed).toBeNull();
    expect(route("#seed=").seed).toBeNull();
    expect(route(`#seed=${"9".repeat(64)}`).seed).toBe("9".repeat(64));
    expect(route(`#seed=${"9".repeat(65)}`).seed).toBeNull();
  });

  it("says what it refused and what it did instead", () => {
    route("#seed=rush hour");
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid seed "rush hour", using a fresh one instead`,
    );
  });

  it("does not complain about a seed it accepted", () => {
    route("#seed=issue-61");
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("resolveRoute seed on the learning track", () => {
  it("refuses a seed on every level address, however good the seed is", () => {
    // Not a validation failure — `issue-61` is accepted everywhere else. On the track the
    // seed isn't the player's to choose, since which program fails depends on the passenger
    // stream and each level is built on a specific program failing.
    for (const level of tutorialLevels) {
      const hash = `#level=${level.id},seed=issue-61`;
      expect(route(hash).seed, hash).toBeNull();
      expect(route(hash).refusedKeys, hash).toContain("seed");
    }
  });

  it("refuses the seed measured to make level 5's starting program win", () => {
    // The concrete failure this exists to stop: seed 42a lets level 5's starting program win
    // outright, on a level built to require an actual fix.
    const params = route("#level=tutorial-5,seed=42a");
    expect(params.seed).toBeNull();
    expect(params.tutorialIndex).toBe(4);
  });

  it("says where the seed went rather than that it was wrong", () => {
    // Says "this level", not "a tutorial level": the message is shared with the chapter2
    // block, so naming one of them here would be one more thing to keep in sync.
    route("#level=tutorial-5,seed=42a");
    expect(console.warn).toHaveBeenCalledWith(
      `Ignoring seed "42a": this level plays its own pinned seed`,
    );
  });

  it("refuses an empty seed on the track, which is written but says nothing", () => {
    // The guard is `!== undefined`, not a truthiness check: truthiness would let `seed=`
    // (empty but defined) through unrefused, leaving a key in the bar that the run isn't using.
    const params = route("#level=tutorial-3,seed=");
    expect(params.seed).toBeNull();
    expect(params.refusedKeys).toEqual(["seed"]);
    expect(console.warn).toHaveBeenCalledWith(
      `Ignoring seed "": this level plays its own pinned seed`,
    );
  });

  it("keeps quiet on a level address that names no seed", () => {
    route("#level=tutorial-5");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("leaves the seed alone on the routes it is the player's to choose", () => {
    // Scoped to the two blocks that pin a seed and nothing else: a misspelled level address
    // is still the track, but a level and the sandbox are not.
    expect(route("#level=4,seed=42a").seed).toBe("42a");
    expect(route("#level=sandbox,seed=42a").seed).toBe("42a");
    expect(route("#level=tutorial-9,seed=42a").seed).toBeNull();
  });

  it("refuses the seed to what its absence gives, so the url can drop it", () => {
    // The refusedKeys invariant, checked here because this refusal doesn't come from an
    // unusable value.
    const refused = route("#level=tutorial-5,seed=42a");
    const absent = route("#level=tutorial-5");
    expect({ ...refused, refusedKeys: [] }).toEqual(absent);
  });
});

describe("resolveRoute seed in chapter two", () => {
  it("refuses a seed on every level of the block, however good the seed is", () => {
    // Not a validation failure, and not the track's reason either: here the stake is the
    // medal. Thresholds are measured against one pinned crowd, so a silver earned on an
    // unmeasured stream wouldn't be the same silver.
    for (const level of chapter2Levels) {
      const hash = `#level=${level.id},seed=42`;
      expect(route(hash).seed, hash).toBeNull();
      expect(route(hash).refusedKeys, hash).toContain("seed");
    }
  });

  it("says where the seed went in the one sentence both pinned blocks share", () => {
    route("#level=chapter2-1,seed=42");
    expect(console.warn).toHaveBeenCalledWith(
      `Ignoring seed "42": this level plays its own pinned seed`,
    );
  });

  it("refuses the seed on an address the block could not read either", () => {
    // Both refusals at once, in the order the url wrote them: `chapter2-99` is still the block, so
    // the seed is still not the player's to choose there.
    const params = route("#level=chapter2-99,seed=42");
    expect(params.chapter2Index).toBe(0);
    expect(params.seed).toBeNull();
    expect(params.refusedKeys).toEqual([LEVEL_KEY, "seed"]);
  });

  it("keeps quiet on a chapter two address that names no seed", () => {
    route("#level=chapter2-1");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("refuses the seed to what its absence gives, so the url can drop it", () => {
    const refused = route("#level=chapter2-1,seed=42");
    const absent = route("#level=chapter2-1");
    expect({ ...refused, refusedKeys: [] }).toEqual(absent);
  });
});

describe("resolveRoute timescale validation", () => {
  it("accepts a speed the world can run at, including fractions", () => {
    expect(route("#timescale=8").timeScale).toBe(8);
    expect(route("#timescale=0.5").timeScale).toBe(0.5);
  });

  it("falls back to the default for a speed that is not a number", () => {
    // A NaN time scale would turn every simulated dt into NaN, freezing the world with no
    // way back short of editing the URL.
    for (const hash of ["#timescale=abc", "#timescale=", "#timescale=NaN"]) {
      expect(route(hash).timeScale, hash).toBe(DEFAULT_TIME_SCALE);
    }
  });

  it("clamps a speed outside the runnable range", () => {
    expect(route("#timescale=0").timeScale).toBe(TIME_SCALE_MIN);
    expect(route("#timescale=-4").timeScale).toBe(TIME_SCALE_MIN);
    expect(route("#timescale=100000").timeScale).toBe(TIME_SCALE_MAX);
  });

  it("uses the remembered speed when the url does not ask for one", () => {
    expect(resolveRoute(parseQuery(""), { ...CONTEXT, defaultTimeScale: 8 }).timeScale).toBe(8);
  });
});

describe("startRouter", () => {
  it("routes the initial url, before any navigation happens", () => {
    const target = new FakeTarget();
    target.location = { hash: "#level=3" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(onRoute.mock.calls[0]?.[0]).toMatchObject({ levelIndex: 2 });
  });

  it("routes on hashchange and on popstate", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#level=2");
    target.navigate("#level=5", "popstate");

    expect(onRoute).toHaveBeenCalledTimes(3);
    expect(onRoute.mock.calls[2]?.[0]).toMatchObject({ levelIndex: 4 });
  });

  it("ignores an event that did not change the url", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#level=2");
    target.navigate("#level=2", "popstate");

    expect(onRoute).toHaveBeenCalledTimes(2);
  });

  it("re-reads the default time scale on every navigation", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    let defaultTimeScale = 2;
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => defaultTimeScale,
      target,
    });

    defaultTimeScale = 16;
    target.navigate("#level=2");

    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ timeScale: 16 });
  });

  it("hands the raw parameters over as well", () => {
    const target = new FakeTarget();
    target.location = { hash: "#level=2,mystery=x" };
    const onRoute = vi.fn();
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(query?.get("mystery")).toBe("x");
  });

  it("takes a refused parameter out of the address bar", () => {
    // Otherwise the URL would keep saying `level=abc` while level one plays — exactly the
    // state a player bookmarks and reports as a bug.
    const target = new FakeTarget();
    target.location = { hash: "#level=abc,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#timescale=8"]);
    expect(target.location.hash).toBe("#timescale=8");
    // Rewritten via replaceState, not navigated to, so the correction doesn't route a
    // second time.
    expect(onRoute).toHaveBeenCalledTimes(1);
  });

  it("hands the handler what the address bar says now", () => {
    // Not what it said: the level switcher builds a link per tile out of this query, so a
    // refused key left in it would be written into every one of them.
    const target = new FakeTarget();
    target.location = { hash: "#level=2,seed=rush%20hour,mystery=x" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(query?.has("seed")).toBe(false);
    expect([...(query ?? [])]).toEqual([
      ["level", "2"],
      ["mystery", "x"],
    ]);
    // The corrected URL resolves to the route that was played.
    expect(onRoute.mock.calls[0]?.[0]).toMatchObject({ levelIndex: 1, seed: null });
  });

  it("corrects a wrong level address to the first level instead of dropping it", () => {
    // Deleting the key would leave `#`, the first numbered level, so the bar would describe
    // a run nobody is watching and a reload would land on it. The track's first level has no
    // spelling but its own id, and the player did choose the track.
    const target = new FakeTarget();
    target.location = { hash: "#level=tutorial-9,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    // Rewritten where it stood, so the corrected url still reads in the order it was written.
    expect(target.replaced).toEqual(["#level=tutorial-1,timescale=8"]);
    expect(onRoute).toHaveBeenCalledTimes(1);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(params).toMatchObject({ tutorialIndex: 0, refusedKeys: ["level"] });
    expect(query?.get("level")).toBe("tutorial-1");
    // The whole point of correcting: the address bar now resolves to the run on screen.
    expect(route(target.location.hash)).toEqual({ ...params, refusedKeys: [] });
  });

  it("corrects a wrong chapter two address to the block's first level", () => {
    // The same rewrite as the track's: deleting the key would leave `#`, the first numbered
    // level, and the player chose the block rather than that.
    const target = new FakeTarget();
    target.location = { hash: "#level=chapter2-99,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#level=chapter2-1,timescale=8"]);
    expect(onRoute).toHaveBeenCalledTimes(1);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(params).toMatchObject({ chapter2Index: 0, refusedKeys: [LEVEL_KEY] });
    expect(query?.get(LEVEL_KEY)).toBe("chapter2-1");
    // The address bar now resolves to the run that is on screen.
    expect(route(target.location.hash)).toEqual({ ...params, refusedKeys: [] });
  });

  it("opens a level named in a hash it navigates to, without correcting it", () => {
    // A second navigation resolves exactly as the first: nothing about a level address
    // depends on state carried between routes.
    const target = new FakeTarget();
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#level=2");

    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ levelIndex: 1, refusedKeys: [] });
    expect(target.replaced).toEqual([]);
  });

  it("still deletes the other refusals it finds on the track", () => {
    const target = new FakeTarget();
    target.location = { hash: "#level=tutorial-9,seed=rush%20hour" };

    startRouter(vi.fn(), {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#level=tutorial-1"]);
  });

  it("empties the hash when nothing in it survived", () => {
    const target = new FakeTarget();
    target.location = { hash: "#level=abc" };

    startRouter(vi.fn(), {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    // A browser resolves "#" to an empty fragment, so a later event compares against "" —
    // the router has to have recorded that too, or a real navigation back here looks like a
    // repeat.
    expect(target.replaced).toEqual(["#"]);
    expect(target.location.hash).toBe("");
  });

  it("leaves the state on the entry it rewrites", () => {
    const target = new FakeTarget();
    target.location = { hash: "#level=abc" };
    target.history.state = { scroll: 12 };

    startRouter(vi.fn(), {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.history.state).toEqual({ scroll: 12 });
  });

  it.each([
    "#level=3,timescale=8,seed=issue-61",
    // An unknown key is kept on purpose: a later version's parameter, or the player's own.
    "#level=3,mystery=x",
    // A clamped value still names the run on screen — floors=100000 always resolves to
    // sixty — so there is nothing to correct.
    "#level=sandbox,floors=100000",
    "#level=tutorial-3,timescale=8",
    "#level=chapter2-1,timescale=8",
  ])("leaves %s alone", (hash) => {
    const target = new FakeTarget();
    target.location = { hash };

    startRouter(vi.fn(), {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual([]);
    expect(target.location.hash).toBe(hash);
  });

  it("rewrites a legacy hash to the new key, though it refused nothing", () => {
    // The run is played exactly as the old link asked; what changes is what the player
    // copies out of the bar next.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=3,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#level=3,timescale=8"]);
    // Rewritten, not navigated to: one route for one arrival, whichever spelling it arrived under.
    expect(onRoute).toHaveBeenCalledTimes(1);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(params).toMatchObject({ levelIndex: 2, timeScale: 8, refusedKeys: [] });
    // The handler is handed the corrected query, so links the switcher builds from it use
    // the modern spelling.
    expect(query?.get(LEVEL_KEY)).toBe("3");
    expect(query?.has(LEGACY_LEVEL_KEY)).toBe(false);
  });

  it("corrects a legacy key and the refusals beside it in one rewrite", () => {
    // Both corrections meet on the same key: the spelling is retired *and* the level it
    // names does not exist. One `replaceState` covers both.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=tutorial-9,seed=rush%20hour" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#level=tutorial-1"]);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    expect(params).toMatchObject({ tutorialIndex: 0, refusedKeys: [LEVEL_KEY, "seed"] });
    expect(route(target.location.hash)).toEqual({ ...params, refusedKeys: [] });
  });

  it("drops the legacy key from a hash that names both", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=5,level=9,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#level=9,timescale=8"]);
    expect(onRoute.mock.calls[0]?.[0]).toMatchObject({ levelIndex: 8 });
  });

  it("corrects every navigation, not just the first", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#level=4,timescale=fast");

    expect(target.replaced).toEqual(["#level=4"]);
    expect(onRoute).toHaveBeenCalledTimes(2);
    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ levelIndex: 3 });
  });

  it("routes again when the player comes back to a url it once corrected", () => {
    // The correction moves the location without raising an event, so the hash the router
    // remembers has to be the corrected one, or a real navigation back here looks like a repeat.
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#level=abc");
    expect(target.location.hash).toBe("");

    target.navigate("#level=abc");

    expect(onRoute).toHaveBeenCalledTimes(3);
    expect(target.replaced).toEqual(["#", "#"]);
  });

  it("unsubscribes everything when stopped", () => {
    const target = new FakeTarget();
    const stop = startRouter(vi.fn(), {
      levelCount: 18,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.listenerCount).toBe(2);
    stop();
    expect(target.listenerCount).toBe(0);
  });
});
