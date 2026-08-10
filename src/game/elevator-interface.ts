/**
 * The elevator facade handed to player code.
 *
 * Ported from the legacy `interfaces.js`. This is the game's public API, so
 * every method name, arity and return value here is a compatibility contract
 * with every solution people have already written — see `documentation.html`.
 *
 * It hides the actual elevator object behind a more robust facade, while also
 * exposing relevant events, and providing some helper queue functions that
 * allow programming without async logic.
 *
 * The emitter is held rather than inherited from, so the surface is exactly the
 * legacy one: the documented methods plus `on`/`once`/`one`/`off`/`offAll` and
 * `trigger`, which the legacy `riot.observable(obj)` (`interfaces.js:6`)
 * published. `triggerSafe` is not part of it. That method is this rewrite's
 * own, and inheriting it would hand player code a dispatch whose second
 * argument is the *error reporter*: `elevator.triggerSafe("idle")` would route
 * a handler's exception through `report(undefined, error)`, where the resulting
 * TypeError is logged to the console and never reaches `handleUserCodeError` —
 * the player's code fails and the "problem with your code" banner never
 * appears.
 */

import type { Elevator, ElevatorDirection } from "./elevator.ts";
import { epsilonEquals, limitNumber } from "./math.ts";
import {
  PlayerObservable,
  type EventHandler,
  type EventName,
  type EventNameSpec,
  type HandlerFor,
  type OffEventSpec,
} from "./observable.ts";

/** Direction an elevator is heading, as reported to player code. */
export type DestinationDirection = ElevatorDirection | "stopped";

/** Events an {@link ElevatorInterface} exposes to player code. */
export type ElevatorInterfaceEvents = {
  /** The elevator finished its queue and has nothing to do. */
  idle: [];
  /** A passenger pressed a floor button inside the elevator. */
  floor_button_pressed: [floorNum: number];
  /** The elevator is about to pass a floor without stopping. */
  passing_floor: [floorNum: number, direction: ElevatorDirection];
  /** The elevator arrived at a floor. */
  stopped_at_floor: [floorNum: number];
};

/** Called with anything a player-code event handler throws. */
export type ElevatorInterfaceErrorHandler = (e: unknown) => void;

/** Seconds an elevator waits at a floor before taking its next destination. */
const WAIT_AT_FLOOR_SECONDS = 1;

/**
 * First element of an array, or `NaN` for an empty one.
 *
 * Replaces lodash `_.first`. The legacy code guarded on `queue.length` and then
 * forwarded whatever `_.first` returned, so an absent value ended up producing
 * `NaN` positions downstream either way.
 *
 * @param arr - Array to read.
 * @returns `arr[0]`, or `NaN`.
 */
function firstOrNaN(arr: readonly number[]): number {
  return arr[0] ?? Number.NaN;
}

/**
 * Last element of an array, or `NaN` for an empty one.
 *
 * Replaces lodash `_.last`; see {@link firstOrNaN}.
 *
 * @param arr - Array to read.
 * @returns `arr[arr.length - 1]`, or `NaN`.
 */
function lastOrNaN(arr: readonly number[]): number {
  return arr[arr.length - 1] ?? Number.NaN;
}

/** The elevator API exposed to player code. */
export class ElevatorInterface {
  /**
   * Floor numbers the elevator is scheduled to visit.
   *
   * Documented as directly modifiable by player code, including whole-array
   * reassignment, so it is a plain mutable property rather than a method pair.
   * Call {@link checkDestinationQueue} after changing it.
   */
  destinationQueue: number[] = [];

  readonly #elevator: Elevator;
  readonly #floorCount: number;
  readonly #errorHandler: ElevatorInterfaceErrorHandler;
  /**
   * Player subscriptions.
   *
   * Dispatches with this facade as the receiver, so a `function` handler's
   * `this` is the facade, exactly as when it inherited the emitter.
   */
  readonly #events = new PlayerObservable<ElevatorInterfaceEvents>(this);

  /**
   * @param elevator - The elevator this facade wraps.
   * @param floorCount - Number of floors, used to clamp requested destinations.
   * @param errorHandler - Receives anything a player-code handler throws.
   */
  constructor(elevator: Elevator, floorCount: number, errorHandler: ElevatorInterfaceErrorHandler) {
    this.#elevator = elevator;
    this.#floorCount = floorCount;
    this.#errorHandler = errorHandler;

    elevator.on("stopped", (position) => {
      if (
        this.destinationQueue.length > 0 &&
        epsilonEquals(firstOrNaN(this.destinationQueue), position)
      ) {
        // Reached the destination, so remove element at front of queue
        this.destinationQueue = this.destinationQueue.slice(1);
      }
      // The legacy handler did all of the below only when the head matched, so
      // an elevator that halted for any other reason — after stop(), or after
      // player code emptied the queue mid-flight — was never re-checked: no
      // `idle`, and no boarding dwell either (upstream issues #92 and #105).
      // Popping is conditional; carrying on is not.
      if (elevator.isOnAFloor()) {
        elevator.wait(WAIT_AT_FLOOR_SECONDS, () => {
          this.checkDestinationQueue();
        });
      } else {
        this.checkDestinationQueue();
      }
    });

    elevator.on("passing_floor", (floorNum, direction) => {
      this.#tryTrigger("passing_floor", floorNum, direction);
    });

    elevator.on("stopped_at_floor", (floorNum) => {
      this.#tryTrigger("stopped_at_floor", floorNum);
    });

    elevator.on("floor_button_pressed", (floorNum) => {
      this.#tryTrigger("floor_button_pressed", floorNum);
    });
  }

  /**
   * Emits an event, diverting handler exceptions to the error handler.
   *
   * Errors are isolated per handler, so one player handler throwing does not
   * stop the others from running (upstream issues #88, #83, #27).
   *
   * @param event - Event to emit.
   * @param args - Arguments for that event.
   */
  #tryTrigger<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    ...args: ElevatorInterfaceEvents[K]
  ): void {
    this.#events.triggerSafe(event, this.#errorHandler, ...args);
  }

  /**
   * Registers a handler for one event, or for several space separated events.
   *
   * @param events - Event name, or names separated by single spaces.
   * @param handler - Called, in registration order, on every matching event.
   * @returns This facade, for chaining.
   */
  on<S extends EventNameSpec<ElevatorInterfaceEvents>>(
    events: S,
    handler: HandlerFor<S, ElevatorInterfaceEvents>,
  ): this {
    this.#events.on(events, handler);
    return this;
  }

  /**
   * Registers a handler to run at most once.
   *
   * @param event - Single event name.
   * @param handler - Called on the next occurrence of `event`.
   * @returns This facade, for chaining.
   */
  once<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    handler: EventHandler<ElevatorInterfaceEvents[K]>,
  ): this {
    this.#events.once(event, handler);
    return this;
  }

  /**
   * Legacy spelling of {@link ElevatorInterface.once}.
   *
   * The legacy facade was a `riot.observable(obj)` (`interfaces.js:6`), and
   * riot published `one` rather than `once` (`libs/riot.js:33`), so this is the
   * name existing solutions call.
   *
   * @param event - Single event name.
   * @param handler - Called on the next occurrence of `event`.
   * @returns This facade, for chaining.
   */
  one<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    handler: EventHandler<ElevatorInterfaceEvents[K]>,
  ): this {
    return this.once(event, handler);
  }

  /**
   * Unregisters handlers.
   *
   * @param events - Event name, names separated by single spaces, or `"*"` for
   * every event. The legacy facade was a `riot.observable(obj)`
   * (`interfaces.js:6`), so `"*"` was its unregister-everything wildcard
   * (`libs/riot.js:18`) — and the accepted answer to upstream issue #97
   * ("Unbind events?") was exactly `elevator.off('*')`.
   * @param handler - When given, only this exact function is unregistered;
   * when omitted, every handler of each listed event is. Ignored for `"*"`,
   * as it was by riot.
   * @returns This facade, for chaining.
   */
  off<S extends OffEventSpec<ElevatorInterfaceEvents>>(
    events: S,
    handler?: HandlerFor<S, ElevatorInterfaceEvents>,
  ): this {
    this.#events.off(events, handler);
    return this;
  }

  /**
   * Removes every handler for every event.
   *
   * The named spelling of `off("*")`. Kept because the legacy facade published
   * it and `World.unWind` uses it to tear the facade down.
   *
   * @returns This facade, for chaining.
   */
  offAll(): this {
    this.#events.offAll();
    return this;
  }

  /**
   * Emits an event to the handlers player code registered.
   *
   * Published because the legacy facade was a `riot.observable(obj)`
   * (`interfaces.js:6`) and solutions may raise their own events with it. It is
   * the guarded dispatch, so re-triggering the event being handled is refused
   * rather than recursing; a handler that throws still throws out of here, as
   * it did through riot.
   *
   * @param event - Event to emit.
   * @param args - Arguments for that event.
   * @returns This facade, for chaining.
   */
  trigger<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    ...args: ElevatorInterfaceEvents[K]
  ): this {
    this.#events.trigger(event, ...args);
    return this;
  }

  /**
   * Starts on the next queued destination, or reports the elevator as idle.
   *
   * Only needs to be called explicitly after modifying {@link destinationQueue}
   * by hand. Does nothing while the elevator is waiting at a floor.
   *
   * Calling this from inside an `idle` handler is supported and documented —
   * `documentation.html` tells players to clear {@link destinationQueue} and
   * call this, which lands straight back in the empty-queue branch. The nested
   * call will not raise `idle` a second time, because `PlayerObservable`
   * refuses to re-enter a dispatch that is already in flight.
   */
  checkDestinationQueue(): void {
    if (!this.#elevator.isBusy()) {
      if (this.destinationQueue.length > 0) {
        this.#elevator.goToFloor(firstOrNaN(this.destinationQueue));
      } else {
        this.#tryTrigger("idle");
      }
    }
  }

  /**
   * Queues a floor to travel to.
   *
   * A request equal to the adjacent end of the queue is dropped, so repeatedly
   * asking for the same floor does not pile up.
   *
   * @param floorNum - Destination floor; clamped into the valid range. Coerced
   * with `Number()` because player code is untyped and may pass a string.
   * @param forceNow - Put the floor at the front of the queue instead of the
   * back.
   */
  goToFloor(floorNum: number, forceNow?: boolean): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- player code is untyped JS and does pass strings here
    const floor = limitNumber(Number(floorNum), 0, this.#floorCount - 1);
    // Player code is untyped, so `forceNow` keeps the legacy truthiness test.
    const immediate = Boolean(forceNow);
    // Auto-prevent immediately duplicate destinations
    if (this.destinationQueue.length > 0) {
      const adjacentElement = immediate
        ? firstOrNaN(this.destinationQueue)
        : lastOrNaN(this.destinationQueue);
      if (epsilonEquals(floor, adjacentElement)) {
        return;
      }
    }
    if (immediate) {
      this.destinationQueue.unshift(floor);
    } else {
      this.destinationQueue.push(floor);
    }
    this.checkDestinationQueue();
  }

  /**
   * Clears the queue and brings the elevator to a halt.
   *
   * The elevator coasts to the floor position it can actually reach, which is
   * usually between floors, so passengers will not get out.
   */
  stop(): void {
    this.destinationQueue = [];
    if (!this.#elevator.isBusy()) {
      this.#elevator.goToFloor(this.#elevator.getExactFutureFloorIfStopped());
    }
  }

  /**
   * Lowest pressed floor button.
   *
   * @deprecated Undocumented legacy API, scheduled for removal.
   * @returns The lowest pressed floor, or `0` when nothing is pressed.
   */
  getFirstPressedFloor(): number {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the facade forwards the deprecated call verbatim
    return this.#elevator.getFirstPressedFloor();
  }

  /**
   * Floor buttons currently pressed inside the elevator.
   *
   * @returns Pressed floor numbers, in ascending order.
   */
  getPressedFloors(): number[] {
    return this.#elevator.getPressedFloors();
  }

  /**
   * The floor the elevator is on.
   *
   * @returns The current floor number.
   */
  currentFloor(): number {
    return this.#elevator.currentFloor;
  }

  /**
   * Passenger capacity.
   *
   * @returns The maximum number of passengers.
   */
  maxPassengerCount(): number {
    return this.#elevator.maxUsers;
  }

  /**
   * How full the elevator is.
   *
   * @returns `0` when empty, `1` when full; varies with passenger weights.
   */
  loadFactor(): number {
    return this.#elevator.getLoadFactor();
  }

  /**
   * The direction the elevator is currently going to move toward.
   *
   * @returns `"up"`, `"down"` or `"stopped"`.
   */
  destinationDirection(): DestinationDirection {
    if (this.#elevator.destinationY === this.#elevator.y) {
      return "stopped";
    }
    // y grows downward, so a destination below the car means going down.
    return this.#elevator.destinationY > this.#elevator.y ? "down" : "up";
  }

  /**
   * Gets or sets the going-up indicator.
   *
   * @returns The current value when called with no argument, or this interface
   * (for chaining) when called with one.
   */
  goingUpIndicator(): boolean;
  goingUpIndicator(value: boolean): this;
  goingUpIndicator(value?: boolean): boolean | this {
    if (value !== undefined) {
      // Player code is untyped and may pass any truthy/falsy value.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- preserves the legacy `val ? true : false` coercion
      const next = Boolean(value);
      // Only announce a real change; see the note on the elevator's own
      // change: handler.
      if (next !== this.#elevator.goingUpIndicator) {
        this.#elevator.goingUpIndicator = next;
        this.#elevator.trigger("change:goingUpIndicator", next);
      }
      return this;
    }
    return this.#elevator.goingUpIndicator;
  }

  /**
   * Gets or sets the going-down indicator.
   *
   * @returns The current value when called with no argument, or this interface
   * (for chaining) when called with one.
   */
  goingDownIndicator(): boolean;
  goingDownIndicator(value: boolean): this;
  goingDownIndicator(value?: boolean): boolean | this {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- preserves the legacy `val ? true : false` coercion
      const next = Boolean(value);
      if (next !== this.#elevator.goingDownIndicator) {
        this.#elevator.goingDownIndicator = next;
        this.#elevator.trigger("change:goingDownIndicator", next);
      }
      return this;
    }
    return this.#elevator.goingDownIndicator;
  }
}
