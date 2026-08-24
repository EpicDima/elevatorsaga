/**
 * The floor facade handed to player code.
 *
 * The counterpart of {@link "./elevator-interface.ts"!ElevatorInterface}, which
 * the legacy code never had: `world.js` passed the real `Floor` objects to
 * `codeObj.init` and `codeObj.update`, so solutions could reach `yPosition`,
 * `getSpawnPosY`, `elevatorAvailable`, `pressUpButton`, `trigger` and the live
 * `buttonStates` object, and could corrupt the simulation by touching any of
 * them (upstream issue #3).
 *
 * The surface is exactly `floorNum()`, `level`, `buttonStates`,
 * `pendingDestinations()` and `on`/`off`/`once`/`one`/`offAll`. Not one of them
 * reaches the simulation — the five that write anything write only the caller's
 * own handler list — which is what keeps this facade safe to hand out: the verb
 * a destination-dispatch program needs is
 * {@link "./elevator-interface.ts"!ElevatorInterface.takeRequest}, on the
 * facade that already had verbs. The emitter is held rather than inherited
 * from, so the dispatch side of it — `trigger`, `triggerSafe` — is not
 * reachable from player code. {@link "./elevator-interface.ts"!ElevatorInterface}
 * holds its emitter the same way, but does publish `trigger` as well: the
 * legacy elevator facade really was a `riot.observable(obj)`
 * (`interfaces.js:6`), so that was part of its surface and solutions may be
 * using it. The legacy floors were `riot.observable` too (`floor.js:3`) and
 * were handed to player code as they were, so the unregister side is theirs by
 * the same argument.
 *
 * `level` and `buttonStates` are undocumented but were readable on the old
 * object and are used by published solutions, so they are kept —
 * `buttonStates` as a snapshot rather than the floor's own mutable object.
 */

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
  /**
   * Someone pressed either call button; the direction says which one.
   *
   * Asked for as upstream issue #33, where the two separate events forced a
   * solution that treats a call as a call — the usual shape, since the queue an
   * elevator ends up with is a list of floors either way — to register the same
   * handler twice and then work out which button it had been given. This event
   * is that handler, once, with the answer as its first argument.
   *
   * The direction leads and the floor follows because the world's own
   * hall-call handler already takes the pair that way round
   * (`#handleButtonRepressing(direction, floor)` in `./world.ts`), and because
   * a `function` handler's `this` is already the facade, so the floor is the
   * argument a solution is less likely to need. A string rather than a boolean
   * or a pair of flags: `"up"` and `"down"` are the words the rest of the
   * player API uses for a direction, down to
   * {@link "./elevator-interface.ts"!ElevatorInterface.destinationDirection}.
   */
  hall_button_pressed: [direction: "up" | "down", floor: FloorInterface];
  /**
   * Somebody here asked to be taken to a floor, and no car is coming for it.
   *
   * The call a building with no hall buttons makes instead of the other three:
   * its passengers name where they are going, and a program answers by sending
   * a car for that journey. Silent about a passenger joining a journey a car is
   * already booked for, and raised again when that car turns up full — so a
   * program that answers every one of these has answered every passenger.
   *
   * The destination leads and the floor follows, as the direction does on
   * {@link FloorInterfaceEvents.hall_button_pressed} and for the same reason: a
   * `function` handler's `this` is already the facade, so the floor is the
   * argument a solution is least likely to need.
   */
  destination_requested: [destinationFloor: number, floor: FloorInterface];
};

/** Called with anything a player-code floor handler throws. */
export type FloorInterfaceErrorHandler = (e: unknown) => void;

/** The floor API exposed to player code. */
export class FloorInterface {
  /**
   * Floor number, counting up from 0 at the bottom.
   *
   * Undocumented, but readable on the legacy `Floor` object, so it is kept.
   */
  readonly level: number;

  readonly #floor: Floor;
  readonly #errorHandler: FloorInterfaceErrorHandler;
  /**
   * Player subscriptions.
   *
   * Dispatches with this facade as the receiver, so a `function` handler's
   * `this` is the facade — never this emitter, and never the real floor.
   */
  readonly #events = new PlayerObservable<FloorInterfaceEvents>(this);
  /**
   * Directions whose call is being delivered right now.
   *
   * Keeps each specific/general pair atomic against a nested press; see
   * {@link FloorInterface.forwardCall}.
   */
  readonly #callsInFlight = new Set<"up" | "down">();
  /**
   * Destinations whose request is being delivered right now.
   *
   * Read by {@link FloorInterface.forwardDestination}, which refuses a nested
   * request for one of them and remembers it instead.
   */
  readonly #destinationsInFlight = new Set<number>();
  /**
   * Destinations whose request was refused as already in flight.
   *
   * Delivered when the dispatch holding them up unwinds; see
   * {@link FloorInterface.forwardDestination}.
   */
  readonly #deferredDestinations = new Set<number>();

  /**
   * @param floor - The floor this facade wraps.
   * @param errorHandler - Receives anything a player-code handler throws.
   */
  constructor(floor: Floor, errorHandler: FloorInterfaceErrorHandler) {
    this.#floor = floor;
    this.level = floor.level;
    this.#errorHandler = errorHandler;

    // Forwarded rather than re-exposed, so player code never receives the real
    // Floor: the `*_button_pressed` events carry the floor that was pressed and
    // would otherwise hand it straight back.
    floor.on("buttonstate_change", () => {
      this.#tryTrigger("buttonstate_change", this.buttonStates);
    });

    // `hall_button_pressed` is derived here, from the event it generalizes,
    // rather than emitted by the real floor alongside it. That fixes the order
    // in this constructor instead of leaving it to the order the player
    // happened to register their handlers in: the specific event is delivered
    // first, then the general one, whichever way round they subscribed.
    //
    // Specific first because that is the one that was already being delivered.
    // A solution written before this event existed sees exactly the sequence it
    // always saw, with a new dispatch appended to it rather than pushed in
    // front.
    floor.on("up_button_pressed", () => {
      this.#forwardCall("up");
    });

    floor.on("down_button_pressed", () => {
      this.#forwardCall("down");
    });

    // No pair to keep whole: this event generalizes nothing and nothing is
    // derived from it. What it does need is a nested request to survive, in
    // both of the shapes a nested request comes in — another destination, and
    // the same one — which is why every request goes through
    // `#forwardDestination` rather than straight at the emitter.
    floor.on("destination_requested", (_requestingFloor, destinationFloor) => {
      this.#forwardDestination(destinationFloor);
    });
  }

  /**
   * Delivers one call as the specific event and then the general one.
   *
   * The pair is dispatched under a single in-flight mark so that it is
   * delivered whole or not at all. Without that, a nested press splits it: the
   * floor itself has no re-entrancy guard on purpose (see {@link Floor}), a
   * passenger refused by a full car really does press again while
   * `*_button_pressed` is still being dispatched, and the emitter's own guard is
   * per event name. So the nested specific event would be refused as already in
   * flight while the nested general one sailed through — a
   * `hall_button_pressed` with no button event before it, which is precisely
   * what this class documents cannot happen. Reached from a handler of the
   * general event it fails the other way round, delivering the specific event
   * and swallowing the general one.
   *
   * Marked per direction rather than once for both, because the two directions
   * are two independent calls: a handler that presses the *other* button must
   * still be heard, exactly as it was before this event existed. Only a repress
   * of the button already in flight is dropped, which is the behavior the
   * specific event has always had.
   *
   * Which is why the general half goes out under a key of its own. The emitter
   * guards by event name, and `hall_button_pressed` is a single name for both
   * directions — so a handler of it that presses the other button would have had
   * its specific event delivered, the mark above admitting a different
   * direction, and its general one refused as already in flight. That is the
   * same split again, in the one case the per-direction mark was meant to allow.
   * Keyed by direction the two calls nest, and the mark above is what stops the
   * nesting: one call per direction, so two deep at most.
   *
   * @param direction - Which call button was pressed.
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
   * Delivers one request, and once more when it was raised again from inside.
   *
   * Nesting is not hypothetical here. A handler that rewrites an indicator
   * reaches `World.handleElevAvailability`, a passenger the booked car has no
   * room for, `Floor.destinationRefused` — which withdraws the booking — and a
   * fresh request while this dispatch is still running.
   *
   * A request for another destination is an independent one and has to be
   * heard, so the dispatch is keyed per destination: the emitter's own guard is
   * per event name and would refuse it. A request for the same destination
   * cannot be delivered where it stands, since that is the recursion the guard
   * is there for — but dropping it loses the news that the booking just made
   * has been voided, and the floor is left waiting on a car the program was
   * never told about.
   *
   * So the mark is held here rather than left to the emitter, and a request it
   * refuses is remembered and delivered once the dispatch holding it up has
   * unwound. The mark is cleared before the re-emit, which makes the re-emit a
   * fresh dispatch standing on its own merits, and cleared after it as well, so
   * a mark the re-delivery itself left cannot fire a third dispatch later. One
   * re-delivery per dispatch and no more is what bounds a handler that reissues
   * its own request forever.
   *
   * A re-delivery is re-checked against the floor first. A request answered
   * while the dispatch was unwinding — a car booked for it, or the last person
   * waiting boarded — is no longer standing, and announcing it would hand the
   * program a duplicate it has no way to tell from a real request.
   *
   * @param destinationFloor - Floor somebody here asked to be taken to.
   * @param redelivering - Whether this call is itself the one re-delivery.
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

  /**
   * Whether a journey is still waiting on a car nobody has booked.
   *
   * @param destinationFloor - Floor to ask about.
   * @returns `true` when somebody here is bound for it and no car is booked to
   * take them.
   */
  #stillUnanswered(destinationFloor: number): boolean {
    return (
      this.#floor.pendingDestinations().has(destinationFloor) &&
      this.#floor.assignedElevator(destinationFloor) === null
    );
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
  #tryTrigger<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    ...args: FloorInterfaceEvents[K]
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
  on<S extends EventNameSpec<FloorInterfaceEvents>>(
    events: S,
    handler: HandlerFor<S, FloorInterfaceEvents>,
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
  once<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    handler: EventHandler<FloorInterfaceEvents[K]>,
  ): this {
    this.#events.once(event, handler);
    return this;
  }

  /**
   * Legacy spelling of {@link FloorInterface.once}.
   *
   * The legacy floors were `riot.observable` objects (`floor.js:3`) handed
   * straight to player code (`world.js:239`), and riot published `one` rather
   * than `once` (`libs/riot.js:33`).
   *
   * @param event - Single event name.
   * @param handler - Called on the next occurrence of `event`.
   * @returns This facade, for chaining.
   */
  one<K extends EventName<FloorInterfaceEvents>>(
    event: K,
    handler: EventHandler<FloorInterfaceEvents[K]>,
  ): this {
    return this.once(event, handler);
  }

  /**
   * Unregisters handlers.
   *
   * @param events - Event name, names separated by single spaces, or `"*"` for
   * every event; see {@link FloorInterface.offAll} for why the wildcard is part
   * of this facade's surface.
   * @param handler - When given, only this exact function is unregistered;
   * when omitted, every handler of each listed event is. Ignored for `"*"`, as
   * it was by riot.
   * @returns This facade, for chaining.
   */
  off<S extends OffEventSpec<FloorInterfaceEvents>>(
    events: S,
    handler?: HandlerFor<S, FloorInterfaceEvents>,
  ): this {
    this.#events.off(events, handler);
    return this;
  }

  /**
   * Removes every handler player code registered on this floor.
   *
   * The named spelling of the legacy `floor.off("*")`, which really was
   * reachable: `asFloor` built each floor as a `riot.observable(obj)`
   * (`floor.js:3`), `world.js:75` put those very objects in `world.floors`, and
   * the world controller passed that array straight to `codeObj.init` and
   * `codeObj.update` (`world.js:239`, `world.js:248`). `"*"` was riot's
   * unregister-everything wildcard (`libs/riot.js:18`), and `world.unWind` used
   * it on the floors itself (`world.js:201-204`). {@link FloorInterface.off}
   * still accepts that spelling and routes it here.
   *
   * Only the player's own subscriptions go. The forwarding that makes this
   * facade work is registered on the real floor's emitter rather than on this
   * one, so it is untouched here — a player calling this keeps receiving floor
   * events on every handler registered afterwards, instead of silently going
   * deaf for the rest of the run. That is a deliberate improvement on riot,
   * where `off("*")` cleared one shared callback map and so tore out the
   * world's own `handleButtonRepressing` subscription along with the player's.
   *
   * @returns This facade, for chaining.
   */
  offAll(): this {
    this.#events.offAll();
    return this;
  }

  /**
   * Lit state of the two call buttons.
   *
   * A fresh snapshot on every read, so player code cannot clear the floor's
   * buttons by assigning to it — which the legacy object allowed, because it
   * handed out the live object the presenter renders from.
   *
   * @returns A copy of the current button states.
   */
  get buttonStates(): Readonly<FloorButtonStates> {
    return { up: this.#floor.buttonStates.up, down: this.#floor.buttonStates.down };
  }

  /**
   * This floor's number.
   *
   * @returns The floor number, counting up from 0 at the bottom.
   */
  floorNum(): number {
    return this.level;
  }

  /**
   * Journeys people here have asked for and are still waiting on.
   *
   * What `buttonStates` is to a building with call buttons: everything this
   * floor is currently asking for, at any moment rather than at the moment
   * somebody asked. A program that answers `destination_requested` from inside
   * the handler never needs it; one that decides later, or that has to notice a
   * request it booked a car for and then never sent the car to fetch, does —
   * that request is still here, and nothing will say it again.
   *
   * A fresh array on every read, in floor order, for the reason `buttonStates`
   * is a fresh snapshot: the engine's own book is a live map, and handing it
   * out would let player code empty a floor by deleting from it.
   *
   * @returns One entry per destination somebody is waiting for, ascending. An
   * empty array in a building whose passengers press call buttons.
   */
  pendingDestinations(): PendingDestination[] {
    return [...this.#floor.pendingDestinations()]
      .map(([floorNum, waiting]) => ({ floorNum, waiting }))
      .sort((a, b) => a.floorNum - b.floorNum);
  }
}
