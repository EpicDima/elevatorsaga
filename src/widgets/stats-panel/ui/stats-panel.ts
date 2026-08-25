/**
 * The stats panel: the run's live figures plus their sparkline history.
 *
 * Mounted from `src/pages/game/index.ts`.
 *
 * ## Tile grouping
 *
 * A short primary row of the figures a player watches while the run is going,
 * and the rest behind an "All figures" disclosure. Every figure but two comes
 * straight off {@link World}; {@link countWaitingNow} and
 * {@link countAboardNow} are derived here from public engine state
 * ({@link World.users}, {@link User.parent}, {@link User.done},
 * `Elevator.userSlots`) rather than added to `src/game`.
 *
 * `avgWaitTime`'s doc comment in `world.ts` spells out
 * `avgPickupTime + avgRideTime ≈ avgWaitTime`, so that tile reads `avgWaitTime`
 * directly with no combining logic needed.
 *
 * ## Judgment call: a native `<details>`, not `createDisclosure`
 *
 * `createDisclosure` (`#shared/ui/disclosure.ts`) closes its panel on an
 * outside click or Escape, which is right for a floating popover — the goal
 * bar's tier breakdown, the level switcher's menu — but wrong here: a reader
 * clicking anywhere on the page while reading the extra figures should not
 * have the section collapse under them.
 *
 * ## Where a figure gets explained
 *
 * Every tile carries a `title` saying in one sentence what its figure counts,
 * written by `redrawCaptions` alongside the caption so that a language change
 * repaints both. A tooltip rather than a line of prose beside the number: the
 * panel is a strip under the building with 128px of width per caption. Eight of
 * the thirteen say at tooltip length what `docs.play.statistics.html` says of
 * the same figure at paragraph length; the other five are explained here and
 * nowhere else, the reference page never having taken them up.
 *
 * ## Live text vs. sparkline history
 *
 * `draw` updates every tile's live text on every `stats_display_changed`
 * tick, but only records a new sparkline sample through
 * {@link StatsHistory.push}, which throttles itself to once per 200ms of
 * real time — see `model/history.ts`'s own doc comment for why that is safe
 * to do unconditionally here.
 */

import { createStatsHistory, sparklinePoints, SPARK_FLOOR } from "../model/history.ts";
import type { StatsHistoryKey } from "../model/history.ts";
import type { World } from "#game/world.ts";
import { decimal, formatParts, percent, quantity, seconds, t } from "#i18n/index.ts";
import type { MessageArgs, MessageKey, QuantityParts } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/**
 * How the "transported per second" figure is rounded — copied from what was
 * `src/ui/presenters.ts`'s own `PER_SECOND_DIGITS`, whose doc comment
 * explained the choice of significant digits over decimal places.
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

/** The live figures one draw reads off the world, derived counts included. */
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
  /** The tile's caption key. */
  readonly captionKey: NoParamMessageKey;
  /** The tooltip key: one sentence saying what the figure counts. Required, so no tile can arrive unexplained. */
  readonly titleKey: NoParamMessageKey;
  /** Whether the tile sits in the four-tile primary row or behind the disclosure. */
  readonly group: "primary" | "secondary";
  /** Renders the raw snapshot value as display text, digits and unit apart. */
  readonly format: (value: number) => QuantityParts;
  /** The history key this tile sparks, or `undefined` for a tile with no chart, which `tileMarkup` marks `no-spark`. */
  readonly sparkKey?: StatsHistoryKey;
}

/**
 * The panel's full tile set — the primary row first, then everything behind the
 * disclosure, covering every field {@link StatsSnapshot} reads.
 */
const TILES: readonly TileConfig[] = [
  {
    stat: "avgWaitTime",
    captionKey: "page.stats.avgWaitTime",
    titleKey: "page.stats.avgWaitTimeTitle",
    group: "primary",
    format: (value) => formatParts(seconds(value, 1)),
    sparkKey: "avgWaitTime",
  },
  {
    stat: "maxWaitTime",
    captionKey: "page.stats.maxWaitTime",
    titleKey: "page.stats.maxWaitTimeTitle",
    group: "primary",
    format: (value) => formatParts(seconds(value, 1)),
    sparkKey: "maxWaitTime",
  },
  {
    stat: "avgLoadFactorOnMove",
    captionKey: "page.stats.avgLoad",
    titleKey: "page.stats.avgLoadTitle",
    group: "primary",
    format: (value) => formatParts(percent(value)),
    sparkKey: "avgLoadFactorOnMove",
  },
  {
    stat: "transportedPerSec",
    captionKey: "page.stats.transportedPerSec",
    titleKey: "page.stats.transportedPerSecTitle",
    group: "primary",
    format: (value) => formatParts(quantity(value, PER_SECOND_DIGITS)),
    sparkKey: "transportedPerSec",
  },
  {
    stat: "transportedCounter",
    captionKey: "page.stats.transported",
    titleKey: "page.stats.transportedTitle",
    group: "secondary",
    format: (value) => formatParts(value),
    sparkKey: "transportedCounter",
  },
  {
    stat: "avgPickupTime",
    captionKey: "page.stats.avgPickupTime",
    titleKey: "page.stats.avgPickupTimeTitle",
    group: "secondary",
    format: (value) => formatParts(seconds(value, 1)),
    sparkKey: "avgPickupTime",
  },
  {
    stat: "avgRideTime",
    captionKey: "page.stats.avgRideTime",
    titleKey: "page.stats.avgRideTimeTitle",
    group: "secondary",
    format: (value) => formatParts(seconds(value, 1)),
    sparkKey: "avgRideTime",
  },
  {
    stat: "avgPeoplePerStop",
    captionKey: "page.stats.peoplePerStop",
    titleKey: "page.stats.peoplePerStopTitle",
    group: "secondary",
    format: (value) => formatParts(decimal(value, 2)),
    sparkKey: "avgPeoplePerStop",
  },
  {
    stat: "waitingNow",
    captionKey: "game.statsPanel.waitingNow",
    titleKey: "game.statsPanel.waitingNowTitle",
    group: "secondary",
    format: (value) => formatParts(value),
    sparkKey: "waitingNow",
  },
  {
    stat: "aboardNow",
    captionKey: "game.statsPanel.aboardNow",
    titleKey: "game.statsPanel.aboardNowTitle",
    group: "secondary",
    format: (value) => formatParts(value),
    sparkKey: "aboardNow",
  },
  {
    stat: "elapsedTime",
    captionKey: "page.stats.elapsedTime",
    titleKey: "page.stats.elapsedTimeTitle",
    group: "secondary",
    format: (value) => formatParts(seconds(value)),
  },
  {
    stat: "moveCount",
    captionKey: "page.stats.moves",
    titleKey: "page.stats.movesTitle",
    group: "secondary",
    format: (value) => formatParts(value),
  },
  {
    stat: "stopCount",
    captionKey: "page.stats.stops",
    titleKey: "page.stats.stopsTitle",
    group: "secondary",
    format: (value) => formatParts(value),
  },
];

/** The stats panel, already built and drawn once. */
export interface StatsPanelPresenter {
  /** Redraws every tile's caption and tooltip and the disclosure's summary, for a language change. */
  update(): void;
}

/**
 * Builds the panel's static skeleton — no tiles, no translated text baked in.
 *
 * The summary opens with a disclosure chevron, drawn through
 * {@link spriteIconMarkup} rather than as raw SVG or a `<use href>`, since this
 * page ships no sprite sheet to point at. It is `aria-hidden` and unnamed: the
 * `<summary>` beside it is the control, and the open/closed state a chevron
 * draws is already on the `<details>` element for a screen reader to read.
 */
export function statsPanelTemplate(): string {
  const chevron = spriteIconMarkup("right", "chev");
  return markup`<div class="statspanel"><div class="tiles-primary"></div><details class="more"><summary>${raw(chevron)}<span class="cap"></span></summary><div class="tiles-secondary"></div></details></div>`;
}

/** One tile's own markup: caption, value, and — for a sparked tile — its chart. */
function tileMarkup(tile: TileConfig): string {
  const spark =
    tile.sparkKey === undefined
      ? ""
      : `<svg class="spark" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><polyline data-spark points=""></polyline></svg>`;
  const noSparkClass = tile.sparkKey === undefined ? " no-spark" : "";
  return markup`<div class="tile${raw(noSparkClass)}" data-stat="${tile.stat}"><span class="cap"></span><span class="tile-val num"><small></small></span>${raw(spark)}</div>`;
}

/** The elements one tile needs patched on every draw or caption redraw. */
interface TileRefs {
  readonly tile: TileConfig;
  readonly rootEl: HTMLElement;
  readonly capEl: HTMLElement;
  /** The digits, as a text node so that the `<small>` beside them survives every draw. */
  readonly numberNode: Text;
  readonly unitEl: HTMLElement;
  readonly polylineEl: Element | null;
}

/**
 * Parses one tile's markup and collects the refs {@link presentStatsPanel} needs.
 *
 * The value is two nodes, not one string: the digits, then the unit in a
 * `<small>` a size down and a shade back, so that a column of these reads as a
 * column of numbers. The digits go in a text node created here and patched in
 * place, which is what lets the `<small>` be built once with the tile rather
 * than reinserted on every tick of the run.
 *
 * @param tile - The tile's configuration.
 * @returns Its element and the parts of it that get patched.
 */
function buildTile(tile: TileConfig): TileRefs {
  const rootEl = renderElement(tileMarkup(tile));
  const numberNode = document.createTextNode("");
  const valEl = requireElement(".tile-val", rootEl);
  valEl.prepend(numberNode);
  return {
    tile,
    rootEl,
    capEl: requireElement(".cap", rootEl),
    numberNode,
    unitEl: requireElement(".tile-val small", rootEl),
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

  /** Redraws every tile's caption and tooltip and the disclosure's summary; no live figures. */
  function redrawCaptions(): void {
    for (const ref of refs) {
      ref.capEl.textContent = t(ref.tile.captionKey);
      ref.rootEl.title = t(ref.tile.titleKey);
    }
    moreSummaryCap.textContent = t("game.statsPanel.more");
  }

  /** Patches every tile's live value and, once per throttle window, its sparkline. */
  function draw(): void {
    const snapshot = readSnapshot(world);
    for (const ref of refs) {
      const parts = ref.tile.format(snapshot[ref.tile.stat]);
      ref.numberNode.data = parts.number;
      ref.unitEl.textContent = parts.unit;
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
