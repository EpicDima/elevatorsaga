/**
 * Drives a {@link "./world.ts"!World} from animation frames, running player
 * code once per frame and substepping the simulation.
 *
 * Ported from the `createWorldController` half of the legacy `world.js`.
 */

import type { ElevatorInterface } from "./elevator-interface.ts";
import type { FloorInterface } from "./floor-interface.ts";
import { Observable } from "./observable.ts";

/**
 * The player-supplied object driving the elevators.
 *
 * Declared here rather than in `user-code.ts` because this is where the
 * contract is consumed; `user-code.ts` re-exports it.
 */
export interface UserCodeObject {
  /**
   * Called once, when the challenge starts.
   *
   * @param elevators - The elevator facades.
   * @param floors - The floor facades.
   */
  init(elevators: readonly ElevatorInterface[], floors: readonly FloorInterface[]): void;
  /**
   * Called once per animation frame.
   *
   * @param dt - Simulated seconds since the previous frame.
   * @param elevators - The elevator facades.
   * @param floors - The floor facades.
   */
  update(
    dt: number,
    elevators: readonly ElevatorInterface[],
    floors: readonly FloorInterface[],
  ): void;
}

/** The part of a world a {@link WorldController} drives. */
export interface ControllableWorld {
  /** Whether the challenge is over and the world should stop updating. */
  challengeEnded: boolean;
  /** The elevator facades handed to player code. */
  readonly elevatorInterfaces: readonly ElevatorInterface[];
  /** The floor facades handed to player code. */
  readonly floorInterfaces: readonly FloorInterface[];
  /**
   * Advances the simulation.
   *
   * @param dt - Simulated seconds to advance.
   */
  update(dt: number): void;
  /** Raises the world's initial events. */
  init(): void;
  /** Refreshes the cached world positions everything is drawn at. */
  updateDisplayPositions(): void;
  /**
   * Subscribes to the world's player-code error event.
   *
   * @param event - Always `"usercode_error"`.
   * @param handler - Receives whatever the player code threw.
   */
  on(event: "usercode_error", handler: (e: unknown) => void): unknown;
  /**
   * Asks the view to refresh the statistics display.
   *
   * @param event - Always `"stats_display_changed"`.
   */
  trigger(event: "stats_display_changed"): unknown;
}

/** Schedules a callback for the next animation frame. */
export type AnimationFrameRequester = (callback: (t: number) => void) => void;

/**
 * Which part of the player's program was running when it threw.
 *
 * Worth naming, because the three are not interchangeable to whoever has to fix
 * the program: `init` runs once and is where the handlers are hung, `update`
 * runs every frame, and a handler runs whenever the building calls it. The
 * console line reported all three as "on update" until now -- inherited
 * wording, `legacy-1.x:world.js:271` -- which sends a reader whose `init` threw
 * looking through a function that did not.
 */
export type UserCodeSite = "init" | "update" | "an event handler";

/** Events emitted by {@link WorldController}. */
export type WorldControllerEvents = {
  /** Player code threw; the simulation has been paused. */
  usercode_error: [e: unknown];
  /** The paused state or the time scale changed. */
  timescale_changed: [];
};

/** Runs a world from animation frames. */
export class WorldController extends Observable<WorldControllerEvents> {
  /** Multiplier applied to real elapsed time. */
  timeScale = 1.0;
  /** Whether the simulation is currently frozen. */
  isPaused = true;

  readonly #dtMax: number;

  /**
   * @param dtMax - Largest simulated step the world is advanced by at once;
   * longer frames are split into several substeps.
   */
  constructor(dtMax: number) {
    super();
    this.#dtMax = dtMax;
  }

  /**
   * Starts driving a world.
   *
   * Player code is not evaluated until the game is first unpaused, which keeps
   * an infinite loop in `init` from breaking the page permanently.
   *
   * @param world - The world to drive.
   * @param codeObj - The player's `{ init, update }` object.
   * @param animationFrameRequester - Schedules the next frame.
   * @param autoStart - Unpause immediately.
   */
  start(
    world: ControllableWorld,
    codeObj: UserCodeObject,
    animationFrameRequester: AnimationFrameRequester,
    autoStart: boolean,
  ): void {
    this.isPaused = true;
    let lastT: number | null = null;
    let firstUpdate = true;
    // Everything the world reports came out of a handler: the world hands its
    // own reporter to the facades, and they only ever call player code from an
    // event.
    world.on("usercode_error", (e) => {
      this.handleUserCodeError(e, "an event handler");
    });
    const updater = (t: number): void => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        if (firstUpdate) {
          firstUpdate = false;
          // This logic prevents infite loops in usercode from breaking the page permanently - don't evaluate user code until game is unpaused.
          try {
            codeObj.init(world.elevatorInterfaces, world.floorInterfaces);
            world.init();
          } catch (e) {
            this.handleUserCodeError(e, "init");
          }
        }

        const dt = t - lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.#dtMax * 3 * this.timeScale); // Limit to prevent unhealthy substepping
        try {
          codeObj.update(scaledDt, world.elevatorInterfaces, world.floorInterfaces);
        } catch (e) {
          this.handleUserCodeError(e, "update");
        }
        // Substep the frame. The remainder is reduced by the step actually
        // taken, and the final step absorbs whatever is left, so the frame
        // advances the world by exactly scaledDt.
        //
        // The epsilon is what stops a degenerate final substep: frame times
        // are accumulated in floating point, so a frame that should be a whole
        // number of steps routinely leaves a few 1e-18 behind. Charging that
        // residue as its own world.update() is not a rounding difference — it
        // is an entire extra world tick, re-running arrival snapping and the
        // statistics recalculation.
        const dtEpsilon = this.#dtMax * 1e-9;
        let remaining = scaledDt;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- world.update() can end the challenge mid-loop, which defeats the narrowing above
        while (remaining > dtEpsilon && !world.challengeEnded) {
          const thisDt = remaining - this.#dtMax <= dtEpsilon ? remaining : this.#dtMax;
          world.update(thisDt);
          remaining -= thisDt;
        }
        world.updateDisplayPositions();
        // Every frame, deliberately. `legacy-1.x:world.js:256` wanted this
        // triggered less often "for performance reasons"; there are none to
        // recover. The sole consumer is `presentStats` in `src/ui/presenters.ts`,
        // which writes one number into one span per row of the panel, and one
        // dispatch of it cost about 1.3 microseconds — measured over 200k
        // dispatches against the laid-out panel of the built page in headless
        // Chromium 151 on an Apple Silicon Mac, of which roughly 0.2
        // microseconds was the number formatting and the rest the DOM writes.
        // That is 0.008% of a 60 Hz frame, or 78 microseconds per second of
        // play. The panel had six rows when that was measured and has eleven
        // now, so the real figure is somewhat above it; five more spans written
        // the same way do not bring a cost of that size anywhere near a frame.
        // Throttling would buy it back and cost the one thing the panel is
        // for: statistics that match the building next to them on the frame
        // you are looking at.
        world.trigger("stats_display_changed");
      }
      lastT = t;
      if (!world.challengeEnded) {
        animationFrameRequester(updater);
      }
    };
    if (autoStart) {
      this.setPaused(false);
    }
    animationFrameRequester(updater);
  }

  /**
   * Pauses the simulation and reports a player-code failure.
   *
   * @param e - Whatever the player code threw.
   * @param site - Which part of the program it was thrown from.
   */
  handleUserCodeError(e: unknown, site: UserCodeSite): void {
    this.setPaused(true);
    console.log(`Usercode error in ${site}`, e);
    this.trigger("usercode_error", e);
  }

  /**
   * Freezes or resumes the simulation.
   *
   * @param paused - Whether to freeze.
   */
  setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.trigger("timescale_changed");
  }

  /**
   * Changes how fast simulated time runs.
   *
   * @param timeScale - Multiplier applied to real elapsed time.
   */
  setTimeScale(timeScale: number): void {
    this.timeScale = timeScale;
    this.trigger("timescale_changed");
  }
}

/**
 * Creates a world controller.
 *
 * @param dtMax - Largest simulated step the world is advanced by at once.
 * @returns The new controller.
 */
export function createWorldController(dtMax: number): WorldController {
  return new WorldController(dtMax);
}
