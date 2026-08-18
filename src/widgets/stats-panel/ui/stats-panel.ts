/**
 * The stats panel: the run's live figures plus their sparkline history,
 * ported from `design/ui-mockup.html`'s stats tiles and `presentStats`'s own
 * eleven figures (`src/ui/presenters.ts`).
 *
 * Ships with no CSS, matching every other widget staged so far in this
 * migration (`app-bar.ts`, `goal-bar.ts`, `level-switcher.ts`,
 * `workspace-layout.ts`, `building-stage.ts`): built and tested, not yet
 * called from `index.html` or `src/app/app.ts`.
 *
 * ## Tile grouping
 *
 * The mockup shows four tiles up front and nine more behind a "Все
 * показатели" disclosure. This module keeps that exact 4 + 9 split, and
 * keeps all eleven of `presentStats`'s existing figures — none dropped —
 * plus two new ones the mockup also tracks but production never has:
 * {@link countWaitingNow} and {@link countAboardNow}, both read straight off
 * public engine state ({@link World.users}, {@link User.parent},
 * {@link User.done}, `Elevator.userSlots`) with no change to `src/game`.
 *
 * `avgWaitTime`'s doc comment in `world.ts` spells out
 * `avgPickupTime + avgRideTime ≈ avgWaitTime` — the exact sum the mockup's
 * own `avgWait() + avgRide()` computes for its `sAvg` tile — so `avgWaitTime`
 * is used there directly, with no combining logic needed.
 *
 * ## Judgment call: a native `<details>`, not `createDisclosure`
 *
 * `createDisclosure` (`#shared/ui/disclosure.ts`) closes its panel on an
 * outside click or Escape, which is right for a floating popover — the goal
 * bar's tier breakdown, the level switcher's menu — but wrong here: a reader
 * clicking anywhere on the page while reading the extra figures should not
 * have the section collapse under them. The mockup itself agrees: its own
 * "Все показатели" section is a plain `<details class="more"><summary>` with
 * no disclosure JavaScript at all, so this module uses the same element.
 *
 * ## Live text vs. sparkline history
 *
 * `draw` updates every tile's live text on every `stats_display_changed`
 * tick, but only records a new sparkline sample through
 * {@link StatsHistory.push}, which throttles itself to once per 200ms of
 * real time — see `model/history.ts`'s own doc comment for why that is safe
 * to do unconditionally here, unlike the mockup's own draw loop.
 */

import { createStatsHistory, sparklinePoints, SPARK_FLOOR } from "../model/history.ts";
import type { StatsHistoryKey } from "../model/history.ts";
import type { World } from "#game/world.ts";
import { decimal, format, percent, quantity, seconds, t } from "#i18n/index.ts";
import type { MessageArgs, MessageKey } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { markup, raw, renderElement } from "../../../ui/templates.ts";

/**
 * How the "transported per second" figure is rounded — copied from
 * `src/ui/presenters.ts`'s own `PER_SECOND_DIGITS`, whose doc comment
 * explains the choice of significant digits over decimal places.
 */
const PER_SECOND_DIGITS: Intl.NumberFormatOptions = {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
};

/**
 * A message key that takes no parameters — every tile caption here is a
 * plain label, never an interpolated sentence, so this rules out having to
 * pass a parameter object `t` would otherwise demand for a `MessageKey` this
 * broad. Copied from `widgets/goal-bar/ui/goal-bar.ts`'s own
 * `NoParamMessageKey`, which explains the underlying trick at more length.
 */
type NoParamMessageKey = { [K in MessageKey]: MessageArgs<K> extends [] ? K : never }[MessageKey];

/** The live figures one draw reads off the world, including the two new counts. */
interface StatsSnapshot {
  readonly transportedCounter: number;
  readonly elapsedTime: number;
  readonly transportedPerSec: number;
  readonly avgWaitTime: number;
  readonly avgPickupTime: number;
  readonly avgRideTime: number;
  readonly maxWaitTime: number;
  readonly moveCount: number;
  readonly stopCount: number;
  readonly avgPeoplePerStop: number;
  readonly avgLoadFactorOnMove: number;
  readonly waitingNow: number;
  readonly aboardNow: number;
}

/**
 * Passengers with nobody carrying them yet: not aboard an elevator (their
 * {@link User.parent | parent} is only ever an `Elevator` while boarded, and
 * `null` the rest of the time — never set to their waiting `Floor`) and not
 * already delivered.
 *
 * Matches `building-stage.ts`'s own `floorSnapshot` helper, which counts a
 * floor's waiting passengers with the same `parent === null && !done` test.
 *
 * @param world - The run to count.
 * @returns How many passengers are currently waiting, across every floor.
 */
function countWaitingNow(world: World): number {
  return world.users.filter((user) => user.parent === null && !user.done).length;
}

/**
 * Passengers currently riding: every elevator's occupied slots, summed.
 *
 * Matches `building-stage.ts`'s own `elevatorSnapshot` helper, which counts
 * one car's riders the same way.
 *
 * @param world - The run to count.
 * @returns How many passengers are currently aboard some elevator.
 */
function countAboardNow(world: World): number {
  let total = 0;
  for (const elevator of world.elevators) {
    for (const slot of elevator.userSlots) {
      if (slot.user !== null) {
        total++;
      }
    }
  }
  return total;
}

/** Reads every figure the panel draws off a world, in one place. */
function readSnapshot(world: World): StatsSnapshot {
  return {
    transportedCounter: world.transportedCounter,
    elapsedTime: world.elapsedTime,
    transportedPerSec: world.transportedPerSec,
    avgWaitTime: world.avgWaitTime,
    avgPickupTime: world.avgPickupTime,
    avgRideTime: world.avgRideTime,
    maxWaitTime: world.maxWaitTime,
    moveCount: world.moveCount,
    stopCount: world.stopCount,
    avgPeoplePerStop: world.avgPeoplePerStop,
    avgLoadFactorOnMove: world.avgLoadFactorOnMove,
    waitingNow: countWaitingNow(world),
    aboardNow: countAboardNow(world),
  };
}

/** The samples one draw feeds {@link StatsHistory.push} — every sparked key, straight off the snapshot. */
function sparkSamplesFrom(snapshot: StatsSnapshot): Record<StatsHistoryKey, number> {
  return {
    avgWaitTime: snapshot.avgWaitTime,
    maxWaitTime: snapshot.maxWaitTime,
    avgLoadFactorOnMove: snapshot.avgLoadFactorOnMove,
    transportedPerSec: snapshot.transportedPerSec,
    transportedCounter: snapshot.transportedCounter,
    avgPickupTime: snapshot.avgPickupTime,
    avgRideTime: snapshot.avgRideTime,
    avgPeoplePerStop: snapshot.avgPeoplePerStop,
    waitingNow: snapshot.waitingNow,
    aboardNow: snapshot.aboardNow,
  };
}

/** One tile's static configuration: where its value comes from, its caption, and how it is formatted. */
interface TileConfig {
  /** Which snapshot field this tile draws. */
  readonly stat: keyof StatsSnapshot;
  /** The tile's caption key; every one of these already exists under `page.stats.*` except the two new counts. */
  readonly captionKey: NoParamMessageKey;
  /** Whether the tile sits in the four-tile primary row or behind the disclosure. */
  readonly group: "primary" | "secondary";
  /** Renders the raw snapshot value as display text. */
  readonly format: (value: number) => string;
  /** The history key this tile sparks, or `undefined` for the three tiles the mockup marks `no-spark`. */
  readonly sparkKey?: StatsHistoryKey;
}

/**
 * The panel's full tile set: four primary, nine secondary, matching the
 * mockup's own 4 + 9 split and every field {@link StatsSnapshot} reads.
 */
const TILES: readonly TileConfig[] = [
  {
    stat: "avgWaitTime",
    captionKey: "page.stats.avgWaitTime",
    group: "primary",
    format: (value) => format(seconds(value, 1)),
    sparkKey: "avgWaitTime",
  },
  {
    stat: "maxWaitTime",
    captionKey: "page.stats.maxWaitTime",
    group: "primary",
    format: (value) => format(seconds(value, 1)),
    sparkKey: "maxWaitTime",
  },
  {
    stat: "avgLoadFactorOnMove",
    captionKey: "page.stats.avgLoad",
    group: "primary",
    format: (value) => format(percent(value)),
    sparkKey: "avgLoadFactorOnMove",
  },
  {
    stat: "transportedPerSec",
    captionKey: "page.stats.transportedPerSec",
    group: "primary",
    format: (value) => format(quantity(value, PER_SECOND_DIGITS)),
    sparkKey: "transportedPerSec",
  },
  {
    stat: "transportedCounter",
    captionKey: "page.stats.transported",
    group: "secondary",
    format: (value) => format(value),
    sparkKey: "transportedCounter",
  },
  {
    stat: "avgPickupTime",
    captionKey: "page.stats.avgPickupTime",
    group: "secondary",
    format: (value) => format(seconds(value, 1)),
    sparkKey: "avgPickupTime",
  },
  {
    stat: "avgRideTime",
    captionKey: "page.stats.avgRideTime",
    group: "secondary",
    format: (value) => format(seconds(value, 1)),
    sparkKey: "avgRideTime",
  },
  {
    stat: "avgPeoplePerStop",
    captionKey: "page.stats.peoplePerStop",
    group: "secondary",
    format: (value) => format(decimal(value, 2)),
    sparkKey: "avgPeoplePerStop",
  },
  {
    stat: "waitingNow",
    captionKey: "game.statsPanel.waitingNow",
    group: "secondary",
    format: (value) => format(value),
    sparkKey: "waitingNow",
  },
  {
    stat: "aboardNow",
    captionKey: "game.statsPanel.aboardNow",
    group: "secondary",
    format: (value) => format(value),
    sparkKey: "aboardNow",
  },
  {
    stat: "elapsedTime",
    captionKey: "page.stats.elapsedTime",
    group: "secondary",
    format: (value) => format(seconds(value)),
  },
  {
    stat: "moveCount",
    captionKey: "page.stats.moves",
    group: "secondary",
    format: (value) => format(value),
  },
  {
    stat: "stopCount",
    captionKey: "page.stats.stops",
    group: "secondary",
    format: (value) => format(value),
  },
];

/** The stats panel, already built and drawn once. */
export interface StatsPanelPresenter {
  /** Redraws every tile's caption and the disclosure's summary, for a language change. */
  update(): void;
}

/** Builds the panel's static skeleton — no tiles, no translated text baked in. */
export function statsPanelTemplate(): string {
  return markup`<div class="statspanel"><div class="tiles-primary"></div><details class="more"><summary><span class="cap"></span></summary><div class="tiles-secondary"></div></details></div>`;
}

/** One tile's own markup: caption, value, and — for a sparked tile — its chart. */
function tileMarkup(tile: TileConfig): string {
  const spark =
    tile.sparkKey === undefined
      ? ""
      : `<svg class="spark" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><polyline data-spark points=""></polyline></svg>`;
  const noSparkClass = tile.sparkKey === undefined ? " no-spark" : "";
  return markup`<div class="tile${raw(noSparkClass)}" data-stat="${tile.stat}"><span class="cap"></span><span class="tile-val num"></span>${raw(spark)}</div>`;
}

/** The elements one tile needs patched on every draw or caption redraw. */
interface TileRefs {
  readonly tile: TileConfig;
  readonly rootEl: HTMLElement;
  readonly capEl: HTMLElement;
  readonly valEl: HTMLElement;
  readonly polylineEl: Element | null;
}

/** Parses one tile's markup and collects the refs {@link presentStatsPanel} needs. */
function buildTile(tile: TileConfig): TileRefs {
  const rootEl = renderElement(tileMarkup(tile));
  return {
    tile,
    rootEl,
    capEl: requireElement(".cap", rootEl),
    valEl: requireElement(".tile-val", rootEl),
    polylineEl: rootEl.querySelector("polyline[data-spark]"),
  };
}

/**
 * Builds and drives the stats panel.
 *
 * @param parent - The element the panel's markup is written into.
 * @param world - The run whose figures the panel reports.
 * @returns The presenter, already built and drawn once.
 */
export function presentStatsPanel(parent: HTMLElement, world: World): StatsPanelPresenter {
  parent.innerHTML = statsPanelTemplate();
  const root = requireElement(".statspanel", parent);
  const primaryContainer = requireElement(".tiles-primary", root);
  const secondaryContainer = requireElement(".tiles-secondary", root);
  const moreSummaryCap = requireElement(".more summary .cap", root);

  const refs = TILES.map((tile) => buildTile(tile));
  for (const ref of refs) {
    const container = ref.tile.group === "primary" ? primaryContainer : secondaryContainer;
    container.append(ref.rootEl);
  }

  const history = createStatsHistory();

  /** Redraws every tile's caption and the disclosure's summary; no live figures. */
  function redrawCaptions(): void {
    for (const ref of refs) {
      ref.capEl.textContent = t(ref.tile.captionKey);
    }
    moreSummaryCap.textContent = t("game.statsPanel.more");
  }

  /** Patches every tile's live value and, once per throttle window, its sparkline. */
  function draw(): void {
    const snapshot = readSnapshot(world);
    for (const ref of refs) {
      ref.valEl.textContent = ref.tile.format(snapshot[ref.tile.stat]);
    }
    history.push(performance.now(), sparkSamplesFrom(snapshot));
    for (const ref of refs) {
      if (ref.polylineEl === null || ref.tile.sparkKey === undefined) {
        continue;
      }
      const sparkKey = ref.tile.sparkKey;
      ref.polylineEl.setAttribute(
        "points",
        sparklinePoints(history.samples(sparkKey), SPARK_FLOOR[sparkKey]),
      );
    }
  }

  redrawCaptions();
  world.on("stats_display_changed", draw);
  world.trigger("stats_display_changed");

  return { update: redrawCaptions };
}
