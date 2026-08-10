import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFrameRequester, type FrameRequester } from "./frame-requester.ts";
import { createWorld } from "./world.ts";
import {
  WorldController,
  createWorldController,
  type ControllableWorld,
  type UserCodeObject,
} from "./world-controller.ts";

const DT_MAX = 1000.0 / 59;

/** A world stub that records the calls the controller makes on it. */
interface FakeWorld extends ControllableWorld {
  update: ReturnType<typeof vi.fn<(dt: number) => void>>;
  init: ReturnType<typeof vi.fn<() => void>>;
  updateDisplayPositions: ReturnType<typeof vi.fn<() => void>>;
  /** Every event name the controller triggered on this world, in order. */
  readonly triggered: string[];
  /** Delivers a `usercode_error` to whatever the controller subscribed. */
  emitUserCodeError(e: unknown): void;
}

/**
 * Builds a world stub.
 *
 * @returns A world that records calls and can replay `usercode_error`.
 */
function createFakeWorld(): FakeWorld {
  const errorHandlers: ((e: unknown) => void)[] = [];
  return {
    challengeEnded: false,
    elevatorInterfaces: [],
    floorInterfaces: [],
    update: vi.fn<(dt: number) => void>(),
    init: vi.fn<() => void>(),
    updateDisplayPositions: vi.fn<() => void>(),
    triggered: [],
    on(_event: "usercode_error", handler: (e: unknown) => void): unknown {
      errorHandlers.push(handler);
      return this;
    },
    trigger(event: "stats_display_changed"): unknown {
      this.triggered.push(event);
      return this;
    },
    emitUserCodeError(e: unknown): void {
      for (const handler of errorHandlers) {
        handler(e);
      }
    },
  };
}

type InitFn = UserCodeObject["init"];
type UpdateFn = UserCodeObject["update"];

/** Player code whose `init` and `update` are spies. */
interface FakeCodeObj extends UserCodeObject {
  init: ReturnType<typeof vi.fn<InitFn>>;
  update: ReturnType<typeof vi.fn<UpdateFn>>;
}

/**
 * Builds a player-code stub.
 *
 * @returns A `{ init, update }` object whose members are spies.
 */
function createFakeCodeObj(): FakeCodeObj {
  return { init: vi.fn<InitFn>(), update: vi.fn<UpdateFn>() };
}

describe("World controller", () => {
  let controller: WorldController;
  let fakeWorld: FakeWorld;
  let fakeCodeObj: ReturnType<typeof createFakeCodeObj>;
  let frameRequester: FrameRequester;

  beforeEach(() => {
    controller = createWorldController(DT_MAX);
    fakeWorld = createFakeWorld();
    fakeCodeObj = createFakeCodeObj();
    frameRequester = createFrameRequester(10.0);
  });

  it("does not update world on first animation frame", () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    expect(fakeWorld.update).not.toHaveBeenCalled();
  });

  it("calls world update with correct delta t", () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).toHaveBeenCalledWith(0.01);
  });

  it("calls world update with scaled delta t", () => {
    controller.timeScale = 2.0;
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).toHaveBeenCalledWith(0.02);
  });

  it("does not update world when paused", () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    controller.isPaused = true;
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).not.toHaveBeenCalled();
  });

  describe("player code evaluation", () => {
    it("does not evaluate player code until the game is unpaused", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, false);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeCodeObj.init).not.toHaveBeenCalled();
      expect(fakeCodeObj.update).not.toHaveBeenCalled();

      controller.setPaused(false);
      frameRequester.trigger();

      expect(fakeCodeObj.init).toHaveBeenCalledTimes(1);
      expect(fakeWorld.init).toHaveBeenCalledTimes(1);
    });

    it("evaluates init exactly once", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeCodeObj.init).toHaveBeenCalledTimes(1);
      expect(fakeCodeObj.update).toHaveBeenCalledTimes(2);
    });

    it("passes the elevator interfaces and floor interfaces to player code", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeCodeObj.init).toHaveBeenCalledWith(
        fakeWorld.elevatorInterfaces,
        fakeWorld.floorInterfaces,
      );
      expect(fakeCodeObj.update).toHaveBeenCalledWith(
        0.01,
        fakeWorld.elevatorInterfaces,
        fakeWorld.floorInterfaces,
      );
    });

    it("never hands a real Floor to player code", () => {
      // Issue #3: the controller used to forward world.floors straight through.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
      const codeObj = createFakeCodeObj();

      controller.start(world, codeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();

      const initFloors = codeObj.init.mock.calls[0]?.[1];
      const updateFloors = codeObj.update.mock.calls[0]?.[2];
      expect(initFloors).toHaveLength(3);
      expect(initFloors).toBe(world.floorInterfaces);
      expect(updateFloors).toBe(world.floorInterfaces);
      for (const floor of world.floors) {
        expect(initFloors).not.toContain(floor);
      }
    });

    it("refreshes display positions and the stats display each frame", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeWorld.updateDisplayPositions).toHaveBeenCalledTimes(1);
      expect(fakeWorld.triggered).toEqual(["stats_display_changed"]);
    });
  });

  describe("substepping", () => {
    it("splits a long frame into steps no longer than dtMax", () => {
      const dtMax = 0.25;
      const stepController = createWorldController(dtMax);
      // 600 ms of real time at timeScale 1 is 0.6 simulated seconds.
      const requester = createFrameRequester(600.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toHaveLength(3);
      expect(steps[0]).toBeCloseTo(0.25, 10);
      expect(steps[1]).toBeCloseTo(0.25, 10);
      expect(steps[2]).toBeCloseTo(0.1, 10);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(0.6, 10);
    });

    it("clamps a very long frame to three times dtMax", () => {
      const dtMax = 0.25;
      const stepController = createWorldController(dtMax);
      const requester = createFrameRequester(10000.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(dtMax * 3, 10);
    });

    it("does not take a degenerate extra substep at the end of a frame", () => {
      // The frame requester accumulates `currentT += timeStep` in floating
      // point, so at the fitness suite's own 1000/60 ms per frame most frames
      // land a few 1e-18 above one whole dtMax. The loop used to subtract the
      // full dtMax rather than the step it had just taken, so that residue
      // stayed above zero and bought a second world.update() of ~7e-18 — an
      // entire extra world tick, not a rounding difference. 12 of these 20
      // frames were double-stepped.
      const dtMax = 1.0 / 60.0;
      const stepController = createWorldController(dtMax);
      const requester = createFrameRequester(1000.0 / 60.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      for (let i = 0; i < 21; i++) {
        requester.trigger();
      }

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      // The first frame only records lastT, so 21 frames are 20 updates.
      expect(steps).toHaveLength(20);
      for (const step of steps) {
        expect(step).toBeGreaterThan(dtMax * 0.5);
      }
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(20.0 * dtMax, 12);
    });

    it("splits a frame a hair over a whole multiple of dtMax into that many steps", () => {
      // 50 ms per frame is exactly three steps of 1/60 s, but only in decimal:
      // in binary the scaled delta lands 6.9e-18 above 3 * dtMax, which used to
      // buy a fourth substep of 6.9e-18.
      const dtMax = 1.0 / 60.0;
      const stepController = createWorldController(dtMax);
      const requester = createFrameRequester(50.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toHaveLength(3);
      expect(steps.reduce((a, b) => a + b, 0)).toBe(0.05);
    });

    it("stops substepping as soon as the challenge ends", () => {
      const dtMax = 0.25;
      const stepController = createWorldController(dtMax);
      const requester = createFrameRequester(600.0);
      fakeWorld.update.mockImplementation(() => {
        fakeWorld.challengeEnded = true;
      });
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      expect(fakeWorld.update).toHaveBeenCalledTimes(1);
    });

    it("stops requesting frames once the challenge ends", () => {
      const register = vi.fn<(cb: (t: number) => void) => void>();
      fakeWorld.challengeEnded = true;
      controller.start(fakeWorld, fakeCodeObj, register, true);
      expect(register).toHaveBeenCalledTimes(1);

      const updater = register.mock.calls[0]?.[0];
      if (updater === undefined) throw new Error("no updater registered");
      updater(10);
      expect(register).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("pauses and reports when player init throws", () => {
      const boom = new Error("boom");
      fakeCodeObj.init.mockImplementation(() => {
        throw boom;
      });
      const reported = vi.fn();
      controller.on("usercode_error", reported);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();

      expect(controller.isPaused).toBe(true);
      expect(reported).toHaveBeenCalledWith(boom);
      log.mockRestore();
    });

    it("pauses and reports when player update throws", () => {
      const boom = new Error("boom");
      fakeCodeObj.update.mockImplementation(() => {
        throw boom;
      });
      const reported = vi.fn();
      controller.on("usercode_error", reported);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();

      expect(controller.isPaused).toBe(true);
      expect(reported).toHaveBeenCalledWith(boom);
      log.mockRestore();
    });

    it("forwards the world's usercode_error", () => {
      const boom = new Error("boom");
      const reported = vi.fn();
      controller.on("usercode_error", reported);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      fakeWorld.emitUserCodeError(boom);

      expect(controller.isPaused).toBe(true);
      expect(reported).toHaveBeenCalledWith(boom);
      log.mockRestore();
    });

    it("pauses on the first error but still forwards the rest of the dispatch", () => {
      // Observable.triggerSafe reports each failing handler separately, so one
      // player-code dispatch can raise usercode_error several times with no
      // frame in between. The first one pauses the simulation - that is the
      // bound on what per-handler isolation buys - and the pause does not
      // swallow the reports that follow it.
      const first = new Error("first");
      const second = new Error("second");
      const reported = vi.fn();
      controller.on("usercode_error", reported);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      expect(controller.isPaused).toBe(false);
      fakeWorld.emitUserCodeError(first);
      const pausedAfterFirst = controller.isPaused;
      fakeWorld.emitUserCodeError(second);

      expect(pausedAfterFirst).toBe(true);
      expect(reported.mock.calls).toEqual([[first], [second]]);
      log.mockRestore();
    });
  });

  describe("pause and time scale", () => {
    it("starts paused", () => {
      expect(controller.isPaused).toBe(true);
      expect(controller.timeScale).toBe(1.0);
    });

    it("start() leaves the world paused unless autoStart is set", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, false);
      expect(controller.isPaused).toBe(true);
    });

    it("setPaused emits timescale_changed", () => {
      const changed = vi.fn();
      controller.on("timescale_changed", changed);
      controller.setPaused(false);
      expect(controller.isPaused).toBe(false);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it("setTimeScale emits timescale_changed", () => {
      const changed = vi.fn();
      controller.on("timescale_changed", changed);
      controller.setTimeScale(4.0);
      expect(controller.timeScale).toBe(4.0);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it("resumes updating after being unpaused mid-run", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, false);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeWorld.update).not.toHaveBeenCalled();

      controller.setPaused(false);
      frameRequester.trigger();

      expect(fakeWorld.update).toHaveBeenCalledWith(0.01);
    });
  });
});
