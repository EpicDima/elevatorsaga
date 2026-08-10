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
 *   and is dead for the rest of the run. Where re-entrancy actually has to be
 *   contained — `ElevatorInterface.checkDestinationQueue`, which is riot-backed
 *   and is the one dispatch player code re-enters — the guard lives at that
 *   call site, scoped to the one event and cleared in a `finally`.
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
      entry.handler(...args);
    }
    return this;
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
