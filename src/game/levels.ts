/**
 * The list of levels and the conditions that decide whether one is won.
 *
 * Ported from the legacy `challenges.js`. The descriptions contain the same
 * HTML markup as before because the view drops them straight into the page.
 *
 * They are built out of the message catalogue rather than written here, which is
 * what a language other than English needs from them. Each is two messages deep:
 * a sentence with holes in it, and a counted phrase for each hole. Russian is
 * why — «Перевезите 23 пассажира» wants the accusative and «дольше 2,0 секунды»
 * the genitive, so the same English word has to be a message of its own in each
 * sentence it appears in, with its own plural forms. `src/i18n/format.ts` says
 * the rest of it.
 */

import { decimal, exact, format, formatList, t } from "../i18n/index.ts";
import {
  atLeastAvgLoadFactorOnMove,
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
} from "./level-tiers.ts";
import type { LevelTierRequirements, TierRequirementInfo } from "./level-tiers.ts";
import type { WorldOptions } from "./world.ts";

/** The statistics a level condition inspects. */
export interface LevelWorldStats {
  /** Simulated seconds since the world started. */
  readonly elapsedTime: number;
  /** Passengers delivered so far. */
  readonly transportedCounter: number;
  /** Longest any passenger has waited so far. */
  readonly maxWaitTime: number;
  /** Total floor changes across all elevators. */
  readonly moveCount: number;
  /** Passengers delivered per simulated second. */
  readonly transportedPerSec: number;
  /** How full the cars were, averaged over every floor they crossed. */
  readonly avgLoadFactorOnMove: number;
  /** Mean spawn-to-delivery time of delivered passengers. */
  readonly avgWaitTime: number;
  /** Longest anyone has stood on a floor before a car took them. */
  readonly maxPickupTime: number;
  /** Mean spawn-to-boarding time of the passengers a car has picked up. */
  readonly avgPickupTime: number;
  /** Mean boarding-to-delivery time of delivered passengers: the ride itself. */
  readonly avgRideTime: number;
  /** Door openings across all elevators. */
  readonly stopCount: number;
  /** People who got in or out at an average stop. */
  readonly avgPeoplePerStop: number;
}

/** A win/lose condition attached to a level. */
export interface LevelCondition {
  /**
   * Human-readable requirement; contains HTML markup.
   *
   * Read afresh every time, and a getter on everything that implements it,
   * because the words come out of the message catalogue and the locale outlives
   * the object: {@link levels} is a module-level constant, so a string
   * computed there would be frozen in whichever language happened to be active
   * when the module was first imported — English, always, since nothing has
   * loaded a catalogue that early. A getter puts it in the language of the
   * moment the bar was last drawn, which is exactly the contract
   * {@link "../i18n/index.ts"!setLocale} asks callers to keep: change the
   * locale, then redraw.
   */
  readonly description: string;
  /**
   * Judges a world.
   *
   * @param world - The world's current statistics.
   * @returns `true` when won, `false` when lost, `null` while undecided.
   */
  evaluate(world: LevelWorldStats): boolean | null;
  /**
   * The figure(s) {@link evaluate} actually reads, in the same shape a
   * {@link "./level-tiers.ts"!TierPredicate}'s own `requirements` use —
   * what lets a goal bar draw a live progress meter per figure without this
   * module exposing a second, parallel description of the same thresholds
   * `evaluate` enforces. Empty for a condition with nothing to meter:
   * {@link requireSandbox} never resolves, so there is no "how close" for it
   * to answer.
   */
  readonly requirements: readonly TierRequirementInfo[];
}

/** One playable level. */
export interface Level {
  /** World options the level is played with. */
  readonly options: WorldOptions;
  /** The condition deciding the outcome. */
  readonly condition: LevelCondition;
  /**
   * Silver/gold requirements, on top of the win/lose {@link condition}.
   *
   * Optional so that a level with nothing to say about tiers — every
   * built-in entry today, plus the sandbox factory below, which never
   * resolves at all — simply omits the field rather than being made to
   * invent one. {@link "./level-tiers.ts"!evaluateLevelTier} reads a
   * missing value as "bronze is the only tier this level has," which is
   * exactly what today's levels mean until a later change gives some of
   * them silver and gold requirements of their own.
   */
  readonly tiers?: LevelTierRequirements;
}

/**
 * Requires a number of passengers to be delivered within a time limit.
 *
 * @param userCount - Passengers that must be delivered.
 * @param timeLimit - Simulated seconds available.
 * @returns The condition.
 */
export function requireUserCountWithinTime(userCount: number, timeLimit: number): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithinTime.html", {
        people: t("level.people.html", { count: userCount }),
        time: t("level.timeLimit.html", { count: timeLimit }),
      });
    },
    evaluate(world: LevelWorldStats): boolean | null {
      if (world.elapsedTime >= timeLimit || world.transportedCounter >= userCount) {
        return world.elapsedTime <= timeLimit && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
    requirements: [
      { field: "transportedCounter", comparison: "atLeast", threshold: userCount },
      { field: "elapsedTime", comparison: "atMost", threshold: timeLimit },
    ],
  };
}

/**
 * Requires a number of passengers to be delivered without anyone waiting too long.
 *
 * @param userCount - Passengers that must be delivered.
 * @param maxWaitTime - Longest wait any passenger may endure, in seconds.
 * @returns The condition.
 */
export function requireUserCountWithMaxWaitTime(
  userCount: number,
  maxWaitTime: number,
): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithMaxWait.html", {
        people: t("level.people.html", { count: userCount }),
        // One decimal, as `toFixed(1)` gave it: 21 seconds is written "21.0",
        // and in Russian "21,0" -- which is also why the digits and the number
        // travel together. `21` is `one` there and `21,0` is `other`, so the
        // form of «секунды» depends on a decision the formatter has not made
        // yet unless the two are decided at once.
        waitTime: t("level.waitLimit.html", { count: decimal(maxWaitTime, 1) }),
      });
    },
    evaluate(world: LevelWorldStats): boolean | null {
      if (world.maxWaitTime >= maxWaitTime || world.transportedCounter >= userCount) {
        return world.maxWaitTime <= maxWaitTime && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
    requirements: [
      { field: "transportedCounter", comparison: "atLeast", threshold: userCount },
      { field: "maxWaitTime", comparison: "atMost", threshold: maxWaitTime },
    ],
  };
}

/**
 * Requires a number of passengers within both a time limit and a wait limit.
 *
 * @param userCount - Passengers that must be delivered.
 * @param timeLimit - Simulated seconds available.
 * @param maxWaitTime - Longest wait any passenger may endure, in seconds.
 * @returns The condition.
 */
export function requireUserCountWithinTimeWithMaxWaitTime(
  userCount: number,
  timeLimit: number,
  maxWaitTime: number,
): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithinTimeWithMaxWait.html", {
        people: t("level.people.html", { count: userCount }),
        time: t("level.timeLimit.html", { count: timeLimit }),
        waitTime: t("level.waitLimit.html", { count: decimal(maxWaitTime, 1) }),
      });
    },
    evaluate(world: LevelWorldStats): boolean | null {
      if (
        world.elapsedTime >= timeLimit ||
        world.maxWaitTime >= maxWaitTime ||
        world.transportedCounter >= userCount
      ) {
        return (
          world.elapsedTime <= timeLimit &&
          world.maxWaitTime <= maxWaitTime &&
          world.transportedCounter >= userCount
        );
      } else {
        return null;
      }
    },
    requirements: [
      { field: "transportedCounter", comparison: "atLeast", threshold: userCount },
      { field: "elapsedTime", comparison: "atMost", threshold: timeLimit },
      { field: "maxWaitTime", comparison: "atMost", threshold: maxWaitTime },
    ],
  };
}

/**
 * Requires a number of passengers to be delivered within a move budget.
 *
 * @param userCount - Passengers that must be delivered.
 * @param moveLimit - Elevator moves available.
 * @returns The condition.
 */
export function requireUserCountWithinMoves(userCount: number, moveLimit: number): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithinMoves.html", {
        people: t("level.people.html", { count: userCount }),
        moves: t("level.moveLimit.html", { count: moveLimit }),
      });
    },
    evaluate(world: LevelWorldStats): boolean | null {
      if (world.moveCount >= moveLimit || world.transportedCounter >= userCount) {
        return world.moveCount <= moveLimit && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
    requirements: [
      { field: "transportedCounter", comparison: "atLeast", threshold: userCount },
      { field: "moveCount", comparison: "atMost", threshold: moveLimit },
    ],
  };
}

/**
 * Requires a number of passengers within both a move budget and a wait limit.
 *
 * The two limits pull against each other, which is the point of asking for
 * both. A move is spent every time a car changes floor, so the cheapest way to
 * deliver a crowd is to fill a car and let it work down its list -- and the
 * passenger at the end of that list is the one whose delivery takes longest.
 * Optimise for the wait alone and cars run half empty, one errand at a time,
 * spending moves; optimise for moves alone and somebody rides through every
 * floor in the building. Neither limit is hard to meet on its own here, and a
 * program that meets both is one that decided when a car is full enough.
 *
 * @param userCount - Passengers that must be delivered.
 * @param moveLimit - Elevator moves available.
 * @param maxWaitTime - Longest wait any passenger may endure, in seconds.
 * @returns The condition.
 */
export function requireUserCountWithinMovesWithMaxWaitTime(
  userCount: number,
  moveLimit: number,
  maxWaitTime: number,
): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithinMovesWithMaxWait.html", {
        people: t("level.people.html", { count: userCount }),
        moves: t("level.moveLimit.html", { count: moveLimit }),
        waitTime: t("level.waitLimit.html", { count: decimal(maxWaitTime, 1) }),
      });
    },
    evaluate(world: LevelWorldStats): boolean | null {
      if (
        world.moveCount >= moveLimit ||
        world.maxWaitTime >= maxWaitTime ||
        world.transportedCounter >= userCount
      ) {
        return (
          world.moveCount <= moveLimit &&
          world.maxWaitTime <= maxWaitTime &&
          world.transportedCounter >= userCount
        );
      } else {
        return null;
      }
    },
    requirements: [
      { field: "transportedCounter", comparison: "atLeast", threshold: userCount },
      { field: "moveCount", comparison: "atMost", threshold: moveLimit },
      { field: "maxWaitTime", comparison: "atMost", threshold: maxWaitTime },
    ],
  };
}

/**
 * The building a sandbox run is played in.
 *
 * Every value is already validated: the sandbox is configured from the location
 * hash, so the range checking happens in `src/pages/game/model/route.ts` and what arrives
 * here is something the simulation can run. The fields are deliberately the
 * subset of {@link WorldOptions} the sandbox lets the player choose, spelled out
 * one by one rather than derived from it, so that an option added to the world
 * is opted into here on purpose rather than silently exposed to the URL.
 */
export interface SandboxOptions {
  /** Number of floors in the building. */
  readonly floorCount: number;
  /** Number of elevators. */
  readonly elevatorCount: number;
  /** Per-elevator capacities, cycled when shorter than the elevator count. */
  readonly elevatorCapacities: readonly number[];
  /** Passengers spawned per second. */
  readonly spawnRate: number;
}

/**
 * Wraps a value in the emphasis markup the level bar paints numbers with.
 *
 * The one number in a description that no message of its own can carry: the
 * capacities are a list of unknown length, and a catalogue entry holds a
 * sentence rather than a loop. Everything else here is a counted phrase, which
 * needs its noun agreed with the count and so has to be a message.
 *
 * @param value - The number to emphasise.
 * @returns The markup, ready to interpolate into a description.
 */
function emphasise(value: number): string {
  return `<span class='emphasis-color'>${format(exact(value))}</span>`;
}

/**
 * A condition that never resolves, and that reads back the building it is in.
 *
 * The sandbox has no goal — that is the whole point of it — so `evaluate`
 * returns `null` forever and `requirements` is empty. What earns the condition
 * its place is the description: the parameters come from the URL, which is off
 * screen while the game is being played, so the goal bar is the only place the
 * player can see what they actually asked for. A hash that was silently
 * clamped (`floors=1000` becoming 60) says so here, not just in the console.
 *
 * This is the only never-resolving condition left. There was a second until
 * 2026-08-20, `requireDemo`, behind an endless twentieth level that ran the
 * building of level 18 — the same twenty-one floors, eight cars and
 * capacities — with the win condition taken off. The sandbox already is that
 * level, and one a player can size themselves, so the demo was one more entry
 * in the list saying what free play next to it said better.
 *
 * @param options - The building the run is playing in.
 * @returns The condition.
 */
export function requireSandbox(options: SandboxOptions): LevelCondition {
  return {
    get description(): string {
      // Every number here came out of the address bar, so every one of them is
      // `exact`: the default three decimals would round `spawnrate=0.0625` to
      // `0.063` and `9.9999` to `10`, and this line is the only place a sandbox
      // player can check what they are running. The built-in levels above
      // need none of it -- their numbers are integer literals in this file.
      return t("level.sandbox.html", {
        floors: t("level.sandbox.floors.html", { count: exact(options.floorCount) }),
        elevators: t("level.sandbox.elevators.html", { count: exact(options.elevatorCount) }),
        // Counted by how many capacities were listed, not by how many cars
        // there are: the label introduces the list that follows it, and a
        // building of four elevators cycling one capacity has one to show.
        capacityLabel: t("level.sandbox.capacityLabel", {
          count: options.elevatorCapacities.length,
        }),
        // Punctuated by the locale rather than joined with `", "`. Russian
        // writes decimals with a comma, and this sentence is made of numbers:
        // «вместимостью 6, 9, 1,5 пассажира в секунду» hands a reader three
        // commas doing two different jobs, and «6, 9» is also how six point
        // nine is written. The conjunction the locale supplies — «6 и 9»,
        // "6 and 9" — cannot be read as one number, and reads better in
        // English too.
        capacities: formatList(options.elevatorCapacities.map((capacity) => emphasise(capacity))),
        spawnRate: t("level.sandbox.spawnRate.html", { count: exact(options.spawnRate) }),
      });
    },
    evaluate(): boolean | null {
      return null;
    },
    requirements: [],
  };
}

/**
 * Builds the goal-less level the sandbox route plays.
 *
 * Not a member of {@link levels}: it has no fixed shape to be listed with,
 * since its world is whatever the URL asks for, and it is not a station on the
 * progression the numbered levels form.
 *
 * @param options - The building to play in, already validated.
 * @returns The level.
 */
export function createSandboxLevel(options: SandboxOptions): Level {
  return {
    // Copied field by field rather than spread, so that an option added to
    // WorldOptions has to be opted into here before the URL can reach it.
    options: {
      floorCount: options.floorCount,
      elevatorCount: options.elevatorCount,
      elevatorCapacities: [...options.elevatorCapacities],
      spawnRate: options.spawnRate,
    },
    condition: requireSandbox(options),
  };
}

/** Every level, in the order they are played. */
export const levels: readonly Level[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requireUserCountWithinTime(15, 60),
    // Bronze only asks that fifteen people arrive inside a minute, and says
    // nothing about how long any one of them stood waiting -- a program that
    // wins with four seconds to spare and one that wins with forty both pass
    // it the same. Silver and gold both read the wait a bronze win never
    // looks at, tightened from what two hundred measured runs actually
    // produced: the plain nearest-car dispatcher clears 4.7 seconds or better
    // in its best quarter of wins, and 5.1 or better in its typical one, so
    // that is silver's bar and gold's.
    tiers: { silver: underAvgWaitTime(5.1), gold: underAvgWaitTime(4.7) },
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.4 },
    condition: requireUserCountWithinTime(20, 60),
    // Same shape as the level before it, but here the collective-control
    // program is the one worth chasing: across its wins its typical average
    // wait is 9.1 seconds and its median is 9.0, both a touch better than the
    // nearest-car dispatcher manages on this floor count.
    tiers: { silver: underAvgWaitTime(9.1), gold: underAvgWaitTime(9.0) },
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.5, elevatorCapacities: [6] },
    condition: requireUserCountWithinTime(23, 60),
    tiers: { silver: underAvgWaitTime(10.9), gold: underAvgWaitTime(9.9) },
  },
  {
    options: { floorCount: 8, elevatorCount: 2, spawnRate: 0.6 },
    condition: requireUserCountWithinTime(28, 60),
    tiers: { silver: underAvgWaitTime(10.2), gold: underAvgWaitTime(9.6) },
  },
  {
    options: { floorCount: 6, elevatorCount: 4, spawnRate: 1.7 },
    condition: requireUserCountWithinTime(100, 68),
    // The tightest bronze margin of the first five: across two hundred seeds
    // the nearest-car dispatcher only wins 27 of them and collective control
    // only 8, so a silver or gold here is a rare thing to earn by either
    // program's own account, not just a high bar. A first pass read silver
    // and gold straight off those 27 wins -- the same thin-sample mistake
    // level 10's own comment below describes making and then fixing, and
    // this one needed the same fix: 1,532 wins measured across 15,000 seeds
    // (700000-714999) put the nearest-car dispatcher's median avgWaitTime at
    // 8.76s, close enough to the thin sample's 8.8 to leave silver where it
    // was, and its fastest quarter at 8.26s, a tenth looser than the thin
    // sample's 8.2. Collective control's distribution was never the source
    // of either number -- it wins this building even less often, 414 of
    // 8,000 seeds measured the same way, and stays the weaker reference at
    // scale.
    tiers: { silver: underAvgWaitTime(8.8), gold: underAvgWaitTime(8.3) },
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0.8 },
    condition: requireUserCountWithinMoves(40, 60),
    // Bronze is a move budget, so silver tightens that same budget -- but the
    // program the budget was measured against here is the nearest-car
    // dispatcher, which wins this one only 18 times in two hundred, too thin
    // a sample to read a threshold from safely (see level 10's comment
    // below for what that mistake costs). Recalibrated the same way: 1,360
    // wins measured across 11,000 seeds (310000-320999) put the nearest-car
    // dispatcher's median move count at 58, a move looser than the thin
    // sample's 57, and its median wait -- gold's second axis, below -- at
    // 6.37s, rounding to 6.4 rather than the thin sample's 6.3. The
    // collective-control program built to spend moves carefully wins this
    // one 149 times in two hundred, a sample thick enough to leave alone;
    // gold's move count is still read from it, on the same axis, tightened
    // further. Gold adds a second question bronze never asks at all -- the
    // wait a move-frugal program can make someone sit through -- read from
    // whichever program answers it better, which on this floor count is the
    // nearest-car one again, at its own, now properly measured, median.
    tiers: {
      silver: underMoveCount(58),
      gold: requireAll(underMoveCount(55), underAvgWaitTime(6.4)),
    },
  },
  {
    options: { floorCount: 3, elevatorCount: 3, spawnRate: 3.0 },
    condition: requireUserCountWithinMoves(100, 63),
    // Same shape as level 6, one floor building over, and every number
    // here comes from the nearest-car dispatcher's own distribution rather
    // than the collective-control program's. That dispatcher wins this one
    // only 37 times in two hundred -- thin enough that it went uncalibrated
    // for this honestly the first time around, unlike levels 5, 6 and 10
    // above. Recalibrated against 1,612 wins measured across 8,000 seeds
    // (900000-907999): the move-count numbers held exactly, median 61 and
    // fastest quarter 59, unchanged from the thin sample. The wait did not --
    // gold's second axis, the same "moves spent carefully but not at the
    // cost of a terrible wait" question level 6 asks, comes out at 8.02s
    // at scale, rounding to 8.0 rather than the thin sample's 7.9. The
    // collective-control program built to spend moves carefully wins this
    // one 88 times in two hundred but was never the source of these numbers
    // -- the nearest-car dispatcher answers both questions better here.
    tiers: {
      silver: underMoveCount(61),
      gold: requireAll(underMoveCount(59), underAvgWaitTime(8.0)),
    },
  },
  {
    options: { floorCount: 6, elevatorCount: 2, spawnRate: 0.4, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(50, 21),
    // Bronze already reads the worst wait anyone suffered; silver and gold
    // just ask for a better worst. Both are read from the nearest-car
    // dispatcher, which wins this one every time across two hundred seeds and
    // does so with room under the limit -- the collective-control program
    // wins barely half as often and with less of it, so it is not the
    // stricter reference here even though it is the one built for later,
    // harder buildings.
    tiers: { silver: underMaxWaitTime(12), gold: underMaxWaitTime(11) },
  },
  {
    options: { floorCount: 7, elevatorCount: 3, spawnRate: 0.6 },
    condition: requireUserCountWithMaxWaitTime(50, 20),
    tiers: { silver: underMaxWaitTime(12.7), gold: underMaxWaitTime(11.5) },
  },
  {
    options: { floorCount: 13, elevatorCount: 2, spawnRate: 1.1, elevatorCapacities: [4, 10] },
    condition: requireUserCountWithinTime(50, 70),
    // DEV_TEST_CODE all but never wins this building's bronze -- two wins in
    // 40,000 measured seeds (20000-59999), not literally zero but far too
    // thin to read a threshold from. GOOD_CODE_BALANCED does win it more
    // often, though still rarely: 273 wins in that same 40,000, about seven
    // in a thousand. As with levels 12 to 14 above, there is no second
    // program's distribution to read silver from, so both tiers come from
    // GOOD_CODE_BALANCED's own wins: the median of their finishing times is
    // silver's bar (68.6s, cleared by 49% of those 273 wins), the fastest
    // quarter of them is gold's (67.7s, cleared by 26%). This level's row
    // in the tiering plan also asks for a second axis, the same
    // avgLoadFactorOnMove level 16 below reads gold from -- but across
    // these 273 wins load factor barely tracks how fast the run finished, a
    // correlation of about 0.03. Compounding a second, uncorrelated axis onto
    // this distribution would not separate a program's play from what a
    // lucky spawn handed it, so this level stays on elapsedTime alone.
    //
    // A first pass at these numbers, read off just sixteen wins sampled from
    // 2,300 seeds, put silver and gold at 67.8s and 66.9s -- tighter than
    // this recalibration finds, because that sixteen-win sample turned out to
    // be an unusually fast draw rather than a representative one. Even at
    // 273 wins this is still a win rate under 1%, so these numbers should be
    // read as a floor pulled up from a thin population, not a settled
    // statistic -- they are real observed wins, not a guess, but a program's
    // actual pass rate against them can still drift as more seeds are
    // measured.
    tiers: { silver: underElapsedTime(68.6), gold: underElapsedTime(67.7) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(60, 19),
    // The nearest-car dispatcher wins this one 160 times in two hundred;
    // collective control wins it only twice. Silver and gold are read from
    // the program that actually clears bronze here, which keeps them
    // meaningful, but it does mean the program this codebase otherwise treats
    // as the stronger dispatcher will rarely reach either rank on this
    // particular floor.
    tiers: { silver: underMaxWaitTime(15.7), gold: underMaxWaitTime(14.3) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(80, 17),
    // Collective control never wins this one across two hundred seeds; the
    // nearest-car dispatcher wins 85 of them, and that is the only
    // distribution silver and gold are read from.
    tiers: { silver: underMaxWaitTime(15.4), gold: underMaxWaitTime(14.5) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(100, 15),
    // Collective control never wins this one, and a first pass read silver
    // and gold off just 14 of two hundred nearest-car-dispatcher wins -- the
    // exact thinness this comment already flagged honestly, and exactly the
    // mistake level 10's own comment describes fixing. Recalibrated the
    // same way: 1,403 wins measured across 22,000 seeds (800000-821999)
    // settle the median at 14.39s, rounding to 14.4, a tenth tighter than
    // the thin sample's 14.5, and the fastest quarter at 13.875s, rounding
    // to 13.9, two tenths looser than the thin sample's 13.7 -- the thin
    // sample had it backwards on both counts, reading silver too loose and
    // gold too strict.
    tiers: { silver: underMaxWaitTime(14.4), gold: underMaxWaitTime(13.9) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.0, elevatorCapacities: [6] },
    condition: requireUserCountWithMaxWaitTime(110, 15),
    // The building one capacity size up from the level above, and the
    // same shape: collective control never wins this one across two hundred
    // seeds, and the nearest-car dispatcher only wins 34 of them -- thin
    // enough to need the same recalibration levels 10 and 13 needed,
    // even though nothing here said so at the time. 1,636 wins measured
    // across 12,000 seeds (1000000-1011999) settle the median at 14.24s,
    // still 14.2, and the fastest quarter at 13.70s, a tenth tighter than
    // the thin sample's 13.8.
    tiers: { silver: underMaxWaitTime(14.2), gold: underMaxWaitTime(13.7) },
  },
  {
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requireUserCountWithMaxWaitTime(120, 14),
    // Collective control wins this one only 4 times in two hundred against
    // the nearest-car dispatcher's 171, so once again it is the latter's
    // distribution the tiers are read from.
    tiers: { silver: underMaxWaitTime(11.6), gold: underMaxWaitTime(11.1) },
  },
  {
    options: { floorCount: 12, elevatorCount: 4, spawnRate: 1.4, elevatorCapacities: [5, 10] },
    condition: requireUserCountWithinTime(70, 80),
    // Both programs win this one reliably, which is why it is the one
    // level among the wait-limited run above and the time-limited one
    // below to read gold from two axes at once: finishing faster than bronze
    // asks, the way the earliest levels do, and also carrying a fuller
    // car on the way, a question this building's own bronze condition never
    // puts to a program at all. Collective control supplies both numbers --
    // its own best quarter of finishing times ties the median this level
    // already uses for silver, so gold reads a stricter point of the same
    // distribution instead of the same number twice.
    tiers: {
      silver: underElapsedTime(73),
      gold: requireAll(underElapsedTime(70.1), atLeastAvgLoadFactorOnMove(0.411)),
    },
  },
  {
    options: { floorCount: 21, elevatorCount: 5, spawnRate: 1.9, elevatorCapacities: [10] },
    condition: requireUserCountWithinTime(110, 80),
    // Neither program wins this building even once across two hundred
    // measured seeds. No tiers, for the same reason the level four
    // places above has none.
  },
  {
    options: { floorCount: 21, elevatorCount: 8, spawnRate: 1.5, elevatorCapacities: [6, 8] },
    condition: requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45),
    // Neither program wins this building even once across two hundred
    // measured seeds either -- the largest building in the list, asking for
    // the most people, is past both reference dispatchers here.
  },
  {
    // The building of the wait-limited level four places above, asked a
    // second question. That one wanted 120 delivered with nobody taking more
    // than fourteen seconds, which a car-per-call program answers by running
    // cars nearly empty; this one leaves the wait limit slack enough for that
    // program to keep meeting it and takes away the moves it was paying with.
    // Measured over twenty seeds at a hundred delivered: sending the nearest
    // free car to each call costs 394 to 502 moves, plain collective control
    // costs 335 to 404 but lets a delivery reach 35.7 seconds, and collective
    // control that stops taking passengers on board a car once it is half full
    // costs 316 to 412 with a worst delivery of 27.2. The limits are that last
    // program's worst seed with about a tenth in hand on each.
    //
    // Neither of this file's two reference dispatchers wins this level's
    // bronze even once across two hundred later seeds measured the same way
    // as every level above -- the twenty-seed measurement above shaped
    // the limit itself, not a program meant to reliably clear it, and the
    // move-conscious collective control built for the rest of this file is
    // evidently not the same program as the one that measurement describes
    // closely enough to win here. No tiers follow from a distribution that
    // does not exist.
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30),
  },
];
