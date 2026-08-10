/**
 * Drives a {@link "./world.ts"!World} from animation frames, running player
 * code once per frame and substepping the simulation.
 *
 * Ported from the `createWorldController` half of the legacy `world.js`.
 */

import type { ElevatorInterface } from "./elevator-interface.ts";
import type { Floor } from "./floor.ts";
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
   * @param floors - The building's floors.
   */
  init(elevators: readonly ElevatorInterface[], floors: readonly Floor[]): void;
  /**
   * Called once per animation frame.
   *
   * @param dt - Simulated seconds since the previous frame.
   * @param elevators - The elevator facades.
   * @param floors - The building's floors.
   */
  update(dt: number, elevators: readonly ElevatorInterface[], floors: readonly Floor[]): void;
}

/** The part of a world a {@link WorldController} drives. */
export interface ControllableWorld {
  /** Whether the challenge is over and the world should stop updating. */
  challengeEnded: boolean;
  /** The elevator facades handed to player code. */
  readonly elevatorInterfaces: readonly ElevatorInterface[];
  /** The building's floors. */
  readonly floors: readonly Floor[];
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
    world.on("usercode_error", (e) => {
      this.handleUserCodeError(e);
    });
    const updater = (t: number): void => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        if (firstUpdate) {
          firstUpdate = false;
          // This logic prevents infite loops in usercode from breaking the page permanently - don't evaluate user code until game is unpaused.
          try {
            codeObj.init(world.elevatorInterfaces, world.floors);
            world.init();
          } catch (e) {
            this.handleUserCodeError(e);
          }
        }

        const dt = t - lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.#dtMax * 3 * this.timeScale); // Limit to prevent unhealthy substepping
        try {
          codeObj.update(scaledDt, world.elevatorInterfaces, world.floors);
        } catch (e) {
          this.handleUserCodeError(e);
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- world.update() can end the challenge mid-loop, which defeats the narrowing above
        while (scaledDt > 0.0 && !world.challengeEnded) {
          const thisDt = Math.min(this.#dtMax, scaledDt);
          world.update(thisDt);
          // Note: the remaining time is reduced by the full dtMax rather than
          // by the step actually taken, so a final partial step is charged as a
          // whole one. Preserved from the original.
          scaledDt -= this.#dtMax;
        }
        world.updateDisplayPositions();
        world.trigger("stats_display_changed"); // TODO: Trigger less often for performance reasons etc
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
   */
  handleUserCodeError(e: unknown): void {
    this.setPaused(true);
    console.log("Usercode error on update", e);
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
