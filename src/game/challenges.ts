/**
 * The list of challenges and the conditions that decide whether one is won.
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
import type { WorldOptions } from "./world.ts";

/** The statistics a challenge condition inspects. */
export interface ChallengeWorldStats {
  /** Simulated seconds since the world started. */
  readonly elapsedTime: number;
  /** Passengers delivered so far. */
  readonly transportedCounter: number;
  /** Longest any passenger has waited so far. */
  readonly maxWaitTime: number;
  /** Total floor changes across all elevators. */
  readonly moveCount: number;
}

/** A win/lose condition attached to a challenge. */
export interface ChallengeCondition {
  /**
   * Human-readable requirement; contains HTML markup.
   *
   * Read afresh every time, and a getter on everything that implements it,
   * because the words come out of the message catalogue and the locale outlives
   * the object: {@link challenges} is a module-level constant, so a string
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
  evaluate(world: ChallengeWorldStats): boolean | null;
}

/** One playable challenge. */
export interface Challenge {
  /** World options the challenge is played with. */
  readonly options: WorldOptions;
  /** The condition deciding the outcome. */
  readonly condition: ChallengeCondition;
}

/**
 * Requires a number of passengers to be delivered within a time limit.
 *
 * @param userCount - Passengers that must be delivered.
 * @param timeLimit - Simulated seconds available.
 * @returns The condition.
 */
export function requireUserCountWithinTime(
  userCount: number,
  timeLimit: number,
): ChallengeCondition {
  return {
    get description(): string {
      return t("challenge.transportWithinTime.html", {
        people: t("challenge.people.html", { count: userCount }),
        time: t("challenge.timeLimit.html", { count: timeLimit }),
      });
    },
    evaluate(world: ChallengeWorldStats): boolean | null {
      if (world.elapsedTime >= timeLimit || world.transportedCounter >= userCount) {
        return world.elapsedTime <= timeLimit && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
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
): ChallengeCondition {
  return {
    get description(): string {
      return t("challenge.transportWithMaxWait.html", {
        people: t("challenge.people.html", { count: userCount }),
        // One decimal, as `toFixed(1)` gave it: 21 seconds is written "21.0",
        // and in Russian "21,0" -- which is also why the digits and the number
        // travel together. `21` is `one` there and `21,0` is `other`, so the
        // form of «секунды» depends on a decision the formatter has not made
        // yet unless the two are decided at once.
        waitTime: t("challenge.waitLimit.html", { count: decimal(maxWaitTime, 1) }),
      });
    },
    evaluate(world: ChallengeWorldStats): boolean | null {
      if (world.maxWaitTime >= maxWaitTime || world.transportedCounter >= userCount) {
        return world.maxWaitTime <= maxWaitTime && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
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
): ChallengeCondition {
  return {
    get description(): string {
      return t("challenge.transportWithinTimeWithMaxWait.html", {
        people: t("challenge.people.html", { count: userCount }),
        time: t("challenge.timeLimit.html", { count: timeLimit }),
        waitTime: t("challenge.waitLimit.html", { count: decimal(maxWaitTime, 1) }),
      });
    },
    evaluate(world: ChallengeWorldStats): boolean | null {
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
  };
}

/**
 * Requires a number of passengers to be delivered within a move budget.
 *
 * @param userCount - Passengers that must be delivered.
 * @param moveLimit - Elevator moves available.
 * @returns The condition.
 */
export function requireUserCountWithinMoves(
  userCount: number,
  moveLimit: number,
): ChallengeCondition {
  return {
    get description(): string {
      return t("challenge.transportWithinMoves.html", {
        people: t("challenge.people.html", { count: userCount }),
        moves: t("challenge.moveLimit.html", { count: moveLimit }),
      });
    },
    evaluate(world: ChallengeWorldStats): boolean | null {
      if (world.moveCount >= moveLimit || world.transportedCounter >= userCount) {
        return world.moveCount <= moveLimit && world.transportedCounter >= userCount;
      } else {
        return null;
      }
    },
  };
}

/**
 * A condition that never resolves, used for the endless demo.
 *
 * @returns The condition.
 */
export function requireDemo(): ChallengeCondition {
  return {
    get description(): string {
      return t("challenge.demo");
    },
    evaluate(): boolean | null {
      return null;
    },
  };
}

/**
 * The building a sandbox run is played in.
 *
 * Every value is already validated: the sandbox is configured from the location
 * hash, so the range checking happens in `src/app/router.ts` and what arrives
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
 * Wraps a value in the emphasis markup the challenge bar paints numbers with.
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
 * The sandbox has no goal — that is the whole point of it — so this is
 * {@link requireDemo} with a description that earns its place: the parameters
 * come from the URL, which is off screen while the game is being played, so the
 * challenge bar is the only place the player can see what they actually asked
 * for. A hash that was silently clamped (`floors=1000` becoming 60) says so
 * here, not just in the console.
 *
 * @param options - The building the run is playing in.
 * @returns The condition.
 */
export function requireSandbox(options: SandboxOptions): ChallengeCondition {
  return {
    get description(): string {
      // Every number here came out of the address bar, so every one of them is
      // `exact`: the default three decimals would round `spawnrate=0.0625` to
      // `0.063` and `9.9999` to `10`, and this line is the only place a sandbox
      // player can check what they are running. The built-in challenges above
      // need none of it -- their numbers are integer literals in this file.
      return t("challenge.sandbox.html", {
        floors: t("challenge.sandbox.floors.html", { count: exact(options.floorCount) }),
        elevators: t("challenge.sandbox.elevators.html", { count: exact(options.elevatorCount) }),
        // Counted by how many capacities were listed, not by how many cars
        // there are: the label introduces the list that follows it, and a
        // building of four elevators cycling one capacity has one to show.
        capacityLabel: t("challenge.sandbox.capacityLabel", {
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
        spawnRate: t("challenge.sandbox.spawnRate.html", { count: exact(options.spawnRate) }),
      });
    },
    evaluate(): boolean | null {
      return null;
    },
  };
}

/**
 * Builds the goal-less challenge the sandbox route plays.
 *
 * Not a member of {@link challenges}: it has no fixed shape to be listed with,
 * since its world is whatever the URL asks for, and it is not a station on the
 * progression the numbered challenges form.
 *
 * @param options - The building to play in, already validated.
 * @returns The challenge.
 */
export function createSandboxChallenge(options: SandboxOptions): Challenge {
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

/** Every challenge, in the order they are played. */
export const challenges: readonly Challenge[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requireUserCountWithinTime(15, 60),
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.4 },
    condition: requireUserCountWithinTime(20, 60),
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.5, elevatorCapacities: [6] },
    condition: requireUserCountWithinTime(23, 60),
  },
  {
    options: { floorCount: 8, elevatorCount: 2, spawnRate: 0.6 },
    condition: requireUserCountWithinTime(28, 60),
  },
  {
    options: { floorCount: 6, elevatorCount: 4, spawnRate: 1.7 },
    condition: requireUserCountWithinTime(100, 68),
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0.8 },
    condition: requireUserCountWithinMoves(40, 60),
  },
  {
    options: { floorCount: 3, elevatorCount: 3, spawnRate: 3.0 },
    condition: requireUserCountWithinMoves(100, 63),
  },
  {
    options: { floorCount: 6, elevatorCount: 2, spawnRate: 0.4, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(50, 21),
  },
  {
    options: { floorCount: 7, elevatorCount: 3, spawnRate: 0.6 },
    condition: requireUserCountWithMaxWaitTime(50, 20),
  },
  {
    options: { floorCount: 13, elevatorCount: 2, spawnRate: 1.1, elevatorCapacities: [4, 10] },
    condition: requireUserCountWithinTime(50, 70),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(60, 19),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(80, 17),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(100, 15),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.0, elevatorCapacities: [6] },
    condition: requireUserCountWithMaxWaitTime(110, 15),
  },
  {
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requireUserCountWithMaxWaitTime(120, 14),
  },
  {
    options: { floorCount: 12, elevatorCount: 4, spawnRate: 1.4, elevatorCapacities: [5, 10] },
    condition: requireUserCountWithinTime(70, 80),
  },
  {
    options: { floorCount: 21, elevatorCount: 5, spawnRate: 1.9, elevatorCapacities: [10] },
    condition: requireUserCountWithinTime(110, 80),
  },
  {
    options: { floorCount: 21, elevatorCount: 8, spawnRate: 1.5, elevatorCapacities: [6, 8] },
    condition: requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45),
  },
  {
    options: { floorCount: 21, elevatorCount: 8, spawnRate: 1.5, elevatorCapacities: [6, 8] },
    condition: requireDemo(),
  },
];
