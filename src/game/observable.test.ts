import { describe, expect, it, vi } from "vitest";

import { Observable } from "./observable.ts";

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

  it("does not invoke a handler added during the dispatch for the in-flight event", () => {
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

  it("re-adding a removed handler during a dispatch does not re-run it for that event", () => {
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

  it("supports re-triggering the same event from inside a handler", () => {
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
    // Floor and ElevatorInterface rely on this: they wrap trigger in a
    // try/catch that routes user-code exceptions to an error handler.
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
