/**
 * A floor of the building: the up/down call buttons and their state.
 *
 * Ported from the legacy `floor.js`, which mixed these members into a plain
 * object via `asFloor({}, ...)`. The `tryTrigger` wrapper is kept: floor events
 * are delivered straight into player code, so an exception thrown by a handler
 * must be routed to the world's error handler rather than unwinding the
 * simulation.
 */

import { Observable, type EventName } from "./observable.ts";

/**
 * Whether a call button is lit.
 *
 * The legacy code stored the CSS-ish strings `""` and `"activated"` rather than
 * booleans and the presenter still renders them directly, so they are kept.
 */
export type ButtonState = "" | "activated";

/** Lit state of a floor's two call buttons. */
export interface FloorButtonStates {
  /** The up call button. */
  up: ButtonState;
  /** The down call button. */
  down: ButtonState;
}

/** The part of an elevator a floor needs in order to clear its call buttons. */
export interface FloorElevator {
  /** Whether the elevator advertises that it is going up. */
  readonly goingUpIndicator: boolean;
  /** Whether the elevator advertises that it is going down. */
  readonly goingDownIndicator: boolean;
}

/** Events emitted by {@link Floor}. */
export type FloorEvents = {
  /** Either call button was lit or cleared. */
  buttonstate_change: [buttonStates: FloorButtonStates];
  /** Someone pressed the up call button. */
  up_button_pressed: [floor: Floor];
  /** Someone pressed the down call button. */
  down_button_pressed: [floor: Floor];
};

/** Vertical offset from a floor's y position to where passengers stand. */
const SPAWN_POS_Y_OFFSET = 30;

/** Called with anything a floor event handler throws. */
export type FloorErrorHandler = (e: unknown) => void;

/** One floor of the building. */
export class Floor extends Observable<FloorEvents> {
  /** Floor number, counting up from 0 at the bottom. */
  readonly level: number;
  /** World y of the floor; smaller values are higher up. */
  readonly yPosition: number;
  /** Lit state of the two call buttons. */
  readonly buttonStates: FloorButtonStates = { up: "", down: "" };

  readonly #errorHandler: FloorErrorHandler;

  /**
   * @param floorLevel - Floor number, counting up from 0 at the bottom.
   * @param yPosition - World y of the floor.
   * @param errorHandler - Receives anything an event handler throws.
   */
  constructor(floorLevel: number, yPosition: number, errorHandler: FloorErrorHandler) {
    super();
    this.level = floorLevel;
    this.yPosition = yPosition;
    this.#errorHandler = errorHandler;
  }

  /**
   * Emits an event, diverting handler exceptions to the error handler.
   *
   * Floor events reach player code, which must not be able to break the
   * simulation by throwing. Errors are isolated per handler, so one player
   * handler throwing does not stop the others from running (upstream issues
   * #88, #83, #27).
   *
   * A plain {@link Observable}, deliberately, so this dispatch has no
   * re-entrancy guard. A floor really does raise the same event from inside
   * itself — a passenger refused by a full car presses the button again while
   * `*_button_pressed` is still in flight — and `World.handleButtonRepressing`
   * has to run for the nested call as it does for any other, not least because
   * it draws from the shared `Math.random` stream before it decides there is
   * nothing to do. Player code is still protected: the events are forwarded to
   * a {@link "./floor-interface.ts"!FloorInterface}, whose emitter is a
   * {@link PlayerObservable} and does refuse the nested forward.
   *
   * @param event - Event to emit.
   * @param args - Arguments for that event.
   */
  // TODO: Ideally the floor should have a facade where tryTrigger is done
  #tryTrigger<K extends EventName<FloorEvents>>(event: K, ...args: FloorEvents[K]): void {
    this.triggerSafe(event, this.#errorHandler, ...args);
  }

  /** Lights the up call button, emitting nothing if it was already lit. */
  pressUpButton(): void {
    const prev = this.buttonStates.up;
    this.buttonStates.up = "activated";
    if (prev !== this.buttonStates.up) {
      this.#tryTrigger("buttonstate_change", this.buttonStates);
      this.#tryTrigger("up_button_pressed", this);
    }
  }

  /** Lights the down call button, emitting nothing if it was already lit. */
  pressDownButton(): void {
    const prev = this.buttonStates.down;
    this.buttonStates.down = "activated";
    if (prev !== this.buttonStates.down) {
      this.#tryTrigger("buttonstate_change", this.buttonStates);
      this.#tryTrigger("down_button_pressed", this);
    }
  }

  /**
   * Clears the call buttons an arriving elevator can serve.
   *
   * Only the buttons matching the elevator's lit indicators are cleared, and a
   * separate `buttonstate_change` is emitted for each, as in the original.
   *
   * @param elevator - The elevator that just became available.
   */
  elevatorAvailable(elevator: FloorElevator): void {
    if (elevator.goingUpIndicator && this.buttonStates.up !== "") {
      this.buttonStates.up = "";
      this.#tryTrigger("buttonstate_change", this.buttonStates);
    }
    if (elevator.goingDownIndicator && this.buttonStates.down !== "") {
      this.buttonStates.down = "";
      this.#tryTrigger("buttonstate_change", this.buttonStates);
    }
  }

  /**
   * World y at which passengers appear on this floor.
   *
   * @returns The spawn y coordinate.
   */
  getSpawnPosY(): number {
    return this.yPosition + SPAWN_POS_Y_OFFSET;
  }

  /**
   * This floor's number.
   *
   * @returns The floor number, counting up from 0 at the bottom.
   */
  floorNum(): number {
    return this.level;
  }
}
