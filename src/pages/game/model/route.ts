/**
 * Turning a parsed hash into the parameters the game page acts on, and
 * keeping that done as the player navigates.
 *
 * {@link "#shared/lib/route-query.ts"!parseQuery} only splits a hash into
 * `key=value` pairs; nothing there knows a `level` from a `seed`, or that
 * `floors=100000` cannot be drawn. That is this module's job: {@link
 * resolveRoute} reads every parameter the game supports, validates or
 * defaults each one, and hands back something always safe to act on —
 * {@link RouteParams}. {@link startRouter} is the part that keeps doing this
 * on every navigation, and corrects the address bar to match.
 *
 * The legacy parser was `path.split(",")` with `/(\w+)=(\w+$)/` per segment
 * and no validation of what came out, which made two malformed URLs fatal:
 *
 * - `#level=abc` produced `_.parseInt("abc") - 1`, i.e. `NaN`. `NaN < 0`
 *   and `NaN >= challenges.length` are both false, so the range check passed
 *   it through to `challenges[NaN].options` and the page died with a
 *   TypeError before anything was drawn.
 * - `#timescale=abc` produced `parseFloat("abc")`, i.e. `NaN`, which became
 *   the world's time scale. Every simulated `dt` was then `NaN` and the world
 *   froze, with no way back short of editing the URL by hand.
 *
 * Everything is validated here instead, and anything unusable falls back to a
 * default.
 *
 * The sandbox — `#level=sandbox`, plus `floors`, `elevators`, `capacities`
 * and `spawnrate` — is the reason that promise has to be kept for more than two
 * parameters: it is a whole world description written by hand into a URL that
 * is meant to be shared. {@link SANDBOX_LIMITS} says what each of them may be
 * and why.
 *
 * The learning track — `#level=tutorial-1` … `#level=tutorial-8` — is
 * the third thing that one key can name, and the only one whose values are not
 * invented here: they are the identifiers the tasks carry in
 * {@link "#game/tutorial.ts"!tutorialTasks}. {@link resolveTutorialIndex}
 * says what that buys and what a misspelled task address does instead.
 *
 * `seed` is the other half of a shared building: the sandbox parameters pin the
 * shafts and `seed` pins who walks into them — and, played the same way, every
 * tick of the run they walk into, which is what `game.seed.explanation` in the
 * message catalogues promises. It is also the one parameter that has to come
 * back out of the address bar byte for byte, since a seed that changed on the
 * way through draws somebody else.
 * {@link "#shared/lib/seed.ts"!SEED_PATTERN} says what survives that trip.
 *
 * One of those validations is not about whether a value can be read but about
 * whether it may be acted on: a numbered challenge has to be one this player
 * has unlocked. Until it was checked here, the level switcher drew challenge 18
 * shut and `#level=18` opened it anyway, which made the progression an
 * opinion the interface held rather than a rule the game had.
 * {@link fallBackToOpenChallenge} is the whole of the answer to such an
 * address, and the rule it defers to belongs to
 * {@link "#features/switch-level/index.ts"!isChallengeLocked} rather than to
 * this file.
 *
 * The key that names all three used to be spelled `challenge`, which is what
 * every link ever shared out of this game says. {@link LEGACY_LEVEL_KEY} and
 * {@link renameLegacyLevelKey} are how those links go on working: the old
 * spelling is read wherever the new one would be and rewritten out of the
 * address bar on arrival, so nobody is stranded and nothing goes on being
 * written in a name the game no longer uses.
 */

import type { SandboxOptions } from "#game/challenges.ts";
// The one thing this module takes from `src/game/` as a value rather than a
// type, and it is imported rather than handed in through {@link RouteContext}
// because it is not a choice a caller makes: there is exactly one learning
// track, and the addresses that open its tasks are the `id`s written in this
// table. A count in the context would let a caller claim a number of tasks that
// do not exist, and the ids cannot be passed through a context at all without
// moving the table into one.
//
// This used to buy a cycle -- `game/tutorial.ts` -> `game/challenges.ts` ->
// `i18n/index.ts` -> `i18n/detect.ts` -> back into this file for `parseQuery`
// -- from the days `parseQuery` and this table shared one module. Splitting the
// hash grammar out to {@link "#shared/lib/route-query.ts"} broke it:
// `i18n/detect.ts` now reaches a module that imports nothing of its own, so
// nothing on that path leads back to this file, and nothing that reaches for
// `parseQuery` alone -- `i18n/detect.ts`, and through it the fitness worker --
// pulls this table into its chunk anymore. `app.ts` pays for it regardless,
// since it imports the table itself to play a task.
import { tutorialTasks } from "#game/tutorial.ts";
import { clampTimeScale } from "#features/adjust-speed/model/time-scale.ts";
import { createParamsUrl, parseQuery, type RouteQuery } from "#shared/lib/route-query.ts";
import { isUsableSeed } from "#shared/lib/seed.ts";

/** The validated parameters a route resolves to. */
export interface RouteParams {
  /**
   * Zero-based index into the challenge list.
   *
   * Meaningless while {@link sandbox} or {@link tutorialIndex} is set: neither
   * the sandbox nor a task of the learning track is in that list.
   */
  readonly challengeIndex: number;
  /**
   * The building the sandbox was asked for, or `null` for a numbered challenge.
   *
   * Set when `level=sandbox`, which is why it displaces
   * {@link challengeIndex} rather than sitting beside it: the URL names one
   * thing to play, and this is the other thing it can name.
   */
  readonly sandbox: SandboxOptions | null;
  /**
   * The learning-track task asked for, or `null` for anything else.
   *
   * A zero-based index into {@link "#game/tutorial.ts"!tutorialTasks}, so
   * `level=tutorial-3` is `2`. Set when `level` names a task, and never
   * at the same time as {@link sandbox}: those are two of the three things one
   * key can name, and no value spells both.
   */
  readonly tutorialIndex: number | null;
  /** Simulation speed multiplier. */
  readonly timeScale: number;
  /** Whether to hide everything except the world. */
  readonly fullscreen: boolean;
  /**
   * The seed the world draws its passengers from, or `null` when the URL pins
   * none and the world should draw its own.
   *
   * Not the building: floors, elevators and capacities come from the challenge
   * or the sandbox parameters, and the seed has no say in them.
   *
   * The URL is the only thing that pins a seed, which is what makes the two
   * restart paths agree: see {@link "../index.ts"!App.handleRoute}.
   *
   * Always `null` while {@link tutorialIndex} is set, however far the URL goes
   * to ask otherwise — a task plays the seed its own entry pins and no other.
   * {@link resolveRoute} explains what a seed of the player's choosing would
   * cost the track.
   */
  readonly seed: string | null;
  /**
   * The keys the URL named and the router would not use, in the order they
   * were read.
   *
   * Collected as the parameters are resolved rather than worked out afterwards,
   * because a refusal and an absence resolve to the same value: `level=abc`
   * and no `level` at all both mean the first challenge, and only the
   * resolver knows which of the two it just saw.
   *
   * Every key in here resolved to exactly what the corrected URL resolves to,
   * which is what makes correcting the address bar a rewrite that changes no
   * route. For most that means the key is simply deleted, since its absence
   * and its refusal come to the same thing. The exceptions are both spellings
   * of `level` that land somewhere absence does not spell: a task address
   * the router could not read, which starts the first task of the learning
   * track, and a challenge this player has not unlocked, which starts the
   * nearest one they have. Those are rewritten rather than dropped.
   * {@link startRouter} does both, and says why the address bar is corrected
   * at all rather than left describing a run that is not being played.
   *
   * A value that was *clamped* is not in here. `floors=100000` still names the
   * building on screen — it resolves to sixty floors every time it is read, and
   * the bar prints sixty — whereas `seed=rush%20hour` names nothing and draws a
   * different stranger on every reload.
   */
  readonly refusedKeys: readonly string[];
}

/**
 * Records a parameter the router would not use, so the URL can stop naming it.
 *
 * Passed down to each resolver instead of having them return a richer result,
 * because the resolvers are also what warn about a refusal: the two facts are
 * recorded in the same place, and one cannot be forgotten while the other is
 * remembered.
 *
 * @param key - The parameter's name in the URL.
 */
type Refuse = (key: string) => void;

/** Everything {@link resolveRoute} needs besides the URL itself. */
export interface RouteContext {
  /** How many challenges exist; bounds the `level` parameter. */
  readonly challengeCount: number;
  /** Time scale to use when the URL does not ask for one. */
  readonly defaultTimeScale: number;
  /**
   * Whether a challenge is still shut to this player.
   *
   * Handed in rather than worked out here, for the reason
   * {@link challengeCount} is: what a browser has cleared is stored state, and
   * this module reads a URL. `src/main.ts` supplies
   * {@link "#features/switch-level/index.ts"!isChallengeLocked} over this
   * browser's own record, which is the same call the level switcher makes to
   * decide which tiles to draw shut.
   *
   * Asked on every route rather than once, because the answer moves while the
   * page is open: clearing a challenge unlocks the next one, and the "Next
   * level" link in the verdict card is followed a moment later.
   *
   * @param index - Zero-based index of the challenge, already known to exist.
   * @returns Whether it refuses to open.
   */
  readonly isChallengeLocked: (index: number) => boolean;
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
 * The hash key that names what is being played: a level number, the sandbox, or
 * a task of the learning track.
 *
 * One key for all three, and the reason is the level switcher: every entry it
 * draws is `createParamsUrl(query, { level: … })`, so following any of them
 * replaces whatever the last one named and no second key can be left behind
 * describing a run nobody is playing.
 */
export const LEVEL_KEY = "level";

/**
 * How {@link LEVEL_KEY} was spelled until the game started calling its
 * challenges levels.
 *
 * Read, never written. Every link ever shared out of this game — and the ones
 * in `README.md` and the documentation pages that were written before the
 * rename — says `challenge=`, and a hash is the whole of this game's shareable
 * state: an address that stopped working would be a bookmark that stopped
 * working. {@link renameLegacyLevelKey} is where it is honoured, and
 * {@link startRouter} is what takes it back out of the address bar afterwards,
 * so a link followed once goes on being shared under the name the game uses now.
 */
export const LEGACY_LEVEL_KEY = "challenge";

/**
 * The {@link LEVEL_KEY} value that asks for the sandbox instead of a numbered
 * challenge.
 *
 * The sandbox reuses that key rather than adding a `sandbox` flag of its own,
 * because it is the one the level switcher's entries overwrite: following one
 * leaves the sandbox by construction, while the sandbox's own parameters ride
 * along in the hash, inert, and are still there if the player comes back. Two
 * keys — a `sandbox` flag *and* a level number — would leave the row producing
 * URLs that name both.
 */
export const SANDBOX_CHALLENGE = "sandbox";

/**
 * What every {@link LEVEL_KEY} value that names a learning-track task starts
 * with.
 *
 * The whole of the router's copy of how a task address is spelled. The rest is
 * the table's: an address is accepted because it *is* the `id` of a task in
 * {@link "#game/tutorial.ts"!tutorialTasks} — `tutorial-1` … `tutorial-8`
 * today — and not because it matches a shape invented here.
 *
 * The prefix is what tells a mistyped task address from a challenge number, so
 * that `tutorial-9` is a wrong address on the track rather than a wrong
 * challenge, and lands where the player was heading. It is the one thing that
 * has to stay in step with the ids by hand; `route.test.ts` checks that it
 * does, because a task renamed out of this shape would become unreachable
 * rather than merely oddly named.
 *
 * Reuses {@link LEVEL_KEY} for the same reason {@link SANDBOX_CHALLENGE} does:
 * it is the key the level switcher's entries overwrite, so every one of them is
 * already the way out of the track, and no second key can be left behind naming
 * a task nobody is playing.
 */
export const TUTORIAL_CHALLENGE_PREFIX = "tutorial-";

/**
 * Reads a hash written with {@link LEGACY_LEVEL_KEY} as one written with
 * {@link LEVEL_KEY}.
 *
 * Renamed in place rather than appended, so a corrected URL still reads in the
 * order it was written — `#challenge=5,timescale=8` becomes
 * `#level=5,timescale=8` and not `#timescale=8,level=5`. A hash naming both
 * keeps the modern one and drops the legacy one: `level` is what this game
 * writes, so it is the one the player's last click chose, and a link carrying
 * both would otherwise turn into two spellings of one parameter every time it
 * was followed.
 *
 * Returns the very query it was given when there is no legacy key to rename,
 * which is what {@link startRouter} compares against to decide whether the
 * address bar needs correcting at all.
 *
 * @param query - The parameters as the URL wrote them.
 * @returns The same parameters under the name the game reads now.
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
 * - **Spawn rate.** The floor is not cosmetic, though it is no longer what
 *   stands between `#spawnrate=-1` and a frozen tab: the
 *   {@link "#game/world.ts"!World} constructor now refuses a rate the spawn
 *   loop could not finish running and turns it into "nobody arrives". What the
 *   floor is for here is that "nobody arrives" is a poor answer to give
 *   somebody who asked for a busy building and mistyped the sign. Clamping is
 *   the better one at this end, where the value is still something a person
 *   typed into an address bar rather than a number the engine has to survive.
 *   The ceiling is that passengers only leave the world when they are
 *   delivered: at 10 per second, more than three times the busiest shipped
 *   challenge, an unsolved building already grows without bound, and at 64x
 *   time scale that is 640 new DOM nodes per second of wall clock.
 *
 * The fallbacks are challenge 4's building — eight floors, two cars, capacity
 * four, 0.6 passengers a second — so a bare `#level=sandbox` starts
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
  /** `--building-width` in `src/shared/styles/tokens.css`: the shafts' drawing area. */
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
export function resolveRoute(rawQuery: RouteQuery, context: RouteContext): RouteParams {
  const refusedKeys: string[] = [];
  const refuse: Refuse = (key) => {
    refusedKeys.push(key);
  };
  // Here as well as in `startRouter`, which does it to find out whether the
  // address bar needs rewriting: this is a public entry point, and a caller
  // handing it a hash somebody wrote years ago should get the run that hash
  // names rather than the first level.
  const query = renameLegacyLevelKey(rawQuery);
  const challenge = query.get(LEVEL_KEY);
  // Before resolveChallengeIndex, and the reason the two guards come first: it
  // reads its value with `Number`, which makes "sandbox" and "tutorial-3" alike
  // into NaN, i.e. into a refusal and challenge one. Whichever of the three the
  // key names has to be decided before any of them is parsed as a number.
  const tutorialIndex = isTutorialRoute(challenge) ? resolveTutorialIndex(challenge, refuse) : null;
  const sandbox = isSandboxRoute(challenge) ? resolveSandboxOptions(query, refuse) : null;
  return {
    // Resolved, and so warned about, only when it is the one being played:
    // neither a sandbox URL nor a task address names a challenge number, and
    // complaining that "sandbox" or "tutorial-3" is not one would be noise.
    challengeIndex:
      sandbox === null && tutorialIndex === null
        ? resolveChallengeIndex(challenge, context, refuse)
        : 0,
    sandbox,
    tutorialIndex,
    timeScale: resolveTimeScale(query.get("timescale"), context.defaultTimeScale, refuse),
    fullscreen: readFlag(query, "fullscreen"),
    // A task plays the seed its own entry pins, so a seed on a task address is
    // refused rather than honoured. The track teaches by letting a program fail
    // in front of the player, and which program fails is a fact about the
    // stream: task 5's starting sweep is measured winning on `42a`, and
    // `STARTING_CODE_WINS` in `tutorial-solutions.test.ts` records it as
    // survivable only because "the pinned seed, the only one anybody plays, is
    // not" such a seed. `#level=tutorial-5,seed=42a` is that sentence
    // stopped being true, and a player watching the broken program win learns
    // the opposite of the lesson.
    seed:
      tutorialIndex === null
        ? resolveSeed(query.get("seed"), refuse)
        : refuseSeedOnTrack(query, refuse),
    refusedKeys,
  };
}

/**
 * Turns a `seed` parameter into something a run can be rebuilt from.
 *
 * Kept as the string the URL was written with, and never converted to a number
 * even though {@link "#game/random.ts"!RandomSeed} accepts both.
 * `createRandomSource` hashes `String(seed)`, so `5` and `"5"` are the same
 * stream and the conversion would buy nothing — while `Number` would quietly
 * rewrite what the URL says: `0123`, `1e3` and `0x10` would each draw a run
 * other than the one they name, `1e400` would become `Infinity`, and `abc` a
 * `NaN` that stringifies straight back into a seed nobody wrote. Staying a
 * string also keeps the human-readable labels `RandomSeed` documents (`issue-61`)
 * working, and makes the round trip exact: what the player typed is what the
 * world records is what the link in the bar offers back.
 *
 * Taken exactly as {@link "#shared/lib/route-query.ts"!parseQuery} hands it
 * over. It used to be trimmed here, and the reason given was that a URL
 * written with a trailing space reaches `location.hash` with the space still
 * in it. That does not happen: U+0020 is in the fragment percent-encode set,
 * so a browser writes `%20` instead, whichever way the URL was navigated to —
 * which is the same fact {@link "#shared/lib/seed.ts"!SEED_PATTERN} is built
 * on, and the two comments could not both be true. What whitespace tolerance the format has
 * belongs to `parseQuery`, which has it for every parameter and can say
 * honestly who it is for.
 *
 * Anything unusable is refused and replaced by a fresh seed rather than
 * repaired, for the reason `floors=8.5` is refused rather than rounded: a seed
 * is the one passenger stream it names or it is not that stream at all, and
 * quietly playing a neighbouring one is how a player ends up debugging against
 * a run nobody can reproduce. What counts as usable is
 * {@link "#shared/lib/seed.ts"!isUsableSeed}, and it is read from there rather
 * than stated here because the settings panel's own seed field asks the same
 * question of the same string a moment earlier.
 *
 * @param value - The raw parameter, if it was present.
 * @param refuse - Records the key when the value cannot be used.
 * @returns The seed, or `null` to let the world draw its own.
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

/**
 * Drops a `seed` that arrived on a task address, and says so.
 *
 * Refused rather than resolved, because on the track a seed is not the player's
 * to choose: each task pins one in {@link "#game/tutorial.ts"!tutorialTasks},
 * and the tasks are only teachable because of it. A task shows a program
 * failing and then the one change that fixes it, and whether the program fails
 * is a property of the passenger stream, not of the program alone — task 5's
 * starting sweep is measured delivering all fifteen inside the wait limit on
 * seed `42a`, and on 76 of 400 seeds besides. Honouring `seed=` would let a
 * player land, by choice or by a copied link, on a run where the broken program
 * wins and the lesson reads backwards.
 *
 * The whole key is refused, so {@link startRouter} takes it back out of the
 * address bar, which is the honest signal: the URL then says what is actually
 * being played. This is the one refusal that is not about an unusable value —
 * `seed=abc` is perfectly good everywhere else in the game, and the warning says
 * where it went rather than that it was wrong.
 *
 * Silent when there is no `seed` at all, which is every ordinary visit to a
 * task: there is nothing to tell the player about a key they did not write.
 *
 * @param query - The parsed hash, read only for `seed`.
 * @param refuse - Records the key so the address bar loses it.
 * @returns Always `null`; the task's own seed is applied downstream.
 */
function refuseSeedOnTrack(query: RouteQuery, refuse: Refuse): null {
  const value = query.get("seed");
  if (value !== undefined) {
    console.warn(`Ignoring seed "${value}": a tutorial level plays its own pinned seed`);
    refuse("seed");
  }
  return null;
}

/**
 * Whether a `level` parameter asks for the sandbox.
 *
 * Case is folded and whitespace is not, because whitespace has already gone:
 * {@link "#shared/lib/route-query.ts"!parseQuery} strips it from every key and
 * every value as it reads them, which is the point of "ignores whitespace
 * around a key and around a value" owning that rule alone. A `trim()` here
 * would be a second answer to a question already settled, and an untested one
 * — nothing can reach it to prove it works.
 *
 * @param value - The parsed parameter, if it was present.
 * @returns Whether it names the sandbox, in any casing.
 */
function isSandboxRoute(value: string | undefined): boolean {
  return value?.toLowerCase() === SANDBOX_CHALLENGE;
}

/**
 * Whether a `level` parameter asks for a task of the learning track.
 *
 * True of every value spelled like a task address, not only of the eight that
 * open a task: `tutorial-9` and `tutorial-` are answered by
 * {@link resolveTutorialIndex}, which starts the track, rather than by
 * {@link resolveChallengeIndex}, which would start challenge one.
 *
 * Folded exactly where {@link isSandboxRoute} folds "sandbox" — here, as the
 * value is read, and not in `parseQuery` for every parameter at once — so
 * `#CHALLENGE=TUTORIAL-3` opens task 3 while `seed=Abc` stays the stream it
 * names.
 *
 * Narrows its argument rather than answering a plain `boolean`, so that the
 * resolver it guards can take the string it is handed instead of restating a
 * case this branch has already decided.
 *
 * @param value - The parsed parameter, if it was present. Already free of
 * surrounding whitespace; see {@link isSandboxRoute} for why none is stripped
 * again here.
 * @returns Whether it names a task of the track, in any casing.
 */
function isTutorialRoute(value: string | undefined): value is string {
  return value?.toLowerCase().startsWith(TUTORIAL_CHALLENGE_PREFIX) === true;
}

/**
 * Turns a `level=tutorial-…` parameter into a task that exists.
 *
 * Matched against the `id` each task carries rather than parsed as a number,
 * which is what {@link "#game/tutorial.ts"!TutorialTask.id} exists for: the
 * position of a task in the table is the one thing about it expected to change,
 * and an address resolved by position would hand somebody who bookmarked
 * `tutorial-3` whichever task had since been inserted above it. That the ids
 * happen to spell their positions today is a fact about the table, not a rule
 * imposed here — and it is also where the eight comes from, since the addresses
 * that work are exactly the entries there are.
 *
 * The match is exact, which is what decides the values a number would have read
 * loosely. `tutorial-01` and `tutorial-1e0` are refused: both are ways of
 * writing the number one, and neither is a way of writing the *name*
 * `tutorial-1`. So are `tutorial-` and `tutorial- 1`, which `Number` reads as
 * `0` and `1` — the two traps {@link resolveSandboxInteger} and
 * {@link resolveChallengeIndex} guard against on the other side of this branch.
 * A name is worth having precisely because it is compared and not computed, and
 * a task the URL does not spell is a task the player did not ask for.
 *
 * Anything unreadable lands on the first task rather than the first challenge:
 * somebody who wrote `tutorial-9` asked for the track, and where the track
 * starts is the closest thing to what they asked for. The warning is what makes
 * that a refusal rather than a silent success, since the first task is also
 * where `tutorial-1` lands. {@link startRouter} then writes the first task's
 * address into the bar, because deleting the key would put them on a challenge.
 *
 * @param value - The parsed parameter, already known to be spelled like a task
 * and already free of surrounding whitespace; see {@link isSandboxRoute}.
 * @param refuse - Records the key when the value cannot be used.
 * @returns A zero-based index into `tutorialTasks`; `0` for anything unusable.
 */
function resolveTutorialIndex(value: string, refuse: Refuse): number {
  const id = value.toLowerCase();
  const index = tutorialTasks.findIndex((task) => task.id === id);
  if (index === -1) {
    console.warn(`Invalid tutorial level "${value}", starting the first one instead`);
    refuse(LEVEL_KEY);
    return 0;
  }
  return index;
}

/**
 * Reads the building a sandbox URL asks for.
 *
 * @param query - The parsed parameters.
 * @param refuse - Records each key whose value cannot be used.
 * @returns A building the simulation can run and the page can draw.
 */
function resolveSandboxOptions(query: RouteQuery, refuse: Refuse): SandboxOptions {
  // Read in the order the parameters are written in the URL, so the warnings
  // come out in that order too. The elevator count and the capacities are the
  // one pair that cannot be resolved apart: how many cars fit depends on how
  // wide the capacities make them, and which capacities are ever used depends
  // on how many cars there are.
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
 * @param refuse - Records the key when the value cannot be used.
 * @returns A whole number inside the range.
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
  // Number, not parseInt: parseInt reads "12abc" as 12 and stops at the "e" of
  // "1e9", so it takes junk and silently truncates exponents. Number refuses
  // the junk and reads the exponent, along with the other unambiguous forms
  // JavaScript understands -- "1e3", "0x10", " 8 " -- which are then clamped
  // like anything else. The empty string is refused explicitly, because
  // Number("") is 0 rather than NaN.
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isInteger(parsed)) {
    console.warn(`Invalid ${name} "${value}", using ${String(range.fallback)} instead`);
    refuse(name);
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
 * @param refuse - Records the key when the value cannot be used.
 * @returns A finite number inside the range.
 */
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
 * @param refuse - Records the key when the value cannot be used.
 * @returns At least one capacity, each inside the accepted range.
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
 * Read with `Number`, as every other number in the hash is, and not with
 * `parseInt`. `parseInt` reads as far as it understands and stops without
 * complaint, so `level=3abc` started challenge 3 and `level=1e9`
 * started challenge 1 — and the second looked like a refusal, because the first
 * challenge is also where a refusal lands. A refusal nobody can tell apart from
 * a success is one nobody can act on: no warning was printed, and the URL went
 * on saying something the game had not done. `Number` reads the whole string or
 * nothing, so both are refused now, and said so.
 *
 * The empty string needs no guard of its own here, unlike in the sandbox
 * resolvers: `Number("")` is `0`, and challenge zero does not exist, so the
 * range check below refuses it along with everything else out of range.
 *
 * A challenge that exists is not yet a challenge this player may open, and the
 * second check is the one that closes what used to be a hole: the level
 * switcher draws a challenge shut until the one before it has been cleared,
 * and typing `#level=18` opened it anyway. A URL is not a way around the
 * game's own progression — {@link fallBackToOpenChallenge} says where such an
 * address lands instead.
 *
 * @param value - The raw parameter, if it was present.
 * @param context - The challenge count and this browser's locking rule.
 * @param refuse - Records the key when the value cannot be used.
 * @returns A zero-based index that exists and is open; `0` for anything
 * unusable.
 */
function resolveChallengeIndex(
  value: string | undefined,
  context: RouteContext,
  refuse: Refuse,
): number {
  if (value === undefined) {
    return 0;
  }
  const index = Number(value) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= context.challengeCount) {
    console.warn(`Invalid level "${value}", starting the first level instead`);
    refuse(LEVEL_KEY);
    return 0;
  }
  if (context.isChallengeLocked(index)) {
    return fallBackToOpenChallenge(value, index, context.isChallengeLocked, refuse);
  }
  return index;
}

/**
 * Answers an address for a locked challenge with the nearest one that is open.
 *
 * Walks *back* from what was asked for, never forward, and stops at the first
 * challenge that opens — which is as far along the row as this player has
 * earned on the way to their destination. Walking forward could hand somebody
 * a challenge further on than the one they were refused, which is the same
 * hole with an extra step in it; and there is always somewhere to land, since
 * the first challenge is open to everyone.
 *
 * Nothing here assumes the open challenges are a run from the first: a browser
 * that cleared challenge 6 alone, back when every challenge was reachable from
 * the row, has challenge 7 open and 2 through 6 shut, and an address for 12
 * lands on 7. See
 * {@link "#features/switch-level/index.ts"!isChallengeLocked} for why a record
 * can look like that.
 *
 * The key is refused, so the address bar stops naming a challenge nobody is
 * playing — {@link startRouter} rewrites it to the one that opened rather than
 * deleting it, since deleting would say "challenge one" and that is a third
 * place the player never asked to be.
 *
 * @param value - The raw parameter, for the warning.
 * @param index - The locked challenge that was asked for.
 * @param isChallengeLocked - This browser's locking rule.
 * @param refuse - Records the key so the address bar loses the refused number.
 * @returns The nearest open challenge at or before `index`.
 */
function fallBackToOpenChallenge(
  value: string,
  index: number,
  isChallengeLocked: (index: number) => boolean,
  refuse: Refuse,
): number {
  let open = index;
  while (open > 0 && isChallengeLocked(open)) {
    open -= 1;
  }
  console.warn(
    `Level "${value}" has not been unlocked yet, starting level ${String(open + 1)} instead`,
  );
  refuse(LEVEL_KEY);
  return open;
}

/**
 * Turns a `timescale` parameter into a speed the world can actually run at.
 *
 * @param value - The raw parameter, if it was present.
 * @param defaultTimeScale - The time scale to use when there is no parameter.
 * @param refuse - Records the key when the value cannot be used.
 * @returns A finite, positive time scale.
 */
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
 * How the `level` key has to be written to name what is being played, or
 * `null` when it does not have to be written at all.
 *
 * The whole of {@link startRouter}'s "delete or rewrite" decision. `null` means
 * delete: the first challenge is what an absent key already spells, and a
 * correction that wrote `level=1` would be putting a choice into the
 * address bar the player never made. Anything else is a landing absence cannot
 * spell, and gets written out.
 *
 * The task's id is looked up rather than hard-coded to the first task's, though
 * today those are the same thing and no test can tell them apart:
 * `resolveTutorialIndex` is the only thing that refuses a `level` on the
 * track, and it refuses only in the branch where it has already fallen back to
 * `0`. Written generally anyway, because the day a task is refused for some
 * reason other than being unspellable — not yet unlocked, say, or withdrawn —
 * `tutorialTasks[0]` would quietly write the first task's address over whatever
 * they were actually given, and the URL would go back to lying about the run.
 * That is the failure the correction exists to prevent, so it should not depend
 * on which refusals happen to exist. The numbered challenge below is exactly
 * that day arriving on the other branch.
 *
 * There is no sandbox case, and it is not an omission: `level=sandbox` is
 * decided before any of the three values is parsed, so nothing on that route
 * ever calls {@link resolveChallengeIndex} and `level` cannot be among a
 * sandbox route's refusals.
 *
 * @param params - What the route resolved to.
 * @returns The value to write, or `null` to drop the key.
 */
function challengeAddress(params: RouteParams): string | null {
  const { challengeIndex, tutorialIndex } = params;
  if (tutorialIndex !== null) {
    return tutorialTasks[tutorialIndex]?.id ?? null;
  }
  return challengeIndex === 0 ? null : String(challengeIndex + 1);
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
   * `replaceState` and not an assignment to `location.hash`: the correction is
   * not somewhere the player went, so it must not become an entry the Back
   * button returns to — pressing Back would land on the URL that was just
   * refused, be corrected again, and never get past it. It also fires neither
   * `hashchange` nor `popstate`, so the correction cannot route a second time.
   */
  readonly history: {
    /** Whatever the page has stored on the current entry. */
    readonly state: unknown;
    /**
     * Rewrites the URL of the current history entry.
     *
     * @param data - State to leave on the entry.
     * @param unused - The legacy title argument, which no browser reads.
     * @param url - The new URL, resolved against the current one.
     */
    replaceState: (data: unknown, unused: string, url: string) => void;
  };
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
  /**
   * Whether a challenge is still shut to this player.
   *
   * Re-read on every navigation for the reason {@link RouteContext.isChallengeLocked}
   * gives: a challenge cleared a moment ago is a challenge that opens now.
   *
   * @param index - Zero-based index of the challenge, already known to exist.
   * @returns Whether it refuses to open.
   */
  readonly isChallengeLocked: (index: number) => boolean;
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
 * It also corrects the address bar as it reads it. A parameter the router
 * refused is deleted from the URL, because a hash that goes on naming something
 * nobody is playing is a hash that gets bookmarked, pasted into a chat and
 * reported as a bug in the game: `#level=abc` starts the first challenge,
 * and the URL should stop saying `abc`. It is deleted rather than rewritten to
 * `level=1`, so `#level=abc,timescale=8` becomes `#timescale=8` and
 * `#level=abc` on its own becomes an empty hash. Absence is how this hash
 * spells the first challenge, and a correction that invented a value would be
 * putting a choice into the address bar that the player never made — the next
 * thing they copied out of it would carry that choice with it. Every deleted key
 * resolved to exactly what its absence resolves to — that is what being refused
 * means, see {@link RouteParams.refusedKeys} — so the rewrite cannot change the
 * route it is correcting, which is what makes it safe to do without routing
 * again.
 *
 * A refused `level` is corrected by rewriting instead when what it landed
 * on is not what absence spells, and by that same rule rather than in spite of
 * it. There are two such landings. `#level=tutorial-9` is a wrong address
 * on the learning track, so it starts the track's first task, and the only
 * thing that spells that task is its own id; and `#level=18` typed by
 * somebody who has cleared seven starts the eighth, which `level=8` is the
 * only spelling of. Absence spells the first challenge, which is somewhere
 * else entirely in both cases, so deleting the key would leave the bar
 * describing a run nobody is watching and a reload would take the player to
 * it. Neither correction invents a choice for them: they chose the track, and
 * this is where the track starts; they asked to go on, and this is as far on as
 * they have earned.
 *
 * A hash written with {@link LEGACY_LEVEL_KEY} is corrected as well, and for
 * the same reason though nothing about it was refused: the run it names is
 * played exactly as asked, and then the bar stops saying `challenge=` so that
 * what the player copies out of it next is written the way the game writes it.
 * That correction is the only one that fires on a URL the router was perfectly
 * happy with.
 *
 * The handler is handed the corrected parameters rather than the ones that were
 * written, so that everything built from them is clean as well. The level
 * switcher builds a link per tile out of this query — nineteen levels, the
 * learning track and free play; carrying `seed=rush%20hour` into all of them
 * would mean a refusal, and its warning, on every one the player followed
 * afterwards.
 *
 * @param onRoute - Called with the resolved parameters for each route.
 * @param options - The challenge count, the default time scale and the window.
 * @returns A function that stops routing.
 */
export function startRouter(onRoute: RouteHandler, options: RouterOptions): () => void {
  const target = options.target ?? window;
  let lastHash: string | null = null;

  /**
   * Takes the refused parameters out of the URL and out of the query.
   *
   * @param query - The parameters the route was resolved from, already under
   * the name the game reads now.
   * @param params - What the route resolved to, refusals included.
   * @param renamed - Whether {@link renameLegacyLevelKey} changed the hash the
   * URL was written with. A rewrite of its own: nothing was refused, and the
   * address bar still has to stop saying `challenge=`.
   * @returns The parameters that survived, which the URL now names.
   */
  const correct = (query: RouteQuery, params: RouteParams, renamed: boolean): RouteQuery => {
    const { refusedKeys } = params;
    if (refusedKeys.length === 0 && !renamed) {
      return query;
    }
    const address = challengeAddress(params);
    const kept = new Map(query);
    for (const key of refusedKeys) {
      if (key === LEVEL_KEY && address !== null) {
        // Set rather than deleted and re-added, so the corrected URL still
        // reads in the order it was written: a `Map` leaves a key it already
        // has where it is.
        kept.set(key, address);
      } else {
        kept.delete(key);
      }
    }
    // The entry's state is carried across rather than dropped: this is a
    // correction to a URL and nothing else, and passing null here would quietly
    // throw away anything the page had stored on the entry.
    target.history.replaceState(target.history.state, "", createParamsUrl(kept));
    // Read back rather than assumed. A hash with nothing left in it is written
    // as "#", which a browser resolves to a URL with an empty fragment, so what
    // `location.hash` says afterwards is "" — and lastHash has to be what the
    // next event will be compared against, or the next navigation back to this
    // URL is ignored as a repeat.
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
    // Renamed here as well as inside `resolveRoute`, because this is the half
    // of the answer to a legacy link the resolver cannot give: the run is the
    // one the link names either way, and the address bar is what has to stop
    // saying the name the game retired.
    const query = renameLegacyLevelKey(written);
    const params = resolveRoute(query, {
      challengeCount: options.challengeCount,
      defaultTimeScale: options.defaultTimeScale(),
      isChallengeLocked: options.isChallengeLocked,
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
