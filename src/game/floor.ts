/** A floor of the building: call buttons or destination-dispatch bookings, never both; see {@link Floor.destinationDispatch}. */

import { Observable, type EventName } from "./observable.ts";

/** Whether a call button is lit; the CSS class string, since the presenter renders it directly. */
export type ButtonState = "" | "activated";

/** Lit state of a floor's two call buttons. */
export interface FloorButtonStates {
  /** The up call button. */
  up: ButtonState;
  /** The down call button. */
  down: ButtonState;
}

/** The part of an elevator a floor needs to clear a button or hold a booking. */
export interface FloorElevator {
  /** Whether the elevator advertises that it is going up. */
  readonly goingUpIndicator: boolean;
  /** Whether the elevator advertises that it is going down. */
  readonly goingDownIndicator: boolean;
  /** Whether the elevator serves a floor at all. */
  serves(floorNum: number): boolean;
}

/** Events emitted by {@link Floor}. */
export type FloorEvents = {
  /** Either call button was lit or cleared. */
  buttonstate_change: [buttonStates: FloorButtonStates];
  /** Someone pressed the up call button. */
  up_button_pressed: [floor: Floor];
  /** Someone pressed the down call button. */
  down_button_pressed: [floor: Floor];
  /** Someone here wants to reach a floor and no car is booked to take them. */
  destination_requested: [floor: Floor, destinationFloor: number];
  /** A car was booked to take this floor's passengers to a destination. */
  elevator_assigned: [floor: Floor, destinationFloor: number, elevator: FloorElevator];
  /**
   * The book of who is waiting for which floor reads differently now.
   * Its own event because a second passenger bound for an already-booked floor, or a boarding, changes the book without also firing the other two events.
   * Engine-only; {@link FloorInterface} doesn't forward it, so it may fire even when nothing visibly changed.
   */
  destinations_change: [floor: Floor];
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
  /** Whether this floor takes calls by destination instead of by direction; the call buttons stay dark either way. */
  readonly destinationDispatch: boolean;

  readonly #errorHandler: FloorErrorHandler;

  /** How many people here are waiting for each destination floor. */
  readonly #waiting = new Map<number, number>();

  /** The car booked for each destination, while somebody is waiting for it. */
  readonly #assigned = new Map<number, FloorElevator>();

  constructor(
    floorLevel: number,
    yPosition: number,
    errorHandler: FloorErrorHandler,
    destinationDispatch = false,
  ) {
    super();
    this.level = floorLevel;
    this.yPosition = yPosition;
    this.#errorHandler = errorHandler;
    this.destinationDispatch = destinationDispatch;
  }

  /**
   * Emits an event, routing handler exceptions to the error handler.
   * No re-entrancy guard: a floor legitimately re-raises the same event from inside itself (a repress from a passenger refused by a full car), and that nested dispatch must go through — {@link FloorInterface} is what guards player code from it.
   */
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
   * Files a request to be taken to a floor.
   * Emits `destination_requested` only when no car is booked for it yet; the count is raised first, so a handler that books a car inline finds somebody to book it for.
   */
  requestDestination(destinationFloor: number): void {
    this.#waiting.set(destinationFloor, (this.#waiting.get(destinationFloor) ?? 0) + 1);
    this.#tryTrigger("destinations_change", this);
    if (!this.#assigned.has(destinationFloor)) {
      this.#tryTrigger("destination_requested", this, destinationFloor);
    }
  }

  /**
   * Books the car that will take this floor's passengers to a destination.
   * Refuses a car that can't serve both ends of the trip, and refuses a booking nobody is waiting on — either would strand the floor.
   * Emits only on an actual change, so rebooking the same car every frame is silent.
   */
  assignElevator(destinationFloor: number, elevator: FloorElevator): boolean {
    if (!this.#waiting.has(destinationFloor)) {
      return false;
    }
    if (!elevator.serves(this.level) || !elevator.serves(destinationFloor)) {
      return false;
    }
    if (this.#assigned.get(destinationFloor) === elevator) {
      return true;
    }
    this.#assigned.set(destinationFloor, elevator);
    this.#tryTrigger("destinations_change", this);
    this.#tryTrigger("elevator_assigned", this, destinationFloor, elevator);
    return true;
  }

  /** The car booked to take this floor's passengers to `destinationFloor`, or `null` if none. */
  assignedElevator(destinationFloor: number): FloorElevator | null {
    return this.#assigned.get(destinationFloor) ?? null;
  }

  /**
   * How many people here are waiting for each destination floor.
   * Returns the live map, not a snapshot — the facade handed to player code is what copies it.
   */
  pendingDestinations(): ReadonlyMap<number, number> {
    return this.#waiting;
  }

  /**
   * Records that somebody boarded the car booked for `destinationFloor`.
   * Withdraws the booking once the last person waiting on it boards, so the next passenger for that floor books a car of their own.
   */
  destinationBoarded(destinationFloor: number): void {
    const stillWaiting = (this.#waiting.get(destinationFloor) ?? 0) - 1;
    if (stillWaiting > 0) {
      this.#waiting.set(destinationFloor, stillWaiting);
    } else {
      this.#waiting.delete(destinationFloor);
      this.#assigned.delete(destinationFloor);
    }
    this.#tryTrigger("destinations_change", this);
  }

  /**
   * Withdraws the car booked for a destination and asks for another.
   * Called when a full car leaves without everyone who was waiting for it, so those passengers aren't left waiting on a booking nobody will honor.
   */
  destinationRefused(destinationFloor: number): void {
    this.#assigned.delete(destinationFloor);
    this.#tryTrigger("destinations_change", this);
    if (this.#waiting.has(destinationFloor)) {
      this.#tryTrigger("destination_requested", this, destinationFloor);
    }
  }

  /**
   * Clears the call buttons an arriving elevator can serve, matching only its
   * lit indicators, with one `buttonstate_change` per button.
   *
   * A car that does not serve this floor clears nothing, whatever its
   * indicators say: it can still arrive here, and a lamp cleared by a car
   * nobody on this floor may board is a passenger the building has forgotten.
   *
   * @param elevator - The elevator that just became available.
   */
  elevatorAvailable(elevator: FloorElevator): void {
    if (!elevator.serves(this.level)) {
      return;
    }
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
