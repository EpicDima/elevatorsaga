/**
 * Drives a {@link "./world-controller.ts"!WorldController} to the end of a
 * level with nothing rendered along the way, as fast as the CPU allows.
 *
 * This is not the same thing as the app's time scale: that still renders,
 * only faster, and is capped at 64x by
 * `src/features/adjust-speed/model/time-scale.ts`. Here nothing
 * is drawn at all while the simulation runs, and there is no cap other than
 * wall-clock chunking (see {@link INSTANT_RUN_BURST_BUDGET_MS}) and the
 * ceiling below.
 *
 * Deliberately does none of the deciding. {@link WorldController.start}'s own
 * `updater` closure already stops re-registering itself the moment
 * `world.levelEnded` becomes `true` — that is the stopping contract this
 * module relies on, the same one the animated path relies on. Whoever calls
 * {@link driveInstantly} is the one that watches for a verdict (a level
 * condition resolving, or a ceiling) and sets `levelEnded`; this module
 * only keeps feeding the controller frames, in budgeted bursts, until that
 * flag flips.
 *
 * The one thing this module does decide on its own is a player's program
 * throwing: a controller that {@link WorldController.handleUserCodeError}
 * has paused is never going to produce another tick, so nothing driven by
 * `world.update` -- a condition resolving, the ceiling, `stats_changed`
 * itself -- can ever flip `levelEnded` either. Stopping there as well is
 * this module noticing its own frames have stopped doing anything, not a
 * second opinion about whether the level is over.
 */

import { createFrameRequester } from "./frame-requester.ts";
import type { ControllableWorld, UserCodeObject } from "./world-controller.ts";
import { TICK_SECONDS, WorldController, createWorldController } from "./world-controller.ts";

/**
 * Simulated-time ceiling, in seconds, past which a crunch gives up on ever
 * getting a verdict.
 *
 * Exists for the runs no amount of correct play resolves on its own —
 * a sandbox, or a move-bound level
 * (`requireUserCountWithinMoves` and its wait-limited sibling in
 * `levels.ts` never look at elapsed time at all) — and, more importantly,
 * for a broken player program against an ordinary level: an elevator that
 * never moves leaves even a time-limited condition sitting at `null` forever,
 * because most of those only check the clock once a passenger has been
 * delivered or the limit passed. Without a ceiling a bad program would hang
 * the crunch, silently, with nothing on screen to show for it.
 *
 * 1900 was picked against the built-in levels' own limits: the longest,
 * level 18 (`levels[17]`, `requireUserCountWithinTimeWithMaxWaitTime
 * (2675, 1800, 45)`), resolves itself at 1800s simulated exactly (its
 * `evaluate` uses `>=`), so anything past that is a level whose own
 * condition was never going to fire. A hundred seconds of headroom is enough
 * that the ceiling is never mistaken for the level's own limit while
 * staying nowhere near what a real crunch costs in wall time — see the
 * measurement in the module doc comment above for what that time actually
 * costs.
 */
export const INSTANT_RUN_MAX_SIMULATED_SECONDS = 1900;

/**
 * Most wall-clock milliseconds a single synchronous burst of frames is
 * allowed to run before yielding back to the event loop.
 *
 * Measured against the worst realistic case: a move-bound level
 * (`levels[6]`, no time limit in its own condition) driven by a no-op
 * program, so nothing ever ends it before the ceiling above — 1900 simulated
 * seconds, 1902 frame callbacks, each costing up to roughly 3ms on an Apple
 * Silicon Mac in headless Chromium. Run with no chunking at all that totalled
 * about 2.8 seconds of unbroken main-thread work, comfortably past the
 * roughly half-second a tab can go unresponsive before a player notices.
 * Chunking at this budget keeps any one synchronous stretch at a small
 * multiple of a single frame's cost — an order of magnitude under that half
 * second — while still letting the common case, which resolves in a handful
 * of milliseconds total, finish in its first and only burst.
 */
export const INSTANT_RUN_BURST_BUDGET_MS = 32;

/**
 * Milliseconds of simulated time one driven frame advances the controller by.
 *
 * `WorldController` caps a single frame at `MAX_TICKS_PER_FRAME * TICK_SECONDS`
 * — one simulated second — however much real time the frame callback reports
 * having taken (`world-controller.ts` explains why: it is the same clamp that
 * bounds a stalled browser). 1000ms is exactly enough real time, at this
 * controller's default 1x time scale, to saturate that cap on every frame, so
 * each call to {@link driveInstantly}'s frame requester always advances the
 * simulation by the most a frame is allowed to: 100 ticks.
 */
const SYNTHETIC_FRAME_MILLISECONDS = 1000;

/** A crunch in progress. */
export interface InstantRunHandle {
  /**
   * The private controller driving the crunch.
   *
   * Not the app's shared controller — see {@link driveInstantly} — which is
   * why a caller cares about this run's own events at all. Subscribing here,
   * on the returned handle, is too late to catch an `init` that throws on the
   * very first tick: a small enough level reaches its own verdict, and a
   * broken program can throw, entirely inside the call to
   * {@link driveInstantly} that produced this handle, before the caller ever
   * sees it. {@link InstantRunDriverOptions.onController} is the hook that
   * is not too late.
   */
  readonly controller: WorldController;
  /**
   * Stops the crunch from doing any further work.
   *
   * For abandoning a run nobody is waiting on any more (the player started
   * another one before this one reached a verdict). Safe to call more than
   * once, and safe to call after the crunch already finished on its own.
   */
  cancel(): void;
}

/** Injectable timing for {@link driveInstantly}, so tests can drive it deterministically. */
export interface InstantRunDriverOptions {
  /**
   * Wall-clock timestamp source, in milliseconds.
   *
   * Defaults to `performance.now`. Tests substitute a counter they control,
   * so a burst's length can be dictated exactly rather than raced against.
   */
  readonly now?: () => number;
  /**
   * Schedules the next burst once the current one has spent its budget.
   *
   * Defaults to `setTimeout(callback, 0)`. `requestIdleCallback` was
   * considered — the level that suggested chunking named it as an option —
   * and rejected: it does not exist in Safari, and its whole contract is
   * "run this when the browser is otherwise idle", which is the opposite of
   * what a crunch wants. Deferring to `setTimeout` still yields to input,
   * paint and every other pending level between bursts; it just does not wait
   * for a lull before resuming.
   */
  readonly scheduleYield?: (callback: () => void) => void;
  /**
   * Called once, with the private controller, the instant it exists and
   * before it has driven a single tick.
   *
   * The only safe place to subscribe to that controller's own events —
   * `usercode_error` above all. `driveInstantly` can run a whole crunch to
   * completion, synchronously, before it ever returns a handle, so a
   * subscription added afterwards can already be too late to hear about an
   * `init` that threw on the first tick of a level small enough to decide
   * itself in one burst.
   */
  readonly onController?: (controller: WorldController) => void;
}

/**
 * Runs a world to its conclusion with nothing rendered, as fast as the CPU
 * allows.
 *
 * Reuses the exact same `WorldController` and fixed-tick loop an animated run
 * uses — `world-controller.ts` is not forked or reimplemented — driven
 * through {@link "./frame-requester.ts"!createFrameRequester} instead of
 * `requestAnimationFrame`, the same stand-in the tutorial sweep and the
 * fitness benchmark already drive it with. What is new here is only the
 * outer loop deciding *when* to call `trigger()`: as fast as it can, in
 * bursts capped at {@link INSTANT_RUN_BURST_BUDGET_MS} of wall time, yielding
 * between them so a long crunch cannot be mistaken for a hung tab.
 *
 * A fresh, private controller is created for every call rather than reusing
 * a caller's shared one. That is what makes {@link InstantRunHandle.cancel}
 * safe: an abandoned crunch's callbacks belong to a controller nothing else
 * touches, so they can never tick a world a newer run has already replaced.
 *
 * @param world - The world to drive. Its `levelEnded` flag is read, not
 * written, by this function — the caller is the one that decides a verdict
 * and sets it, exactly as the animated path's `stats_changed` handler already
 * does.
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
    // `controller.isPaused` alongside `world.levelEnded`: `start` below is
    // always called with `autoStart: true`, and nothing in this module ever
    // pauses the controller again, so the only way it can be paused once
    // `runBurst` is running is `WorldController.handleUserCodeError` -- a
    // player's `init` or `update` that threw. That pause is permanent: once
    // `codeObj.update` has thrown, `WorldController.start`'s own tick loop
    // stops calling `world.update`, so a `stats_changed`-driven verdict --
    // the ceiling included, since it reads `world.elapsedTime` -- can never
    // fire either. Without this check a broken program would not stop the
    // crunch; it would only stop it from doing anything, forever, one
    // `setTimeout` at a time.
    if (canceled || world.levelEnded || controller.isPaused) {
      return;
    }
    const burstStart = now();
    // `canceled` is not re-checked inside the loop: nothing in it can set
    // `cancel`'s flag mid-burst, since JS is single-threaded and `trigger()`
    // only ever runs the controller's own tick loop and the player's code, not
    // this handle's `cancel`. The check above is enough -- it runs again at
    // the top of every burst, including the one a caller's `cancel()` is
    // always sandwiched before.
    do {
      frameRequester.trigger();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- trigger() can end the level or pause the controller mid-loop, which defeats the narrowing above, exactly as in world-controller.ts's own tick loop
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
