/** Typed event emitter shared by every simulation object. */

/**
 * Maps an event name to the tuple of arguments its handlers receive. Declare
 * event maps with `type`, not `interface`, so they keep the implicit index
 * signature this constraint relies on.
 */
export type EventArgsMap = Record<string, readonly unknown[]>;

export type EventName<E extends EventArgsMap> = keyof E & string;

export type EventHandler<Args extends readonly unknown[]> = (...args: Args) => void;

/**
 * Splits a space separated event string into a union of the individual names.
 * Resolves to `never` for a non-literal `string` so it can't silently widen a
 * handler signature.
 */
type SplitEventNames<S extends string> = string extends S
  ? never
  : S extends `${infer Head} ${infer Rest}`
    ? Exclude<Head, ""> | SplitEventNames<Rest>
    : Exclude<S, "">;

/**
 * One event name, or up to four names separated by single spaces. The bound
 * is this type's own — TypeScript can't represent a much larger union of
 * joined literals — not a limit on what {@link splitEventNames} accepts.
 */
export type EventNameSpec<E extends EventArgsMap> =
  | EventName<E>
  | `${EventName<E>} ${EventName<E>}`
  | `${EventName<E>} ${EventName<E>} ${EventName<E>}`
  | `${EventName<E>} ${EventName<E>} ${EventName<E>} ${EventName<E>}`;

/** Wildcard event spec accepted by {@link Observable.off} to unregister everything. */
export type AllEvents = "*";

export type OffEventSpec<E extends EventArgsMap> = EventNameSpec<E> | AllEvents;

/** The event names an `on`/`off` argument resolves to, filtered to known events. */
type NamesOf<S extends string, E extends EventArgsMap> = Extract<SplitEventNames<S>, EventName<E>>;

type IsMultiName<S extends string> = S extends `${string} ${string}` ? true : false;

/**
 * Handler type for a (possibly multi-name) event spec. A single-name spec
 * types the handler with that event's own arguments; a multi-name spec
 * prepends the fired event's name, so only that first parameter is typed.
 */
export type HandlerFor<S extends string, E extends EventArgsMap> =
  IsMultiName<S> extends true
    ? (eventName: NamesOf<S, E>, ...args: never[]) => void
    : EventHandler<E[NamesOf<S, E>]>;

/** Internal, type-erased handler shape. */
type ErasedHandler = (...args: readonly unknown[]) => void;

interface HandlerEntry {
  readonly handler: ErasedHandler;
  readonly once: boolean;
  /**
   * Set when the entry's registration listed more than one event name, so
   * dispatch prepends the fired event's name to the handler's arguments.
   */
  readonly typed: boolean;
  /**
   * Set when the entry is unregistered, so a dispatch that began before it was
   * can skip it rather than call a handler someone has since taken off.
   */
  removed: boolean;
}

/** Splits a space separated event string into its individual names. */
function splitEventNames(events: string): string[] {
  return events.split(/\s+/).filter((name) => name.length > 0);
}

/**
 * Hands a handler's exception to the reporter, isolating the reporter's own
 * exceptions so a throwing reporter can't abort the dispatch too.
 */
function report(onError: (e: unknown) => void, error: unknown): void {
  try {
    onError(error);
  } catch (secondary) {
    console.error("Event error handler threw while reporting", error, secondary);
  }
}

/**
 * How many dispatches are in flight, across every emitter. While any is, a
 * splice goes to a copy of the handler list rather than to the list itself,
 * which is what lets a dispatch iterate that list directly instead of copying
 * it every time — and a simulation step dispatches thousands of times.
 *
 * Module-wide rather than per emitter deliberately. Every simulation class
 * extends this one, so the dispatch loop below sees a different shape on
 * nearly every call, and a field read there costs more than the copies a
 * per-emitter count would save: measured, it gave back the whole win.
 */
let dispatchesInFlight = 0;

/** Minimal, fully typed event emitter. */
export class Observable<E extends EventArgsMap> {
  readonly #handlers = new Map<string, HandlerEntry[]>();
  readonly #receiver: object;

  /**
   * `receiver` is what handlers are invoked with as `this`; it defaults to the
   * emitter itself. Pass the owning object when this emitter is held by
   * composition rather than inherited from.
   */
  constructor(receiver?: object) {
    this.#receiver = receiver ?? this;
  }

  /** Registers `handler` for one event, or several space separated events, in registration order. */
  on<S extends EventNameSpec<E>>(events: S, handler: HandlerFor<S, E>): this {
    this.#add(events, handler as ErasedHandler, false);
    return this;
  }

  /**
   * Registers `handler` to run at most once for `event`. It's removed before
   * being invoked, so re-triggering `event` from inside it won't run it again.
   */
  once<K extends EventName<E>>(event: K, handler: EventHandler<E[K]>): this {
    this.#add(event, handler as ErasedHandler, true);
    return this;
  }

  /** Alias kept for player code written against the legacy `one` API. */
  one<K extends EventName<E>>(event: K, handler: EventHandler<E[K]>): this {
    return this.once(event, handler);
  }

  /**
   * Unregisters handlers for one or more events, or every event via `"*"`. When
   * `handler` is given, only entries registered with that exact function are
   * removed; otherwise every handler for each listed event is removed.
   */
  off<S extends OffEventSpec<E>>(events: S, handler?: HandlerFor<S, E>): this {
    if (events === ("*" satisfies AllEvents)) {
      return this.offAll();
    }
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
      if (!entries.some((entry) => entry.handler === (handler as ErasedHandler))) {
        continue;
      }
      const list = this.#listToMutate(name, entries);
      for (let i = list.length - 1; i >= 0; i--) {
        const entry = list[i];
        if (entry?.handler === (handler as ErasedHandler)) {
          entry.removed = true;
          list.splice(i, 1);
        }
      }
      if (list.length === 0) {
        this.#handlers.delete(name);
      }
    }
    return this;
  }

  /** Removes every handler for every event; {@link Observable.off}'s `"*"` routes here. */
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
   * Invokes every handler of `event`, in registration order, as the list stood
   * when the dispatch began: handlers added during the dispatch don't run for
   * it, and handlers removed during it are skipped if not yet reached.
   */
  trigger<K extends EventName<E>>(event: K, ...args: E[K]): this {
    return this.#dispatch(event, args, null);
  }

  /**
   * Like {@link Observable.trigger}, but a handler that throws doesn't abort
   * the dispatch: its exception goes to `onError` and the rest still run. Used
   * for every dispatch that reaches player code.
   */
  triggerSafe<K extends EventName<E>>(
    event: K,
    onError: (e: unknown) => void,
    ...args: E[K]
  ): this {
    return this.#dispatch(event, args, onError);
  }

  /** Shared dispatch loop behind {@link trigger} and {@link triggerSafe}. */
  #dispatch(event: string, args: readonly unknown[], onError: ((e: unknown) => void) | null): this {
    const entries = this.#handlers.get(event);
    if (entries === undefined || entries.length === 0) {
      return this;
    }
    // The list itself, not a copy: a splice during the dispatch goes elsewhere,
    // and the length read here is what hides handlers added along the way.
    const count = entries.length;
    dispatchesInFlight++;
    try {
      for (let i = 0; i < count; i++) {
        const entry = entries[i];
        if (entry === undefined || entry.removed) {
          continue;
        }
        if (entry.once) {
          this.#removeEntry(event, entry);
        }
        const handlerArgs = entry.typed ? [event, ...args] : args;
        if (onError === null) {
          this.#invoke(entry.handler, handlerArgs);
          continue;
        }
        try {
          this.#invoke(entry.handler, handlerArgs);
        } catch (e) {
          report(onError, e);
        }
      }
    } finally {
      dispatchesInFlight--;
    }
    return this;
  }

  /**
   * The handler list of `name` in a form safe to splice. A dispatch in flight
   * is iterating the stored list, so this leaves a copy in the table for it to
   * finish on and hands back the one nothing is reading.
   */
  #listToMutate(name: string, entries: HandlerEntry[]): HandlerEntry[] {
    if (dispatchesInFlight === 0) {
      return entries;
    }
    const copy = entries.slice();
    this.#handlers.set(name, copy);
    return copy;
  }

  /**
   * Invokes `handler` with the receiver as its `this`. Uses `Reflect.apply`
   * because `strictBindCallApply` rejects `handler.call(...)` for this erased,
   * `readonly unknown[]`-rest signature.
   */
  #invoke(handler: ErasedHandler, args: readonly unknown[]): void {
    Reflect.apply(handler, this.#receiver, args);
  }

  #add(events: string, handler: ErasedHandler, once: boolean): void {
    const names = splitEventNames(events);
    const typed = names.length > 1;
    for (const name of names) {
      let entries = this.#handlers.get(name);
      if (entries === undefined) {
        entries = [];
        this.#handlers.set(name, entries);
      }
      entries.push({ handler, once, typed, removed: false });
    }
  }

  #removeEntry(name: string, entry: HandlerEntry): void {
    entry.removed = true;
    const entries = this.#handlers.get(name);
    if (entries === undefined) {
      return;
    }
    const index = entries.indexOf(entry);
    // A copy holds the same entries in the same order, so the index still points at `entry`.
    const list = index >= 0 ? this.#listToMutate(name, entries) : entries;
    if (index >= 0) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      this.#handlers.delete(name);
    }
  }
}

/**
 * {@link Observable} for the facades player code subscribes to. Refuses to
 * re-enter a dispatch already in flight on this emitter, preventing a handler
 * that re-triggers its own event from recursing until the stack overflows.
 */
export class PlayerObservable<E extends EventArgsMap> extends Observable<E> {
  readonly #inFlight = new Set<string>();

  /** Like {@link Observable.trigger}, but refuses to re-enter a dispatch already in flight. */
  override trigger<K extends EventName<E>>(event: K, ...args: E[K]): this {
    return this.#guard(event, () => super.trigger(event, ...args));
  }

  /** Like {@link Observable.triggerSafe}, but refuses to re-enter a dispatch already in flight. */
  override triggerSafe<K extends EventName<E>>(
    event: K,
    onError: (e: unknown) => void,
    ...args: E[K]
  ): this {
    return this.#guard(event, () => super.triggerSafe(event, onError, ...args));
  }

  /**
   * Like {@link triggerSafe}, but guards re-entrancy by `key` rather than
   * `event`'s own name, for events that generalize several others. `key`
   * shares the event-name namespace, so choose one that won't collide.
   */
  triggerSafeKeyed<K extends EventName<E>>(
    key: string,
    event: K,
    onError: (e: unknown) => void,
    ...args: E[K]
  ): this {
    return this.#guard(key, () => super.triggerSafe(event, onError, ...args));
  }

  /**
   * Runs `dispatch` unless `event` is already in flight. Shared by all three
   * dispatch methods so one in-flight set covers all of them.
   */
  #guard(event: string, dispatch: () => this): this {
    if (this.#inFlight.has(event)) {
      return this;
    }
    this.#inFlight.add(event);
    try {
      return dispatch();
    } finally {
      this.#inFlight.delete(event);
    }
  }
}
