/** Floor facade exposed to player code; publishes only queries and handler registration, nothing that reaches the simulation. */

import type { Floor, FloorButtonStates } from "./floor.ts";
import {
  PlayerObservable,
  type EventHandler,
  type EventName,
  type EventNameSpec,
  type HandlerFor,
  type OffEventSpec,
} from "./observable.ts";

/** One destination people on a floor are waiting to be taken to. */
export interface PendingDestination {
  /** Floor they asked for. */
  readonly floorNum: number;
  /** How many of them are waiting for it. */
  readonly waiting: number;
}

/** Events a {@link FloorInterface} exposes to player code. */
export type FloorInterfaceEvents = {
  /** Either call button was lit or cleared. */
  buttonstate_change: [buttonStates: Readonly<FloorButtonStates>];
  /** Someone pressed the up call button. */
  up_button_pressed: [floor: FloorInterface];
  /** Someone pressed the down call button. */
  down_button_pressed: [floor: FloorInterface];
  /** Someone pressed either call button; `direction` says which one. */
  hall_button_pressed: [direction: "up" | "down", floor: FloorInterface];
  /** Somebody here asked for a floor with no car coming for it yet; fires again if the booked car arrives full. */
  destination_requested: [destinationFloor: number, floor: FloorInterface];
};

/** Called with anything a player-code floor handler throws. */
export type FloorInterfaceErrorHandler = (e: unknown) => void;

/** The floor API exposed to player code. */
export class FloorInterface {
  /** Floor number, counting up from 0 at the bottom. */
  readonly level: number;

  readonly #floor: Floor;
  readonly #errorHandler: FloorInterfaceErrorHandler;
  /** Player event subscriptions; dispatched with this facade as `this`. */
  readonly #events = new PlayerObservable<FloorInterfaceEvents>(this);
  /** Directions whose call dispatch is in progress, kept atomic against a nested press. */
  readonly #callsInFlight = new Set<"up" | "down">();
  /** Destinations whose request dispatch is in progress. */
  readonly #destinationsInFlight = new Set<number>();
  /** Destinations whose request was refused as already in flight, to redeliver once that dispatch unwinds. */
  readonly #deferredDestinations = new Set<number>();

  constructor(floor: Floor, errorHandler: FloorInterfaceErrorHandler) {
    this.#floor = floor;
    this.level = floor.level;
    this.#errorHandler = errorHandler;

    floor.on("buttonstate_change", () => {
      this.#tryTrigger("buttonstate_change", this.buttonStates);
    });

    floor.on("up_button_pressed", () => {
      this.#forwardCall("up");
    });

    floor.on("down_button_pressed", () => {
      this.#forwardCall("down");
    });

    floor.on("destination_requested", (_requestingFloor, destinationFloor) => {
      this.#forwardDestination(destinationFloor);
    });
  }

  /**
   * Delivers one call as its specific event, then the general `hall_button_pressed` event.
   * Marked in-flight per direction so a nested press (e.g., a refusal from a full car) can't split the pair or drop one of them.
   */
  #forwardCall(direction: "up" | "down"): void {
    if (this.#callsInFlight.has(direction)) {
      return;
    }
    this.#callsInFlight.add(direction);
    try {
      this.#tryTrigger(`${direction}_button_pressed`, this);
      this.#events.triggerSafeKeyed(
        `hall_button_pressed:${direction}`,
        "hall_button_pressed",
        this.#errorHandler,
        direction,
        this,
      );
    } finally {
      this.#callsInFlight.delete(direction);
    }
  }

  /**
   * Delivers one `destination_requested` dispatch, keyed per destination.
   * A nested request for the same destination is deferred and redelivered once, after this dispatch unwinds, if it's still unanswered.
   */
  #forwardDestination(destinationFloor: number, redelivering = false): void {
    if (this.#destinationsInFlight.has(destinationFloor)) {
      this.#deferredDestinations.add(destinationFloor);
      return;
    }
    this.#destinationsInFlight.add(destinationFloor);
    try {
      this.#events.triggerSafeKeyed(
        `destination_requested:${String(destinationFloor)}`,
        "destination_requested",
        this.#errorHandler,
        destinationFloor,
        this,
      );
    } finally {
      this.#destinationsInFlight.delete(destinationFloor);
    }
    const deferred = this.#deferredDestinations.delete(destinationFloor);
    if (deferred && !redelivering && this.#stillUnanswered(destinationFloor)) {
      this.#forwardDestination(destinationFloor, true);
    }
  }

  /** Whether somebody here is still waiting for `destinationFloor` with no car booked to take them. */
  #stillUnanswered(destinationFloor: number): boolean {
    return (
      this.#floor.pendingDestinations().has(destinationFloor) &&
      this.#floor.assignedElevator(destinationFloor) === null
    );
  }

  /** Emits an event, routing handler exceptions to the error handler so one failing handler can't block the others. */
  #tryTrigger<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    ...args: FloorInterfaceEvents[K]
  ): void {
    this.#events.triggerSafe(event, this.#errorHandler, ...args);
  }

  /** Registers a handler for one or more space-separated events. */
  on<S extends EventNameSpec<FloorInterfaceEvents>>(
    events: S,
    handler: HandlerFor<S, FloorInterfaceEvents>,
  ): this {
    this.#events.on(events, handler);
    return this;
  }

  /** Registers a handler that runs at most once. */
  once<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    handler: EventHandler<FloorInterfaceEvents[K]>,
  ): this {
    this.#events.once(event, handler);
    return this;
  }

  /** Alias for {@link FloorInterface.once}. */
  one<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    handler: EventHandler<FloorInterfaceEvents[K]>,
  ): this {
    return this.once(event, handler);
  }

  /** Unregisters handlers; use `"*"` to remove every event's handlers. */
  off<S extends OffEventSpec<FloorInterfaceEvents>>(
    events: S,
    handler?: HandlerFor<S, FloorInterfaceEvents>,
  ): this {
    this.#events.off(events, handler);
    return this;
  }

  /**
   * Removes every handler player code registered on this floor.
   * Only the player's own subscriptions go; the internal event forwarding that drives this facade keeps working afterward.
   */
  offAll(): this {
    this.#events.offAll();
    return this;
  }

  /** Lit state of the two call buttons; a fresh copy each read, not the floor's live object. */
  get buttonStates(): Readonly<FloorButtonStates> {
    return { up: this.#floor.buttonStates.up, down: this.#floor.buttonStates.down };
  }

  /** This floor's number, counting up from 0 at the bottom. */
  floorNum(): number {
    return this.level;
  }

  /**
   * Journeys people on this floor are waiting for right now, not just at the moment they were requested.
   * A fresh array each read, sorted by floor number; empty in a building that uses call buttons instead.
   */
  pendingDestinations(): PendingDestination[] {
    return [...this.#floor.pendingDestinations()]
      .map(([floorNum, waiting]) => ({ floorNum, waiting }))
      .sort((a, b) => a.floorNum - b.floorNum);
  }
}
