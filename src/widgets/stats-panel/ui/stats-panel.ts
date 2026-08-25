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
 * Every tile has a sentence saying what its figure counts. A card rather than a
 * line of prose beside the number: the panel is a strip under the building with
 * 128px of width per caption. Eight of the thirteen say at a card's length what
 * `docs.play.statistics.html` says of the same figure at paragraph length; the
 * other five are explained here and nowhere else, the reference page never
 * having taken them up.
 *
 * One card element is shared by all thirteen, shown on `pointerenter`/`focus`
 * and hidden on `pointerleave`/`blur`/Escape — the same arrangement
 * `widgets/building-stage` uses over the house, and for the same reason a
 * `title` attribute is not it: a `title` is shown by the browser to a pointer
 * and to nothing else, so the sentence was unreachable from a keyboard (WCAG
 * 2.1.1) and undismissable once shown (1.4.13). The card is the whole caption
 * as well as the sentence, since the caption itself is truncated on a narrow
 * pane and the card is then where it can be read in full.
 *
 * A tile is a focusable `role="group"` named by its caption, so what a screen
 * reader reaches is a named thing with the sentence as its description, rather
 * than the bare `<div>` a `title` used to hang unannounced on.
 *
 * ## Live text vs. sparkline history
 *
 * `draw` updates every tile's live text on every `stats_display_changed`
 * tick, but only records a new sparkline sample through
 * {@link StatsHistory.push}, which throttles itself to once per 200ms of
 * real time — see `model/history.ts`'s own doc comment for why that is safe
 * to do unconditionally here.
 */

import { positionCardOverTile } from "../lib/place-card.ts";
import { createStatsHistory, sparklinePoints, SPARK_FLOOR } from "../model/history.ts";
import type { StatsHistoryKey } from "../model/history.ts";
import type { World } from "#game/world.ts";
import { decimal, formatParts, percent, quantity, seconds, t } from "#i18n/index.ts";
import type { MessageArgs, MessageKey, QuantityParts } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/**
 * How the "transported per second" figure is rounded.
 *
 * Significant digits rather than decimal places, because the rate crosses
 * orders of magnitude within a single run: a fixed two decimals would flatten
 * an early 0.008 to 0.01 and write a late 12.3 as 12.30, claiming a precision
 * the figure has not got.
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
  /** The card's key: one sentence saying what the figure counts. Required, so no tile can arrive unexplained. */
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
  /** Redraws every tile's caption, name and card and the disclosure's summary, for a language change. */
  update(): void;
}

/** Counter for the panel's shared card id, unique per mounted panel. */
let nextCardId = 0;

/**
 * Builds the panel's static skeleton — no tiles, no translated text baked in.
 *
 * The summary opens with a disclosure chevron, drawn through
 * {@link spriteIconMarkup} rather than as raw SVG or a `<use href>`, since this
 * page ships no sprite sheet to point at. It is `aria-hidden` and unnamed: the
 * `<summary>` beside it is the control, and the open/closed state a chevron
 * draws is already on the `<details>` element for a screen reader to read.
 *
 * The card comes last and empty. It is one element for all thirteen tiles, its
 * text written when it is shown, and it hangs on the panel rather than inside a
 * tile because it is drawn above the strip: a card parented on a tile would be
 * placed against a box a couple of dozen pixels tall.
 */
export function statsPanelTemplate(): string {
  const chevron = spriteIconMarkup("right", "chev");
  return markup`<div class="statspanel"><div class="tiles-primary"></div><details class="more"><summary>${raw(chevron)}<span class="cap"></span></summary><div class="tiles-secondary"></div></details><div class="statcard" role="tooltip" hidden><b class="statcard-title"></b><div class="statcard-text"></div></div></div>`;
}

/**
 * One tile's own markup: caption, value, and — for a sparked tile — its chart.
 *
 * `role="group"` and not a bare `<div>`, because {@link presentStatsPanel} makes
 * every tile a tab stop so its card can be reached from a keyboard, and a
 * focusable element with no role and no name is a stop a screen reader has
 * nothing to announce at. The name is written with the caption in
 * `redrawCaptions`, so a change of language repaints it along with everything
 * else the tile says.
 */
function tileMarkup(tile: TileConfig): string {
  const spark =
    tile.sparkKey === undefined
      ? ""
      : `<svg class="spark" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><polyline data-spark points=""></polyline></svg>`;
  const noSparkClass = tile.sparkKey === undefined ? " no-spark" : "";
  return markup`<div class="tile${raw(noSparkClass)}" role="group" tabindex="0" data-stat="${tile.stat}"><span class="cap"></span><span class="tile-val num"><small></small></span>${raw(spark)}</div>`;
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
  const card = requireElement(".statcard", root);
  const cardTitle = requireElement(".statcard-title", card);
  const cardText = requireElement(".statcard-text", card);

  card.id = `stats-panel-card-${String(nextCardId)}`;
  nextCardId += 1;

  const refs = TILES.map((tile) => buildTile(tile));

  /** Which tile's card is up, or `null` while none is. */
  let shown: TileRefs | null = null;

  /**
   * Dismisses the card on Escape, from wherever in the document it was pressed.
   *
   * On the document and not on the panel, because a card opened by pointing at
   * a tile leaves focus where it already was — `<body>` on a page nobody has
   * tabbed into — so a handler bound inside the strip would answer only the
   * cards a player had tabbed to. Bound while a card is up and unbound with it:
   * the panel is built again from scratch on every redraw of the world, and a
   * listener left behind per redraw is a listener left behind for ever.
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
    shown.rootEl.removeAttribute("aria-describedby");
    shown = null;
    card.hidden = true;
  }

  /**
   * Puts the card on its tile — on opening, and again after a language change
   * has rewritten it into a taller or shorter sentence.
   *
   * @param ref - The tile the card is standing on.
   */
  function placeCard(ref: TileRefs): void {
    const position = positionCardOverTile(
      ref.rootEl.getBoundingClientRect(),
      root.getBoundingClientRect(),
      card.offsetWidth,
      card.offsetHeight,
    );
    // Less the panel's own border, because the two are not measured from the
    // same corner: `getBoundingClientRect` starts at the border box and an
    // absolutely positioned child's `top` starts at the padding box inside it.
    // The panel's hairline along the top is a pixel of exactly that difference,
    // and it is the pixel that would sit between this card and its tile.
    card.style.left = `${String(position.x - root.clientLeft)}px`;
    card.style.top = `${String(position.y - root.clientTop)}px`;
  }

  /**
   * Shows the card for one tile: its caption in full, and the sentence saying
   * what the figure counts.
   *
   * @param ref - The tile being explained.
   */
  function showCard(ref: TileRefs): void {
    if (shown !== null && shown !== ref) {
      shown.rootEl.removeAttribute("aria-describedby");
    }
    cardTitle.textContent = t(ref.tile.captionKey);
    cardText.textContent = t(ref.tile.titleKey);
    card.hidden = false;
    ref.rootEl.setAttribute("aria-describedby", card.id);
    shown = ref;
    // Adding a listener a second time with the same callback and phase does
    // nothing, so moving from one tile to the next needs no guard here.
    card.ownerDocument.addEventListener("keydown", dismissOnEscape);
    placeCard(ref);
  }

  for (const ref of refs) {
    const container = ref.tile.group === "primary" ? primaryContainer : secondaryContainer;
    container.append(ref.rootEl);
    ref.rootEl.addEventListener("pointerenter", () => {
      showCard(ref);
    });
    ref.rootEl.addEventListener("pointerleave", (event) => {
      // Not when the pointer left for the card itself, which stands flush on
      // the tile's top edge: reading a card by pointing at it is WCAG 1.4.13's
      // "hoverable", and the card's own `pointerleave` below is what closes it
      // when the pointer finally goes elsewhere.
      if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) {
        return;
      }
      hideCard();
    });
    ref.rootEl.addEventListener("focus", () => {
      showCard(ref);
    });
    ref.rootEl.addEventListener("blur", () => {
      hideCard();
    });
  }

  card.addEventListener("pointerleave", () => {
    hideCard();
  });

  const history = createStatsHistory();

  /** Redraws every tile's caption and name and the disclosure's summary; no live figures. */
  function redrawCaptions(): void {
    for (const ref of refs) {
      ref.capEl.textContent = t(ref.tile.captionKey);
      ref.rootEl.setAttribute("aria-label", t(ref.tile.captionKey));
    }
    moreSummaryCap.textContent = t("game.statsPanel.more");
    if (shown !== null) {
      // A card standing open through a change of language is rewritten in the
      // new one rather than dropped, and then placed again: the sentence it
      // holds is what decides how tall it is.
      showCard(shown);
    }
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
