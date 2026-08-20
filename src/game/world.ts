/**
 * The simulated building: floors, elevators, passengers and statistics.
 *
 * Ported from the `createWorldCreator` half of the legacy `world.js`. The
 * per-frame work in {@link World.update} is deliberately unchanged, including
 * recomputing `maxWaitTime` over every live passenger and recalculating the
 * statistics on every single frame.
 *
 * ## Every draw the simulation makes, and which stream each one comes from
 *
 * One seed drives four generators, and what decides where a draw belongs is a
 * single question: can the *moment* it is taken move? The frame clock no longer
 * moves it — {@link "./world-controller.ts"!WorldController} advances the world
 * in fixed {@link "./world-controller.ts"!TICK_SECONDS} ticks, so one seed
 * played one way takes the same steps at 60 Hz and at 120 Hz, which is what
 * {@link "./determinism.test.ts"} measures. The *program* still moves it, and
 * always will: a draw taken because a car reached a floor or a passenger
 * reached a destination happens whenever that player's elevators make it
 * happen, and two programs on one seed make it happen at different ticks. Such
 * a draw cannot be stopped from moving. It can be stopped from moving anything
 * else, by being given a generator of its own — which is what a seed's promise
 * rests on, because a single shifting draw inside the spawn stream offsets
 * every later spawn, and from there on the Nth passenger is a different person
 * heading somewhere else. That is the difference between a seed two programs
 * can be compared on and a seed that quietly deals each of them a different
 * building's worth of people.
 *
 * The audit, complete as of this file, in the order the draws were found:
 *
 * - **Spawning**, {@link spawnUserRandomly} from {@link World.update}: five to
 *   eight draws per passenger, depending on which branches the draws themselves
 *   take. Fires only when the spawn accumulator crosses `1 / spawnRate`, and
 *   that accumulator is a sum of `dt` and nothing else, so no elevator and no
 *   player program can add, drop or reorder a spawn. This is the sequence the
 *   seed's promise is about, and it keeps the world's own stream — the point of
 *   the exercise is to leave it alone.
 * - **Button repressing**, `World.handleButtonRepressing`: one draw per emitted
 *   floor-button press. A passenger a full or wrongly signposted car turns away
 *   presses the button again, which is a moment the elevators decide. See
 *   `BUTTON_REPRESS_STREAM`.
 * - **Walking off**, {@link "./user.ts"!User.handleExit}: one draw per delivered
 *   passenger. Delivery is a moment the elevators decide. See
 *   `WALK_OFF_STREAM`.
 * - **Boarding slots**, {@link "./elevator.ts"!Elevator.userEntering}: one draw
 *   per boarding attempt. Boarding is a moment the elevators decide. See
 *   `BOARDING_SLOT_STREAM`.
 *
 * Nothing else in the engine draws. `Floor` has no stream of its own,
 * `FloorInterface` and `ElevatorInterface` forward events without deciding
 * anything by chance, and {@link "./math.ts"!randomInt} only ever draws from
 * whichever source its caller passed. The one remaining reach for
 * `Math.random` is {@link "./random.ts"!generateRandomSeed}, which runs before a
 * world exists.
 *
 * What the separation buys is precisely one thing: the spawn sequence, held
 * identical across every program the seed is played with. It does *not* make
 * the other three reproduce per passenger between two programs, since their
 * values are still handed out in the order the events happen and a different
 * program orders those events differently. Two of them can be shrugged at — a
 * boarding slot decides where a passenger is drawn inside the car, a walk-off
 * duration how long the sprite takes to leave the screen, and swapping either
 * between two passengers changes no statistic. The third cannot: the repress
 * offset ends in a real `goToFloor` on a specific car, so it moves `moveCount`
 * and the wait times, which are what levels 6 to 15 are won and lost on. It
 * is on its own stream because its moment shifts, not because it does not
 * matter — and the distinction is worth keeping straight, because "it is only
 * cosmetic" is the argument someone will one day use to add, drop or relocate
 * that draw.
 *
 * So the statement of the promise is: one seed and one program give one run,
 * down to the tick, whatever the frame clock does; one seed across two programs
 * gives one building and one passenger sequence, which is what makes the two
 * scores worth comparing at all.
 */

import { Elevator } from "./elevator.ts";
import { ElevatorInterface } from "./elevator-interface.ts";
import { Floor } from "./floor.ts";
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

/** Default world options, matching the legacy `defaultOptions`. */
const DEFAULT_OPTIONS = {
  floorHeight: 50,
  floorCount: 4,
  elevatorCount: 2,
  spawnRate: 0.5,
} as const;

/** Default elevator capacity list, used when a level sets none. */
const DEFAULT_ELEVATOR_CAPACITIES: readonly number[] = [4];

/** Elevator top speed, in floors per second. */
const ELEVATOR_SPEED_FLOORS_PER_SEC = 2.6;

/** World x of the leftmost elevator shaft. */
const FIRST_ELEVATOR_X = 200.0;

/** Horizontal gap between elevator shafts. */
const ELEVATOR_SPACING = 20;

/**
 * Rate a world falls back to when what it was handed is not a rate at all.
 *
 * Zero: nobody ever arrives. See {@link resolveSpawnRate} for why that is the
 * answer, and why it is not an invented one.
 */
const NO_ARRIVALS_SPAWN_RATE = 0;

/** One in this many spawned passengers is drawn as a child. */
const CHILD_ODDS = 40;

/** One in this many passengers above floor 0 is not heading for the lobby. */
const NON_LOBBY_DESTINATION_ODDS = 10;

/**
 * Label of the stream the elevators pick boarding slots from.
 *
 * One of the three streams the file header's audit moves out of the world's
 * own: the draw happens once per boarding attempt, and a boarding happens when
 * a car the player sent somewhere opens its doors, which is a moment the frame
 * clock moves. Which slot comes back decides nothing but where the passenger is
 * drawn inside the car.
 */
const BOARDING_SLOT_STREAM = "boarding-slots";

/**
 * Label of the stream the button-repressing sweep picks its starting car from.
 *
 * One of the three streams the file header's audit moves out of the world's
 * own: the draw happens once per floor-button press, and every press after the
 * first is timed by the elevators — a passenger presses again when a car turns
 * them away, a fraction of a second earlier or later depending on where the
 * frame boundaries fell.
 *
 * Unlike the other two, what comes back is not cosmetic. The sweep ends in a
 * real `goToFloor` on one particular car, so the offset moves `moveCount` and
 * the wait times, and those are the numbers levels are won and lost on. It
 * is separated because its *moment* shifts, which is a different reason, and
 * mixing the two up is how a draw like this ends up being moved "harmlessly".
 */
const BUTTON_REPRESS_STREAM = "button-repress";

/**
 * Label of the stream a delivered passenger's walk-off duration comes from.
 *
 * One of the three streams the file header's audit moves out of the world's
 * own, and the one whose moment is furthest from the seed: the draw needs a car
 * to have been sent to the right floor by the player's program and to have
 * braked onto it, neither of which lands on the same frame twice. The duration
 * decides only how long the sprite takes to leave the screen — the passenger's
 * wait was recorded when they stepped out, in `World.registerUser`.
 */
const WALK_OFF_STREAM = "walk-off";

/**
 * Seed the derived streams are built from when the world has none.
 *
 * Only worlds handed a ready-made {@link RandomSource} — in practice tests —
 * have no seed of their own to derive from, and they all share these streams as
 * a result. That costs nothing: the injected stream is the one such a caller
 * cares about, it is the one the other draws must stay out of, and the derived
 * streams stay reproducible either way.
 */
const UNSEEDED_DERIVED_SEED = "injected-stream";

/**
 * Reads an array element that is known to exist.
 *
 * The simulation indexes floors and elevators by numbers it derived from their
 * own lengths, so a miss means the world is internally inconsistent.
 *
 * @param arr - Array to read.
 * @param index - Index to read.
 * @param what - Name of the thing being read, for the error message.
 * @returns The element at `index`.
 * @throws {RangeError} When there is no element at `index`.
 */
function requireAt<T>(arr: readonly T[], index: number, what: string): T {
  const value = arr[index];
  if (value === undefined) {
    throw new RangeError(`No ${what} at index ${String(index)}`);
  }
  return value;
}

/**
 * Builds the floors of a building, bottom floor first.
 *
 * @param floorCount - Number of floors.
 * @param floorHeight - Height of one floor in world units.
 * @param errorHandler - Receives anything a floor event handler throws.
 * @returns The floors, indexed by floor number.
 */
export function createFloors(
  floorCount: number,
  floorHeight: number,
  errorHandler: (e: unknown) => void,
): Floor[] {
  return Array.from({ length: floorCount }, (_unused, i) => {
    const yPos = (floorCount - 1 - i) * floorHeight;
    return new Floor(i, yPos, errorHandler);
  });
}

/**
 * Builds the elevators of a building, laid out left to right.
 *
 * @param elevatorCount - Number of elevators.
 * @param floorCount - Number of floors they serve.
 * @param floorHeight - Height of one floor in world units.
 * @param elevatorCapacities - Capacities, cycled if shorter than the count.
 * @param random - Stream every elevator picks its boarding slots from; the
 * world hands over the one it derives for that (see
 * {@link BOARDING_SLOT_STREAM}). Omitting it leaves the elevators on the
 * unseeded default, which only a caller building elevators outside a world
 * should want.
 * @returns The elevators, already positioned at floor 0.
 */
export function createElevators(
  elevatorCount: number,
  floorCount: number,
  floorHeight: number,
  elevatorCapacities?: readonly number[],
  random?: RandomSource,
): Elevator[] {
  const capacities = elevatorCapacities ?? DEFAULT_ELEVATOR_CAPACITIES;
  let currentX = FIRST_ELEVATOR_X;
  return Array.from({ length: elevatorCount }, (_unused, i) => {
    const elevator = new Elevator(
      ELEVATOR_SPEED_FLOORS_PER_SEC,
      floorCount,
      floorHeight,
      capacities[i % capacities.length],
      random,
    );

    // Park on the bottom floor first, then slide into the shaft.
    //
    // The legacy order was the other way round (world.js:22-23), and every
    // position change runs handleNewState: the horizontal move was evaluated
    // while the car was still at y = 0, which rounds to the *top* floor, so the
    // elevator was recorded as having changed floor before the simulation had
    // even started. Every elevator was therefore born with moveCount === 1,
    // inflating the score the "move the elevators as little as possible"
    // levels are judged on (upstream issues #117 and #20).
    //
    // setFloorPosition assigns currentFloor itself before moving, so doing it
    // first makes the snap a no-op for the move counter. The final x and y are
    // unchanged; only the intermediate state the counter saw is.
    elevator.setFloorPosition(0);
    // Move to right x position
    elevator.moveTo(currentX, null);
    elevator.updateDisplayPosition();
    currentX += ELEVATOR_SPACING + elevator.width;
    return elevator;
  });
}

/**
 * Creates a passenger with a random weight and appearance.
 *
 * Draws weight, then the child roll, then the gender roll, in that order and
 * over those ranges — the order `legacy-1.x:world.js:32-36` drew them in. The
 * order is part of what a seed reproduces, so it may not be rearranged even
 * where it reads better.
 *
 * @param random - Stream to draw from; the world hands over its own.
 * @param walkOffRandom - Stream the passenger will draw their walk-off duration
 * from once they are delivered. A second stream because that draw is taken at a
 * moment the elevators decide; see the file header's audit for the whole
 * argument, and {@link WALK_OFF_STREAM} for the one the world passes. Required
 * rather than defaulted, because a default is how a caller that meant to build
 * a reproducible passenger ends up with a half-reproducible one and no
 * complaint from the compiler; a caller that genuinely does not care can say so
 * by passing {@link "./random.ts"!systemRandom}. Passing `random` itself is the
 * one wrong answer — it puts a shifting draw back into the sequence this
 * function's own draws come from.
 * @returns The new passenger, not yet placed on a floor.
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

/**
 * Creates a passenger and places them on a random floor with a random trip.
 *
 * Half of all passengers start in the lobby and travel up; the rest usually
 * head back down to the lobby.
 *
 * The draws happen in the order `legacy-1.x:world.js:46-55` made them — spawn
 * offset, "start in the lobby?", origin floor, then the destination — and the
 * short-circuit in the origin line means a passenger who starts in the lobby
 * costs one draw fewer than one who does not. That is load-bearing for replay,
 * so it stays exactly as it is.
 *
 * @param floorCount - Number of floors in the building.
 * @param _floorHeight - Unused; part of the legacy signature.
 * @param floors - The building's floors, indexed by floor number.
 * @param random - Stream to draw from; the world hands over its own.
 * @param walkOffRandom - Stream the passenger will draw their walk-off duration
 * from; passed straight to {@link createRandomUser}, which explains why it is
 * neither `random` nor optional.
 * @returns The new passenger, already waiting for an elevator.
 */
export function spawnUserRandomly(
  floorCount: number,
  _floorHeight: number,
  floors: readonly Floor[],
  random: RandomSource,
  walkOffRandom: RandomSource,
): User {
  const user = createRandomUser(random, walkOffRandom);
  user.moveTo(105 + randomInt(0, 40, random), 0);
  const currentFloor = randomInt(0, 1, random) === 0 ? 0 : randomInt(0, floorCount - 1, random);
  let destinationFloor: number;
  if (currentFloor === 0) {
    // Definitely going up
    destinationFloor = randomInt(1, floorCount - 1, random);
  } else {
    // Usually going down, but sometimes not
    if (randomInt(0, NON_LOBBY_DESTINATION_ODDS, random) === 0) {
      destinationFloor = (currentFloor + randomInt(1, floorCount - 1, random)) % floorCount;
    } else {
      destinationFloor = 0;
    }
  }
  user.appearOnFloor(requireAt(floors, currentFloor, "floor"), destinationFloor);
  return user;
}

/**
 * Turns a requested spawn rate into one the spawn loop can finish running.
 *
 * That loop is `while (elapsedSinceSpawn > 1 / spawnRate)`, subtracting
 * `1 / spawnRate` each time round, so once it has started only a positive
 * interval can bring it to an end: stopping means getting the accumulator back
 * below the threshold, and only a positive subtrahend moves it that way. (An
 * interval of `NaN` ends the loop too, by never letting it start — see below.)
 * A negative rate makes the interval negative, so every
 * iteration *adds* to the accumulator it is racing and the condition can never
 * go false. An infinite rate makes the interval zero — `1 / Infinity` is `+0`,
 * `1 / -Infinity` is `-0` — so the subtraction does not move the accumulator at
 * all and the condition never goes false either. Both spin inside a single
 * synchronous simulation step, so there is no exception, no stack and no next
 * frame: the tab stops dead and the game merely looks frozen.
 *
 * Everything that is not a positive finite rate therefore becomes zero, "nobody
 * arrives". That is a request the simulation can actually honour, and not an
 * invented one: it is what a rate of `0` already did, since the interval is then
 * `Infinity` and no accumulated time is ever greater than it, and it is the only
 * reading of "minus two passengers a second" that does not make a number up.
 * Clamping to a small positive rate instead — the sandbox's floor is 0.01 (see
 * `SANDBOX_LIMITS` in src/pages/game/model/route.ts) — would spawn traffic nobody
 * asked for, with no value less arbitrary than any other.
 *
 * `NaN` cannot hang today, because no comparison against it is true and the loop
 * is skipped, but it goes the same way here. "No comparison is true" is a
 * fragile thing for termination to rest on if the condition is ever rewritten,
 * and one rule covering every value that is not a rate is easier to keep true
 * than two.
 *
 * What this does *not* promise is that every finite positive rate terminates
 * quickly. Past roughly 5.8e17 — at the game's `1 / 60` second step — the
 * interval is under half an ulp of the accumulated time, so the subtraction
 * rounds to no change and the loop spins for good; below that but still absurd,
 * it ends only after spawning more passengers than memory holds. Neither is
 * rescuable from here, because both need a *ceiling*, and every ceiling is a
 * number this function would have to invent: low enough to be safe and it
 * silently rewrites the timing of a rate that really is a rate, high enough to
 * be uncontroversial and it still admits values that spin. Reading "not a rate"
 * as "nobody arrives" invents nothing, which is why that half is worth doing
 * here and this half is left written down instead.
 *
 * None of it is reachable from the app as it stands: the sandbox clamps its own
 * parameter to [0.01, 10] before `createWorld` sees it and the shipped
 * levels are constants. The check lives in the engine anyway, because the
 * app is one caller of `createWorld` among several — tests, the fitness suite,
 * and whatever is written next — and because of how this particular mistake
 * fails. There is no exception, no stack and no next frame to break in; the tab
 * simply stops, which is a long way to walk back to a single wrong number.
 *
 * Reported with a single `console.warn`, rather than thrown or swallowed.
 * Throwing would abort `createWorld`, which the app calls while starting a run
 * (`#startRun` in src/pages/game/index.ts), so one bad option would leave the page with
 * no building at all — where the house rule for a value the engine cannot use is
 * to keep the simulation running and say so once (`#dropUnreachableDestinations`
 * in src/game/elevator-interface.ts). That pattern reports through
 * `usercode_error`, which is not available here: nothing has subscribed to the
 * world during its own constructor, and the rate comes from the level
 * options rather than from the player's program, so blaming player code would
 * name the wrong author. That leaves the console, where
 * `Elevator.getFirstPressedFloor` already puts its once-only notice. Swallowing
 * it would be smaller still, but a building in which nobody ever appears is
 * indistinguishable from a broken game, and this is the one line that says which
 * it is.
 *
 * @param spawnRate - Passengers per second the world was asked for.
 * @returns `spawnRate` when it is a positive finite number, and
 * {@link NO_ARRIVALS_SPAWN_RATE} otherwise. A rate of exactly `0` passes through
 * unremarked — it is a coherent thing to ask for, and it already gets what it
 * asked for. Anything that is not a number at all, such as a `"2"` reaching an
 * untyped caller, goes the way of the other non-rates rather than being coerced:
 * `WorldOptions` is engine-internal and typed, unlike the player-facing API in
 * src/game/elevator-interface.ts, which coerces precisely because everything it
 * is handed comes from a program the compiler never saw.
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
   *
   * Recorded even when nobody asked for a particular one, because the run worth
   * repeating is almost always one that has already happened: print this and
   * pass it back to {@link createWorld} to get the same run again. One seed is
   * enough for the whole run because every stream the world builds comes from
   * it, the elevators' boarding slots included. `null` only happens when a
   * caller — in practice a test — supplied its own {@link RandomSource}, which
   * it can reproduce by construction.
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
   * Sampled once per move rather than once per frame, which keeps a car parked
   * at the lobby from dragging the figure down: parking cars is good play in
   * several levels, and a statistic that punished it would be pointing the
   * player the wrong way. Zero while nothing has moved. What it means for the
   * player is spelled out under `docs.play.statistics.html`, including why it
   * sits so far below 1.
   */
  avgLoadFactorOnMove = 0.0;
  /** Simulated seconds since the world started. */
  elapsedTime = 0.0;
  /**
   * Longest spawn-to-delivery any passenger has reached, delivered or not.
   *
   * Not a waiting time, whatever the name says: the clock stops when a
   * passenger steps out at their floor, so the ride is inside it, and it goes
   * on growing for whoever is still aboard. The name is upstream's and stays,
   * because every level condition and every score ever posted is written
   * against it; what it measures is spelled out for the player under
   * `docs.play.statistics.html`.
   */
  maxWaitTime = 0.0;
  /** Mean spawn-to-delivery time of delivered passengers, the same span. */
  avgWaitTime = 0.0;
  /**
   * Longest anyone has stood on a floor before a car took them, still-waiting
   * passengers included.
   *
   * This is the waiting time the two above are not. It stops at the moment of
   * boarding, so the ride is outside it, and it keeps growing for whoever is
   * still on a floor -- which is what makes a stranded passenger visible here
   * rather than only at the end of the level.
   */
  maxPickupTime = 0.0;
  /** Mean spawn-to-boarding time of the passengers a car has picked up. */
  avgPickupTime = 0.0;
  /**
   * Mean boarding-to-delivery time of delivered passengers: the ride itself.
   *
   * The third of the three spans the lift industry measures a building by, and
   * the one the panel was missing. {@link World.avgPickupTime} is its average
   * waiting time, {@link World.avgWaitTime} its average journey time, and a
   * journey is a wait followed by a ride — so this is what the other two do not
   * account for between them, and the sum of the two averages is the third to
   * within floating point.
   *
   * Only delivered passengers are in it. Somebody still riding has no ride time
   * yet, in the way somebody still waiting has no journey time.
   */
  avgRideTime = 0.0;
  /**
   * Door openings across all elevators; see {@link "./elevator.ts"!Elevator.stopCount}.
   */
  stopCount = 0;
  /**
   * People who got in or out at an average stop.
   *
   * Boardings plus deliveries over stops, which is the game's reading of the
   * car loading that round-trip-time analysis calls `P`. It says whether the
   * doors are being opened for a crowd or for one person: a program that sends
   * a car to every floor that lights up drives it towards one, and a program
   * that lets calls collect and sweeps them drives it up.
   *
   * Both ends of a journey count, so a passenger carried from floor 3 to floor
   * 0 adds one to the stop they boarded at and one to the stop they left at.
   * Anything above zero is therefore easier to reach than the figure a lift
   * engineer would quote for the same building, where `P` counts boardings
   * alone; what matters here is the direction it moves in, and both ends move
   * it the same way. Zero while nothing has stopped.
   */
  avgPeoplePerStop = 0.0;
  /** Whether the level is over and the world should stop updating. */
  levelEnded = false;

  /**
   * Boardings so far, the denominator behind {@link World.avgPickupTime}.
   *
   * Private because nothing outside needs it and every public counter here is
   * something a level condition could come to be written against. It is not
   * `transportedCounter`: a passenger inside a moving car has boarded and has
   * not been delivered.
   */
  #pickedUpCounter = 0;

  readonly #floorCount: number;
  /**
   * Passengers per second, as {@link resolveSpawnRate} left it: either a
   * positive finite number or {@link NO_ARRIVALS_SPAWN_RATE}.
   *
   * Private and readonly, which is what lets the check happen once here rather
   * than on every frame — nothing outside this file can reach the field, and
   * nothing inside it assigns the field again, so a rate the constructor
   * accepted is the rate {@link update} divides by for the life of the world.
   */
  readonly #spawnRate: number;
  /**
   * The spawn stream, and nothing else.
   *
   * The one sequence a seed's promise is made of: who turns up, from where,
   * heading where, in what order. It is kept to spawning alone because spawning
   * is the only drawing the player's program cannot move — see the file header
   * for the audit of the three draws that were moved out of here and why each
   * had to be.
   */
  readonly #random: RandomSource;
  /**
   * Stream the button-repressing sweep picks its starting elevator from.
   *
   * Derived, not the world's own; see {@link BUTTON_REPRESS_STREAM}.
   */
  readonly #buttonRepressRandom: RandomSource;
  /**
   * Stream every passenger this world spawns draws their walk-off duration from.
   *
   * Derived, not the world's own; see {@link WALK_OFF_STREAM}. Held here rather
   * than built per passenger so that the whole run's walk-offs are one
   * reproducible sequence instead of a fresh generator each time.
   */
  readonly #walkOffRandom: RandomSource;
  #elapsedSinceSpawn: number;
  /**
   * The passenger whose wait is the one still growing, or `null` for nobody.
   *
   * Remembered between frames only so that the handover can be an event rather
   * than a poll: the passenger who loses the title has to hear about it as much
   * as the one who gains it.
   */
  #longestWaitingUser: User | null = null;

  /**
   * @param options - Level options; missing values take the defaults.
   * @param random - Either a seed to build this world's streams from, or a
   * ready-made stream. A seed is what callers want: it is recorded on
   * {@link seed} and replays the run. A stream is for tests that need to pin
   * individual draws rather than a whole run, and it becomes the *spawn* stream
   * alone — the three timing-shiftable draws still get derived streams of their
   * own, so that a pinned sequence stays a sequence of spawn draws however the
   * elevators are driven. Defaults to a freshly generated seed, so that even a
   * run nobody seeded can be repeated afterwards.
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
    const elevatorCount = options.elevatorCount ?? DEFAULT_OPTIONS.elevatorCount;

    const handleUserCodeError = (e: unknown): void => {
      this.trigger("usercode_error", e);
    };

    this.floors = createFloors(this.#floorCount, this.floorHeight, handleUserCodeError);
    this.elevators = createElevators(
      elevatorCount,
      this.#floorCount,
      this.floorHeight,
      options.elevatorCapacities,
      deriveRandomSource(derivedSeed, BOARDING_SLOT_STREAM),
    );
    this.elevatorInterfaces = this.elevators.map(
      (e) => new ElevatorInterface(e, this.#floorCount, handleUserCodeError),
    );

    // Bind them all together
    for (const elevator of this.elevators) {
      elevator.on("entrance_available", (availableElevator) => {
        this.#handleElevAvailability(availableElevator);
      });
    }

    // This will cause elevators to "re-arrive" at floors if someone presses an
    // appropriate button on the floor before the elevator has left.
    //
    // The legacy code registered one handler for both events and relied on riot
    // prepending the event name to the arguments; the direction is passed
    // explicitly instead.
    for (const floor of this.floors) {
      floor.on("up_button_pressed", (pressedFloor) => {
        this.#handleButtonRepressing("up", pressedFloor);
      });
      floor.on("down_button_pressed", (pressedFloor) => {
        this.#handleButtonRepressing("down", pressedFloor);
      });
    }

    // Built last, and once, so that the world's own floor handlers above still
    // run before any player handler — the ordering the legacy code got for free
    // by letting player code subscribe to the Floor itself from `init`, which
    // happens after this constructor. Player code stores its handlers on these,
    // so the same instances have to be handed over on every frame.
    this.floorInterfaces = this.floors.map((f) => new FloorInterface(f, handleUserCodeError));

    this.#elapsedSinceSpawn = 1.001 / this.#spawnRate;
  }

  /** Recomputes the derived statistics and notifies listeners. */
  #recalculateStats(): void {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    // `legacy-1.x:world.js:89` asked whether this loop wants optimizing. It
    // does not: it runs over the elevator array, which is one to eight entries
    // in every shipped level, and at eight it costs 7.7 ns (Node 25 / V8,
    // best of five runs of three million) against the ~11 microseconds the
    // enclosing update() takes for a busy 21-floor building. The obvious
    // rewrite is not even faster — a hand-rolled `for...of` measured 8.1 ns on
    // the same array — so there is nothing here to win and a `reduce` says what
    // it does.
    this.moveCount = this.elevators.reduce((sum, elevator) => sum + elevator.moveCount, 0);
    // Guarded where `transportedPerSec` above is not, and the difference is
    // real: `elapsedTime` is past zero by the time anything reads these, but a
    // building whose cars have not moved yet is an ordinary state that lasts as
    // long as the player leaves it, and 0/0 would put NaN in the panel.
    const loadSum = this.elevators.reduce((sum, elevator) => sum + elevator.loadFactorSumOnMove, 0);
    this.avgLoadFactorOnMove = this.moveCount === 0 ? 0 : loadSum / this.moveCount;
    this.stopCount = this.elevators.reduce((sum, elevator) => sum + elevator.stopCount, 0);
    // Guarded for the same reason the load factor above is: a building whose
    // cars have not opened their doors yet is where every run starts.
    this.avgPeoplePerStop =
      this.stopCount === 0 ? 0 : (this.#pickedUpCounter + this.transportedCounter) / this.stopCount;
    this.trigger("stats_changed");
  }

  /**
   * Adds a spawned passenger to the world and starts their wait clock.
   *
   * @param user - The passenger to register.
   */
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
      // No `#recalculateStats()` here, unlike the delivery handler below. That
      // call exists so a delivery shows in the panel on the frame it happens;
      // these two figures are read from the same event and `update()` ends with
      // a recalculation anyway, so adding one would only mean more
      // `stats_changed` traffic for a number that is already about to be drawn.
    });
    user.on("exited_elevator", () => {
      this.transportedCounter++;
      this.maxWaitTime = Math.max(this.maxWaitTime, this.elapsedTime - user.spawnTimestamp);
      this.avgWaitTime =
        (this.avgWaitTime * (this.transportedCounter - 1) +
          (this.elapsedTime - user.spawnTimestamp)) /
        this.transportedCounter;
      // A delivered passenger has boarded, always: `User.handleExit` is only
      // ever reached through the `exit_available` handler that boarding
      // registers, so `pickupTimestamp` was written before this fires. The
      // fallback is there so that a future path into this event which somehow
      // skipped boarding would report the whole journey as the ride -- an
      // overstatement a reader can see -- rather than putting NaN in the panel.
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
   * Called once a frame with the answer the update loop just measured, so it is
   * given the same passenger over and over and has to be cheap when nothing has
   * changed: the identity check is what makes it so, and it is also what keeps
   * the handover to two `new_display_state` events instead of two a frame.
   *
   * @param user - The passenger whose wait is now the longest, or `null` when
   * nobody is waiting — every passenger delivered, or none spawned yet.
   */
  #setLongestWaitingUser(user: User | null): void {
    if (this.#longestWaitingUser === user) {
      return;
    }
    this.#longestWaitingUser?.setWaitingLongest(false);
    this.#longestWaitingUser = user;
    user?.setWaitingLongest(true);
  }

  /**
   * Offers an arriving elevator to the floor it stopped at and to its waiters.
   *
   * @param elevator - The elevator whose doors just opened.
   */
  #handleElevAvailability(elevator: Elevator): void {
    // Use regular loops for memory/performance reasons
    // Notify floors first because overflowing users
    // will press buttons again.
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
   *
   * @param direction - Which call button was pressed.
   * @param floor - The floor whose button was pressed.
   */
  #handleButtonRepressing(direction: "up" | "down", floor: Floor): void {
    // Need randomize iteration order or we'll tend to fill upp first elevator
    const len = this.elevators.length;
    const offset = randomInt(0, len - 1, this.#buttonRepressRandom);
    for (let i = 0; i < len; ++i) {
      const elevIndex = (i + offset) % len;
      const elevator = requireAt(this.elevators, elevIndex, "elevator");
      if (
        (direction === "up" && elevator.goingUpIndicator) ||
        (direction === "down" && elevator.goingDownIndicator)
      ) {
        // Elevator is heading in correct direction, check for suitability
        if (
          elevator.currentFloor === floor.level &&
          elevator.isOnAFloor() &&
          !elevator.isMoving &&
          !elevator.isFull()
        ) {
          // Potentially suitable to get into
          // Use the interface queue functionality to queue up this action
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
   * Advances the simulation by one step.
   *
   * @param dt - Simulated seconds to advance.
   */
  update(dt: number): void {
    this.elapsedTime += dt;
    this.#elapsedSinceSpawn += dt;
    // Divides without checking because resolveSpawnRate has already turned away
    // every value that is not a positive finite rate, and the field cannot
    // change afterwards. That is what it guarantees and all it guarantees: a
    // positive rate absurd enough to outrun the accumulator still spins here,
    // which resolveSpawnRate explains and deliberately does not cap.
    while (this.#elapsedSinceSpawn > 1.0 / this.#spawnRate) {
      this.#elapsedSinceSpawn -= 1.0 / this.#spawnRate;
      this.#registerUser(
        spawnUserRandomly(
          this.#floorCount,
          this.floorHeight,
          this.floors,
          this.#random,
          this.#walkOffRandom,
        ),
      );
    }

    // Use regular for loops for performance and memory friendlyness
    for (let i = 0, len = this.elevators.length; i < len; ++i) {
      const e = requireAt(this.elevators, i, "elevator");
      e.update(dt);
      e.updateElevatorMovement(dt);
    }
    const users = this.users;
    // Who the growing wait belongs to, decided in the same pass that measures
    // it. Ties cannot arise in practice — `users` is in spawn order and no two
    // passengers share a spawn time — and if they ever did, `>` keeps the one
    // who arrived first, which is the one a player would point at.
    let longestWait = -1;
    let longestWaiter: User | null = null;
    for (let i = 0, len = users.length; i < len; ++i) {
      const u = requireAt(users, i, "user");
      u.update(dt);
      // A delivered passenger stays in this list for another 1 to 1.5 seconds
      // while they walk off to the right, and the legacy loop kept extending
      // their wait for every frame of that animation — so the worst wait the
      // player is scored on included time spent after the journey had already
      // ended, and grew by a random amount that depended on the walk-off speed.
      // Their real wait was already recorded, exactly once, by the
      // `exited_elevator` handler in registerUser.
      if (!u.done) {
        const waited = this.elapsedTime - u.spawnTimestamp;
        this.maxWaitTime = Math.max(this.maxWaitTime, waited);
        // For a passenger still standing on a floor, the same subtraction is
        // their wait for a car so far, so the worst one is kept up to date
        // every frame instead of only at the moment somebody is finally
        // picked up. A passenger nobody ever comes for would otherwise never
        // appear in this figure at all, and that is the case worth seeing.
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

    for (let i = users.length - 1; i >= 0; i--) {
      const u = requireAt(users, i, "user");
      if (u.removeMe) {
        users.splice(i, 1);
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
    // The floor facades are not in this list, even though they do publish
    // `offAll`: they hear nothing once the floor they forward from has dropped
    // its own subscriptions, which happens below. They are discarded with the
    // world a few lines further down.
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
    // The legacy code chained these assignments, so all four ended up sharing
    // one array; nothing reads them again, so separate empties are equivalent.
    this.elevators = [];
    this.elevatorInterfaces = [];
    this.users = [];
    this.floors = [];
    this.floorInterfaces = [];
  }

  /** Kicks the elevators off, which raises the initial `idle` events. */
  init(): void {
    // Checking the floor queue of the elevators triggers the idle event here
    for (const elevatorInterface of this.elevatorInterfaces) {
      elevatorInterface.checkDestinationQueue();
    }
  }
}

/**
 * Creates a world for a level.
 *
 * @param options - Level options; missing values take the defaults.
 * @param random - Seed to replay a run from, or a ready-made stream for tests.
 * Omit it for a fresh run; the seed that gets generated is recorded on
 * {@link World.seed}, so the run stays repeatable afterwards.
 * @returns The new world.
 */
export function createWorld(options: WorldOptions = {}, random?: RandomSeed | RandomSource): World {
  return new World(options, random);
}
