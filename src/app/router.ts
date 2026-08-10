/**
 * The hash router.
 *
 * Replaces `riot.route`. The URL format is unchanged — a `#` followed by
 * comma-separated `key=value` pairs, as in `#challenge=3,timescale=8` — and so
 * are the parameter names, so old links and bookmarks keep working.
 *
 * The legacy parser was `path.split(",")` with `/(\w+)=(\w+$)/` per segment and
 * no validation of what came out, which made two malformed URLs fatal:
 *
 * - `#challenge=abc` produced `_.parseInt("abc") - 1`, i.e. `NaN`. `NaN < 0` and
 *   `NaN >= challenges.length` are both false, so the range check passed it
 *   through to `challenges[NaN].options` and the page died with a TypeError
 *   before anything was drawn.
 * - `#timescale=abc` produced `parseFloat("abc")`, i.e. `NaN`, which became the
 *   world's time scale. Every simulated `dt` was then `NaN` and the world
 *   froze, with no way back short of editing the URL by hand.
 *
 * Everything is parsed and validated here instead, and anything unusable falls
 * back to a default.
 */

import { clampTimeScale } from "./time-scale.ts";

/** Raw `key=value` pairs from the location hash, in the order they appeared. */
export type RouteQuery = ReadonlyMap<string, string>;

/** The validated parameters a route resolves to. */
export interface RouteParams {
  /** Zero-based index into the challenge list. */
  readonly challengeIndex: number;
  /** Whether the simulation should start without waiting for the Start button. */
  readonly autoStart: boolean;
  /** Simulation speed multiplier. */
  readonly timeScale: number;
  /** Whether to load the built-in reference solution. */
  readonly devTest: boolean;
  /** Whether to hide everything except the world. */
  readonly fullscreen: boolean;
}

/** Everything {@link resolveRoute} needs besides the URL itself. */
export interface RouteContext {
  /** How many challenges exist; bounds the `challenge` parameter. */
  readonly challengeCount: number;
  /** Time scale to use when the URL does not ask for one. */
  readonly defaultTimeScale: number;
}

/**
 * Splits a location hash into its `key=value` pairs.
 *
 * Unknown keys are kept: they are round-tripped into the next-challenge link by
 * {@link createParamsUrl}, exactly as the legacy code did.
 *
 * A key with no `=` is accepted as a bare flag and yields an empty value, so
 * `#fullscreen` now works. The legacy regexp required a value, which meant the
 * bare forms people wrote (`#autostart`, `#devtest`) silently did nothing.
 *
 * @param hash - The location hash, with or without its leading `#`.
 * @returns The parsed pairs, in order.
 */
export function parseQuery(hash: string): RouteQuery {
  const query = new Map<string, string>();
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const segment of body.split(",")) {
    const trimmed = segment.trim();
    if (trimmed === "") {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = separator === -1 ? trimmed : trimmed.slice(0, separator);
    const value = separator === -1 ? "" : trimmed.slice(separator + 1);
    if (key !== "") {
      query.set(key, value);
    }
  }
  return query;
}

/**
 * Rebuilds a hash URL from a set of parameters and some overrides.
 *
 * @param query - The parameters currently in the URL.
 * @param overrides - Parameters to add or replace.
 * @returns The new hash, including its leading `#`.
 */
export function createParamsUrl(
  query: RouteQuery,
  overrides: Readonly<Record<string, string | number>> = {},
): string {
  const merged = new Map(query);
  for (const [key, value] of Object.entries(overrides)) {
    merged.set(key, String(value));
  }
  return `#${[...merged].map(([key, value]) => `${key}=${value}`).join(",")}`;
}

/**
 * Reads a flag parameter.
 *
 * Present means on, as it did before; an explicit `=false` means off.
 *
 * @param query - The parsed parameters.
 * @param key - The flag to read.
 * @returns Whether the flag is set.
 */
function readFlag(query: RouteQuery, key: string): boolean {
  const value = query.get(key);
  return value !== undefined && value !== "false";
}

/**
 * Validates the raw parameters of a route.
 *
 * @param query - The parsed parameters.
 * @param context - The challenge count and the fallback time scale.
 * @returns Parameters that are always safe to act on.
 */
export function resolveRoute(query: RouteQuery, context: RouteContext): RouteParams {
  return {
    challengeIndex: resolveChallengeIndex(query.get("challenge"), context.challengeCount),
    autoStart: readFlag(query, "autostart"),
    timeScale: resolveTimeScale(query.get("timescale"), context.defaultTimeScale),
    devTest: readFlag(query, "devtest"),
    fullscreen: readFlag(query, "fullscreen"),
  };
}

/**
 * Turns a `challenge` parameter into an index that exists.
 *
 * @param value - The raw parameter, if it was present.
 * @param challengeCount - How many challenges exist.
 * @returns A valid zero-based index; `0` for anything unusable.
 */
function resolveChallengeIndex(value: string | undefined, challengeCount: number): number {
  if (value === undefined) {
    return 0;
  }
  const challengeNum = Number.parseInt(value, 10);
  const index = challengeNum - 1;
  if (!Number.isInteger(index) || index < 0 || index >= challengeCount) {
    console.warn(`Invalid challenge "${value}", starting the first challenge instead`);
    return 0;
  }
  return index;
}

/**
 * Turns a `timescale` parameter into a speed the world can actually run at.
 *
 * @param value - The raw parameter, if it was present.
 * @param defaultTimeScale - The time scale to use when there is no parameter.
 * @returns A finite, positive time scale.
 */
function resolveTimeScale(value: string | undefined, defaultTimeScale: number): number {
  if (value === undefined) {
    return clampTimeScale(defaultTimeScale);
  }
  const timeScale = Number.parseFloat(value);
  if (!Number.isFinite(timeScale)) {
    console.warn(`Invalid timescale "${value}", using ${String(defaultTimeScale)} instead`);
    return clampTimeScale(defaultTimeScale);
  }
  return clampTimeScale(timeScale);
}

/** Called with every route the player navigates to. */
export type RouteHandler = (params: RouteParams, query: RouteQuery) => void;

/** The part of a `Window` the router uses. */
export interface RouterTarget {
  /** The location whose hash is routed on. */
  readonly location: { readonly hash: string };
  /**
   * Subscribes to a navigation event.
   *
   * @param type - Event name.
   * @param listener - Handler to register.
   */
  addEventListener(type: "hashchange" | "popstate", listener: () => void): void;
  /**
   * Unsubscribes from a navigation event.
   *
   * @param type - Event name.
   * @param listener - Handler to remove.
   */
  removeEventListener(type: "hashchange" | "popstate", listener: () => void): void;
}

/** Options accepted by {@link startRouter}. */
export interface RouterOptions {
  /** How many challenges exist. */
  readonly challengeCount: number;
  /**
   * Time scale to use when the URL does not ask for one.
   *
   * Re-read on every navigation, so a speed the player chose with the `+`/`-`
   * buttons survives moving to the next challenge.
   */
  readonly defaultTimeScale: () => number;
  /** The window whose location and events to follow; defaults to `window`. */
  readonly target?: RouterTarget;
}

/**
 * Starts routing, calling the handler for the current URL and every later one.
 *
 * Listens for both `hashchange` and `popstate`: the first covers ordinary
 * navigation, the second covers the history entries a browser restores without
 * firing `hashchange`.
 *
 * @param onRoute - Called with the resolved parameters for each route.
 * @param options - The challenge count, the default time scale and the window.
 * @returns A function that stops routing.
 */
export function startRouter(onRoute: RouteHandler, options: RouterOptions): () => void {
  const target = options.target ?? window;
  let lastHash: string | null = null;

  const handleRoute = (force: boolean): void => {
    const hash = target.location.hash;
    if (!force && hash === lastHash) {
      return;
    }
    lastHash = hash;
    const query = parseQuery(hash);
    onRoute(
      resolveRoute(query, {
        challengeCount: options.challengeCount,
        defaultTimeScale: options.defaultTimeScale(),
      }),
      query,
    );
  };

  const listener = (): void => {
    handleRoute(false);
  };
  target.addEventListener("hashchange", listener);
  target.addEventListener("popstate", listener);
  handleRoute(true);

  return () => {
    target.removeEventListener("hashchange", listener);
    target.removeEventListener("popstate", listener);
  };
}
