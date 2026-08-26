import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFrameRequester, type FrameRequester } from "./frame-requester.ts";
import { at } from "./test-helpers.ts";
import { createWorld } from "./world.ts";
import {
  MAX_TICKS_PER_FRAME,
  TICK_SECONDS,
  WorldController,
  createWorldController,
  type ControllableWorld,
  type UserCodeObject,
} from "./world-controller.ts";

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

/** Builds a world stub that records calls and can replay `usercode_error`. */
function createFakeWorld(): FakeWorld {
  const errorHandlers: ((e: unknown) => void)[] = [];
  return {
    levelEnded: false,
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

/** Builds a `{ init, update }` player-code stub whose members are spies. */
function createFakeCodeObj(): FakeCodeObj {
  return { init: vi.fn<InitFn>(), update: vi.fn<UpdateFn>() };
}

describe("World controller", () => {
  let controller: WorldController;
  let fakeWorld: FakeWorld;
  let fakeCodeObj: ReturnType<typeof createFakeCodeObj>;
  let frameRequester: FrameRequester;

  beforeEach(() => {
    controller = createWorldController(TICK_SECONDS);
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

  it("runs twice as many ticks for twice the time scale, each still tickSeconds long", () => {
    controller.timeScale = 2.0;
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update.mock.calls.map((call) => call[0])).toEqual([0.01, 0.01]);
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

    it("gives every elevator its own events rather than the last one's", () => {
      // Regression guard: each elevator interface dispatches with itself as `this`, not
      // whatever binding a shared loop variable happened to end on.
      const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 3 }, "issue-111");
      const heardBy: number[] = [];
      const heardItself: boolean[] = [];
      const codeObj: UserCodeObject = {
        init(elevators) {
          elevators.forEach((elevator, index) => {
            elevator.on("idle", function (this: unknown) {
              heardBy.push(index);
              heardItself.push(this === elevator);
            });
          });
        },
        update() {
          // Leaving elevators alone lets them go idle and fire.
        },
      };

      controller.start(world, codeObj, frameRequester.register, true);
      for (let frame = 0; frame < 200; frame++) {
        frameRequester.trigger();
      }

      expect([...new Set(heardBy)].sort()).toEqual([0, 1, 2]);
      expect(heardItself).not.toContain(false);
    });

    it("refreshes display positions and the stats display each frame", () => {
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeWorld.updateDisplayPositions).toHaveBeenCalledTimes(1);
      expect(fakeWorld.triggered).toEqual(["stats_display_changed"]);
    });

    it("refreshes neither for a world nobody is watching, but still simulates it", () => {
      controller.updatesDisplay = false;
      controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
      frameRequester.trigger();
      frameRequester.trigger();
      expect(fakeWorld.updateDisplayPositions).not.toHaveBeenCalled();
      expect(fakeWorld.triggered).toEqual([]);
      expect(fakeWorld.update).toHaveBeenCalled();
    });
  });

  describe("the tick loop", () => {
    it("splits a long frame into ticks of exactly tickSeconds, carrying the remainder over", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
      // 600 ms is 0.6 simulated seconds: two whole ticks plus a 0.1 s remainder that
      // carries into the accumulator rather than running as a shorter final tick.
      const requester = createFrameRequester(600.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      let steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toEqual([0.25, 0.25]);

      // Accumulator is now 0.1 + 0.6 = 0.7 s: two more ticks, with 0.2 s left owed.
      requester.trigger();
      steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toEqual([0.25, 0.25, 0.25, 0.25]);
    });

    it("clamps a very long frame to MAX_TICKS_PER_FRAME ticks", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
      // Comfortably past MAX_TICKS_PER_FRAME * tickSeconds, so the cap decides the tick count.
      const requester = createFrameRequester(1_000_000.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toHaveLength(MAX_TICKS_PER_FRAME);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(MAX_TICKS_PER_FRAME * tickSeconds, 10);
    });

    it("gives every tick exactly tickSeconds, never a fractional remainder", () => {
      const tickSeconds = 1.0 / 60.0;
      const stepController = createWorldController(tickSeconds);
      const requester = createFrameRequester(1000.0 / 60.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      for (let i = 0; i < 21; i++) {
        requester.trigger();
      }

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step).toBe(tickSeconds);
      }
    });

    it("stops ticking as soon as the level ends", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
      const requester = createFrameRequester(600.0);
      fakeWorld.update.mockImplementation(() => {
        fakeWorld.levelEnded = true;
      });
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      expect(fakeWorld.update).toHaveBeenCalledTimes(1);
    });

    it("stops requesting frames once the level ends", () => {
      const register = vi.fn<(cb: (t: number) => void) => void>();
      fakeWorld.levelEnded = true;
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
      expect(log).toHaveBeenCalledWith("Usercode error in init", boom);
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
      expect(log).toHaveBeenCalledWith("Usercode error in update", boom);
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
      expect(log).toHaveBeenCalledWith("Usercode error in an event handler", boom);
      log.mockRestore();
    });

    it("pauses on the first error but still forwards the rest of the dispatch", () => {
      // triggerSafe reports each failing handler separately, so one dispatch can raise
      // usercode_error several times; the pause on the first must not swallow the rest.
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

    describe("a floor number that is not a number", () => {
      /** Runs a real world for two frames and reports what came back. */
      function runTwoFrames(codeObj: UserCodeObject): ReturnType<typeof vi.fn> {
        const world = createWorld({ spawnRate: 0.001, floorCount: 3, elevatorCount: 1 });
        const reported = vi.fn();
        controller.on("usercode_error", reported);
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
        controller.start(world, codeObj, frameRequester.register, true);
        frameRequester.trigger();
        frameRequester.trigger();
        log.mockRestore();
        return reported;
      }

      it("pauses and reports one asked for from init", () => {
        const reported = runTwoFrames({
          init(elevators): void {
            at(elevators, 0).goToFloor(Number.NaN);
          },
          update(): void {
            // Nothing.
          },
        });

        expect(controller.isPaused).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
        expect(reported.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
      });

      it("pauses and reports one asked for from update", () => {
        const reported = runTwoFrames({
          init(): void {
            // Nothing.
          },
          update(_dt, elevators): void {
            at(elevators, 0).goToFloor(Number.NaN);
          },
        });

        expect(controller.isPaused).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
        expect(reported.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
      });

      it("pauses and reports one asked for from an event handler", () => {
        const reported = runTwoFrames({
          init(elevators): void {
            const elevator = at(elevators, 0);
            elevator.on("idle", () => {
              elevator.goToFloor(Number.NaN);
            });
          },
          update(): void {
            // Nothing.
          },
        });

        expect(controller.isPaused).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
        expect(reported.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
      });

      it("pauses and reports one a hand-assigned destinationQueue brought in", () => {
        const reported = runTwoFrames({
          init(elevators): void {
            at(elevators, 0).destinationQueue = [Number.NaN];
          },
          update(): void {
            // Nothing.
          },
        });

        expect(controller.isPaused).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
        expect(reported.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
      });
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
