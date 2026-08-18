// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { presentBuildingStage } from "./building-stage.ts";
import { elevatorCardText, floorCardText } from "../lib/hover-card-text.ts";
import { layoutBuilding } from "../lib/layout-building.ts";
import { computeShaftScale } from "../lib/shaft-scale.ts";
import { computeVerticalScale } from "../lib/vertical-scale.ts";
import { at } from "#game/test-helpers.ts";
import { createWorld } from "#game/world.ts";
import type { World } from "#game/world.ts";
import { User } from "#game/user.ts";
import { requireElement } from "#shared/lib/dom.ts";

/**
 * A stage sized by hand rather than measured — jsdom lays nothing out, the
 * same reason `workspace-layout.test.ts` and `editor-size.test.ts` stub
 * `clientWidth`/`getBoundingClientRect` instead of relying on a real layout
 * pass.
 *
 * @param width - `clientWidth` the stage reports.
 * @param height - `clientHeight` the stage reports.
 * @returns A detached element with both stubbed.
 */
function fixtureStage(width: number, height: number): HTMLElement {
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(parent, "clientHeight", { value: height, configurable: true });
  // `.focus()`/`.blur()` only fire in jsdom for elements attached to the document.
  document.body.append(parent);
  return parent;
}

/** The layout `presentBuildingStage` itself would have computed for a stage this size. */
function expectedLayout(world: World, stage: HTMLElement) {
  return layoutBuilding({
    stageHeight: stage.clientHeight,
    stageWidth: stage.clientWidth,
    levelsWidth: 0,
    floorWeights: world.floors.map(() => 1),
    capacities: world.elevators.map((elevator) => elevator.maxUsers),
  });
}

describe("presentBuildingStage", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("draws one .floor per floor and one .elevator per elevator, as siblings", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 2 });
    const stage = fixtureStage(800, 400);

    presentBuildingStage(stage, world);

    const worldEl = requireElement(".building-stage-world", stage);
    expect(worldEl.querySelectorAll(".floor")).toHaveLength(3);
    expect(worldEl.querySelectorAll(".elevator")).toHaveLength(2);
  });

  it("positions and sizes every floor from layoutBuilding's own geometry", () => {
    // room = max(160, 218-38) = 180; unit = 180/2 = 90, inside [48, 96].
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);

    presentBuildingStage(stage, world);

    const layout = expectedLayout(world, stage);
    const floors = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".floor",
    );
    expect(layout.floorHeights).toEqual([90, 90]);
    expect(layout.floorBottoms).toEqual([0, 90]);
    expect(layout.totalHeight).toBe(180);
    // Floor 0 (bottom) sits lowest on the page; floor 1 (top) sits at the top.
    expect(floors[0]?.style.top).toBe("90px");
    expect(floors[0]?.style.height).toBe("90px");
    expect(floors[1]?.style.top).toBe("0px");
    expect(floors[1]?.style.height).toBe("90px");
  });

  it("sizes the world layer to the building's total height", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);

    presentBuildingStage(stage, world);

    expect(requireElement(".building-stage-world", stage).style.height).toBe("180px");
  });

  it("sizes every car from the real elevator width and the computed shaft scale", () => {
    // Six 10-capacity cars (100px wide, 20px apart) need more room than a
    // narrow stage has, so the shaft scale clamps down to MIN_SHAFT/100.
    const world = createWorld({ floorCount: 4, elevatorCount: 6, elevatorCapacities: [10] });
    const stage = fixtureStage(500, 400);

    presentBuildingStage(stage, world);

    const layout = expectedLayout(world, stage);
    const { scaleX } = computeShaftScale({
      stageWidth: stage.clientWidth,
      levelsWidth: 0,
      carHeight: layout.carHeight,
      elevators: world.elevators.map((elevator) => ({
        worldX: elevator.worldX,
        width: elevator.width,
        capacity: elevator.maxUsers,
      })),
    });
    expect(scaleX).toBeLessThan(1);

    const cars = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".elevator",
    );
    for (const [index, elevator] of world.elevators.entries()) {
      expect(cars[index]?.style.width).toBe(`${String(elevator.width * scaleX)}px`);
      expect(cars[index]?.style.height).toBe(`${String(layout.carHeight)}px`);
    }
  });

  it("positions elevators and passengers by worldX/worldY times the computed scale", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const stage = fixtureStage(800, 300);

    presentBuildingStage(stage, world);

    const layout = expectedLayout(world, stage);
    const scaleY = computeVerticalScale({
      totalHeight: layout.totalHeight,
      floorCount: world.floors.length,
      floorHeight: world.floorHeight,
    });
    const elevator = at(world.elevators, 0);
    const carEl = requireElement(".elevator", stage);
    expect(carEl.style.transform).toBe(
      `translate3d(${String(elevator.worldX)}px, ${String(elevator.worldY * scaleY)}px, 0)`,
    );

    const user = new User(60);
    world.trigger("new_user", user);
    user.moveTo(30, 40);
    user.updateDisplayPosition();
    const userEl = requireElement(".user", stage);
    expect(userEl.getAttribute("style")).toContain(
      `translate3d(30px, ${String(40 * scaleY)}px, 0)`,
    );
  });

  it("recomputeGeometry re-lays-out floors and cars, and force-redraws movables in place", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);

    const presenter = presentBuildingStage(stage, world);
    const elevator = at(world.elevators, 0);
    elevator.moveTo(200, 30);
    elevator.updateDisplayPosition();
    const carEl = requireElement(".elevator", stage);
    const beforeResize = carEl.style.transform;

    // Shrink the stage: room = max(160, 100-38) = 160, so unit = 160/2 = 80,
    // a real change from the 90px unit above — which also changes scaleY,
    // which must show up on the very next paint with no new tick, since the
    // elevator never moved between the two calls.
    Object.defineProperty(stage, "clientHeight", { value: 100, configurable: true });
    presenter.recomputeGeometry();

    const floors = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".floor",
    );
    expect(floors[0]?.style.height).toBe("80px");
    expect(carEl.style.transform).not.toBe(beforeResize);
  });

  it("shows a floor's hover card on pointerenter, with the live waiting snapshot", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);
    presentBuildingStage(stage, world);

    const floor = at(world.floors, 0);
    const user = new User(70);
    user.appearOnFloor(floor, 1);
    world.users.push(user);

    const floorEl = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".floor",
    )[0];
    expect(floorEl).toBeDefined();
    floorEl?.dispatchEvent(new Event("pointerenter"));

    const card = requireElement(".building-stage-card", stage);
    expect(card.hidden).toBe(false);
    const expected = floorCardText({
      level: 0,
      waitingCount: 1,
      longestWaitSeconds: world.elapsedTime - user.spawnTimestamp,
      destinationFloors: [1],
    });
    expect(requireElement(".building-stage-card-title", card).textContent).toBe(expected.title);
    expect(
      [...requireElement(".building-stage-card-lines", card).children].map((el) => el.textContent),
    ).toEqual(expected.lines);
    expect(floorEl?.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("hides the floor's card again on pointerleave", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);
    presentBuildingStage(stage, world);

    const floorEl = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".floor",
    )[0];
    floorEl?.dispatchEvent(new Event("pointerenter"));
    floorEl?.dispatchEvent(new Event("pointerleave"));

    const card = requireElement(".building-stage-card", stage);
    expect(card.hidden).toBe(true);
    expect(floorEl?.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows an elevator's hover card on focus, with the live car snapshot", () => {
    const world = createWorld({ floorCount: 4, elevatorCount: 1, elevatorCapacities: [4] });
    const stage = fixtureStage(800, 300);
    presentBuildingStage(stage, world);

    const elevator = at(world.elevators, 0);
    const rider = new User(70);
    at(elevator.userSlots, 0).user = rider;
    elevator.pressFloorButton(2);

    const carEl = requireElement(".elevator", stage);
    carEl.focus();

    const card = requireElement(".building-stage-card", stage);
    expect(card.hidden).toBe(false);
    const expected = elevatorCardText({
      index: 0,
      isMoving: elevator.isMoving,
      velocityY: elevator.velocityY,
      goingUpIndicator: elevator.goingUpIndicator,
      goingDownIndicator: elevator.goingDownIndicator,
      occupied: 1,
      capacity: elevator.maxUsers,
      pressedFloors: [2],
    });
    expect(requireElement(".building-stage-card-title", card).textContent).toBe(expected.title);
    expect(
      [...requireElement(".building-stage-card-lines", card).children].map((el) => el.textContent),
    ).toEqual(expected.lines);
    expect(carEl.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("hides the elevator's card again on blur", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const stage = fixtureStage(800, 300);
    presentBuildingStage(stage, world);

    const carEl = requireElement(".elevator", stage);
    carEl.focus();
    carEl.blur();

    expect(requireElement(".building-stage-card", stage).hidden).toBe(true);
  });

  it("dismisses an open card on Escape, without moving focus", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const stage = fixtureStage(800, 300);
    presentBuildingStage(stage, world);

    const carEl = requireElement(".elevator", stage);
    carEl.focus();
    carEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(requireElement(".building-stage-card", stage).hidden).toBe(true);
    expect(document.activeElement).toBe(carEl);
  });

  it("only one card is shown at a time: opening a floor's card while a car's is open replaces it", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const stage = fixtureStage(800, 218);
    presentBuildingStage(stage, world);

    const carEl = requireElement(".elevator", stage);
    const floorEl = requireElement(".building-stage-world", stage).querySelectorAll<HTMLElement>(
      ".floor",
    )[0];

    carEl.focus();
    expect(carEl.hasAttribute("aria-describedby")).toBe(true);

    floorEl?.dispatchEvent(new Event("pointerenter"));
    expect(floorEl?.hasAttribute("aria-describedby")).toBe(true);
    expect(carEl.hasAttribute("aria-describedby")).toBe(false);
    const card = requireElement(".building-stage-card", stage);
    expect(card.hidden).toBe(false);
    expect(requireElement(".building-stage-card-title", card).textContent).toBe(
      floorCardText({
        level: 0,
        waitingCount: 0,
        longestWaitSeconds: undefined,
        destinationFloors: [],
      }).title,
    );
  });

  it("creates a passenger view for every new_user and removes it when the passenger is removed", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const stage = fixtureStage(800, 300);
    presentBuildingStage(stage, world);

    const user = new User(60);
    world.trigger("new_user", user);
    expect(requireElement(".building-stage-world", stage).querySelectorAll(".user")).toHaveLength(
      1,
    );

    user.trigger("removed");
    expect(requireElement(".building-stage-world", stage).querySelectorAll(".user")).toHaveLength(
      0,
    );
  });
});
