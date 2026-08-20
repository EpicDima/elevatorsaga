/**
 * The elevator facade handed to player code.
 *
 * Ported from the legacy `interfaces.js`. This is the game's public API, so
 * every method name, arity and return value here is a compatibility contract
 * with every solution people have already written — see `documentation.html`.
 * The contract runs one way: nothing legacy published may change, while a
 * read-only query over state the engine already keeps — `isFull`, `isEmpty`,
 * `isApproachingFloor` and `servedFloors` — can be added, because no existing
 * solution can notice a method it never called, and none of them can make the
 * simulation do anything it would not have done anyway.
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
 * the player's code fails and the "error in your program" banner never
 * appears.
 */

import { t } from "../i18n/index.ts";
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

/**
 * Renders a value player code supplied, for an error message.
 *
 * `String()` rather than a template literal, so a symbol describes itself
 * instead of throwing on the way into the message. The two shapes `String()`
 * renders uselessly are spelled out: an object comes out as `[object Object]`
 * and an array as its bare comma separated contents, neither of which tells
 * anyone what they passed.
 *
 * Only those two are prose, and only they are translated. Everything else here
 * is the value the player wrote, quoted back at them: `NaN`, `undefined`,
 * `"abc"`. Translating those would be translating their program.
 *
 * @param value - The value player code supplied.
 * @returns A short description of it.
 */
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
   * Whether this facade has already reported a destination it had to drop from
   * a hand-assigned {@link destinationQueue}. See
   * {@link ElevatorInterface.checkDestinationQueue}.
   */
  #reportedDroppedDestination = false;
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
        this.#waitAtFloor();
      } else {
        this.checkDestinationQueue();
      }
    });

    // A boarding offer that was taken outside the arrival sequence — the
    // indicator re-offer added for issue #59 — gets the same dwell, otherwise
    // the car can accept a passenger and drive away in the same frame, with
    // them still walking in (upstream issue #105, which the legacy code was
    // free of only because arrival was its one and only boarding path).
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
   * Holds the car at the floor long enough for passengers to walk in or out,
   * then takes the next destination.
   *
   * The legacy `elevator.wait(1, ...)` of `interfaces.js:64`, kept at one
   * second because that is what a passenger's walk-in takes (`user.js:67`).
   *
   * Any dwell already running is discarded rather than left to finish: the
   * second caller is a passenger who has *just* started boarding, so the time
   * already served is not time they were given, and `wait` refuses to run on a
   * busy movable anyway. Restarting is free on the arrival path, where the two
   * calls happen in the same frame with no simulated time in between, so the
   * car leaves exactly when it always did.
   */
  #waitAtFloor(): void {
    this.#elevator.currentTask = null;
    this.#elevator.wait(WAIT_AT_FLOOR_SECONDS, () => {
      this.checkDestinationQueue();
    });
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
   *
   * Any non-finite entry in {@link destinationQueue} is dropped first, and
   * reported once; see the private `#dropUnreachableDestinations` below. This
   * method cannot throw the way {@link goToFloor} does, because the engine
   * calls it too — from `World.init`, and from the arrival and dwell paths —
   * where an exception would take the simulation down rather than the player's
   * code.
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
   * Removes destinations the elevator could never reach, and says so once.
   *
   * {@link goToFloor} refuses a non-finite floor outright, but
   * {@link destinationQueue} is documented as directly assignable and this is
   * the path that assignment takes: the head of the queue goes to the elevator
   * unexamined, so a `NaN` in it becomes the car's `destinationY`, and from
   * there `y`, `currentFloor` and the queue head are `NaN` for good. Nothing
   * recovers a car in that state — not `stop()`, not emptying the queue, not a
   * later `goToFloor` — so the entry is dropped before it can do it.
   *
   * Only non-finite entries go. A finite one outside the building is left
   * exactly where it was: `legacy-1.x:interfaces.js:19` handed the queue head
   * over unclamped as well, an out-of-range floor merely sends the car past the
   * end of the shaft, and it is still a position the simulation can compute.
   *
   * Reported at most once per facade, not once per call: the queue is
   * re-checked on arrival, after every dwell and from player code's own
   * `update`, so an unguarded report is a report per frame. Per facade rather
   * than the module-level, never-reset flag behind the deprecation notice in
   * `Elevator.getFirstPressedFloor`, because a new world builds new facades:
   * restarting the level with the same mistake still gets told about it,
   * which matters here in a way it does not for a notice that only prints.
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
   * Turns a floor number player code supplied into one of this building's.
   *
   * The single policy behind every method here that takes a floor, so that the
   * same mistake gets the same answer wherever it is made: coerce, refuse what
   * is not a finite number, then clamp what is left into the building.
   *
   * The order matters. `limitNumber` is the legacy
   * `Math.min(max, Math.max(num, min))` (`legacy-1.x:base.js:11`), which has a
   * floor to offer every real number, `Infinity` included, but passes `NaN`
   * straight through — so a clamp on its own would hand `NaN` back as if it
   * were a floor.
   *
   * @param method - Name of the calling method, for the error message.
   * @param floorNum - Whatever player code passed. Coerced with `Number()`
   * because player code is untyped and may pass a string.
   * @returns The floor, clamped to `0`..`floorCount - 1`; fractional values are
   * kept, since a position between floors is one the simulation can work with.
   * @throws {TypeError} When `floorNum` is not a finite number, and so has no
   * floor to be clamped to.
   */
  #toFloorNumber(method: string, floorNum: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- player code is untyped JS and does pass strings here
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
   * Queues a floor to travel to.
   *
   * A request equal to the adjacent end of the queue is dropped, so repeatedly
   * asking for the same floor does not pile up.
   *
   * A destination that is not a finite number is refused rather than queued.
   * `limitNumber` is the legacy `Math.min(max, Math.max(num, min))`
   * (`legacy-1.x:base.js:11`), which has a floor to offer every real number,
   * `Infinity` included, but passes `NaN` straight through — so
   * `elevator.goToFloor(undefined)` used to queue `NaN`, and the car's `y`,
   * `currentFloor` and queue head were `NaN` for the rest of the run, with no
   * error, no pause and no way back. `legacy-1.x:interfaces.js:28` did the same
   * thing, but a single typo turning an elevator into a silent brick is not a
   * behaviour worth being faithful to, and no working solution passes one. This
   * method is only ever called by player code, apart from the re-offer in
   * `World.#handleButtonRepressing`, which passes a floor's own level; so the
   * throw lands in the `try`/`catch` around `codeObj.init` and `codeObj.update`
   * in `WorldController.start`, or in the one `triggerSafe` puts around each
   * player handler, and reaches the player as a paused game and the "problem
   * with your code" banner, like any other mistake in their code.
   *
   * @param floorNum - Destination floor, clamped into the valid range. Coerced
   * with `Number()` because player code is untyped and may pass a string.
   * @param forceNow - Put the floor at the front of the queue instead of the
   * back.
   * @throws {TypeError} When `floorNum` is not a finite number, and so has no
   * floor to be clamped to.
   */
  goToFloor(floorNum: number, forceNow?: boolean): void {
    const floor = this.#toFloorNumber("goToFloor", floorNum);
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
   * The floors this elevator serves.
   *
   * In a zoned building a car is only allowed to carry passengers between the
   * floors of its own zone: a trip with either end outside them is refused, and
   * the car's arrival clears no call button on a floor it does not serve. A
   * dispatcher picking a car for a call has to know which one that is, so this
   * is the method that answers it.
   *
   * It says nothing about where the car can *go*. {@link goToFloor} takes any
   * floor of the building whether the car serves it or not — a zone is a rule
   * about service, not about the shaft — so sending a car outside its zone is a
   * journey that carries nobody and still costs moves.
   *
   * A car with no zone of its own reports every floor in the building rather
   * than an empty array or nothing at all. One shape always, so that
   * `elevator.servedFloors().includes(n)` is the whole idiom and levels without
   * zoning are not a special case to remember.
   *
   * A fresh array each call, for the reason {@link getPressedFloors} returns
   * one: sorting or splicing the answer must not be able to reach into the
   * engine.
   *
   * @returns The served floor numbers, in ascending order.
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
   * Whether every passenger slot is taken.
   *
   * The dependable "nobody else fits" test, which {@link loadFactor} cannot be:
   * passengers weigh a random 55 to 100 against the nominal 100 per slot
   * (`world.ts`), so a full car reads about 0.775 on average and essentially
   * never reaches 1. A passenger counts from the moment they start walking in,
   * because that is when they take their slot.
   *
   * Present on the elevator since `legacy-1.x:elevator.js:221`, and asked for by
   * players ever since; only the facade was missing.
   *
   * @returns `true` when no slot is free.
   */
  isFull(): boolean {
    return this.#elevator.isFull();
  }

  /**
   * Whether the elevator is carrying nobody.
   *
   * Not the negation of {@link isFull}: a car with one passenger of four is
   * neither full nor empty. `legacy-1.x:elevator.js:225`.
   *
   * @returns `true` when every slot is free.
   */
  isEmpty(): boolean {
    return this.#elevator.isEmpty();
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
   * Whether the elevator is moving toward a floor it has not passed yet.
   *
   * The elevator's own predicate (`legacy-1.x:elevator.js:206`), which is
   * exactly the test `Elevator.handleNewState` puts in front of every
   * `passing_floor` event (`legacy-1.x:elevator.js:251`): a floor is only ever
   * announced as being passed while this holds for it. So player code and the
   * engine share one notion of "passed", rather than this method inventing a
   * second one that could disagree with the event.
   *
   * It is the car's *current* position that decides, not the position it would
   * coast to if it braked now. `getExactFutureFloorIfStopped` stays behind the
   * facade deliberately: an answer derived from it would depend on the braking
   * curve, and publishing that would freeze this port's kinematics into the
   * player API, which the behavioural-compatibility contract does not ask for.
   *
   * Only the direction of travel is considered, not the destination — a floor
   * further along the way the car is going counts as approaching even when the
   * car is going to stop before it, just as it does for `passing_floor`, which
   * is raised for floors the car merely happens to travel over. A car standing
   * still approaches nothing, so this is `false` for every floor between
   * arriving somewhere and setting off again.
   *
   * @param floorNum - Floor to ask about, treated exactly as {@link goToFloor}
   * treats a destination: coerced with `Number()`, and clamped into the
   * building, so a floor above the roof asks about the top floor.
   * @returns `true` when the car is moving and that floor is still ahead of it.
   * @throws {TypeError} When `floorNum` is not a finite number — a missing
   * argument included. Answering `false` would be indistinguishable from a
   * genuine "no", and the mistake would be invisible; the throw reaches the
   * player as the paused game and the "error in your program" banner, the same
   * way {@link goToFloor} reports it.
   */
  isApproachingFloor(floorNum: number): boolean {
    return this.#elevator.isApproachingFloor(this.#toFloorNumber("isApproachingFloor", floorNum));
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
