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
 * The surface is exactly `floorNum()`, `level`, `buttonStates` and
 * `on`/`off`/`once`/`offAll`. The emitter is held rather than inherited from,
 * so the dispatch side of it — `trigger`, `triggerSafe` — is not reachable from
 * player code. {@link "./elevator-interface.ts"!ElevatorInterface} holds its
 * emitter the same way, but does publish `trigger` as well: the legacy elevator
 * facade really was a `riot.observable(obj)` (`interfaces.js:6`), so that was
 * part of its surface and solutions may be using it. The legacy floors were
 * `riot.observable` too (`floor.js:3`) and were handed to player code as they
 * were, so the unregister side is theirs by the same argument.
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

/** Events a {@link FloorInterface} exposes to player code. */
export type FloorInterfaceEvents = {
  /** Either call button was lit or cleared. */
  buttonstate_change: [buttonStates: Readonly<FloorButtonStates>];
  /** Someone pressed the up call button. */
  up_button_pressed: [floor: FloorInterface];
  /** Someone pressed the down call button. */
  down_button_pressed: [floor: FloorInterface];
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
   * @param floor - The floor this facade wraps.
   * @param errorHandler - Receives anything a player-code handler throws.
   */
  constructor(floor: Floor, errorHandler: FloorInterfaceErrorHandler) {
    this.#floor = floor;
    this.level = floor.level;
    this.#errorHandler = errorHandler;

    // Forwarded rather than re-exposed, so player code never receives the real
    // Floor: the two `*_button_pressed` events carry the floor that was pressed
    // and would otherwise hand it straight back.
    floor.on("buttonstate_change", () => {
      this.#tryTrigger("buttonstate_change", this.buttonStates);
    });

    floor.on("up_button_pressed", () => {
      this.#tryTrigger("up_button_pressed", this);
    });

    floor.on("down_button_pressed", () => {
      this.#tryTrigger("down_button_pressed", this);
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
}
