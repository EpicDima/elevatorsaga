import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SandboxOptions } from "../game/challenges.ts";
import {
  createParamsUrl,
  parseQuery,
  resolveRoute,
  SANDBOX_CHALLENGE,
  startRouter,
  type RouteQuery,
  type RouterTarget,
} from "./router.ts";
import { DEFAULT_TIME_SCALE, TIME_SCALE_MAX, TIME_SCALE_MIN } from "./time-scale.ts";

/** The context a route is resolved against in these tests. */
const CONTEXT = { challengeCount: 18, defaultTimeScale: DEFAULT_TIME_SCALE };

/**
 * Resolves a location hash the way the running game does.
 *
 * @param hash - The location hash.
 * @returns The validated route parameters.
 */
function route(hash: string): ReturnType<typeof resolveRoute> {
  return resolveRoute(parseQuery(hash), CONTEXT);
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

describe("parseQuery", () => {
  it("parses the legacy comma-separated form", () => {
    expect([...parseQuery("#challenge=3,timescale=8")]).toEqual([
      ["challenge", "3"],
      ["timescale", "8"],
    ]);
  });

  it("works with or without the leading hash, and on an empty hash", () => {
    expect([...parseQuery("challenge=3")]).toEqual([["challenge", "3"]]);
    expect([...parseQuery("#")]).toEqual([]);
    expect([...parseQuery("")]).toEqual([]);
  });

  it("accepts bare flags, which the legacy regexp silently dropped", () => {
    expect([...parseQuery("#fullscreen")]).toEqual([["fullscreen", ""]]);
  });

  it("keeps values the legacy regexp could not match", () => {
    // \w+$ never matched a decimal point, so #timescale=1.5 did nothing at all.
    expect(parseQuery("#timescale=1.5").get("timescale")).toBe("1.5");
  });

  it("keeps unknown parameters, so they survive into the next-challenge link", () => {
    expect(parseQuery("#challenge=2,mystery=x").get("mystery")).toBe("x");
  });

  it("reads a key however it is capitalised, and leaves the value as written", () => {
    // Which shift key was held while typing `challenge` is not a decision
    // anybody makes on purpose. The value is data, and stays as written: two
    // seeds spelled differently are two different passenger streams.
    expect(parseQuery("#SEED=Abc").get("seed")).toBe("Abc");
    expect(parseQuery("#Challenge=3").get("challenge")).toBe("3");
    expect(parseQuery("#FULLSCREEN").get("fullscreen")).toBe("");
  });

  it("ignores whitespace around a key and around a value", () => {
    // The format's whitespace rule, in one place, so no resolver needs a trim of
    // its own. A browser cannot produce any of this -- it percent-encodes a
    // space in a fragment -- so the leniency is for hashes assembled in code,
    // decoded before they arrive, or written by hand.
    expect([...parseQuery("#challenge=4, seed = abc ")]).toEqual([
      ["challenge", "4"],
      ["seed", "abc"],
    ]);
  });

  it("holds one entry per key, whatever mixture of capitals wrote them", () => {
    // #SEED=abc was neither read as a seed nor dropped, so it rode along into
    // every URL built afterwards -- next to the seed that was read.
    expect([...parseQuery("#SEED=abc,seed=xyz")]).toEqual([["seed", "xyz"]]);
  });
});

describe("createParamsUrl", () => {
  it("merges overrides over the current parameters", () => {
    const query = parseQuery("#challenge=2,timescale=8");
    expect(createParamsUrl(query, { challenge: 3 })).toBe("#challenge=3,timescale=8");
  });

  it("appends parameters that were not in the url", () => {
    expect(createParamsUrl(parseQuery("#challenge=2"), { autostart: "true" })).toBe(
      "#challenge=2,autostart=true",
    );
  });

  it("does not modify the parameters it was given", () => {
    const query = parseQuery("#challenge=2");
    createParamsUrl(query, { challenge: 9 });
    expect(query.get("challenge")).toBe("2");
  });

  it("drops a parameter overridden with null, and keeps the rest", () => {
    // How the navigation row says "everything the player is carrying except the
    // seed", which belongs to the building being left rather than the next one.
    const query = parseQuery("#challenge=2,timescale=8,seed=issue-61");
    expect(createParamsUrl(query, { challenge: 3, seed: null })).toBe("#challenge=3,timescale=8");
  });

  it("says nothing about a parameter that was not there to drop", () => {
    expect(createParamsUrl(parseQuery("#challenge=2"), { seed: null })).toBe("#challenge=2");
  });

  it("cannot build a url that names one parameter twice", () => {
    // The property the whole of the case folding exists for: whatever the
    // player wrote, an override replaces the parameter rather than joining it.
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#seed=abc"), { SEED: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: null })).toBe("#");
  });
});

describe("resolveRoute defaults", () => {
  it("starts the first challenge, paused, at the default speed", () => {
    expect(route("")).toEqual({
      challengeIndex: 0,
      sandbox: null,
      autoStart: false,
      timeScale: DEFAULT_TIME_SCALE,
      devTest: false,
      fullscreen: false,
      seed: null,
      refusedKeys: [],
    });
  });

  it("reads every parameter the game supports", () => {
    expect(
      route("#challenge=4,autostart=true,timescale=8,devtest=true,fullscreen=true,seed=abc"),
    ).toEqual({
      challengeIndex: 3,
      sandbox: null,
      autoStart: true,
      timeScale: 8,
      devTest: true,
      fullscreen: true,
      seed: "abc",
      refusedKeys: [],
    });
  });

  it("reads a route written in capitals", () => {
    const params = route("#CHALLENGE=4,SEED=issue-61,TIMESCALE=8,AUTOSTART");
    expect(params).toMatchObject({
      challengeIndex: 3,
      seed: "issue-61",
      timeScale: 8,
      autoStart: true,
    });
    expect(route("#CHALLENGE=SANDBOX").sandbox).not.toBeNull();
  });

  it("treats a flag as off only when it says false", () => {
    expect(route("#autostart=false").autoStart).toBe(false);
    expect(route("#autostart=whatever").autoStart).toBe(true);
    expect(route("#autostart").autoStart).toBe(true);
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
    const params = route("#challenge=sandbox,floors=12,timescale=8,autostart,fullscreen");
    expect(params.sandbox?.floorCount).toBe(12);
    expect(params.timeScale).toBe(8);
    expect(params.autoStart).toBe(true);
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
    // The seed rides in every entry of the navigation row, so it is written
    // into the page some twenty times over.
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
    // Not what it said. The challenge bar builds nineteen navigation links out
    // of this query, so a refused key left in it would be written into every
    // one of them and refused again on each.
    const target = new FakeTarget();
    target.location = { hash: "#challenge=2,seed=rush%20hour,mystery=x" };
    const onRoute = vi.fn();

    startRouter(onRoute, {
      challengeCount: 18,
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

  it("empties the hash when nothing in it survived", () => {
    const target = new FakeTarget();
    target.location = { hash: "#challenge=abc" };

    startRouter(vi.fn(), {
      challengeCount: 18,
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
  ])("leaves %s alone", (hash) => {
    const target = new FakeTarget();
    target.location = { hash };

    startRouter(vi.fn(), {
      challengeCount: 18,
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
      defaultTimeScale: () => DEFAULT_TIME_SCALE,
      target,
    });

    expect(target.listenerCount).toBe(2);
    stop();
    expect(target.listenerCount).toBe(0);
  });
});
