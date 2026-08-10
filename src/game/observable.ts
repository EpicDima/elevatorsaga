/**
 * Typed event emitter shared by every simulation object.
 *
 * This single implementation replaces both legacy emitters:
 *
 * - `riot.observable` (libs/riot.js) — used by `Floor`, `ElevatorInterface`,
 *   `world` and `worldController`.
 * - `unobservable.Observable` (libs/unobservable.js) — used by `Movable`,
 *   `Elevator` and `User`.
 *
 * The behaviours below are load-bearing for the simulation and are preserved:
 *
 * 1. Space separated event names in {@link Observable.on} / {@link Observable.off}
 *    register (or unregister) the handler for every listed name.
 * 2. Removing a handler in the middle of a dispatch is safe: a handler removed
 *    before it is reached is *not* invoked, and no handler is skipped.
 * 3. `once` handlers run exactly once and are removed before invocation.
 * 4. Re-entrant {@link Observable.trigger} calls from inside a handler work.
 * 5. Handlers are invoked with the emitter as their `this`, so the documented
 *    `elevator.on("idle", function () { this.goToFloor(0); })` idiom works.
 *    Both legacy emitters did this (`libs/riot.js:45` dispatched with
 *    `fn.apply(el, args)`, `libs/unobservable.js:96-97` with `fn.call(this, …)`).
 *    Arrow handlers are unaffected: they keep their defining scope's `this`.
 *
 * Three legacy quirks are deliberately dropped:
 *
 * - riot prepended the event name as the first handler argument whenever a
 *   handler was registered for more than one name (`fn.typed = pos > 0`). That
 *   was undocumented and confusing; callers now pass the distinguishing value
 *   explicitly instead.
 * - riot's `fn.busy` re-entrancy guard, which silently skipped a handler that
 *   was re-triggered from within itself. `unobservable` never had it, and it is
 *   the cause of upstream issue #88: a handler that throws never clears `busy`
 *   and is dead for the rest of the run. {@link Observable} therefore has no
 *   guard at all; {@link PlayerObservable} reinstates a per-event one, cleared
 *   in a `finally`, for the two facades player code subscribes to.
 * - a *live* handler list during dispatch. Both legacy emitters iterated the
 *   array they were still appending to (`libs/riot.js:41`;
 *   `libs/unobservable.js:94`, whose loop condition carries the comment
 *   `// Note: len can change during iteration`), so a handler registered from
 *   inside a dispatch *did* run for the event already in flight — and a handler
 *   that re-registered itself could livelock. {@link Observable.trigger}
 *   iterates a snapshot instead, matching the DOM `EventTarget` model, so the
 *   set of handlers for one event is fixed the moment it is dispatched and the
 *   dispatch always terminates. Nothing in the simulation registers handlers
 *   from inside a dispatch, so this divergence is not observable in play.
 */

/**
 * Maps an event name to the tuple of arguments its handlers receive.
 *
 * Declare event maps with `type` (not `interface`) so they keep the implicit
 * index signature that satisfies this constraint.
 */
export type EventArgsMap = Record<string, readonly unknown[]>;

/** Union of the event names declared by an event map. */
export type EventName<E extends EventArgsMap> = keyof E & string;

/** Handler signature for a given argument tuple. */
export type EventHandler<Args extends readonly unknown[]> = (...args: Args) => void;

/**
 * Splits a space separated event string into a union of the individual names.
 *
 * Resolves to `never` for the unspecific `string` type so that a non-literal
 * argument cannot silently widen the handler signature.
 */
type SplitEventNames<S extends string> = string extends S
  ? never
  : S extends `${infer Head} ${infer Rest}`
    ? Exclude<Head, ""> | SplitEventNames<Rest>
    : Exclude<S, "">;

/**
 * One event name, or up to three names separated by single spaces.
 *
 * The legacy emitters accepted any number of names; three covers every
 * realistic registration (the documented multi-name form registers two) while
 * keeping the union small enough to produce readable type errors.
 */
export type EventNameSpec<E extends EventArgsMap> =
  | EventName<E>
  | `${EventName<E>} ${EventName<E>}`
  | `${EventName<E>} ${EventName<E>} ${EventName<E>}`;

/** The event names an `on`/`off` argument resolves to, filtered to known events. */
type NamesOf<S extends string, E extends EventArgsMap> = Extract<SplitEventNames<S>, EventName<E>>;

/**
 * Handler type accepted for a (possibly multi-name) event spec: it must be
 * callable with the arguments of every listed event.
 */
type HandlerFor<S extends string, E extends EventArgsMap> = EventHandler<E[NamesOf<S, E>]>;

/** Internal, type-erased handler shape. */
type ErasedHandler = (...args: readonly unknown[]) => void;

interface HandlerEntry {
  readonly handler: ErasedHandler;
  readonly once: boolean;
  /**
   * Set when the entry is unregistered. A dispatch iterates over a snapshot of
   * the handler list, so it consults this flag to skip entries that were
   * removed after the snapshot was taken.
   */
  removed: boolean;
}

/** Splits a space separated event string exactly like the legacy `/[^\s]+/g`. */
function splitEventNames(events: string): string[] {
  return events.split(/\s+/).filter((name) => name.length > 0);
}

/**
 * Minimal, fully typed event emitter.
 *
 * @typeParam E - Map of event name to the arguments its handlers receive.
 */
export class Observable<E extends EventArgsMap> {
  readonly #handlers = new Map<string, HandlerEntry[]>();

  /**
   * Registers `handler` for one event, or for several space separated events.
   *
   * @param events - Event name, or names separated by single spaces.
   * @param handler - Called, in registration order, on every matching trigger.
   * @returns This emitter, for chaining.
   */
  on<S extends EventNameSpec<E>>(events: S, handler: HandlerFor<S, E>): this {
    this.#add(events, handler as ErasedHandler, false);
    return this;
  }

  /**
   * Registers `handler` to run at most once for `event`.
   *
   * The handler is removed before it is invoked, so re-triggering the event
   * from inside it will not run it again.
   *
   * @param event - Single event name.
   * @param handler - Called on the next trigger of `event`.
   * @returns This emitter, for chaining.
   */
  once<K extends EventName<E>>(event: K, handler: EventHandler<E[K]>): this {
    this.#add(event, handler as ErasedHandler, true);
    return this;
  }

  /**
   * Unregisters handlers.
   *
   * @param events - Event name, or names separated by single spaces.
   * @param handler - When given, only entries registered with this exact
   * function are removed (including `once` entries). When omitted, every
   * handler of each listed event is removed.
   * @returns This emitter, for chaining.
   */
  off<S extends EventNameSpec<E>>(events: S, handler?: HandlerFor<S, E>): this {
    for (const name of splitEventNames(events)) {
      const entries = this.#handlers.get(name);
      if (entries === undefined) {
        continue;
      }
      if (handler === undefined) {
        for (const entry of entries) {
          entry.removed = true;
        }
        this.#handlers.delete(name);
        continue;
      }
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry?.handler === (handler as ErasedHandler)) {
          entry.removed = true;
          entries.splice(i, 1);
        }
      }
      if (entries.length === 0) {
        this.#handlers.delete(name);
      }
    }
    return this;
  }

  /**
   * Removes every handler for every event.
   *
   * Replaces the legacy `off("*")`.
   *
   * @returns This emitter, for chaining.
   */
  offAll(): this {
    for (const entries of this.#handlers.values()) {
      for (const entry of entries) {
        entry.removed = true;
      }
    }
    this.#handlers.clear();
    return this;
  }

  /**
   * Invokes every handler of `event`, in registration order.
   *
   * Iteration runs over a snapshot, so handlers added during the dispatch do
   * not run for this event (a deliberate divergence from the legacy emitters,
   * which iterated a live array), and handlers removed during the dispatch are
   * skipped even if they had not been reached yet.
   *
   * @param event - Event name to dispatch.
   * @param args - Arguments forwarded to each handler.
   * @returns This emitter, for chaining.
   */
  trigger<K extends EventName<E>>(event: K, ...args: E[K]): this {
    return this.#dispatch(event, args, null);
  }

  /**
   * Invokes every handler of `event`, isolating each one's exceptions.
   *
   * Same dispatch rules as {@link Observable.trigger}, except that a handler
   * which throws does not abort the dispatch: its exception goes to `onError`
   * and the remaining handlers still run. Handlers are never disabled by
   * throwing, so the same handler runs again on the next dispatch.
   *
   * Used for every dispatch that reaches player code. The legacy emitters had
   * no equivalent: `interfaces.js` and `floor.js` wrapped the whole `trigger`
   * in one try/catch, so the first player handler to throw silently killed
   * every handler after it (upstream issues #88, #83, #27).
   *
   * @param event - Event name to dispatch.
   * @param onError - Receives whatever a handler throws, once per failure, in
   * handler order.
   * @param args - Arguments forwarded to each handler.
   * @returns This emitter, for chaining.
   */
  triggerSafe<K extends EventName<E>>(
    event: K,
    onError: (e: unknown) => void,
    ...args: E[K]
  ): this {
    return this.#dispatch(event, args, onError);
  }

  /**
   * Shared dispatch loop behind {@link trigger} and {@link triggerSafe}.
   *
   * @param event - Event name to dispatch.
   * @param args - Arguments forwarded to each handler.
   * @param onError - Receives handler exceptions; `null` lets them propagate.
   * @returns This emitter, for chaining.
   */
  #dispatch(event: string, args: readonly unknown[], onError: ((e: unknown) => void) | null): this {
    const entries = this.#handlers.get(event);
    if (entries === undefined || entries.length === 0) {
      return this;
    }
    for (const entry of entries.slice()) {
      if (entry.removed) {
        continue;
      }
      if (entry.once) {
        this.#removeEntry(event, entry);
      }
      if (onError === null) {
        this.#invoke(entry.handler, args);
        continue;
      }
      try {
        this.#invoke(entry.handler, args);
      } catch (e) {
        onError(e);
      }
    }
    return this;
  }

  /**
   * Invokes one handler with this emitter as its `this`.
   *
   * `Reflect.apply` rather than `handler.call(...)` because the erased handler
   * type takes a `readonly unknown[]` rest parameter, which `strictBindCallApply`
   * refuses to match against `call`'s `A extends any[]`.
   *
   * @param handler - Handler to invoke.
   * @param args - Arguments forwarded to it.
   */
  #invoke(handler: ErasedHandler, args: readonly unknown[]): void {
    Reflect.apply(handler, this, args);
  }

  #add(events: string, handler: ErasedHandler, once: boolean): void {
    for (const name of splitEventNames(events)) {
      let entries = this.#handlers.get(name);
      if (entries === undefined) {
        entries = [];
        this.#handlers.set(name, entries);
      }
      entries.push({ handler, once, removed: false });
    }
  }

  #removeEntry(name: string, entry: HandlerEntry): void {
    entry.removed = true;
    const entries = this.#handlers.get(name);
    if (entries === undefined) {
      return;
    }
    const index = entries.indexOf(entry);
    if (index >= 0) {
      entries.splice(index, 1);
    }
    if (entries.length === 0) {
      this.#handlers.delete(name);
    }
  }
}

/**
 * Emitter for the facades player code subscribes to.
 *
 * Adds one thing to {@link Observable}: {@link PlayerObservable.triggerSafe}
 * refuses to re-enter a dispatch of an event already in flight on this emitter.
 * Player code re-triggering the event it is handling is a common mistake — the
 * documented `idle` idiom does it by accident — and without a guard it recurses
 * until the stack overflows, which surfaces as a `usercode_error` and pauses the
 * game. riot, which backed these facades, absorbed it.
 *
 * The guard is per event *name*, where riot's `fn.busy` was per handler
 * *function*. That is a deliberate simplification: the outcome is the same for
 * the case that actually happens (a handler re-triggering its own event runs
 * once), it needs no bookkeeping on the handler objects, and "one dispatch of
 * an event at a time, per emitter" is a rule that can be stated in one line.
 * What it gives up is riot's ability to still run the *other* handlers of a
 * re-triggered event.
 *
 * Only the error-isolating dispatch is guarded. {@link Observable.trigger} is
 * how the simulation talks to itself and is left free to nest, and the guard is
 * cleared in a `finally` so a throwing handler cannot wedge an event off
 * permanently — riot's defect in upstream issue #88.
 *
 * @typeParam E - Map of event name to the arguments its handlers receive.
 */
export class PlayerObservable<E extends EventArgsMap> extends Observable<E> {
  readonly #inFlight = new Set<string>();

  /**
   * Invokes every handler of `event`, isolating exceptions and refusing to
   * re-enter a dispatch of `event` that is already running on this emitter.
   *
   * @param event - Event name to dispatch.
   * @param onError - Receives whatever a handler throws.
   * @param args - Arguments forwarded to each handler.
   * @returns This emitter, for chaining.
   */
  override triggerSafe<K extends EventName<E>>(
    event: K,
    onError: (e: unknown) => void,
    ...args: E[K]
  ): this {
    if (this.#inFlight.has(event)) {
      return this;
    }
    this.#inFlight.add(event);
    try {
      return super.triggerSafe(event, onError, ...args);
    } finally {
      this.#inFlight.delete(event);
    }
  }
}
