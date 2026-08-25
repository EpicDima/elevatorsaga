// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

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
 * A world with a known-good figure in each of the eleven fields `readSnapshot`
 * takes straight off a world. The panel's other two tiles, `waitingNow` and
 * `aboardNow`, are counted from the floors and cars instead and so cannot be
 * set here; they are covered by their own cases.
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

/**
 * Mounts a stats panel for a world, ready for a test to inspect.
 *
 * @param world - The run whose figures the panel reads.
 * @returns The mounted parent.
 */
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

  it("explains every tile in a tooltip of its own", () => {
    const parent = setUp(fixtureWorld());

    const tiles = [...parent.querySelectorAll(".tile")];
    const titles = tiles.map((tile) => tile.getAttribute("title"));
    // Not one tile left unexplained, and no explanation reused: a caption is
    // short enough to be read backwards, and every one of them has its own way
    // of being read backwards.
    expect(titles.filter((title) => title !== null && title !== "")).toHaveLength(tiles.length);
    expect(new Set(titles).size).toBe(tiles.length);

    const title = (stat: string): string | null =>
      requireElement(`.tile[data-stat="${stat}"]`, parent).getAttribute("title");
    expect(title("moveCount")).toBe(
      "One move is counted each time a car crosses the halfway mark between one floor and the next",
    );
    expect(title("transportedPerSec")).toBe(
      "Everyone delivered so far, over the time the run has taken, so it is the whole run's average rather than the rate at this moment",
    );
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
    // The unit is smaller and quieter than the figure it belongs to, so it has
    // to be an element of its own. The digits stay a bare text node next to it,
    // which is also what lets a redraw touch them without disturbing the
    // <small>.
    const parent = setUp(worldWithStats());
    const val = (stat: string): HTMLElement =>
      requireElement(`.tile[data-stat="${stat}"] .tile-val`, parent);

    expect(requireElement("small", val("avgWaitTime")).textContent).toBe("s");
    expect(val("avgWaitTime").firstChild?.textContent).toBe("3.3");

    expect(requireElement("small", val("avgLoadFactorOnMove")).textContent).toBe("%");
    expect(val("avgLoadFactorOnMove").firstChild?.textContent).toBe("57");

    // A figure with no unit keeps the element, empty: it is one tile among
    // thirteen and the redraw path is the same for all of them.
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

  it("update() repaints every caption and tooltip in place, without rebuilding the tiles", () => {
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
    expect(requireElement('.tile[data-stat="avgWaitTime"]', parent).getAttribute("title")).toBe(
      "The whole journey, from a passenger appearing in the building to stepping out at the floor they asked for, averaged over those already delivered, so the ride counts in it as much as the wait does",
    );
  });
});
