/**
 * What a seed promises, measured against a frame clock that is never the same
 * twice.
 *
 * The game pins a run with `#level=4,seed=12345` and tells the player that
 * the same seed gives the same building, the same passengers, and now — since
 * both {@link "./world-controller.ts"!UserCodeObject.update} and the world's
 * physics advance in fixed {@link "./world-controller.ts"!TICK_SECONDS} ticks
 * regardless of real frame timing — the same building's mechanics too: car
 * positions, arrival timing, button-press counts. None of that was true before
 * the fixed-tick rewrite, when `dt` in `WorldController.start` was a real
 * `requestAnimationFrame` delta and a player program reading elevator state
 * made different decisions at different frame rates even while meeting
 * identical passengers.
 *
 * So these tests do the one thing a determinism test has to do — vary the thing
 * that used to vary in the browser and confirm it no longer matters. Two runs
 * of one seed are driven through the real
 * {@link "./world-controller.ts"!WorldController}, with a player program that
 * actually moves the elevators, at frame schedules that differ: 60 Hz against
 * 120 Hz, 60 Hz against 60 Hz plus a nanosecond, and 60 Hz against a jittered
 * clock. A test that ran both sides on the same fixed step, or with nobody
 * driving the elevators, would assert nothing more than that a deterministic
 * generator is deterministic: with the cars parked, nobody is ever delivered
 * and no boarding is ever refused, so neither of the draws that can shift the
 * spawn stream is ever taken, and every button-press count is zero regardless
 * of the frame schedule. {@link expectRunIsMeaningful} is what keeps that from
 * happening quietly here.
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

/**
 * A nanosecond, in milliseconds.
 *
 * The smallest disturbance worth calling a frame time: added to every frame it
 * changes no decision the player program makes and no floor any elevator
 * reaches, so anything it moves was resting on the frame clock alone.
 */
const ONE_NANOSECOND_MILLIS = 1e-6;

/**
 * The scenario the runs are compared on.
 *
 * The benchmark's medium scenario (see
 * {@link "./fitness.ts"!fitnessChallenges}): busy enough that cars fill up and
 * turn passengers away, small enough that a run is a few milliseconds.
 */
const SCENARIO: WorldOptions = {
  floorCount: 6,
  elevatorCount: 3,
  spawnRate: 1.5,
  elevatorCapacities: [5],
};

/** Frames of the 60 Hz run; at 1.5 passengers a second, some 90 spawns. */
const BASE_FRAMES = 3600;

/**
 * Fewest passengers a comparison is allowed to be made on.
 *
 * A short prefix would pass by luck: the divergence this suite exists to catch
 * has been seen as late as the 23rd passenger.
 */
const MIN_SPAWNS_COMPARED = 60;

/** Fewest deliveries a run must make before it counts as driven. */
const MIN_TRANSPORTED = 20;

/**
 * Fewest floor-button presses a run must emit before it counts as driven.
 *
 * One per button-repress draw. Far fewer than there are passengers, and that is
 * expected rather than a weak bound: pressing a button that is already lit emits
 * nothing, so on a busy six-floor building most arrivals join a call that is
 * already outstanding.
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
   * Floor-button presses the run had already emitted when this passenger
   * appeared.
   *
   * Carried on the spawn itself so a comparison over a shared prefix of
   * passengers — the only kind two differently-timed schedules can make — is
   * also a comparison of the building's mechanics up to that point, not just
   * of who arrived.
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

/**
 * A frame clock whose steps may differ from one another.
 *
 * {@link "./frame-requester.ts"!createFrameRequester} steps by a constant, which
 * is the one thing a real display never does; this wraps it so a schedule can
 * decide each step. Only the most recently registered callback is kept, as
 * there too.
 *
 * @param schedule - Length of each frame, in milliseconds.
 * @returns A requester and the trigger that advances it.
 */
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
 * A plausible solution: directional service with the calls spread over the cars.
 *
 * Deliberately a program that plays the game rather than one that stands still.
 * It delivers passengers, so walk-off durations are drawn; it rewrites the
 * indicators every frame, so cars turn passengers away and those passengers
 * press the call button again; and every decision it makes is a function of
 * where the cars are, which is a function of `dt`. That last part is the point:
 * this program does *not* behave identically at 60 and 120 Hz, and it is not
 * supposed to. What has to survive is the passenger sequence, not the run.
 *
 * @returns The program.
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
 * Runs one seed to a schedule and writes down every passenger it produced.
 *
 * Driven through the real controller rather than by calling `world.update`
 * directly, so the probe exercises the same fixed-tick accumulator a real
 * frame schedule does: however the frames in `schedule` fall, they are cut
 * into the same {@link "./world-controller.ts"!TICK_SECONDS} ticks a browser's
 * `requestAnimationFrame` schedule would produce.
 *
 * @param seed - Seed to replay.
 * @param schedule - Length of each frame, in milliseconds.
 * @param frameCount - Frames to run.
 * @returns What the run produced.
 * @throws When the player program failed, which would end the run early and
 * make the comparison meaningless.
 */
function probe(seed: RandomSeed, schedule: FrameSchedule, frameCount: number): ProbeRun {
  const world = createWorld(SCENARIO, seed);

  // Counted off the floors themselves rather than off the player-facing
  // facades: these are the very events World subscribes to in order to re-offer
  // a standing car, so one of these is exactly one button-repress draw.
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
 * Fails unless the run actually took the draws the comparison is about.
 *
 * The trap this suite is written against: a determinism test that drives a
 * world nobody is playing proves only that the generator is a generator. If the
 * elevators never move, nobody is delivered and no walk-off duration is drawn;
 * if no car is ever full or wrongly signposted, no passenger presses a button a
 * second time. Both counts are asserted so that a future change which quietly
 * stops the program from playing turns this suite red instead of green.
 *
 * @param run - The run to check.
 */
function expectRunIsMeaningful(run: ProbeRun): void {
  expect(run.spawns.length).toBeGreaterThanOrEqual(MIN_SPAWNS_COMPARED);
  expect(run.transported).toBeGreaterThanOrEqual(MIN_TRANSPORTED);
  expect(run.buttonPresses).toBeGreaterThanOrEqual(MIN_BUTTON_PRESSES);
}

/**
 * Asserts two runs of one seed met the same passengers and moved the same
 * building.
 *
 * Compared over the shorter of the two, and the lengths are allowed to differ
 * by one. That is not slack in the property, which is exact — the Nth passenger
 * is decided by the Nth group of draws and by nothing else — but a residue of
 * floating-point summation: the controller's accumulator is a running sum of
 * per-frame additions, and 60 additions of `dt/60` and 120 additions of
 * `dt/120` can round to a sum a float epsilon apart even though the schedules
 * cover the same simulated seconds, which can occasionally shift the last tick
 * of a long run by one. Requiring exactly equal counts would make the suite
 * fail for the one reason it does not care about.
 *
 * `transported` and `buttonPresses` carry no such slack: both are compared
 * exactly, because a run's mechanics are now — since both player code and
 * world physics advance in fixed {@link "./world-controller.ts"!TICK_SECONDS}
 * ticks regardless of real frame timing — a pure function of how many ticks
 * elapsed, and that count is identical between two schedules unless the rare
 * accumulator rounding above has already shifted it, in which case the spawn
 * comparison above catches it first.
 *
 * @param actual - The run under test.
 * @param expected - The run it must agree with.
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
    // The comparison the browser actually makes: the same URL opened on two
    // machines. Twice the frames for half the step, so both cover the same
    // simulated stretch of the run.
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const oneTwenty = probe(seed, () => ONE_TWENTY_HZ_MILLIS, BASE_FRAMES * 2);

    expectSamePassengers(oneTwenty, sixty);
  });

  it.each(SEEDS)("holds when every frame is a nanosecond longer (seed %s)", (seed) => {
    // The sharper form of the same question. A nanosecond a frame is far below
    // anything the simulation can notice on its own, so if this moves a
    // passenger, the passenger was riding on the frame clock.
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const nudged = probe(seed, () => SIXTY_HZ_MILLIS + ONE_NANOSECOND_MILLIS, BASE_FRAMES);

    expectSamePassengers(nudged, sixty);
  });

  it.each(SEEDS)("holds when the frame lengths wander (seed %s)", (seed) => {
    // What a real browser hands over: frames that are never twice the same,
    // occasionally long enough that the controller splits one into several
    // world steps. The schedule is a fixed pattern rather than a random one so
    // that a failure here is reproducible from the file alone.
    const jitter: FrameSchedule = (frameIndex) =>
      SIXTY_HZ_MILLIS * (1 + 0.4 * Math.sin(frameIndex * 1.7) + (frameIndex % 97 === 0 ? 1.5 : 0));
    const sixty = probe(seed, () => SIXTY_HZ_MILLIS, BASE_FRAMES);
    const wandering = probe(seed, jitter, BASE_FRAMES * 2);

    // Only the prefix: a wandering clock covers a different stretch of
    // simulated time, so the run lengths have nothing to say to each other.
    // The comparison below still checks mechanics, not just identity — each
    // spawn carries the button-press and delivery counts the run had already
    // made when that passenger appeared, so an equal prefix is an equal
    // building up to the last passenger compared, not just an equal queue of
    // arrivals.
    expectRunIsMeaningful(wandering);
    expectRunIsMeaningful(sixty);
    const compared = Math.min(wandering.spawns.length, sixty.spawns.length);
    expect(compared).toBeGreaterThanOrEqual(MIN_SPAWNS_COMPARED);
    expect(wandering.spawns.slice(0, compared)).toEqual(sixty.spawns.slice(0, compared));
  });
});
