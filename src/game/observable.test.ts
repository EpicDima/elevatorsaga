import { describe, expect, it, vi } from "vitest";

import { type EventChannel, type EventName, Observable, PlayerObservable } from "./observable.ts";

type TestEvents = {
  up_button_pressed: [floor: number];
  down_button_pressed: [floor: number];
  passing_floor: [floor: number, direction: "up" | "down"];
  idle: [];
};

function makeEmitter(): Observable<TestEvents> {
  return new Observable<TestEvents>();
}

describe("Observable typing", () => {
  it("accepts correctly typed triggers and rejects wrong argument types", () => {
    const emitter = makeEmitter();
    const handler = vi.fn<(floor: number, direction: "up" | "down") => void>();
    emitter.on("passing_floor", handler);

    emitter.trigger("passing_floor", 3, "up");

    // @ts-expect-error the second argument must be a direction, not a number
    emitter.trigger("passing_floor", 3, 4);
    // @ts-expect-error the first argument must be a number
    emitter.trigger("passing_floor", "x");
    // @ts-expect-error unknown event names are rejected
    emitter.trigger("no_such_event");
    // @ts-expect-error unknown event names are rejected on registration too
    emitter.on("no_such_event", vi.fn());
    // @ts-expect-error every name of a multi-name registration must be known
    emitter.on("idle no_such_event", vi.fn());

    expect(handler).toHaveBeenCalledWith(3, "up");
  });
});

describe("Observable.on / trigger", () => {
  it("invokes a handler with the triggered arguments", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("passing_floor", handler);

    emitter.trigger("passing_floor", 2, "down");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(2, "down");
  });

  it("invokes handlers in registration order", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("idle", () => order.push("first"));
    emitter.on("idle", () => order.push("second"));
    emitter.on("idle", () => order.push("third"));

    emitter.trigger("idle");

    expect(order).toEqual(["first", "second", "third"]);
  });

  it("invokes a handler once per registration when registered twice", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("idle", handler);
    emitter.on("idle", handler);

    emitter.trigger("idle");

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when the event has no handlers", () => {
    const emitter = makeEmitter();
    expect(() => emitter.trigger("idle")).not.toThrow();
  });

  it("returns itself so calls can be chained", () => {
    const emitter = makeEmitter();
    expect(emitter.on("idle", vi.fn())).toBe(emitter);
    expect(emitter.once("idle", vi.fn())).toBe(emitter);
    expect(emitter.trigger("idle")).toBe(emitter);
    expect(emitter.off("idle")).toBe(emitter);
    expect(emitter.offAll()).toBe(emitter);
  });

  it("does not leak handlers between events", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed", handler);

    emitter.trigger("down_button_pressed", 1);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Observable space-separated event names", () => {
  it("registers one handler for every listed event", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed down_button_pressed", handler);

    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("down_button_pressed", 2);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, "up_button_pressed", 1);
    expect(handler).toHaveBeenNthCalledWith(2, "down_button_pressed", 2);
  });

  it("prepends the event name for multi-name registrations", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed down_button_pressed", handler);

    emitter.trigger("up_button_pressed", 7);

    expect(handler).toHaveBeenCalledWith("up_button_pressed", 7);
  });

  it("prepends the name ahead of every argument of the event that fired", () => {
    const emitter = makeEmitter();
    const calls: unknown[][] = [];
    emitter.on("up_button_pressed passing_floor", (...args: unknown[]) => {
      calls.push(args);
    });

    emitter.trigger("passing_floor", 1, "up");
    emitter.trigger("up_button_pressed", 2);

    expect(calls).toEqual([
      ["passing_floor", 1, "up"],
      ["up_button_pressed", 2],
    ]);
  });

  it("leaves single-name registrations completely unaffected", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("passing_floor", handler);
    emitter.on("up_button_pressed down_button_pressed", handler);
    emitter.once("idle", handler);

    emitter.trigger("passing_floor", 4, "down");
    emitter.trigger("idle");

    expect(handler).toHaveBeenNthCalledWith(1, 4, "down");
    expect(handler).toHaveBeenNthCalledWith(2);
  });

  it("prepends for a multi-name once registration too", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("idle up_button_pressed", handler);
    emitter.once("idle", handler);

    emitter.trigger("idle");

    expect(handler).toHaveBeenNthCalledWith(1, "idle");
    expect(handler).toHaveBeenNthCalledWith(2);
  });

  it("tolerates repeated whitespace between names", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed   down_button_pressed" as "up_button_pressed", handler);

    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("down_button_pressed", 2);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, "up_button_pressed", 1);
  });

  it("unregisters from every listed event", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed down_button_pressed", handler);

    emitter.off("up_button_pressed down_button_pressed", handler);
    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("down_button_pressed", 2);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Observable.off", () => {
  it("removes only the given handler", () => {
    const emitter = makeEmitter();
    const kept = vi.fn();
    const removed = vi.fn();
    emitter.on("idle", kept);
    emitter.on("idle", removed);

    emitter.off("idle", removed);
    emitter.trigger("idle");

    expect(kept).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
  });

  it("removes every registration of the same handler", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("idle", handler);
    emitter.on("idle", handler);

    emitter.off("idle", handler);
    emitter.trigger("idle");

    expect(handler).not.toHaveBeenCalled();
  });

  it("removes all handlers of an event when no handler is given", () => {
    const emitter = makeEmitter();
    const first = vi.fn();
    const second = vi.fn();
    emitter.on("idle", first);
    emitter.on("idle", second);

    emitter.off("idle");
    emitter.trigger("idle");

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it("leaves other events alone", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed", handler);

    emitter.off("down_button_pressed");
    emitter.trigger("up_button_pressed", 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("tolerates removing an unknown handler or unknown event", () => {
    const emitter = makeEmitter();
    expect(() => emitter.off("idle", vi.fn())).not.toThrow();
    expect(() => emitter.off("idle")).not.toThrow();
  });

  it("leaves an event's handlers alone when the one named was never registered", () => {
    const emitter = makeEmitter();
    const registered = vi.fn();
    emitter.on("idle", registered);

    emitter.off("idle", vi.fn());
    emitter.trigger("idle");

    expect(registered).toHaveBeenCalledTimes(1);
  });

  it('off("*") removes handlers for every event', () => {
    // A literal lookup of "*" would find nothing and silently no-op, leaking every handler.
    const emitter = makeEmitter();
    const up = vi.fn();
    const idle = vi.fn();
    emitter.on("up_button_pressed", up);
    emitter.on("idle", idle);

    expect(emitter.off("*")).toBe(emitter);
    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("idle");

    expect(up).not.toHaveBeenCalled();
    expect(idle).not.toHaveBeenCalled();
  });

  it('off("*", handler) ignores the handler and still removes everything', () => {
    const emitter = makeEmitter();
    const named = vi.fn();
    const other = vi.fn();
    emitter.on("idle", named);
    emitter.on("idle", other);

    emitter.off("*", named);
    emitter.trigger("idle");

    expect(named).not.toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
  });

  it('does not call a later handler removed via off("*") during the dispatch', () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("idle", () => {
      emitter.off("*");
    });
    emitter.on("idle", later);

    emitter.trigger("idle");

    expect(later).not.toHaveBeenCalled();
  });

  it("offAll removes handlers for every event", () => {
    const emitter = makeEmitter();
    const up = vi.fn();
    const idle = vi.fn();
    emitter.on("up_button_pressed", up);
    emitter.on("idle", idle);

    emitter.offAll();
    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("idle");

    expect(up).not.toHaveBeenCalled();
    expect(idle).not.toHaveBeenCalled();
  });
});

describe("Observable.once", () => {
  it("fires exactly once", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.once("idle", handler);

    emitter.trigger("idle");
    emitter.trigger("idle");
    emitter.trigger("idle");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("is removed before it is invoked, so re-triggering from inside does not recurse", () => {
    const emitter = makeEmitter();
    let calls = 0;
    emitter.once("idle", () => {
      calls++;
      if (calls < 5) {
        emitter.trigger("idle");
      }
    });

    emitter.trigger("idle");

    expect(calls).toBe(1);
  });

  it("can be removed before it ever fires", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.once("idle", handler);

    emitter.off("idle", handler);
    emitter.trigger("idle");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not disturb ordinary handlers registered around it", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("idle", () => order.push("before"));
    emitter.once("idle", () => order.push("once"));
    emitter.on("idle", () => order.push("after"));

    emitter.trigger("idle");
    emitter.trigger("idle");

    expect(order).toEqual(["before", "once", "after", "before", "after"]);
  });
});

describe("Observable.one", () => {
  it("is the legacy spelling of once", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();

    expect(emitter.one("passing_floor", handler)).toBe(emitter);
    emitter.trigger("passing_floor", 1, "up");
    emitter.trigger("passing_floor", 2, "down");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1, "up");
  });

  it("can be unregistered before it fires, like any other handler", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.one("idle", handler);

    emitter.off("idle", handler);
    emitter.trigger("idle");

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Observable.triggerOne / triggerBare", () => {
  it("hands the argument to every handler, in registration order", () => {
    const emitter = makeEmitter();
    const calls: string[] = [];
    emitter.on("up_button_pressed", (floor) => calls.push(`first ${String(floor)}`));
    emitter.on("up_button_pressed", (floor) => calls.push(`second ${String(floor)}`));

    expect(emitter.triggerOne("up_button_pressed", 4)).toBe(emitter);

    expect(calls).toEqual(["first 4", "second 4"]);
  });

  it("hands a bare event nothing at all, not an undefined argument", () => {
    // A handler reading `arguments.length` must not see a slot the event never carried.
    const emitter = makeEmitter();
    let received: number | null = null;
    emitter.on("idle", function (this: unknown) {
      received = arguments.length;
    });

    expect(emitter.triggerBare("idle")).toBe(emitter);

    expect(received).toBe(0);
  });

  it("prepends the event name for a multi-name registration", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed down_button_pressed", handler);

    emitter.triggerOne("down_button_pressed", 7);

    expect(handler).toHaveBeenCalledWith("down_button_pressed", 7);
  });

  it("prepends the event name for a multi-name registration of a bare event", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("idle up_button_pressed", handler);

    emitter.triggerBare("idle");

    expect(handler).toHaveBeenCalledWith("idle");
  });

  it("retires a once handler, and calls it with the emitter as `this`", () => {
    const emitter = makeEmitter();
    const seen: unknown[] = [];
    emitter.once("up_button_pressed", function (this: unknown, floor) {
      seen.push([this, floor]);
    });

    emitter.triggerOne("up_button_pressed", 1);
    emitter.triggerOne("up_button_pressed", 2);

    expect(seen).toEqual([[emitter, 1]]);
  });

  it("keeps the mutation-during-dispatch rules of trigger", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("up_button_pressed", () => {
      emitter.off("up_button_pressed", later);
    });
    emitter.on("up_button_pressed", later);

    emitter.triggerOne("up_button_pressed", 3);

    expect(later).not.toHaveBeenCalled();
  });

  it("is a no-op for an event with no handlers", () => {
    const emitter = makeEmitter();
    expect(() => emitter.triggerOne("up_button_pressed", 1)).not.toThrow();
    expect(() => emitter.triggerBare("idle")).not.toThrow();
  });

  // A lone handler is dispatched by a path of its own, so it needs the rules proved again.
  it("keeps the mutation-during-dispatch rules for a lone handler", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    const only = vi.fn(() => {
      emitter.off("up_button_pressed", only);
      emitter.on("up_button_pressed", later);
    });
    emitter.on("up_button_pressed", only);

    emitter.triggerOne("up_button_pressed", 3);

    expect(only).toHaveBeenCalledExactlyOnceWith(3);
    expect(later).not.toHaveBeenCalled();

    emitter.triggerOne("up_button_pressed", 4);

    expect(only).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("keeps the mutation-during-dispatch rules for a lone handler of a bare event", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    const only = vi.fn(() => {
      emitter.off("idle", only);
      emitter.on("idle", later);
    });
    emitter.on("idle", only);

    emitter.triggerBare("idle");

    expect(only).toHaveBeenCalledOnce();
    expect(later).not.toHaveBeenCalled();

    emitter.triggerBare("idle");

    expect(only).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledOnce();
  });

  it("survives a lone handler raising the same event again", () => {
    const emitter = makeEmitter();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerOne("up_button_pressed", floor + 1);
      }
    });

    emitter.triggerOne("up_button_pressed", 1);

    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("Observable held channels", () => {
  /** An emitter that hands out its channels, the way a hot subclass keeps one. */
  class ChannelEmitter extends Observable<TestEvents> {
    /** The channel `event`'s handlers live on. */
    channel(event: EventName<TestEvents>): EventChannel {
      return this.channelFor(event);
    }
  }

  it("dispatches through a channel taken before anything was registered", () => {
    const emitter = new ChannelEmitter();
    const channel = emitter.channel("up_button_pressed");
    const handler = vi.fn();
    emitter.on("up_button_pressed", handler);

    channel.emitOne("up_button_pressed", 5);

    expect(handler).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("is the same channel the emitter's own trigger dispatches on", () => {
    const emitter = new ChannelEmitter();
    const calls: string[] = [];
    emitter.on("idle", () => calls.push("handler"));

    emitter.channel("idle").emitBare("idle");
    emitter.triggerBare("idle");

    expect(calls).toEqual(["handler", "handler"]);
  });

  it("goes quiet when the handlers are taken off, and lives on for the next one", () => {
    const emitter = new ChannelEmitter();
    const channel = emitter.channel("idle");
    const first = vi.fn();
    emitter.on("idle", first);
    emitter.off("idle");

    channel.emitBare("idle");

    expect(first).not.toHaveBeenCalled();

    const second = vi.fn();
    emitter.on("idle", second);
    channel.emitBare("idle");

    expect(second).toHaveBeenCalledTimes(1);
  });

  it("survives offAll the same way", () => {
    const emitter = new ChannelEmitter();
    const channel = emitter.channel("idle");
    emitter.on("idle", vi.fn());
    emitter.offAll();
    const later = vi.fn();
    emitter.on("idle", later);

    channel.emitBare("idle");

    expect(later).toHaveBeenCalledTimes(1);
  });

  it("retires a once handler and invokes handlers with the emitter as `this`", () => {
    const emitter = new ChannelEmitter();
    const channel = emitter.channel("up_button_pressed");
    const seen: unknown[] = [];
    emitter.once("up_button_pressed", function (this: unknown, floor) {
      seen.push([this, floor]);
    });

    channel.emitOne("up_button_pressed", 2);
    channel.emitOne("up_button_pressed", 3);

    expect(seen).toEqual([[emitter, 2]]);
  });

  it("keeps the mutation-during-dispatch rules", () => {
    const emitter = new ChannelEmitter();
    const channel = emitter.channel("idle");
    const later = vi.fn();
    const added = vi.fn();
    emitter.on("idle", () => {
      emitter.off("idle", later);
      emitter.on("idle", added);
    });
    emitter.on("idle", later);

    channel.emitBare("idle");

    expect(later).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });

  it("carries the whole argument list through emit, and reports a thrower to onError", () => {
    const emitter = new ChannelEmitter();
    const onError = vi.fn();
    const after = vi.fn();
    emitter.on("passing_floor", () => {
      throw new Error("boom");
    });
    emitter.on("passing_floor", after);

    emitter.channel("passing_floor").emit("passing_floor", [6, "up"], onError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledExactlyOnceWith(6, "up");
  });
});

describe("Observable mutation during dispatch", () => {
  it("lets a handler remove itself without skipping the next handler", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    const selfRemoving = (): void => {
      order.push("selfRemoving");
      emitter.off("idle", selfRemoving);
    };
    emitter.on("idle", selfRemoving);
    emitter.on("idle", () => order.push("second"));
    emitter.on("idle", () => order.push("third"));

    emitter.trigger("idle");
    emitter.trigger("idle");

    expect(order).toEqual(["selfRemoving", "second", "third", "second", "third"]);
  });

  it("does not call a later handler that was removed earlier in the same dispatch", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("idle", () => {
      emitter.off("idle", later);
    });
    emitter.on("idle", later);

    emitter.trigger("idle");

    expect(later).not.toHaveBeenCalled();
  });

  it("does not call a later handler removed via off(event) during the dispatch", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("idle", () => {
      emitter.off("idle");
    });
    emitter.on("idle", later);

    emitter.trigger("idle");

    expect(later).not.toHaveBeenCalled();
  });

  it("does not call a later handler removed via offAll during the dispatch", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("idle", () => {
      emitter.offAll();
    });
    emitter.on("idle", later);

    emitter.trigger("idle");

    expect(later).not.toHaveBeenCalled();
  });

  it("diverges from legacy: a handler added during a dispatch skips the in-flight event", () => {
    // Snapshot iteration: a handler added mid-dispatch doesn't see the event already in flight.
    const emitter = makeEmitter();
    const added = vi.fn();
    emitter.on("idle", () => {
      emitter.on("idle", added);
    });

    emitter.trigger("idle");
    expect(added).not.toHaveBeenCalled();

    emitter.trigger("idle");
    expect(added).toHaveBeenCalledTimes(1);
  });

  it("still runs handlers registered before a handler that clears the list", () => {
    const emitter = makeEmitter();
    const first = vi.fn();
    emitter.on("idle", first);
    emitter.on("idle", () => {
      emitter.offAll();
    });

    emitter.trigger("idle");

    expect(first).toHaveBeenCalledTimes(1);
  });

  it("diverges from legacy: re-adding a removed handler mid-dispatch does not re-run it", () => {
    const emitter = makeEmitter();
    let calls = 0;
    const handler = (): void => {
      calls++;
      emitter.off("idle", handler);
      emitter.on("idle", handler);
    };
    emitter.on("idle", handler);

    emitter.trigger("idle");

    expect(calls).toBe(1);
  });
});

describe("Observable re-entrancy", () => {
  it("supports triggering another event from inside a handler", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("up_button_pressed", () => {
      order.push("outer:start");
      emitter.trigger("idle");
      order.push("outer:end");
    });
    emitter.on("idle", () => order.push("inner"));

    emitter.trigger("up_button_pressed", 1);

    expect(order).toEqual(["outer:start", "inner", "outer:end"]);
  });

  it("supports re-triggering the same event from inside a handler, as unobservable did", () => {
    // Unguarded because this is how the simulation talks to itself; player-facing dispatch is guarded by PlayerObservable below.
    const emitter = makeEmitter();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.trigger("up_button_pressed", floor + 1);
      }
    });

    emitter.trigger("up_button_pressed", 1);

    expect(seen).toEqual([1, 2, 3]);
  });

  it("lets a handler removed by a nested dispatch stay removed for the outer one", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    emitter.on("idle", () => {
      emitter.trigger("up_button_pressed", 1);
    });
    emitter.on("idle", later);
    emitter.on("up_button_pressed", () => {
      emitter.off("idle", later);
    });

    emitter.trigger("idle");

    expect(later).not.toHaveBeenCalled();
  });

  it("propagates a throwing handler and skips the remaining handlers", () => {
    // Plain `trigger` has no error handling; dispatches reaching player code use `triggerSafe` instead.
    const emitter = makeEmitter();
    const never = vi.fn();
    emitter.on("idle", () => {
      throw new Error("user code blew up");
    });
    emitter.on("idle", never);

    expect(() => emitter.trigger("idle")).toThrow("user code blew up");
    expect(never).not.toHaveBeenCalled();
  });
});

describe("PlayerObservable", () => {
  it("refuses to re-enter a triggerSafe dispatch of the same event", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const seen: number[] = [];
    const onError = vi.fn();
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafe("up_button_pressed", onError, floor + 1);
      }
    });

    emitter.triggerSafe("up_button_pressed", onError, 1);

    expect(seen).toEqual([1]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("guards only the event in flight, so other events still nest", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const order: string[] = [];
    emitter.on("up_button_pressed", () => {
      order.push("outer:start");
      emitter.triggerSafe("idle", onError);
      order.push("outer:end");
    });
    emitter.on("idle", () => order.push("inner"));

    emitter.triggerSafe("up_button_pressed", onError, 1);

    expect(order).toEqual(["outer:start", "inner", "outer:end"]);
  });

  it("clears the marker after the dispatch, including after a throw", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const handler = vi.fn(() => {
      throw new Error("boom");
    });
    emitter.on("idle", handler);

    emitter.triggerSafe("idle", onError);
    emitter.triggerSafe("idle", onError);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("refuses to re-enter a trigger dispatch of the same event", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.trigger("up_button_pressed", floor + 1);
      }
    });

    emitter.trigger("up_button_pressed", 1);

    expect(seen).toEqual([1]);
  });

  it("refuses a trigger nested inside a triggerSafe of the same event", () => {
    // The two methods share one in-flight set; neither is an escape hatch out of the other.
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.trigger("up_button_pressed", floor + 1);
      }
    });

    emitter.triggerSafe("up_button_pressed", onError, 1);

    expect(seen).toEqual([1]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("refuses a triggerSafe nested inside a trigger of the same event", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafe("up_button_pressed", onError, floor + 1);
      }
    });

    emitter.trigger("up_button_pressed", 1);

    expect(seen).toEqual([1]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("guards only the event in flight, so trigger still nests other events", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const order: string[] = [];
    emitter.on("up_button_pressed", () => {
      order.push("outer:start");
      emitter.trigger("idle");
      order.push("outer:end");
    });
    emitter.on("idle", () => order.push("inner"));

    emitter.trigger("up_button_pressed", 1);

    expect(order).toEqual(["outer:start", "inner", "outer:end"]);
  });

  it("clears the marker after a trigger whose handler threw", () => {
    // `trigger` lets the exception out, so the guard must be released on the way past it too.
    const emitter = new PlayerObservable<TestEvents>();
    const handler = vi.fn(() => {
      throw new Error("boom");
    });
    emitter.on("idle", handler);

    expect(() => emitter.trigger("idle")).toThrow("boom");
    expect(() => emitter.trigger("idle")).toThrow("boom");

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("still returns itself from a refused dispatch, for chaining", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: unknown[] = [];
    emitter.on("idle", () => {
      seen.push(emitter.trigger("idle"));
      seen.push(emitter.triggerSafe("idle", onError));
    });

    emitter.trigger("idle");

    expect(seen).toEqual([emitter, emitter]);
  });
});

describe("PlayerObservable.triggerSafeKeyed", () => {
  it("lets one event nest inside itself under two different keys", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafeKeyed(
          `up_button_pressed:${String(floor + 1)}`,
          "up_button_pressed",
          onError,
          3,
        );
      }
    });

    emitter.triggerSafeKeyed("up_button_pressed:1", "up_button_pressed", onError, 1);

    expect(seen).toEqual([1, 3]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("refuses to re-enter the same key", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafeKeyed("call:up", "up_button_pressed", onError, floor + 1);
      }
    });

    emitter.triggerSafeKeyed("call:up", "up_button_pressed", onError, 1);

    expect(seen).toEqual([1]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("shares the in-flight set with the unkeyed methods", () => {
    // A key that is an event name is that event's own mark, so this method can't be used to bypass the guard on it.
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafeKeyed("up_button_pressed", "up_button_pressed", onError, floor + 1);
      }
    });

    emitter.trigger("up_button_pressed", 1);

    expect(seen).toEqual([1]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("marks only the key, so the event's own name stays free", () => {
    // A keyed dispatch doesn't mark the event itself, so an unkeyed dispatch of it from inside a handler still runs.
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: number[] = [];
    emitter.on("up_button_pressed", (floor) => {
      seen.push(floor);
      if (floor < 3) {
        emitter.triggerSafe("up_button_pressed", onError, floor + 1);
      }
    });

    emitter.triggerSafeKeyed("call:up", "up_button_pressed", onError, 1);

    // Two deep, not three: the nested `triggerSafe` marks the name as usual and refuses the level below it.
    expect(seen).toEqual([1, 2]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("isolates a handler that throws, and clears the key afterwards", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const boom = new Error("boom");
    const second = vi.fn();
    emitter.on("idle", () => {
      throw boom;
    });
    emitter.on("idle", second);

    emitter.triggerSafeKeyed("tick", "idle", onError);
    emitter.triggerSafeKeyed("tick", "idle", onError);

    expect(second).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, boom);
    expect(onError).toHaveBeenNthCalledWith(2, boom);
  });

  it("returns itself, dispatched or refused", () => {
    const emitter = new PlayerObservable<TestEvents>();
    const onError = vi.fn();
    const seen: unknown[] = [];
    emitter.on("idle", () => {
      seen.push(emitter.triggerSafeKeyed("tick", "idle", onError));
    });

    expect(emitter.triggerSafeKeyed("tick", "idle", onError)).toBe(emitter);
    expect(seen).toEqual([emitter]);
  });
});

describe("Observable handler receiver", () => {
  it("calls handlers with the emitter as `this`, as riot did", () => {
    const emitter = makeEmitter();
    const seen: unknown[] = [];
    emitter.on("idle", function (this: unknown): void {
      seen.push(this);
    });

    emitter.trigger("idle");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(emitter);
  });

  it("uses the same receiver for triggerSafe", () => {
    const emitter = makeEmitter();
    const seen: unknown[] = [];
    emitter.on("idle", function (this: unknown): void {
      seen.push(this);
    });

    emitter.triggerSafe("idle", vi.fn());

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(emitter);
  });

  it("leaves arrow functions bound to their defining scope", () => {
    const emitter = makeEmitter();
    const owner = {
      seen: null as unknown,
      listen(e: Observable<TestEvents>): void {
        e.on("idle", () => {
          this.seen = this;
        });
      },
    };
    owner.listen(emitter);

    emitter.trigger("idle");

    expect(owner.seen).toBe(owner);
  });

  it("never hands a handler the emitter's internal bookkeeping", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    const selfDestructing = vi.fn(function (this: Record<string, unknown>): void {
      this["removed"] = true;
    });
    emitter.on("idle", selfDestructing);
    emitter.on("idle", later);

    emitter.trigger("idle");
    emitter.trigger("idle");

    expect(selfDestructing).toHaveBeenCalledTimes(2);
    expect(later).toHaveBeenCalledTimes(2);
  });
});

describe("Observable.triggerSafe", () => {
  it("invokes every handler with the triggered arguments", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    const onError = vi.fn();
    emitter.on("passing_floor", handler);

    emitter.triggerSafe("passing_floor", onError, 2, "down");

    expect(handler).toHaveBeenCalledWith(2, "down");
    expect(onError).not.toHaveBeenCalled();
  });

  it("runs the remaining handlers after one throws", () => {
    const emitter = makeEmitter();
    const boom = new Error("boom");
    const second = vi.fn();
    const third = vi.fn();
    const onError = vi.fn();
    emitter.on("idle", () => {
      throw boom;
    });
    emitter.on("idle", second);
    emitter.on("idle", third);

    emitter.triggerSafe("idle", onError);

    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("keeps dispatching when the error handler itself throws", () => {
    // A throwing reporter must not take out the remaining handlers, the same
    // failure triggerSafe exists to prevent for the dispatch itself.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const emitter = makeEmitter();
    const boom = new Error("boom");
    const second = vi.fn(() => {
      throw boom;
    });
    const third = vi.fn();
    const onError = vi.fn(() => {
      throw new Error("the reporter is broken too");
    });
    emitter.on("idle", () => {
      throw boom;
    });
    emitter.on("idle", second);
    emitter.on("idle", third);

    expect(() => {
      emitter.triggerSafe("idle", onError);
    }).not.toThrow();

    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("reports every error, in handler order", () => {
    const emitter = makeEmitter();
    const first = new Error("first");
    const second = new Error("second");
    const onError = vi.fn();
    emitter.on("idle", () => {
      throw first;
    });
    emitter.on("idle", () => {
      throw second;
    });

    emitter.triggerSafe("idle", onError);

    expect(onError).toHaveBeenNthCalledWith(1, first);
    expect(onError).toHaveBeenNthCalledWith(2, second);
  });

  it("leaves a throwing handler registered for later dispatches", () => {
    const emitter = makeEmitter();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const onError = vi.fn();
    emitter.on("idle", throwing);

    emitter.triggerSafe("idle", onError);
    emitter.triggerSafe("idle", onError);

    expect(throwing).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("removes a once handler that throws", () => {
    const emitter = makeEmitter();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const onError = vi.fn();
    emitter.once("idle", throwing);

    emitter.triggerSafe("idle", onError);
    emitter.triggerSafe("idle", onError);

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps the mutation-during-dispatch rules of trigger", () => {
    const emitter = makeEmitter();
    const later = vi.fn();
    const added = vi.fn();
    const onError = vi.fn();
    emitter.on("idle", () => {
      emitter.off("idle", later);
      emitter.on("idle", added);
    });
    emitter.on("idle", later);

    emitter.triggerSafe("idle", onError);

    expect(later).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });

  it("is a no-op when the event has no handlers, and returns itself", () => {
    const emitter = makeEmitter();
    const onError = vi.fn();
    expect(emitter.triggerSafe("idle", onError)).toBe(emitter);
    expect(onError).not.toHaveBeenCalled();
  });
});
