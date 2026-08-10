import { describe, expect, it, vi } from "vitest";

import { createFrameRequester } from "./frame-requester.ts";

describe("createFrameRequester", () => {
  it("starts at t = 0", () => {
    expect(createFrameRequester(10).currentT).toBe(0.0);
  });

  it("advances by the time step on every trigger", () => {
    const requester = createFrameRequester(10.0);
    requester.trigger();
    expect(requester.currentT).toBe(10.0);
    requester.trigger();
    expect(requester.currentT).toBe(20.0);
  });

  it("does not throw when triggered without a registered callback", () => {
    const requester = createFrameRequester(10.0);
    expect(() => {
      requester.trigger();
    }).not.toThrow();
  });

  it("invokes the registered callback with the accumulated time", () => {
    const requester = createFrameRequester(10.0);
    const cb = vi.fn();
    requester.register(cb);

    requester.trigger();
    requester.trigger();

    expect(cb).toHaveBeenNthCalledWith(1, 10.0);
    expect(cb).toHaveBeenNthCalledWith(2, 20.0);
  });

  it("keeps only the most recently registered callback", () => {
    const requester = createFrameRequester(10.0);
    const first = vi.fn();
    const second = vi.fn();
    requester.register(first);
    requester.register(second);

    requester.trigger();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("can be re-registered from inside the callback, like the world controller does", () => {
    const requester = createFrameRequester(10.0);
    const seen: number[] = [];
    const updater = (t: number): void => {
      seen.push(t);
      requester.register(updater);
    };
    requester.register(updater);

    requester.trigger();
    requester.trigger();
    requester.trigger();

    expect(seen).toEqual([10.0, 20.0, 30.0]);
  });

  it("survives being passed around unbound", () => {
    const requester = createFrameRequester(5.0);
    const register = requester.register;
    const cb = vi.fn();
    register(cb);
    requester.trigger();
    expect(cb).toHaveBeenCalledWith(5.0);
  });
});
