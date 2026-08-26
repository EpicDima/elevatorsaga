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
 * without a real building. `driveInstantly` never ends a level itself, so a
 * fixture must flip `levelEnded` from inside `update`, like a real caller would.
 *
 * @param endAfterTicks - Ends the level after this many `update` calls; omit for an undecided level.
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
      // Nothing.
    },
    updateDisplayPositions(): void {
      // Nothing.
    },
    on(event: "usercode_error", handler: (e: unknown) => void): unknown {
      // Only `WorldController` raises this, never the world itself, so this
      // subscription is never exercised by these fixtures.
      return { event, handler };
    },
    trigger(event: "stats_display_changed"): unknown {
      return event;
    },
  };
  return world;
}

/** Player code that does nothing at all. */
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
 * Player code whose `update` always throws. `init` stays inert, so a test
 * can tell the two failure sites apart by how many times `usercode_error` fired.
 */
function updateThrowingCodeObj(message: string): UserCodeObject {
  return {
    init(): void {
      // Nothing.
    },
    update(): void {
      throw new Error(message);
    },
  };
}

/**
 * A `now` stand-in that reports a burst as over budget from its second call
 * onward, forcing a burst to stop after exactly one call to the frame
 * requester without waiting on real wall-clock time.
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
    // The first call to the frame requester only registers the controller's
    // updater and does no simulated work, like the animated path's first frame.
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
    // Each tick is TICK_SECONDS of simulated time.
    expect(world.elapsedSeconds).toBeCloseTo(1.5);
    // One yield before the first ticking frame, one more before the frame
    // that reaches the verdict: two, for three frame-requester calls total.
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

    // Stands in for an already-queued setTimeout: cancel() must make it a no-op, not un-schedule it.
    pending?.();

    expect(world.ticks).toBe(ticksBeforeStaleFire);
    expect(world.levelEnded).toBe(false);
  });

  it("surfaces a player-code error through onController, and stops the crunch", () => {
    const world = createFakeWorld();
    const scheduleYield = vi.fn();
    const onUserCodeError = vi.fn();

    // Subscribing via the returned handle would be too late: `update` throws
    // synchronously on the first tick, before a handle exists to subscribe to.
    const handle = driveInstantly(world, updateThrowingCodeObj("boom"), {
      scheduleYield,
      onController: (controller) => {
        controller.on("usercode_error", onUserCodeError);
      },
    });

    expect(onUserCodeError).toHaveBeenCalledTimes(1);
    expect(onUserCodeError).toHaveBeenCalledWith(expect.any(Error));
    expect(handle.controller.isPaused).toBe(true);
    // A paused controller never ticks again, so no verdict can ever fire.
    expect(world.levelEnded).toBe(false);
    // No burst here ever got the chance to overrun its budget.
    expect(scheduleYield).not.toHaveBeenCalled();
  });

  it("uses a real timer to yield between bursts when no scheduler is injected", async () => {
    const world = createFakeWorld(150);

    const handle = driveInstantly(world, inertCodeObj(), {
      now: createBudgetExceedingNow(),
    });

    // The default scheduler is a real setTimeout(callback, 0); one macrotask
    // turn is enough to reach the verdict.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(world.levelEnded).toBe(true);
    expect(handle.controller.isPaused).toBe(false);
  });
});

describe("INSTANT_RUN_MAX_SIMULATED_SECONDS", () => {
  it("stays comfortably above the longest built-in level's own time limit", () => {
    // Level 18 resolves at exactly 1800 simulated seconds, the longest limit any built-in level carries.
    expect(INSTANT_RUN_MAX_SIMULATED_SECONDS).toBeGreaterThan(1800);
  });
});
