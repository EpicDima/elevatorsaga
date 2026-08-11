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
 *
 * The sandbox — `#challenge=sandbox`, plus `floors`, `elevators`, `capacities`
 * and `spawnrate` — is the reason that promise has to be kept for more than two
 * parameters: it is a whole world description written by hand into a URL that
 * is meant to be shared. {@link SANDBOX_LIMITS} says what each of them may be
 * and why.
 *
 * `seed` is the other half of a shared building: it pins the passengers the way
 * the sandbox parameters pin the shafts, and it is the one parameter that has to
 * come back out of the address bar byte for byte, since a seed that changed on
 * the way through is a seed that replays something else. {@link SEED_PATTERN}
 * says what survives that trip.
 */

import type { SandboxOptions } from "../game/challenges.ts";
import { clampTimeScale } from "./time-scale.ts";

/** Raw `key=value` pairs from the location hash, in the order they appeared. */
export type RouteQuery = ReadonlyMap<string, string>;

/** The validated parameters a route resolves to. */
export interface RouteParams {
  /**
   * Zero-based index into the challenge list.
   *
   * Meaningless while {@link sandbox} is set: the sandbox is not in the list.
   */
  readonly challengeIndex: number;
  /**
   * The building the sandbox was asked for, or `null` for a numbered challenge.
   *
   * Set when `challenge=sandbox`, which is why it displaces
   * {@link challengeIndex} rather than sitting beside it: the URL names one
   * thing to play, and this is the other thing it can name.
   */
  readonly sandbox: SandboxOptions | null;
  /** Whether the simulation should start without waiting for the Start button. */
  readonly autoStart: boolean;
  /** Simulation speed multiplier. */
  readonly timeScale: number;
  /** Whether to load the built-in reference solution. */
  readonly devTest: boolean;
  /** Whether to hide everything except the world. */
  readonly fullscreen: boolean;
  /**
   * The seed the world's building and passengers are built from, or `null` when
   * the URL pins none and the world should draw its own.
   *
   * The URL is the only thing that pins a seed, which is what makes the two
   * restart paths agree: see {@link "./app.ts"!App.handleRoute}.
   */
  readonly seed: string | null;
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
 * The `challenge` value that asks for the sandbox instead of a numbered
 * challenge.
 *
 * The sandbox reuses the `challenge` key rather than adding a `sandbox` flag of
 * its own, because that key is the one the challenge bar's navigation row
 * overwrites: every entry in the row is `createParamsUrl(query, { challenge: n
 * })`, so following one leaves the sandbox by construction, while the sandbox's
 * own parameters ride along in the hash, inert, and are still there if the
 * player comes back. Two keys — a `sandbox` flag *and* a `challenge` number —
 * would leave the row producing URLs that name both.
 */
export const SANDBOX_CHALLENGE = "sandbox";

/** The accepted range of a sandbox parameter, and what unusable input becomes. */
interface SandboxRange {
  /** Smallest value the simulation is allowed to run with. */
  readonly min: number;
  /** Largest value the simulation is allowed to run with. */
  readonly max: number;
  /** Used when the parameter is absent or cannot be read as a number. */
  readonly fallback: number;
}

/**
 * What the sandbox parameters are allowed to be.
 *
 * A hash is something anybody can hand-write, so every bound here is either a
 * value the simulation cannot survive or a value the page cannot draw:
 *
 * - **Floors.** Below two, `spawnUserRandomly` draws `randomInt(1, floorCount -
 *   1)`, which returns `1` for a one-floor building — a destination that does
 *   not exist, so every passenger waits forever for an elevator that can never
 *   arrive. The ceiling is the page: the building is drawn at a fixed 50px per
 *   floor with no scaling, so 60 floors is already a 3000px column, about three
 *   screens, and it is nearly three times the tallest shipped challenge (21).
 *   It also bounds the DOM, since every elevator carries one in-car button per
 *   floor: 60 floors and 12 cars is ~900 elements, where `floors=100000` would
 *   be several million and lock the tab up before the first frame.
 * - **Elevators.** At least one, or nobody is ever transported. At most twelve,
 *   which is what fits at the default capacity: the cars are laid out left to
 *   right from x=200 across a building 938px wide, so twelve 40px cars on a
 *   60px pitch end at x=900 and the thirteenth would be drawn through the wall.
 *   Wider cars fit fewer, so this is only the ceiling — {@link fitElevatorCount}
 *   lowers it once the capacities are known.
 * - **Capacity.** At least one seat, or the car cannot carry anyone; `0` is
 *   also the value `Elevator` reads as "unset" and silently turns into 4. At
 *   most 30, three times the largest shipped car: a car is drawn `capacity *
 *   10` pixels wide, so 30 is 300px, a third of the building, and two of them
 *   are as much as fits side by side — which is exactly what a `capacities=30`
 *   sandbox is then given, however many elevators it asked for.
 * - **Spawn rate.** The floor is not cosmetic. `World.update` runs `while
 *   (elapsedSinceSpawn > 1 / spawnRate)` and subtracts `1 / spawnRate` each
 *   time round, so a negative rate *adds* on every iteration and the loop never
 *   terminates — `#spawnrate=-1` would hang the tab on the first frame, exactly
 *   the class of bug this module exists to prevent — while `0` divides to
 *   `Infinity` and nobody ever appears. The ceiling is that passengers only
 *   leave the world when they are delivered: at 10 per second, more than three
 *   times the busiest shipped challenge, an unsolved building already grows
 *   without bound, and at 64x time scale that is 640 new DOM nodes per second
 *   of wall clock.
 *
 * The fallbacks are challenge 4's building — eight floors, two cars, capacity
 * four, 0.6 passengers a second — so a bare `#challenge=sandbox` starts
 * something known to be playable rather than something degenerate.
 */
const SANDBOX_LIMITS = {
  /** Floors in the building; `floors` in the URL. */
  floorCount: { min: 2, max: 60, fallback: 8 },
  /** Elevators serving them; `elevators` in the URL. */
  elevatorCount: { min: 1, max: 12, fallback: 2 },
  /** Passengers one car can hold; `capacities` in the URL. */
  elevatorCapacity: { min: 1, max: 30, fallback: 4 },
  /** Passengers appearing per simulated second; `spawnrate` in the URL. */
  spawnRate: { min: 0.01, max: 10, fallback: 0.6 },
} as const satisfies Record<string, SandboxRange>;

/**
 * Separates the per-elevator capacities in `capacities=4-10`.
 *
 * Not a comma: commas separate the `key=value` pairs of the hash itself, so a
 * comma-separated list would be parsed as three parameters named `capacities`,
 * `10` and `6`. A hyphen also makes a negative capacity unwriteable — `-4`
 * splits into an empty entry and a `4` — which is one less way to ask for a car
 * that cannot exist.
 */
const CAPACITY_SEPARATOR = "-";

/**
 * The geometry a sandbox building has to fit its elevators into.
 *
 * Mirrored rather than imported, because none of the three numbers is reachable
 * from here: `src/game/world.ts` keeps `FIRST_ELEVATOR_X` and `ELEVATOR_SPACING`
 * private, `Elevator` derives its width from its capacity inside its own
 * constructor, and the building's width is a CSS custom property. The sources
 * are named on each field so they can be checked by hand; the failure mode if
 * one of them moves is a sandbox that accepts a building slightly too wide, not
 * one that cannot run.
 */
const ELEVATOR_LAYOUT = {
  /** `--building-width` in `src/styles/style.css`: the shafts' drawing area. */
  buildingWidth: 938,
  /** `FIRST_ELEVATOR_X` in `src/game/world.ts`: x of the leftmost shaft. */
  firstElevatorX: 200,
  /** `ELEVATOR_SPACING` in `src/game/world.ts`: the gap between two shafts. */
  spacing: 20,
  /** `Elevator.width = maxUsers * 10`: how much width one seat adds to a car. */
  widthPerCapacity: 10,
} as const;

/**
 * Validates the raw parameters of a route.
 *
 * @param query - The parsed parameters.
 * @param context - The challenge count and the fallback time scale.
 * @returns Parameters that are always safe to act on.
 */
export function resolveRoute(query: RouteQuery, context: RouteContext): RouteParams {
  const challenge = query.get("challenge");
  const sandbox = isSandboxRoute(challenge) ? resolveSandboxOptions(query) : null;
  return {
    // Resolved, and so warned about, only when it is the one being played: a
    // sandbox URL never names a challenge number, and complaining that
    // "sandbox" is not one would be noise.
    challengeIndex: sandbox === null ? resolveChallengeIndex(challenge, context.challengeCount) : 0,
    sandbox,
    autoStart: readFlag(query, "autostart"),
    timeScale: resolveTimeScale(query.get("timescale"), context.defaultTimeScale),
    devTest: readFlag(query, "devtest"),
    fullscreen: readFlag(query, "fullscreen"),
    seed: resolveSeed(query.get("seed")),
  };
}

/**
 * How long a `seed` may be.
 *
 * Not the generator's limit — {@link "../game/random.ts"!createRandomSource}
 * hashes a seed of any length in one pass — but the page's. The seed rides in
 * the hash, and every entry of the challenge bar's navigation row is that hash
 * with `challenge` rewritten, so whatever is written here is written into the
 * document some twenty times over. Sixty-four characters is room for a generated
 * seed (ten digits), a UUID (thirty-six) or a label somebody can read down a
 * phone line, and far too few to bloat the bar.
 */
const SEED_MAX_LENGTH = 64;

/**
 * What a `seed` may contain: ASCII letters, digits, `.`, `-` and `_`.
 *
 * Narrow because the seed has to survive a round trip through the address bar
 * unchanged, and only an ASCII token does. A browser percent-encodes everything
 * else on its way into `location.hash` — a space becomes `%20` and a non-Latin
 * letter three bytes of `%xx` — so `#seed=rush hour` would come back as
 * `rush%20hour`, hash to something else entirely, and hand back a *different*
 * building to the player who shared the link. A comma cannot get here at all:
 * {@link parseQuery} splits on it. What is left still spells every generated
 * seed and every label worth typing.
 */
const SEED_PATTERN = /^[\w.-]+$/;

/**
 * Turns a `seed` parameter into something a run can be rebuilt from.
 *
 * Kept as the string the URL was written with, and never converted to a number
 * even though {@link "../game/random.ts"!RandomSeed} accepts both.
 * `createRandomSource` hashes `String(seed)`, so `5` and `"5"` are the same
 * stream and the conversion would buy nothing — while `Number` would quietly
 * rewrite what the URL says: `0123`, `1e3` and `0x10` would each replay a run
 * other than the one they name, `1e400` would become `Infinity`, and `abc` a
 * `NaN` that stringifies straight back into a seed nobody wrote. Staying a
 * string also keeps the human-readable labels `RandomSeed` documents (`issue-61`)
 * working, and makes the round trip exact: what the player typed is what the
 * world records is what the replay link prints back.
 *
 * The value is trimmed first because the hash format loses edge whitespace
 * asymmetrically — {@link parseQuery} trims each segment, so `#seed=5 ` arrives
 * as `5` while `#seed= 5` arrives as ` 5` — and two URLs that look the same must
 * not name two runs.
 *
 * Anything unusable is refused and replaced by a fresh seed rather than
 * repaired, for the reason `floors=8.5` is refused rather than rounded: a seed
 * is the one run it names or it is not that run at all, and quietly playing a
 * neighbouring one is how a player ends up debugging against a building nobody
 * can reproduce.
 *
 * @param value - The raw parameter, if it was present.
 * @returns The seed, or `null` to let the world draw its own.
 */
function resolveSeed(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const seed = value.trim();
  if (seed === "" || seed.length > SEED_MAX_LENGTH || !SEED_PATTERN.test(seed)) {
    console.warn(`Invalid seed "${value}", using a fresh one instead`);
    return null;
  }
  return seed;
}

/**
 * Whether a `challenge` parameter asks for the sandbox.
 *
 * @param value - The raw parameter, if it was present.
 * @returns Whether it names the sandbox, in any casing.
 */
function isSandboxRoute(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === SANDBOX_CHALLENGE;
}

/**
 * Reads the building a sandbox URL asks for.
 *
 * @param query - The parsed parameters.
 * @returns A building the simulation can run and the page can draw.
 */
function resolveSandboxOptions(query: RouteQuery): SandboxOptions {
  // Read in the order the parameters are written in the URL, so the warnings
  // come out in that order too. The elevator count and the capacities are the
  // one pair that cannot be resolved apart: how many cars fit depends on how
  // wide the capacities make them, and which capacities are ever used depends
  // on how many cars there are.
  const floorCount = resolveSandboxInteger(
    query.get("floors"),
    "floors",
    SANDBOX_LIMITS.floorCount,
  );
  const requestedElevators = resolveSandboxInteger(
    query.get("elevators"),
    "elevators",
    SANDBOX_LIMITS.elevatorCount,
  );
  const capacities = resolveElevatorCapacities(query.get("capacities"));
  const elevatorCount = fitElevatorCount(requestedElevators, capacities);
  return {
    floorCount,
    elevatorCount,
    elevatorCapacities: trimCapacities(capacities, elevatorCount),
    spawnRate: resolveSandboxNumber(query.get("spawnrate"), "spawnrate", SANDBOX_LIMITS.spawnRate),
  };
}

/**
 * Reduces an elevator count to the cars the building can actually hold.
 *
 * The shafts are laid out left to right from a fixed x, with no wrapping and no
 * scaling, and a car is as wide as its capacity — so how many fit is a question
 * about both parameters at once. Twelve fit at the default capacity of four;
 * only two fit at a capacity of thirty. Clamping the two independently would
 * accept `elevators=12,capacities=30`, whose cars are drawn straight through the
 * building's wall and off the edge of `.worldtrack`, which clips them: the
 * player would be given elevators that are simulated and controllable from their
 * program but cannot be seen.
 *
 * @param requested - The elevator count from the URL, already inside its range.
 * @param capacities - The capacities the world will cycle over the cars.
 * @returns How many of those cars fit, at least one.
 */
function fitElevatorCount(requested: number, capacities: readonly number[]): number {
  const { buildingWidth, firstElevatorX, spacing, widthPerCapacity } = ELEVATOR_LAYOUT;
  let x = firstElevatorX;
  let fitted = 0;
  while (fitted < requested) {
    const capacity = capacities[fitted % capacities.length];
    if (capacity === undefined) {
      // Unreachable: resolveElevatorCapacities never returns an empty list, and
      // the modulo is what the world itself indexes with. The check is here
      // because the index signature says otherwise, and stopping is the safe
      // reading of "there is no car to measure".
      break;
    }
    const width = capacity * widthPerCapacity;
    if (x + width > buildingWidth) {
      break;
    }
    x += width + spacing;
    fitted += 1;
  }
  // The widest car allowed is 300px against 738px of room, so the first one
  // always fits and this floor never bites today. It is here so that widening
  // the capacity ceiling later cannot quietly produce a building with no
  // elevators in it at all, which the world would run and nobody could play.
  const count = Math.max(fitted, 1);
  if (count !== requested) {
    console.warn(
      `Sandbox elevators ${String(requested)} do not fit the building at these capacities, using ${String(count)} instead`,
    );
  }
  return count;
}

/**
 * Drops the capacities that no elevator will be given.
 *
 * The world reads `capacities[i % capacities.length]` once per car, so entries
 * past the last car are never read and the building is the same with or without
 * them. The challenge bar is what makes them worth removing: it prints the list
 * it is handed, so `elevators=1,capacities=6-9` would otherwise be described as
 * one elevator "of capacities 6, 9" when the only car built has a capacity of
 * six.
 *
 * @param capacities - The capacities the URL asked for.
 * @param elevatorCount - How many cars the building will have.
 * @returns The capacities that reach a car.
 */
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

/**
 * Brings a sandbox parameter inside the range the simulation can run.
 *
 * @param value - The parsed, finite value.
 * @param name - The parameter's name in the URL, for the warning.
 * @param range - The accepted range.
 * @returns The value, clamped into the range.
 */
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
 * Fractions are refused rather than rounded: `floors=8.5` is a typo, and
 * quietly playing eight floors is how a player ends up debugging their program
 * against a building they did not ask for.
 *
 * @param value - The raw parameter, if it was present.
 * @param name - The parameter's name in the URL, for the warning.
 * @param range - The accepted range and the fallback.
 * @returns A whole number inside the range.
 */
function resolveSandboxInteger(
  value: string | undefined,
  name: string,
  range: SandboxRange,
): number {
  if (value === undefined) {
    return range.fallback;
  }
  // Number, not parseInt: parseInt reads "12abc" as 12 and stops at the "e" of
  // "1e9", so it takes junk and silently truncates exponents. Number refuses
  // the junk and reads the exponent, along with the other unambiguous forms
  // JavaScript understands -- "1e3", "0x10", " 8 " -- which are then clamped
  // like anything else. The empty string is refused explicitly, because
  // Number("") is 0 rather than NaN.
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isInteger(parsed)) {
    console.warn(`Invalid ${name} "${value}", using ${String(range.fallback)} instead`);
    return range.fallback;
  }
  return clampSandboxValue(parsed, name, range);
}

/**
 * Turns a sandbox parameter into a finite number inside its range.
 *
 * @param value - The raw parameter, if it was present.
 * @param name - The parameter's name in the URL, for the warning.
 * @param range - The accepted range and the fallback.
 * @returns A finite number inside the range.
 */
function resolveSandboxNumber(
  value: string | undefined,
  name: string,
  range: SandboxRange,
): number {
  if (value === undefined) {
    return range.fallback;
  }
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    console.warn(`Invalid ${name} "${value}", using ${String(range.fallback)} instead`);
    return range.fallback;
  }
  return clampSandboxValue(parsed, name, range);
}

/**
 * Turns a `capacities` parameter into the list the world cycles over its cars.
 *
 * One bad entry rejects the whole list rather than being dropped: dropping it
 * would shift every capacity after it onto a different elevator, so the player
 * would get a building that is wrong in a way the description still reports as
 * what they asked for.
 *
 * The list is cut down to the elevator ceiling before anything is clamped, so
 * that a hash listing ten thousand cars costs ten thousand `Number` calls and
 * not ten thousand console warnings. {@link trimCapacities} cuts it again once
 * the real elevator count is known.
 *
 * @param value - The raw parameter, if it was present.
 * @returns At least one capacity, each inside the accepted range.
 */
function resolveElevatorCapacities(value: string | undefined): number[] {
  const { fallback, min, max } = SANDBOX_LIMITS.elevatorCapacity;
  if (value === undefined) {
    return [fallback];
  }
  const parsed: number[] = [];
  for (const part of value.split(CAPACITY_SEPARATOR)) {
    const capacity = part.trim() === "" ? Number.NaN : Number(part);
    if (!Number.isInteger(capacity)) {
      console.warn(`Invalid capacities "${value}", using ${String(fallback)} instead`);
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
