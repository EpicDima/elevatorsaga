/**
 * The building: the floor-number column, the shafts, and the stage they stand
 * on, drawn at whatever size the pane gives them.
 *
 * Composes `entities/floor`, `entities/elevator` and `entities/passenger`
 * with `layout-building.ts`/`shaft-scale.ts`/`vertical-scale.ts` (the
 * geometry) and `smart-position.ts` (the card placement) and
 * `hover-card-text.ts` (the card's words). Mounted live from
 * `src/pages/game/index.ts` since Phase 12.2, replacing `presentWorld` in what
 * was `src/ui/presenters.ts`, which is no longer called.
 *
 * ## The mockup's own tree, inside the page's existing wrappers
 *
 * `design/ui-mockup.html` (§"Здание") builds
 * `.stagewrap > .stage > .stagerow > .building > (.levels, .tracks)`, and that
 * whole subtree is built here, inside the element the page hands this widget.
 * The three wrappers around it — `.world`, `.worldtrack`, `.innerworld` — are
 * `index.html`'s, not this widget's, and this widget cannot edit that file;
 * `style.css` makes them layout-neutral instead (a flex chain that passes the
 * pane's height straight through), so a later cleanup can delete them without
 * anything here changing. Two things are still needed from them, and are the
 * reason they are neutralised rather than ignored: `.worldtrack` is what holds
 * the run verdict's oversized overlay and the statistics panel — both siblings
 * of this widget's mount point, both owned elsewhere — and `.world` carries
 * the region role, the name and the paler focus ring every control inside the
 * building inherits.
 *
 * An earlier revision of this module deliberately built no floor-number
 * column: the legacy `.floor` was a full-width band carrying its own number,
 * so `levelsWidth: 0` went to `layoutBuilding()` and the whole building lived
 * in one coordinate space. That is reversed. The column is the mockup's, the
 * width fed to the geometry is `.levels`'s measured `offsetWidth`, and the
 * shafts live in `.tracks` beside it — which is also the coordinate space
 * every car and passenger is positioned in, since `worldX = 0` is the
 * corridor's left edge and the column is not part of the world the simulation
 * moves things through.
 *
 * ## Where the mockup's flexbox had to become arithmetic
 *
 * The mockup lays its shafts out with `display: flex` and a gap, because its
 * building is a drawing. Here the shafts have to land on the coordinates the
 * simulation actually uses: a passenger spawns at `x = 105..145`, walks to
 * `elevator.worldX`, and rides in a seat at `worldX + 2 + 10 * slot`. So
 * `.shafts` is a positioned layer and each `.shaft` is placed at its own
 * elevator's real `worldX * scaleX`, wide enough for its real `width * scaleX`
 * — the mockup's own capacity-driven `shaftWidths` are left unread for the
 * reason `shaft-scale.ts`'s comment gives. The 20 world units the engine
 * leaves between two cars are what draw the gap the mockup gets from `gap`.
 *
 * ## Geometry recompute
 *
 * `recomputeGeometry` measures the stage — `.stage`'s own `clientWidth` /
 * `clientHeight`, the box that scrolls, not the pane around it, so a scrollbar
 * is subtracted from the width the building is fitted into — lays out every
 * floor, shaft and car, and writes the resulting scale into one mutable
 * {@link StageScale} cell shared by reference with every entity view. Floors
 * and cars are resized directly through their own `setGeometry`; cars and
 * passengers pick the new scale up on their *own* next `new_display_state`,
 * which this function forces immediately via `updateDisplayPosition(true)`
 * rather than waiting for the simulation's next tick — otherwise a resize
 * while the game is paused, or between two ticks, would leave every car and
 * passenger at its old pixel position until something next moved.
 *
 * Called once at mount, and from a `ResizeObserver` on the mount point in a
 * real browser. `ResizeObserver` does not exist in the jsdom this module's own
 * tests run under, so it is only ever constructed when the global exists —
 * tests drive geometry entirely through the returned
 * {@link BuildingStagePresenter.recomputeGeometry}, the same escape hatch a
 * real caller would use to force a recompute outside a resize.
 *
 * ## Hover cards
 *
 * A card's text is computed once, when it is shown — not kept fresh while
 * it stays open — the same trade `goal-bar.ts`'s `drawTierRows` already
 * makes for its own popover ("costs nothing while closed, guaranteed fresh
 * the instant it opens"). Its *position* is recomputed on every scroll,
 * because the stage under it moves.
 *
 * One card element is shared between every floor and every car, shown and
 * repositioned on `pointerenter`/`focus` and hidden on `pointerleave`/`blur`
 * — `pointerenter`/`pointerleave` do not bubble, so each anchor carries its
 * own pair, but `Escape` is handled once, delegated on the stage, since
 * `keydown` does bubble from whichever element is focused. Dismissing on
 * `Escape` without moving focus is the WAI-ARIA tooltip pattern's own contract
 * (WCAG 1.4.13): the card closes, the floor or car underneath it stays exactly
 * as focused as it was.
 *
 * The card hangs on `.stagewrap`, outside the scrolling `.stage` and outside
 * `.building` — the mockup puts it there for a reason its own comment spells
 * out: the building clips its own overflow (otherwise cars would draw through
 * its rounded corners), so a card parented anywhere inside it would be cut off
 * at the very edge it is trying to point at.
 */

import {
  elevatorCardText,
  floorCardText,
  type ElevatorCardSnapshot,
  type FloorCardSnapshot,
  type HoverCardText,
} from "../lib/hover-card-text.ts";
import { computeShaftScale, TRAILING_ROOM, type ShaftScaleElevator } from "../lib/shaft-scale.ts";
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
import { markup } from "#shared/ui/markup.ts";

/** Builds the stage's static skeleton: the mockup's own building tree, and the one shared hover card. */
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
 * How many animation frames after mount the stage may still scroll itself to the
 * lobby — see the retry loop at the end of {@link presentBuildingStage}.
 *
 * Three, because the one thing being waited out is a single reparenting that
 * `src/main.ts` performs synchronously during the page's own bootstrap: one
 * frame is what it actually takes, and the other two are for a browser that
 * splits the work differently. Long enough to be robust, short enough that a
 * player cannot have scrolled anywhere by hand yet.
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

/**
 * Builds and drives the building stage.
 *
 * @param parent - The element the widget's markup is written into.
 * @param world - The run being drawn.
 * @returns The presenter, already built, drawn once, and observing `parent`
 * for resizes when `ResizeObserver` exists.
 */
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

  const scale: StageScale = { scaleX: 1, scaleY: 1 };

  /** Which anchor the card is currently shown for, or `null` while hidden. */
  let shown: ShownCard | null = null;

  function hideCard(): void {
    if (shown === null) {
      return;
    }
    shown.describedBy.removeAttribute("aria-describedby");
    shown = null;
    card.hidden = true;
  }

  /** Puts the shown card back where its anchor is now — after a scroll, or a tick that moved a car. */
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
   *
   * The two elements are not always the same one: a floor's card is owned by
   * the floor's own row, which is where the keyboard reaches it and where a
   * screen reader reads it from, but it is *placed* against the strip of
   * corridor that floor's passengers stand in — the row itself is a narrow box
   * off in the floor-number column, and a card pinned to it would point at the
   * numbers rather than at the queue it describes.
   *
   * @param target - The element that owns the card for assistive technology.
   * @param anchor - The element the card is positioned against.
   * @param placement - `"beside"` for a car's shaft, `"above"` for a floor's queue.
   * @param text - The card's title and body lines.
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
    placeCard();
  }

  stage.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCard();
    }
  });

  /**
   * Lights the stage's own edge shadows, and makes the stage keyboard-scrollable
   * exactly while there is something to scroll to.
   *
   * The mockup's `updateStageEdges()`, plus the `tabindex`: `.world` is the
   * element `index.html` put in the tab order back when it was the scroll
   * container, and the container is this box now. A scrollable region a
   * keyboard cannot reach is WCAG 2.1.1, but so is a tab stop that goes
   * nowhere — a twenty-floor building gets one, a three-floor building that
   * fits entirely on screen does not.
   */
  function updateStageEdges(): void {
    const room = stage.scrollHeight - stage.clientHeight;
    setClass(stageWrap, "is-cut-top", stage.scrollTop > 4);
    setClass(stageWrap, "is-cut-bottom", room > 4 && stage.scrollTop < room - 4);
    if (room > 4) {
      stage.tabIndex = 0;
    } else {
      stage.removeAttribute("tabindex");
    }
  }

  stage.addEventListener("scroll", () => {
    updateStageEdges();
    placeCard();
  });

  /**
   * Whether the opening scroll to the lobby is finished with — either it landed,
   * or the window in which this widget is still allowed to move the view closed.
   */
  let groundShown = false;

  /**
   * Scrolls the stage down to the lobby.
   *
   * Opening a level shows the ground and not the roof: the lobby is where a run
   * starts, where the queue is, and where every car is parked. That much is the
   * mockup's own `showGround()`. What the mockup does not need is any of the
   * retrying around it, and the reason is worth writing down because nothing at
   * this end of the page suggests it. `src/main.ts` builds the workspace shell
   * *after* the app has mounted and drawn its first building, and moves the
   * already-running regions into it — `.world` among them — with `append`.
   * Reparenting a subtree keeps every element and listener alive, which is why
   * it is done that way, but it rebuilds the layout boxes, and a rebuilt scroll
   * container starts at the top. So the assignment below reports success (the
   * value reads straight back) and is undone a frame later, and a twenty-one
   * floor building opened looking at its roof.
   *
   * Hence: try again on every geometry pass, and stop for good once a pass finds
   * the stage already scrolled to the bottom, because from that point the scroll
   * position is the player's and a resize must not yank them back to the lobby.
   */
  function showGround(): void {
    if (groundShown) {
      return;
    }
    const room = stage.scrollHeight - stage.clientHeight;
    if (room <= 0) {
      // The whole building is on screen: the ground is already in view, and
      // there is nothing here to latch on either.
      return;
    }
    if (stage.scrollTop >= room) {
      groundShown = true;
      return;
    }
    stage.scrollTop = stage.scrollHeight;
  }

  // Floors go in bottom-up, level 0 first: `relabelWorld` in
  // `src/pages/game/index.ts` reads them back in DOM order and takes that
  // order for the floor number. The column reverses itself in CSS so the
  // ground floor still draws at the bottom of the building.
  const floorViews: FloorView[] = [];
  const queueEls: HTMLElement[] = [];
  for (const floor of world.floors) {
    const view = createFloorView(floor);
    view.element.tabIndex = 0;
    const queue = document.createElement("div");
    queue.className = "queue";
    const show = (): void => {
      showCard(view.element, queue, "above", floorCardText(floorSnapshot(world, floor)));
    };
    const hide = (): void => {
      if (shown?.describedBy === view.element) {
        hideCard();
      }
    };
    view.element.addEventListener("focus", show);
    view.element.addEventListener("blur", hide);
    // Pointing at a floor means pointing at the corridor the queue stands in,
    // not at its number over in the column: the passengers are the thing a
    // player is asking about, and they are all the way over here.
    queue.addEventListener("pointerenter", show);
    queue.addEventListener("pointerleave", hide);
    view.element.addEventListener("pointerenter", show);
    view.element.addEventListener("pointerleave", hide);
    levels.append(view.element);
    queueLayer.append(queue);
    floorViews.push(view);
    queueEls.push(queue);
  }

  // Floor lines are drawn top-down so the mockup's `:nth-child(odd)` zebra
  // starts on the same floor its own does; the array stays in level order like
  // everything else here.
  const floorlineEls: HTMLElement[] = new Array<HTMLElement>(world.floors.length);
  for (let row = 0; row < world.floors.length; row += 1) {
    const line = document.createElement("i");
    line.className = "floorline";
    floorlines.append(line);
    floorlineEls[world.floors.length - 1 - row] = line;
  }

  const elevatorViews: ElevatorView[] = [];
  for (const [index, elevator] of world.elevators.entries()) {
    const view = createElevatorView(elevator, index, scale);
    view.element.tabIndex = 0;
    const show = (): void => {
      showCard(
        view.element,
        view.element,
        "beside",
        elevatorCardText(elevatorSnapshot(elevator, index)),
      );
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

  world.on("new_user", (user) => {
    const view = createPassengerView(user, scale);
    people.append(view.element);
  });

  /**
   * Re-lays-out the building for the stage's current size.
   *
   * @see {@link BuildingStagePresenter.recomputeGeometry}
   */
  function recomputeGeometry(): void {
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const levelsWidth = levels.offsetWidth;

    const layout = layoutBuilding({
      stageHeight,
      stageWidth,
      levelsWidth,
      floorWeights: world.floors.map(() => 1),
      capacities: world.elevators.map((elevator) => elevator.maxUsers),
    });

    // Everything sized off a floor reads these two rather than being written
    // one element at a time: the floor number's own type size, the rider
    // figures, the cabin. `data-density` is the mockup's own switch for the
    // handful of things that cannot simply scale (see `.car` in style.css).
    building.dataset["density"] = layout.density;
    building.style.setProperty("--ds-floor-h", `${String(layout.shortestFloor)}px`);
    building.style.setProperty("--ds-car-h", `${String(layout.carHeight)}px`);

    for (const [level, view] of floorViews.entries()) {
      const heightPx = layout.floorHeights[level];
      if (heightPx === undefined) {
        continue;
      }
      view.setGeometry(heightPx);
      const topPx = layout.totalHeight - (layout.floorBottoms[level] ?? 0) - heightPx;
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
    const { scaleX } = computeShaftScale({ stageWidth, levelsWidth, elevators: shaftElevators });
    scale.scaleX = scaleX;
    scale.scaleY = computeVerticalScale({
      totalHeight: layout.totalHeight,
      floorCount: world.floors.length,
      floorHeight: world.floorHeight,
    });
    // Read by the rider figures, which are one seat wide: a seat is ten world
    // units, and how many pixels that is only this pass knows.
    building.style.setProperty("--ds-scale-x", String(scaleX));

    for (const [index, elevator] of world.elevators.entries()) {
      const view = elevatorViews[index];
      if (view === undefined) {
        continue;
      }
      view.setGeometry(elevator.width * scale.scaleX, layout.carHeight);
    }

    // The corridor runs from the building's own left edge to the first shaft,
    // and the world is as wide as the last car's right edge — both in the same
    // coordinate space every passenger walks through, scaled once.
    const lastElevator = shaftElevators.at(-1);
    const worldSpan = lastElevator === undefined ? 0 : lastElevator.worldX + lastElevator.width;
    const firstElevator = shaftElevators.at(0);
    const corridorPx = firstElevator === undefined ? 0 : Math.round(firstElevator.worldX * scaleX);
    tracks.style.width = `${String(Math.round(worldSpan * scaleX) + TRAILING_ROOM)}px`;
    for (const queue of queueEls) {
      queue.style.width = `${String(corridorPx)}px`;
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
    updateStageEdges();
  }

  recomputeGeometry();

  // The other half of {@link showGround}: a few frames in which it is retried
  // whether or not anything resized, so that the shell's reparenting of
  // `.world` — which happens after this mount and resets the scroll to the top
  // — is followed by an attempt that survives it. A `ResizeObserver` pass
  // usually lands in that window too, but only because the move happens to
  // change the pane's width, and a scroll position is not something to leave
  // resting on a coincidence. The window is small and then it is shut: after it,
  // the view belongs to whoever is looking at it.
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
