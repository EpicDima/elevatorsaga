/** Base class for everything with a position in the world: elevators and users. */

import { t } from "../i18n/index.ts";
import { DEFAULT_INTERPOLATOR, type Interpolator } from "./math.ts";
import { type EventArgsMap, type EventChannel, Observable } from "./observable.ts";

/** A world-space `[x, y]` pair, written into by {@link Movable.getWorldPosition}. */
export type WorldPosition = [x: number, y: number];

/** Events every {@link Movable} emits; subclass event maps must not redeclare these names. */
export type MovableEvents = {
  /** The logical position changed. */
  new_state: [movable: Movable];
  /** The cached world position changed and the view should be redrawn. */
  new_display_state: [movable: Movable];
};

/** A unit of work run once per simulation step until it clears itself. */
export type MovableTask = (dt: number) => void;

/**
 * Thrown when a movable is given new work while a task is already running.
 * The message is translated in the constructor rather than a module constant,
 * so it reflects the locale the page is in when the mistake happens, not at import time.
 */
export class MovableBusyError extends Error {
  /** The movable that was already busy. */
  readonly movable: Movable;

  constructor(movable: Movable) {
    super(t("error.movable.busy"));
    this.name = "MovableBusyError";
    this.movable = movable;
  }
}

/**
 * An object with a position, an optional parent, and an optional running task.
 *
 * @typeParam E - Extra events the subclass emits, on top of {@link MovableEvents}.
 */
export class Movable<E extends EventArgsMap = Record<never, never>> extends Observable<
  MovableEvents & E
> {
  /** Position relative to {@link parent}, or world position when unparented. */
  x = 0.0;
  /** Position relative to {@link parent}, or world position when unparented. Grows downward. */
  y = 0.0;
  /** Movable this one is positioned relative to, if any. */
  parent: Movable | null = null;
  /** Cached world x, refreshed by {@link updateDisplayPosition}. */
  worldX = 0.0;
  /** Cached world y, refreshed by {@link updateDisplayPosition}. */
  worldY = 0.0;
  /** The task currently occupying this movable, if any. */
  currentTask: MovableTask | null = null;

  /**
   * The channels of the two events this class owns, held rather than looked up:
   * a simulation step raises them for every elevator and passenger it touches,
   * which is most of what the whole engine dispatches.
   */
  readonly #stateChannel: EventChannel = this.channelFor("new_state");

  readonly #displayChannel: EventChannel = this.channelFor("new_display_state");

  constructor() {
    super();
    this.emitNewState();
  }

  /** Announces that the logical position changed. */
  protected emitNewState(): void {
    this.#stateChannel.emitOne("new_state", this);
  }

  /** Announces that the cached world position changed and the view should redraw. */
  protected emitNewDisplayState(): void {
    this.#displayChannel.emitOne("new_display_state", this);
  }

  /**
   * Recomputes the cached world position and notifies the view when it moved.
   *
   * @param forceTrigger - Emit `new_display_state` even if nothing moved.
   */
  updateDisplayPosition(forceTrigger?: boolean): void {
    // The parent walk of getWorldPosition, without its scratch buffer: every
    // frame asks every elevator and passenger this, and most of them have not
    // moved, so the answer usually only has to be compared.
    let worldX = this.x;
    let worldY = this.y;
    for (let parent = this.parent; parent !== null; parent = parent.parent) {
      worldX += parent.x;
      worldY += parent.y;
    }
    if (this.worldX !== worldX || this.worldY !== worldY || forceTrigger === true) {
      this.worldX = worldX;
      this.worldY = worldY;
      this.emitNewDisplayState();
    }
  }

  /** Moves to a new position, keeping the current value for `null` coordinates. */
  moveTo(newX: number | null, newY: number | null): void {
    if (newX !== null) {
      this.x = newX;
    }
    if (newY !== null) {
      this.y = newY;
    }
    this.emitNewState();
  }

  /** Moves to a new position without the `null` checks of {@link moveTo}. */
  moveToFast(newX: number, newY: number): void {
    this.x = newX;
    this.y = newY;
    this.emitNewState();
  }

  /** Whether a task is currently running. */
  isBusy(): boolean {
    return this.currentTask !== null;
  }

  /** Throws {@link MovableBusyError} when this movable is already busy. */
  makeSureNotBusy(): void {
    if (this.isBusy()) {
      console.error("Attempt to use movable while it was busy", this);
      throw new MovableBusyError(this);
    }
  }

  /**
   * Occupies this movable for `seconds` simulated seconds.
   * Completes on the first step where accumulated time passes `seconds`, not equals it.
   */
  wait(seconds: number, cb?: () => void): void {
    this.makeSureNotBusy();
    let timeSpent = 0.0;
    this.currentTask = (dt: number): void => {
      timeSpent += dt;
      if (timeSpent > seconds) {
        this.currentTask = null;
        if (cb) {
          cb();
        }
      }
    };
  }

  /** Occupies this movable while it slides to a new position over `timeToSpend` seconds. */
  moveToOverTime(
    newX: number | null,
    newY: number | null,
    timeToSpend: number,
    interpolator: Interpolator = DEFAULT_INTERPOLATOR,
    cb?: () => void,
  ): void {
    this.makeSureNotBusy();
    const targetX = newX ?? this.x;
    const targetY = newY ?? this.y;
    const origX = this.x;
    const origY = this.y;
    let timeSpent = 0.0;
    this.currentTask = (dt: number): void => {
      timeSpent = Math.min(timeToSpend, timeSpent + dt);
      if (timeSpent === timeToSpend) {
        this.moveToFast(targetX, targetY);
        this.currentTask = null;
        if (cb) {
          cb();
        }
      } else {
        const factor = timeSpent / timeToSpend;
        this.moveToFast(interpolator(origX, targetX, factor), interpolator(origY, targetY, factor));
      }
    };
  }

  /**
   * Advances the running task, if any.
   * @param dt - Simulated seconds since the previous step.
   */
  update(dt: number): void {
    if (this.currentTask !== null) {
      this.currentTask(dt);
    }
  }

  /** Writes the absolute position into `storage`, walking the parent chain. */
  getWorldPosition(storage: WorldPosition): void {
    let resultX = this.x;
    let resultY = this.y;
    let currentParent = this.parent;
    while (currentParent !== null) {
      resultX += currentParent.x;
      resultY += currentParent.y;
      currentParent = currentParent.parent;
    }
    storage[0] = resultX;
    storage[1] = resultY;
  }

  /** Re-parents this movable while keeping its world position unchanged. */
  setParent(movableParent: Movable | null): void {
    const objWorld: WorldPosition = [0, 0];
    if (movableParent === null) {
      if (this.parent !== null) {
        this.getWorldPosition(objWorld);
        this.parent = null;
        this.moveToFast(objWorld[0], objWorld[1]);
      }
    } else {
      this.getWorldPosition(objWorld);
      const parentWorld: WorldPosition = [0, 0];
      movableParent.getWorldPosition(parentWorld);
      this.parent = movableParent;
      this.moveToFast(objWorld[0] - parentWorld[0], objWorld[1] - parentWorld[1]);
    }
  }
}
