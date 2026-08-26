/**
 * Type declarations for the Elevator Saga player API, dropped beside a
 * solution so an editor can complete and typecheck `elevator.` and `floor.`
 * calls; it declares only types, with no runtime part.
 *
 * Point an editor at it with a `tsconfig.json` beside the solution
 * (`"allowJs"` and `"checkJs"` on), or with
 * `/// <reference path="./elevatorsaga.d.ts" />` under a `// @ts-check` line.
 */

/* eslint-disable @typescript-eslint/unified-signatures -- one overload per event keeps that event's own doc and handler signature under the cursor. */

/** The whole player-facing API, namespaced so `Elevator`, `Floor` and `Solution` don't collide with names already used in the project it's dropped into. */
declare namespace ElevatorSaga {
  /** Which way an elevator is traveling. */
  type Direction = "up" | "down";

  /** What {@link Elevator.destinationDirection} answers; a car may be neither. */
  type DestinationDirection = Direction | "stopped";

  /** Whether a floor's call button is lit. */
  type ButtonState = "" | "activated";

  /** The lit state of one floor's two call buttons. */
  interface FloorButtonStates {
    /** The up call button. */
    readonly up: ButtonState;
    /** The down call button. */
    readonly down: ButtonState;
  }

  /** One destination people on a floor are waiting to be taken to. */
  interface PendingDestination {
    /** The floor they asked for. */
    readonly floorNum: number;
    /** How many of them are waiting for it. */
    readonly waiting: number;
  }

  /** The events an elevator raises. */
  type ElevatorEventName = "idle" | "floor_button_pressed" | "passing_floor" | "stopped_at_floor";

  /** The events a floor raises. */
  type FloorEventName =
    | "up_button_pressed"
    | "down_button_pressed"
    | "hall_button_pressed"
    | "buttonstate_change"
    | "destination_requested";

  /**
   * Two to five event names separated by single spaces, subscribing one
   * handler to all of them. The handler is called with the name of the event
   * that fired, followed by that event's own arguments.
   */
  type MultipleEvents<Name extends string> =
    | `${Name} ${Name}`
    | `${Name} ${Name} ${Name}`
    | `${Name} ${Name} ${Name} ${Name}`
    | `${Name} ${Name} ${Name} ${Name} ${Name}`;

  /** `off`'s wildcard: unregister every handler, whatever the event. */
  type AllEvents = "*";

  /**
   * A handler subscribed to several events at once. Its parameter list is
   * left to the handler to declare — the type doesn't force one to spell out
   * arguments it ignores.
   */
  type MultiEventHandler<Receiver, Name extends string> = (
    this: Receiver,
    eventName: Name,
    ...args: never[]
  ) => void;

  /**
   * One elevator, as a program sees it. `init` and `update` are handed an
   * array of these, one per elevator, in the order they are drawn.
   */
  interface Elevator {
    /**
     * The floors this elevator is going to visit, in order. Writable; call
     * {@link Elevator.checkDestinationQueue} after changing it directly, or
     * the elevator won't act on the change until it next arrives somewhere.
     */
    destinationQueue: number[];

    /**
     * Queues a floor to travel to. Repeating the queue's current last floor
     * is a no-op rather than a duplicate; an out-of-range floor is clamped to
     * the nearest real one.
     *
     * @param forceNow - Put it at the front of the queue instead of the back.
     */
    goToFloor(floorNum: number, forceNow?: boolean): void;

    /**
     * Clears the queue and halts the elevator immediately, usually between
     * floors, so nobody gets out. For in-transit rescheduling, not everyday
     * use.
     */
    stop(): void;

    /**
     * Books this elevator for a journey requested via `destination_requested`;
     * the waiting people board only this car. Booking doesn't move it — send
     * with {@link Elevator.goToFloor} to fetch and then deliver them.
     *
     * @returns True when the booking was taken; false when nobody on
     * `fromFloorNum` is waiting for `toFloorNum`, or this car serves neither.
     */
    takeRequest(fromFloorNum: number, toFloorNum: number): boolean;

    /** The floor the elevator is on, or was last at while moving. */
    currentFloor(): number;

    /** Whether the elevator is advertising that it's going up. */
    goingUpIndicator(): boolean;

    /** Sets the going-up indicator, which passengers use to decide whether to board. */
    goingUpIndicator(value: boolean): this;

    /** Whether the elevator is advertising that it's going down. */
    goingDownIndicator(): boolean;

    /** Sets the going-down indicator, which passengers use to decide whether to board. */
    goingDownIndicator(value: boolean): this;

    /** How many passengers fit. */
    maxPassengerCount(): number;

    /**
     * How full the elevator is, from 0 (empty) to 1 (full capacity by
     * weight). A full car of passengers reads below 1; use
     * {@link Elevator.isFull} to ask "nobody else fits".
     */
    loadFactor(): number;

    /**
     * Whether every passenger slot is taken. A passenger counts from the
     * moment they start walking in.
     */
    isFull(): boolean;

    /**
     * Whether the elevator is carrying nobody. Not the negation of
     * {@link Elevator.isFull} — one passenger of four is neither.
     */
    isEmpty(): boolean;

    /** Which way the elevator is about to move: `"up"`, `"down"`, or `"stopped"`. */
    destinationDirection(): DestinationDirection;

    /**
     * Whether the elevator is moving toward a floor it hasn't passed yet.
     * Only the direction of travel counts, not the destination, so this can
     * say yes for a floor the car will stop before reaching.
     */
    isApproachingFloor(floorNum: number): boolean;

    /**
     * Starts on the next queued destination, or raises `idle`. Only needed
     * after changing {@link Elevator.destinationQueue} directly.
     */
    checkDestinationQueue(): void;

    /** The floor buttons pressed inside the elevator, as numbers in ascending order. */
    getPressedFloors(): number[];

    /**
     * The floors this elevator serves, in ascending order — every floor when
     * it has no zone. In a zoned building, a trip with either end outside
     * this car's zone carries nobody even if sent there with
     * {@link Elevator.goToFloor}.
     */
    servedFloors(): number[];

    /**
     * The lowest pressed floor button, or 0 when nothing is pressed.
     *
     * @deprecated Use {@link Elevator.getPressedFloors} in new code.
     */
    getFirstPressedFloor(): number;

    /** Runs `handler` whenever the elevator has nothing left to do. */
    on(event: "idle", handler: (this: Elevator) => void): this;

    /** Runs `handler` with the pressed floor number whenever a passenger presses a floor button inside the elevator. */
    on(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Runs `handler`, with the floor and direction, shortly before the
     * elevator passes a floor without stopping — never for the destination
     * floor, which it stops at instead.
     */
    on(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /** Runs `handler`, with the floor it stopped at, whenever the elevator stops at a floor. */
    on(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /** Runs `handler` for each of several events named in one space-separated string. */
    on(
      events: MultipleEvents<ElevatorEventName>,
      handler: MultiEventHandler<Elevator, ElevatorEventName>,
    ): this;

    /** Runs `handler` the next time the elevator goes idle, then forgets it. */
    once(event: "idle", handler: (this: Elevator) => void): this;

    /** Runs `handler`, with the pressed floor number, the next time a floor button is pressed inside the elevator, then forgets it. */
    once(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /** Runs `handler`, with the floor and direction, the next time the elevator passes a floor, then forgets it. */
    once(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /** Runs `handler`, with the floor it stopped at, the next time the elevator stops, then forgets it. */
    once(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /** Legacy spelling of {@link Elevator.once}, kept for solutions written against the original game's `one`. */
    one(event: "idle", handler: (this: Elevator) => void): this;

    /** Legacy spelling of {@link Elevator.once}; see the `"idle"` overload. */
    one(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /** Legacy spelling of {@link Elevator.once}; see the `"idle"` overload. */
    one(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /** Legacy spelling of {@link Elevator.once}; see the `"idle"` overload. */
    one(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Unregisters `idle` handlers. Removal is by identity, so only a handler
     * you kept a reference to can be removed on its own; omit `handler` to
     * remove every handler of this event instead.
     */
    off(event: "idle", handler?: (this: Elevator) => void): this;

    /** Unregisters `floor_button_pressed` handlers; see the `"idle"` overload. */
    off(event: "floor_button_pressed", handler?: (this: Elevator, floorNum: number) => void): this;

    /** Unregisters `passing_floor` handlers; see the `"idle"` overload. */
    off(
      event: "passing_floor",
      handler?: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /** Unregisters `stopped_at_floor` handlers; see the `"idle"` overload. */
    off(event: "stopped_at_floor", handler?: (this: Elevator, floorNum: number) => void): this;

    /** Unregisters handlers of several events named in one space-separated string. */
    off(
      events: MultipleEvents<ElevatorEventName>,
      handler?: MultiEventHandler<Elevator, ElevatorEventName>,
    ): this;

    /**
     * Removes every handler of every event, the same as
     * {@link Elevator.offAll}. Passing a handler here doesn't limit it to
     * that one — name the specific event instead to remove just one handler.
     */
    off(events: AllEvents): this;

    /** Removes every handler this program registered on this elevator. */
    offAll(): this;

    /**
     * Raises `idle` on this elevator, running its registered handlers. Legacy
     * API from the original game; does not make the elevator do anything
     * beyond that.
     */
    trigger(event: "idle"): this;

    /** Raises `floor_button_pressed`; see the `"idle"` overload. */
    trigger(event: "floor_button_pressed", floorNum: number): this;

    /** Raises `passing_floor`; see the `"idle"` overload. */
    trigger(event: "passing_floor", floorNum: number, direction: Direction): this;

    /** Raises `stopped_at_floor`; see the `"idle"` overload. */
    trigger(event: "stopped_at_floor", floorNum: number): this;
  }

  /**
   * One floor, as a program sees it: where people wait, with no controls of
   * its own. Everything below answers who's waiting or subscribes to hear
   * about it.
   */
  interface Floor {
    /** This floor's number, counting up from 0 at the bottom. */
    floorNum(): number;

    /**
     * The same number as a property, kept for solutions that read it off the
     * original game's floor object. {@link Floor.floorNum} is the supported
     * spelling.
     */
    readonly level: number;

    /**
     * The lit state of this floor's two call buttons. A fresh copy on every
     * read, so assigning to it changes nothing.
     */
    readonly buttonStates: FloorButtonStates;

    /**
     * The journeys people here have asked for and are still waiting on, in
     * ascending floor order (empty in a building with call buttons). A fresh
     * array on every read, so changing it changes nothing.
     */
    pendingDestinations(): PendingDestination[];

    /** Runs `handler` whenever somebody presses this floor's up call button. */
    on(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /** Runs `handler` whenever somebody presses this floor's down call button. */
    on(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * Runs `handler` whenever either call button here is pressed. Always
     * raised after that button's own event, so subscribing to both means
     * hearing about one press twice.
     */
    on(
      event: "hall_button_pressed",
      handler: (this: Floor, direction: Direction, floor: Floor) => void,
    ): this;

    /** Runs `handler`, with the new state of both buttons, whenever either call button is lit or cleared. */
    on(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /**
     * Runs `handler`, with the requested floor, whenever somebody here asks
     * to be taken to a floor instead of pressing a call button. Not raised
     * for joining an already-assigned journey, but raised again if that car
     * arrives full.
     */
    on(
      event: "destination_requested",
      handler: (this: Floor, destinationFloor: number, floor: Floor) => void,
    ): this;

    /** Runs `handler` for each of several events named in one space-separated string, e.g. `floor.on("up_button_pressed down_button_pressed", ...)`. */
    on(
      events: MultipleEvents<FloorEventName>,
      handler: MultiEventHandler<Floor, FloorEventName>,
    ): this;

    /** Runs `handler` the next time the up button is pressed here, then forgets it. */
    once(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /** Runs `handler` the next time the down button is pressed here, then forgets it. */
    once(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /** Runs `handler` the next time either call button here is pressed, then forgets it. */
    once(
      event: "hall_button_pressed",
      handler: (this: Floor, direction: Direction, floor: Floor) => void,
    ): this;

    /** Runs `handler` the next time either button changes here, then forgets it. */
    once(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /** Runs `handler` the next time somebody here asks to be taken to a floor, then forgets it. */
    once(
      event: "destination_requested",
      handler: (this: Floor, destinationFloor: number, floor: Floor) => void,
    ): this;

    /** Legacy spelling of {@link Floor.once}, kept for solutions written against the original game's `one`. */
    one(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /** Legacy spelling of {@link Floor.once}; see the `"up_button_pressed"` overload. */
    one(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /** Legacy spelling of {@link Floor.once}; see the `"up_button_pressed"` overload. */
    one(
      event: "hall_button_pressed",
      handler: (this: Floor, direction: Direction, floor: Floor) => void,
    ): this;

    /** Legacy spelling of {@link Floor.once}; see the `"up_button_pressed"` overload. */
    one(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /** Legacy spelling of {@link Floor.once}; see the `"up_button_pressed"` overload. */
    one(
      event: "destination_requested",
      handler: (this: Floor, destinationFloor: number, floor: Floor) => void,
    ): this;

    /**
     * Unregisters `up_button_pressed` handlers. Removal is by identity; see
     * {@link Elevator.off}.
     */
    off(event: "up_button_pressed", handler?: (this: Floor, floor: Floor) => void): this;

    /** Unregisters `down_button_pressed` handlers; see the `"up_button_pressed"` overload. */
    off(event: "down_button_pressed", handler?: (this: Floor, floor: Floor) => void): this;

    /** Unregisters `hall_button_pressed` handlers; see the `"up_button_pressed"` overload. */
    off(
      event: "hall_button_pressed",
      handler?: (this: Floor, direction: Direction, floor: Floor) => void,
    ): this;

    /** Unregisters `buttonstate_change` handlers; see the `"up_button_pressed"` overload. */
    off(
      event: "buttonstate_change",
      handler?: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /** Unregisters `destination_requested` handlers; see the `"up_button_pressed"` overload. */
    off(
      event: "destination_requested",
      handler?: (this: Floor, destinationFloor: number, floor: Floor) => void,
    ): this;

    /** Unregisters handlers of several events named in one space-separated string. */
    off(
      events: MultipleEvents<FloorEventName>,
      handler?: MultiEventHandler<Floor, FloorEventName>,
    ): this;

    /**
     * Removes every handler of every event, the same as {@link Floor.offAll}.
     * Name a specific event instead to remove just one handler.
     */
    off(events: AllEvents): this;

    /**
     * Removes every handler this program registered on this floor. The
     * game's own subscriptions live elsewhere, so this doesn't stop the
     * floor working.
     */
    offAll(): this;
  }

  /**
   * The object a solution is: what the game evaluates a program down to.
   * A program that declares `init` and `update` at the top level is read as
   * one of these too, so annotating either function with
   * `ElevatorSaga.Solution["init"]` types it the same way. The elevator and
   * floor arrays are the game's own and shared across frames — sort a copy,
   * not the array itself.
   */
  interface Solution {
    /** Runs once, when the level starts. */
    init(elevators: readonly Elevator[], floors: readonly Floor[]): void;

    /**
     * Runs at a fixed rate of 100 times per simulated second, after `init`.
     * Optional: a solution with nothing to do per tick can leave it out.
     *
     * @param dt - Always one hundredth of a simulated second.
     */
    update?(dt: number, elevators: readonly Elevator[], floors: readonly Floor[]): void;
  }

  /** {@link Solution.init}, for annotating one declared on its own. */
  type Init = Solution["init"];

  /** {@link Solution.update}, for annotating one declared on its own. */
  type Update = NonNullable<Solution["update"]>;
}
