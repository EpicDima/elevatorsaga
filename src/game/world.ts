/**
 * The simulated building: floors, elevators, passengers and statistics.
 *
 * Each kind of random draw uses its own stream; the spawn stream advances
 * only with accumulated time, so no elevator or player program can shift it.
 */

import { Elevator } from "./elevator.ts";
import { ElevatorInterface } from "./elevator-interface.ts";
import { Floor, type FloorElevator } from "./floor.ts";
import { FloorInterface } from "./floor-interface.ts";
import { randomInt } from "./math.ts";
import { Observable } from "./observable.ts";
import {
  createRandomSource,
  deriveRandomSource,
  generateRandomSeed,
  type RandomSeed,
  type RandomSource,
} from "./random.ts";
import { User } from "./user.ts";

/**
 * Which way a building's passengers are mostly traveling.
 *
 * The peaks are pure: `"up-peak"` sends nobody down and `"down-peak"` sends
 * nobody up.
 */
export type TrafficProfile = "mixed" | "up-peak" | "down-peak" | "lunch";

/** Options a level may set on the world it runs in. */
export interface WorldOptions {
  /** Height of one floor in world units. */
  floorHeight?: number;
  /** Number of floors in the building. */
  floorCount?: number;
  /** Number of elevators. */
  elevatorCount?: number;
  /** Passengers spawned per second. */
  spawnRate?: number;
  /** Per-elevator capacities, cycled if shorter than the elevator count. */
  elevatorCapacities?: number[];
  /**
   * Per-elevator zones -- the floors each car serves -- cycled if shorter
   * than the elevator count. Omitting the option, or an empty list at a
   * position, means "every floor".
   */
  elevatorServedFloors?: number[][];
  /** Which way this building's passengers mostly travel. Defaults to `"mixed"`. */
  trafficProfile?: TrafficProfile;
  /**
   * Whether passengers name the floor they want instead of a direction, and
   * wait for the car booked for them. Defaults to `false` (calls by direction).
   */
  destinationDispatch?: boolean;
}

/** Events emitted by {@link World}. */
export type WorldEvents = {
  /** Player code (or one of its event handlers) threw. */
  usercode_error: [e: unknown];
  /** A passenger appeared. */
  new_user: [user: User];
  /** The statistics were recalculated. */
  stats_changed: [];
  /** The view should refresh the statistics display. */
  stats_display_changed: [];
};

/** Default world options. */
const DEFAULT_OPTIONS = {
  floorHeight: 50,
  floorCount: 4,
  elevatorCount: 2,
  spawnRate: 0.5,
  trafficProfile: "mixed",
  destinationDispatch: false,
} as const satisfies WorldOptions;

/** Default elevator capacity list, used when a level sets none. */
const DEFAULT_ELEVATOR_CAPACITIES: readonly number[] = [4];

/** Elevator top speed, in floors per second. */
const ELEVATOR_SPEED_FLOORS_PER_SEC = 2.6;

/** World x of the leftmost elevator shaft. */
const FIRST_ELEVATOR_X = 200.0;

/** Horizontal gap between elevator shafts. */
const ELEVATOR_SPACING = 20;

/** Rate a world falls back to when it was not handed a valid rate: zero, so nobody arrives. */
const NO_ARRIVALS_SPAWN_RATE = 0;

/** One in this many spawned passengers is drawn as a child. */
const CHILD_ODDS = 40;

/** One in this many passengers above floor 0 is not heading for the lobby. */
const NON_LOBBY_DESTINATION_ODDS = 10;

/** Stream elevators draw their boarding slots from. */
const BOARDING_SLOT_STREAM = "boarding-slots";

/** Stream the button-repress sweep draws its starting elevator from. */
const BUTTON_REPRESS_STREAM = "button-repress";

/** Stream a delivered passenger's walk-off duration is drawn from. */
const WALK_OFF_STREAM = "walk-off";

/** Seed used to derive streams when the world was given a ready-made stream instead of a seed. */
const UNSEEDED_DERIVED_SEED = "injected-stream";

/**
 * Reads an array element that is known to exist.
 *
 * @throws {RangeError} When there is no element at `index`.
 */
function requireAt<T>(arr: readonly T[], index: number, what: string): T {
  const value = arr[index];
  if (value === undefined) {
    throw new RangeError(`No ${what} at index ${String(index)}`);
  }
  return value;
}

/** Builds the floors of a building, bottom floor first. */
export function createFloors(
  floorCount: number,
  floorHeight: number,
  errorHandler: (e: unknown) => void,
  destinationDispatch = false,
): Floor[] {
  return Array.from({ length: floorCount }, (_unused, i) => {
    const yPos = (floorCount - 1 - i) * floorHeight;
    return new Floor(i, yPos, errorHandler, destinationDispatch);
  });
}

/**
 * Builds the elevators of a building, laid out left to right.
 *
 * @param random - Stream elevators draw boarding slots from; omit only
 * outside a {@link World}.
 */
export function createElevators(
  elevatorCount: number,
  floorCount: number,
  floorHeight: number,
  elevatorCapacities?: readonly number[],
  random?: RandomSource,
  elevatorServedFloors?: readonly (readonly number[])[],
): Elevator[] {
  const capacities = elevatorCapacities ?? DEFAULT_ELEVATOR_CAPACITIES;
  // An absent or empty zones list means "every floor"; kept undefined here
  // rather than defaulted, since indexing an empty list would divide by zero.
  const zones = elevatorServedFloors;
  let currentX = FIRST_ELEVATOR_X;
  return Array.from({ length: elevatorCount }, (_unused, i) => {
    const elevator = new Elevator(
      ELEVATOR_SPEED_FLOORS_PER_SEC,
      floorCount,
      floorHeight,
      capacities[i % capacities.length],
      random,
      zones === undefined || zones.length === 0 ? undefined : zones[i % zones.length],
    );

    // setFloorPosition must run before moveTo: otherwise the horizontal move
    // is evaluated at y = 0 (which rounds to the top floor), and moveCount
    // starts at 1 instead of 0.
    elevator.setFloorPosition(0);
    elevator.moveTo(currentX, null);
    elevator.updateDisplayPosition();
    currentX += ELEVATOR_SPACING + elevator.width;
    return elevator;
  });
}

/**
 * Creates a passenger with a random weight and appearance.
 *
 * Draws weight, then child odds, then gender, in that order; the order is
 * part of what a seed reproduces and must not change.
 */
export function createRandomUser(random: RandomSource, walkOffRandom: RandomSource): User {
  const weight = randomInt(55, 100, random);
  const user = new User(weight, walkOffRandom);
  if (randomInt(0, CHILD_ODDS, random) === 0) {
    user.displayType = "child";
  } else if (randomInt(0, 1, random) === 0) {
    user.displayType = "female";
  } else {
    user.displayType = "male";
  }
  return user;
}

/** Where a spawned passenger starts and where they are heading. */
interface Trip {
  /** The floor they appear on. */
  readonly currentFloor: number;
  /** The floor they want. */
  readonly destinationFloor: number;
}

/**
 * Draws the trip a `"mixed"` building's passenger takes.
 *
 * Draw order is load-bearing for replay and must not change.
 */
function drawMixedTrip(floorCount: number, random: RandomSource): Trip {
  const currentFloor = randomInt(0, 1, random) === 0 ? 0 : randomInt(0, floorCount - 1, random);
  let destinationFloor: number;
  if (currentFloor === 0) {
    destinationFloor = randomInt(1, floorCount - 1, random);
  } else {
    if (randomInt(0, NON_LOBBY_DESTINATION_ODDS, random) === 0) {
      destinationFloor = (currentFloor + randomInt(1, floorCount - 1, random)) % floorCount;
    } else {
      destinationFloor = 0;
    }
  }
  return { currentFloor, destinationFloor };
}

/**
 * Draws the trip a passenger takes under a peak traffic profile.
 *
 * Deliberately shares no code with {@link drawMixedTrip}: each profile must
 * draw a fixed, predictable number of times.
 */
function drawPeakTrip(
  profile: Exclude<TrafficProfile, "mixed">,
  floorCount: number,
  random: RandomSource,
): Trip {
  switch (profile) {
    case "up-peak": {
      return { currentFloor: 0, destinationFloor: randomInt(1, floorCount - 1, random) };
    }
    case "down-peak": {
      return { currentFloor: randomInt(1, floorCount - 1, random), destinationFloor: 0 };
    }
    case "lunch": {
      const goingUp = randomInt(0, 1, random) === 0;
      const away = randomInt(1, floorCount - 1, random);
      return goingUp
        ? { currentFloor: 0, destinationFloor: away }
        : { currentFloor: away, destinationFloor: 0 };
    }
  }
}

/**
 * Creates a passenger and places them on a random floor with a trip drawn
 * for the building's traffic profile.
 */
export function spawnUserRandomly(
  floorCount: number,
  _floorHeight: number,
  floors: readonly Floor[],
  random: RandomSource,
  walkOffRandom: RandomSource,
  trafficProfile: TrafficProfile = DEFAULT_OPTIONS.trafficProfile,
): User {
  const user = createRandomUser(random, walkOffRandom);
  user.moveTo(105 + randomInt(0, 40, random), 0);
  const { currentFloor, destinationFloor } =
    trafficProfile === "mixed"
      ? drawMixedTrip(floorCount, random)
      : drawPeakTrip(trafficProfile, floorCount, random);
  user.appearOnFloor(requireAt(floors, currentFloor, "floor"), destinationFloor);
  return user;
}

/**
 * Turns a requested spawn rate into one the spawn loop can finish running.
 *
 * A negative, infinite, or `NaN` rate can spin the loop in {@link World.update}
 * forever, so anything that is not a positive finite number becomes zero
 * (nobody arrives).
 */
function resolveSpawnRate(spawnRate: number): number {
  if (Number.isFinite(spawnRate) && spawnRate > 0) {
    return spawnRate;
  }
  if (spawnRate !== 0) {
    console.warn(
      `World was created with a spawnRate of ${String(spawnRate)}, which is not a number of passengers ` +
        `per second. Nobody will arrive; spawnRate takes a positive number.`,
    );
  }
  return NO_ARRIVALS_SPAWN_RATE;
}

/** A running simulation of one building. */
export class World extends Observable<WorldEvents> {
  /** Height of one floor in world units. */
  readonly floorHeight: number;
  /**
   * Seed this world's randomness was built from, or `null` when a ready-made
   * stream was injected instead.
   */
  readonly seed: RandomSeed | null;
  /** The building's floors, indexed by floor number. */
  floors: Floor[];
  /** The facades handed to player code, parallel to {@link floors}. */
  floorInterfaces: FloorInterface[];
  /** The building's elevators. */
  elevators: Elevator[];
  /** The facades handed to player code, parallel to {@link elevators}. */
  elevatorInterfaces: ElevatorInterface[];
  /** Passengers currently in the world. */
  users: User[] = [];

  /** Passengers delivered so far. */
  transportedCounter = 0;
  /** Passengers delivered per simulated second. */
  transportedPerSec = 0.0;
  /** Total floor changes across all elevators. */
  moveCount = 0;
  /**
   * How full the cars were, averaged over every floor they crossed.
   *
   * Sampled once per move rather than once per frame, so a parked car does
   * not drag the figure down.
   */
  avgLoadFactorOnMove = 0.0;
  /** Simulated seconds since the world started. */
  elapsedTime = 0.0;
  /**
   * Longest spawn-to-delivery span reached, delivered or not.
   *
   * Not a waiting time: the clock runs until the passenger steps off, so a
   * still-riding passenger's ride counts too.
   */
  maxWaitTime = 0.0;
  /** Mean spawn-to-delivery time of delivered passengers, the same span. */
  avgWaitTime = 0.0;
  /**
   * Longest anyone has stood on a floor before a car took them, still-waiting
   * passengers included.
   *
   * Stops at boarding, unlike {@link maxWaitTime}, which keeps running
   * through the ride.
   */
  maxPickupTime = 0.0;
  /** Mean spawn-to-boarding time of the passengers a car has picked up. */
  avgPickupTime = 0.0;
  /**
   * Mean boarding-to-delivery time of delivered passengers: the ride itself.
   *
   * Pickup time plus ride time equals wait time, to within floating point.
   */
  avgRideTime = 0.0;
  /** Door openings across all elevators. */
  stopCount = 0;
  /**
   * People who boarded or left per stop, averaged.
   *
   * Counts both ends of a journey, so it reads higher than the industry
   * figure, which counts boardings alone.
   */
  avgPeoplePerStop = 0.0;
  /** Whether the level is over and the world should stop updating. */
  levelEnded = false;

  /** Boardings so far; the denominator behind {@link World.avgPickupTime}. */
  #pickedUpCounter = 0;

  readonly #floorCount: number;
  /** Resolved passenger spawn rate: a positive finite number, or {@link NO_ARRIVALS_SPAWN_RATE}. */
  readonly #spawnRate: number;
  /**
   * Simulated seconds between two arrivals: the reciprocal of {@link World.#spawnRate},
   * which the spawn loop would otherwise divide out twice a tick. Safe to divide
   * without checking, since `resolveSpawnRate` rejected anything but a positive
   * finite rate and neither value can change afterwards.
   */
  readonly #spawnInterval: number;
  /**
   * Which way this building's passengers mostly travel.
   *
   * Fixed for the life of the world, so a seed always draws the same trip
   * shape.
   */
  readonly #trafficProfile: TrafficProfile;
  /** The spawn stream: the only stream a player program cannot shift. */
  readonly #random: RandomSource;
  /** Stream the button-repress sweep draws its starting elevator from. */
  readonly #buttonRepressRandom: RandomSource;
  /** Stream every spawned passenger draws their walk-off duration from. */
  readonly #walkOffRandom: RandomSource;
  #elapsedSinceSpawn: number;
  /**
   * The passenger whose wait is currently the longest, or `null` for nobody.
   *
   * Tracked so the handover fires as an event rather than being polled every
   * frame.
   */
  #longestWaitingUser: User | null = null;

  /**
   * @param options - Level options; missing values take the defaults.
   * @param random - A seed to build this world's streams from, or a
   * ready-made stream, for tests that need to pin individual draws.
   */
  constructor(
    options: WorldOptions = {},
    random: RandomSeed | RandomSource = generateRandomSeed(),
  ) {
    super();
    if (typeof random === "function") {
      this.seed = null;
      this.#random = random;
    } else {
      this.seed = random;
      this.#random = createRandomSource(random);
    }
    const derivedSeed = this.seed ?? UNSEEDED_DERIVED_SEED;
    this.#buttonRepressRandom = deriveRandomSource(derivedSeed, BUTTON_REPRESS_STREAM);
    this.#walkOffRandom = deriveRandomSource(derivedSeed, WALK_OFF_STREAM);
    this.floorHeight = options.floorHeight ?? DEFAULT_OPTIONS.floorHeight;
    this.#floorCount = options.floorCount ?? DEFAULT_OPTIONS.floorCount;
    this.#spawnRate = resolveSpawnRate(options.spawnRate ?? DEFAULT_OPTIONS.spawnRate);
    this.#spawnInterval = 1.0 / this.#spawnRate;
    this.#trafficProfile = options.trafficProfile ?? DEFAULT_OPTIONS.trafficProfile;
    const elevatorCount = options.elevatorCount ?? DEFAULT_OPTIONS.elevatorCount;

    const handleUserCodeError = (e: unknown): void => {
      this.trigger("usercode_error", e);
    };

    this.floors = createFloors(
      this.#floorCount,
      this.floorHeight,
      handleUserCodeError,
      options.destinationDispatch ?? DEFAULT_OPTIONS.destinationDispatch,
    );
    this.elevators = createElevators(
      elevatorCount,
      this.#floorCount,
      this.floorHeight,
      options.elevatorCapacities,
      deriveRandomSource(derivedSeed, BOARDING_SLOT_STREAM),
      options.elevatorServedFloors,
    );
    this.elevatorInterfaces = this.elevators.map(
      (e) => new ElevatorInterface(e, this.floors, handleUserCodeError),
    );

    for (const elevator of this.elevators) {
      elevator.on("entrance_available", (availableElevator) => {
        this.#handleElevAvailability(availableElevator);
      });
    }

    for (const floor of this.floors) {
      floor.on("up_button_pressed", (pressedFloor) => {
        this.#handleButtonRepressing("up", pressedFloor);
      });
      floor.on("down_button_pressed", (pressedFloor) => {
        this.#handleButtonRepressing("down", pressedFloor);
      });
      floor.on("elevator_assigned", (bookedFloor, _destinationFloor, elevator) => {
        this.#handleAssignmentRepressing(bookedFloor, elevator);
      });
    }

    // Built after the floor handlers above are registered, so those run
    // before any handler player code adds to the same floors.
    this.floorInterfaces = this.floors.map((f) => new FloorInterface(f, handleUserCodeError));

    this.#elapsedSinceSpawn = 1.001 / this.#spawnRate;
  }

  /** Recomputes the derived statistics and notifies listeners. */
  #recalculateStats(): void {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    // One pass over the elevators for all three sums; it runs on every tick.
    let moveCount = 0;
    let loadSum = 0;
    let stopCount = 0;
    for (const elevator of this.elevators) {
      moveCount += elevator.moveCount;
      loadSum += elevator.loadFactorSumOnMove;
      stopCount += elevator.stopCount;
    }
    this.moveCount = moveCount;
    // Guarded against 0/0 -> NaN before any elevator has moved.
    this.avgLoadFactorOnMove = this.moveCount === 0 ? 0 : loadSum / this.moveCount;
    this.stopCount = stopCount;
    // Same 0/0 guard, before any door has opened.
    this.avgPeoplePerStop =
      this.stopCount === 0 ? 0 : (this.#pickedUpCounter + this.transportedCounter) / this.stopCount;
    this.trigger("stats_changed");
  }

  /** Adds a spawned passenger to the world and starts their wait clock. */
  #registerUser(user: User): void {
    this.users.push(user);
    user.updateDisplayPosition(true);
    user.spawnTimestamp = this.elapsedTime;
    this.trigger("new_user", user);
    user.on("entered_elevator", () => {
      user.pickupTimestamp = this.elapsedTime;
      const waited = this.elapsedTime - user.spawnTimestamp;
      this.#pickedUpCounter++;
      this.maxPickupTime = Math.max(this.maxPickupTime, waited);
      this.avgPickupTime =
        (this.avgPickupTime * (this.#pickedUpCounter - 1) + waited) / this.#pickedUpCounter;
      // No recalculation here; update() recalculates at the end of every frame anyway.
    });
    user.on("exited_elevator", () => {
      this.transportedCounter++;
      this.maxWaitTime = Math.max(this.maxWaitTime, this.elapsedTime - user.spawnTimestamp);
      this.avgWaitTime =
        (this.avgWaitTime * (this.transportedCounter - 1) +
          (this.elapsedTime - user.spawnTimestamp)) /
        this.transportedCounter;
      // pickupTimestamp is always set by now; the fallback only guards a
      // future path that skips boarding, reporting the whole journey as the
      // ride rather than NaN.
      const boardedAt = user.pickupTimestamp ?? user.spawnTimestamp;
      this.avgRideTime =
        (this.avgRideTime * (this.transportedCounter - 1) + (this.elapsedTime - boardedAt)) /
        this.transportedCounter;
      this.#recalculateStats();
    });
    user.updateDisplayPosition(true);
  }

  /**
   * Hands the "waiting longest" title from whoever held it to whoever holds it.
   *
   * @param user - The new longest-waiting passenger, or `null` for nobody.
   */
  #setLongestWaitingUser(user: User | null): void {
    if (this.#longestWaitingUser === user) {
      return;
    }
    this.#longestWaitingUser?.setWaitingLongest(false);
    this.#longestWaitingUser = user;
    user?.setWaitingLongest(true);
  }

  /** Offers an arriving elevator to the floor it stopped at and to its waiters. */
  #handleElevAvailability(elevator: Elevator): void {
    // Floors first: a rejected passenger's re-press depends on the floor
    // already knowing the elevator arrived.
    for (let i = 0, len = this.floors.length; i < len; ++i) {
      const floor = requireAt(this.floors, i, "floor");
      if (elevator.currentFloor === i) {
        floor.elevatorAvailable(elevator);
      }
    }
    const users = this.users;
    for (let i = 0, len = users.length; i < len; ++i) {
      const user = requireAt(users, i, "user");
      if (user.currentFloor === elevator.currentFloor) {
        user.elevatorAvailable(elevator, requireAt(this.floors, elevator.currentFloor, "floor"));
      }
    }
  }

  /**
   * Re-offers a floor to an elevator that is already standing there.
   *
   * Causes elevators to "re-arrive" at floors when a passenger presses a
   * suitable button before the elevator has left.
   */
  #handleButtonRepressing(direction: "up" | "down", floor: Floor): void {
    // Randomized start avoids always filling the first elevator.
    const len = this.elevators.length;
    const offset = randomInt(0, len - 1, this.#buttonRepressRandom);
    for (let i = 0; i < len; ++i) {
      const elevIndex = (i + offset) % len;
      const elevator = requireAt(this.elevators, elevIndex, "elevator");
      if (
        (direction === "up" && elevator.goingUpIndicator) ||
        (direction === "down" && elevator.goingDownIndicator)
      ) {
        if (
          elevator.currentFloor === floor.level &&
          elevator.isOnAFloor() &&
          !elevator.isMoving &&
          !elevator.isFull()
        ) {
          requireAt(this.elevatorInterfaces, elevIndex, "elevator interface").goToFloor(
            floor.level,
            true,
          );
          return;
        }
      }
    }
  }

  /**
   * Re-offers a floor to the car that was just booked to serve it.
   *
   * Unlike {@link World.#handleButtonRepressing}, the booking already names
   * the car, so there is nothing to draw.
   */
  #handleAssignmentRepressing(floor: Floor, elevator: FloorElevator): void {
    for (let i = 0, len = this.elevators.length; i < len; ++i) {
      const candidate = requireAt(this.elevators, i, "elevator");
      if (
        candidate === elevator &&
        candidate.currentFloor === floor.level &&
        candidate.isOnAFloor() &&
        !candidate.isMoving &&
        !candidate.isFull()
      ) {
        requireAt(this.elevatorInterfaces, i, "elevator interface").goToFloor(floor.level, true);
        return;
      }
    }
  }

  /**
   * Advances the simulation by one step.
   *
   * @param dt - Simulated seconds to advance.
   */
  update(dt: number): void {
    this.elapsedTime += dt;
    this.#elapsedSinceSpawn += dt;
    while (this.#elapsedSinceSpawn > this.#spawnInterval) {
      this.#elapsedSinceSpawn -= this.#spawnInterval;
      this.#registerUser(
        spawnUserRandomly(
          this.#floorCount,
          this.floorHeight,
          this.floors,
          this.#random,
          this.#walkOffRandom,
          this.#trafficProfile,
        ),
      );
    }

    for (const elevator of this.elevators) {
      elevator.update(dt);
      elevator.updateElevatorMovement(dt);
    }
    const users = this.users;
    // Ties cannot arise (no two passengers share a spawn time), but `>` would
    // keep the earliest arrival if they did.
    let longestWait = -1;
    let longestWaiter: User | null = null;
    // Set by whoever finished walking off during this tick, which is the only
    // thing that fills the removal pass below.
    let anyRemoved = false;
    for (const u of users) {
      u.update(dt);
      if (u.removeMe) {
        anyRemoved = true;
      }
      // Skips passengers still walking off-screen: their wait was already
      // recorded once by the exited_elevator handler, and re-measuring here
      // would fold in animation time.
      if (!u.done) {
        const waited = this.elapsedTime - u.spawnTimestamp;
        this.maxWaitTime = Math.max(this.maxWaitTime, waited);
        // Updated every frame so a passenger nobody ever picks up still
        // shows up in this figure.
        if (u.pickupTimestamp === null) {
          this.maxPickupTime = Math.max(this.maxPickupTime, waited);
        }
        if (waited > longestWait) {
          longestWait = waited;
          longestWaiter = u;
        }
      }
    }
    this.#setLongestWaitingUser(longestWaiter);

    if (anyRemoved) {
      for (let i = users.length - 1; i >= 0; i--) {
        const u = requireAt(users, i, "user");
        if (u.removeMe) {
          users.splice(i, 1);
        }
      }
    }

    this.#recalculateStats();
  }

  /** Refreshes the cached world positions everything is drawn at. */
  updateDisplayPositions(): void {
    for (const elevator of this.elevators) {
      elevator.updateDisplayPosition();
    }
    for (const user of this.users) {
      user.updateDisplayPosition();
    }
  }

  /** Tears the world down, dropping every event subscription. */
  unWind(): void {
    // floorInterfaces are left out: they forward from floors, which lose
    // their own subscriptions below, so there is nothing left for them to hear.
    for (const obj of [
      ...this.elevators,
      ...this.elevatorInterfaces,
      ...this.users,
      ...this.floors,
    ]) {
      obj.offAll();
    }
    this.offAll();
    this.levelEnded = true;
    this.elevators = [];
    this.elevatorInterfaces = [];
    this.users = [];
    this.floors = [];
    this.floorInterfaces = [];
  }

  /** Kicks the elevators off, which raises the initial `idle` events. */
  init(): void {
    for (const elevatorInterface of this.elevatorInterfaces) {
      elevatorInterface.checkDestinationQueue();
    }
  }
}

/**
 * Creates a world for a level.
 *
 * Omitting `random` generates a fresh seed, recorded on {@link World.seed}
 * for replay.
 */
export function createWorld(options: WorldOptions = {}, random?: RandomSeed | RandomSource): World {
  return new World(options, random);
}
