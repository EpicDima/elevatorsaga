/**
 * Base class for everything with a position in the world: elevators and users.
 *
 * Ported from the legacy `movable.js`. The legacy `newGuard` call is gone —
 * ES classes already throw when called without `new`.
 */

import { t } from "../i18n/index.ts";
import { DEFAULT_INTERPOLATOR, type Interpolator } from "./math.ts";
import { Observable, type EventArgsMap, type EventName } from "./observable.ts";

/** A world-space `[x, y]` pair, written into by {@link Movable.getWorldPosition}. */
export type WorldPosition = [x: number, y: number];

/**
 * Events every {@link Movable} emits.
 *
 * Subclass event maps must not redeclare these names.
 */
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
 *
 * The legacy code threw the object literal `{message, obj}`; a real `Error`
 * carries the same message and keeps the value throwable under lint rules that
 * (correctly) reject non-`Error` throws.
 *
 * The message is translated in the constructor, so it is the language the page
 * was in when the mistake was made. A module constant would be quicker and
 * would be wrong: it would be filled in when this module is imported, which is
 * before the page has chosen a locale, and every player would read this one in
 * English. Player code reaches it through `elevator.wait` and the movement
 * helpers, so what it says ends up in the code status bar.
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
 * Scratch buffer reused by {@link Movable.updateDisplayPosition}.
 *
 * The legacy code kept a single module-level array to avoid allocating on
 * every frame for every user and elevator; that is preserved.
 */
const tmpPosStorage: WorldPosition = [0, 0];

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

  constructor() {
    super();
    this.emitMovable("new_state", this);
  }

  /**
   * Emits one of the events {@link Movable} itself owns.
   *
   * `Movable` is generic over the events its subclasses add, which makes the
   * indexed access `(MovableEvents & E)["new_state"]` unresolvable at the
   * declaration site. This helper keeps those emits statically checked against
   * {@link MovableEvents} while the public {@link Observable.trigger} stays
   * fully typed for callers.
   *
   * @param event - One of the {@link MovableEvents} names.
   * @param args - Arguments for that event.
   */
  protected emitMovable<K extends EventName<MovableEvents>>(
    event: K,
    ...args: MovableEvents[K]
  ): void {
    (this as unknown as Observable<MovableEvents>).trigger(event, ...args);
  }

  /**
   * Recomputes the cached world position and notifies the view when it moved.
   *
   * @param forceTrigger - Emit `new_display_state` even if nothing moved.
   */
  updateDisplayPosition(forceTrigger?: boolean): void {
    this.getWorldPosition(tmpPosStorage);
    const oldX = this.worldX;
    const oldY = this.worldY;
    this.worldX = tmpPosStorage[0];
    this.worldY = tmpPosStorage[1];
    if (oldX !== this.worldX || oldY !== this.worldY || forceTrigger === true) {
      this.emitMovable("new_display_state", this);
    }
  }

  /**
   * Moves to a new position, keeping the current value for `null` coordinates.
   *
   * @param newX - New x, or `null` to keep the current x.
   * @param newY - New y, or `null` to keep the current y.
   */
  moveTo(newX: number | null, newY: number | null): void {
    if (newX !== null) {
      this.x = newX;
    }
    if (newY !== null) {
      this.y = newY;
    }
    this.emitMovable("new_state", this);
  }

  /**
   * Moves to a new position without the `null` checks of {@link moveTo}.
   *
   * @param newX - New x.
   * @param newY - New y.
   */
  moveToFast(newX: number, newY: number): void {
    this.x = newX;
    this.y = newY;
    this.emitMovable("new_state", this);
  }

  /**
   * Whether a task is currently running.
   *
   * @returns `true` while a task occupies this movable.
   */
  isBusy(): boolean {
    return this.currentTask !== null;
  }

  /**
   * Throws when this movable is already busy.
   *
   * @throws {@link MovableBusyError} when a task is already running.
   */
  makeSureNotBusy(): void {
    if (this.isBusy()) {
      console.error("Attempt to use movable while it was busy", this);
      throw new MovableBusyError(this);
    }
  }

  /**
   * Occupies this movable for a number of simulated seconds.
   *
   * The legacy parameter was named `millis`, but `dt` is in seconds and
   * `interfaces.js` calls `elevator.wait(1, ...)` meaning one second. The
   * strictly-greater-than comparison is kept: the task ends on the first step
   * that takes the accumulated time *past* `seconds`.
   *
   * @param seconds - Simulated seconds to wait.
   * @param cb - Called once the wait completes.
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

  /**
   * Occupies this movable while it slides to a new position.
   *
   * @param newX - Target x, or `null` to keep the current x.
   * @param newY - Target y, or `null` to keep the current y.
   * @param timeToSpend - Simulated seconds the move takes.
   * @param interpolator - Blend function; defaults to
   * {@link "./math.ts"!DEFAULT_INTERPOLATOR}.
   * @param cb - Called once the movable has arrived.
   */
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
        // Epsilon issues possibly?
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
   *
   * @param dt - Simulated seconds since the previous step.
   */
  update(dt: number): void {
    if (this.currentTask !== null) {
      this.currentTask(dt);
    }
  }

  /**
   * Writes the absolute position into `storage`, walking the parent chain.
   *
   * @param storage - Two-element buffer that receives `[x, y]`.
   */
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

  /**
   * Re-parents this movable while keeping its world position unchanged.
   *
   * @param movableParent - New parent, or `null` to detach.
   */
  setParent(movableParent: Movable | null): void {
    const objWorld: WorldPosition = [0, 0];
    if (movableParent === null) {
      if (this.parent !== null) {
        this.getWorldPosition(objWorld);
        this.parent = null;
        this.moveToFast(objWorld[0], objWorld[1]);
      }
    } else {
      // Parent is being set a non-null movable
      this.getWorldPosition(objWorld);
      const parentWorld: WorldPosition = [0, 0];
      movableParent.getWorldPosition(parentWorld);
      this.parent = movableParent;
      this.moveToFast(objWorld[0] - parentWorld[0], objWorld[1] - parentWorld[1]);
    }
  }
}
