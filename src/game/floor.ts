/**
 * A floor of the building: the up/down call buttons and their state.
 *
 * Ported from the legacy `floor.js`, which mixed these members into a plain
 * object via `asFloor({}, ...)`. The `tryTrigger` wrapper is kept: floor events
 * are delivered straight into player code, so an exception thrown by a handler
 * must be routed to the world's error handler rather than unwinding the
 * simulation.
 *
 * A floor built for destination dispatch keeps a second, richer kind of call
 * instead: a book of who is waiting for which floor and which car was named to
 * take them. The two kinds do not mix on one floor — see
 * {@link Floor.destinationDispatch}.
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

/** The part of an elevator a floor needs to clear a button or hold a booking. */
export interface FloorElevator {
  /** Whether the elevator advertises that it is going up. */
  readonly goingUpIndicator: boolean;
  /** Whether the elevator advertises that it is going down. */
  readonly goingDownIndicator: boolean;
  /**
   * Whether the elevator serves a floor at all.
   *
   * Required rather than optional, though every car built before zoning
   * existed answers `true` to everything. This interface is the contract — the
   * specs build `FloorElevator` literals directly rather than real elevators —
   * so an optional method would be a rule that only the real class states, and
   * a branch nothing here can reach.
   *
   * @param floorNum - Floor to ask about.
   * @returns `true` when the elevator serves that floor.
   */
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
   *
   * Its own event because the two above cannot be added up into it: the second
   * person bound for a floor a car is already coming for is deliberately not
   * announced, and neither boarding nor a withdrawn booking is announced at
   * all. Anything keeping its own count from those two would drift within a
   * single arrival and never come back.
   *
   * Engine-only, and unguarded because of it. The other events are silent when
   * nothing changed because they reach player code; this one says "read the
   * book again", so raising it over an unchanged book costs a redraw of the
   * same panel and nothing else. `FloorInterface` does not forward it — a
   * program that wants the book calls `pendingDestinations`.
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
  /**
   * Whether this floor takes calls by destination rather than by direction.
   *
   * Its passengers name the floor they want and wait for whichever car the
   * program books; they never touch the call buttons, so the lamps stay dark
   * and the direction events never fire. The two ways of calling do not mix on
   * one floor on purpose: a program written for hall buttons hears silence in a
   * destination-dispatch building rather than half a building, and the mechanic
   * cannot be half-solved by a solution that ignores it.
   */
  readonly destinationDispatch: boolean;

  readonly #errorHandler: FloorErrorHandler;

  /** How many people here are waiting for each destination floor. */
  readonly #waiting = new Map<number, number>();

  /** The car booked for each destination, while somebody is waiting for it. */
  readonly #assigned = new Map<number, FloorElevator>();

  /**
   * @param floorLevel - Floor number, counting up from 0 at the bottom.
   * @param yPosition - World y of the floor.
   * @param errorHandler - Receives anything an event handler throws.
   * @param destinationDispatch - Whether this floor takes calls by destination
   * rather than by direction. Defaults to `false`, which is every floor of
   * every building written before destination dispatch existed.
   */
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
   * has to run for the nested call as it does for any other, because the whole
   * point of the nested press is to have a standing car re-offered to the
   * passenger who was turned away. It also draws from a
   * {@link "./random.ts"!RandomSource} before it decides there is nothing to
   * do; that stream is the world's derived button-repress one rather than its
   * spawn stream (see `BUTTON_REPRESS_STREAM` in src/game/world.ts), so
   * swallowing the call would change which car got re-offered but could no
   * longer move the passengers a seed replays.
   * Player code is still protected: the events are forwarded to
   * a {@link "./floor-interface.ts"!FloorInterface}, which refuses a nested
   * forward of the same call. It has to refuse it as a unit rather than leave it
   * to the per-event-name guard on {@link PlayerObservable}, because the facade
   * turns one press into two dispatches — see `FloorInterface.forwardCall`.
   *
   * @param event - Event to emit.
   * @param args - Arguments for that event.
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
   *
   * Emits `destination_requested` only when no car is booked for that
   * destination yet. That is the grouping destination dispatch exists for: the
   * second person bound for a floor a car is already coming for rides along
   * with the first, without the program hearing about them or being able to
   * book a second car for the same trip. The count is raised before the event
   * so that a handler booking a car from inside it finds somebody to book it
   * for.
   *
   * Not quite the rule the call buttons follow, though it looks like it. A lit
   * button is silent about the second press because the button is already lit;
   * this is silent about the second passenger because a car is already coming.
   * So a program that books from inside the handler never hears a duplicate,
   * while one that books later — from `update`, say — hears one request per
   * passenger until it does. Both are correct: an unanswered request has not
   * been answered, and saying so again is how a lazy program finds out.
   *
   * @param destinationFloor - Floor the passenger wants to reach.
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
   *
   * Refuses a car that cannot carry the trip end to end, and refuses a booking
   * nobody is waiting on. Both are one rule — a booking exists only while it
   * can still be boarded — and both would otherwise strand the floor silently.
   * A car booked for a trip it does not serve is waited for forever, since
   * nothing can board it and so nothing ever withdraws it; a booking left
   * standing after the last passenger boarded swallows the next request for
   * that floor, because a request only speaks up when no car is coming.
   *
   * Emits on a change, as the call buttons do, so that a program rebooking the
   * same car every frame does not re-offer it every frame.
   *
   * @param destinationFloor - Floor the booking is for.
   * @param elevator - Car to send.
   * @returns `true` when the booking was taken.
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

  /**
   * The car booked to take this floor's passengers to a destination.
   *
   * @param destinationFloor - Floor to ask about.
   * @returns The car, or `null` when none is booked.
   */
  assignedElevator(destinationFloor: number): FloorElevator | null {
    return this.#assigned.get(destinationFloor) ?? null;
  }

  /**
   * How many people here are waiting for each destination floor.
   *
   * The live map rather than a snapshot: this is the engine's own book, and the
   * facade that hands it to player code is what copies it, the way
   * `buttonStates` is published as a snapshot.
   *
   * @returns Destination floor to the number of people waiting for it.
   */
  pendingDestinations(): ReadonlyMap<number, number> {
    return this.#waiting;
  }

  /**
   * Records that somebody boarded the car booked for their destination.
   *
   * The booking is withdrawn together with the last person waiting on it, so
   * that the next passenger bound for that floor asks for a car of their own
   * rather than waiting on one that has already left.
   *
   * A boarding for a destination nobody asked about is treated as that last
   * one, which is a guard rather than a case: only a waiting passenger boards,
   * and boarding is what puts them in the book.
   *
   * @param destinationFloor - Floor the passenger who boarded is bound for.
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
   *
   * The way out of the deadlock the engine can see: a car arrives full, the
   * people it could not take are still standing here, and the car that was
   * going to take them is leaving. Without this they would wait on a booking
   * nobody can honor, and the floor would be stranded for the rest of the run.
   *
   * The deadlock it cannot see is the program's own. A booking is cleared by
   * boarding or by refusal, and both need the booked car to open its doors
   * here; a program that books a car and then sends it somewhere else leaves a
   * booking nothing will ever clear, and every later passenger bound for that
   * floor joins it in silence. Nothing here can detect that — the floor is not
   * told where a car went — so the way out is the program's:
   * {@link Floor.pendingDestinations} is what lets it see the request that is
   * still standing, and booking another car is what answers it.
   *
   * Guards against a refusal for a destination nobody is waiting for, which no
   * engine path reaches: a refusal does not decrement the count, so the
   * passenger being refused is still in the book when this runs.
   *
   * @param destinationFloor - Floor the refused passenger is bound for.
   */
  destinationRefused(destinationFloor: number): void {
    this.#assigned.delete(destinationFloor);
    this.#tryTrigger("destinations_change", this);
    if (this.#waiting.has(destinationFloor)) {
      this.#tryTrigger("destination_requested", this, destinationFloor);
    }
  }

  /**
   * Clears the call buttons an arriving elevator can serve.
   *
   * Only the buttons matching the elevator's lit indicators are cleared, and a
   * separate `buttonstate_change` is emitted for each, as in the original.
   *
   * A car that does not serve this floor clears nothing, whatever its
   * indicators say. It can still arrive here — player code may send a car
   * anywhere, and `World.#handleButtonRepressing` sends a standing car to its
   * own floor — and a lamp cleared by a car nobody on this floor may board is
   * a passenger the building has forgotten about.
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
