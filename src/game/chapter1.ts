/** Chapter one: the levels inherited from the original game, each played on a seed of the moment. */

import {
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinMovesWithMaxWaitTime,
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type Level,
} from "./levels.ts";
import {
  WINNING_IS_GOLD,
  atLeastAvgLoadFactorOnMove,
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
} from "./level-tiers.ts";

/** Every level of chapter one, in the order they are played. */
export const chapter1Levels: readonly Level[] = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requireUserCountWithinTime(15, 60),
    tiers: { silver: underAvgWaitTime(5.1), gold: underAvgWaitTime(4.7) },
  },
  {
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.4 },
    condition: requireUserCountWithinTime(20, 60),
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
    tiers: { silver: underAvgWaitTime(8.8), gold: underAvgWaitTime(8.3) },
  },
  {
    options: { floorCount: 4, elevatorCount: 2, spawnRate: 0.8 },
    condition: requireUserCountWithinMoves(40, 60),
    tiers: {
      silver: underMoveCount(58),
      gold: requireAll(underMoveCount(55), underAvgWaitTime(6.4)),
    },
  },
  {
    options: { floorCount: 3, elevatorCount: 3, spawnRate: 3.0 },
    condition: requireUserCountWithinMoves(100, 63),
    tiers: {
      silver: underMoveCount(61),
      gold: requireAll(underMoveCount(59), underAvgWaitTime(8.0)),
    },
  },
  {
    options: { floorCount: 6, elevatorCount: 2, spawnRate: 0.4, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(50, 21),
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
    tiers: { silver: underElapsedTime(68.6), gold: underElapsedTime(67.7) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(60, 19),
    tiers: { silver: underMaxWaitTime(15.7), gold: underMaxWaitTime(14.3) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requireUserCountWithMaxWaitTime(80, 17),
    tiers: { silver: underMaxWaitTime(15.4), gold: underMaxWaitTime(14.5) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1, elevatorCapacities: [5] },
    condition: requireUserCountWithMaxWaitTime(100, 15),
    tiers: { silver: underMaxWaitTime(14.4), gold: underMaxWaitTime(13.9) },
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.0, elevatorCapacities: [6] },
    condition: requireUserCountWithMaxWaitTime(110, 15),
    tiers: { silver: underMaxWaitTime(14.2), gold: underMaxWaitTime(13.7) },
  },
  {
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requireUserCountWithMaxWaitTime(120, 14),
    tiers: { silver: underMaxWaitTime(11.6), gold: underMaxWaitTime(11.1) },
  },
  {
    options: { floorCount: 12, elevatorCount: 4, spawnRate: 1.4, elevatorCapacities: [5, 10] },
    condition: requireUserCountWithinTime(70, 80),
    tiers: {
      silver: underElapsedTime(73),
      gold: requireAll(underElapsedTime(70.1), atLeastAvgLoadFactorOnMove(0.411)),
    },
  },
  // The last three grade nothing beyond their own bar: neither reference
  // program wins them on any calibration seed, so there is no distribution to
  // read a silver or gold threshold from, and clearing them is gold.
  {
    options: { floorCount: 21, elevatorCount: 5, spawnRate: 1.9, elevatorCapacities: [10] },
    condition: requireUserCountWithinTime(110, 80),
    tiers: WINNING_IS_GOLD,
  },
  {
    options: { floorCount: 21, elevatorCount: 8, spawnRate: 1.5, elevatorCapacities: [6, 8] },
    condition: requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45),
    tiers: WINNING_IS_GOLD,
  },
  {
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requireUserCountWithinMovesWithMaxWaitTime(100, 450, 30),
    tiers: WINNING_IS_GOLD,
  },
];
