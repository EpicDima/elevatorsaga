/**
 * Text for the elevator and floor hover cards, from a plain snapshot of
 * engine state rather than the live `Elevator`/`Floor`/`User` objects
 * themselves — so it is unit-testable without a DOM or a running world, the
 * same way `layout-building.ts` and `shaft-scale.ts` are.
 *
 * The engine has no persistent "doors open" flag, only the transient
 * `boarding_started`/arrival events (`src/game/elevator.ts`), so the state
 * line collapses to the three things a snapshot *can* answer at any instant:
 * moving up, moving down, or stopped. `isMoving` with `velocityY === 0` (the
 * very first instant of a move, before acceleration has produced a sign) is
 * treated as "moving down" — a one-frame cosmetic wrinkle, not a state a
 * hover card is ever likely to be read during.
 */

import { elevatorLabel } from "../../../ui/templates.ts";
import { format, formatList, seconds, t } from "#i18n/index.ts";

/** What the elevator card needs to know, gathered from one `Elevator`. */
export interface ElevatorCardSnapshot {
  /** Zero-based car index, as `elevatorLabel` expects. */
  readonly index: number;
  /** Whether the car is currently en route (`Elevator.isMoving`). */
  readonly isMoving: boolean;
  /** Signed vertical speed; positive means moving down (`Elevator.velocityY`). */
  readonly velocityY: number;
  /** Whether the car currently advertises upward service. */
  readonly goingUpIndicator: boolean;
  /** Whether the car currently advertises downward service. */
  readonly goingDownIndicator: boolean;
  /** Riders currently aboard. */
  readonly occupied: number;
  /** Seats aboard (`Elevator.maxUsers`). */
  readonly capacity: number;
  /** Floors with a lit in-car button, ascending. */
  readonly pressedFloors: readonly number[];
}

/** What the floor card needs to know, gathered from one `Floor` and its waiting `User`s. */
export interface FloorCardSnapshot {
  /** The floor's level number, as shown elsewhere in the UI. */
  readonly level: number;
  /** How many passengers are currently waiting on this floor. */
  readonly waitingCount: number;
  /** How long, in seconds, the longest-waiting passenger has waited; absent when nobody is waiting. */
  readonly longestWaitSeconds: number | undefined;
  /** Distinct destination floors the waiting passengers have chosen, ascending. */
  readonly destinationFloors: readonly number[];
}

/** A hover card's text, ready to drop into an element's `textContent`. */
export interface HoverCardText {
  /** The card's heading. */
  readonly title: string;
  /** The card's body, one paragraph per line. */
  readonly lines: readonly string[];
}

function elevatorStateLine(isMoving: boolean, velocityY: number): string {
  if (!isMoving) {
    return t("game.buildingStage.elevatorState.stopped");
  }
  return velocityY < 0
    ? t("game.buildingStage.elevatorState.movingUp")
    : t("game.buildingStage.elevatorState.movingDown");
}

function elevatorServingLine(goingUpIndicator: boolean, goingDownIndicator: boolean): string {
  if (goingUpIndicator && goingDownIndicator) {
    return t("game.buildingStage.elevatorServing.both");
  }
  if (goingUpIndicator) {
    return t("game.buildingStage.elevatorServing.up");
  }
  if (goingDownIndicator) {
    return t("game.buildingStage.elevatorServing.down");
  }
  return t("game.buildingStage.elevatorServing.none");
}

function pressedFloorsLine(pressedFloors: readonly number[]): string {
  if (pressedFloors.length === 0) {
    return t("game.buildingStage.elevatorPressed.none");
  }
  return t("game.buildingStage.elevatorPressed.some", {
    floors: formatList(pressedFloors.map((floor) => format(floor))),
  });
}

/**
 * Builds an elevator hover card's text.
 *
 * @param snapshot - The car's current state.
 * @returns The card's title and body lines.
 */
export function elevatorCardText(snapshot: ElevatorCardSnapshot): HoverCardText {
  return {
    title: elevatorLabel(snapshot.index),
    lines: [
      elevatorStateLine(snapshot.isMoving, snapshot.velocityY),
      t("game.buildingStage.elevatorOccupancy", {
        occupied: snapshot.occupied,
        capacity: snapshot.capacity,
      }),
      elevatorServingLine(snapshot.goingUpIndicator, snapshot.goingDownIndicator),
      pressedFloorsLine(snapshot.pressedFloors),
    ],
  };
}

function floorDestinationsLine(destinationFloors: readonly number[]): string {
  if (destinationFloors.length === 0) {
    return t("game.buildingStage.floorCard.destinations.none");
  }
  return t("game.buildingStage.floorCard.destinations.some", {
    floors: formatList(destinationFloors.map((floor) => format(floor))),
  });
}

/**
 * Builds a floor hover card's text.
 *
 * @param snapshot - The floor's current queue state.
 * @returns The card's title and body lines.
 */
export function floorCardText(snapshot: FloorCardSnapshot): HoverCardText {
  const lines = [t("game.buildingStage.floorCard.waiting", { count: snapshot.waitingCount })];
  if (snapshot.longestWaitSeconds !== undefined) {
    lines.push(
      t("game.buildingStage.floorCard.longestWait", {
        time: format(seconds(snapshot.longestWaitSeconds, 1)),
      }),
    );
  }
  lines.push(floorDestinationsLine(snapshot.destinationFloors));

  return {
    title: t("game.buildingStage.floorCard.title", { floor: snapshot.level }),
    lines,
  };
}
