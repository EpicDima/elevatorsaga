// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { goalBarTemplate, presentGoalBar } from "./goal-bar.ts";
import type { Level } from "#entities/level/index.ts";
import { atLeastAvgLoadFactorOnMove, requireAll, underElapsedTime } from "#game/level-tiers.ts";
import {
  requireUserCountWithinTime,
  requireUserCountWithinTimeWithMaxWaitTime,
} from "#game/levels.ts";
import { createWorld } from "#game/world.ts";
import type { World } from "#game/world.ts";
import { format, percent, seconds } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";

/** A bronze-only level: deliver 5 within 30 seconds, no silver/gold. */
const BRONZE_ONLY_LEVEL: Level = {
  options: {},
  condition: requireUserCountWithinTime(5, 30),
};

/**
 * A level with silver/gold on top of its bronze bar, mirroring
 * `tier-rows.test.ts`'s own `LEVEL` fixture so the two suites agree on
 * what "held"/"lost" mean for the same numbers.
 */
const TIERED_LEVEL: Level = {
  options: {},
  condition: requireUserCountWithinTime(10, 60),
  tiers: {
    silver: underElapsedTime(50),
    gold: requireAll(underElapsedTime(40), atLeastAvgLoadFactorOnMove(0.5)),
  },
};

/** A level with nothing to meter — the sandbox's shape. */
const NOTHING_TO_METER_LEVEL: Level = {
  options: {},
  condition: {
    description: "Explore the building freely.",
    evaluate: () => null,
    requirements: [],
  },
};

function fixtureWorld(): World {
  return createWorld({ floorCount: 3, elevatorCount: 1 });
}

/**
 * Mounts a goal bar for a level and world, ready for a test to inspect.
 *
 * @param level - The level to present.
 * @param world - The run whose figures the bar reads.
 * @param getVerdict - The tri-state verdict to hand the bar; undecided by default.
 * @returns The mounted parent.
 */
function setUp(
  level: Level,
  world: World,
  getVerdict: () => boolean | null = () => null,
): HTMLElement {
  const parent = document.createElement("div");
  document.body.append(parent);
  presentGoalBar(parent, world, { level, getVerdict });
  return parent;
}

describe("goalBarTemplate", () => {
  it("draws the inert shell: a closed, hidden tier popover and no meters yet", () => {
    const parent = document.createElement("div");
    parent.innerHTML = goalBarTemplate();

    const tierOpen = requireElement(".tierbox", parent);
    expect(tierOpen.getAttribute("aria-haspopup")).toBe("true");
    expect(tierOpen.getAttribute("aria-expanded")).toBe("false");
    expect(requireElement(".tiermenu", parent).hasAttribute("hidden")).toBe(true);
    expect(requireElement(".tierrows", parent).children).toHaveLength(0);
    expect(parent.querySelectorAll(".meter")).toHaveLength(0);
  });
});

describe("presentGoalBar", () => {
  it("draws one meter per requirement, in order, with its caption and current/threshold value", () => {
    const world = fixtureWorld();
    world.transportedCounter = 3;
    world.elapsedTime = 10;
    const parent = setUp(BRONZE_ONLY_LEVEL, world);

    const meters = parent.querySelectorAll(".meter");
    expect(meters).toHaveLength(2);
    expect([...meters].map((meter) => meter.getAttribute("data-kind"))).toEqual([
      "transportedCounter",
      "elapsedTime",
    ]);

    const transported = requireElement('.meter[data-kind="transportedCounter"]', parent);
    expect(requireElement(".cap", transported).textContent).toBe("Transported");
    // No unit for transportedCounter, and 0 decimals both sides.
    expect(requireElement(".meter-val", transported).innerHTML).toBe("<b>3</b> / 5");
    // jsdom's CSSOM normalizes a trailing ".0" away on parse/read-back.
    expect(requireElement(".meter-fill", transported).style.width).toBe("60%");

    const elapsed = requireElement('.meter[data-kind="elapsedTime"]', parent);
    expect(requireElement(".cap", elapsed).textContent).toBe("Elapsed time");
    // 0 decimals for the live figure, 1 for the threshold, plus the seconds unit.
    expect(requireElement(".meter-val", elapsed).innerHTML).toBe("<b>10</b> / 30.0 s");
    expect(requireElement(".meter-fill", elapsed).style.width).toBe("33.3%");
  });

  it("marks an at-least meter is-done once met, and never near or late", () => {
    const world = fixtureWorld();
    world.transportedCounter = 5;
    const parent = setUp(BRONZE_ONLY_LEVEL, world);
    const meter = requireElement('.meter[data-kind="transportedCounter"]', parent);

    expect(meter.classList.contains("is-done")).toBe(true);
    expect(meter.classList.contains("is-near")).toBe(false);
    expect(meter.classList.contains("is-late")).toBe(false);
  });

  it("leaves an at-most meter unmarked at exactly the near threshold, not past it", () => {
    const world = fixtureWorld();
    world.elapsedTime = 24; // 24 / 30 = 0.8, the threshold itself, not past it
    const parent = setUp(BRONZE_ONLY_LEVEL, world);
    const meter = requireElement('.meter[data-kind="elapsedTime"]', parent);

    expect(meter.classList.contains("is-near")).toBe(false);
    expect(meter.classList.contains("is-late")).toBe(false);
  });

  it("marks an at-most meter is-near once its progress passes the near threshold, while still met", () => {
    const world = fixtureWorld();
    world.elapsedTime = 25; // 25 / 30 = 0.8333, past the 0.8 near threshold
    const parent = setUp(BRONZE_ONLY_LEVEL, world);
    const meter = requireElement('.meter[data-kind="elapsedTime"]', parent);

    expect(meter.classList.contains("is-near")).toBe(true);
    expect(meter.classList.contains("is-late")).toBe(false);
  });

  it("marks an at-most meter is-late once its budget is blown", () => {
    const world = fixtureWorld();
    world.elapsedTime = 35; // past the 30-second budget
    const parent = setUp(BRONZE_ONLY_LEVEL, world);
    const meter = requireElement('.meter[data-kind="elapsedTime"]', parent);

    expect(meter.classList.contains("is-late")).toBe(true);
    expect(meter.classList.contains("is-near")).toBe(false);
  });

  it("draws a silver and gold tick on a bronze meter's own bar, at each tier's threshold", () => {
    const parent = setUp(TIERED_LEVEL, fixtureWorld());
    const elapsed = requireElement('.meter[data-kind="elapsedTime"]', parent);
    const ticks = elapsed.querySelectorAll(".tick");

    expect(ticks).toHaveLength(2);
    expect([...ticks].map((tick) => tick.className)).toEqual(["tick is-silver", "tick is-gold"]);
    expect([...ticks].map((tick) => (tick as HTMLElement).style.left)).toEqual([
      `${((50 / 60) * 100).toFixed(1)}%`,
      `${((40 / 60) * 100).toFixed(1)}%`,
    ]);

    // Bronze's other meter has no silver/gold requirement of its own to tick.
    const transported = requireElement('.meter[data-kind="transportedCounter"]', parent);
    expect(transported.querySelectorAll(".tick")).toHaveLength(0);
  });

  it("draws no tick on a bronze meter whose figure no tier measures", () => {
    // Not the transportedCounter case above, which is skipped outright: this is
    // a meter on a field silver and gold simply say nothing about, so there is
    // no threshold of theirs to draw on its bar. The elapsed-time meter beside
    // it, which they do measure, still gets both ticks.
    const level: Level = {
      options: {},
      condition: requireUserCountWithinTimeWithMaxWaitTime(10, 60, 5),
      tiers: { silver: underElapsedTime(50), gold: underElapsedTime(40) },
    };
    const parent = setUp(level, fixtureWorld());

    expect(
      requireElement('.meter[data-kind="maxWaitTime"]', parent).querySelectorAll(".tick"),
    ).toHaveLength(0);
    expect(
      requireElement('.meter[data-kind="elapsedTime"]', parent).querySelectorAll(".tick"),
    ).toHaveLength(2);
  });

  it("suppresses a tick exactly at either edge of the 3%/98% window, not just past it", () => {
    const level: Level = {
      options: {},
      condition: requireUserCountWithinTime(10, 100),
      tiers: {
        silver: underElapsedTime(3), // 3 / 100 = 3.0%, the edge itself
        gold: underElapsedTime(98), // 98 / 100 = 98.0%, the other edge
      },
    };
    const parent = setUp(level, fixtureWorld());
    const elapsed = requireElement('.meter[data-kind="elapsedTime"]', parent);

    expect(elapsed.querySelectorAll(".tick")).toHaveLength(0);
  });

  it("draws a tick a hair inside either edge of the 3%/98% window", () => {
    const level: Level = {
      options: {},
      condition: requireUserCountWithinTime(10, 100),
      tiers: {
        silver: underElapsedTime(3.01), // 3.01%, just past the low edge
        gold: underElapsedTime(97.99), // 97.99%, just short of the high edge
      },
    };
    const parent = setUp(level, fixtureWorld());
    const elapsed = requireElement('.meter[data-kind="elapsedTime"]', parent);

    expect(elapsed.querySelectorAll(".tick")).toHaveLength(2);
  });

  it("meters a figure outside the four the formats table names, in whole numbers and no unit", () => {
    // The four are the fields today's conditions actually put a bronze bar on.
    // A level that measures a fifth still has to draw a meter for it rather
    // than a row of `undefined`s, which is what the fallback format is for.
    const level: Level = {
      options: {},
      condition: {
        description: "Keep the average delivery quick.",
        evaluate: () => null,
        requirements: [{ field: "avgWaitTime", comparison: "atMost", threshold: 8 }],
      },
    };
    const world = fixtureWorld();
    world.avgWaitTime = 4.6;
    const parent = setUp(level, world);

    const meter = requireElement('.meter[data-kind="avgWaitTime"]', parent);
    expect(requireElement(".cap", meter).textContent).toBe("Avg delivery time");
    expect(requireElement(".meter-val", meter).innerHTML).toBe("<b>5</b> / 8");
  });

  it("shows the level's own description and hides the tier trigger for a level with nothing to meter", () => {
    const parent = setUp(NOTHING_TO_METER_LEVEL, fixtureWorld());

    expect(parent.querySelectorAll(".meter")).toHaveLength(0);
    const free = requireElement(".goalfree", parent);
    expect(free.textContent).toBe("Explore the building freely.");
    expect(free.querySelector(".ds-icon")).not.toBeNull();
    expect(requireElement(".tierwrap", parent).hidden).toBe(true);
  });

  it("builds no tier rows while the popover is closed, and populates it on the very click that opens it", () => {
    const world = fixtureWorld();
    world.transportedCounter = 12;
    world.elapsedTime = 45;
    world.avgLoadFactorOnMove = 0.3;
    const parent = setUp(TIERED_LEVEL, world, () => true);

    expect(requireElement(".tierrows", parent).children).toHaveLength(0);

    requireElement(".tierbox", parent).click();

    expect(requireElement(".tiermenu", parent).hidden).toBe(false);
    const rows = parent.querySelectorAll(".tierrow");
    expect([...rows].map((row) => row.getAttribute("data-tier"))).toEqual([
      "bronze",
      "silver",
      "gold",
    ]);
    expect(
      requireElement('.tierrow[data-tier="bronze"]', parent).querySelectorAll(".is-miss"),
    ).toHaveLength(0);
    expect(
      requireElement('.tierrow[data-tier="silver"]', parent).querySelectorAll(".is-miss"),
    ).toHaveLength(0);

    const gold = requireElement('.tierrow[data-tier="gold"]', parent);
    const needs = gold.querySelectorAll(".tierneed");
    expect(needs).toHaveLength(2);
    expect([...needs].map((need) => need.classList.contains("is-miss"))).toEqual([true, true]);
    expect([...gold.querySelectorAll(".now")].map((now) => now.textContent)).toEqual([
      // 0 decimals, matching `presentStats`'s own elapsed-time precision.
      format(seconds(45, 0)),
      format(percent(0.3)),
    ]);
    // jsdom's CSSOM normalizes a trailing ".0" away on parse/read-back.
    expect(
      [...gold.querySelectorAll(".tierbar i")].map((bar) => (bar as HTMLElement).style.width),
    ).toEqual(["100%", "60%"]);
    const reqText = [...gold.querySelectorAll(".tierneed > span:first-child")]
      .map((span) => span.textContent)
      .join(" | ");
    expect(reqText).toContain("40.0");
    expect(reqText).toContain("50%");
  });

  it("marks a tier row is-held or is-lost by its own verdict, not just its icon", () => {
    const world = fixtureWorld();
    world.transportedCounter = 12;
    world.elapsedTime = 45; // under silver's 50s budget, but not gold's 40s one
    world.avgLoadFactorOnMove = 0.3; // misses gold's 0.5 floor too
    const parent = setUp(TIERED_LEVEL, world, () => true);

    requireElement(".tierbox", parent).click();

    expect(
      requireElement('.tierrow[data-tier="bronze"]', parent).classList.contains("is-held"),
    ).toBe(true);
    expect(
      requireElement('.tierrow[data-tier="silver"]', parent).classList.contains("is-held"),
    ).toBe(true);
    expect(requireElement('.tierrow[data-tier="gold"]', parent).classList.contains("is-lost")).toBe(
      true,
    );
  });

  it("leaves every tier row unmarked while the run's own verdict is still undecided", () => {
    const parent = setUp(TIERED_LEVEL, fixtureWorld(), () => null);

    requireElement(".tierbox", parent).click();

    for (const row of parent.querySelectorAll(".tierrow")) {
      expect(row.classList.contains("is-held")).toBe(false);
      expect(row.classList.contains("is-lost")).toBe(false);
    }
  });

  it("costs nothing while the popover stays closed, and shows fresh figures the next time it opens", () => {
    const world = fixtureWorld();
    world.transportedCounter = 12;
    world.elapsedTime = 45;
    world.avgLoadFactorOnMove = 0.3;
    const parent = setUp(TIERED_LEVEL, world, () => true);
    const tierOpen = requireElement(".tierbox", parent);

    tierOpen.click(); // opens, populating the rows
    tierOpen.click(); // closes

    // Changed with no `stats_display_changed` tick fired: a stale popover
    // would still show this requirement as missed the next time it opens.
    world.avgLoadFactorOnMove = 0.9;

    tierOpen.click(); // opens again

    const gold = requireElement('.tierrow[data-tier="gold"]', parent);
    expect(
      [...gold.querySelectorAll(".tierneed")].map((need) => need.classList.contains("is-miss")),
    ).toEqual([true, false]);
  });

  it("update() rebuilds the bar's structure, not just the live values a tick can patch", () => {
    const world = fixtureWorld();
    const options: { level: Level; getVerdict: () => boolean | null } = {
      level: BRONZE_ONLY_LEVEL,
      getVerdict: () => null,
    };
    const parent = document.createElement("div");
    document.body.append(parent);
    const presenter = presentGoalBar(parent, world, options);
    expect(parent.querySelectorAll(".meter")).toHaveLength(2);

    options.level = NOTHING_TO_METER_LEVEL;
    world.trigger("stats_display_changed");
    // A live tick alone must not touch the bar's structure.
    expect(parent.querySelectorAll(".meter")).toHaveLength(2);
    expect(parent.querySelector(".goalfree")).toBeNull();

    presenter.update();
    expect(parent.querySelectorAll(".meter")).toHaveLength(0);
    expect(parent.querySelector(".goalfree")).not.toBeNull();
    expect(requireElement(".tierwrap", parent).hidden).toBe(true);
  });
});
