import { describe, expect, it, vi } from "vitest";

import {
  INSTANT_RUN_BURST_BUDGET_MS,
  INSTANT_RUN_MAX_SIMULATED_SECONDS,
  driveInstantly,
} from "./instant-run.ts";
import type { ControllableWorld, UserCodeObject } from "./world-controller.ts";

/** A {@link ControllableWorld} whose tick count and end condition a test controls directly. */
interface FakeWorld extends ControllableWorld {
  /** How many times {@link ControllableWorld.update} has been called. */
  ticks: number;
  /** Total simulated seconds passed to {@link ControllableWorld.update} so far. */
  elapsedSeconds: number;
}

/**
 * A minimal {@link ControllableWorld} for driving {@link driveInstantly}
 * without a real building, seed or passenger stream.
 *
 * Standing in for the `stats_changed`-driven verdict a real caller (see
 * `src/pages/game/index.ts`'s `#startRun`) reaches on its own: `driveInstantly` never
 * decides a level is over by itself, so a fixture that wants to end one
 * has to flip `levelEnded` the same way a caller would, from inside
 * `update`.
 *
 * @param endAfterTicks - Sets `levelEnded` once `update` has been called
 * this many times, or leaves the level undecided forever when omitted.
 * @returns The fake world.
 */
function createFakeWorld(endAfterTicks: number | null = null): FakeWorld {
  const world: FakeWorld = {
    levelEnded: false,
    elevatorInterfaces: [],
    floorInterfaces: [],
    ticks: 0,
    elapsedSeconds: 0,
    update(dt: number): void {
      world.ticks += 1;
      world.elapsedSeconds += dt;
      if (endAfterTicks !== null && world.ticks >= endAfterTicks) {
        world.levelEnded = true;
      }
    },
    init(): void {
      // Nothing: none of the fixtures below register elevator or floor handlers.
    },
    updateDisplayPositions(): void {
      // Nothing to redraw in a headless test.
    },
    on(event: "usercode_error", handler: (e: unknown) => void): unknown {
      // Nothing in these fixtures makes the world itself raise this — only
      // `WorldController` does, when `codeObj.init`/`update` throws — so no
      // subscription here is ever exercised; `handler` is kept only to give
      // this stub something to do with it besides discard it.
      return { event, handler };
    },
    trigger(event: "stats_display_changed"): unknown {
      return event;
    },
  };
  return world;
}

/**
 * Player code that does nothing at all.
 *
 * @returns A valid but inert code object.
 */
function inertCodeObj(): UserCodeObject {
  return {
    init(): void {
      // Nothing.
    },
    update(): void {
      // Nothing.
    },
  };
}

/**
 * Player code whose `update` always throws, standing in for a broken program.
 *
 * `init` is left inert rather than also throwing, so a test can tell the two
 * failure sites apart by how many times its `usercode_error` handler fired.
 *
 * @param message - The thrown error's message.
 * @returns A code object that fails on its first tick.
 */
function updateThrowingCodeObj(message: string): UserCodeObject {
  return {
    init(): void {
      // Nothing: this fixture only needs `update` to fail.
    },
    update(): void {
      throw new Error(message);
    },
  };
}

/**
 * A `now` stand-in that reports a burst as already over its budget from its
 * second call onward.
 *
 * `driveInstantly`'s own burst loop calls `now()` once at the start of a
 * burst and once more after every triggered frame; returning a value that
 * grows by just over {@link INSTANT_RUN_BURST_BUDGET_MS} on every call makes
 * the second of those calls always read as "over budget", which forces a
 * burst to stop after exactly one call to the frame requester — the same
 * outcome a genuinely slow frame would produce, without waiting on real
 * wall-clock time.
 *
 * @returns The stand-in.
 */
function createBudgetExceedingNow(): () => number {
  let calls = 0;
  return (): number => {
    const value = calls * (INSTANT_RUN_BURST_BUDGET_MS + 1);
    calls += 1;
    return value;
  };
}

describe("driveInstantly", () => {
  it("resolves within a single burst when the level ends quickly, without yielding", () => {
    const world = createFakeWorld(1);
    const scheduleYield = vi.fn();

    const handle = driveInstantly(world, inertCodeObj(), { scheduleYield });

    expect(world.levelEnded).toBe(true);
    expect(handle.controller.isPaused).toBe(false);
    expect(scheduleYield).not.toHaveBeenCalled();
  });

  it("yields to the event loop once a burst runs past its budget", () => {
    const world = createFakeWorld();
    const scheduleYield = vi.fn();

    driveInstantly(world, inertCodeObj(), {
      now: createBudgetExceedingNow(),
      scheduleYield,
    });

    expect(scheduleYield).toHaveBeenCalledTimes(1);
    expect(scheduleYield).toHaveBeenCalledWith(expect.any(Function));
    expect(world.levelEnded).toBe(false);
  });

  it("keeps making progress across yielded bursts until the level ends", () => {
    // Ends partway through the second burst that actually ticks the world —
    // the very first call to the frame requester only registers the
    // controller's updater and does no simulated work, exactly as the
    // animated path's first animation frame does not either.
    const world = createFakeWorld(150);
    const scheduleYield = vi.fn((callback: () => void) => {
      callback();
    });

    driveInstantly(world, inertCodeObj(), {
      now: createBudgetExceedingNow(),
      scheduleYield,
    });

    expect(world.ticks).toBe(150);
    expect(world.levelEnded).toBe(true);
    // Each tick is TICK_SECONDS of simulated time; 150 of them is 1.5s
    // simulated, regardless of how many bursts of wall-clock time it took.
    expect(world.elapsedSeconds).toBeCloseTo(1.5);
    // One yield between the registration-only first frame and the first
    // ticking one, and one more between that frame and the one that reaches
    // the verdict — two, for three calls to the frame requester in total.
    expect(scheduleYield).toHaveBeenCalledTimes(2);
  });

  it("does no further work once canceled, even if a stale continuation still fires", () => {
    const world = createFakeWorld();
    let pending: (() => void) | undefined;
    const scheduleYield = vi.fn((callback: () => void) => {
      pending = callback;
    });

    const handle = driveInstantly(world, inertCodeObj(), {
      now: createBudgetExceedingNow(),
      scheduleYield,
    });

    expect(pending).toBeDefined();
    handle.cancel();
    const ticksBeforeStaleFire = world.ticks;

    // Stands in for a `setTimeout` that was already queued before `cancel()`
    // ran — abandoning a crunch does not un-schedule it, it only has to make
    // whatever still fires a no-op.
    pending?.();

    expect(world.ticks).toBe(ticksBeforeStaleFire);
    expect(world.levelEnded).toBe(false);
  });

  it("surfaces a player-code error through onController, and stops the crunch", () => {
    const world = createFakeWorld();
    const scheduleYield = vi.fn();
    const onUserCodeError = vi.fn();

    // Subscribing off the handle `driveInstantly` returns, instead of
    // through `onController`, would already be too late for this exact
    // error: `update` throws on the very first ticking frame, which happens
    // synchronously inside this call, before there is a handle to subscribe
    // to. `onController` runs before a single tick has, which is not too late.
    const handle = driveInstantly(world, updateThrowingCodeObj("boom"), {
      scheduleYield,
      onController: (controller) => {
        controller.on("usercode_error", onUserCodeError);
      },
    });

    expect(onUserCodeError).toHaveBeenCalledTimes(1);
    expect(onUserCodeError).toHaveBeenCalledWith(expect.any(Error));
    expect(handle.controller.isPaused).toBe(true);
    // A controller a thrown error has paused never produces another tick, so
    // nothing driven by `world.update` — a verdict, the ceiling — can ever
    // fire either; the level is left exactly as undecided as it was.
    expect(world.levelEnded).toBe(false);
    // Stopped by noticing its own frames have stopped doing anything, not by
    // running out of budget: no burst here ever got the chance to overrun.
    expect(scheduleYield).not.toHaveBeenCalled();
  });

  it("uses a real timer to yield between bursts when no scheduler is injected", async () => {
    const world = createFakeWorld(150);

    const handle = driveInstantly(world, inertCodeObj(), {
      now: createBudgetExceedingNow(),
    });

    // The default scheduler is a real `setTimeout(callback, 0)`; one macrotask
    // turn is enough for both yielded continuations the `now` stand-in forces
    // to run in turn and the level to reach its verdict.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(world.levelEnded).toBe(true);
    expect(handle.controller.isPaused).toBe(false);
  });
});

describe("INSTANT_RUN_MAX_SIMULATED_SECONDS", () => {
  it("stays comfortably above the longest built-in level's own time limit", () => {
    // Level 18 (`levels[17]` in `levels.ts`) resolves its own
    // condition at exactly 1800 simulated seconds — the longest limit any
    // built-in level carries. A ceiling at or below that would be
    // indistinguishable from the level's own verdict rather than a
    // last resort for one that never arrives.
    expect(INSTANT_RUN_MAX_SIMULATED_SECONDS).toBeGreaterThan(1800);
  });
});
