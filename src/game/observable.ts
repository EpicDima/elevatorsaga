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
 * Invokes `handler` with `receiver` as its `this`. Uses `Reflect.apply`
 * because `strictBindCallApply` rejects `handler.call(...)` for this erased,
 * `readonly unknown[]`-rest signature.
 */
function invoke(receiver: object, handler: ErasedHandler, args: readonly unknown[]): void {
  Reflect.apply(handler, receiver, args);
}

/** Invokes `handler` with `receiver` as its `this` and one argument, building no argument array. */
function invokeOne(receiver: object, handler: ErasedHandler, arg: unknown): void {
  handler.call(receiver, arg);
}

/** Invokes `handler` with `receiver` as its `this` and no arguments at all. */
function invokeNone(receiver: object, handler: ErasedHandler): void {
  handler.call(receiver);
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
 * How many dispatches are in flight, across every channel. While any is, a
 * splice goes to a copy of the handler list rather than to the list itself,
 * which is what lets a dispatch iterate that list directly instead of copying
 * it every time — and a simulation step dispatches thousands of times.
 *
 * Module-wide rather than per channel: unregistering during a dispatch is rare
 * enough that the odd extra copy costs nothing, and a module-level binding is
 * the cheapest thing a dispatch can read.
 */
let dispatchesInFlight = 0;

/**
 * One event's registrations on one emitter, and the `this` they are invoked
 * with. An emitter keeps a channel for as long as it lives — `on` and `off`
 * write through it — so a caller that raises the same event for everything in
 * the world on every simulation step can hold on to one and skip the table
 * lookup a dispatch would otherwise start with.
 *
 * Every method here reads its state off `this`, unlike the rest of this module:
 * a channel is only ever a channel, so those reads are the cheap monomorphic
 * kind rather than the megamorphic kind every `Observable` subclass causes.
 */
export class EventChannel {
  /** The registrations, in order. Swapped for a copy when a splice lands mid-dispatch. */
  #entries: HandlerEntry[] = [];

  readonly #receiver: object;

  /** @param receiver - What this channel's handlers are invoked with as `this`. */
  constructor(receiver: object) {
    this.#receiver = receiver;
  }

  /** Registers one handler, behind everything registered before it. */
  add(handler: ErasedHandler, once: boolean, typed: boolean): void {
    this.#entries.push({ handler, once, typed, removed: false });
  }

  /** Unregisters everything registered here. */
  removeAll(): void {
    for (const entry of this.#entries) {
      entry.removed = true;
    }
    // A fresh list rather than a truncated one: a dispatch in flight goes on reading the old one.
    this.#entries = [];
  }

  /** Unregisters every entry registered with `handler`. */
  remove(handler: ErasedHandler): void {
    if (!this.#entries.some((entry) => entry.handler === handler)) {
      return;
    }
    const list = this.#listToMutate();
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      if (entry?.handler === handler) {
        entry.removed = true;
        list.splice(i, 1);
      }
    }
  }

  /**
   * Invokes every handler, in registration order, as the list stood when this
   * began: handlers added along the way don't run, and handlers removed along
   * the way are skipped if not yet reached.
   *
   * @param event - The name being raised, which a multi-name registration is handed.
   * @param args - The event's own arguments.
   * @param onError - Where a throwing handler's exception goes, or `null` to let it out.
   */
  emit(event: string, args: readonly unknown[], onError: ((e: unknown) => void) | null): void {
    const entries = this.#entries;
    // The list itself, not a copy: a splice during the dispatch goes elsewhere,
    // and the length read here is what hides handlers added along the way.
    const count = entries.length;
    if (count === 0) {
      return;
    }
    const receiver = this.#receiver;
    dispatchesInFlight++;
    try {
      for (let i = 0; i < count; i++) {
        const entry = entries[i];
        if (entry === undefined || entry.removed) {
          continue;
        }
        if (entry.once) {
          this.#removeEntry(entry);
        }
        const handlerArgs = entry.typed ? [event, ...args] : args;
        if (onError === null) {
          invoke(receiver, entry.handler, handlerArgs);
          continue;
        }
        try {
          invoke(receiver, entry.handler, handlerArgs);
        } catch (e) {
          report(onError, e);
        }
      }
    } finally {
      dispatchesInFlight--;
    }
  }

  /**
   * {@link emit} for the events a simulation step raises for every movable it
   * touches, which carry one argument and never reach player code. That is what
   * lets this loop be the tighter of the two: it hands the argument to each
   * handler directly instead of through the array a rest parameter would build
   * per call, and it has no error path to thread through. Folding the two
   * together was measured, and gave back most of what this saves.
   */
  emitOne(event: string, arg: unknown): void {
    const entries = this.#entries;
    const count = entries.length;
    if (count === 0) {
      return;
    }
    const receiver = this.#receiver;
    dispatchesInFlight++;
    try {
      for (let i = 0; i < count; i++) {
        const entry = entries[i];
        if (entry === undefined || entry.removed) {
          continue;
        }
        if (entry.once) {
          this.#removeEntry(entry);
        }
        if (entry.typed) {
          invoke(receiver, entry.handler, [event, arg]);
        } else {
          invokeOne(receiver, entry.handler, arg);
        }
      }
    } finally {
      dispatchesInFlight--;
    }
  }

  /** {@link emitOne} for an event that carries nothing. */
  emitBare(event: string): void {
    const entries = this.#entries;
    const count = entries.length;
    if (count === 0) {
      return;
    }
    const receiver = this.#receiver;
    dispatchesInFlight++;
    try {
      for (let i = 0; i < count; i++) {
        const entry = entries[i];
        if (entry === undefined || entry.removed) {
          continue;
        }
        if (entry.once) {
          this.#removeEntry(entry);
        }
        if (entry.typed) {
          invoke(receiver, entry.handler, [event]);
        } else {
          invokeNone(receiver, entry.handler);
        }
      }
    } finally {
      dispatchesInFlight--;
    }
  }

  /**
   * The entry list in a form safe to splice. A dispatch in flight is iterating
   * the stored list, so this leaves a copy behind for it to finish on and hands
   * back the one nothing is reading.
   */
  #listToMutate(): HandlerEntry[] {
    if (dispatchesInFlight === 0) {
      return this.#entries;
    }
    const copy = this.#entries.slice();
    this.#entries = copy;
    return copy;
  }

  /** Unregisters one entry, which is how a `once` handler retires. */
  #removeEntry(entry: HandlerEntry): void {
    entry.removed = true;
    const index = this.#entries.indexOf(entry);
    if (index < 0) {
      return;
    }
    // A copy holds the same entries in the same order, so the index still points at `entry`.
    this.#listToMutate().splice(index, 1);
  }
}

/** Minimal, fully typed event emitter. */
export class Observable<E extends EventArgsMap> {
  readonly #channels = new Map<string, EventChannel>();
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
      const channel = this.#channels.get(name);
      if (channel === undefined) {
        continue;
      }
      if (handler === undefined) {
        channel.removeAll();
      } else {
        channel.remove(handler as ErasedHandler);
      }
    }
    return this;
  }

  /** Removes every handler for every event; {@link Observable.off}'s `"*"` routes here. */
  offAll(): this {
    for (const channel of this.#channels.values()) {
      channel.removeAll();
    }
    return this;
  }

  /**
   * Invokes every handler of `event`, in registration order, as the list stood
   * when the dispatch began: handlers added during the dispatch don't run for
   * it, and handlers removed during it are skipped if not yet reached.
   */
  trigger<K extends EventName<E>>(event: K, ...args: E[K]): this {
    this.#channels.get(event)?.emit(event, args, null);
    return this;
  }

  /**
   * {@link trigger} for an event carrying exactly one argument. Same dispatch,
   * minus the array a rest parameter builds on every call — which the events a
   * simulation step raises for each movable it touches cannot afford.
   */
  triggerOne<K extends EventName<E>>(event: K, arg: E[K][0]): this {
    this.#channels.get(event)?.emitOne(event, arg);
    return this;
  }

  /** {@link triggerOne} for an event that carries nothing. */
  triggerBare(event: EventName<E>): this {
    this.#channels.get(event)?.emitBare(event);
    return this;
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
    this.#channels.get(event)?.emit(event, args, onError);
    return this;
  }

  /**
   * The channel `event`'s handlers live on, created if nothing has mentioned
   * the event yet. For a subclass that raises one event on the simulation's hot
   * path and wants to keep its channel; everything else should just
   * {@link trigger} and let the table be looked up.
   */
  protected channelFor(event: EventName<E>): EventChannel {
    return this.#channelFor(event);
  }

  #channelFor(name: string): EventChannel {
    let channel = this.#channels.get(name);
    if (channel === undefined) {
      channel = new EventChannel(this.#receiver);
      this.#channels.set(name, channel);
    }
    return channel;
  }

  #add(events: string, handler: ErasedHandler, once: boolean): void {
    const names = splitEventNames(events);
    const typed = names.length > 1;
    for (const name of names) {
      this.#channelFor(name).add(handler, once, typed);
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
