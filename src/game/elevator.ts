/**
 * Elevator car simulation: physics, buttons, indicators and passenger slots.
 * The arithmetic in {@link Elevator.updateElevatorMovement} and {@link Elevator.handleNewState} is deliberately not tidied up: it determines game feel and level solvability.
 */

import {
  accelerationNeededToAchieveChangeDistance,
  distanceNeededToAchieveSpeed,
  epsilonEquals,
  limitNumber,
  randomInt,
} from "./math.ts";
import { Movable, type WorldPosition } from "./movable.ts";
import { systemRandom, type RandomSource } from "./random.ts";

/** Direction reported by the `passing_floor` event. */
export type ElevatorDirection = "up" | "down";

/** The part of a passenger the elevator needs; structural, so this module doesn't depend on `User`. */
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
  /**
   * A boarding offer was taken: at least one passenger started walking in.
   * Raised while boarding is still in progress, so a listener can hold the car until it finishes.
   */
  boarding_started: [elevator: Elevator];
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

/** Whether the {@link Elevator.getFirstPressedFloor} deprecation notice has printed; shared across every elevator, never reset. */
let firstPressedFloorWarned = false;

/**
 * An elevator car: physics, buttons, indicators and passenger slots.
 * `y` grows downward, so floor 0 has the largest `y` and a positive `velocityY` means moving down.
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
  /** Whether the car is en route; set even when re-sent to the same floor, so arrival events re-fire. */
  isMoving = false;
  /** Whether the car advertises that it is going down. */
  goingDownIndicator = true;
  /** Whether the car advertises that it is going up. */
  goingUpIndicator = true;
  /** Rounded floor the car is considered to be on. */
  currentFloor = 0;
  /** Truncated floor the car would stop at, as of the previous state change. */
  previousTruncFutureFloorIfStopped = 0;
  /** Number of floor changes, used by the "elevator moves" levels. */
  moveCount = 0;
  /** Load factors summed over the moves in {@link Elevator.moveCount}; sampled alongside the move count so the two never disagree. */
  loadFactorSumOnMove = 0;
  /**
   * Times the car has come to rest on a floor and opened its doors.
   * Not the same as {@link Elevator.moveCount}: a car sent to its own floor counts zero moves but one stop, since doors open again.
   * A stop between floors doesn't count, since nothing opens.
   */
  stopCount = 0;
  /** Legacy flag; unused by the simulation. */
  removed = false;

  /** Whether {@link Elevator.handleDestinationArrival} is still emitting; blocks a nested boarding offer mid-arrival. */
  #arrivalInFlight = false;

  /** Indicator state as of the last `indicatorstate_change`. */
  #announcedIndicators: IndicatorState = {
    up: this.goingUpIndicator,
    down: this.goingDownIndicator,
  };

  /**
   * World y of floor 0, the fixed end of every conversion between a floor and
   * a position. Kept because those conversions run several times per car per
   * simulation step, and both terms of it are settled in the constructor.
   */
  readonly #groundY: number;

  /** Stream {@link userEntering} draws its starting slot from. */
  readonly #random: RandomSource;

  /** Floors this car is allowed to serve; `null` means every floor. */
  readonly #servedFloors: ReadonlySet<number> | null;

  /** @param random - Stream the boarding slot is drawn from, for replay determinism. */
  constructor(
    speedFloorsPerSec: number,
    floorCount: number,
    floorHeight: number,
    maxUsers?: number,
    random: RandomSource = systemRandom,
    servedFloors?: readonly number[],
  ) {
    super();
    this.#random = random;
    this.#servedFloors =
      servedFloors === undefined || servedFloors.length === 0 ? null : new Set(servedFloors);
    this.ACCELERATION = floorHeight * 2.1;
    this.DECELERATION = floorHeight * 2.6;
    this.MAXSPEED = floorHeight * speedFloorsPerSec;
    this.floorCount = floorCount;
    this.floorHeight = floorHeight;
    this.#groundY = (floorCount - 1) * floorHeight;
    // A missing or zero capacity falls back to 4.
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

    // Only fire on an actual change: indicatorstate_change triggers a costly boarding re-offer.
    this.on("change:goingUpIndicator change:goingDownIndicator", () => {
      if (
        this.goingUpIndicator === this.#announcedIndicators.up &&
        this.goingDownIndicator === this.#announcedIndicators.down
      ) {
        return;
      }
      this.#announcedIndicators = { up: this.goingUpIndicator, down: this.goingDownIndicator };
      this.trigger("indicatorstate_change", {
        up: this.goingUpIndicator,
        down: this.goingDownIndicator,
      });
    });

    // Re-offers boarding when the indicators change while the car is parked, so a
    // passenger the old indicators turned away gets another chance without the car moving.
    this.on("indicatorstate_change", () => {
      // Avoid a nested offer while handleDestinationArrival is still emitting its own.
      if (this.#arrivalInFlight) {
        return;
      }
      if (!this.isMoving && this.isOnAFloor() && !this.isFull()) {
        this.#offerEntrance();
      }
    });
  }

  /** Teleports the car onto a floor without any travel. */
  setFloorPosition(floor: number): void {
    const destination = this.getYPosOfFloor(floor);
    this.currentFloor = floor;
    this.previousTruncFutureFloorIfStopped = floor;
    this.moveTo(null, destination);
  }

  /**
   * Assigns a free slot to a boarding passenger, scanning from a random offset so passengers don't all pile into one corner.
   * The random draw happens even when the car turns out to be full, so a replay's random stream stays in sync regardless.
   * @returns The slot position, or `false` when the car is full.
   */
  userEntering(user: ElevatorPassenger): WorldPosition | false {
    const randomOffset = randomInt(0, this.userSlots.length - 1, this.#random);
    for (let i = 0; i < this.userSlots.length; i++) {
      const slot = this.userSlots[(i + randomOffset) % this.userSlots.length];
      if (slot?.user === null) {
        slot.user = user;
        return slot.pos;
      }
    }
    return false;
  }

  /** Presses the in-car button for a floor; out-of-range numbers are clamped, and pressing an already-lit button emits nothing. */
  pressFloorButton(floorNumber: number): void {
    const floor = limitNumber(floorNumber, 0, this.floorCount - 1);
    const prev = this.buttonStates[floor];
    this.buttonStates[floor] = true;
    if (prev !== true) {
      this.trigger("floor_button_pressed", floor);
      this.trigger("floor_buttons_changed", this.buttonStates, floor);
    }
  }

  /** Frees every slot occupied by `user`. */
  userExiting(user: ElevatorPassenger): void {
    for (const slot of this.userSlots) {
      if (slot.user === user) {
        slot.user = null;
      }
    }
  }

  /**
   * Integrates one step of the car's vertical motion.
   * Do not simplify the arithmetic: the braking comparison and the `0.5`/`3` arrival-snap thresholds are exact and affect whether shipped levels are solvable.
   * @param dt - Simulated seconds since the previous step.
   */
  updateElevatorMovement(dt: number): void {
    if (this.isBusy()) {
      // Only the boarding dwell can make the elevator busy, and it always starts from a halt,
      // so skipping the movement step here hides nothing.
      return;
    }

    this.velocityY = limitNumber(this.velocityY, -this.MAXSPEED, this.MAXSPEED);

    this.moveTo(null, this.y + this.velocityY * dt);

    const destinationDiff = this.destinationY - this.y;
    const directionSign = Math.sign(destinationDiff);
    const velocitySign = Math.sign(this.velocityY);
    if (destinationDiff !== 0.0) {
      if (directionSign === velocitySign) {
        const distanceNeededToStop = distanceNeededToAchieveSpeed(
          this.velocityY,
          0.0,
          this.DECELERATION,
        );
        if (distanceNeededToStop * 1.05 < -Math.abs(destinationDiff)) {
          // 10% extra braking margin, to recover smoothly from overshoot.
          const requiredDeceleration = accelerationNeededToAchieveChangeDistance(
            this.velocityY,
            0.0,
            destinationDiff,
          );
          const deceleration = Math.min(this.DECELERATION * 1.1, Math.abs(requiredDeceleration));
          this.velocityY -= directionSign * deceleration * dt;
        } else {
          const acceleration = Math.min(Math.abs(destinationDiff * 5), this.ACCELERATION);
          this.velocityY += directionSign * acceleration * dt;
        }
      } else if (velocitySign === 0) {
        const acceleration = Math.min(Math.abs(destinationDiff * 5), this.ACCELERATION);
        this.velocityY += directionSign * acceleration * dt;
      } else {
        this.velocityY -= velocitySign * this.DECELERATION * dt;
        // Don't let deceleration overshoot into the opposite direction this step.
        if (Math.sign(this.velocityY) !== velocitySign) {
          this.velocityY = 0.0;
        }
      }
    }

    if (this.isMoving && Math.abs(destinationDiff) < 0.5 && Math.abs(this.velocityY) < 3) {
      this.moveTo(null, this.destinationY);
      this.velocityY = 0.0;
      this.isMoving = false;
      this.handleDestinationArrival();
    }
  }

  /** Emits the arrival events, letting passengers out before letting new ones in. */
  handleDestinationArrival(): void {
    this.#arrivalInFlight = true;
    try {
      this.trigger("stopped", this.getExactCurrentFloor());

      if (this.isOnAFloor()) {
        this.stopCount++;
        this.buttonStates[this.currentFloor] = false;
        this.trigger("floor_buttons_changed", this.buttonStates, this.currentFloor);
        this.trigger("stopped_at_floor", this.currentFloor);
        // Let users exit before offering entrance, so new ones can board on the same floor.
        this.trigger("exit_available", this.currentFloor, this);
        this.#offerEntrance();
      }
    } finally {
      this.#arrivalInFlight = false;
    }
  }

  /**
   * Offers boarding, and raises `boarding_started` if anyone actually took it.
   * Detects that by comparing occupied slots before and after the offer, so it costs nothing when nobody boards.
   */
  #offerEntrance(): void {
    const occupiedBefore = this.#occupiedSlotCount();
    this.trigger("entrance_available", this);
    if (this.#occupiedSlotCount() > occupiedBefore) {
      this.trigger("boarding_started", this);
    }
  }

  /** Number of slots with a passenger in them. */
  #occupiedSlotCount(): number {
    let count = 0;
    for (const slot of this.userSlots) {
      if (slot.user !== null) {
        count++;
      }
    }
    return count;
  }

  /**
   * Sends the car to a floor; may be fractional (`stop()` uses the exact floor the car would coast to).
   * @throws When the car is busy with a task.
   */
  goToFloor(floor: number): void {
    this.makeSureNotBusy();
    this.isMoving = true;
    this.destinationY = this.getYPosOfFloor(floor);
  }

  /**
   * Lowest pressed floor button.
   * Warns at most once, not once per call, since player code typically calls this every frame from `update`.
   * @deprecated Undocumented legacy API, scheduled for removal.
   */
  getFirstPressedFloor(): number {
    if (!firstPressedFloorWarned) {
      firstPressedFloorWarned = true;
      console.warn(
        "You are using a deprecated feature scheduled for removal: getFirstPressedFloor",
      );
    }
    for (let i = 0; i < this.buttonStates.length; i++) {
      if (this.buttonStates[i] === true) {
        return i;
      }
    }
    return 0;
  }

  /** Every pressed floor button, in ascending order. */
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
   * Whether this car serves a floor; a car with no zone serves every floor.
   * Governs boarding and call-button clearing, not where {@link goToFloor} can send the car.
   */
  serves(floorNum: number): boolean {
    return this.#servedFloors === null || this.#servedFloors.has(floorNum);
  }

  /**
   * Whether the indicators invite a passenger traveling from `fromFloorNum` to `toFloorNum` to board.
   * Refuses first if the car doesn't serve both floors, since such a ride could never begin or end.
   */
  isSuitableForTravelBetween(fromFloorNum: number, toFloorNum: number): boolean {
    if (!this.serves(fromFloorNum) || !this.serves(toFloorNum)) {
      return false;
    }
    if (fromFloorNum > toFloorNum) {
      return this.goingDownIndicator;
    }
    if (fromFloorNum < toFloorNum) {
      return this.goingUpIndicator;
    }
    return true;
  }

  /** World y of a floor; floor 0 is at the bottom, i.e. the largest y. */
  getYPosOfFloor(floorNum: number): number {
    return this.#groundY - floorNum * this.floorHeight;
  }

  /** Fractional floor for a world y. */
  getExactFloorOfYPos(y: number): number {
    return (this.#groundY - y) / this.floorHeight;
  }

  /** Fractional floor the car is at right now. */
  getExactCurrentFloor(): number {
    return this.getExactFloorOfYPos(this.y);
  }

  /** Fractional floor the car is heading for. */
  getDestinationFloor(): number {
    return this.getExactFloorOfYPos(this.destinationY);
  }

  /** Nearest whole floor to the car's position. */
  getRoundedCurrentFloor(): number {
    return Math.round(this.getExactCurrentFloor());
  }

  /** Fractional floor the car would coast to if it started braking now. */
  getExactFutureFloorIfStopped(): number {
    const distanceNeededToStop = distanceNeededToAchieveSpeed(
      this.velocityY,
      0.0,
      this.DECELERATION,
    );
    return this.getExactFloorOfYPos(this.y - Math.sign(this.velocityY) * distanceNeededToStop);
  }

  /**
   * Whether the car is moving toward `floorNum` and hasn't passed it yet.
   * Also gates {@link handleNewState}'s `passing_floor` event, so the two stay in agreement.
   */
  isApproachingFloor(floorNum: number): boolean {
    const floorYPos = this.getYPosOfFloor(floorNum);
    const elevToFloor = floorYPos - this.y;
    return this.velocityY !== 0.0 && Math.sign(this.velocityY) === Math.sign(elevToFloor);
  }

  /** Whether the car is level with a floor, within {@link "./math.ts"!EPSILON}. */
  isOnAFloor(): boolean {
    return epsilonEquals(this.getExactCurrentFloor(), this.getRoundedCurrentFloor());
  }

  /** How full the car is, by passenger weight; `0` empty, `1` at the nominal full load of 100 units per slot. */
  getLoadFactor(): number {
    const load = this.userSlots.reduce(
      (sum, slot) => sum + (slot.user === null ? 0 : slot.user.weight),
      0,
    );
    return load / (this.maxUsers * 100);
  }

  /** Whether every slot is taken. */
  isFull(): boolean {
    for (const slot of this.userSlots) {
      if (slot.user === null) {
        return false;
      }
    }
    return true;
  }

  /** Whether no slot is taken. */
  isEmpty(): boolean {
    for (const slot of this.userSlots) {
      if (slot.user !== null) {
        return false;
      }
    }
    return true;
  }

  /** Recomputes derived state after a position change, emitting `new_current_floor` and `passing_floor` as needed. */
  handleNewState(): void {
    const currentFloor = this.getRoundedCurrentFloor();
    if (currentFloor !== this.currentFloor) {
      this.moveCount++;
      this.loadFactorSumOnMove += this.getLoadFactor();
      this.currentFloor = currentFloor;
      this.trigger("new_current_floor", this.currentFloor);
    }

    const futureFloorIfStopped = this.getExactFutureFloorIfStopped();
    const futureTruncFloorIfStopped = Math.trunc(futureFloorIfStopped);
    if (futureTruncFloorIfStopped !== this.previousTruncFutureFloorIfStopped) {
      // Assumes at most one floor is passed per update; a faster elevator could skip an event.
      const floorBeingPassed = Math.round(futureFloorIfStopped);

      // Not the destination floor, which the elevator stops at rather than passes.
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
