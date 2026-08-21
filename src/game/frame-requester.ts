/**
 * Deterministic stand-in for `window.requestAnimationFrame`.
 *
 * Ported from `createFrameRequester` in the legacy `base.js`. Used by the
 * fitness simulations and by tests to advance the world in exact steps instead
 * of at the whim of the browser.
 */

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

/**
 * Creates a frame requester that advances by a fixed step on every trigger.
 *
 * Only the most recently registered callback is kept, matching the legacy
 * behavior where the world controller re-registers itself each frame.
 *
 * @param timeStep - Milliseconds added to `currentT` per trigger.
 * @returns The frame requester.
 */
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
