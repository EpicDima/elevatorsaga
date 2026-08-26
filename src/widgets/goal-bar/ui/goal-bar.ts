/**
 * The goal bar: the level's own meters plus the bronze/silver/gold tier popover.
 * Drawing splits into `rebuild()`, which rebuilds structure and translated
 * prose (on construction and language change), and `draw()`, which patches
 * only live values on every tick.
 */

import {
  evaluateLevelTier,
  TIER_NAME_KEY,
  tierBadgeMarkup,
  tierRequirementNow,
  tierRequirementText,
} from "#entities/level-tier/index.ts";
import type { LevelTierRequirements, TierRequirementInfo } from "#entities/level-tier/index.ts";
import type { Level, LevelWorldStats } from "#entities/level/index.ts";
import type { World } from "#game/world.ts";
import { decimal, format, t } from "#i18n/index.ts";
import type { MessageArgs, MessageKey } from "#i18n/index.ts";
import { clearChildren, requireElement, setClass } from "#shared/lib/dom.ts";
import { createDisclosure } from "#shared/ui/disclosure.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import type { SpriteIconName } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { buildGoalMeters, type GoalMeterView } from "../model/goal-meters.ts";
import { buildTierRows, type TierRowState } from "../model/tier-rows.ts";

/** What the goal bar needs in order to draw and drive itself. */
export interface GoalBarOptions {
  /** The level being played — its requirements, tiers and description. */
  readonly level: Level;
  /** The same tri-state verdict {@link "#entities/level/index.ts"!LevelCondition.evaluate} returns. */
  readonly getVerdict: () => boolean | null;
}

/** The goal bar, already built and drawn once. */
export interface GoalBarPresenter {
  /** Redraws the whole bar — its structure and its translated prose alike. */
  update(): void;
}

/** A message key that takes no parameters, so `t` stays callable with a key looked up dynamically. */
type NoParamMessageKey = { [K in MessageKey]: MessageArgs<K> extends [] ? K : never }[MessageKey];

/** How a main meter prints its current value and its bar. */
interface MeterFormat {
  /** Decimal digits for the current, live figure. */
  readonly currentDigits: number;
  /** Decimal digits for the threshold it is measured against. */
  readonly thresholdDigits: number;
  /** The unit suffix shared by both figures, if any. */
  readonly unitKey?: NoParamMessageKey;
}

/** Formatting for the fields a level's bronze requirements can name. */
const METER_FORMAT: Partial<Record<keyof LevelWorldStats, MeterFormat>> = {
  transportedCounter: { currentDigits: 0, thresholdDigits: 0 },
  elapsedTime: { currentDigits: 0, thresholdDigits: 1, unitKey: "game.goalBar.unit.seconds" },
  maxWaitTime: { currentDigits: 1, thresholdDigits: 1, unitKey: "game.goalBar.unit.seconds" },
  moveCount: { currentDigits: 0, thresholdDigits: 0, unitKey: "game.goalBar.unit.floors" },
};

/** The format a main meter falls back to outside {@link METER_FORMAT}'s four known fields. */
const DEFAULT_METER_FORMAT: MeterFormat = { currentDigits: 0, thresholdDigits: 0 };

/** Which `page.stats.*` caption a field's own main meter reuses. */
const METER_CAPTION_KEY = {
  transportedCounter: "page.stats.transported",
  elapsedTime: "page.stats.elapsedTime",
  transportedPerSec: "page.stats.transportedPerSec",
  avgWaitTime: "page.stats.avgWaitTime",
  avgPickupTime: "page.stats.avgPickupTime",
  avgRideTime: "page.stats.avgRideTime",
  maxWaitTime: "page.stats.maxWaitTime",
  moveCount: "page.stats.moves",
  stopCount: "page.stats.stops",
  avgPeoplePerStop: "page.stats.peoplePerStop",
  avgLoadFactorOnMove: "page.stats.avgLoad",
  maxPickupTime: "game.goalBar.caption.maxPickupTime",
} as const satisfies Readonly<Record<keyof LevelWorldStats, MessageKey>>;

/** The icon a tier row's own state reads as. */
const TIER_STATE_ICON: Readonly<Record<TierRowState, SpriteIconName>> = {
  held: "check",
  lost: "x",
  pending: "dash",
};

/** The share of the way to an at-most bar past which it reads as "close," not just "not late yet." */
const NEAR_THRESHOLD = 0.8;

/**
 * Which state class a main meter draws, if any. An at-least requirement only
 * has "not there yet" or "done"; an at-most requirement also has "near," for
 * a limit about to be broken.
 */
function meterStateClass(meter: GoalMeterView): "is-done" | "is-near" | "is-late" | "" {
  if (meter.requirement.comparison === "atLeast") {
    return meter.met ? "is-done" : "";
  }
  return !meter.met ? "is-late" : meter.progress > NEAR_THRESHOLD ? "is-near" : "";
}

/**
 * The silver/gold tick marks a bronze meter's own bar draws.
 * Skipped for `transportedCounter` and for ticks within 3% of either edge,
 * indistinguishable from the bar's own ends.
 */
function meterTicks(
  requirement: TierRequirementInfo,
  tiers: LevelTierRequirements | undefined,
): string {
  if (tiers === undefined || requirement.field === "transportedCounter") {
    return "";
  }
  const marks: string[] = [];
  for (const tier of ["silver", "gold"] as const) {
    const match = tiers[tier].requirements.find(
      (candidate) => candidate.field === requirement.field,
    );
    if (match === undefined) {
      continue;
    }
    const position = (match.threshold / requirement.threshold) * 100;
    if (position > 3 && position < 98) {
      marks.push(`<i class="tick is-${tier}" style="left: ${position.toFixed(1)}%"></i>`);
    }
  }
  return marks.join("");
}

/** A main meter's own "current / threshold unit" value markup. */
function meterValueMarkup(meter: GoalMeterView): string {
  const meterFormat = METER_FORMAT[meter.requirement.field] ?? DEFAULT_METER_FORMAT;
  const current = format(decimal(meter.current, meterFormat.currentDigits));
  const threshold = format(decimal(meter.requirement.threshold, meterFormat.thresholdDigits));
  const unit = meterFormat.unitKey === undefined ? "" : t(meterFormat.unitKey);
  return markup`<b>${current}</b> / ${threshold}${unit}`;
}

/** Builds the goal bar's static skeleton — no translated text baked in. */
export function goalBarTemplate(): string {
  return markup`<div class="goalbar"><div class="goalright"><div class="tierwrap"><button type="button" class="tierbox" aria-haspopup="true" aria-expanded="false"></button><div class="tiermenu" hidden><div class="tierrows"></div></div></div></div></div>`;
}

/** The elements one main meter needs patched on every draw. */
interface MeterRefs {
  readonly rootEl: HTMLElement;
  readonly valueEl: HTMLElement;
  readonly fillEl: HTMLElement;
}

/** Builds and drives the goal bar. */
export function presentGoalBar(
  parent: HTMLElement,
  world: World,
  options: GoalBarOptions,
): GoalBarPresenter {
  parent.innerHTML = goalBarTemplate();
  const goalBar = requireElement(".goalbar", parent);
  const tierWrap = requireElement(".tierwrap", goalBar);
  const tierOpen = requireElement(".tierbox", tierWrap);
  const tierMenu = requireElement(".tiermenu", tierWrap);
  const tierRows = requireElement(".tierrows", tierMenu);

  const disclosure = createDisclosure(tierOpen, tierMenu);

  let meterRefs: readonly MeterRefs[] = [];
  let extraNodes: readonly HTMLElement[] = [];

  /** Rebuilds the tier popover's rows from scratch; a no-op while the popover is closed. */
  function drawTierRows(): void {
    if (!disclosure.isOpen()) {
      return;
    }
    clearChildren(tierRows);
    const rows = buildTierRows(options.level, world, options.getVerdict());
    for (const row of rows) {
      const rowEl = renderElement(
        markup`<div class="tierrow" data-tier="${row.tier}"><div class="tierrow-head">${raw(
          tierBadgeMarkup(row.tier),
        )}<b>${t(TIER_NAME_KEY[row.tier])}</b><span class="tierstate"></span></div></div>`,
      );
      setClass(rowEl, "is-held", row.state === "held");
      setClass(rowEl, "is-lost", row.state === "lost");
      requireElement(".tierstate", rowEl).innerHTML = spriteIconMarkup(TIER_STATE_ICON[row.state]);
      for (const need of row.requirements) {
        const needEl = renderElement(
          markup`<div class="tierneed"><span>${raw(
            tierRequirementText(need.requirement),
          )}</span><span class="now"></span><span class="tierbar"><i style="width: 0%"></i></span></div>`,
        );
        setClass(needEl, "is-miss", need.miss);
        requireElement(".now", needEl).textContent = tierRequirementNow(need.requirement, world);
        requireElement(".tierbar i", needEl).style.width = `${(need.progress * 100).toFixed(1)}%`;
        rowEl.append(needEl);
      }
      tierRows.append(rowEl);
    }
  }

  /** Patches every live value a tick can change, without touching translated prose. */
  function draw(): void {
    const meters = buildGoalMeters(options.level.condition.requirements, world);
    for (const [index, meter] of meters.entries()) {
      const ref = meterRefs[index];
      if (ref === undefined) {
        continue;
      }
      ref.valueEl.innerHTML = meterValueMarkup(meter);
      ref.fillEl.style.width = `${(meter.progress * 100).toFixed(1)}%`;
      const stateClass = meterStateClass(meter);
      setClass(ref.rootEl, "is-done", stateClass === "is-done");
      setClass(ref.rootEl, "is-near", stateClass === "is-near");
      setClass(ref.rootEl, "is-late", stateClass === "is-late");
    }

    const verdict = options.getVerdict();
    const earnedTier =
      verdict === null
        ? undefined
        : (evaluateLevelTier(verdict, world, options.level.tiers) ?? undefined);
    tierOpen.innerHTML = tierBadgeMarkup(earnedTier);
    const title =
      earnedTier === undefined
        ? t("game.goalBar.trigger.titleNone")
        : t("game.goalBar.trigger.titleEarned", { tier: t(TIER_NAME_KEY[earnedTier]) });
    tierOpen.title = title;
    tierOpen.setAttribute("aria-label", title);

    drawTierRows();
  }

  /** Rebuilds the bar's structure and its translated prose, then redraws. */
  function rebuild(): void {
    for (const node of extraNodes) {
      node.remove();
    }
    extraNodes = [];
    meterRefs = [];

    const { requirements } = options.level.condition;
    if (requirements.length === 0) {
      tierWrap.hidden = true;
      const free = renderElement(
        markup`<div class="goalfree">${raw(spriteIconMarkup("lamp"))}<span>${raw(
          options.level.condition.description,
        )}</span></div>`,
      );
      goalBar.prepend(free);
      extraNodes = [free];
    } else {
      tierWrap.hidden = false;
      const meters = buildGoalMeters(requirements, world);
      const refs: MeterRefs[] = [];
      const nodes: HTMLElement[] = [];
      for (const meter of meters) {
        const captionKey = METER_CAPTION_KEY[meter.requirement.field];
        const ticks = meterTicks(meter.requirement, options.level.tiers);
        const meterEl = renderElement(
          markup`<div class="meter" data-kind="${meter.requirement.field}"><div class="meter-head"><span class="cap">${t(
            captionKey,
          )}</span><span class="meter-val num"></span></div><div class="meter-track"><div class="meter-fill" style="width: 0%"></div>${raw(
            ticks,
          )}</div></div>`,
        );
        refs.push({
          rootEl: meterEl,
          valueEl: requireElement(".meter-val", meterEl),
          fillEl: requireElement(".meter-fill", meterEl),
        });
        nodes.push(meterEl);
      }
      goalBar.prepend(...nodes);
      meterRefs = refs;
      extraNodes = nodes;
    }

    draw();
  }

  world.on("stats_display_changed", draw);
  tierOpen.addEventListener("click", () => {
    drawTierRows();
  });

  const presenter: GoalBarPresenter = { update: rebuild };
  presenter.update();
  return presenter;
}
