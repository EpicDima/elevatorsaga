/**
 * A passenger: walks onto a floor, calls an elevator, boards, rides to their destination
 * floor, and walks off. On a destination-dispatch floor, they book a car via the floor
 * instead of pressing a directional button, and board only that car.
 */

import type { Elevator } from "./elevator.ts";
import type { Floor } from "./floor.ts";
import { linearInterpolate } from "./math.ts";
import { Movable } from "./movable.ts";
import { systemRandom, type RandomSource } from "./random.ts";

/** How a passenger is drawn. Assigned by the world when spawning. */
export type UserDisplayType = "child" | "female" | "male";

/** Events emitted by {@link User}, on top of the `Movable` ones. */
export type UserEvents = {
  /** The passenger boarded an elevator. */
  entered_elevator: [elevator: Elevator];
  /** The passenger reached their destination and stepped out. */
  exited_elevator: [elevator: Elevator];
  /** The passenger finished walking off and may be dropped from the world. */
  removed: [];
};

/** Handler subscribed to an elevator's `exit_available` while riding it. */
type ExitAvailableHandler = (floorNum: number, elevator: Elevator) => void;

/** How far to the right a passenger walks after leaving an elevator. */
const EXIT_WALK_DISTANCE = 100;

/** Seconds a passenger takes to walk into an elevator. */
const ENTER_ELEVATOR_DURATION = 1;

/** A passenger traveling between two floors. */
export class User extends Movable<UserEvents> {
  /** Passenger weight; drives the elevator load factor. */
  readonly weight: number;
  /** Floor the passenger is currently standing on, or riding toward. */
  currentFloor = 0;
  /** Floor the passenger wants to reach. */
  destinationFloor = 0;
  /** Whether the passenger has arrived and is walking off. */
  done = false;
  /** Whether the world may drop this passenger from its list. */
  removeMe = false;
  /** How the passenger is drawn; assigned by the world when spawning. */
  displayType: UserDisplayType | undefined = undefined;
  /** World time at which the passenger appeared; assigned by the world. */
  spawnTimestamp = 0.0;
  /**
   * World time at which the passenger got into a car, or `null` while still on the floor;
   * assigned by the world. Set at most once: `elevatorAvailable` returns early for a
   * passenger who already has a parent or is done.
   */
  pickupTimestamp: number | null = null;
  /**
   * Whether this is the passenger who has been waiting longest right now.
   * Set by the world for the presenter to read; the simulation itself never looks at it.
   */
  waitingLongest = false;
  /** Subscription to the current elevator's `exit_available`, while riding. */
  exitAvailableHandler: ExitAvailableHandler | null = null;

  /** Stream the walk-off duration is drawn from. */
  readonly #random: RandomSource;

  /**
   * @param random - Stream the walk-off duration is drawn from; a world passes its own
   * seeded stream so the draw is replayable without disturbing other spawns. The default
   * is for callers building a passenger outside a world.
   */
  constructor(weight: number, random: RandomSource = systemRandom) {
    super();
    this.weight = weight;
    this.#random = random;
  }

  /**
   * Marks this passenger as the one waiting longest, or stops marking them.
   * Emits `new_display_state` only on change, since this passenger is otherwise standing
   * still and a presenter that redraws only moving things would miss the update.
   */
  setWaitingLongest(waitingLongest: boolean): void {
    if (this.waitingLongest === waitingLongest) {
      return;
    }
    this.waitingLongest = waitingLongest;
    this.emitNewDisplayState();
  }

  /** Places the passenger on a floor and has them call an elevator. */
  appearOnFloor(floor: Floor, destinationFloorNum: number): void {
    const floorPosY = floor.getSpawnPosY();
    this.currentFloor = floor.level;
    this.destinationFloor = destinationFloorNum;
    this.moveTo(null, floorPosY);
    this.callForElevator(floor);
  }

  /** Calls for a car in whichever way this floor takes calls. */
  callForElevator(floor: Floor): void {
    if (floor.destinationDispatch) {
      floor.requestDestination(this.destinationFloor);
      return;
    }
    this.pressFloorButton(floor);
  }

  /**
   * Presses the call button matching the direction of travel.
   * A passenger already on their destination floor presses up: the comparison is strict less-than.
   */
  pressFloorButton(floor: Floor): void {
    if (this.destinationFloor < this.currentFloor) {
      floor.pressDownButton();
    } else {
      floor.pressUpButton();
    }
  }

  /**
   * Steps out of an elevator, if it has reached this passenger's destination.
   * @param _floorNum - Unused; the floor is read off `elevator` instead.
   */
  handleExit(_floorNum: number, elevator: Elevator): void {
    if (elevator.currentFloor === this.destinationFloor) {
      elevator.userExiting(this);
      this.currentFloor = elevator.currentFloor;
      this.setParent(null);
      const destination = this.x + EXIT_WALK_DISTANCE;
      this.done = true;
      this.trigger("exited_elevator", elevator);
      this.emitNewState();
      this.emitNewDisplayState();

      // Walk-off takes 1 to 1.5 seconds.
      const walkOffDuration = 1 + this.#random() * 0.5;
      this.moveToOverTime(destination, null, walkOffDuration, linearInterpolate, () => {
        this.removeMe = true;
        this.trigger("removed");
        this.offAll();
      });

      if (this.exitAvailableHandler !== null) {
        elevator.off("exit_available", this.exitAvailableHandler);
      }
    }
  }

  /**
   * Reacts to an elevator opening its doors on this passenger's floor.
   * On a destination-dispatch floor, only the car this floor booked counts: the indicators
   * say nothing about who a destination-dispatch car came for.
   */
  elevatorAvailable(elevator: Elevator, floor: Floor): void {
    if (this.done || this.parent !== null || this.isBusy()) {
      return;
    }

    if (floor.destinationDispatch) {
      if (floor.assignedElevator(this.destinationFloor) !== elevator) {
        // This passenger's own car is still booked and still coming.
        return;
      }
    } else if (!elevator.isSuitableForTravelBetween(this.currentFloor, this.destinationFloor)) {
      // Re-press the call button: the floor already cleared it for this arrival, and this
      // elevator will not serve the trip.
      this.pressFloorButton(floor);
      return;
    }

    const pos = elevator.userEntering(this);
    if (pos !== false) {
      if (floor.destinationDispatch) {
        // Counted when the car accepts the passenger, not when the walk-in animation ends:
        // everyone else on this floor is offered the same car in the same loop.
        floor.destinationBoarded(this.destinationFloor);
      }
      this.setParent(elevator);
      this.trigger("entered_elevator", elevator);
      this.moveToOverTime(pos[0], pos[1], ENTER_ELEVATOR_DURATION, undefined, () => {
        elevator.pressFloorButton(this.destinationFloor);
      });
      this.exitAvailableHandler = (_floorNum: number, exitElevator: Elevator): void => {
        this.handleExit(exitElevator.currentFloor, exitElevator);
      };
      elevator.on("exit_available", this.exitAvailableHandler);
    } else if (floor.destinationDispatch) {
      // Withdraw the booking so another car gets booked instead.
      floor.destinationRefused(this.destinationFloor);
    } else {
      this.pressFloorButton(floor);
    }
  }
}
