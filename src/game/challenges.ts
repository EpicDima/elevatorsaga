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
