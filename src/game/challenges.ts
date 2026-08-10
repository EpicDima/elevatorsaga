/**
 * The list of challenges and the conditions that decide whether one is won.
 *
 * Ported from the legacy `challenges.js`. The descriptions contain the same
 * HTML markup as before because the view drops them straight into the page.
 */

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
  /** Human-readable requirement; contains HTML markup. */
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
    description: `Transport <span class='emphasis-color'>${String(userCount)}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less`,
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
    description: `Transport <span class='emphasis-color'>${String(userCount)}</span> people and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
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
    description: `Transport <span class='emphasis-color'>${String(userCount)}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
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
    description: `Transport <span class='emphasis-color'>${String(userCount)}</span> people using <span class='emphasis-color'>${String(moveLimit)}</span> elevator moves or less`,
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
    description: "Perpetual demo",
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
 * @param value - The number to emphasise.
 * @returns The markup, ready to interpolate into a description.
 */
function emphasise(value: number): string {
  return `<span class='emphasis-color'>${String(value)}</span>`;
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
  const elevators = options.elevatorCount === 1 ? "elevator" : "elevators";
  const capacities = options.elevatorCapacities.map((capacity) => emphasise(capacity)).join(", ");
  const capacityLabel = options.elevatorCapacities.length === 1 ? "capacity" : "capacities";
  return {
    description:
      `Sandbox: ${emphasise(options.floorCount)} floors, ` +
      `${emphasise(options.elevatorCount)} ${elevators} of ${capacityLabel} ${capacities}, ` +
      `${emphasise(options.spawnRate)} people per second. No goal, so the run never ends`,
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
