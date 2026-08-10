import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createParamsUrl,
  parseQuery,
  resolveRoute,
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
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
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
});

describe("resolveRoute defaults", () => {
  it("starts the first challenge, paused, at the default speed", () => {
    expect(route("")).toEqual({
      challengeIndex: 0,
      autoStart: false,
      timeScale: DEFAULT_TIME_SCALE,
      devTest: false,
      fullscreen: false,
    });
  });

  it("reads every parameter the game supports", () => {
    expect(route("#challenge=4,autostart=true,timescale=8,devtest=true,fullscreen=true")).toEqual({
      challengeIndex: 3,
      autoStart: true,
      timeScale: 8,
      devTest: true,
      fullscreen: true,
    });
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
