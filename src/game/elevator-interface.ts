/** Elevator facade exposed to player code; method names and behavior are a compatibility contract with existing solutions. */

import { t } from "../i18n/index.ts";
import type { Elevator, ElevatorDirection } from "./elevator.ts";
import type { Floor } from "./floor.ts";
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

/** First element of an array, or `NaN` if empty. */
function firstOrNaN(arr: readonly number[]): number {
  return arr[0] ?? Number.NaN;
}

/** Last element of an array, or `NaN` if empty. */
function lastOrNaN(arr: readonly number[]): number {
  return arr[arr.length - 1] ?? Number.NaN;
}

/** Renders a value for an error message; array and object are localized placeholders, everything else is echoed as-is. */
function describeFloorArgument(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return t("error.value.array");
  }
  if (typeof value === "object" && value !== null) {
    return t("error.value.object");
  }
  return String(value);
}

/** The elevator API exposed to player code. */
export class ElevatorInterface {
  /**
   * Floor numbers the elevator is scheduled to visit; directly mutable by player code.
   * Call {@link checkDestinationQueue} after changing it.
   */
  destinationQueue: number[] = [];

  readonly #elevator: Elevator;
  readonly #floors: readonly Floor[];
  readonly #floorCount: number;
  readonly #errorHandler: ElevatorInterfaceErrorHandler;
  /** Whether a dropped, non-finite destination has already been reported. */
  #reportedDroppedDestination = false;
  /** Player event subscriptions; dispatched with this facade as `this`. */
  readonly #events = new PlayerObservable<ElevatorInterfaceEvents>(this);

  /** @param floors - Bottom floor first; {@link takeRequest} books a car on them. */
  constructor(
    elevator: Elevator,
    floors: readonly Floor[],
    errorHandler: ElevatorInterfaceErrorHandler,
  ) {
    this.#elevator = elevator;
    this.#floors = floors;
    this.#floorCount = floors.length;
    this.#errorHandler = errorHandler;

    elevator.on("stopped", (position) => {
      if (
        this.destinationQueue.length > 0 &&
        epsilonEquals(firstOrNaN(this.destinationQueue), position)
      ) {
        this.destinationQueue = this.destinationQueue.slice(1);
      }
      // Runs on every stop, not just ones where the queue head matched.
      if (elevator.isOnAFloor()) {
        this.#waitAtFloor();
      } else {
        this.checkDestinationQueue();
      }
    });

    // A passenger who boards outside the normal arrival sequence still gets a dwell.
    elevator.on("boarding_started", () => {
      this.#waitAtFloor();
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

  /** Emits an event, routing handler exceptions to the error handler so one failing handler can't block the others. */
  #tryTrigger<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    ...args: ElevatorInterfaceEvents[K]
  ): void {
    this.#events.triggerSafe(event, this.#errorHandler, ...args);
  }

  /**
   * Holds the car at the floor for boarding, then continues to the next destination.
   * Restarts the wait if one is already running, since a fresh call means a passenger just started boarding.
   */
  #waitAtFloor(): void {
    this.#elevator.currentTask = null;
    this.#elevator.wait(WAIT_AT_FLOOR_SECONDS, () => {
      this.checkDestinationQueue();
    });
  }

  /** Registers a handler for one or more space-separated events. */
  on<S extends EventNameSpec<ElevatorInterfaceEvents>>(
    events: S,
    handler: HandlerFor<S, ElevatorInterfaceEvents>,
  ): this {
    this.#events.on(events, handler);
    return this;
  }

  /** Registers a handler that runs at most once. */
  once<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    handler: EventHandler<ElevatorInterfaceEvents[K]>,
  ): this {
    this.#events.once(event, handler);
    return this;
  }

  /** Alias for {@link ElevatorInterface.once}. */
  one<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    handler: EventHandler<ElevatorInterfaceEvents[K]>,
  ): this {
    return this.once(event, handler);
  }

  /** Unregisters handlers; use `"*"` to remove every event's handlers. */
  off<S extends OffEventSpec<ElevatorInterfaceEvents>>(
    events: S,
    handler?: HandlerFor<S, ElevatorInterfaceEvents>,
  ): this {
    this.#events.off(events, handler);
    return this;
  }

  /** Removes every handler for every event. */
  offAll(): this {
    this.#events.offAll();
    return this;
  }

  /**
   * Emits an event to registered handlers.
   * Re-entrant calls for the same event are ignored; a handler that throws propagates to the caller.
   */
  trigger<K extends EventName<ElevatorInterfaceEvents>>(
    event: K,
    ...args: ElevatorInterfaceEvents[K]
  ): this {
    this.#events.trigger(event, ...args);
    return this;
  }

  /**
   * Starts the elevator on the next queued destination, or reports it idle if the queue is empty.
   * Call after modifying {@link destinationQueue} directly; a no-op while the elevator is dwelling at a floor.
   * Non-finite entries in the queue are dropped and reported once.
   */
  checkDestinationQueue(): void {
    if (!this.#elevator.isBusy()) {
      this.#dropUnreachableDestinations();
      if (this.destinationQueue.length > 0) {
        this.#elevator.goToFloor(firstOrNaN(this.destinationQueue));
      } else {
        this.#tryTrigger("idle");
      }
    }
  }

  /**
   * Drops non-finite destinations, which would otherwise wedge the car's position permanently, and reports the first offender once per facade.
   */
  #dropUnreachableDestinations(): void {
    const offenderIndex = this.destinationQueue.findIndex((floorNum) => !Number.isFinite(floorNum));
    if (offenderIndex < 0) {
      return;
    }
    const offender = this.destinationQueue[offenderIndex];
    this.destinationQueue = this.destinationQueue.filter((floorNum) => Number.isFinite(floorNum));
    if (this.#reportedDroppedDestination) {
      return;
    }
    this.#reportedDroppedDestination = true;
    this.#errorHandler(
      new TypeError(
        t("error.elevator.queueNotAFloor", {
          value: describeFloorArgument(offender),
          topFloor: this.#floorCount - 1,
        }),
      ),
    );
  }

  /**
   * Coerces a player-supplied floor number and clamps it into range.
   * @throws {TypeError} If `floorNum` doesn't coerce to a finite number.
   */
  #toFloorNumber(method: string, floorNum: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- player code may pass a string
    const requested = Number(floorNum);
    if (!Number.isFinite(requested)) {
      throw new TypeError(
        t("error.elevator.notAFloor", {
          method,
          value: describeFloorArgument(floorNum),
          topFloor: this.#floorCount - 1,
        }),
      );
    }
    return limitNumber(requested, 0, this.#floorCount - 1);
  }

  /**
   * Queues a floor to travel to, immediately if `forceNow` is set.
   * A request matching the adjacent end of the queue is dropped rather than duplicated.
   * @throws {TypeError} If `floorNum` is not a finite number.
   */
  goToFloor(floorNum: number, forceNow?: boolean): void {
    const floor = this.#toFloorNumber("goToFloor", floorNum);
    const immediate = Boolean(forceNow);
    // Drop duplicate adjacent destinations.
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

  /** Clears the queue and halts the elevator, usually between floors, so passengers cannot disembark. */
  stop(): void {
    this.destinationQueue = [];
    if (!this.#elevator.isBusy()) {
      this.#elevator.goToFloor(this.#elevator.getExactFutureFloorIfStopped());
    }
  }

  /**
   * Books this elevator to serve a hall call from `fromFloorNum` to `toFloorNum`; returns `false` if nobody is waiting there for that trip or this car can't serve both floors.
   * Does not move the car — call {@link goToFloor} for that.
   * @throws {TypeError} If either floor is not a finite number.
   */
  takeRequest(fromFloorNum: number, toFloorNum: number): boolean {
    const from = Math.round(this.#toFloorNumber("takeRequest", fromFloorNum));
    const to = Math.round(this.#toFloorNumber("takeRequest", toFloorNum));
    return this.#floors[from]?.assignElevator(to, this.#elevator) ?? false;
  }

  /**
   * Lowest pressed floor button.
   * @deprecated Undocumented legacy API, scheduled for removal.
   */
  getFirstPressedFloor(): number {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- forwards the deprecated call
    return this.#elevator.getFirstPressedFloor();
  }

  /** Floor buttons currently pressed inside the elevator, in ascending order. */
  getPressedFloors(): number[] {
    return this.#elevator.getPressedFloors();
  }

  /**
   * Floors this elevator is allowed to serve; a car with no zone reports every floor in the building.
   * Serving a floor is about picking up and dropping off passengers there, not about where {@link goToFloor} can send the car.
   */
  servedFloors(): number[] {
    const floors: number[] = [];
    for (let floorNum = 0; floorNum < this.#floorCount; floorNum++) {
      if (this.#elevator.serves(floorNum)) {
        floors.push(floorNum);
      }
    }
    return floors;
  }

  /** The floor the elevator is currently on. */
  currentFloor(): number {
    return this.#elevator.currentFloor;
  }

  /** Maximum number of passengers this elevator can carry. */
  maxPassengerCount(): number {
    return this.#elevator.maxUsers;
  }

  /** How full the elevator is, from `0` (empty) to `1` (full); varies with passenger weight, not headcount. */
  loadFactor(): number {
    return this.#elevator.getLoadFactor();
  }

  /**
   * Whether every passenger slot is taken.
   * Passenger weight varies, so {@link loadFactor} rarely reaches `1`; use this to test for a full car.
   */
  isFull(): boolean {
    return this.#elevator.isFull();
  }

  /** Whether the elevator is carrying nobody; not the negation of {@link isFull} — a partially loaded car is neither. */
  isEmpty(): boolean {
    return this.#elevator.isEmpty();
  }

  /** Direction the elevator will move in next, or `"stopped"` if it has arrived. */
  destinationDirection(): DestinationDirection {
    if (this.#elevator.destinationY === this.#elevator.y) {
      return "stopped";
    }
    // y grows downward, so a destination below the car means going down.
    return this.#elevator.destinationY > this.#elevator.y ? "down" : "up";
  }

  /**
   * Whether the elevator is moving toward `floorNum` and hasn't passed it yet.
   * Based on current position and direction of travel only, not on where the car will actually stop.
   * @throws {TypeError} If `floorNum` is not a finite number.
   */
  isApproachingFloor(floorNum: number): boolean {
    return this.#elevator.isApproachingFloor(this.#toFloorNumber("isApproachingFloor", floorNum));
  }

  /** Gets or sets the going-up indicator light; returns the current value, or this facade for chaining when setting. */
  goingUpIndicator(): boolean;
  goingUpIndicator(value: boolean): this;
  goingUpIndicator(value?: boolean): boolean | this {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- player code may pass a non-boolean value
      const next = Boolean(value);
      // Only trigger when the value actually changes.
      if (next !== this.#elevator.goingUpIndicator) {
        this.#elevator.goingUpIndicator = next;
        this.#elevator.trigger("change:goingUpIndicator", next);
      }
      return this;
    }
    return this.#elevator.goingUpIndicator;
  }

  /** Gets or sets the going-down indicator light; returns the current value, or this facade for chaining when setting. */
  goingDownIndicator(): boolean;
  goingDownIndicator(value: boolean): this;
  goingDownIndicator(value?: boolean): boolean | this {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- player code may pass a non-boolean value
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
