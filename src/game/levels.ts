/** What a level is, and the win/lose conditions that decide one; the levels themselves are a chapter's file. */

import { decimal, exact, format, formatList, t } from "../i18n/index.ts";
import { WINNING_IS_GOLD } from "./level-tiers.ts";
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
   * A getter, not a plain field, so it renders in the active locale when read
   * rather than the one active when this module was first imported.
   */
  readonly description: string;
  /**
   * @returns `true` when won, `false` when lost, `null` while undecided.
   */
  evaluate(world: LevelWorldStats): boolean | null;
  /** The figures {@link evaluate} reads, for drawing a live progress meter; empty if nothing to meter. */
  readonly requirements: readonly TierRequirementInfo[];
}

/** One playable level. */
export interface Level {
  /** World options the level is played with. */
  readonly options: WorldOptions;
  /** The condition deciding the outcome. */
  readonly condition: LevelCondition;
  /** Silver/gold requirements on top of the win/lose {@link condition}; `WINNING_IS_GOLD` where the win itself is the whole achievement. */
  readonly tiers: LevelTierRequirements;
}

/** Requires `userCount` passengers delivered within `timeLimit` simulated seconds. */
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

/** Requires `userCount` passengers delivered with nobody waiting more than `maxWaitTime` seconds. */
export function requireUserCountWithMaxWaitTime(
  userCount: number,
  maxWaitTime: number,
): LevelCondition {
  return {
    get description(): string {
      return t("level.transportWithMaxWait.html", {
        people: t("level.people.html", { count: userCount }),
        // One decimal place: pluralization depends on the exact digits (21 vs
        // 21.0 take different forms in Russian), so count and digits must match.
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

/** Requires `userCount` passengers delivered within `timeLimit` seconds and nobody waiting past `maxWaitTime`. */
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

/** Requires `userCount` passengers delivered within `moveLimit` elevator moves. */
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
 * Requires `userCount` passengers delivered within `moveLimit` moves and
 * nobody waiting past `maxWaitTime` seconds. The two limits pull against each
 * other: filling a car saves moves but makes its last passenger wait longest.
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

/** The building a sandbox run is played in; already range-validated from the location hash. */
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

/** Wraps a value in the `emphasis-color` markup a level description paints numbers with. */
function emphasize(value: number): string {
  return `<span class='emphasis-color'>${format(exact(value))}</span>`;
}

/** A condition that never resolves and describes back the building the URL asked for. */
export function requireSandbox(options: SandboxOptions): LevelCondition {
  return {
    get description(): string {
      // `exact`, not the default rounding, so a value like `spawnrate=0.0625`
      // is shown precisely rather than rounded to `0.063`.
      return t("level.sandbox.html", {
        floors: t("level.sandbox.floors.html", { count: exact(options.floorCount) }),
        elevators: t("level.sandbox.elevators.html", { count: exact(options.elevatorCount) }),
        // Counted by list length, not elevator count: cycling one capacity
        // across many cars is still one item to list.
        capacityLabel: t("level.sandbox.capacityLabel", {
          count: options.elevatorCapacities.length,
        }),
        // Uses the locale's own conjunction rather than joining with ", ":
        // some locales write decimals with a comma too, which a plain join
        // would make ambiguous.
        capacities: formatList(options.elevatorCapacities.map((capacity) => emphasize(capacity))),
        spawnRate: t("level.sandbox.spawnRate.html", { count: exact(options.spawnRate) }),
      });
    },
    evaluate(): boolean | null {
      return null;
    },
    requirements: [],
  };
}

/** Builds the goal-less level the sandbox route plays; not a member of either chapter. */
export function createSandboxLevel(options: SandboxOptions): Level {
  return {
    // Copied field by field rather than spread, so an option added to
    // WorldOptions has to be opted into here before the URL can reach it.
    options: {
      floorCount: options.floorCount,
      elevatorCount: options.elevatorCount,
      elevatorCapacities: [...options.elevatorCapacities],
      spawnRate: options.spawnRate,
    },
    condition: requireSandbox(options),
    // Never read: a sandbox run has no verdict for a tier to be judged from.
    tiers: WINNING_IS_GOLD,
  };
}
