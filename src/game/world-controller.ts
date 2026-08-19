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
   * Called once per simulation tick, at the fixed rate {@link TICK_SECONDS}.
   *
   * @param dt - Always {@link TICK_SECONDS}: the tick is fixed, not derived
   * from real frame timing.
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
 * Duration of one simulation tick, in seconds.
 *
 * Both {@link UserCodeObject.update} and the world's own physics advance by
 * exactly this much per tick, however many real animation frames that takes
 * or however few — a run is a pure function of how many ticks have elapsed,
 * not of how the browser's frame timer happened to divide them up. 100 a
 * second was picked as a round number comfortably above any display's
 * refresh rate, so a real frame ordinarily advances the simulation by
 * several whole ticks rather than raising the question of what a fraction of
 * one would mean.
 */
export const TICK_SECONDS = 1 / 100;

/**
 * Most ticks a single real animation frame is allowed to run.
 *
 * Bounds two different situations by the same number, deliberately: a
 * browser stall, where real time jumps far ahead of the last frame, and a
 * high {@link WorldController.timeScale}, where a single ordinary frame
 * already represents several seconds of simulated time. Both hand the
 * accumulator more than {@link TICK_SECONDS} at once, and both would turn
 * into an unbounded run of synchronous {@link UserCodeObject.update} calls —
 * player code runs on the main thread with no sandbox timeout — if nothing
 * capped it. `100 * TICK_SECONDS` is one simulated second per real frame,
 * matching what a stalled browser is allowed to catch up by; any time beyond
 * that is dropped rather than queued, so fast-forwarding at the interface's
 * maximum 64x only falls slightly short of nominal speed on a 60Hz display,
 * and not at all above it.
 */
export const MAX_TICKS_PER_FRAME = 100;

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

  readonly #tickSeconds: number;

  /**
   * @param tickSeconds - Fixed duration of one simulation tick, in seconds.
   * Both `codeObj.update` and the world's physics advance by exactly this
   * much per tick; real call sites pass {@link TICK_SECONDS}, and tests may
   * pass another value to exercise the tick loop at a resolution of their
   * own choosing.
   */
  constructor(tickSeconds: number) {
    super();
    this.#tickSeconds = tickSeconds;
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
    // Carries whatever real time a frame did not have enough of to make a
    // whole tick. Deliberately never reset except by the cap below: a tick
    // owed by one frame is paid by however many frames it takes, which is
    // what makes the run a function of elapsed time rather than of how that
    // time was divided into frames.
    let accumulator = 0;
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
        accumulator += dt * 0.001 * this.timeScale;
        // Bounds a stalled browser and a high timeScale by the same rule: at
        // most MAX_TICKS_PER_FRAME ticks — and so at most that many
        // synchronous, unsandboxed codeObj.update calls — run off one real
        // frame. Time beyond that is dropped, not queued, which is what
        // keeps a very long stall from spending the next several seconds
        // catching up frame by frame.
        accumulator = Math.min(accumulator, MAX_TICKS_PER_FRAME * this.#tickSeconds);

        // Ticks available this frame are computed by one division rather than
        // by counting how many times tickSeconds can be subtracted out of the
        // accumulator: subtracting the same not-quite-representable fraction
        // up to MAX_TICKS_PER_FRAME times drifts under the threshold before
        // reaching zero (1.0 - 0.01 * 99 is 0.009999999999999247, not 0.01),
        // which silently ran one tick short of the cap every time the
        // accumulator actually sat at it. A single division does not
        // accumulate that error.
        const ticksAvailable = Math.min(
          Math.floor(accumulator / this.#tickSeconds),
          MAX_TICKS_PER_FRAME,
        );
        let ticksRun = 0;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- world.update() can end the challenge mid-loop, which defeats the narrowing above
        while (ticksRun < ticksAvailable && !world.challengeEnded) {
          try {
            codeObj.update(this.#tickSeconds, world.elevatorInterfaces, world.floorInterfaces);
          } catch (e) {
            this.handleUserCodeError(e, "update");
            // The tick this update was for did not happen: its time is still
            // owed, so it is left out of ticksRun below rather than counted,
            // and no more ticks run this frame — codeObj is now known to
            // throw, and setPaused above stops the next frame from trying
            // again on its own.
            break;
          }
          world.update(this.#tickSeconds);
          ticksRun++;
        }
        accumulator -= ticksRun * this.#tickSeconds;
        world.updateDisplayPositions();
        // Every frame, deliberately. `legacy-1.x:world.js:256` wanted this
        // triggered less often "for performance reasons"; there are none to
        // recover. The sole consumer is `presentStats` in what was
        // `src/ui/presenters.ts`, which writes one number into one span per
        // row of the panel, and one dispatch of it cost about 1.3
        // microseconds — measured over 200k dispatches against the laid-out
        // panel of the built page in headless
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
 * @param tickSeconds - Fixed duration of one simulation tick, in seconds.
 * @returns The new controller.
 */
export function createWorldController(tickSeconds: number): WorldController {
  return new WorldController(tickSeconds);
}
