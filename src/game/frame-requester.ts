/** Deterministic stand-in for `window.requestAnimationFrame`, stepped by hand instead of the browser. */

/** A `requestAnimationFrame`-shaped function: registers a callback for the next frame. */
export type AnimationFrameRequester = (callback: (t: number) => void) => void;

/** A hand-driven frame source. */
export interface FrameRequester {
  /** Simulated timestamp in milliseconds, advanced by {@link FrameRequester.trigger}. */
  currentT: number;
  /** Registers the callback to invoke on the next {@link FrameRequester.trigger}. */
  register: AnimationFrameRequester;
  /** Advances time by one step and invokes the registered callback, if any. */
  trigger: () => void;
}

/** Creates a frame requester that advances by a fixed step on every trigger; only the latest registered callback is kept. */
export function createFrameRequester(timeStep: number): FrameRequester {
  let currentCb: ((t: number) => void) | null = null;
  const requester: FrameRequester = {
    currentT: 0.0,
    register(cb: (t: number) => void): void {
      currentCb = cb;
    },
    trigger(): void {
      requester.currentT += timeStep;
      if (currentCb !== null) {
        currentCb(requester.currentT);
      }
    },
  };
  return requester;
}
