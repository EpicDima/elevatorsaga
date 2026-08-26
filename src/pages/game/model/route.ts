/** Resolves a parsed hash into safe route parameters and keeps the address bar in sync. */

import type { SandboxOptions } from "#game/levels.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import { chapter2Levels } from "#game/chapter2.ts";
import { clampTimeScale } from "#features/adjust-speed/model/time-scale.ts";
import { createParamsUrl, parseQuery, type RouteQuery } from "#shared/lib/route-query.ts";
import { isUsableSeed } from "#shared/lib/seed.ts";

/** The validated parameters a route resolves to. */
export interface RouteParams {
  /**
   * Zero-based index into {@link "#game/chapter1.ts"!chapter1Levels}.
   *
   * Ignored when {@link sandbox}, {@link tutorialIndex} or {@link chapter2Index} is set.
   */
  readonly chapter1Index: number;
  /** The building the sandbox was asked for, or `null` for a chapter one level. */
  readonly sandbox: SandboxOptions | null;
  /**
   * The learning-track level asked for, or `null` for anything else.
   *
   * Zero-based index into {@link "#game/tutorial.ts"!tutorialLevels}.
   */
  readonly tutorialIndex: number | null;
  /**
   * The chapter two level asked for, or `null` for anything else.
   *
   * Zero-based index into {@link "#game/chapter2.ts"!chapter2Levels}.
   */
  readonly chapter2Index: number | null;
  /** Simulation speed multiplier. */
  readonly timeScale: number;
  /** Whether to hide everything except the world. */
  readonly fullscreen: boolean;
  /**
   * The seed the world draws its passengers from, or `null` to let the world draw its own.
   *
   * Always `null` while {@link tutorialIndex} or {@link chapter2Index} is set; those levels
   * play the seed pinned to their own entry.
   */
  readonly seed: string | null;
  /**
   * The keys the URL named that the router could not use, in the order they were read.
   *
   * A clamped value (`floors=100000` becoming 60) is not refused, only a value replaced with
   * something the URL didn't ask for.
   */
  readonly refusedKeys: readonly string[];
}

/** Records a parameter the router would not use, so the URL can stop naming it. */
type Refuse = (key: string) => void;

/** Everything {@link resolveRoute} needs besides the URL itself. */
export interface RouteContext {
  /** How many chapter one levels exist; bounds a numeric `level` parameter. */
  readonly chapter1LevelCount: number;
  /** Time scale to use when the URL does not ask for one. */
  readonly defaultTimeScale: number;
}

/**
 * Reads a flag parameter.
 *
 * Present means on; an explicit `=false` means off.
 */
function readFlag(query: RouteQuery, key: string): boolean {
  const value = query.get(key);
  return value !== undefined && value !== "false";
}

/** The hash key that names what is being played: a chapter one level, the sandbox, or a level of the track or chapter two. */
export const LEVEL_KEY = "level";

/** Legacy spelling of {@link LEVEL_KEY}, read for backward compatibility and never written. */
export const LEGACY_LEVEL_KEY = "challenge";

/** The {@link LEVEL_KEY} value that asks for the sandbox instead of a chapter one level. */
export const SANDBOX_LEVEL = "sandbox";

/**
 * Prefix of every {@link LEVEL_KEY} value that names a learning-track level.
 *
 * Must stay in sync with the ids in {@link "#game/tutorial.ts"!tutorialLevels}; `route.test.ts`
 * checks that it does.
 */
export const TUTORIAL_LEVEL_PREFIX = "tutorial-";

/**
 * Prefix of every {@link LEVEL_KEY} value that names a chapter two level.
 *
 * Must stay in sync with the ids in {@link "#game/chapter2.ts"!chapter2Levels}.
 */
export const CHAPTER2_LEVEL_PREFIX = "chapter2-";

/**
 * Rewrites a hash written with {@link LEGACY_LEVEL_KEY} to use {@link LEVEL_KEY}.
 *
 * If both keys are present, the modern one wins. Returns the same query unchanged when there
 * is nothing to rename.
 */
export function renameLegacyLevelKey(query: RouteQuery): RouteQuery {
  if (!query.has(LEGACY_LEVEL_KEY)) {
    return query;
  }
  const renamed = new Map<string, string>();
  for (const [key, value] of query) {
    if (key !== LEGACY_LEVEL_KEY) {
      renamed.set(key, value);
    } else if (!query.has(LEVEL_KEY)) {
      renamed.set(LEVEL_KEY, value);
    }
  }
  return renamed;
}

/** The accepted range of a sandbox parameter, and what unusable input becomes. */
interface SandboxRange {
  /** Smallest value the simulation is allowed to run with. */
  readonly min: number;
  /** Largest value the simulation is allowed to run with. */
  readonly max: number;
  /** Used when the parameter is absent or cannot be read as a number. */
  readonly fallback: number;
}

/** Bounds for the sandbox's hand-written parameters; out-of-range values are clamped. */
const SANDBOX_LIMITS = {
  /** `floors` in the URL. */
  floorCount: { min: 2, max: 60, fallback: 8 },
  /** `elevators` in the URL; the ceiling is what fits in the building's width. */
  elevatorCount: { min: 1, max: 12, fallback: 2 },
  /** `capacities` in the URL, per elevator. */
  elevatorCapacity: { min: 1, max: 30, fallback: 4 },
  /** `spawnrate` in the URL, passengers per simulated second. */
  spawnRate: { min: 0.01, max: 10, fallback: 0.6 },
} as const satisfies Record<string, SandboxRange>;

/** Separates per-elevator capacities in `capacities=4-10`; not a comma, which separates keys. */
const CAPACITY_SEPARATOR = "-";

/**
 * The geometry a sandbox building fits its elevators into, mirrored from values that live
 * elsewhere and aren't otherwise reachable from this module.
 */
const ELEVATOR_LAYOUT = {
  /** `--building-width` in `src/shared/styles/tokens.css`. */
  buildingWidth: 938,
  /** `FIRST_ELEVATOR_X` in `src/game/world.ts`. */
  firstElevatorX: 200,
  /** `ELEVATOR_SPACING` in `src/game/world.ts`. */
  spacing: 20,
  /** `Elevator.width = maxUsers * 10`. */
  widthPerCapacity: 10,
} as const;

/** Validates the raw parameters of a route into something always safe to act on. */
export function resolveRoute(rawQuery: RouteQuery, context: RouteContext): RouteParams {
  const refusedKeys: string[] = [];
  const refuse: Refuse = (key) => {
    refusedKeys.push(key);
  };
  // Also renamed here, not just in startRouter, so a caller can hand this a legacy hash directly.
  const query = renameLegacyLevelKey(rawQuery);
  const level = query.get(LEVEL_KEY);
  // Must run before resolveChapter1Index, which reads the value with Number and would turn
  // "sandbox", "tutorial-3" and "chapter2-1" alike into NaN.
  const tutorialIndex = isTutorialRoute(level) ? resolveTutorialIndex(level, refuse) : null;
  const chapter2Index = isChapter2Route(level) ? resolveChapter2Index(level, refuse) : null;
  const sandbox = isSandboxRoute(level) ? resolveSandboxOptions(query, refuse) : null;
  // Tutorial and chapter two levels both pin their own seed and never take one from the URL.
  const pinnedSeedTrack = tutorialIndex !== null || chapter2Index !== null;
  return {
    // Only resolved when a chapter one level is actually being played, to avoid warning that
    // "sandbox" or "tutorial-3" is not a level number.
    chapter1Index:
      sandbox === null && !pinnedSeedTrack ? resolveChapter1Index(level, context, refuse) : 0,
    sandbox,
    tutorialIndex,
    chapter2Index,
    timeScale: resolveTimeScale(query.get("timescale"), context.defaultTimeScale, refuse),
    fullscreen: readFlag(query, "fullscreen"),
    // Refused rather than honored: the track's lessons and chapter two's medals both depend
    // on a specific pinned seed, not whatever the URL asks for.
    seed: pinnedSeedTrack
      ? refuseSeedOnTrack(query, refuse)
      : resolveSeed(query.get("seed"), refuse),
    refusedKeys,
  };
}

/**
 * Turns a `seed` parameter into something a run can be rebuilt from.
 *
 * Kept as the string the URL was written with; converting it to a `Number` would silently
 * rewrite some seeds (`0123`, `1e3`, `0x10`) into a different run.
 */
function resolveSeed(value: string | undefined, refuse: Refuse): string | null {
  if (value === undefined) {
    return null;
  }
  if (!isUsableSeed(value)) {
    console.warn(`Invalid seed "${value}", using a fresh one instead`);
    refuse("seed");
    return null;
  }
  return value;
}

/** Drops a `seed` on a level that pins its own, and warns why. */
function refuseSeedOnTrack(query: RouteQuery, refuse: Refuse): null {
  const value = query.get("seed");
  if (value !== undefined) {
    console.warn(`Ignoring seed "${value}": this level plays its own pinned seed`);
    refuse("seed");
  }
  return null;
}

/** Whether a `level` parameter asks for the sandbox, case-insensitively. */
function isSandboxRoute(value: string | undefined): boolean {
  return value?.toLowerCase() === SANDBOX_LEVEL;
}

/**
 * Whether a `level` parameter names a learning-track level, case-insensitively.
 *
 * True for any value with the prefix, not only ones that resolve to a real level, so a typo
 * lands on the track instead of falling through to a chapter one level.
 */
function isTutorialRoute(value: string | undefined): value is string {
  return value?.toLowerCase().startsWith(TUTORIAL_LEVEL_PREFIX) === true;
}

/**
 * Turns a `level=tutorial-…` parameter into a level that exists.
 *
 * Matched against each level's `id`, not parsed as a number, so `tutorial-01` and `tutorial-`
 * are refused. Unusable input falls back to the track's first level, not level one.
 */
function resolveTutorialIndex(value: string, refuse: Refuse): number {
  const id = value.toLowerCase();
  const index = tutorialLevels.findIndex((level) => level.id === id);
  if (index === -1) {
    console.warn(`Invalid tutorial level "${value}", starting the first one instead`);
    refuse(LEVEL_KEY);
    return 0;
  }
  return index;
}

/** Whether a `level` parameter names a chapter two level, case-insensitively; see {@link isTutorialRoute}. */
function isChapter2Route(value: string | undefined): value is string {
  return value?.toLowerCase().startsWith(CHAPTER2_LEVEL_PREFIX) === true;
}

/**
 * Turns a `level=chapter2-…` parameter into a level that exists.
 *
 * Matched against each level's `id`, as {@link resolveTutorialIndex} matches the track's,
 * since chapter two is still being filled in and ids can land between existing ones.
 */
function resolveChapter2Index(value: string, refuse: Refuse): number {
  const id = value.toLowerCase();
  const index = chapter2Levels.findIndex((level) => level.id === id);
  if (index === -1) {
    console.warn(`Invalid chapter two level "${value}", starting the first one instead`);
    refuse(LEVEL_KEY);
    return 0;
  }
  return index;
}

/** Reads the building a sandbox URL asks for. */
function resolveSandboxOptions(query: RouteQuery, refuse: Refuse): SandboxOptions {
  // Elevator count and capacities are resolved together: how many cars fit depends on their
  // width, and which capacities are used depends on how many cars there are.
  const floorCount = resolveSandboxInteger(
    query.get("floors"),
    "floors",
    SANDBOX_LIMITS.floorCount,
    refuse,
  );
  const requestedElevators = resolveSandboxInteger(
    query.get("elevators"),
    "elevators",
    SANDBOX_LIMITS.elevatorCount,
    refuse,
  );
  const capacities = resolveElevatorCapacities(query.get("capacities"), refuse);
  const elevatorCount = fitElevatorCount(requestedElevators, capacities);
  return {
    floorCount,
    elevatorCount,
    elevatorCapacities: trimCapacities(capacities, elevatorCount),
    spawnRate: resolveSandboxNumber(
      query.get("spawnrate"),
      "spawnrate",
      SANDBOX_LIMITS.spawnRate,
      refuse,
    ),
  };
}

/**
 * Reduces an elevator count to the cars the building can actually fit side by side.
 *
 * Clamping the count and the capacities independently could still overflow the building's
 * width, drawing elevators the player can't see or reach.
 */
function fitElevatorCount(requested: number, capacities: readonly number[]): number {
  const { buildingWidth, firstElevatorX, spacing, widthPerCapacity } = ELEVATOR_LAYOUT;
  let x = firstElevatorX;
  let fitted = 0;
  while (fitted < requested) {
    const capacity = capacities[fitted % capacities.length];
    if (capacity === undefined) {
      // Unreachable: capacities is never empty, and this indexes it the same way the world does.
      break;
    }
    const width = capacity * widthPerCapacity;
    if (x + width > buildingWidth) {
      break;
    }
    x += width + spacing;
    fitted += 1;
  }
  // Guards against a wider future capacity ceiling leaving a building with no elevators at all.
  const count = Math.max(fitted, 1);
  if (count !== requested) {
    console.warn(
      `Sandbox elevators ${String(requested)} do not fit the building at these capacities, using ${String(count)} instead`,
    );
  }
  return count;
}

/** Drops the capacities past the last car, so the sandbox's own description matches reality. */
function trimCapacities(capacities: readonly number[], elevatorCount: number): number[] {
  if (capacities.length <= elevatorCount) {
    return [...capacities];
  }
  const elevators = elevatorCount === 1 ? "elevator" : "elevators";
  console.warn(
    `Sandbox capacities lists ${String(capacities.length)} cars for ${String(elevatorCount)} ${elevators}, keeping the first ${String(elevatorCount)}`,
  );
  return capacities.slice(0, elevatorCount);
}

/** Clamps a sandbox parameter into range, warning if it changed. */
function clampSandboxValue(value: number, name: string, range: SandboxRange): number {
  const clamped = Math.min(Math.max(value, range.min), range.max);
  if (clamped !== value) {
    console.warn(
      `Sandbox ${name} ${String(value)} is outside ${String(range.min)}-${String(range.max)}, using ${String(clamped)} instead`,
    );
  }
  return clamped;
}

/**
 * Turns a sandbox parameter into a whole number inside its range.
 *
 * Fractions are refused rather than rounded, so a typo like `floors=8.5` doesn't silently
 * become 8 floors.
 */
function resolveSandboxInteger(
  value: string | undefined,
  name: string,
  range: SandboxRange,
  refuse: Refuse,
): number {
  if (value === undefined) {
    return range.fallback;
  }
  // Number, not parseInt: parseInt truncates ("12abc" -> 12, "1e9" -> 1) instead of refusing.
  // The empty string is refused explicitly, since Number("") is 0, not NaN.
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isInteger(parsed)) {
    console.warn(`Invalid ${name} "${value}", using ${String(range.fallback)} instead`);
    refuse(name);
    return range.fallback;
  }
  return clampSandboxValue(parsed, name, range);
}

/** Turns a sandbox parameter into a finite number inside its range. */
function resolveSandboxNumber(
  value: string | undefined,
  name: string,
  range: SandboxRange,
  refuse: Refuse,
): number {
  if (value === undefined) {
    return range.fallback;
  }
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    console.warn(`Invalid ${name} "${value}", using ${String(range.fallback)} instead`);
    refuse(name);
    return range.fallback;
  }
  return clampSandboxValue(parsed, name, range);
}

/**
 * Turns a `capacities` parameter into the list the world cycles over its cars.
 *
 * One bad entry rejects the whole list; dropping just that entry would shift every later
 * capacity onto a different elevator.
 */
function resolveElevatorCapacities(value: string | undefined, refuse: Refuse): number[] {
  const { fallback, min, max } = SANDBOX_LIMITS.elevatorCapacity;
  if (value === undefined) {
    return [fallback];
  }
  const parsed: number[] = [];
  for (const part of value.split(CAPACITY_SEPARATOR)) {
    const capacity = part.trim() === "" ? Number.NaN : Number(part);
    if (!Number.isInteger(capacity)) {
      console.warn(`Invalid capacities "${value}", using ${String(fallback)} instead`);
      refuse("capacities");
      return [fallback];
    }
    parsed.push(capacity);
  }
  const ceiling = SANDBOX_LIMITS.elevatorCount.max;
  if (parsed.length > ceiling) {
    console.warn(
      `Sandbox capacities lists ${String(parsed.length)} cars, but at most ${String(ceiling)} elevators can exist, keeping the first ${String(ceiling)}`,
    );
  }
  return parsed
    .slice(0, ceiling)
    .map((capacity) => clampSandboxValue(capacity, "capacity", { min, max, fallback }));
}

/**
 * Turns a `level` parameter into an index that exists.
 *
 * Read with `Number`, not `parseInt`, so `level=3abc` is refused instead of silently starting
 * level 3. The empty string needs no separate guard: `Number("")` is `0`, out of range already.
 */
function resolveChapter1Index(
  value: string | undefined,
  context: RouteContext,
  refuse: Refuse,
): number {
  if (value === undefined) {
    return 0;
  }
  const index = Number(value) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= context.chapter1LevelCount) {
    console.warn(`Invalid level "${value}", starting the first level instead`);
    refuse(LEVEL_KEY);
    return 0;
  }
  return index;
}

/** Turns a `timescale` parameter into a speed the world can actually run at. */
function resolveTimeScale(
  value: string | undefined,
  defaultTimeScale: number,
  refuse: Refuse,
): number {
  if (value === undefined) {
    return clampTimeScale(defaultTimeScale);
  }
  const timeScale = Number.parseFloat(value);
  if (!Number.isFinite(timeScale)) {
    console.warn(`Invalid timescale "${value}", using ${String(defaultTimeScale)} instead`);
    refuse("timescale");
    return clampTimeScale(defaultTimeScale);
  }
  return clampTimeScale(timeScale);
}

/**
 * How the `level` key has to be written to name what is being played, or `null` if it does not
 * need to be written at all.
 *
 * `null` means the address bar can drop the key: an absent `level` already means the first
 * level, so writing `level=1` would add a choice the player never made.
 */
function levelAddress(params: RouteParams): string | null {
  const { chapter1Index, tutorialIndex, chapter2Index } = params;
  if (tutorialIndex !== null) {
    return tutorialLevels[tutorialIndex]?.id ?? null;
  }
  if (chapter2Index !== null) {
    return chapter2Levels[chapter2Index]?.id ?? null;
  }
  return chapter1Index === 0 ? null : String(chapter1Index + 1);
}

/** Called with every route the player navigates to. */
export type RouteHandler = (params: RouteParams, query: RouteQuery) => void;

/** The part of a `Window` the router uses. */
export interface RouterTarget {
  /** The location whose hash is routed on. */
  readonly location: { readonly hash: string };
  /**
   * The session history the address bar is corrected through.
   *
   * Uses `replaceState`, not an assignment to `location.hash`: a correction must not become a
   * Back-button entry, and must not itself fire `hashchange` or `popstate`.
   */
  readonly history: {
    /** Whatever the page has stored on the current entry. */
    readonly state: unknown;
    /** Rewrites the URL of the current history entry; `unused` is the legacy title argument. */
    replaceState: (data: unknown, unused: string, url: string) => void;
  };
  /** Subscribes to a navigation event. */
  addEventListener(type: "hashchange" | "popstate", listener: () => void): void;
  /** Unsubscribes from a navigation event. */
  removeEventListener(type: "hashchange" | "popstate", listener: () => void): void;
}

/** Options accepted by {@link startRouter}. */
export interface RouterOptions {
  /** How many chapter one levels exist. */
  readonly chapter1LevelCount: number;
  /** Time scale to use when the URL does not ask for one; re-read on every navigation. */
  readonly defaultTimeScale: () => number;
  /** The window whose location and events to follow; defaults to `window`. */
  readonly target?: RouterTarget;
}

/**
 * Starts routing: calls the handler for the current URL and every later one, and corrects the
 * address bar to match what was actually resolved.
 *
 * A correction only drops or replaces refused keys, which resolve to the same route either way,
 * so it is safe to do without routing again. Listens for both `hashchange` and `popstate`,
 * since a browser can restore history without firing the former.
 */
export function startRouter(onRoute: RouteHandler, options: RouterOptions): () => void {
  const target = options.target ?? window;
  let lastHash: string | null = null;

  /** Takes the refused parameters out of the URL and out of the query. */
  const correct = (query: RouteQuery, params: RouteParams, renamed: boolean): RouteQuery => {
    const { refusedKeys } = params;
    if (refusedKeys.length === 0 && !renamed) {
      return query;
    }
    const address = levelAddress(params);
    const kept = new Map(query);
    for (const key of refusedKeys) {
      if (key === LEVEL_KEY && address !== null) {
        // Set, not deleted and re-added, so the corrected URL keeps the order it was written in.
        kept.set(key, address);
      } else {
        kept.delete(key);
      }
    }
    // Carries the entry's state across rather than passing null, which would discard it.
    target.history.replaceState(target.history.state, "", createParamsUrl(kept));
    // Read back rather than assumed: an empty hash becomes "#", so location.hash reads back as
    // "", and lastHash must match it or the next navigation back here is ignored as a repeat.
    lastHash = target.location.hash;
    return kept;
  };

  const handleRoute = (force: boolean): void => {
    const hash = target.location.hash;
    if (!force && hash === lastHash) {
      return;
    }
    lastHash = hash;
    const written = parseQuery(hash);
    // Renamed again here so the address bar stops saying the retired key too.
    const query = renameLegacyLevelKey(written);
    const params = resolveRoute(query, {
      chapter1LevelCount: options.chapter1LevelCount,
      defaultTimeScale: options.defaultTimeScale(),
    });
    onRoute(params, correct(query, params, query !== written));
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
