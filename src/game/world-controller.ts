/**
 * Drives a {@link "./world.ts"!World} from animation frames, running player code once
 * per frame and substepping the simulation.
 */

import type { ElevatorInterface } from "./elevator-interface.ts";
import type { FloorInterface } from "./floor-interface.ts";
import { Observable } from "./observable.ts";

/** The player-supplied object driving the elevators. */
export interface UserCodeObject {
  /** Called once, when the level starts. */
  init(elevators: readonly ElevatorInterface[], floors: readonly FloorInterface[]): void;
  /**
   * Called once per simulation tick, at the fixed rate {@link TICK_SECONDS}.
   * @param dt - Always {@link TICK_SECONDS}: the tick is fixed, not derived from real frame timing.
   */
  update(
    dt: number,
    elevators: readonly ElevatorInterface[],
    floors: readonly FloorInterface[],
  ): void;
}

/** The part of a world a {@link WorldController} drives. */
export interface ControllableWorld {
  /** Whether the level is over and the world should stop updating. */
  levelEnded: boolean;
  /** The elevator facades handed to player code. */
  readonly elevatorInterfaces: readonly ElevatorInterface[];
  /** The floor facades handed to player code. */
  readonly floorInterfaces: readonly FloorInterface[];
  /**
   * Advances the simulation.
   * @param dt - Simulated seconds to advance.
   */
  update(dt: number): void;
  /** Raises the world's initial events. */
  init(): void;
  /** Refreshes the cached world positions everything is drawn at. */
  updateDisplayPositions(): void;
  /** Subscribes to the world's player-code error event. */
  on(event: "usercode_error", handler: (e: unknown) => void): unknown;
  /** Asks the view to refresh the statistics display. */
  trigger(event: "stats_display_changed"): unknown;
}

/** Schedules a callback for the next animation frame. */
export type AnimationFrameRequester = (callback: (t: number) => void) => void;

/**
 * Duration of one simulation tick, in seconds. Both {@link UserCodeObject.update} and the
 * world's physics advance by exactly this much per tick, so a run depends only on ticks
 * elapsed, not on frame timing. 100 ticks/second comfortably exceeds any display's refresh rate.
 */
export const TICK_SECONDS = 1 / 100;

/**
 * Most ticks a single real animation frame may run. Bounds a browser stall and a high
 * {@link WorldController.timeScale} by the same cap, since either could otherwise trigger
 * unbounded, unsandboxed {@link UserCodeObject.update} calls; excess time is dropped, not queued.
 */
export const MAX_TICKS_PER_FRAME = 100;

/** Which part of the player's program was running when it threw: `init` runs once, `update` runs every frame, and a handler runs whenever the building calls it. */
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
  /**
   * Whether each frame ends by refreshing what is drawn. Set it to `false` before
   * {@link start} for a world nobody is watching: the simulation reads neither the
   * cached world positions nor the statistics display, and a headless run spends a
   * third of its time keeping them current for a view that isn't there.
   */
  updatesDisplay = true;

  readonly #tickSeconds: number;

  /**
   * @param tickSeconds - Fixed simulation tick duration in seconds; real call sites pass
   * {@link TICK_SECONDS}, and tests may pass another value.
   */
  constructor(tickSeconds: number) {
    super();
    this.#tickSeconds = tickSeconds;
  }

  /**
   * Starts driving a world. Player code is not evaluated until first unpaused, so an
   * infinite loop in `init` cannot break the page permanently.
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
    // Real time a frame did not have enough of to make a whole tick; never reset except
    // by the cap below, so an owed tick carries over to later frames.
    let accumulator = 0;
    // The world only ever calls player code from an event handler.
    world.on("usercode_error", (e) => {
      this.handleUserCodeError(e, "an event handler");
    });
    const updater = (t: number): void => {
      if (!this.isPaused && !world.levelEnded && lastT !== null) {
        if (firstUpdate) {
          firstUpdate = false;
          try {
            codeObj.init(world.elevatorInterfaces, world.floorInterfaces);
            world.init();
          } catch (e) {
            this.handleUserCodeError(e, "init");
          }
        }

        const dt = t - lastT;
        accumulator += dt * 0.001 * this.timeScale;
        accumulator = Math.min(accumulator, MAX_TICKS_PER_FRAME * this.#tickSeconds);

        // Computed by one division rather than repeated subtraction: subtracting the same
        // not-quite-representable fraction up to MAX_TICKS_PER_FRAME times drifts under the
        // threshold before reaching zero, silently running one tick short of the cap.
        const ticksAvailable = Math.min(
          Math.floor(accumulator / this.#tickSeconds),
          MAX_TICKS_PER_FRAME,
        );
        let ticksRun = 0;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- world.update() can end the level mid-loop, which defeats the narrowing above
        while (ticksRun < ticksAvailable && !world.levelEnded) {
          try {
            codeObj.update(this.#tickSeconds, world.elevatorInterfaces, world.floorInterfaces);
          } catch (e) {
            this.handleUserCodeError(e, "update");
            // This tick's time is still owed, so it stays out of ticksRun; setPaused above
            // stops the next frame from retrying.
            break;
          }
          world.update(this.#tickSeconds);
          ticksRun++;
        }
        accumulator -= ticksRun * this.#tickSeconds;
        if (this.updatesDisplay) {
          world.updateDisplayPositions();
          // Every frame, deliberately, so the stats panel always matches what's on screen;
          // the cost of dispatching it is negligible.
          world.trigger("stats_display_changed");
        }
      }
      lastT = t;
      if (!world.levelEnded) {
        animationFrameRequester(updater);
      }
    };
    if (autoStart) {
      this.setPaused(false);
    }
    animationFrameRequester(updater);
  }

  /** Pauses the simulation and reports a player-code failure. */
  handleUserCodeError(e: unknown, site: UserCodeSite): void {
    this.setPaused(true);
    console.log(`Usercode error in ${site}`, e);
    this.trigger("usercode_error", e);
  }

  /** Freezes or resumes the simulation. */
  setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.trigger("timescale_changed");
  }

  /** Changes how fast simulated time runs. */
  setTimeScale(timeScale: number): void {
    this.timeScale = timeScale;
    this.trigger("timescale_changed");
  }
}

/** Creates a world controller. */
export function createWorldController(tickSeconds: number): WorldController {
  return new WorldController(tickSeconds);
}
