// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { presentBuildingStage, type BuildingStagePresenter } from "./building-stage.ts";
import { elevatorCardText, floorCardText } from "../lib/hover-card-text.ts";
import { layoutBuilding } from "../lib/layout-building.ts";
import { computeShaftScale, TRAILING_ROOM } from "../lib/shaft-scale.ts";
import { computeVerticalScale } from "../lib/vertical-scale.ts";
import { at } from "#game/test-helpers.ts";
import { createWorld } from "#game/world.ts";
import type { World } from "#game/world.ts";
import { User } from "#game/user.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";

/** A mounted stage, sized by hand, with everything a test reaches for. */
interface Mounted {
  /** The element the widget was mounted into. */
  readonly parent: HTMLElement;
  /** The scrolling stage, whose measurements the geometry was computed from. */
  readonly stage: HTMLElement;
  /** The presenter, for a second geometry pass. */
  readonly presenter: BuildingStagePresenter;
}

/**
 * Mounts the widget and re-runs its geometry against a stage sized by hand.
 *
 * jsdom lays nothing out, so `.stage.clientWidth`/`clientHeight` are 0 while
 * the widget is building itself and the first geometry pass is worth nothing.
 * The size is stubbed onto the stage the widget just created — the box the
 * presenter really measures — and geometry re-run through the same escape hatch
 * a real caller uses outside a resize. The same stubbing `workspace-layout.test.ts`
 * and `editor-size.test.ts` do, one element further in.
 *
 * @param world - The run to draw.
 * @param width - `clientWidth` the stage reports.
 * @param height - `clientHeight` the stage reports.
 * @returns The mount point, the stage, and the presenter.
 */
function mount(world: World, width: number, height: number): Mounted {
  const parent = document.createElement("div");
  // `.focus()`/`.blur()` only fire in jsdom for elements attached to the document.
  document.body.append(parent);

  const presenter = presentBuildingStage(parent, world);
  const stage = requireElement(".stage", parent);
  Object.defineProperty(stage, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(stage, "clientHeight", { value: height, configurable: true });
  presenter.recomputeGeometry();

  return { parent, stage, presenter };
}

/**
 * The layout `presentBuildingStage` itself would have computed for a stage this
 * size.
 *
 * `levelsWidth` is 0 because that is what the presenter measures here too:
 * `.levels` has an 84px rule in the stylesheet, and jsdom applies no
 * stylesheet, so its `offsetWidth` is 0 in both places. A browser feeds the
 * real width through the same call.
 *
 * @param world - The run being drawn.
 * @param stage - The stage, already sized.
 * @returns The layout.
 */
function expectedLayout(world: World, stage: HTMLElement) {
  return layoutBuilding({
    stageHeight: stage.clientHeight,
    stageWidth: stage.clientWidth,
    levelsWidth: 0,
    floorWeights: world.floors.map(() => 1),
    capacities: world.elevators.map((elevator) => elevator.maxUsers),
  });
}

/** The shaft scale `presentBuildingStage` itself would have computed for a stage this size. */
function expectedScaleX(world: World, stage: HTMLElement): number {
  return computeShaftScale({
    stageWidth: stage.clientWidth,
    levelsWidth: 0,
    elevators: world.elevators.map((elevator) => ({
      worldX: elevator.worldX,
      width: elevator.width,
      capacity: elevator.maxUsers,
    })),
  }).scaleX;
}

describe("presentBuildingStage", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("builds the mockup's own stage tree, one row and one band per floor", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 2 });
    const { parent } = mount(world, 800, 400);

    const building = requireElement(".stagewrap .stage .stagerow .building", parent);
    expect(queryAll(".levels .floor", building)).toHaveLength(3);
    expect(queryAll(".tracks .floorlines .floorline", building)).toHaveLength(3);
    expect(queryAll(".tracks .queues .queue", building)).toHaveLength(3);
    expect(queryAll(".tracks .shafts .elevator", building)).toHaveLength(2);
  });

  it("puts the ground floor first in the DOM and lets the column turn itself over", () => {
    // `relabelWorld` in `src/pages/game/index.ts` reads `.floor` elements back
    // in DOM order and takes that order for the floor number, so a column that
    // drew the roof first would rename every floor to somebody else's.
    const world = createWorld({ floorCount: 4, elevatorCount: 1 });
    const { parent } = mount(world, 800, 400);

    const numbers = queryAll(".levels .floor .level-num", parent).map((el) => el.textContent);
    expect(numbers).toEqual(["0", "1", "2", "3"]);
    expect(requireElement(".levels", parent).firstElementChild?.textContent).toContain("0");
  });

  it("sizes every floor row, band and queue strip from layoutBuilding's own geometry", () => {
    // room = max(160, 218-38) = 180; unit = 180/2 = 90, inside [48, 96].
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent, stage } = mount(world, 800, 218);

    const layout = expectedLayout(world, stage);
    expect(layout.floorHeights).toEqual([90, 90]);
    expect(layout.floorBottoms).toEqual([0, 90]);
    expect(layout.totalHeight).toBe(180);

    // A row only ever states its height: the column is a flex stack, so where a
    // floor sits is decided by the floors under it.
    for (const row of queryAll(".levels .floor", parent)) {
      expect(row.style.height).toBe("90px");
      expect(row.style.top).toBe("");
    }

    // The bands beside them are positioned, and they are drawn top-down: the
    // last one in the DOM is the ground floor, at the bottom of the building.
    const lines = queryAll(".floorline", parent);
    expect(lines[0]?.style.top).toBe("0px");
    expect(lines[1]?.style.top).toBe("90px");
    expect(lines[1]?.style.height).toBe("90px");

    // The queue strips are in level order, so the ground floor's is the first.
    const queues = queryAll(".queue", parent);
    expect(queues[0]?.style.top).toBe("90px");
    expect(queues[1]?.style.top).toBe("0px");
  });

  it("makes the corridor as wide as the walk to the first car, and the world one span plus room to leave", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 2 });
    const { parent, stage } = mount(world, 800, 218);

    const scaleX = expectedScaleX(world, stage);
    const first = at(world.elevators, 0);
    const last = at(world.elevators, 1);
    expect(requireElement(".tracks", parent).style.width).toBe(
      `${String(Math.round((last.worldX + last.width) * scaleX) + TRAILING_ROOM)}px`,
    );
    for (const queue of queryAll(".queue", parent)) {
      expect(queue.style.width).toBe(`${String(Math.round(first.worldX * scaleX))}px`);
    }
  });

  it("hands the stylesheet the floor height, the car height and the scale it cannot work out for itself", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent, stage } = mount(world, 800, 218);

    const layout = expectedLayout(world, stage);
    const building = requireElement(".building", parent);
    expect(building.dataset["density"]).toBe(layout.density);
    expect(building.style.getPropertyValue("--ds-floor-h")).toBe(
      `${String(layout.shortestFloor)}px`,
    );
    expect(building.style.getPropertyValue("--ds-car-h")).toBe(`${String(layout.carHeight)}px`);
    expect(building.style.getPropertyValue("--ds-scale-x")).toBe(
      String(expectedScaleX(world, stage)),
    );
  });

  it("sizes every car from the real elevator width and the computed shaft scale", () => {
    // Six 10-capacity cars (100px wide, 20px apart) need more room than a
    // narrow stage has, so the shaft scale clamps down to MIN_SHAFT/100.
    const world = createWorld({ floorCount: 4, elevatorCount: 6, elevatorCapacities: [10] });
    const { parent, stage } = mount(world, 500, 400);

    const layout = expectedLayout(world, stage);
    const scaleX = expectedScaleX(world, stage);
    expect(scaleX).toBeLessThan(1);

    const cars = queryAll(".elevator", parent);
    for (const [index, elevator] of world.elevators.entries()) {
      expect(cars[index]?.style.width).toBe(`${String(elevator.width * scaleX)}px`);
      expect(cars[index]?.style.height).toBe(`${String(layout.carHeight)}px`);
    }
  });

  it("positions elevators and passengers by worldX/worldY times the computed scale", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent, stage } = mount(world, 800, 300);

    const layout = expectedLayout(world, stage);
    const scaleX = expectedScaleX(world, stage);
    const scaleY = computeVerticalScale({
      totalHeight: layout.totalHeight,
      floorCount: world.floors.length,
      floorHeight: world.floorHeight,
    });
    const elevator = at(world.elevators, 0);
    const carEl = requireElement(".elevator", parent);
    expect(carEl.style.transform).toBe(
      `translate3d(${String(elevator.worldX * scaleX)}px, ${String(elevator.worldY * scaleY)}px, 0)`,
    );

    const user = new User(60);
    world.trigger("new_user", user);
    user.moveTo(30, 40);
    user.updateDisplayPosition();
    const userEl = requireElement(".people .user", parent);
    expect(userEl.getAttribute("style")).toContain(
      `translate3d(${String(30 * scaleX)}px, ${String(40 * scaleY)}px, 0)`,
    );
  });

  it("recomputeGeometry re-lays-out floors and cars, and force-redraws movables in place", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent, stage, presenter } = mount(world, 800, 218);
    const elevator = at(world.elevators, 0);
    elevator.moveTo(200, 30);
    elevator.updateDisplayPosition();
    const carEl = requireElement(".elevator", parent);
    const beforeResize = carEl.style.transform;

    // Shrink the stage: room = max(160, 100-38) = 160, so unit = 160/2 = 80,
    // a real change from the 90px unit above — which also changes scaleY,
    // which must show up on the very next paint with no new tick, since the
    // elevator never moved between the two calls.
    Object.defineProperty(stage, "clientHeight", { value: 100, configurable: true });
    presenter.recomputeGeometry();

    expect(queryAll(".levels .floor", parent)[0]?.style.height).toBe("80px");
    expect(carEl.style.transform).not.toBe(beforeResize);
  });

  it("shows a floor's hover card from the corridor its queue stands in, not from its number", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const floor = at(world.floors, 0);
    const user = new User(70);
    user.appearOnFloor(floor, 1);
    world.users.push(user);

    const queueEl = queryAll(".queue", parent)[0];
    const floorEl = queryAll(".levels .floor", parent)[0];
    expect(queueEl).toBeDefined();
    queueEl?.dispatchEvent(new Event("pointerenter"));

    const card = requireElement(".carcard", parent);
    expect(card.hidden).toBe(false);
    const expected = floorCardText({
      level: 0,
      waitingCount: 1,
      longestWaitSeconds: world.elapsedTime - user.spawnTimestamp,
      destinationFloors: [1],
    });
    expect(requireElement(".carcard-title", card).textContent).toBe(expected.title);
    expect(
      [...requireElement(".carcard-lines", card).children].map((el) => el.textContent),
    ).toEqual(expected.lines);
    // The row is what a screen reader reads it from, even though the pointer
    // never went near it: the row is the focusable thing on that floor.
    expect(floorEl?.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("shows the same floor card from the row itself, for a pointer that found the numbers", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const floorEl = queryAll(".levels .floor", parent)[0];
    floorEl?.dispatchEvent(new Event("pointerenter"));

    expect(requireElement(".carcard", parent).hidden).toBe(false);
    expect(floorEl?.getAttribute("aria-describedby")).toBe(requireElement(".carcard", parent).id);
  });

  it("hides the floor's card again on pointerleave", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const queueEl = queryAll(".queue", parent)[0];
    const floorEl = queryAll(".levels .floor", parent)[0];
    queueEl?.dispatchEvent(new Event("pointerenter"));
    queueEl?.dispatchEvent(new Event("pointerleave"));

    const card = requireElement(".carcard", parent);
    expect(card.hidden).toBe(true);
    expect(floorEl?.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows an elevator's hover card on focus, with the live car snapshot", () => {
    const world = createWorld({ floorCount: 4, elevatorCount: 1, elevatorCapacities: [4] });
    const { parent } = mount(world, 800, 300);

    const elevator = at(world.elevators, 0);
    const rider = new User(70);
    at(elevator.userSlots, 0).user = rider;
    elevator.pressFloorButton(2);

    const carEl = requireElement(".elevator", parent);
    carEl.focus();

    const card = requireElement(".carcard", parent);
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
    expect(requireElement(".carcard-title", card).textContent).toBe(expected.title);
    expect(
      [...requireElement(".carcard-lines", card).children].map((el) => el.textContent),
    ).toEqual(expected.lines);
    expect(carEl.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("hides the elevator's card again on blur", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const carEl = requireElement(".elevator", parent);
    carEl.focus();
    carEl.blur();

    expect(requireElement(".carcard", parent).hidden).toBe(true);
  });

  it("dismisses an open card on Escape, without moving focus", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const carEl = requireElement(".elevator", parent);
    carEl.focus();
    carEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(requireElement(".carcard", parent).hidden).toBe(true);
    expect(document.activeElement).toBe(carEl);
  });

  it("only one card is shown at a time: opening a floor's card while a car's is open replaces it", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const carEl = requireElement(".elevator", parent);
    const floorEl = queryAll(".levels .floor", parent)[0];

    carEl.focus();
    expect(carEl.hasAttribute("aria-describedby")).toBe(true);

    floorEl?.dispatchEvent(new Event("pointerenter"));
    expect(floorEl?.hasAttribute("aria-describedby")).toBe(true);
    expect(carEl.hasAttribute("aria-describedby")).toBe(false);
    const card = requireElement(".carcard", parent);
    expect(card.hidden).toBe(false);
    expect(requireElement(".carcard-title", card).textContent).toBe(
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
    const { parent } = mount(world, 800, 300);

    const user = new User(60);
    world.trigger("new_user", user);
    expect(queryAll(".people .user", parent)).toHaveLength(1);

    user.trigger("removed");
    expect(queryAll(".people .user", parent)).toHaveLength(0);
  });
});
