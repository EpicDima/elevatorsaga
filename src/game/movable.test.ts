import { describe, expect, it, vi } from "vitest";

import { linearInterpolate } from "./math.ts";
import { Movable, MovableBusyError } from "./movable.ts";
import { timeForwarder } from "./test-helpers.ts";

describe("Movable class", () => {
  it("disallows incorrect creation", () => {
    // Legacy `newGuard` is gone: ES classes throw natively when called
    // without `new`.
    const faultyCreation = (): unknown => (Movable as unknown as () => unknown)();
    expect(faultyCreation).toThrow(TypeError);
  });

  it("updates display position when told to", () => {
    const m = new Movable();
    m.moveTo(1.0, 1.0);
    m.updateDisplayPosition();
    expect(m.worldX).toBe(1.0);
    expect(m.worldY).toBe(1.0);
  });
});

describe("Movable object", () => {
  it("starts at the origin with no parent and no task", () => {
    const m = new Movable();
    expect(m.x).toBe(0.0);
    expect(m.y).toBe(0.0);
    expect(m.worldX).toBe(0.0);
    expect(m.worldY).toBe(0.0);
    expect(m.parent).toBe(null);
    expect(m.currentTask).toBe(null);
    expect(m.isBusy()).toBe(false);
  });

  it("does not update display position when moved", () => {
    const m = new Movable();
    m.moveTo(1.0, 1.0);
    expect(m.worldX).toBe(0.0);
    expect(m.worldY).toBe(0.0);
  });

  it("triggers event when moved", () => {
    const m = new Movable();
    const handler = vi.fn();
    m.on("new_state", handler);
    m.moveTo(1.0, 1.0);
    expect(handler).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(m);
  });

  it("retains x pos when moveTo x is null", () => {
    const m = new Movable();
    m.moveTo(1.0, 1.0);
    m.moveTo(null, 2.0);
    expect(m.x).toBe(1.0);
    expect(m.y).toBe(2.0);
  });

  it("retains y pos when moveTo y is null", () => {
    const m = new Movable();
    m.moveTo(1.0, 1.0);
    m.moveTo(2.0, null);
    expect(m.x).toBe(2.0);
    expect(m.y).toBe(1.0);
  });

  it("moveToFast assigns both coordinates and triggers new_state", () => {
    const m = new Movable();
    const handler = vi.fn();
    m.on("new_state", handler);
    m.moveToFast(3.0, 4.0);
    expect(m.x).toBe(3.0);
    expect(m.y).toBe(4.0);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("only emits new_display_state when the world position actually changed", () => {
    const m = new Movable();
    const handler = vi.fn();
    m.on("new_display_state", handler);

    m.updateDisplayPosition();
    expect(handler).not.toHaveBeenCalled();

    m.moveTo(1.0, 0.0);
    m.updateDisplayPosition();
    expect(handler).toHaveBeenCalledTimes(1);

    m.updateDisplayPosition();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("emits new_display_state anyway when forced", () => {
    const m = new Movable();
    const handler = vi.fn();
    m.on("new_display_state", handler);
    m.updateDisplayPosition(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("gets new display position when parent is moved", () => {
    const m = new Movable();
    const mParent = new Movable();
    m.setParent(mParent);
    mParent.moveTo(2.0, 3.0);
    m.updateDisplayPosition();
    expect(m.x).toBe(0.0);
    expect(m.y).toBe(0.0);
    expect(m.worldX).toBe(2.0);
    expect(m.worldY).toBe(3.0);
  });

  it("keeps its world position when re-parented", () => {
    const m = new Movable();
    const mParent = new Movable();
    m.moveTo(10.0, 10.0);
    mParent.moveTo(2.0, 3.0);

    m.setParent(mParent);
    expect(m.x).toBe(8.0);
    expect(m.y).toBe(7.0);

    const world: [number, number] = [0, 0];
    m.getWorldPosition(world);
    expect(world).toEqual([10.0, 10.0]);
  });

  it("keeps its world position when detached", () => {
    const m = new Movable();
    const mParent = new Movable();
    mParent.moveTo(2.0, 3.0);
    m.setParent(mParent);
    m.moveTo(1.0, 1.0);

    m.setParent(null);

    expect(m.parent).toBe(null);
    expect(m.x).toBe(3.0);
    expect(m.y).toBe(4.0);
  });

  it("does nothing when detaching an already unparented movable", () => {
    const m = new Movable();
    m.moveTo(5.0, 6.0);
    m.setParent(null);
    expect(m.x).toBe(5.0);
    expect(m.y).toBe(6.0);
  });

  it("accumulates positions through a grandparent chain", () => {
    const grandparent = new Movable();
    const parent = new Movable();
    const child = new Movable();
    grandparent.moveTo(1.0, 2.0);
    parent.parent = grandparent;
    parent.moveTo(10.0, 20.0);
    child.parent = parent;
    child.moveTo(100.0, 200.0);

    const world: [number, number] = [0, 0];
    child.getWorldPosition(world);
    expect(world).toEqual([111.0, 222.0]);
  });

  it("moves to destination over time", () => {
    // The legacy spec passed the spy as the 4th argument (the interpolator),
    // so it never actually asserted the completion callback. Fixed here: the
    // interpolator is left at its default and the spy is the callback.
    const m = new Movable();
    const cb = vi.fn();
    m.moveToOverTime(2.0, 3.0, 10.0, undefined, cb);
    timeForwarder(10.0, 0.1, (dt) => {
      m.update(dt);
    });
    expect(m.x).toBe(2.0);
    expect(m.y).toBe(3.0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("uses the supplied interpolator", () => {
    const m = new Movable();
    m.moveToOverTime(10.0, 0.0, 10.0, linearInterpolate);
    timeForwarder(5.0, 1.0, (dt) => {
      m.update(dt);
    });
    // Linear interpolation is exactly halfway after half the time.
    expect(m.x).toBeCloseTo(5.0, 10);
  });

  it("keeps a coordinate when the target is null", () => {
    const m = new Movable();
    m.moveTo(7.0, 8.0);
    m.moveToOverTime(null, 20.0, 1.0);
    timeForwarder(1.0, 0.25, (dt) => {
      m.update(dt);
    });
    expect(m.x).toBe(7.0);
    expect(m.y).toBe(20.0);
  });

  it("is busy while moving and free again afterwards", () => {
    const m = new Movable();
    m.moveToOverTime(1.0, 1.0, 1.0);
    expect(m.isBusy()).toBe(true);
    timeForwarder(1.0, 0.5, (dt) => {
      m.update(dt);
    });
    expect(m.isBusy()).toBe(false);
  });

  it("throws when given new work while busy", () => {
    const m = new Movable();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.moveToOverTime(1.0, 1.0, 1.0);

    expect(() => {
      m.moveToOverTime(2.0, 2.0, 1.0);
    }).toThrow(MovableBusyError);
    expect(() => {
      m.wait(1);
    }).toThrow("Object is busy - you should use callback");

    vi.mocked(console.error).mockRestore();
  });

  it("update is a no-op when there is no task", () => {
    const m = new Movable();
    expect(() => {
      m.update(0.1);
    }).not.toThrow();
  });
});

describe("Movable.wait", () => {
  it("takes dt in seconds and completes strictly after the requested time", () => {
    const m = new Movable();
    const cb = vi.fn();
    m.wait(1, cb);

    // Exactly one second elapsed: `timeSpent > seconds` is still false.
    m.update(0.5);
    m.update(0.5);
    expect(cb).not.toHaveBeenCalled();
    expect(m.isBusy()).toBe(true);

    m.update(0.000001);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(m.isBusy()).toBe(false);
  });

  it("works without a callback", () => {
    const m = new Movable();
    m.wait(1);
    m.update(2);
    expect(m.isBusy()).toBe(false);
  });
});

describe("Movable events", () => {
  it("calls handlers with the movable as `this`", () => {
    // `unobservable`, the emitter behind Movable, dispatched with
    // `fn.call(this, ...)` too (libs/unobservable.js:96-97).
    const m = new Movable();
    const seen: unknown[] = [];
    m.on("new_state", function (this: unknown): void {
      seen.push(this);
    });

    m.moveTo(1.0, 2.0);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(m);
  });
});
