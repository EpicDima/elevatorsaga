// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { presentStatsPanel, statsPanelTemplate } from "./stats-panel.ts";
import { at } from "#game/test-helpers.ts";
import { User } from "#game/user.ts";
import { createWorld } from "#game/world.ts";
import type { World } from "#game/world.ts";
import { requireElement } from "#shared/lib/dom.ts";

/** The primary tiles, in the order the panel draws them. */
const PRIMARY_STATS = ["avgWaitTime", "maxWaitTime", "avgLoadFactorOnMove", "transportedPerSec"];

/** The secondary tiles, behind the "Все показатели"/"All figures" disclosure, in order. */
const SECONDARY_STATS = [
  "transportedCounter",
  "avgPickupTime",
  "avgRideTime",
  "avgPeoplePerStop",
  "waitingNow",
  "aboardNow",
  "elapsedTime",
  "moveCount",
  "stopCount",
];

/** The secondary tiles with no history to chart, which carry `no-spark`. */
const NO_SPARK_STATS = ["elapsedTime", "moveCount", "stopCount"];

function fixtureWorld(): World {
  return createWorld({ floorCount: 3, elevatorCount: 1 });
}

/**
 * A world with a known-good figure in each field `readSnapshot` takes straight off a world.
 * `waitingNow` and `aboardNow` are counted from floors and cars instead, so they can't be set
 * here; they're covered by their own test cases.
 */
function worldWithStats(): World {
  const world = fixtureWorld();
  world.transportedCounter = 12;
  world.elapsedTime = 60.7;
  world.transportedPerSec = world.transportedCounter / world.elapsedTime;
  world.avgWaitTime = 3.25;
  world.avgPickupTime = 1.75;
  world.avgRideTime = world.avgWaitTime - world.avgPickupTime;
  world.maxWaitTime = 11.06;
  world.moveCount = 7;
  world.stopCount = 5;
  world.avgPeoplePerStop = 2.375;
  world.avgLoadFactorOnMove = 0.5694;
  return world;
}

/** Mounts a stats panel for a world, ready for a test to inspect. */
function setUp(world: World): HTMLElement {
  const parent = document.createElement("div");
  document.body.append(parent);
  presentStatsPanel(parent, world);
  return parent;
}

/** How many sparkline points a tile's own `<polyline>` currently carries. */
function sparkPointCount(tile: Element): number {
  const polyline = tile.querySelector("polyline[data-spark]");
  const points = polyline?.getAttribute("points") ?? "";
  return points === "" ? 0 : points.split(" ").length;
}

/** One mounted panel's tile for a figure, as the element the card's events are aimed at. */
function tileOf(parent: HTMLElement, stat: string): HTMLElement {
  return requireElement(`.tile[data-stat="${stat}"]`, parent);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("statsPanelTemplate", () => {
  it("draws the inert shell: a closed disclosure and no tiles yet", () => {
    const parent = document.createElement("div");
    parent.innerHTML = statsPanelTemplate();

    expect(requireElement(".more", parent).hasAttribute("open")).toBe(false);
    expect(requireElement(".tiles-primary", parent).children).toHaveLength(0);
    expect(requireElement(".tiles-secondary", parent).children).toHaveLength(0);
    expect(parent.querySelectorAll(".tile")).toHaveLength(0);
  });
});

describe("presentStatsPanel", () => {
  it("draws four primary tiles and nine secondary tiles, in order, behind the disclosure", () => {
    const parent = setUp(fixtureWorld());

    const primary = requireElement(".tiles-primary", parent).querySelectorAll(".tile");
    expect([...primary].map((tile) => tile.getAttribute("data-stat"))).toEqual(PRIMARY_STATS);

    const secondary = requireElement(".tiles-secondary", parent).querySelectorAll(".tile");
    expect([...secondary].map((tile) => tile.getAttribute("data-stat"))).toEqual(SECONDARY_STATS);

    // The secondary tiles live inside the disclosure, not beside it.
    expect(
      requireElement(".more", parent).contains(requireElement(".tiles-secondary", parent)),
    ).toBe(true);
  });

  it("gives every tile except the three no-spark ones a sparkline chart", () => {
    const parent = setUp(fixtureWorld());

    for (const tile of parent.querySelectorAll(".tile")) {
      const stat = tile.getAttribute("data-stat");
      const hasChart = tile.querySelector("polyline[data-spark]") !== null;
      if (stat !== null && NO_SPARK_STATS.includes(stat)) {
        expect(tile.classList.contains("no-spark")).toBe(true);
        expect(hasChart).toBe(false);
      } else {
        expect(tile.classList.contains("no-spark")).toBe(false);
        expect(hasChart).toBe(true);
      }
    }
  });

  it("translates every caption, including the panel's own two new figures and its summary", () => {
    const parent = setUp(fixtureWorld());

    const cap = (stat: string): string | null =>
      requireElement(`.tile[data-stat="${stat}"] .cap`, parent).textContent;

    expect(cap("avgWaitTime")).toBe("Avg delivery time");
    expect(cap("maxWaitTime")).toBe("Max delivery time");
    expect(cap("avgLoadFactorOnMove")).toBe("Avg load");
    expect(cap("transportedPerSec")).toBe("Transported/s");
    expect(cap("transportedCounter")).toBe("Transported");
    expect(cap("avgPickupTime")).toBe("Avg wait for a car");
    expect(cap("avgRideTime")).toBe("Avg ride time");
    expect(cap("avgPeoplePerStop")).toBe("People per stop");
    expect(cap("waitingNow")).toBe("Waiting now");
    expect(cap("aboardNow")).toBe("Riding now");
    expect(cap("elapsedTime")).toBe("Elapsed time");
    expect(cap("moveCount")).toBe("Moves");
    expect(cap("stopCount")).toBe("Stops");
    expect(requireElement(".more summary .cap", parent).textContent).toBe("All figures");
  });

  it("explains every tile in a card of its own", () => {
    const parent = setUp(fixtureWorld());
    const cardText = requireElement(".statcard-text", parent);

    const tiles = [...parent.querySelectorAll<HTMLElement>(".tile")];
    const sentences = tiles.map((tile) => {
      tile.dispatchEvent(new Event("pointerenter"));
      return cardText.textContent;
    });
    // Not one tile left unexplained, and no explanation reused across tiles.
    expect(sentences.filter((line) => line !== "")).toHaveLength(tiles.length);
    expect(new Set(sentences).size).toBe(tiles.length);

    const sentence = (stat: string): string | null => {
      tileOf(parent, stat).dispatchEvent(new Event("pointerenter"));
      return cardText.textContent;
    };
    expect(sentence("moveCount")).toBe(
      "One move is counted each time a car crosses the halfway mark between one floor and the next",
    );
    expect(sentence("transportedPerSec")).toBe(
      "Everyone delivered so far, over the time the run has taken, so it is the whole run's average rather than the rate at this moment",
    );
    // The card also carries the caption in full; the grids truncate it to one line.
    expect(requireElement(".statcard-title", parent).textContent).toBe("Transported/s");
  });

  it("makes every tile a tab stop a screen reader has a name for", () => {
    const parent = setUp(fixtureWorld());

    for (const tile of parent.querySelectorAll<HTMLElement>(".tile")) {
      expect(tile.tabIndex).toBe(0);
      expect(tile.getAttribute("role")).toBe("group");
      expect(tile.getAttribute("aria-label")).toBe(tile.querySelector(".cap")?.textContent);
    }
    expect(requireElement('.tile[data-stat="moveCount"]', parent).getAttribute("aria-label")).toBe(
      "Moves",
    );
  });

  it("opens a figure's card from the keyboard and puts it away on Escape, without moving focus", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "avgLoadFactorOnMove");

    expect(card.hidden).toBe(true);
    tile.focus();
    tile.dispatchEvent(new Event("focus"));

    expect(card.hidden).toBe(false);
    expect(tile.getAttribute("aria-describedby")).toBe(card.id);
    expect(card.id).not.toBe("");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(card.hidden).toBe(true);
    expect(tile.hasAttribute("aria-describedby")).toBe(false);
    // The WAI-ARIA tooltip pattern's contract: Escape closes the card without moving focus.
    expect(document.activeElement).toBe(tile);
  });

  it("takes the card away when the focus moves on, and stays quiet the second time", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "waitingNow");

    tile.dispatchEvent(new Event("focus"));
    expect(card.hidden).toBe(false);

    tile.dispatchEvent(new Event("blur"));
    expect(card.hidden).toBe(true);
    expect(tile.hasAttribute("aria-describedby")).toBe(false);

    // A player who presses Escape then tabs away sends both a keydown and a blur at an
    // already-closed card, so the second dismissal must be a no-op.
    tile.dispatchEvent(new Event("blur"));
    expect(card.hidden).toBe(true);
  });

  it("dismisses a card opened by pointing, from a keyboard that never left the body", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "stopCount");

    tile.dispatchEvent(new Event("pointerenter"));
    expect(card.hidden).toBe(false);
    expect(document.activeElement).toBe(document.body);

    // The listener sits on the document while a card is up, so it sees every key, not just Escape.
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    expect(card.hidden).toBe(false);

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(card.hidden).toBe(true);
  });

  it("keeps the card up while the pointer travels onto it, and drops it on the way out", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "avgWaitTime");

    tile.dispatchEvent(new Event("pointerenter"));
    // Up off the tile and onto the card, which stands flush on its top edge.
    tile.dispatchEvent(new MouseEvent("pointerleave", { relatedTarget: card }));
    expect(card.hidden).toBe(false);
    expect(tile.getAttribute("aria-describedby")).toBe(card.id);

    card.dispatchEvent(new Event("pointerleave"));
    expect(card.hidden).toBe(true);
  });

  it("closes the card when the pointer leaves the tile for anywhere else", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "avgWaitTime");

    tile.dispatchEvent(new Event("pointerenter"));
    tile.dispatchEvent(new MouseEvent("pointerleave", { relatedTarget: parent }));

    expect(card.hidden).toBe(true);
    expect(tile.hasAttribute("aria-describedby")).toBe(false);
  });

  it("hands the card to the next figure, leaving no describedby behind", () => {
    const parent = setUp(fixtureWorld());
    const card = requireElement(".statcard", parent);
    const first = tileOf(parent, "avgWaitTime");
    const second = tileOf(parent, "maxWaitTime");

    first.dispatchEvent(new Event("pointerenter"));
    second.dispatchEvent(new Event("pointerenter"));

    expect(first.hasAttribute("aria-describedby")).toBe(false);
    expect(second.getAttribute("aria-describedby")).toBe(card.id);
    expect(requireElement(".statcard-title", parent).textContent).toBe("Max delivery time");
  });

  it("gives each mounted panel a card of its own to point at", () => {
    // Two panels on one document (a redraw before the old one is gone) would otherwise
    // point every tile's aria-describedby at whichever card was parsed first.
    const first = setUp(fixtureWorld());
    const second = setUp(fixtureWorld());

    expect(requireElement(".statcard", first).id).not.toBe(requireElement(".statcard", second).id);
  });

  it("stops listening for Escape once the card is down", () => {
    // The listener is on the document and this panel is rebuilt from scratch on every
    // redraw, so one left behind per card shown is one left behind for good.
    const parent = setUp(fixtureWorld());
    const listening = vi.spyOn(document, "removeEventListener");
    const tile = tileOf(parent, "avgWaitTime");

    tile.dispatchEvent(new Event("pointerenter"));
    tile.dispatchEvent(new Event("pointerleave"));

    expect(listening).toHaveBeenCalledWith("keydown", expect.any(Function));
    listening.mockRestore();
  });

  it("draws all eleven figures it reads off a world, each at its own precision and unit", () => {
    const parent = setUp(worldWithStats());

    const val = (stat: string): string | null =>
      requireElement(`.tile[data-stat="${stat}"] .tile-val`, parent).textContent;

    expect(val("transportedCounter")).toBe("12");
    expect(val("elapsedTime")).toBe("61s");
    expect(val("transportedPerSec")).toBe("0.198");
    expect(val("avgWaitTime")).toBe("3.3s");
    expect(val("avgPickupTime")).toBe("1.8s");
    expect(val("avgRideTime")).toBe("1.5s");
    expect(val("maxWaitTime")).toBe("11.1s");
    expect(val("moveCount")).toBe("7");
    expect(val("stopCount")).toBe("5");
    expect(val("avgPeoplePerStop")).toBe("2.38");
    expect(val("avgLoadFactorOnMove")).toBe("57%");
  });

  it("sets the unit a size down, in its own <small>, leaving the digits alone", () => {
    // The digits stay a bare text node next to the <small>, which is what lets a redraw
    // touch them without disturbing the unit element.
    const parent = setUp(worldWithStats());
    const val = (stat: string): HTMLElement =>
      requireElement(`.tile[data-stat="${stat}"] .tile-val`, parent);

    expect(requireElement("small", val("avgWaitTime")).textContent).toBe("s");
    expect(val("avgWaitTime").firstChild?.textContent).toBe("3.3");

    expect(requireElement("small", val("avgLoadFactorOnMove")).textContent).toBe("%");
    expect(val("avgLoadFactorOnMove").firstChild?.textContent).toBe("57");

    // A figure with no unit keeps the <small>, empty, so the redraw path stays the same for every tile.
    expect(requireElement("small", val("moveCount")).textContent).toBe("");
    expect(val("moveCount").textContent).toBe("7");
  });

  it("counts waitingNow and aboardNow from live passenger/elevator state, ignoring delivered passengers", () => {
    const world = fixtureWorld();
    const floor = at(world.floors, 0);

    const waiting = new User(60);
    waiting.appearOnFloor(floor, 1);
    world.users.push(waiting);

    const delivered = new User(70);
    delivered.appearOnFloor(floor, 1);
    delivered.done = true;
    world.users.push(delivered);

    const elevator = at(world.elevators, 0);
    at(elevator.userSlots, 0).user = new User(80);

    const parent = setUp(world);
    expect(requireElement('.tile[data-stat="waitingNow"] .tile-val', parent).textContent).toBe("1");
    expect(requireElement('.tile[data-stat="aboardNow"] .tile-val', parent).textContent).toBe("1");
  });

  it("redraws every live value on stats_display_changed, without a caption redraw", () => {
    const world = fixtureWorld();
    const parent = setUp(world);

    world.transportedCounter = 42;
    world.trigger("stats_display_changed");

    expect(
      requireElement('.tile[data-stat="transportedCounter"] .tile-val', parent).textContent,
    ).toBe("42");
    expect(requireElement('.tile[data-stat="transportedCounter"] .cap', parent).textContent).toBe(
      "Transported",
    );
  });

  it("records one sparkline sample per draw, throttled to once per 200ms of real time", () => {
    let now = 1000;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const world = fixtureWorld();
      const parent = setUp(world);
      const tile = requireElement('.tile[data-stat="avgWaitTime"]', parent);
      expect(sparkPointCount(tile)).toBe(1);

      now += 100;
      world.avgWaitTime = 5;
      world.trigger("stats_display_changed");
      expect(sparkPointCount(tile)).toBe(1);

      now += 150;
      world.avgWaitTime = 6;
      world.trigger("stats_display_changed");
      expect(sparkPointCount(tile)).toBe(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("update() repaints every caption and name in place, without rebuilding the tiles", () => {
    const world = fixtureWorld();
    const parent = document.createElement("div");
    document.body.append(parent);
    const presenter = presentStatsPanel(parent, world);

    const tilesBefore = [...parent.querySelectorAll(".tile")];
    presenter.update();
    const tilesAfter = [...parent.querySelectorAll(".tile")];

    expect(tilesAfter).toHaveLength(tilesBefore.length);
    expect(tilesAfter.every((tile, index) => tile === tilesBefore[index])).toBe(true);
    expect(requireElement('.tile[data-stat="avgWaitTime"] .cap', parent).textContent).toBe(
      "Avg delivery time",
    );
    expect(tileOf(parent, "avgWaitTime").getAttribute("aria-label")).toBe("Avg delivery time");
  });

  it("update() rewrites a card left standing open rather than dropping it", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const presenter = presentStatsPanel(parent, fixtureWorld());
    const card = requireElement(".statcard", parent);
    const tile = tileOf(parent, "avgWaitTime");

    tile.dispatchEvent(new Event("pointerenter"));
    presenter.update();

    // Called on a language change; dropping the card would leave a pointer resting on a
    // figure with nothing to read until it moved off and back.
    expect(card.hidden).toBe(false);
    expect(tile.getAttribute("aria-describedby")).toBe(card.id);
    expect(requireElement(".statcard-title", parent).textContent).toBe("Avg delivery time");
  });
});
