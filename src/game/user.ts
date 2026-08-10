/**
 * A passenger.
 *
 * Ported from the legacy `user.js`. A user walks in on a floor, presses a call
 * button, boards the first suitable elevator that opens its doors, presses the
 * button for its destination, and walks off to the right once it arrives.
 */

import type { Elevator } from "./elevator.ts";
import type { Floor } from "./floor.ts";
import { linearInterpolate } from "./math.ts";
import { Movable } from "./movable.ts";

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

/** A passenger travelling between two floors. */
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
  /** Subscription to the current elevator's `exit_available`, while riding. */
  exitAvailableHandler: ExitAvailableHandler | null = null;

  /**
   * @param weight - Passenger weight, used for the elevator load factor.
   */
  constructor(weight: number) {
    super();
    this.weight = weight;
  }

  /**
   * Places the passenger on a floor and has them call an elevator.
   *
   * @param floor - Floor to appear on.
   * @param destinationFloorNum - Floor the passenger wants to reach.
   */
  appearOnFloor(floor: Floor, destinationFloorNum: number): void {
    const floorPosY = floor.getSpawnPosY();
    this.currentFloor = floor.level;
    this.destinationFloor = destinationFloorNum;
    this.moveTo(null, floorPosY);
    this.pressFloorButton(floor);
  }

  /**
   * Presses the call button matching the direction of travel.
   *
   * A passenger whose destination is the floor they are already on presses
   * *up*, because the test is a strict less-than.
   *
   * @param floor - Floor whose buttons to press.
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
   *
   * @param _floorNum - Unused; the legacy signature took the floor number but
   * has always read the floor off the elevator instead.
   * @param elevator - The elevator offering an exit.
   */
  handleExit(_floorNum: number, elevator: Elevator): void {
    if (elevator.currentFloor === this.destinationFloor) {
      elevator.userExiting(this);
      this.currentFloor = elevator.currentFloor;
      this.setParent(null);
      const destination = this.x + EXIT_WALK_DISTANCE;
      this.done = true;
      this.trigger("exited_elevator", elevator);
      this.emitMovable("new_state", this);
      this.emitMovable("new_display_state", this);

      this.moveToOverTime(destination, null, 1 + Math.random() * 0.5, linearInterpolate, () => {
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
   *
   * Passengers that are done, already riding, or mid-animation ignore the
   * offer. A passenger the elevator's indicators say it will not serve, and a
   * passenger who cannot fit, both press the call button again.
   *
   * @param elevator - The elevator that just became available.
   * @param floor - The floor the elevator is standing at.
   */
  elevatorAvailable(elevator: Elevator, floor: Floor): void {
    if (this.done || this.parent !== null || this.isBusy()) {
      return;
    }

    if (!elevator.isSuitableForTravelBetween(this.currentFloor, this.destinationFloor)) {
      // Not suitable for travel - don't use this elevator.
      //
      // Press the call button again first. documentation.html promises, for
      // both up_button_pressed and down_button_pressed, that "passengers will
      // press the button again if they fail to enter an elevator", but the
      // legacy code only did so on the full-elevator path below (upstream issue
      // #110). The world notifies a floor of an arriving elevator before it
      // notifies the passengers standing on it, and the floor clears every
      // button the elevator's indicators advertise, so a passenger turned away
      // here could be left standing at a floor whose call button had gone dark.
      // Pressing an already lit button emits nothing, so this is free whenever
      // the call is still registered.
      this.pressFloorButton(floor);
      return;
    }

    const pos = elevator.userEntering(this);
    if (pos !== false) {
      // Success
      this.setParent(elevator);
      this.trigger("entered_elevator", elevator);
      this.moveToOverTime(pos[0], pos[1], ENTER_ELEVATOR_DURATION, undefined, () => {
        elevator.pressFloorButton(this.destinationFloor);
      });
      this.exitAvailableHandler = (_floorNum: number, exitElevator: Elevator): void => {
        this.handleExit(exitElevator.currentFloor, exitElevator);
      };
      elevator.on("exit_available", this.exitAvailableHandler);
    } else {
      this.pressFloorButton(floor);
    }
  }
}
