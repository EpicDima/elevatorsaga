// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { presentBuildingStage, type BuildingStagePresenter } from "./building-stage.ts";
import { elevatorCardText, floorCardText } from "../lib/hover-card-text.ts";
import { layoutBuilding } from "../lib/layout-building.ts";
import { computeShaftScale, shaftPadPx, TRAILING_ROOM } from "../lib/shaft-scale.ts";
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
 * Stubs the scroll extents jsdom does not compute, so the stage can be asked
 * what it does in a box the building overflows.
 *
 * `scrollTop` is stubbed as a real accessor rather than a value: the widget
 * both reads it and writes to it, and jsdom's own property is a getter that
 * answers 0 whatever is assigned to it, which would make a scroll the widget
 * performed indistinguishable from one it declined to.
 *
 * @param stage - The stage the widget built, already mounted.
 * @param extents - What the stage should report it has to scroll through.
 */
function stubScroll(
  stage: HTMLElement,
  extents: { scrollHeight?: number; scrollWidth?: number },
): void {
  Object.defineProperty(stage, "scrollHeight", {
    value: extents.scrollHeight ?? 0,
    configurable: true,
  });
  Object.defineProperty(stage, "scrollWidth", {
    value: extents.scrollWidth ?? 0,
    configurable: true,
  });
  let scrollTop = 0;
  Object.defineProperty(stage, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
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
    vi.unstubAllGlobals();
  });

  it("builds the stage tree, one row and one band per floor", () => {
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

  it("marks the floor column of a building whose passengers name where they are going", () => {
    // The column has to be wider there -- a panel of journeys where the others
    // put two call lamps -- and the stylesheet is what widens it. Nothing
    // downstream is told: `recomputeGeometry` measures the column it finds and
    // lays the shafts out beside it.
    const dispatch = createWorld({ floorCount: 3, elevatorCount: 1, destinationDispatch: true });
    const { parent } = mount(dispatch, 800, 400);
    expect(requireElement(".levels", parent).classList.contains("has-destinations")).toBe(true);

    const calls = mount(createWorld({ floorCount: 3, elevatorCount: 1 }), 800, 400);
    expect(requireElement(".levels", calls.parent).classList.contains("has-destinations")).toBe(
      false,
    );
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
    // One pad short of the first car, because that pad is the shaft's own wall
    // and the order marks inside it need the pointer events a queue drawn under
    // it would take.
    for (const queue of queryAll(".queue", parent)) {
      expect(queue.style.width).toBe(
        `${String(Math.round(first.worldX * scaleX) - shaftPadPx(scaleX))}px`,
      );
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

  it("stands every shaft on its own car's real coordinate, one pad wider on each side", () => {
    // Six 10-capacity cars (100px wide, 20px apart) need more room than a
    // narrow stage has, so the shaft scale clamps down to MIN_CAR/100.
    const world = createWorld({ floorCount: 4, elevatorCount: 6, elevatorCapacities: [10] });
    const { parent, stage } = mount(world, 500, 400);

    const scaleX = expectedScaleX(world, stage);
    const padPx = shaftPadPx(scaleX);
    expect(scaleX).toBeLessThan(1);

    const shafts = queryAll(".shafts .elevator", parent);
    for (const [index, elevator] of world.elevators.entries()) {
      const shaft = shafts[index];
      expect(shaft?.style.left).toBe(`${String(Math.round(elevator.worldX * scaleX) - padPx)}px`);
      expect(shaft?.style.width).toBe(
        `${String(Math.round(elevator.width * scaleX) + 2 * padPx)}px`,
      );
      expect(shaft?.style.getPropertyValue("--ds-shaft-pad")).toBe(`${String(padPx)}px`);
    }

    // The shafts still stand apart: the pad comes out of the 20 world units the
    // engine leaves between two cars, and never out of all of them.
    const first = shafts[0];
    const second = shafts[1];
    expect(Number.parseFloat(second?.style.left ?? "0")).toBeGreaterThan(
      Number.parseFloat(first?.style.left ?? "0") + Number.parseFloat(first?.style.width ?? "0"),
    );
  });

  it("centers every order mark on its own floor's band", () => {
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent, stage } = mount(world, 800, 218);

    const layout = expectedLayout(world, stage);
    expect(layout.floorHeights).toEqual([90, 90]);

    const bottoms = queryAll(".shafts .mark", parent).map((mark) => mark.style.bottom);
    expect(bottoms).toEqual(["45px", "135px"]);
  });

  it("positions cars and passengers by worldX/worldY times the computed scale", () => {
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
    // A car only ever moves vertically inside its shaft; the shaft is what
    // carries the horizontal coordinate, as an inline `left` rather than a
    // transform.
    const shaftEl = requireElement(".shafts .elevator", parent);
    const carEl = requireElement(".car", shaftEl);
    expect(shaftEl.style.left).toBe(
      `${String(Math.round(elevator.worldX * scaleX) - shaftPadPx(scaleX))}px`,
    );
    expect(carEl.style.transform).toBe(
      `translate3d(0px, ${String(elevator.worldY * scaleY)}px, 0)`,
    );

    const user = new User(60);
    world.trigger("new_user", user);
    user.moveTo(30, 40);
    user.updateDisplayPosition();
    const userEl = requireElement(".people .person", parent);
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
    const carEl = requireElement(".shafts .elevator .car", parent);
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

  it("marks the floor being pointed at, in the number column and across the building", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const rows = queryAll(".levels .floor", parent);
    const lines = queryAll(".floorlines .floorline", parent);
    const queues = queryAll(".queue", parent);

    queues[0]?.dispatchEvent(new Event("pointerenter"));

    expect(rows[0]?.classList.contains("is-hot")).toBe(true);
    // The bands are in the DOM top floor first, the rows ground floor first, so
    // the lobby's band is the last of the three. Get that backwards and
    // pointing at the lobby lights the roof.
    expect(lines[2]?.classList.contains("is-hot")).toBe(true);
    expect(lines[0]?.classList.contains("is-hot")).toBe(false);

    queues[0]?.dispatchEvent(new Event("pointerleave"));
    expect(queryAll(".is-hot", parent)).toHaveLength(0);

    // The row is the floor's other half, and it marks the same two boxes.
    rows[1]?.dispatchEvent(new Event("pointerenter"));
    expect(rows[1]?.classList.contains("is-hot")).toBe(true);
    expect(lines[1]?.classList.contains("is-hot")).toBe(true);
  });

  it("places a car's card against the cabin, not against the shaft it runs the height of", () => {
    const world = createWorld({ floorCount: 10, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    // jsdom lays nothing out, so the three boxes the placement reads are given
    // the shape a tall building really has: a shaft far longer than the pane it
    // is being looked at through, with the car standing near the foot of it.
    const wrap = requireElement(".stagewrap", parent);
    const shaftEl = requireElement(".elevator", parent);
    const carEl = requireElement(".car", shaftEl);
    wrap.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 800, 300);
    shaftEl.getBoundingClientRect = (): DOMRect => new DOMRect(200, -600, 40, 1000);
    carEl.getBoundingClientRect = (): DOMRect => new DOMRect(200, 250, 40, 40);

    shaftEl.dispatchEvent(new Event("pointerenter"));

    // Centered on the cabin, which is 250..290 of the pane's own 300. Centered on
    // the shaft it would be at -100, and every such card is clamped to the top
    // edge of the pane -- floors away from the car it names, which is what this
    // is here to catch.
    expect(requireElement(".carcard", parent).style.top).toBe("270px");
  });

  it("leaves an open card where the cabin was, rather than towing it along", () => {
    const world = createWorld({ floorCount: 10, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const wrap = requireElement(".stagewrap", parent);
    const shaftEl = requireElement(".elevator", parent);
    const carEl = requireElement(".car", shaftEl);
    wrap.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 800, 300);
    carEl.getBoundingClientRect = (): DOMRect => new DOMRect(200, 250, 40, 40);

    shaftEl.dispatchEvent(new Event("pointerenter"));
    const card = requireElement(".carcard", parent);
    expect(card.style.top).toBe("270px");

    carEl.getBoundingClientRect = (): DOMRect => new DOMRect(200, 100, 40, 40);
    at(world.elevators, 0).updateDisplayPosition(true);

    // A card that rode the cabin would read as a blur on the way up, and its
    // lines are the ones taken when it opened either way.
    expect(card.style.top).toBe("270px");
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

  it("leaves an open card alone on any key but Escape", () => {
    // The arrow keys scroll the stage, which is the whole reason it is a tab
    // stop: reading a car's figures with the keyboard must not dismiss them.
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const carEl = requireElement(".elevator", parent);
    carEl.focus();
    carEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(requireElement(".carcard", parent).hidden).toBe(false);
  });

  it("leaves a floor's pointerleave alone once another card has taken the card over", () => {
    // Pointing at a floor and then at a car hands the one card to the car. The
    // floor's own pointerleave arrives after that, and it has to notice that
    // what it was asked to hide is not what is on screen any more -- otherwise
    // moving the pointer between the two blanks the card that just opened.
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const floorEl = queryAll(".levels .floor", parent)[0];
    const carEl = requireElement(".elevator", parent);

    floorEl?.dispatchEvent(new Event("pointerenter"));
    carEl.focus();
    floorEl?.dispatchEvent(new Event("pointerleave"));

    const card = requireElement(".carcard", parent);
    expect(card.hidden).toBe(false);
    expect(carEl.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("leaves a car's blur alone once another card has taken the card over", () => {
    // The same question from the other side: a car that loses focus after a
    // floor's card has replaced its own must not take the floor's card down
    // with it.
    const world = createWorld({ floorCount: 2, elevatorCount: 1 });
    const { parent } = mount(world, 800, 218);

    const floorEl = queryAll(".levels .floor", parent)[0];
    const carEl = requireElement(".elevator", parent);

    carEl.focus();
    floorEl?.dispatchEvent(new Event("pointerenter"));
    carEl.blur();

    const card = requireElement(".carcard", parent);
    expect(card.hidden).toBe(false);
    expect(floorEl?.getAttribute("aria-describedby")).toBe(card.id);
  });

  it("opens looking at the lobby, and hands the view over once it is there", () => {
    // The building is drawn ground-floor-last in the document, so a stage
    // taller than its box opens looking at the roof. Every geometry pass tries
    // again until it finds the view already at the bottom -- and from that pass
    // on the scroll position is the player's, so a later one must not yank a
    // player who has scrolled up back down to the lobby.
    const world = createWorld({ floorCount: 8, elevatorCount: 1 });
    const { stage, presenter } = mount(world, 800, 218);
    stubScroll(stage, { scrollHeight: 1000 });

    presenter.recomputeGeometry();
    expect(stage.scrollTop).toBe(1000);

    presenter.recomputeGeometry();
    stage.scrollTop = 0;
    presenter.recomputeGeometry();

    expect(stage.scrollTop).toBe(0);
  });

  it("stops reaching for the lobby once its opening frames are spent", () => {
    // The other way out of the opening scroll, for the stage that never gets
    // there: the retry loop runs on animation frames and gives up after a fixed
    // few of them, so a widget cannot still be moving the view once the player
    // has one to look at. Frames are handed over by hand rather than waited
    // for, which is what makes the count exact instead of a matter of how busy
    // the machine is.
    const frames: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void): number => frames.push(callback));

    const world = createWorld({ floorCount: 8, elevatorCount: 1 });
    const { stage, presenter } = mount(world, 800, 218);
    // Deliberately not `stubScroll`: a `scrollTop` that reads back 0 whatever is
    // written to it is the stage this loop exists for, so every retry writes and
    // none of them lands.
    let scrolls = 0;
    Object.defineProperty(stage, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(stage, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: () => {
        scrolls += 1;
      },
    });

    // Bounded, so a loop that never shuts itself fails this test rather than
    // hanging it.
    let runs = 0;
    for (let frame = frames.shift(); frame !== undefined && runs < 10; frame = frames.shift()) {
      frame();
      runs += 1;
    }
    const scrollsWhileSettling = scrolls;

    presenter.recomputeGeometry();

    expect(frames).toHaveLength(0);
    expect(scrollsWhileSettling).toBeGreaterThan(0);
    expect(scrolls).toBe(scrollsWhileSettling);
  });

  it("gives the stage a tab stop exactly while there is somewhere to scroll to", () => {
    // A scrollable region a keyboard cannot reach is WCAG 2.1.1, and so is a
    // tab stop that goes nowhere.
    const world = createWorld({ floorCount: 8, elevatorCount: 1 });
    const { stage, presenter } = mount(world, 800, 218);

    // jsdom reports nothing overflowing until it is told otherwise.
    expect(stage.hasAttribute("tabindex")).toBe(false);

    stubScroll(stage, { scrollHeight: 1000 });
    presenter.recomputeGeometry();

    expect(stage.tabIndex).toBe(0);
  });

  it("gives a wide building a tab stop too, though every floor of it fits on screen", () => {
    // Sideways is a question of its own: a building whose floors all fit
    // vertically can still have a shaft off the right-hand edge.
    const world = createWorld({ floorCount: 3, elevatorCount: 6 });
    const { stage, presenter } = mount(world, 400, 400);
    stubScroll(stage, { scrollWidth: 2000 });

    presenter.recomputeGeometry();

    expect(stage.tabIndex).toBe(0);
  });

  it("shades the edge the building carries on past, at whichever end that is", () => {
    const world = createWorld({ floorCount: 8, elevatorCount: 1 });
    const { parent, stage, presenter } = mount(world, 800, 218);
    const wrap = requireElement(".stagewrap", parent);
    stubScroll(stage, { scrollHeight: 1000 });

    // Down at the lobby the widget opened on: seven floors above, none below.
    presenter.recomputeGeometry();
    expect(wrap.classList.contains("is-cut-top")).toBe(true);
    expect(wrap.classList.contains("is-cut-bottom")).toBe(false);

    // And at the roof, the other way about. Through a scroll event this time,
    // which is the only thing that redraws the shadows while a player scrolls.
    stage.scrollTop = 0;
    stage.dispatchEvent(new Event("scroll"));
    expect(wrap.classList.contains("is-cut-top")).toBe(false);
    expect(wrap.classList.contains("is-cut-bottom")).toBe(true);
  });

  it("creates a passenger view for every new_user and removes it when the passenger is removed", () => {
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const { parent } = mount(world, 800, 300);

    const user = new User(60);
    world.trigger("new_user", user);
    expect(queryAll(".people .person", parent)).toHaveLength(1);

    user.trigger("removed");
    expect(queryAll(".people .person", parent)).toHaveLength(0);
  });

  it("draws the passengers a world already has, not only the ones who arrive after", () => {
    // The case is `src/pages/game/index.ts` drawing the building a crunch has
    // just finished running: every `new_user` of that run was triggered while
    // nothing was mounted to hear it, so a stage that only subscribed would
    // show floors and cars in an empty building.
    const world = createWorld({ floorCount: 3, elevatorCount: 1 });
    const waiting = new User(60);
    const riding = new User(60);
    world.users.push(waiting, riding);

    const { parent } = mount(world, 800, 300);

    expect(queryAll(".people .person", parent)).toHaveLength(2);

    // And they are live views rather than a snapshot: the subscriptions a
    // passenger drawn on arrival gets are the ones these have too.
    waiting.trigger("removed");
    expect(queryAll(".people .person", parent)).toHaveLength(1);
  });
});
