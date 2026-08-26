/**
 * A seed must produce the same passengers and building mechanics regardless of frame
 * schedule, since both player code and world physics advance in fixed ticks. These tests
 * compare real runs, driven by a program that actually moves the elevators, across frame rates.
 */

import { describe, expect, it } from "vitest";

import type { RandomSeed } from "./random.ts";
import { at } from "./test-helpers.ts";
import { TICK_SECONDS, createWorldController, type UserCodeObject } from "./world-controller.ts";
import { createWorld, type WorldOptions } from "./world.ts";

/** Milliseconds per frame at the rate most displays run at. */
const SIXTY_HZ_MILLIS = 1000.0 / 60.0;

/** Milliseconds per frame on a 120 Hz display. */
const ONE_TWENTY_HZ_MILLIS = 1000.0 / 120.0;

/** A nanosecond in milliseconds; too small to change any decision, so any shift it causes came from the frame clock alone. */
const ONE_NANOSECOND_MILLIS = 1e-6;

/** Scenario the runs are compared on: busy enough that cars fill up and turn passengers away. */
const SCENARIO: WorldOptions = {
  floorCount: 6,
  elevatorCount: 3,
  spawnRate: 1.5,
  elevatorCapacities: [5],
};

/** Frames of the 60 Hz run; at 1.5 passengers a second, some 90 spawns. */
const BASE_FRAMES = 3600;

/** Fewest passengers a comparison is allowed to be made on; a short prefix could pass by luck. */
const MIN_SPAWNS_COMPARED = 60;

/** Fewest deliveries a run must make before it counts as driven. */
const MIN_TRANSPORTED = 20;

/**
 * Fewest floor-button presses a run must emit before it counts as driven.
 * Naturally rare: pressing an already-lit button emits nothing.
 */
const MIN_BUTTON_PRESSES = 20;

/** One passenger, as the seed decides them. */
interface Spawn {
  /** Floor they appeared on. */
  readonly from: number;
  /** Floor they want to reach. */
  readonly to: number;
  /** Their weight, which is the first draw a spawn makes. */
  readonly weight: number;
  /** How they are drawn, which is the second and third. */
  readonly displayType: string | undefined;
  /**
   * Floor-button presses the run had already emitted when this passenger appeared.
   * Lets a comparison over a shared prefix of passengers also compare the building's
   * mechanics up to that point, not just who arrived.
   */
  readonly buttonPressesSoFar: number;
  /** Passengers already delivered when this passenger appeared. */
  readonly transportedSoFar: number;
}

/** Everything one run of the probe observed. */
interface ProbeRun {
  /** The passengers, in the order they appeared. */
  readonly spawns: readonly Spawn[];
  /** Passengers delivered, i.e. walk-off durations drawn. */
  readonly transported: number;
  /** Floor-button presses, i.e. button-repress offsets drawn. */
  readonly buttonPresses: number;
}

/** How long each frame of a schedule lasts, in milliseconds. */
type FrameSchedule = (frameIndex: number) => number;

/** A frame clock whose step length can vary per frame, unlike {@link "./frame-requester.ts"!createFrameRequester}'s constant step. */
function scheduledFrameRequester(schedule: FrameSchedule): {
  register: (cb: (t: number) => void) => void;
  trigger: (frameIndex: number) => void;
} {
  let currentT = 0.0;
  let currentCb: ((t: number) => void) | null = null;
  return {
    register(cb: (t: number) => void): void {
      currentCb = cb;
    },
    trigger(frameIndex: number): void {
      currentT += schedule(frameIndex);
      if (currentCb !== null) {
        currentCb(currentT);
      }
    },
  };
}

/**
 * A plausible solution that actually plays the game rather than standing still, so walk-off
 * and button-repress draws happen. It behaves differently at 60 vs. 120 Hz on purpose — what
 * must survive is the passenger sequence, not the run itself.
 */
function directionalProgram(): UserCodeObject {
  return {
    init(elevators, floors): void {
      const handleCall = (floorNum: number): void => {
        let best = at(elevators, 0);
        for (const elevator of elevators) {
          if (elevator.destinationQueue.length < best.destinationQueue.length) {
            best = elevator;
          }
        }
        if (!best.destinationQueue.includes(floorNum)) {
          best.goToFloor(floorNum);
        }
      };
      for (const floor of floors) {
        floor.on("up_button_pressed down_button_pressed", () => {
          handleCall(floor.floorNum());
        });
      }
      for (const elevator of elevators) {
        elevator.on("floor_button_pressed", (floorNum) => {
          if (!elevator.destinationQueue.includes(floorNum)) {
            elevator.goToFloor(floorNum);
          }
        });
        elevator.on("idle", () => {
          elevator.goToFloor(0);
        });
      }
    },
    update(_dt, elevators): void {
      for (const elevator of elevators) {
        const direction = elevator.destinationDirection();
        elevator.goingUpIndicator(direction !== "down");
        elevator.goingDownIndicator(direction !== "up");
      }
    },
  };
}

/**
 * Runs one seed to a schedule through the real controller (not `world.update` directly),
 * so the probe is cut into ticks the same way a browser's frame schedule would be.
 * @throws When the player program fails, which would make the comparison meaningless.
 */
function probe(seed: RandomSeed, schedule: FrameSchedule, frameCount: number): ProbeRun {
  const world = createWorld(SCENARIO, seed);

  // Counted off the floors, not the player-facing facades: these are the same events World
  // re-offers a standing car on, so each one is exactly one button-repress draw.
  let buttonPresses = 0;
  for (const floor of world.floors) {
    floor.on("up_button_pressed down_button_pressed", () => {
      buttonPresses++;
    });
  }

  const spawns: Spawn[] = [];
  world.on("new_user", (user) => {
    spawns.push({
      from: user.currentFloor,
      to: user.destinationFloor,
      weight: user.weight,
      displayType: user.displayType,
      buttonPressesSoFar: buttonPresses,
      transportedSoFar: world.transportedCounter,
    });
  });

  const errors: unknown[] = [];
  const controller = createWorldController(TICK_SECONDS);
  controller.on("usercode_error", (e) => {
    errors.push(e);
  });
  const frames = scheduledFrameRequester(schedule);
  controller.start(world, directionalProgram(), frames.register, true);
  for (let frameIndex = 0; frameIndex < frameCount && !controller.isPaused; frameIndex++) {
    frames.trigger(frameIndex);
  }
  if (errors.length > 0) {
    throw new Error(`Player program failed during the probe: ${String(at(errors, 0))}`);
  }
  return { spawns, transported: world.transportedCounter, buttonPresses };
}

/**
 * Fails unless the run actually took the draws the comparison is about; a run where the
 * elevators never move would pass by proving only that the generator is a generator.
 */
function expectRunIsMeaningful(run: ProbeRun): void {
  expect(run.spawns.length).toBeGreaterThanOrEqual(MIN_SPAWNS_COMPARED);
  expect(run.transported).toBeGreaterThanOrEqual(MIN_TRANSPORTED);
  expect(run.buttonPresses).toBeGreaterThanOrEqual(MIN_BUTTON_PRESSES);
}

/**
 * Two runs of one seed must meet the same passengers and move the same building. Spawn
 * counts may differ by one from float rounding in the accumulator's running sum; `transported`
 * and `buttonPresses` are compared exactly, since both depend only on ticks elapsed.
 */
function expectSamePassengers(actual: ProbeRun, expected: ProbeRun): void {
  expectRunIsMeaningful(actual);
  expectRunIsMeaningful(expected);
  expect(Math.abs(actual.spawns.length - expected.spawns.length)).toBeLessThanOrEqual(1);
  const compared = Math.min(actual.spawns.length, expected.spawns.length);
  expect(compared).toBeGreaterThanOrEqual(MIN_SPAWNS_COMPARED);
  expect(actual.spawns.slice(0, compared)).toEqual(expected.spawns.slice(0, compared));
  expect(actual.transported).toBe(expected.transported);
  expect(actual.buttonPresses).toBe(expected.buttonPresses);
}

/** Seeds the comparison is made on; three, so one lucky stream cannot pass it. */
const SEEDS: readonly RandomSeed[] = ["issue-61", 12345, "frame-rate"];

describe("a seed replays the same passengers however the frames fall", () => {
  it.each(SEEDS)("holds between 60 Hz and 120 Hz (seed %s)", (seed) => {
    // Twice the frames for half the step, so both cover the same simulated stretch.
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const oneTwenty = probe(seed, () => ONE_TWENTY_HZ_MILLIS, BASE_FRAMES * 2);

    expectSamePassengers(oneTwenty, sixty);
  });

  it.each(SEEDS)("holds when every frame is a nanosecond longer (seed %s)", (seed) => {
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const nudged = probe(seed, () => SIXTY_HZ_MILLIS + ONE_NANOSECOND_MILLIS, BASE_FRAMES);

    expectSamePassengers(nudged, sixty);
  });

  it.each(SEEDS)("holds when the frame lengths wander (seed %s)", (seed) => {
    // A fixed jitter pattern rather than a random one, so a failure reproduces from the file alone.
    const jitter: FrameSchedule = (frameIndex) =>
      SIXTY_HZ_MILLIS * (1 + 0.4 * Math.sin(frameIndex * 1.7) + (frameIndex % 97 === 0 ? 1.5 : 0));
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const wandering = probe(seed, jitter, BASE_FRAMES * 2);

    // Only the prefix: a wandering clock covers a different stretch of simulated time, but
    // each spawn carries the running mechanics counts, so an equal prefix means equal mechanics too.
    expectRunIsMeaningful(wandering);
    expectRunIsMeaningful(sixty);
    const compared = Math.min(wandering.spawns.length, sixty.spawns.length);
    expect(compared).toBeGreaterThanOrEqual(MIN_SPAWNS_COMPARED);
    expect(wandering.spawns.slice(0, compared)).toEqual(sixty.spawns.slice(0, compared));
  });
});
