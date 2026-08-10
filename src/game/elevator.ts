/**
 * The elevator simulation object.
 *
 * Ported line for line from the legacy `elevator.js`. The movement integration
 * in {@link Elevator.updateElevatorMovement} and the passing-floor detection in
 * {@link Elevator.handleNewState} are deliberately *not* tidied up: their exact
 * arithmetic (including the odd-looking sign in the braking branch) determines
 * how the game feels and whether the shipped challenges are solvable.
 */

import {
  accelerationNeededToAchieveChangeDistance,
  distanceNeededToAchieveSpeed,
  epsilonEquals,
  limitNumber,
  randomInt,
} from "./math.ts";
import { Movable, type WorldPosition } from "./movable.ts";

/** Direction reported by the `passing_floor` event. */
export type ElevatorDirection = "up" | "down";

/**
 * The part of a passenger the elevator itself needs to know about.
 *
 * Structural on purpose: the elevator only ever reads a passenger's weight and
 * compares slot occupants by identity, so it does not have to depend on the
 * `User` module (which does depend on this one).
 */
export interface ElevatorPassenger {
  /** Passenger weight, used to compute the load factor. */
  readonly weight: number;
}

/** State of the elevator's own up/down indicator lamps. */
export interface IndicatorState {
  /** Whether the elevator advertises that it is going up. */
  up: boolean;
  /** Whether the elevator advertises that it is going down. */
  down: boolean;
}

/** A standing position inside the elevator, and its occupant. */
export interface UserSlot {
  /** Position of the slot relative to the elevator. */
  readonly pos: WorldPosition;
  /** Passenger occupying the slot, or `null` when free. */
  user: ElevatorPassenger | null;
}

/** Events emitted by {@link Elevator}, on top of the `Movable` ones. */
export type ElevatorEvents = {
  /** The rounded current floor changed. */
  new_current_floor: [floorNum: number];
  /** A floor button inside the elevator went from unpressed to pressed. */
  floor_button_pressed: [floorNum: number];
  /** Any floor button inside the elevator changed state. */
  floor_buttons_changed: [buttonStates: readonly boolean[], indexChanged: number];
  /** The elevator came to a halt, at the given (possibly fractional) floor. */
  stopped: [position: number];
  /** The elevator came to a halt exactly on a floor. */
  stopped_at_floor: [floorNum: number];
  /** Passengers whose destination this is may leave now. */
  exit_available: [floorNum: number, elevator: Elevator];
  /** Passengers waiting on this floor may board now. */
  entrance_available: [elevator: Elevator];
  /** The elevator is about to pass a floor without stopping. */
  passing_floor: [floorNum: number, direction: ElevatorDirection];
  /** One of the indicator lamps changed. */
  indicatorstate_change: [indicatorStates: IndicatorState];
  /** The going-up indicator was assigned. */
  "change:goingUpIndicator": [value: boolean];
  /** The going-down indicator was assigned. */
  "change:goingDownIndicator": [value: boolean];
};

/** The default passenger capacity, used when the world does not specify one. */
const DEFAULT_MAX_USERS = 4;

/**
 * An elevator car: physics, buttons, indicators and passenger slots.
 *
 * `y` grows downward, so floor 0 has the *largest* y and a positive
 * `velocityY` means the car is travelling *down*.
 */
export class Elevator extends Movable<ElevatorEvents> {
  /** Acceleration in world units per second squared. */
  readonly ACCELERATION: number;
  /** Deceleration in world units per second squared. */
  readonly DECELERATION: number;
  /** Top speed in world units per second. */
  readonly MAXSPEED: number;
  /** Number of floors in the world this elevator serves. */
  readonly floorCount: number;
  /** Height of one floor in world units. */
  readonly floorHeight: number;
  /** Passenger capacity. */
  readonly maxUsers: number;
  /** Rendered width, derived from the capacity. */
  readonly width: number;
  /** Standing positions inside the car. */
  readonly userSlots: readonly UserSlot[];
  /** Pressed state of the floor button for each floor. */
  readonly buttonStates: boolean[];

  /** Target y position the car is moving toward. */
  destinationY = 0.0;
  /** Current vertical speed; positive means moving down. */
  velocityY = 0.0;
  /**
   * Whether the car is en route.
   *
   * Needed when going to the same floor again, so the arrival events are
   * re-raised.
   */
  isMoving = false;
  /** Whether the car advertises that it is going down. */
  goingDownIndicator = true;
  /** Whether the car advertises that it is going up. */
  goingUpIndicator = true;
  /** Rounded floor the car is considered to be on. */
  currentFloor = 0;
  /** Truncated floor the car would stop at, as of the previous state change. */
  previousTruncFutureFloorIfStopped = 0;
  /** Number of floor changes, used by the "elevator moves" challenges. */
  moveCount = 0;
  /** Legacy flag, kept for parity; never read by the simulation. */
  removed = false;

  /**
   * @param speedFloorsPerSec - Top speed expressed in floors per second.
   * @param floorCount - Number of floors in the world.
   * @param floorHeight - Height of one floor in world units.
   * @param maxUsers - Passenger capacity; falsy values fall back to 4, as in
   * the legacy `maxUsers || 4`.
   */
  constructor(
    speedFloorsPerSec: number,
    floorCount: number,
    floorHeight: number,
    maxUsers?: number,
  ) {
    super();
    this.ACCELERATION = floorHeight * 2.1;
    this.DECELERATION = floorHeight * 2.6;
    this.MAXSPEED = floorHeight * speedFloorsPerSec;
    this.floorCount = floorCount;
    this.floorHeight = floorHeight;
    // Legacy `maxUsers || 4`: a missing or zero capacity falls back to four.
    this.maxUsers = maxUsers === undefined || maxUsers === 0 ? DEFAULT_MAX_USERS : maxUsers;

    this.buttonStates = Array.from({ length: floorCount }, () => false);
    this.userSlots = Array.from({ length: this.maxUsers }, (_unused, i): UserSlot => {
      return { pos: [2 + i * 10, 30], user: null };
    });
    this.width = this.maxUsers * 10;
    this.destinationY = this.getYPosOfFloor(this.currentFloor);

    this.on("new_state", () => {
      this.handleNewState();
    });

    this.on("change:goingUpIndicator change:goingDownIndicator", () => {
      this.trigger("indicatorstate_change", {
        up: this.goingUpIndicator,
        down: this.goingDownIndicator,
      });
    });

    // Boarding is otherwise only ever offered from handleDestinationArrival, so
    // a passenger the indicators turned away when the car arrived would never
    // be reconsidered, however the player changed the indicators afterwards
    // (issues #59, #74, #98, #124). Re-offering the entrance — and nothing else
    // — leaves the destination queue, the move counts and the arrival events
    // exactly as they were.
    this.on("indicatorstate_change", () => {
      if (!this.isMoving && this.isOnAFloor() && !this.isFull()) {
        this.trigger("entrance_available", this);
      }
    });
  }

  /**
   * Teleports the car onto a floor without any travel.
   *
   * @param floor - Floor number to snap to.
   */
  setFloorPosition(floor: number): void {
    const destination = this.getYPosOfFloor(floor);
    this.currentFloor = floor;
    this.previousTruncFutureFloorIfStopped = floor;
    this.moveTo(null, destination);
  }

  /**
   * Assigns a free slot to a boarding passenger.
   *
   * The scan starts at a random slot so passengers do not all pile into the
   * same corner of the car.
   *
   * @param user - Passenger boarding the elevator.
   * @returns The slot position, or `false` when the car is full.
   */
  userEntering(user: ElevatorPassenger): WorldPosition | false {
    const randomOffset = randomInt(0, this.userSlots.length - 1);
    for (let i = 0; i < this.userSlots.length; i++) {
      const slot = this.userSlots[(i + randomOffset) % this.userSlots.length];
      if (slot?.user === null) {
        slot.user = user;
        return slot.pos;
      }
    }
    return false;
  }

  /**
   * Presses the in-car button for a floor.
   *
   * Out-of-range floor numbers are clamped, and pressing an already lit button
   * emits nothing.
   *
   * @param floorNumber - Floor to request.
   */
  pressFloorButton(floorNumber: number): void {
    const floor = limitNumber(floorNumber, 0, this.floorCount - 1);
    const prev = this.buttonStates[floor];
    this.buttonStates[floor] = true;
    if (prev !== true) {
      this.trigger("floor_button_pressed", floor);
      this.trigger("floor_buttons_changed", this.buttonStates, floor);
    }
  }

  /**
   * Frees every slot occupied by a passenger.
   *
   * @param user - Passenger leaving the elevator.
   */
  userExiting(user: ElevatorPassenger): void {
    for (const slot of this.userSlots) {
      if (slot.user === user) {
        slot.user = null;
      }
    }
  }

  /**
   * Integrates one step of the car's vertical motion.
   *
   * Ported line for line from `elevator.js`. In particular:
   *
   * - the braking test `distanceNeededToStop * 1.05 < -Math.abs(destinationDiff)`
   *   compares a signed stopping distance against a negated magnitude; the
   *   signs look wrong but the expression is load-bearing;
   * - the arrival snap uses the fixed thresholds `0.5` world units and speed
   *   `3`, independent of floor height.
   *
   * @param dt - Simulated seconds since the previous step.
   */
  updateElevatorMovement(dt: number): void {
    if (this.isBusy()) {
      // TODO: Consider if having a nonzero velocity here should throw error..
      return;
    }

    // Make sure we're not speeding
    this.velocityY = limitNumber(this.velocityY, -this.MAXSPEED, this.MAXSPEED);

    // Move elevator
    this.moveTo(null, this.y + this.velocityY * dt);

    const destinationDiff = this.destinationY - this.y;
    const directionSign = Math.sign(destinationDiff);
    const velocitySign = Math.sign(this.velocityY);
    // The legacy code hoisted `var acceleration = 0.0` here; the initial value
    // was never read, and nothing outside this block uses it.
    if (destinationDiff !== 0.0) {
      if (directionSign === velocitySign) {
        // Moving in correct direction
        const distanceNeededToStop = distanceNeededToAchieveSpeed(
          this.velocityY,
          0.0,
          this.DECELERATION,
        );
        if (distanceNeededToStop * 1.05 < -Math.abs(destinationDiff)) {
          // Slow down
          // Allow a certain factor of extra breaking, to enable a smooth breaking movement after detecting overshoot
          const requiredDeceleration = accelerationNeededToAchieveChangeDistance(
            this.velocityY,
            0.0,
            destinationDiff,
          );
          const deceleration = Math.min(this.DECELERATION * 1.1, Math.abs(requiredDeceleration));
          this.velocityY -= directionSign * deceleration * dt;
        } else {
          // Speed up (or keep max speed...)
          const acceleration = Math.min(Math.abs(destinationDiff * 5), this.ACCELERATION);
          this.velocityY += directionSign * acceleration * dt;
        }
      } else if (velocitySign === 0) {
        // Standing still - should accelerate
        const acceleration = Math.min(Math.abs(destinationDiff * 5), this.ACCELERATION);
        this.velocityY += directionSign * acceleration * dt;
      } else {
        // Moving in wrong direction - decelerate as much as possible
        this.velocityY -= velocitySign * this.DECELERATION * dt;
        // Make sure we don't change direction within this time step - let standstill logic handle it
        if (Math.sign(this.velocityY) !== velocitySign) {
          this.velocityY = 0.0;
        }
      }
    }

    if (this.isMoving && Math.abs(destinationDiff) < 0.5 && Math.abs(this.velocityY) < 3) {
      // Snap to destination and stop
      this.moveTo(null, this.destinationY);
      this.velocityY = 0.0;
      this.isMoving = false;
      this.handleDestinationArrival();
    }
  }

  /** Emits the arrival events, letting passengers out before letting new ones in. */
  handleDestinationArrival(): void {
    this.trigger("stopped", this.getExactCurrentFloor());

    if (this.isOnAFloor()) {
      this.buttonStates[this.currentFloor] = false;
      this.trigger("floor_buttons_changed", this.buttonStates, this.currentFloor);
      this.trigger("stopped_at_floor", this.currentFloor);
      // Need to allow users to get off first, so that new ones
      // can enter on the same floor
      this.trigger("exit_available", this.currentFloor, this);
      this.trigger("entrance_available", this);
    }
  }

  /**
   * Sends the car to a floor.
   *
   * @param floor - Destination floor; may be fractional (`stop()` uses the
   * exact floor the car would coast to).
   * @throws When the car is busy with a task.
   */
  goToFloor(floor: number): void {
    this.makeSureNotBusy();
    this.isMoving = true;
    this.destinationY = this.getYPosOfFloor(floor);
  }

  /**
   * Lowest pressed floor button.
   *
   * @deprecated Undocumented legacy API, scheduled for removal.
   * @returns The lowest pressed floor, or `0` when nothing is pressed.
   */
  getFirstPressedFloor(): number {
    console.warn("You are using a deprecated feature scheduled for removal: getFirstPressedFloor");
    for (let i = 0; i < this.buttonStates.length; i++) {
      if (this.buttonStates[i] === true) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Every pressed floor button, in ascending order.
   *
   * @returns Array of pressed floor numbers.
   */
  getPressedFloors(): number[] {
    const arr: number[] = [];
    for (let i = 0; i < this.buttonStates.length; i++) {
      if (this.buttonStates[i] === true) {
        arr.push(i);
      }
    }
    return arr;
  }

  /**
   * Whether the indicators invite a passenger making this trip to board.
   *
   * @param fromFloorNum - Floor the passenger is waiting on.
   * @param toFloorNum - Floor the passenger wants to reach.
   * @returns `true` when the matching indicator is lit, or the trip is a no-op.
   */
  isSuitableForTravelBetween(fromFloorNum: number, toFloorNum: number): boolean {
    if (fromFloorNum > toFloorNum) {
      return this.goingDownIndicator;
    }
    if (fromFloorNum < toFloorNum) {
      return this.goingUpIndicator;
    }
    return true;
  }

  /**
   * World y of a floor.
   *
   * @param floorNum - Floor number.
   * @returns The y coordinate of that floor; floor 0 is at the bottom, i.e. the
   * largest y.
   */
  getYPosOfFloor(floorNum: number): number {
    return (this.floorCount - 1) * this.floorHeight - floorNum * this.floorHeight;
  }

  /**
   * Fractional floor for a world y.
   *
   * @param y - World y coordinate.
   * @returns The (possibly fractional) floor at that height.
   */
  getExactFloorOfYPos(y: number): number {
    return ((this.floorCount - 1) * this.floorHeight - y) / this.floorHeight;
  }

  /**
   * Fractional floor the car is at right now.
   *
   * @returns The exact current floor.
   */
  getExactCurrentFloor(): number {
    return this.getExactFloorOfYPos(this.y);
  }

  /**
   * Fractional floor the car is heading for.
   *
   * @returns The exact destination floor.
   */
  getDestinationFloor(): number {
    return this.getExactFloorOfYPos(this.destinationY);
  }

  /**
   * Nearest whole floor to the car's position.
   *
   * @returns The rounded current floor.
   */
  getRoundedCurrentFloor(): number {
    return Math.round(this.getExactCurrentFloor());
  }

  /**
   * Fractional floor the car would coast to if it started braking now.
   *
   * @returns The projected stopping floor.
   */
  getExactFutureFloorIfStopped(): number {
    const distanceNeededToStop = distanceNeededToAchieveSpeed(
      this.velocityY,
      0.0,
      this.DECELERATION,
    );
    return this.getExactFloorOfYPos(this.y - Math.sign(this.velocityY) * distanceNeededToStop);
  }

  /**
   * Whether the car is currently moving toward a floor.
   *
   * @param floorNum - Floor to test.
   * @returns `true` when moving and the floor lies ahead.
   */
  isApproachingFloor(floorNum: number): boolean {
    const floorYPos = this.getYPosOfFloor(floorNum);
    const elevToFloor = floorYPos - this.y;
    return this.velocityY !== 0.0 && Math.sign(this.velocityY) === Math.sign(elevToFloor);
  }

  /**
   * Whether the car is level with a floor.
   *
   * @returns `true` when the exact floor equals the rounded floor within
   * {@link "./math.ts"!EPSILON}.
   */
  isOnAFloor(): boolean {
    return epsilonEquals(this.getExactCurrentFloor(), this.getRoundedCurrentFloor());
  }

  /**
   * How full the car is, by passenger weight.
   *
   * @returns `0` when empty, `1` at the nominal full load of 100 units per slot.
   */
  getLoadFactor(): number {
    const load = this.userSlots.reduce(
      (sum, slot) => sum + (slot.user === null ? 0 : slot.user.weight),
      0,
    );
    return load / (this.maxUsers * 100);
  }

  /**
   * Whether every slot is taken.
   *
   * @returns `true` when no slot is free.
   */
  isFull(): boolean {
    for (const slot of this.userSlots) {
      if (slot.user === null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether no slot is taken.
   *
   * @returns `true` when the car carries nobody.
   */
  isEmpty(): boolean {
    for (const slot of this.userSlots) {
      if (slot.user !== null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Recomputes derived state after any position change.
   *
   * Emits `new_current_floor` when the rounded floor changes, and
   * `passing_floor` when the floor the car would coast to changes to something
   * other than its destination.
   */
  handleNewState(): void {
    // Recalculate the floor number etc
    const currentFloor = this.getRoundedCurrentFloor();
    if (currentFloor !== this.currentFloor) {
      this.moveCount++;
      this.currentFloor = currentFloor;
      this.trigger("new_current_floor", this.currentFloor);
    }

    // Check if we are about to pass a floor
    const futureTruncFloorIfStopped = Math.trunc(this.getExactFutureFloorIfStopped());
    if (futureTruncFloorIfStopped !== this.previousTruncFutureFloorIfStopped) {
      // The following is somewhat ugly.
      // A formally correct solution should iterate and generate events for all passed floors,
      // because the elevator could theoretically have such a velocity that it would
      // pass more than one floor over the course of one state change (update).
      // But I can't currently be arsed to implement it because it's overkill.
      const floorBeingPassed = Math.round(this.getExactFutureFloorIfStopped());

      // Never emit passing_floor event for the destination floor
      // Because if it's the destination we're not going to pass it, at least not intentionally
      if (
        this.getDestinationFloor() !== floorBeingPassed &&
        this.isApproachingFloor(floorBeingPassed)
      ) {
        const direction: ElevatorDirection = this.velocityY > 0.0 ? "down" : "up";
        this.trigger("passing_floor", floorBeingPassed, direction);
      }
    }
    this.previousTruncFutureFloorIfStopped = futureTruncFloorIfStopped;
  }
}
