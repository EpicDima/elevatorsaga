/**
 * A passenger.
 *
 * Ported from the legacy `user.js`. A user walks in on a floor, presses a call
 * button, boards the first suitable elevator that opens its doors, presses the
 * button for its destination, and walks off to the right once it arrives.
 *
 * On a destination-dispatch floor the first and third steps differ: the
 * passenger names the floor they want instead of a direction, and boards the
 * car the program booked for them instead of the first suitable one.
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
   * World time at which the passenger got into a car, or `null` while they are
   * still on their floor; assigned by the world.
   *
   * Boarding happens at most once: `elevatorAvailable` returns early both for a
   * passenger who already has a parent and for one who is done, so nothing can
   * set this twice, and the world counts boardings on the strength of that.
   */
  pickupTimestamp: number | null = null;
  /**
   * Whether this is the passenger who has been waiting longest right now.
   *
   * Set by the world, read by whatever is drawing. Nothing in the simulation
   * looks at it: a passenger who knows they are being watched behaves exactly
   * like one who does not, which is what keeps this a change to the picture
   * rather than to the game.
   */
  waitingLongest = false;
  /** Subscription to the current elevator's `exit_available`, while riding. */
  exitAvailableHandler: ExitAvailableHandler | null = null;

  /** Stream the walk-off duration is drawn from. */
  readonly #random: RandomSource;

  /**
   * @param weight - Passenger weight, used for the elevator load factor.
   * @param random - Stream to draw the walk-off duration from. A world hands
   * over the stream it derives from its seed for exactly this, so that the
   * durations are replayable without being able to disturb anything else: the
   * draw is taken the moment the passenger is delivered, which is a moment the
   * elevators — and so the player's program — decide, and a draw like that
   * inside the world's spawn stream shifts every later spawn (see
   * `WALK_OFF_STREAM` in src/game/world.ts). The unseeded default is only for
   * callers that build a passenger outside a world.
   */
  constructor(weight: number, random: RandomSource = systemRandom) {
    super();
    this.weight = weight;
    this.#random = random;
  }

  /**
   * Marks this passenger as the one waiting longest, or stops marking them.
   *
   * Emits `new_display_state` when the answer changes, because the passenger
   * this is true of is usually standing perfectly still — that is rather the
   * point of them — and a presenter that only redrew moving things would never
   * hear about it. Emitting on a change rather than on every call keeps it to
   * two events per handover, however many frames the handover survives.
   *
   * @param waitingLongest - Whether this is now the longest wait in the world.
   */
  setWaitingLongest(waitingLongest: boolean): void {
    if (this.waitingLongest === waitingLongest) {
      return;
    }
    this.waitingLongest = waitingLongest;
    this.emitMovable("new_display_state", this);
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
    this.callForElevator(floor);
  }

  /**
   * Calls for a car in whichever way this floor takes calls.
   *
   * @param floor - Floor the passenger is standing on.
   */
  callForElevator(floor: Floor): void {
    if (floor.destinationDispatch) {
      floor.requestDestination(this.destinationFloor);
      return;
    }
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

      // One to one and a half seconds to walk off, exactly as `user.js:41`
      // drew it — only the stream it is drawn from is the caller's choice now.
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
   *
   * Passengers that are done, already riding, or mid-animation ignore the
   * offer. A passenger the elevator's indicators say it will not serve, and a
   * passenger who cannot fit, both call for an elevator again.
   *
   * On a destination-dispatch floor the first test is a different one: board
   * the car this floor booked for the trip, and nothing else. The floor refuses
   * a booking a car cannot carry end to end, so identity is the whole rule
   * here — the indicators say nothing about who a destination-dispatch car came
   * for, and a passenger who boarded on them would be riding a car the program
   * sent for somebody else.
   *
   * @param elevator - The elevator that just became available.
   * @param floor - The floor the elevator is standing at.
   */
  elevatorAvailable(elevator: Elevator, floor: Floor): void {
    if (this.done || this.parent !== null || this.isBusy()) {
      return;
    }

    if (floor.destinationDispatch) {
      if (floor.assignedElevator(this.destinationFloor) !== elevator) {
        // Somebody else's car. Nothing to re-request: this passenger's own car
        // is still booked and still coming.
        return;
      }
    } else if (!elevator.isSuitableForTravelBetween(this.currentFloor, this.destinationFloor)) {
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
      if (floor.destinationDispatch) {
        // Counted the moment the car accepts them, not when the walk-in
        // animation ends: everyone else on this floor is offered the same car
        // in the same loop, and the book has to be one passenger shorter by
        // the time they are.
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
      // The booked car came and could not take them. Withdrawing it is what
      // gets another one booked; pressing a call button here would light a lamp
      // nobody in this building reads.
      floor.destinationRefused(this.destinationFloor);
    } else {
      this.pressFloorButton(floor);
    }
  }
}
