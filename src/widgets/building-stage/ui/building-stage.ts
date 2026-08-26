/**
 * The building: the floor-number column, the shafts, and the stage they stand
 * on, drawn and geometry-fitted at whatever size the pane gives them, with a
 * shared hover card for floors and cars.
 */

import {
  elevatorCardText,
  floorCardText,
  type ElevatorCardSnapshot,
  type FloorCardSnapshot,
  type HoverCardText,
} from "../lib/hover-card-text.ts";
import {
  computeShaftScale,
  shaftPadPx,
  TRAILING_ROOM,
  type ShaftScaleElevator,
} from "../lib/shaft-scale.ts";
import { computeVerticalScale } from "../lib/vertical-scale.ts";
import { layoutBuilding } from "../lib/layout-building.ts";
import { createElevatorView, type ElevatorView } from "#entities/elevator/index.ts";
import { createFloorView, type FloorView } from "#entities/floor/index.ts";
import { createPassengerView } from "#entities/passenger/index.ts";
import type { Elevator } from "#game/elevator.ts";
import type { Floor } from "#game/floor.ts";
import type { User } from "#game/user.ts";
import type { World } from "#game/world.ts";
import { positionAboveAnchor, positionBesideAnchor } from "#shared/lib/smart-position.ts";
import { requireElement, setClass } from "#shared/lib/dom.ts";
import { unscaled, worldXToPx, type StageScale } from "#shared/lib/stage-scale.ts";
import { markup } from "#shared/ui/markup.ts";

/** Builds the stage's static skeleton: the building tree, and the one shared hover card. */
export function buildingStageTemplate(): string {
  return markup`<div class="stagewrap"><div class="stage"><div class="stagerow"><div class="building"><div class="levels"></div><div class="tracks"><div class="floorlines"></div><div class="queues"></div><div class="shafts"></div><div class="people"></div></div></div></div></div><div class="carcard" role="tooltip" hidden><b class="carcard-title"></b><div class="carcard-lines"></div></div></div>`;
}

/** What a mounted building stage hands back for a caller to drive geometry from outside a resize. */
export interface BuildingStagePresenter {
  /**
   * Re-lays-out every floor and car for the stage's current size, and
   * force-redraws every car and passenger at the new scale.
   */
  recomputeGeometry(): void;
}

/** Counter for {@link BuildingStagePresenter}'s shared hover card id, unique per mounted stage. */
let nextCardId = 0;

/**
 * Frames after mount the stage may still auto-scroll to the lobby, to outlast
 * `src/main.ts`'s synchronous reparenting of `.world`, which resets the scroll.
 */
const GROUND_SETTLE_FRAMES = 3;

/** A floor's live waiting-passenger snapshot, read fresh when its card is shown. */
function floorSnapshot(world: World, floor: Floor): FloorCardSnapshot {
  const waiting = world.users.filter(
    (user) => user.parent === null && !user.done && user.currentFloor === floor.level,
  );
  const longestWaitSeconds =
    waiting.length === 0
      ? undefined
      : world.elapsedTime - Math.min(...waiting.map((user) => user.spawnTimestamp));
  const destinationFloors = [...new Set(waiting.map((user) => user.destinationFloor))].sort(
    (a, b) => a - b,
  );
  return {
    level: floor.level,
    waitingCount: waiting.length,
    longestWaitSeconds,
    destinationFloors,
  };
}

/** An elevator's live snapshot, read fresh when its card is shown. */
function elevatorSnapshot(elevator: Elevator, index: number): ElevatorCardSnapshot {
  return {
    index,
    isMoving: elevator.isMoving,
    velocityY: elevator.velocityY,
    goingUpIndicator: elevator.goingUpIndicator,
    goingDownIndicator: elevator.goingDownIndicator,
    occupied: elevator.userSlots.filter((slot) => slot.user !== null).length,
    capacity: elevator.maxUsers,
    pressedFloors: elevator.buttonStates.flatMap((pressed, floor) => (pressed ? [floor] : [])),
  };
}

/** Which element a shown hover card is pointing at, and how. */
interface ShownCard {
  /** The element that owns the card for assistive technology — the focusable floor row or shaft. */
  readonly describedBy: HTMLElement;
  /** The element the card is placed against, which is not always the one above. */
  readonly anchor: HTMLElement;
  /** `"beside"` for a car's shaft, `"above"` for a floor's queue. */
  readonly placement: "beside" | "above";
}

/** Builds and drives the building stage, observing `parent` for resizes when `ResizeObserver` exists. */
export function presentBuildingStage(parent: HTMLElement, world: World): BuildingStagePresenter {
  parent.innerHTML = buildingStageTemplate();
  const stageWrap = requireElement(".stagewrap", parent);
  const stage = requireElement(".stage", stageWrap);
  const building = requireElement(".building", stage);
  const levels = requireElement(".levels", building);
  const tracks = requireElement(".tracks", building);
  const floorlines = requireElement(".floorlines", tracks);
  const queueLayer = requireElement(".queues", tracks);
  const shafts = requireElement(".shafts", tracks);
  const people = requireElement(".people", tracks);
  const card = requireElement(".carcard", stageWrap);
  const cardTitle = requireElement(".carcard-title", card);
  const cardLines = requireElement(".carcard-lines", card);

  card.id = `building-stage-card-${String(nextCardId)}`;
  nextCardId += 1;

  const scale: StageScale = unscaled();

  /** Which anchor the card is currently shown for, or `null` while hidden. */
  let shown: ShownCard | null = null;

  /**
   * Dismisses the card on Escape (WCAG 1.4.13), bound on the document since a
   * hover-opened card leaves focus wherever it already was. Bound only while a
   * card is up, and unbound with it, since this widget rebuilds on every redraw.
   */
  function dismissOnEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      hideCard();
    }
  }

  function hideCard(): void {
    if (shown === null) {
      return;
    }
    card.ownerDocument.removeEventListener("keydown", dismissOnEscape);
    shown.describedBy.removeAttribute("aria-describedby");
    shown = null;
    card.hidden = true;
  }

  /** Puts the shown card back where its anchor is now — on opening, and after a scroll. */
  function placeCard(): void {
    if (shown === null) {
      return;
    }
    const wrap = stageWrap.getBoundingClientRect();
    const anchorRect = shown.anchor.getBoundingClientRect();
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const position =
      shown.placement === "beside"
        ? positionBesideAnchor(anchorRect, wrap, cardWidth, cardHeight)
        : positionAboveAnchor(anchorRect, wrap, cardWidth, cardHeight);
    card.style.left = `${String(position.x)}px`;
    card.style.top = `${String(position.y)}px`;
  }

  /**
   * Shows the card for `target`, placed against `anchor`, filled with `text`.
   * The two elements differ for a floor: the row owns the card for assistive
   * technology, but the card is placed against the queue's own strip of corridor.
   */
  function showCard(
    target: HTMLElement,
    anchor: HTMLElement,
    placement: "beside" | "above",
    text: HoverCardText,
  ): void {
    if (shown !== null && shown.describedBy !== target) {
      shown.describedBy.removeAttribute("aria-describedby");
    }
    cardTitle.textContent = text.title;
    cardLines.replaceChildren(
      ...text.lines.map((line) => {
        const lineEl = document.createElement("div");
        lineEl.textContent = line;
        return lineEl;
      }),
    );
    card.hidden = false;
    target.setAttribute("aria-describedby", card.id);
    shown = { describedBy: target, anchor, placement };
    // Same callback and phase, so re-adding for a new anchor doesn't double-bind.
    card.ownerDocument.addEventListener("keydown", dismissOnEscape);
    placeCard();
  }

  /**
   * Lights the stage's edge shadows and makes it keyboard-scrollable (WCAG
   * 2.1.1) exactly while there's something to scroll to — a tab stop that
   * goes nowhere is also a violation.
   */
  function updateStageEdges(): void {
    const room = stage.scrollHeight - stage.clientHeight;
    setClass(stageWrap, "is-cut-top", stage.scrollTop > 4);
    setClass(stageWrap, "is-cut-bottom", room > 4 && stage.scrollTop < room - 4);
    // Horizontal overflow also needs a tab stop; the shadows above shade vertical only.
    const roomX = stage.scrollWidth - stage.clientWidth;
    if (room > 4 || roomX > 4) {
      stage.tabIndex = 0;
    } else {
      stage.removeAttribute("tabindex");
    }
  }

  /** Whether the stage is scrolled to the bottom, within a pixel of rounding. */
  function isAtGround(): boolean {
    return stage.scrollTop >= stage.scrollHeight - stage.clientHeight - 1;
  }

  /** Whether the opening auto-scroll to the lobby has landed, or its window has closed. */
  let groundShown = false;

  /**
   * Whether the view is parked at the lobby as of the last geometry pass or
   * scroll. Re-pinned to the ground at the end of each pass while this holds,
   * so a resize doesn't leave the view stranded mid-building.
   */
  let atGround = true;

  stage.addEventListener("scroll", () => {
    atGround = isAtGround();
    updateStageEdges();
    placeCard();
  });

  /**
   * Scrolls the stage down to the lobby, retried on every geometry pass until
   * one lands: `src/main.ts` reparents `.world` into the workspace shell after
   * mount, which resets the scroll a frame after this first runs.
   */
  function showGround(): void {
    if (groundShown) {
      return;
    }
    const room = stage.scrollHeight - stage.clientHeight;
    if (room <= 0) {
      return;
    }
    if (stage.scrollTop >= room) {
      groundShown = true;
      return;
    }
    stage.scrollTop = stage.scrollHeight;
  }

  // Appended top-down for the stylesheet's `:nth-child(odd)` zebra; the array
  // itself stays in level order.
  const floorlineEls: HTMLElement[] = new Array<HTMLElement>(world.floors.length);
  for (let row = 0; row < world.floors.length; row += 1) {
    const line = document.createElement("i");
    line.className = "floorline";
    floorlines.append(line);
    floorlineEls[world.floors.length - 1 - row] = line;
  }

  // A destination-dispatch building needs a wider floor-number column for the
  // journey panel; recomputeGeometry measures levels.offsetWidth accordingly.
  setClass(
    levels,
    "has-destinations",
    world.floors.some((floor) => floor.destinationDispatch),
  );

  // Appended level 0 first; `relabelWorld` in `src/pages/game/index.ts` reads
  // DOM order back as floor number. CSS reverses the column visually.
  const floorViews: FloorView[] = [];
  const queueEls: HTMLElement[] = [];
  for (const floor of world.floors) {
    const view = createFloorView(floor, world.floors.length);
    view.element.tabIndex = 0;
    const queue = document.createElement("div");
    queue.className = "queue";
    // Row and floor band are separate elements that never touch, so both are lit together here.
    const light = (lit: boolean): void => {
      setClass(view.element, "is-hot", lit);
      const line = floorlineEls[floor.level];
      if (line !== undefined) {
        setClass(line, "is-hot", lit);
      }
    };
    const show = (anchor: HTMLElement, placement: "beside" | "above"): void => {
      light(true);
      showCard(view.element, anchor, placement, floorCardText(floorSnapshot(world, floor)));
    };
    const hide = (): void => {
      light(false);
      if (shown?.describedBy === view.element) {
        hideCard();
      }
    };
    const showAtRow = (): void => {
      show(view.element, "beside");
    };
    view.element.addEventListener("focus", showAtRow);
    view.element.addEventListener("blur", hide);
    queue.addEventListener("pointerenter", () => {
      show(queue, "above");
    });
    queue.addEventListener("pointerleave", hide);
    view.element.addEventListener("pointerenter", showAtRow);
    view.element.addEventListener("pointerleave", hide);
    levels.append(view.element);
    queueLayer.append(queue);
    floorViews.push(view);
    queueEls.push(queue);
  }

  const elevatorViews: ElevatorView[] = [];
  for (const [index, elevator] of world.elevators.entries()) {
    const view = createElevatorView(elevator, index, scale);
    view.element.tabIndex = 0;
    // Placed against the cabin, not the (building-height) shaft, but the
    // card's position is a snapshot: it doesn't follow the car afterward.
    const car = requireElement(".car", view.element);
    const show = (): void => {
      showCard(view.element, car, "beside", elevatorCardText(elevatorSnapshot(elevator, index)));
    };
    const hide = (): void => {
      if (shown?.describedBy === view.element) {
        hideCard();
      }
    };
    view.element.addEventListener("pointerenter", show);
    view.element.addEventListener("pointerleave", hide);
    view.element.addEventListener("focus", show);
    view.element.addEventListener("blur", hide);
    shafts.append(view.element);
    elevatorViews.push(view);
  }

  function addPassenger(user: User): void {
    const view = createPassengerView(user, scale);
    people.append(view.element);
  }

  // Draws everyone already in the building (needed when mounting a world a
  // headless crunch already ran) before subscribing for arrivals.
  for (const user of world.users) {
    addPassenger(user);
  }
  world.on("new_user", addPassenger);

  /** Re-lays-out the building for the stage's current size. */
  function recomputeGeometry(): void {
    const stageWidth = stage.clientWidth;
    const levelsWidth = levels.offsetWidth;

    const layout = layoutBuilding({ floorCount: world.floors.length });
    const heightPx = layout.floorHeight;

    // Read by CSS for floor-number size, rider figures and the cabin;
    // `data-density` covers what can't simply scale.
    building.dataset["density"] = layout.density;
    building.style.setProperty("--ds-floor-h", `${String(heightPx)}px`);
    building.style.setProperty("--ds-car-h", `${String(layout.carHeight)}px`);

    for (const [level, view] of floorViews.entries()) {
      view.setGeometry(heightPx);
      const topPx = layout.totalHeight - (level + 1) * heightPx;
      const line = floorlineEls[level];
      if (line !== undefined) {
        line.style.top = `${String(topPx)}px`;
        line.style.height = `${String(heightPx)}px`;
      }
      const queue = queueEls[level];
      if (queue !== undefined) {
        queue.style.top = `${String(topPx)}px`;
        queue.style.height = `${String(heightPx)}px`;
      }
    }

    const shaftElevators: ShaftScaleElevator[] = world.elevators.map((elevator) => ({
      worldX: elevator.worldX,
      width: elevator.width,
      capacity: elevator.maxUsers,
    }));
    const { scaleX, corridorPx, corridorWorld } = computeShaftScale({
      stageWidth,
      levelsWidth,
      elevators: shaftElevators,
    });
    scale.scaleX = scaleX;
    scale.corridorPx = corridorPx;
    scale.corridorWorld = corridorWorld;
    scale.scaleY = computeVerticalScale({
      totalHeight: layout.totalHeight,
      floorCount: world.floors.length,
      floorHeight: world.floorHeight,
    });
    // Read by the rider figures, one seat (10 world units) wide, to convert to pixels.
    building.style.setProperty("--ds-scale-x", String(scaleX));

    // Each shaft is its car's box grown by one pad per side; CSS subtracts the
    // pad back out so the car lands exactly on `round(worldX * scaleX)`.
    const padPx = shaftPadPx(scaleX);
    // Middle of each floor's band; the mark centers itself here with a half-height transform.
    const markBottomsPx = world.floors.map((_, level) => (level + 0.5) * heightPx);
    for (const [index, elevator] of world.elevators.entries()) {
      const view = elevatorViews[index];
      if (view === undefined) {
        continue;
      }
      view.setGeometry({
        leftPx: Math.round(worldXToPx(scale, elevator.worldX)) - padPx,
        widthPx: Math.round(elevator.width * scaleX) + 2 * padPx,
        padPx,
        markBottomsPx,
      });
    }

    // Queue stops one pad short of the first car; that pad is the shaft's wall
    // and would otherwise steal the queue's pointer events.
    const lastElevator = shaftElevators.at(-1);
    const worldSpan = lastElevator === undefined ? 0 : lastElevator.worldX + lastElevator.width;
    const queueWidthPx = Math.max(0, Math.round(corridorPx) - padPx);
    tracks.style.width = `${String(Math.round(worldXToPx(scale, worldSpan)) + TRAILING_ROOM)}px`;
    for (const queue of queueEls) {
      queue.style.width = `${String(queueWidthPx)}px`;
    }

    for (const elevator of world.elevators) {
      elevator.updateDisplayPosition(true);
    }
    for (const user of world.users) {
      user.updateDisplayPosition(true);
    }

    // A card open on a floor or car this pass just moved would otherwise be
    // pointing at last frame's position until the next hover.
    hideCard();
    showGround();
    if (atGround) {
      stage.scrollTop = stage.scrollHeight;
    }
    // Read back rather than assumed: shrinking to fit can land the view at the
    // bottom without anyone scrolling.
    atGround = isAtGround();
    updateStageEdges();
  }

  recomputeGeometry();

  // Retries showGround for a few frames regardless of resizes, to outlast the
  // shell's post-mount reparenting of `.world`.
  if (typeof requestAnimationFrame === "function") {
    let framesLeft = GROUND_SETTLE_FRAMES;
    const settleGround = (): void => {
      showGround();
      framesLeft -= 1;
      if (framesLeft <= 0) {
        groundShown = true;
        return;
      }
      requestAnimationFrame(settleGround);
    };
    requestAnimationFrame(settleGround);
  } else {
    // No frames to wait for — jsdom, and any other caller without a compositor.
    groundShown = true;
  }

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      recomputeGeometry();
    });
    observer.observe(parent);
  }

  return { recomputeGeometry };
}
