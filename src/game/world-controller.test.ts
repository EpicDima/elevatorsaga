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
    // A scaled tick is not a bigger tick: the tick itself is fixed, so what
    // timeScale changes is how many of them a real frame's time buys.
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

    it("gives every elevator its own events rather than the last one's", () => {
      // Upstream issues #111 and #138: "only the last elevator responds to my
      // handlers", reported by two different people, which usually means either
      // a real bug or a documentation failure. It is the second. Each interface
      // carries its own emitter and dispatches with itself as `this`, so a
      // handler registered on the first elevator hears the first elevator --
      // which is what the two assertions below are for.
      //
      // What the reporters hit is `var` in the loop that registers the
      // handlers: `var` gives the whole function one binding, so by the time
      // any handler runs, the variable holds the elevator the loop finished on
      // and every handler acts on that one. `forEach` below, and `let`, give
      // each iteration its own. This test exists so that nobody ever repairs
      // the engine for a fault that is not in it.
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
          // Nothing to do per frame: the handlers registered above are what is
          // under test, and leaving the elevators alone is what lets them go
          // idle and fire.
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
  });

  describe("the tick loop", () => {
    it("splits a long frame into ticks of exactly tickSeconds, carrying the remainder over", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
      // 600 ms of real time at timeScale 1 is 0.6 simulated seconds: two whole
      // ticks and a 0.1 s remainder. The remainder is not flushed as a shorter
      // final tick — it stays in the accumulator for whatever frame comes next.
      const requester = createFrameRequester(600.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      let steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toEqual([0.25, 0.25]);

      // Another 600 ms brings the accumulator to 0.1 + 0.6 = 0.7 s: two more
      // ticks, not three, with 0.2 s left owed.
      requester.trigger();
      steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toEqual([0.25, 0.25, 0.25, 0.25]);
    });

    it("clamps a very long frame to MAX_TICKS_PER_FRAME ticks", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
      // Comfortably past MAX_TICKS_PER_FRAME * tickSeconds = 25 simulated
      // seconds, so the cap -- not the frame length -- decides the tick count.
      const requester = createFrameRequester(1_000_000.0);
      stepController.start(fakeWorld, fakeCodeObj, requester.register, true);
      requester.trigger();
      requester.trigger();

      const steps = fakeWorld.update.mock.calls.map((call) => call[0]);
      expect(steps).toHaveLength(MAX_TICKS_PER_FRAME);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(MAX_TICKS_PER_FRAME * tickSeconds, 10);
    });

    it("gives every tick exactly tickSeconds, never a fractional remainder", () => {
      // The old dtMax-substepping loop absorbed whatever was left of a frame
      // into a final, undersized step, which floating-point frame lengths (the
      // fitness suite's own 1000/60 ms, among others) could push a few 1e-18
      // above a whole multiple of dtMax and buy an entire spurious extra step.
      // The accumulator design has no "final step" to absorb anything into —
      // every tick is exactly tickSeconds or it does not run yet — so there is
      // nothing left here for that regression to recur in.
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

    it("stops ticking as soon as the challenge ends", () => {
      const tickSeconds = 0.25;
      const stepController = createWorldController(tickSeconds);
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
      // Everything the world reports came out of one of the player's handlers:
      // the facades are the only things holding the world's reporter.
      expect(log).toHaveBeenCalledWith("Usercode error in an event handler", boom);
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

    describe("a floor number that is not a number", () => {
      // `ElevatorInterface.goToFloor` throws on one rather than queueing a
      // destination the car can never arrive at, and nothing inside the facade
      // catches that. These are the checks that it lands somewhere: the facade
      // is only ever called from player code, and each of the three ways player
      // code runs is wrapped - `codeObj.init` and `codeObj.update` by the
      // try/catch blocks in `start`, and every player event handler by the
      // per-handler isolation `triggerSafe` gives it, which arrives here as the
      // world's own `usercode_error`.

      /**
       * Runs a real world for two frames and reports what came back.
       *
       * @param codeObj - The player program to drive it with.
       * @returns Whatever the controller reported.
       */
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
        // That path cannot throw - the engine calls `checkDestinationQueue`
        // too - so it reports through the world instead, and the elevator is
        // still there to be used afterwards.
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
