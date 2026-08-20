import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SandboxOptions } from "#game/challenges.ts";
import { tutorialTasks } from "#game/tutorial.ts";
import { createParamsUrl, parseQuery, type RouteQuery } from "#shared/lib/route-query.ts";
import {
  DEFAULT_TIME_SCALE,
  TIME_SCALE_MAX,
  TIME_SCALE_MIN,
} from "#features/adjust-speed/model/time-scale.ts";
import {
  resolveRoute,
  SANDBOX_CHALLENGE,
  startRouter,
  TUTORIAL_CHALLENGE_PREFIX,
  type RouteParams,
  type RouterTarget,
} from "./route.ts";

/**
 * A browser that has cleared every challenge there is.
 *
 * The default everywhere below, so that the specs about *reading* a URL are
 * about reading it and nothing else. What happens to an address for a
 * challenge that is still shut has a context of its own, in "resolveRoute
 * challenge locking".
 *
 * @returns Always `false`: nothing is locked.
 */
const EVERY_CHALLENGE_OPEN = (): boolean => false;

/** The context a route is resolved against in these tests. */
const CONTEXT = {
  challengeCount: 18,
  defaultTimeScale: DEFAULT_TIME_SCALE,
  isChallengeLocked: EVERY_CHALLENGE_OPEN,
};

/**
 * Resolves a location hash the way the running game does.
 *
 * @param hash - The location hash.
 * @returns The validated route parameters.
 */
function route(hash: string): ReturnType<typeof resolveRoute> {
  return resolveRoute(parseQuery(hash), CONTEXT);
}

/**
 * Resolves a hash for a browser that has cleared `count` challenges, from the
 * first.
 *
 * The record itself is not built here — the rule that reads it belongs to
 * `#features/switch-level`, and this file is about what the router does with
 * its answer — so the predicate is written out directly: challenges up to and
 * including the `count`th are open, everything past them is shut.
 *
 * @param hash - The location hash.
 * @param count - How many challenges this browser has finished.
 * @returns The validated route parameters.
 */
function routeAfterClearing(hash: string, count: number): ReturnType<typeof resolveRoute> {
  return resolveRoute(parseQuery(hash), {
    ...CONTEXT,
    isChallengeLocked: (index) => index > count,
  });
}

/** A window stand-in whose hash and events the test drives. */
class FakeTarget implements RouterTarget {
  location = { hash: "" };
  /** Every url the router has rewritten the address bar to, in order. */
  readonly replaced: string[] = [];
  /**
   * The two things the router uses a real `History` for.
   *
   * `replaceState` moves the location as a browser's does, because that is the
   * half the router reads back: it takes the hash it compares later from
   * `location`, not from the url it just wrote, and a browser and this stand-in
   * disagree about `"#"` — which resolves to a URL whose fragment is empty, so
   * `location.hash` afterwards is `""`.
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

  /**
   * Navigates, then raises the event a browser would raise.
   *
   * @param hash - The new location hash.
   * @param type - The event to raise.
   */
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
  // Cleared as well as silenced: the spy outlives the spec that installed it,
  // so the ones that assert on what was warned would otherwise see the whole
  // file's warnings.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
});

describe("createParamsUrl composed with resolveRoute", () => {
  it("keeps a round-tripped task address opening the same task", () => {
    // route-query.test.ts checks that createParamsUrl(parseQuery(hash)) is the
    // hash unchanged; this checks that the address which survives the round
    // trip still resolves to the same task, and not just the same string.
    const hash = "#challenge=tutorial-3,timescale=8,fullscreen=true";
    expect(route(createParamsUrl(parseQuery(hash))).tutorialIndex).toBe(2);
  });

  it("takes a player on a task off the track when the navigation row rewrites the key", () => {
    // Every entry of the row is `createParamsUrl(query, { challenge: index + 1,
    // seed: null })` (src/pages/game/index.ts), and `challenge` is the key a task
    // address is written into -- so clicking challenge 5 from task 3 replaces
    // the track rather than joining it. The row is the way out, and no separate
    // "leave the track" link is needed to build one.
    const query = parseQuery("#challenge=tutorial-3,timescale=8");
    const url = createParamsUrl(query, { challenge: 5, seed: null });
    expect(url).toBe("#challenge=5,timescale=8");
    expect(route(url).tutorialIndex).toBeNull();
    expect(route(url).challengeIndex).toBe(4);
  });
});

describe("resolveRoute defaults", () => {
  it("starts the first challenge, paused, at the default speed", () => {
    expect(route("")).toEqual({
      challengeIndex: 0,
      sandbox: null,
      tutorialIndex: null,
      timeScale: DEFAULT_TIME_SCALE,
      fullscreen: false,
      seed: null,
      refusedKeys: [],
    });
  });

  it("reads every parameter the game supports", () => {
    expect(route("#challenge=4,timescale=8,fullscreen=true,seed=abc")).toEqual({
      challengeIndex: 3,
      sandbox: null,
      tutorialIndex: null,
      timeScale: 8,
      fullscreen: true,
      seed: "abc",
      refusedKeys: [],
    });
  });

  it("reads a route written in capitals", () => {
    const params = route("#CHALLENGE=4,SEED=issue-61,TIMESCALE=8,FULLSCREEN");
    expect(params).toMatchObject({
      challengeIndex: 3,
      seed: "issue-61",
      timeScale: 8,
      fullscreen: true,
    });
    expect(route("#CHALLENGE=SANDBOX").sandbox).not.toBeNull();
  });

  it("treats a flag as off only when it says false", () => {
    expect(route("#fullscreen=false").fullscreen).toBe(false);
    expect(route("#fullscreen=whatever").fullscreen).toBe(true);
    expect(route("#fullscreen").fullscreen).toBe(true);
  });
});

describe("resolveRoute challenge validation", () => {
  it("accepts an in-range challenge number and makes it zero-based", () => {
    expect(route("#challenge=1").challengeIndex).toBe(0);
    expect(route("#challenge=18").challengeIndex).toBe(17);
  });

  it("falls back to the first challenge for a number that is not one", () => {
    // The legacy code computed _.parseInt("abc") - 1 === NaN, and both NaN < 0
    // and NaN >= challenges.length are false, so NaN reached
    // challenges[NaN].options and the page died before drawing anything.
    for (const hash of ["#challenge=abc", "#challenge=", "#challenge=NaN"]) {
      expect(route(hash).challengeIndex, hash).toBe(0);
    }
  });

  it("falls back to the first challenge for a number out of range", () => {
    for (const hash of ["#challenge=0", "#challenge=-3", "#challenge=19", "#challenge=1e9"]) {
      expect(route(hash).challengeIndex, hash).toBe(0);
    }
  });

  it("refuses a challenge number with anything else attached to it", () => {
    // Number.parseInt reads as far as it understands and stops: "3abc" was
    // challenge 3 and "3.5" was challenge 3, with nothing said about the rest of
    // what the player had written. Number reads the whole string or nothing.
    for (const value of ["3abc", "3.5", "3px", "0x"]) {
      expect(route(`#challenge=${value}`).challengeIndex, value).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid challenge "${value}", starting the first challenge instead`,
      );
    }
  });

  it("refuses an exponent instead of landing on the first challenge by accident", () => {
    // #challenge=1e9 reached challenge 1 before this, and looked like a refusal
    // because the first challenge is where a refusal lands too -- but parseInt
    // had read "1" and stopped at the "e", so nothing was refused and nothing
    // was said. What makes it a refusal is the warning.
    expect(route("#challenge=1e9").challengeIndex).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid challenge "1e9", starting the first challenge instead`,
    );
  });
});

describe("resolveRoute challenge locking", () => {
  it("opens a challenge this browser has earned", () => {
    // Cleared four, so the fifth is the one the switcher offers next and the
    // furthest a URL may reach.
    expect(routeAfterClearing("#challenge=5", 4).challengeIndex).toBe(4);
    expect(routeAfterClearing("#challenge=5", 4).refusedKeys).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("refuses a challenge the player has not unlocked", () => {
    // The hole this closes. The switcher draws challenge 18 as a disabled
    // button until the seventeen before it are done, and `#challenge=18` used
    // to open it regardless -- so the progression was something the interface
    // believed rather than something the game enforced.
    const params = routeAfterClearing("#challenge=18", 7);

    expect(params.challengeIndex).toBe(7);
    expect(params.refusedKeys).toEqual(["challenge"]);
    expect(console.warn).toHaveBeenCalledWith(
      `Challenge "18" has not been unlocked yet, starting challenge 8 instead`,
    );
  });

  it("lands on the furthest challenge the player has reached, not on the first", () => {
    // A refusal that dropped them back to challenge 1 would be its own kind of
    // wrong: they asked to go on, and this is as far on as they have earned.
    for (const cleared of [0, 1, 9, 16]) {
      expect(routeAfterClearing("#challenge=18", cleared).challengeIndex, String(cleared)).toBe(
        cleared,
      );
    }
  });

  it("never walks forward to a challenge further on than the one refused", () => {
    // A browser whose record is not a run from the first -- cleared challenge 6
    // alone, back when every challenge was reachable from the row -- has
    // challenge 7 open with 2 through 6 shut. Walking to the nearest open
    // challenge in *either* direction would answer an address for 5 with 7,
    // which is the same hole with a step in it.
    const params = resolveRoute(parseQuery("#challenge=5"), {
      ...CONTEXT,
      isChallengeLocked: (index) => index !== 0 && index !== 6,
    });

    expect(params.challengeIndex).toBe(0);
  });

  it("says nothing about a locked challenge on an address that names none", () => {
    // The sandbox and the learning track are not on the ladder, and the first
    // challenge is open to everybody, so none of the three can be refused for
    // being shut.
    expect(routeAfterClearing("", 0).challengeIndex).toBe(0);
    expect(routeAfterClearing("#challenge=1", 0).challengeIndex).toBe(0);
    expect(routeAfterClearing("#challenge=sandbox", 0).sandbox).not.toBeNull();
    expect(routeAfterClearing("#challenge=tutorial-8", 0).tutorialIndex).toBe(7);
    expect(routeAfterClearing("#challenge=tutorial-8", 0).refusedKeys).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("refuses a number that does not exist before asking whether it is open", () => {
    // Order, and the reason `isChallengeLocked` is documented as taking an
    // index that exists: `#challenge=99` is not a locked challenge, it is not a
    // challenge, and the locking rule has no opinion to offer about one.
    const params = routeAfterClearing("#challenge=99", 7);

    expect(params.challengeIndex).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid challenge "99", starting the first challenge instead`,
    );
  });

  it("keeps the rest of the url while it refuses the challenge", () => {
    // A speed and a seed are choices about how to play, not about which level
    // -- and the level that opens is one the player is allowed to be on, so
    // there is nothing about those that has to be dropped with it.
    const params = routeAfterClearing("#challenge=18,timescale=8,seed=issue-61,fullscreen", 7);

    expect(params).toMatchObject({
      challengeIndex: 7,
      timeScale: 8,
      seed: "issue-61",
      fullscreen: true,
      refusedKeys: ["challenge"],
    });
  });
});

describe("resolveRoute sandbox selection", () => {
  it("is off unless the url asks for it", () => {
    expect(route("").sandbox).toBeNull();
    expect(route("#challenge=4").sandbox).toBeNull();
  });

  it("ignores sandbox parameters while a numbered challenge is being played", () => {
    // They are carried across a jump by the challenge bar's navigation row,
    // which rewrites `challenge` and keeps everything else. Inert here, and
    // still there if the player goes back to the sandbox.
    const params = route("#challenge=4,floors=50,elevators=9,spawnrate=7");
    expect(params.sandbox).toBeNull();
    expect(params.challengeIndex).toBe(3);
  });

  it("plays the sandbox for challenge=sandbox, in any casing", () => {
    for (const hash of ["#challenge=sandbox", "#challenge=Sandbox", "#challenge=SANDBOX"]) {
      expect(route(hash).sandbox, hash).not.toBeNull();
    }
  });

  it("does not complain that the sandbox is not a challenge number", () => {
    route("#challenge=sandbox");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("is not selected by something that merely looks like it", () => {
    expect(route("#challenge=sandboxes").sandbox).toBeNull();
    expect(route("#challenge=sandboxes").challengeIndex).toBe(0);
  });

  it("starts a building known to be playable when no parameters are given", () => {
    // Challenge 4's shape, so that a bare #challenge=sandbox is something to
    // watch rather than something degenerate.
    expect(route("#challenge=sandbox").sandbox).toEqual({
      floorCount: 8,
      elevatorCount: 2,
      elevatorCapacities: [4],
      spawnRate: 0.6,
    });
  });

  it("reads every sandbox parameter", () => {
    expect(
      route("#challenge=sandbox,floors=20,elevators=3,capacities=6-9,spawnrate=1.5").sandbox,
    ).toEqual({
      floorCount: 20,
      elevatorCount: 3,
      elevatorCapacities: [6, 9],
      spawnRate: 1.5,
    });
  });

  it("keeps the rest of the url working alongside it", () => {
    const params = route("#challenge=sandbox,floors=12,timescale=8,fullscreen");
    expect(params.sandbox?.floorCount).toBe(12);
    expect(params.timeScale).toBe(8);
    expect(params.fullscreen).toBe(true);
  });
});

describe("resolveRoute sandbox validation", () => {
  /**
   * Resolves a sandbox hash, which always names a building.
   *
   * @param hash - The sandbox parameters, without the `challenge=sandbox`.
   * @returns The building the route asks for.
   */
  function sandbox(hash: string): SandboxOptions {
    const params = route(`#challenge=${SANDBOX_CHALLENGE},${hash}`);
    if (params.sandbox === null) {
      throw new Error(`Expected ${hash} to resolve a sandbox`);
    }
    return params.sandbox;
  }

  it("falls back for a floor count that is not a whole number", () => {
    // 8.5 is refused rather than rounded: quietly playing a building the player
    // did not ask for is how an afternoon disappears into a debugger.
    for (const value of ["abc", "", "NaN", "Infinity", "8.5", "8px"]) {
      expect(sandbox(`floors=${value}`).floorCount, value).toBe(8);
    }
    expect(console.warn).toHaveBeenCalled();
  });

  it("clamps a floor count the page cannot draw", () => {
    // A single floor makes spawnUserRandomly draw randomInt(1, 0), which is 1 —
    // a destination floor that does not exist, so nobody is ever delivered.
    expect(sandbox("floors=1").floorCount).toBe(2);
    expect(sandbox("floors=0").floorCount).toBe(2);
    expect(sandbox("floors=-20").floorCount).toBe(2);
    // 50px a floor and one in-car button per floor per elevator: 100000 floors
    // is millions of elements and a tab that never draws a frame.
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
    // A car is drawn `capacity * 10` wide, on a 20px gap, from x=200 in a 938px
    // building — so the ceiling of twelve only holds at the default capacity.
    // Clamping the two numbers apart would accept elevators=12,capacities=30
    // and draw ten of the twelve cars through the wall, where .worldtrack clips
    // them: simulated, controllable from player code, and invisible.
    expect(sandbox("elevators=12,capacities=30").elevatorCount).toBe(2);
    expect(sandbox("elevators=12,capacities=5").elevatorCount).toBe(10);
    // Mixed widths are measured car by car, not by the widest of them: four
    // alternating 300px and 10px cars end at x=880, the fifth would end at 1200.
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
    // Fewer capacities than cars is the cycling case the world supports, and is
    // left exactly as written.
    expect(sandbox("elevators=5,capacities=6-9").elevatorCapacities).toEqual([6, 9]);
  });

  it("rejects the whole capacity list when one entry is unreadable", () => {
    // Dropping the bad entry would slide every capacity after it onto a
    // different elevator, and the bar would still report it as what was asked
    // for.
    for (const value of ["abc", "", "6-abc", "6-", "-6", "6--9"]) {
      expect(sandbox(`capacities=${value}`).elevatorCapacities, value).toEqual([4]);
    }
  });

  it("clamps a capacity to a car that can exist and can be drawn", () => {
    // Zero is the value Elevator reads as "unset" and silently turns into 4.
    expect(sandbox("capacities=0-31").elevatorCapacities).toEqual([1, 30]);
  });

  it("keeps only as many capacities as there are elevators", () => {
    // The world reads capacities[i % capacities.length] once per car, so entries
    // past the last car never reach one — but the challenge bar prints the list
    // it is given, so leaving them in would describe a building that does not
    // exist.
    expect(sandbox("elevators=1,capacities=6-9").elevatorCapacities).toEqual([6]);
    expect(sandbox("elevators=3,capacities=6-9-2-7-8").elevatorCapacities).toEqual([6, 9, 2]);
    expect(console.warn).toHaveBeenCalledWith(
      "Sandbox capacities lists 2 cars for 1 elevator, keeping the first 1",
    );
  });

  it("stops parsing a capacity list long before it can slow the page down", () => {
    // Cut to the twelve-elevator ceiling before clamping, so a hash listing
    // thousands of cars costs thousands of Number calls and not thousands of
    // console warnings; the real elevator count then cuts it again.
    const long = `capacities=${Array.from({ length: 40 }, () => "99").join("-")}`;
    expect(sandbox(`elevators=12,${long}`).elevatorCapacities).toHaveLength(2);
    expect(vi.mocked(console.warn).mock.calls).toHaveLength(
      // One for the 40 entries, twelve clamping 99 to 30, one for the ten cars
      // of capacity 30 that do not fit, one for the capacities they took with
      // them.
      1 + 12 + 1 + 1,
    );
  });

  it("falls back for a spawn rate that is not a number", () => {
    for (const value of ["abc", "", "NaN", "Infinity"]) {
      expect(sandbox(`spawnrate=${value}`).spawnRate, value).toBe(0.6);
    }
  });

  it("never lets the spawn rate freeze or empty the world", () => {
    // World.update runs `while (elapsedSinceSpawn > 1 / spawnRate)` and
    // subtracts `1 / spawnRate` each time round. A negative rate makes that
    // subtraction an addition, so the loop never terminates and the tab hangs
    // on the very first frame; zero divides to Infinity and nobody ever
    // appears. Both are exactly the class of bug this module exists for.
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
    expect(route("#challenge=4").tutorialIndex).toBeNull();
    expect(route("#challenge=sandbox").tutorialIndex).toBeNull();
  });

  it("opens the task its address names, zero-based", () => {
    // Spelled out rather than generated, because these eight strings are the
    // promise: they are written down in docs/tutorial-plan.md and handed round
    // in links, and a link somebody already shared has to keep working.
    for (let number = 1; number <= 8; number += 1) {
      const hash = `#challenge=tutorial-${String(number)}`;
      expect(route(hash).tutorialIndex, hash).toBe(number - 1);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reaches every task in the table by the id it carries", () => {
    // The router's whole grammar for the track is the table's ids, so a task
    // renamed or moved takes its address with it instead of handing somebody's
    // bookmark to a different task.
    tutorialTasks.forEach((task, index) => {
      expect(route(`#challenge=${task.id}`).tutorialIndex, task.id).toBe(index);
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("spells every task id the way it recognises one", () => {
    // The prefix is the one thing about a task address the router states for
    // itself, and it is what tells a mistyped one from a challenge number. A
    // task renamed out of this shape would not be oddly named, it would be
    // unreachable -- so the two are checked against each other here.
    for (const task of tutorialTasks) {
      expect(task.id.startsWith(TUTORIAL_CHALLENGE_PREFIX), task.id).toBe(true);
    }
  });

  it("reads a task address however it is capitalised", () => {
    // Folded where it is read, as `sandbox` is, and not for every value at once.
    expect(route("#challenge=TUTORIAL-3").tutorialIndex).toBe(2);
    expect(route("#CHALLENGE=Tutorial-3").tutorialIndex).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not complain that a task address is not a challenge number", () => {
    // resolveChallengeIndex would read `tutorial-3` as NaN and say so, which is
    // noise about a number the player never wrote.
    const params = route("#challenge=tutorial-3");
    expect(params.refusedKeys).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("never resolves a task and a sandbox at once", () => {
    // One key, three things it can name. Nothing spells two of them.
    const task = route("#challenge=tutorial-3");
    expect(task.tutorialIndex).toBe(2);
    expect(task.sandbox).toBeNull();
    const sandbox = route("#challenge=sandbox");
    expect(sandbox.sandbox).not.toBeNull();
    expect(sandbox.tutorialIndex).toBeNull();
  });

  it("ignores sandbox parameters while a task is being played", () => {
    // Carried across by the navigation row, inert here, and still there if the
    // player goes back to the sandbox -- exactly as on a numbered challenge.
    const params = route("#challenge=tutorial-3,floors=50,elevators=9");
    expect(params.tutorialIndex).toBe(2);
    expect(params.sandbox).toBeNull();
    expect(params.refusedKeys).toEqual([]);
  });

  it("is not selected by something that merely looks like it", () => {
    // The prefix is exact, as `sandboxes` is not the sandbox: a value that is
    // not a task address is a challenge number, and is refused as one.
    for (const value of ["tutorial", "tutorials-1", "atutorial-1"]) {
      const params = route(`#challenge=${value}`);
      expect(params.tutorialIndex, value).toBeNull();
      expect(params.challengeIndex, value).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid challenge "${value}", starting the first challenge instead`,
      );
    }
  });
});

describe("resolveRoute tutorial validation", () => {
  it("lands a wrong task address on the first task, not on the first challenge", () => {
    // The player asked for the track, so the closest thing to what they asked
    // for is where the track starts. Landing on challenge 1 would answer a
    // question about the track with a challenge.
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
      const params = route(`#challenge=${value}`);
      expect(params.tutorialIndex, value).toBe(0);
      expect(params.refusedKeys, value).toEqual(["challenge"]);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid tutorial task "${value}", starting the first task instead`,
      );
    }
  });

  it("refuses the numbers Number() would have read for a name", () => {
    // Deliberate, and the reason the addresses are compared rather than parsed:
    // `01`, `1e0` and `1.0` are ways of writing the number one, and none of them
    // is a way of writing the name `tutorial-1`. `Number` accepts all three --
    // and reads `tutorial-` as 0 and `tutorial- 1` as 1 besides, the two traps
    // resolveChallengeIndex and resolveSandboxInteger already document.
    //
    // Each still lands on the first task, which is where `tutorial-1` lands, so
    // the warning and the refusal are the only things that tell the two apart:
    // the same point #challenge=1e9 makes on the challenge side.
    for (const value of ["tutorial-01", "tutorial-1e0", "tutorial-1.0", "tutorial-0x1"]) {
      const params = route(`#challenge=${value}`);
      expect(params.tutorialIndex, value).toBe(0);
      expect(params.refusedKeys, value).toEqual(["challenge"]);
      expect(console.warn).toHaveBeenCalledWith(
        `Invalid tutorial task "${value}", starting the first task instead`,
      );
    }
  });

  it("keeps the rest of the url working on the track", () => {
    // Every parameter but one behaves on a task address exactly as it does on a
    // challenge. `seed` is the exception, and is refused rather than read: see
    // "resolveRoute seed on the learning track" for what it would cost.
    expect(route("#challenge=tutorial-3,seed=issue-61,timescale=8,fullscreen=true")).toEqual({
      challengeIndex: 0,
      sandbox: null,
      tutorialIndex: 2,
      timeScale: 8,
      fullscreen: true,
      seed: null,
      refusedKeys: ["seed"],
    });
  });

  it("refuses an unusable value on the track exactly as anywhere else", () => {
    // Named for what it still checks. It said "the rest of the url" until `seed`
    // stopped being refused here for the reason it is refused everywhere else --
    // `rush hour` is unusable, but on the track even a good seed goes, so this
    // case no longer says anything about `seed` that is particular to the track.
    // What it does say is that adding the track's own refusal did not disturb
    // the ordinary ones, and that the two kinds arrive in one list in the order
    // the URL wrote them.
    const params = route("#challenge=tutorial-3,timescale=fast,seed=rush hour");
    expect(params.tutorialIndex).toBe(2);
    expect(params.timeScale).toBe(DEFAULT_TIME_SCALE);
    expect(params.seed).toBeNull();
    expect(params.refusedKeys).toEqual(["timescale", "seed"]);
  });
});

describe("resolveRoute refusals", () => {
  it("names nothing when the url asks for nothing", () => {
    expect(route("").refusedKeys).toEqual([]);
  });

  it("names nothing when every value is usable", () => {
    expect(route("#challenge=3,timescale=4,seed=issue-61").refusedKeys).toEqual([]);
  });

  it("names each key whose value it would not use", () => {
    expect(route("#challenge=abc,timescale=fast,seed=rush hour").refusedKeys).toEqual([
      "challenge",
      "timescale",
      "seed",
    ]);
  });

  it("names the sandbox parameters it refused, and not the ones it clamped", () => {
    // The distinction the whole list rests on. `floors=100000` still describes
    // the building on screen -- it reads as sixty every time and the bar prints
    // sixty -- so the url may go on saying it. `elevators=many` describes
    // nothing.
    expect(route("#challenge=sandbox,floors=100000,elevators=many").refusedKeys).toEqual([
      "elevators",
    ]);
  });

  it("does not name a key that was simply absent", () => {
    // A refusal and an absence resolve to the same value, which is why the
    // resolvers record this rather than a later pass working it out: from the
    // outside, `#challenge=abc` and `#` are both challenge one.
    expect(route("#challenge=abc").challengeIndex).toBe(route("").challengeIndex);
    expect(route("").refusedKeys).toEqual([]);
  });

  it("refuses a key to exactly the value its absence would have given", () => {
    // What makes dropping a refused key from the url a rewrite that changes no
    // route. If this ever stops holding, correcting the address bar starts
    // changing the run the player is watching.
    //
    // The two refusals that land where absence does not spell -- a task address
    // no task has, and a challenge this browser has not unlocked -- are not
    // exempt from that: the corrected url has to resolve to the run on screen
    // either way, so those are rewritten rather than dropped, and `startRouter`
    // is where each is checked against the run it left the player in.
    const refused = route("#challenge=abc,timescale=fast,seed=rush hour,floors=none");
    const absent = route("");
    expect(refused.refusedKeys.length).toBeGreaterThan(0);
    expect({ ...refused, refusedKeys: [] }).toEqual(absent);
  });
});

describe("resolveRoute seed validation", () => {
  it("pins nothing unless the url asks for it", () => {
    expect(route("").seed).toBeNull();
    expect(route("#challenge=4").seed).toBeNull();
  });

  it("keeps a numeric seed as the string the url spells it with", () => {
    // Never converted to a number, although RandomSeed accepts one:
    // createRandomSource hashes String(seed), so the two are the same stream,
    // while Number would read 0123 as 123 and 1e3 as 1000 -- three URLs
    // collapsing onto two runs, none of which say what they replay.
    expect(route("#seed=1234567890").seed).toBe("1234567890");
    expect(route("#seed=0123").seed).toBe("0123");
    expect(route("#seed=1e3").seed).toBe("1e3");
  });

  it("accepts a label somebody can read out", () => {
    expect(route("#seed=issue-61").seed).toBe("issue-61");
    expect(route("#seed=rush_hour.2").seed).toBe("rush_hour.2");
  });

  it("reads a seed the same whichever side the space is on", () => {
    // parseQuery drops whitespace around every value, so two hashes that look
    // alike name one passenger stream. No browser can deliver either of these:
    // it would send the space as %20, which is refused just below -- and that
    // refusal, not this leniency, is what a player pasting a spaced URL meets.
    expect(route("#seed= 5").seed).toBe("5");
    expect(route("#seed=5 ").seed).toBe("5");
    expect(route("#seed=%205").seed).toBeNull();
  });

  it("refuses a seed that could not survive the address bar", () => {
    // A browser percent-encodes anything outside the ASCII token set on its way
    // into location.hash, so "#seed=rush hour" comes back as "rush%20hour",
    // which hashes to a different stream and sends different people into the
    // building than the ones the link was shared for. The building itself comes
    // from the challenge number or the sandbox parameters, not from here.
    for (const hash of ["#seed=rush hour", "#seed=привет", "#seed=a/b", "#seed=100%"]) {
      expect(route(hash).seed, hash).toBeNull();
    }
  });

  it("refuses an empty seed and a seed too long to carry", () => {
    // The seed rides in every tile of the level switcher, so it is written
    // into the page a couple of dozen times over.
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
  it("refuses a seed on every task address, however good the seed is", () => {
    // Not a validation failure: `issue-61` is accepted anywhere else in the
    // game. On the track the seed is not the player's to choose, because which
    // program fails is a property of the passenger stream and the tasks are
    // built on a program failing.
    for (const task of tutorialTasks) {
      const hash = `#challenge=${task.id},seed=issue-61`;
      expect(route(hash).seed, hash).toBeNull();
      expect(route(hash).refusedKeys, hash).toContain("seed");
    }
  });

  it("refuses the seed measured to make task 5's starting program win", () => {
    // The concrete failure this exists to stop. STARTING_CODE_WINS in
    // tutorial-solutions.test.ts records the nine-floor sweep delivering all
    // fifteen inside the wait limit on `42a`, and calls that survivable because
    // "the pinned seed, the only one anybody plays, is not" such a seed. This
    // is what keeps that sentence true.
    const params = route("#challenge=tutorial-5,seed=42a");
    expect(params.seed).toBeNull();
    expect(params.tutorialIndex).toBe(4);
  });

  it("says where the seed went rather than that it was wrong", () => {
    route("#challenge=tutorial-5,seed=42a");
    expect(console.warn).toHaveBeenCalledWith(
      `Ignoring seed "42a": a learning task plays its own pinned seed`,
    );
  });

  it("refuses an empty seed on the track, which is written but says nothing", () => {
    // `seed=` is present and unusable at once, and the two sides of the branch
    // disagree about which of those matters: a challenge calls it invalid and
    // draws a fresh one, the track says the task pins its own. Both refuse it,
    // so the key leaves the URL either way and the outcomes are identical --
    // only the sentence differs, and the track's is the more useful of the two,
    // because "write a better seed" is advice a task cannot take.
    //
    // Pinned because the guard is `!== undefined` rather than a truthiness test,
    // and truthiness is the spelling somebody reaches for first. It would let
    // `seed=` through, leaving a key in the address bar that the run is not
    // using, on the one route whose whole point is that the URL says what is
    // being played.
    const params = route("#challenge=tutorial-3,seed=");
    expect(params.seed).toBeNull();
    expect(params.refusedKeys).toEqual(["seed"]);
    expect(console.warn).toHaveBeenCalledWith(
      `Ignoring seed "": a learning task plays its own pinned seed`,
    );
  });

  it("keeps quiet on a task address that names no seed", () => {
    // Every ordinary visit to a task. There is nothing to tell a player about a
    // key they did not write.
    route("#challenge=tutorial-5");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("leaves the seed alone on the routes it is the player's to choose", () => {
    // The refusal is scoped to the track and nothing else: a misspelled task
    // address is still the track, but a challenge and the sandbox are not.
    expect(route("#challenge=4,seed=42a").seed).toBe("42a");
    expect(route("#challenge=sandbox,seed=42a").seed).toBe("42a");
    expect(route("#challenge=tutorial-9,seed=42a").seed).toBeNull();
  });

  it("refuses the seed to what its absence gives, so the url can drop it", () => {
    // The invariant the whole refusedKeys list rests on, checked here because
    // this refusal is the one that does not come from an unusable value.
    const refused = route("#challenge=tutorial-5,seed=42a");
    const absent = route("#challenge=tutorial-5");
    expect({ ...refused, refusedKeys: [] }).toEqual(absent);
  });
});

describe("resolveRoute timescale validation", () => {
  it("accepts a speed the world can run at, including fractions", () => {
    expect(route("#timescale=8").timeScale).toBe(8);
    expect(route("#timescale=0.5").timeScale).toBe(0.5);
  });

  it("falls back to the default for a speed that is not a number", () => {
    // parseFloat("abc") is NaN; a NaN time scale turned every simulated dt into
    // NaN and froze the world with no way back short of editing the URL.
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
    target.location = { hash: "#challenge=3" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(onRoute.mock.calls[0]?.[0]).toMatchObject({ challengeIndex: 2 });
  });

  it("routes on hashchange and on popstate", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#challenge=2");
    target.navigate("#challenge=5", "popstate");

    expect(onRoute).toHaveBeenCalledTimes(3);
    expect(onRoute.mock.calls[2]?.[0]).toMatchObject({ challengeIndex: 4 });
  });

  it("ignores an event that did not change the url", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#challenge=2");
    target.navigate("#challenge=2", "popstate");

    expect(onRoute).toHaveBeenCalledTimes(2);
  });

  it("re-reads the default time scale on every navigation", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    let defaultTimeScale = 2;
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => defaultTimeScale,
      target,
    });

    defaultTimeScale = 16;
    target.navigate("#challenge=2");

    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ timeScale: 16 });
  });

  it("hands the raw parameters over as well", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=2,mystery=x" };
    const onRoute = vi.fn();
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(query?.get("mystery")).toBe("x");
  });

  it("takes a refused parameter out of the address bar", () => {
    // The URL went on saying `challenge=abc` while challenge 1 was being
    // played, which is the state a player bookmarks, pastes into a chat and
    // reports as a bug in the game.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=abc,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#timescale=8"]);
    expect(target.location.hash).toBe("#timescale=8");
    // Rewritten, not navigated to: `replaceState` is the only way onto this
    // stand-in's location, and the correction routed nothing a second time.
    expect(onRoute).toHaveBeenCalledTimes(1);
  });

  it("hands the handler what the address bar says now", () => {
    // Not what it said. The level switcher builds a link per tile out of this
    // query, so a refused key left in it would be written into every one of
    // them and refused again on each.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=2,seed=rush%20hour,mystery=x" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(query?.has("seed")).toBe(false);
    expect([...(query ?? [])]).toEqual([
      ["challenge", "2"],
      ["mystery", "x"],
    ]);
    // The route the corrected URL resolves to is the route that was played.
    expect(onRoute.mock.calls[0]?.[0]).toMatchObject({ challengeIndex: 1, seed: null });
  });

  it("corrects a wrong task address to the first task instead of dropping it", () => {
    // Deleting the key would leave `#`, which is the first *challenge*: the bar
    // would describe a run nobody is watching, and a reload would take the
    // player to it. The first task has no spelling but its own id, and the
    // player did choose the track, so the id is not a choice invented for them.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=tutorial-9,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    // Rewritten where it stood, so the corrected url still reads in the order
    // it was written.
    expect(target.replaced).toEqual(["#challenge=tutorial-1,timescale=8"]);
    expect(onRoute).toHaveBeenCalledTimes(1);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    const query = onRoute.mock.calls[0]?.[1] as RouteQuery | undefined;
    expect(params).toMatchObject({ tutorialIndex: 0, refusedKeys: ["challenge"] });
    expect(query?.get("challenge")).toBe("tutorial-1");
    // The whole point of correcting: what the address bar says now resolves to
    // the run that is on screen, refusals and all.
    expect(route(target.location.hash)).toEqual({ ...params, refusedKeys: [] });
  });

  it("corrects a locked challenge to the one that opened instead of dropping it", () => {
    // The same rule as the task address above, arriving on the other branch:
    // deleting the key would say "challenge 1", and the player is on challenge
    // 8. Only the number they cannot have is rewritten -- the speed they chose
    // is still theirs.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=18,timescale=8" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: (index) => index > 7,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#challenge=8,timescale=8"]);
    const params = onRoute.mock.calls[0]?.[0] as RouteParams | undefined;
    expect(params).toMatchObject({ challengeIndex: 7, refusedKeys: ["challenge"] });
    // What the address bar says now is a challenge this player may open, so
    // reading it again refuses nothing and the correction settles in one pass.
    expect(routeAfterClearing(target.location.hash, 7)).toEqual({ ...params, refusedKeys: [] });
  });

  it("empties the hash when the locked challenge fell all the way back", () => {
    // Absence spells challenge 1, so a fallback that lands there is a deletion
    // like any other refusal -- writing `challenge=1` would put a choice in the
    // bar that the player never made.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=4" };

    startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: (index) => index > 0,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#"]);
  });

  it("asks again on every navigation, so a challenge just cleared opens", () => {
    // The reason this is a callback rather than a set handed over once: the
    // "Next level" link in the verdict card is followed a moment after the win
    // that unlocked what it points at.
    const target = new FakeTarget();
    let cleared = 0;
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: (index) => index > cleared,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    cleared = 1;
    target.navigate("#challenge=2");

    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ challengeIndex: 1, refusedKeys: [] });
    expect(target.replaced).toEqual([]);
  });

  it("still deletes the other refusals it finds on the track", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=tutorial-9,seed=rush%20hour" };

    startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual(["#challenge=tutorial-1"]);
  });

  it("empties the hash when nothing in it survived", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=abc" };

    startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    // A browser resolves "#" against the current URL and leaves the fragment
    // empty, so what a later event will compare against is "" -- which is what
    // the router has to have recorded, or the next navigation to this same URL
    // looks like a repeat and is ignored.
    expect(target.replaced).toEqual(["#"]);
    expect(target.location.hash).toBe("");
  });

  it("leaves the state on the entry it rewrites", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=abc" };
    target.history.state = { scroll: 12 };

    startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.history.state).toEqual({ scroll: 12 });
  });

  it.each([
    // Nothing wrong with it.
    "#challenge=3,timescale=8,seed=issue-61",
    // An unknown key is kept on purpose: a later version's parameter, or the
    // player's own. See parseQuery.
    "#challenge=3,mystery=x",
    // A clamped value still names the run on screen -- `floors=100000` resolves
    // to sixty floors every time it is read, and the bar prints sixty -- so
    // there is nothing to correct. Only a refusal is a URL describing something
    // nobody is playing.
    "#challenge=sandbox,floors=100000",
    // A task address that opens a task is a url that says what is running.
    "#challenge=tutorial-3,timescale=8",
  ])("leaves %s alone", (hash) => {
    const target = new FakeTarget();
    target.location = { hash };

    startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.replaced).toEqual([]);
    expect(target.location.hash).toBe(hash);
  });

  it("corrects every navigation, not just the first", () => {
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#challenge=4,timescale=fast");

    expect(target.replaced).toEqual(["#challenge=4"]);
    expect(onRoute).toHaveBeenCalledTimes(2);
    expect(onRoute.mock.calls[1]?.[0]).toMatchObject({ challengeIndex: 3 });
  });

  it("routes again when the player comes back to a url it once corrected", () => {
    // The correction moves the location without raising an event, so the hash
    // the router remembers has to be the corrected one. Remembering the refused
    // one instead would make a real navigation back to it look like a repeat.
    const target = new FakeTarget();
    const onRoute = vi.fn();
    startRouter(onRoute, {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    target.navigate("#challenge=abc");
    expect(target.location.hash).toBe("");

    target.navigate("#challenge=abc");

    expect(onRoute).toHaveBeenCalledTimes(3);
    expect(target.replaced).toEqual(["#", "#"]);
  });

  it("unsubscribes everything when stopped", () => {
    const target = new FakeTarget();
    const stop = startRouter(vi.fn(), {
      challengeCount: 18,
      isChallengeLocked: EVERY_CHALLENGE_OPEN,
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.listenerCount).toBe(2);
    stop();
    expect(target.listenerCount).toBe(0);
  });
});
