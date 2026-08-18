import { describe, expect, it } from "vitest";

import { elevatorCardText, floorCardText } from "./hover-card-text.ts";

describe("elevatorCardText", () => {
  it("titles the card with the car's one-based label", () => {
    const card = elevatorCardText({
      index: 2,
      isMoving: false,
      velocityY: 0,
      goingUpIndicator: true,
      goingDownIndicator: true,
      occupied: 0,
      capacity: 4,
      pressedFloors: [],
    });
    expect(card.title).toBe("Elevator 3");
  });

  it("reads a stopped car with nobody aboard, serving both ways, with no floors pressed", () => {
    const card = elevatorCardText({
      index: 0,
      isMoving: false,
      velocityY: 0,
      goingUpIndicator: true,
      goingDownIndicator: true,
      occupied: 0,
      capacity: 4,
      pressedFloors: [],
    });
    expect(card.lines).toEqual([
      "Stopped",
      "Occupied: 0/4",
      "Serving calls in both directions",
      "No floors requested",
    ]);
  });

  it("reads a car moving up, partly loaded, serving up only, with floors pressed", () => {
    const card = elevatorCardText({
      index: 0,
      isMoving: true,
      velocityY: -5,
      goingUpIndicator: true,
      goingDownIndicator: false,
      occupied: 2,
      capacity: 4,
      pressedFloors: [1, 3],
    });
    expect(card.lines).toEqual([
      "Moving up",
      "Occupied: 2/4",
      "Serving calls going up",
      "Requested floors: 1 and 3",
    ]);
  });

  it("reads a car moving down, serving down only", () => {
    const card = elevatorCardText({
      index: 0,
      isMoving: true,
      velocityY: 5,
      goingUpIndicator: false,
      goingDownIndicator: true,
      occupied: 1,
      capacity: 4,
      pressedFloors: [2],
    });
    expect(card.lines[0]).toBe("Moving down");
    expect(card.lines[2]).toBe("Serving calls going down");
  });

  it("reads a car serving neither direction", () => {
    const card = elevatorCardText({
      index: 0,
      isMoving: false,
      velocityY: 0,
      goingUpIndicator: false,
      goingDownIndicator: false,
      occupied: 0,
      capacity: 4,
      pressedFloors: [],
    });
    expect(card.lines[2]).toBe("Not serving any calls");
  });
});

describe("floorCardText", () => {
  it("titles the card with the floor's own level", () => {
    const card = floorCardText({
      level: 5,
      waitingCount: 0,
      longestWaitSeconds: undefined,
      destinationFloors: [],
    });
    expect(card.title).toBe("Floor 5");
  });

  it("reads an empty floor without a longest-wait line", () => {
    const card = floorCardText({
      level: 0,
      waitingCount: 0,
      longestWaitSeconds: undefined,
      destinationFloors: [],
    });
    expect(card.lines).toEqual(["Waiting: 0", "No destinations chosen yet"]);
  });

  it("reads a floor with one waiting passenger and a chosen destination", () => {
    const card = floorCardText({
      level: 0,
      waitingCount: 1,
      longestWaitSeconds: 12.3,
      destinationFloors: [3],
    });
    expect(card.lines).toEqual(["Waiting: 1", "Longest wait: 12.3s", "Heading to: 3"]);
  });

  it("reads a floor with several waiting passengers and several destinations", () => {
    const card = floorCardText({
      level: 0,
      waitingCount: 4,
      longestWaitSeconds: 30,
      destinationFloors: [1, 2, 5],
    });
    expect(card.lines).toEqual(["Waiting: 4", "Longest wait: 30.0s", "Heading to: 1, 2, and 5"]);
  });
});
