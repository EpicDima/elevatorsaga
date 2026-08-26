/**
 * Drives a {@link "./world-controller.ts"!WorldController} to the end of a
 * level with nothing rendered, as fast as the CPU allows. The caller must
 * set `world.levelEnded` on a verdict; this module only feeds frames, in
 * budgeted bursts, until that flag flips (or the controller pauses on a thrown user program).
 */

import { createFrameRequester } from "./frame-requester.ts";
import type { ControllableWorld, UserCodeObject } from "./world-controller.ts";
import { TICK_SECONDS, WorldController, createWorldController } from "./world-controller.ts";

/**
 * Simulated-time ceiling, in seconds, past which a crunch gives up on ever
 * getting a verdict, so a broken player program can't hang it silently. Set
 * 100s past the built-in levels' longest own time limit (level 18, 1800s).
 */
export const INSTANT_RUN_MAX_SIMULATED_SECONDS = 1900;

/** Most wall-clock milliseconds a single synchronous burst of frames runs before yielding, so a long crunch can't freeze the tab. */
export const INSTANT_RUN_BURST_BUDGET_MS = 32;

/**
 * Milliseconds of simulated time one driven frame advances the controller by.
 * Large enough to saturate `WorldController`'s one-simulated-second-per-frame
 * cap every time, so each frame always advances by the maximum: 100 ticks.
 */
const SYNTHETIC_FRAME_MILLISECONDS = 1000;

/** A crunch in progress. */
export interface InstantRunHandle {
  /**
   * The private controller driving the crunch, not the app's shared one.
   * Subscribing here can be too late to catch an `init` that throws on the
   * first tick; use {@link InstantRunDriverOptions.onController} instead.
   */
  readonly controller: WorldController;
  /** Stops the crunch. Safe to call more than once, or after it already finished. */
  cancel(): void;
}

/** Injectable timing for {@link driveInstantly}, so tests can drive it deterministically. */
export interface InstantRunDriverOptions {
  /** Wall-clock timestamp source, in milliseconds. Defaults to `performance.now`; tests substitute a controllable counter. */
  readonly now?: () => number;
  /** Schedules the next burst once the current one spends its budget. Defaults to `setTimeout(callback, 0)`. */
  readonly scheduleYield?: (callback: () => void) => void;
  /**
   * Called once with the private controller before it drives a single tick —
   * the only safe place to subscribe, since `driveInstantly` can run a whole
   * crunch to completion, synchronously, before it returns a handle.
   */
  readonly onController?: (controller: WorldController) => void;
}

/**
 * Runs a world to conclusion with nothing rendered, as fast as the CPU
 * allows, reusing the same `WorldController` and tick loop an animated run
 * uses. Each call gets its own private controller, so an abandoned crunch
 * can never tick a world a newer run has already replaced.
 *
 * @param world - `levelEnded` is read, not written, here; the caller sets it on a verdict.
 * @param codeObj - The player's `{ init, update }` object.
 * @param options - Injectable timing, for tests.
 * @returns A handle to the running crunch.
 */
export function driveInstantly(
  world: ControllableWorld,
  codeObj: UserCodeObject,
  options: InstantRunDriverOptions = {},
): InstantRunHandle {
  const now = options.now ?? ((): number => performance.now());
  const scheduleYield =
    options.scheduleYield ??
    ((callback: () => void): void => {
      setTimeout(callback, 0);
    });

  const controller = createWorldController(TICK_SECONDS);
  options.onController?.(controller);
  const frameRequester = createFrameRequester(SYNTHETIC_FRAME_MILLISECONDS);
  let canceled = false;

  const runBurst = (): void => {
    // A paused controller means the player's code threw; nothing will ever
    // flip `levelEnded` after that, so treat it like the level ending.
    if (canceled || world.levelEnded || controller.isPaused) {
      return;
    }
    const burstStart = now();
    // Not re-checked mid-loop: JS is single-threaded, so nothing here can
    // flip `canceled` before the next burst's check at the top.
    do {
      frameRequester.trigger();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- trigger() can end the level or pause the controller mid-loop
      if (world.levelEnded || controller.isPaused) {
        return;
      }
    } while (now() - burstStart < INSTANT_RUN_BURST_BUDGET_MS);
    scheduleYield(runBurst);
  };

  controller.start(world, codeObj, frameRequester.register, true);
  runBurst();

  return {
    controller,
    cancel(): void {
      canceled = true;
      controller.setPaused(true);
    },
  };
}
