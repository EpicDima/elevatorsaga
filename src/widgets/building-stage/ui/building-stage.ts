/**
 * The building: every floor, car and passenger drawn to the stage's actual
 * size, with hover cards over a floor's queue and an elevator's shaft.
 *
 * Composes `entities/floor`, `entities/elevator` and `entities/passenger`
 * with `layout-building.ts`/`shaft-scale.ts`/`vertical-scale.ts` (the
 * geometry) and `smart-position.ts` (the card placement) and
 * `hover-card-text.ts` (the card's words) — the "DOM-wiring step" those
 * modules' own doc comments once described as not yet ported. Mounted live
 * from `src/app/app.ts` since Phase 12.2, replacing `presentWorld` in
 * `src/ui/presenters.ts`, which is no longer called.
 *
 * ## One shared coordinate space, no separate levels column
 *
 * `entities/elevator` and `entities/passenger` were already built, in an
 * earlier step of this same widget, to read `worldX * scale.scaleX` /
 * `worldY * scale.scaleY` with no additive offset of their own — which
 * settles, by the code that already shipped, a question this module might
 * otherwise have needed to answer: `worldX = 0` is this widget's own left
 * edge, not the shaft area's. So floors, cars and passengers are appended as
 * siblings of one `<div class="building-stage-world">`, the same way
 * `presentWorld` appends them as siblings of one `.innerworld` — and this
 * module never builds the mockup's separate floor-number column
 * `layoutBuilding()`'s `levelsWidth` describes. `entities/floor`'s own
 * `.floor` bar already carries the floor number and the call buttons in one
 * full-width box (ported from the legacy renderer, not the mockup), so
 * `levelsWidth: 0` is passed to `layoutBuilding()`/`computeShaftScale()`
 * everywhere in this module — the same "unmeasured" value their own doc
 * comments say falls back to the mockup's default of 84, except here it
 * genuinely is 0: there is nothing of the mockup's to measure.
 *
 * ## Geometry recompute
 *
 * `recomputeGeometry` reads `parent.clientWidth`/`clientHeight` — "the
 * stage" `layout-building.ts`'s and `shaft-scale.ts`'s own doc comments
 * already name — lays out every floor and car, and writes the resulting
 * scale into one mutable `StageScale` cell shared by reference with every
 * entity view. Floors and cars are repositioned/resized directly through
 * their own `setGeometry`; cars and passengers pick the new scale up on
 * their *own* next `new_display_state`, which this function forces
 * immediately via `updateDisplayPosition(true)` rather than waiting for the
 * simulation's next tick — otherwise a resize while the game is paused, or
 * between two ticks, would leave every car and passenger at its old pixel
 * position until something next moved.
 *
 * Called once at mount, and from a `ResizeObserver` on `parent` in a real
 * browser. `ResizeObserver` does not exist in the jsdom this module's own
 * tests run under, so it is only ever constructed when the global exists —
 * tests drive geometry entirely through the returned
 * {@link BuildingStagePresenter.recomputeGeometry}, the same escape hatch a
 * real caller would use to force a recompute outside a resize (a language
 * change that alters `--floor-height`'s cousins, say).
 *
 * ## Hover cards
 *
 * A card's text is computed once, when it is shown — not kept fresh while
 * it stays open — the same trade `goal-bar.ts`'s `drawTierRows` already
 * makes for its own popover ("costs nothing while closed, guaranteed fresh
 * the instant it opens"). A card left open over an elevator that boards
 * someone a few seconds later is already showing a stale number the moment
 * anything else on the page next repaints; refreshing it continuously would
 * be a second render loop for a box nobody complained was stale.
 *
 * One card element is shared between every floor and every car, shown and
 * repositioned on `pointerenter`/`focus` and hidden on `pointerleave`/`blur`
 * — `pointerenter`/`pointerleave` do not bubble, so each floor and car
 * element carries its own pair, but `Escape` is handled once, delegated on
 * the world element, since `keydown` does bubble from whichever element is
 * focused. Dismissing on `Escape` without moving focus is the WAI-ARIA
 * tooltip pattern's own contract (WCAG 1.4.13): the card closes, the floor
 * or car underneath it stays exactly as focused as it was.
 */

import {
  elevatorCardText,
  floorCardText,
  type ElevatorCardSnapshot,
  type FloorCardSnapshot,
  type HoverCardText,
} from "../lib/hover-card-text.ts";
import { computeShaftScale, type ShaftScaleElevator } from "../lib/shaft-scale.ts";
import { computeVerticalScale } from "../lib/vertical-scale.ts";
import { layoutBuilding } from "../lib/layout-building.ts";
import { createElevatorView, type ElevatorView } from "#entities/elevator/index.ts";
import { createFloorView, type FloorView } from "#entities/floor/index.ts";
import { createPassengerView } from "#entities/passenger/index.ts";
import type { Elevator } from "#game/elevator.ts";
import type { Floor } from "#game/floor.ts";
import type { World } from "#game/world.ts";
import { positionAboveAnchor, positionBesideAnchor } from "#shared/lib/smart-position.ts";
import { requireElement, setClass } from "#shared/lib/dom.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";

import { markup } from "../../../ui/templates.ts";

/** Builds the stage's static skeleton: the world layer and the one shared hover card. */
export function buildingStageTemplate(): string {
  return markup`<div class="building-stage-world"></div><div class="building-stage-card" role="tooltip" hidden><div class="building-stage-card-title"></div><div class="building-stage-card-lines"></div></div>`;
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

/**
 * Builds and drives the building stage.
 *
 * @param parent - The stage: the element the widget's markup is written
 * into, and whose `clientWidth`/`clientHeight` every geometry pass measures.
 * @param world - The run being drawn.
 * @returns The presenter, already built, drawn once, and observing `parent`
 * for resizes when `ResizeObserver` exists.
 */
export function presentBuildingStage(parent: HTMLElement, world: World): BuildingStagePresenter {
  parent.innerHTML = buildingStageTemplate();
  const worldEl = requireElement(".building-stage-world", parent);
  const card = requireElement(".building-stage-card", parent);
  const cardTitle = requireElement(".building-stage-card-title", card);
  const cardLines = requireElement(".building-stage-card-lines", card);

  worldEl.style.position = "relative";
  card.style.position = "absolute";
  card.id = `building-stage-card-${String(nextCardId)}`;
  nextCardId += 1;

  const scale: StageScale = { scaleX: 1, scaleY: 1 };

  /** Which anchor the card is currently shown for, or `null` while hidden. */
  let shownFor: HTMLElement | null = null;

  function hideCard(): void {
    if (shownFor === null) {
      return;
    }
    shownFor.removeAttribute("aria-describedby");
    shownFor = null;
    card.hidden = true;
  }

  /**
   * Shows the card beside/above `anchor`, per `placement`, filled with `text`.
   *
   * @param anchor - The floor or car the card explains.
   * @param placement - `"beside"` for a car's shaft, `"above"` for a floor's queue.
   * @param text - The card's title and body lines.
   */
  function showCard(anchor: HTMLElement, placement: "beside" | "above", text: HoverCardText): void {
    if (shownFor !== null && shownFor !== anchor) {
      shownFor.removeAttribute("aria-describedby");
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

    const wrap = worldEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const position =
      placement === "beside"
        ? positionBesideAnchor(anchorRect, wrap, cardWidth, cardHeight)
        : positionAboveAnchor(anchorRect, wrap, cardWidth, cardHeight);
    card.style.left = `${String(position.x)}px`;
    card.style.top = `${String(position.y)}px`;

    anchor.setAttribute("aria-describedby", card.id);
    shownFor = anchor;
  }

  worldEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCard();
    }
  });

  const floorViews: FloorView[] = [];
  for (const floor of world.floors) {
    const view = createFloorView(floor);
    view.element.tabIndex = 0;
    const show = (): void => {
      showCard(view.element, "above", floorCardText(floorSnapshot(world, floor)));
    };
    const hide = (): void => {
      if (shownFor === view.element) {
        hideCard();
      }
    };
    view.element.addEventListener("pointerenter", show);
    view.element.addEventListener("pointerleave", hide);
    view.element.addEventListener("focus", show);
    view.element.addEventListener("blur", hide);
    worldEl.append(view.element);
    floorViews.push(view);
  }

  const elevatorViews: ElevatorView[] = [];
  for (const [index, elevator] of world.elevators.entries()) {
    const view = createElevatorView(elevator, index, scale);
    view.element.tabIndex = 0;
    const show = (): void => {
      showCard(view.element, "beside", elevatorCardText(elevatorSnapshot(elevator, index)));
    };
    const hide = (): void => {
      if (shownFor === view.element) {
        hideCard();
      }
    };
    view.element.addEventListener("pointerenter", show);
    view.element.addEventListener("pointerleave", hide);
    view.element.addEventListener("focus", show);
    view.element.addEventListener("blur", hide);
    worldEl.append(view.element);
    elevatorViews.push(view);
  }

  world.on("new_user", (user) => {
    const view = createPassengerView(user, scale);
    worldEl.append(view.element);
  });

  /**
   * Re-lays-out the building for the stage's current size.
   *
   * @see {@link BuildingStagePresenter.recomputeGeometry}
   */
  function recomputeGeometry(): void {
    const stageWidth = parent.clientWidth;
    const stageHeight = parent.clientHeight;

    const layout = layoutBuilding({
      stageHeight,
      stageWidth,
      levelsWidth: 0,
      floorWeights: world.floors.map(() => 1),
      capacities: world.elevators.map((elevator) => elevator.maxUsers),
    });

    worldEl.style.height = `${String(layout.totalHeight)}px`;

    for (const [index] of world.floors.entries()) {
      const view = floorViews[index];
      const heightPx = layout.floorHeights[index];
      const bottomPx = layout.floorBottoms[index];
      if (view === undefined || heightPx === undefined || bottomPx === undefined) {
        continue;
      }
      view.setGeometry(layout.totalHeight - bottomPx - heightPx, heightPx);
    }

    const shaftElevators: ShaftScaleElevator[] = world.elevators.map((elevator) => ({
      worldX: elevator.worldX,
      width: elevator.width,
      capacity: elevator.maxUsers,
    }));
    const { scaleX, counted } = computeShaftScale({
      stageWidth,
      levelsWidth: 0,
      carHeight: layout.carHeight,
      elevators: shaftElevators,
    });
    scale.scaleX = scaleX;
    scale.scaleY = computeVerticalScale({
      totalHeight: layout.totalHeight,
      floorCount: world.floors.length,
      floorHeight: world.floorHeight,
    });

    for (const [index, elevator] of world.elevators.entries()) {
      const view = elevatorViews[index];
      if (view === undefined) {
        continue;
      }
      view.setGeometry(elevator.width * scale.scaleX, layout.carHeight);
      setClass(view.element, "is-counted", counted[index] ?? false);
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
  }

  recomputeGeometry();

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      recomputeGeometry();
    });
    observer.observe(parent);
  }

  return { recomputeGeometry };
}
