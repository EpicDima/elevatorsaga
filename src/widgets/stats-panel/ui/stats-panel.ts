/**
 * The stats panel: a primary row of live figures plus a disclosure with the rest, each with a
 * hoverable/focusable card explaining what it counts.
 * A native `<details>` rather than `createDisclosure`, since a reader clicking elsewhere on the
 * page while reading the figures should not collapse the section.
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
 * How long the pointer must rest on a tile before its card opens, in milliseconds. A sweep
 * across the strip stays quiet, so the cards don't cover the building for a player who already
 * knows what the figures mean. Keyboard focus still opens a card at once.
 */
export const CARD_HOVER_DELAY_MS = 700;

/** Significant digits, not decimal places, since the rate spans orders of magnitude across a run. */
const PER_SECOND_DIGITS: Intl.NumberFormatOptions = {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
};

/** Every tile caption is a plain label, so this excludes keys that require interpolation params. */
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

/** Waiting passengers: `parent` is null until boarded and never set to a waiting floor. */
function countWaitingNow(world: World): number {
  return world.users.filter((user) => user.parent === null && !user.done).length;
}

/** Passengers currently riding: every elevator's occupied slots, summed. */
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
  readonly captionKey: NoParamMessageKey;
  /** The card's key: one sentence saying what the figure counts. Required, so no tile is unexplained. */
  readonly titleKey: NoParamMessageKey;
  /** Whether the tile sits in the primary row or behind the disclosure. */
  readonly group: "primary" | "secondary";
  /** Renders the raw snapshot value as display text, digits and unit apart. */
  readonly format: (value: number) => QuantityParts;
  /** The history key this tile sparks, or `undefined` for a tile with no chart. */
  readonly sparkKey?: StatsHistoryKey;
}

/** Every tile the panel draws, primary row first, then the disclosure. */
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
 * Builds the panel's static skeleton, with no tiles and no translated text baked in.
 * The chevron is `aria-hidden`, since the `<summary>` beside it is the actual control.
 * The card is a single empty element shared by every tile, parented on the panel so it can
 * draw above the whole strip rather than clipped to one tile's box.
 */
export function statsPanelTemplate(): string {
  const chevron = spriteIconMarkup("right", "chev");
  return markup`<div class="statspanel"><div class="tiles-primary"></div><details class="more"><summary>${raw(chevron)}<span class="cap"></span></summary><div class="tiles-secondary"></div></details><div class="statcard" role="tooltip" hidden><b class="statcard-title"></b><div class="statcard-text"></div></div></div>`;
}

/**
 * One tile's markup: caption, value, and a chart for a sparked tile.
 * `role="group"` names the tile so a screen reader has something to announce when it is
 * tabbed to, since it is also a focusable card trigger.
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
 * Parses one tile's markup and collects the refs a draw needs to patch it.
 * The digits live in their own text node so the `<small>` unit beside them is built once,
 * not reinserted on every tick.
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

/** Builds and drives the stats panel; the returned presenter is already drawn once. */
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

  /** The hover waiting out {@link CARD_HOVER_DELAY_MS}, or `undefined` while none is. */
  let pendingOpen: ReturnType<typeof setTimeout> | undefined = undefined;

  /** Drops a hover that moved on before it rested long enough to earn a card. */
  function cancelPendingOpen(): void {
    clearTimeout(pendingOpen);
    pendingOpen = undefined;
  }

  /**
   * Dismisses the card on Escape from anywhere in the document, since a card opened by
   * pointing leaves focus wherever it already was, not necessarily inside the panel.
   * Bound only while a card is up and removed with it, so a rebuild never leaks a listener.
   */
  function dismissOnEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      hideCard();
    }
  }

  function hideCard(): void {
    cancelPendingOpen();
    if (shown === null) {
      return;
    }
    card.ownerDocument.removeEventListener("keydown", dismissOnEscape);
    shown.rootEl.removeAttribute("aria-describedby");
    shown = null;
    card.hidden = true;
  }

  /** Positions the card over its tile; called again after a language change resizes it. */
  function placeCard(ref: TileRefs): void {
    const position = positionCardOverTile(
      ref.rootEl.getBoundingClientRect(),
      root.getBoundingClientRect(),
      card.offsetWidth,
      card.offsetHeight,
    );
    // Offset by the panel's border: getBoundingClientRect measures the border box, but an
    // absolutely positioned child's top/left starts at the padding box inside it.
    card.style.left = `${String(position.x - root.clientLeft)}px`;
    card.style.top = `${String(position.y - root.clientTop)}px`;
  }

  /** Shows the card for one tile: its full caption and the sentence explaining its figure. */
  function showCard(ref: TileRefs): void {
    cancelPendingOpen();
    if (shown !== null && shown !== ref) {
      shown.rootEl.removeAttribute("aria-describedby");
    }
    cardTitle.textContent = t(ref.tile.captionKey);
    cardText.textContent = t(ref.tile.titleKey);
    card.hidden = false;
    ref.rootEl.setAttribute("aria-describedby", card.id);
    shown = ref;
    // Re-adding the same listener is a no-op, so switching tiles needs no guard.
    card.ownerDocument.addEventListener("keydown", dismissOnEscape);
    placeCard(ref);
  }

  for (const ref of refs) {
    const container = ref.tile.group === "primary" ? primaryContainer : secondaryContainer;
    container.append(ref.rootEl);
    // Delayed, unlike focus below: a pointer crossing the strip is passing through, not asking.
    ref.rootEl.addEventListener("pointerenter", () => {
      // Restarted, not stacked: two touch points on two tiles must not leave a countdown behind.
      cancelPendingOpen();
      pendingOpen = setTimeout(() => {
        showCard(ref);
      }, CARD_HOVER_DELAY_MS);
    });
    ref.rootEl.addEventListener("pointerleave", (event) => {
      // Ignore leaving toward the card itself, flush on the tile's edge, so a pointer can
      // move onto it without closing it — WCAG 1.4.13 hoverable.
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

  card.addEventListener("pointerleave", (event) => {
    // Ignore dropping back onto the tile the card belongs to, since it stands flush on the
    // tile's edge: closing there would blank the card for a whole delay on a 1px move.
    if (
      event.relatedTarget instanceof Node &&
      shown?.rootEl.contains(event.relatedTarget) === true
    ) {
      return;
    }
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
      // Keep an open card showing, re-rendered and repositioned for the new language.
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
