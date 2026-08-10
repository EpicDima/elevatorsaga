import { describe, expect, it, vi } from "vitest";

import { Observable, PlayerObservable } from "./observable.ts";

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
    expect(handler).toHaveBeenNthCalledWith(1, 1);
    expect(handler).toHaveBeenNthCalledWith(2, 2);
  });

  it("does not prepend the event name for multi-name registrations", () => {
    // Legacy riot set `fn.typed = pos > 0` and called such handlers as
    // `fn(eventName, ...args)`. That behaviour is deliberately dropped.
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed down_button_pressed", handler);

    emitter.trigger("up_button_pressed", 7);

    expect(handler).toHaveBeenCalledWith(7);
  });

  it("tolerates repeated whitespace between names", () => {
    const emitter = makeEmitter();
    const handler = vi.fn();
    emitter.on("up_button_pressed   down_button_pressed" as "up_button_pressed", handler);

    emitter.trigger("up_button_pressed", 1);
    emitter.trigger("down_button_pressed", 2);

    expect(handler).toHaveBeenCalledTimes(2);
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

describe("Observable mutation during dispatch", () => {
  it("lets a handler remove itself without skipping the next handler", () => {
    // This is what User.handleExit does: it calls
    // elevator.off("exit_available", handler) from inside the dispatch.
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
    // Deliberate divergence. Both legacy emitters iterated a live array
    // (libs/riot.js:40-42; libs/unobservable.js:94, "len can change during
    // iteration"), so a handler registered mid-dispatch *did* run for the event
    // already in flight. Snapshot iteration matches the DOM EventTarget model
    // and cannot livelock; see the module docblock.
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
    // Same divergence as above, and the reason it is the safer default: with a
    // live array this handler would have re-appended itself forever.
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
    // User.handleExit triggers exited_elevator/new_state/new_display_state
    // while the elevator is dispatching exit_available.
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
    // Matches `unobservable`, which had no re-entrancy guard. riot would have
    // stopped after the first call, because `fn.busy` was still set on the
    // handler that did the re-triggering. This is how the simulation talks to
    // itself, so it stays unguarded; the player-facing dispatch is guarded by
    // PlayerObservable below.
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
    // Plain `trigger` has no error handling at all. Dispatches that reach
    // player code use `triggerSafe` instead.
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
    // `trigger` is published on the elevator facade (interfaces.js:5 made it a
    // `riot.observable`), so player code reaches it and the guard has to cover
    // it too. riot's own `fn.busy` (libs/riot.js:43-48) is what absorbed this.
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
    // The two methods share one in-flight set, so neither is an escape hatch
    // out of the other. This is the shape that actually reaches players: the
    // engine dispatches with triggerSafe and the handler calls trigger.
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
    // `trigger` lets the exception out, so the guard has to be released on the
    // way past it — riot's `fn.busy` was not, and the handler was dead for the
    // rest of the run (upstream issue #88).
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

describe("Observable handler receiver", () => {
  it("calls handlers with the emitter as `this`, as riot did", () => {
    // libs/riot.js:45 dispatched with `fn.apply(el, ...)`, so the legacy idiom
    // `elevators[0].on("idle", function() { this.goToFloor(0); })` worked.
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
    // The dispatch used to invoke `entry.handler(...)`, which made `this` the
    // internal handler record `{handler, once, removed}`: player code was given
    // a live internal object, and writing `this.removed = true` from a handler
    // silently unregistered it from every later dispatch.
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
    // The reporter escaped the dispatch and took the remaining handlers with
    // it - exactly the failure triggerSafe exists to prevent, one level up.
    // Reporters here end in a usercode_error dispatch, so anything subscribed
    // to that is on this path.
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
