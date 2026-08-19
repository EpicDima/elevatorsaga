/**
 * The goal bar: the challenge's own meters plus the bronze/silver/gold tier
 * popover, ported from `design/ui-mockup.html`'s `renderGoals()`/`drawGoals()`
 * and `renderTiers()`/`drawTiers()`.
 *
 * Mounted live from `src/app/app.ts` since Phase 12.2.
 *
 * The mockup draws its meters and its tier popover with two different
 * rhythms, and this module keeps that split rather than rebuilding
 * everything on every tick:
 *
 * - `rebuild()` creates the DOM structure — one `<div class="meter">` per
 *   requirement (or the free-state block, for a challenge with none), with
 *   its caption, tick marks and unit already baked in — and saves the
 *   elements later ticks need to patch. Runs at construction and again on
 *   every {@link GoalBarPresenter.update}, i.e. on a language change: the
 *   captions and requirement sentences are translated prose, and a redraw
 *   that only patched numbers would leave them in whatever language the
 *   widget was built in.
 * - `draw()` patches only the live values a tick can change — current
 *   figures, bar widths, the `is-near`/`is-late`/`is-done` classes, the
 *   trigger's badge and title — without touching any translated text node.
 *   Wired to `world.on("stats_display_changed", draw)` once, the same
 *   contract `presentStats` uses.
 *
 * The tier popover's own rows follow a third rule, spelled out on
 * `drawTierRows` below: they cost nothing while the popover is closed, and
 * are guaranteed fresh the instant it opens.
 */

import { evaluateChallengeTier, tierBadgeMarkup } from "#entities/challenge-tier/index.ts";
import type {
  ChallengeTier,
  ChallengeTierRequirements,
  TierRequirementInfo,
} from "#entities/challenge-tier/index.ts";
import type { Challenge, ChallengeWorldStats } from "#entities/challenge/index.ts";
import type { World } from "#game/world.ts";
import { decimal, format, percent, seconds, t } from "#i18n/index.ts";
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
  /** The challenge being played — its requirements, tiers and description. */
  readonly challenge: Challenge;
  /** The same tri-state verdict {@link "#entities/challenge/index.ts"!ChallengeCondition.evaluate} returns. */
  readonly getVerdict: () => boolean | null;
}

/** The goal bar, already built and drawn once. */
export interface GoalBarPresenter {
  /** Redraws the whole bar — its structure and its translated prose alike. */
  update(): void;
}

/**
 * A message key that takes no parameters.
 *
 * `METER_FORMAT`'s own `unitKey` is read out of a table and handed to `t`
 * dynamically rather than written as a literal at each call site — narrowing
 * the type here is what keeps that call typeable, the same trick
 * `src/ui/localise-page.ts`'s own `ShellMessageKey` uses for the same
 * reason: with the whole of {@link MessageKey} the parameter object would be
 * mandatory, since some member of that union demands one.
 */
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

/**
 * Formatting for the four fields a challenge's own bronze requirements ever
 * name (`buildGoalMeters` is built from `challenge.condition.requirements`,
 * and every existing challenge's bronze condition reads one of these).
 *
 * `elapsedTime`'s current-value precision (0 decimals) deliberately diverges
 * from the mockup's own default of 1: it matches `presentStats`'s own
 * `format(seconds(world.elapsedTime))`, which also has 0. The threshold side
 * keeps 1 decimal, since a real `underElapsedTime`-style limit can be
 * fractional.
 */
const METER_FORMAT: Partial<Record<keyof ChallengeWorldStats, MeterFormat>> = {
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
} as const satisfies Readonly<Record<keyof ChallengeWorldStats, MessageKey>>;

/** A tier's own display name. */
const TIER_NAME_KEY = {
  bronze: "game.goalBar.tier.bronze",
  silver: "game.goalBar.tier.silver",
  gold: "game.goalBar.tier.gold",
} as const satisfies Readonly<Record<ChallengeTier, MessageKey>>;

/** The icon a tier row's own state reads as. */
const TIER_STATE_ICON: Readonly<Record<TierRowState, SpriteIconName>> = {
  held: "check",
  lost: "x",
  pending: "dash",
};

/**
 * One requirement's own sentence in the tier popover, keyed by the field it
 * reads. Built from nested `t()` calls exactly like `src/game/challenges.ts`'s
 * own condition factories — every key has to reach `t` as a literal, so this
 * is written out by hand rather than assembled from the field's name.
 */
const REQ_TEXT: Readonly<Record<keyof ChallengeWorldStats, (threshold: number) => string>> = {
  transportedCounter: (threshold) =>
    t("game.goalBar.req.transportedCounter.html", {
      people: t("challenge.people.html", { count: threshold }),
    }),
  elapsedTime: (threshold) =>
    t("game.goalBar.req.elapsedTime.html", {
      time: t("challenge.timeLimit.html", { count: decimal(threshold, 1) }),
    }),
  maxWaitTime: (threshold) =>
    t("game.goalBar.req.maxWaitTime.html", {
      time: t("challenge.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgWaitTime: (threshold) =>
    t("game.goalBar.req.avgWaitTime.html", {
      time: t("challenge.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  moveCount: (threshold) =>
    t("game.goalBar.req.moveCount.html", {
      floors: t("game.goalBar.floorBudget.html", { count: threshold }),
    }),
  stopCount: (threshold) =>
    t("game.goalBar.req.stopCount.html", {
      stops: t("game.goalBar.stopBudget.html", { count: threshold }),
    }),
  avgLoadFactorOnMove: (threshold) =>
    t("game.goalBar.req.avgLoadFactorOnMove.html", { percent: format(percent(threshold)) }),
  transportedPerSec: (threshold) =>
    t("game.goalBar.req.transportedPerSec.html", { rate: format(decimal(threshold, 2)) }),
  avgPeoplePerStop: (threshold) =>
    t("game.goalBar.req.avgPeoplePerStop.html", { rate: format(decimal(threshold, 2)) }),
  maxPickupTime: (threshold) =>
    t("game.goalBar.req.maxPickupTime.html", {
      time: t("challenge.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgPickupTime: (threshold) =>
    t("game.goalBar.req.avgPickupTime.html", {
      time: t("challenge.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgRideTime: (threshold) =>
    t("game.goalBar.req.avgRideTime.html", {
      time: t("challenge.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
};

/** A tier requirement line's own standalone "now" value, one formatter per field. */
const TIER_NOW: Readonly<
  Record<keyof ChallengeWorldStats, (world: ChallengeWorldStats) => string>
> = {
  transportedCounter: (world) => format(world.transportedCounter),
  elapsedTime: (world) => format(seconds(world.elapsedTime, 0)),
  maxWaitTime: (world) => format(seconds(world.maxWaitTime, 1)),
  avgWaitTime: (world) => format(seconds(world.avgWaitTime, 1)),
  moveCount: (world) => format(world.moveCount),
  stopCount: (world) => format(world.stopCount),
  avgLoadFactorOnMove: (world) => format(percent(world.avgLoadFactorOnMove)),
  transportedPerSec: (world) => format(decimal(world.transportedPerSec, 2)),
  avgPeoplePerStop: (world) => format(decimal(world.avgPeoplePerStop, 2)),
  maxPickupTime: (world) => format(seconds(world.maxPickupTime, 1)),
  avgPickupTime: (world) => format(seconds(world.avgPickupTime, 1)),
  avgRideTime: (world) => format(seconds(world.avgRideTime, 1)),
};

/** The share of the way to an at-most bar past which it reads as "close," not just "not late yet." */
const NEAR_THRESHOLD = 0.8;

/**
 * Which state class a main meter draws, if any.
 *
 * An at-least requirement (only `transportedCounter`, today) has nothing
 * between "not there yet" and "done" — there is no useful sense in which
 * carrying 40 of 100 people is "close." An at-most requirement is the
 * opposite: still fine until it is broken, and "near" only warns that it is
 * about to be.
 */
function meterStateClass(meter: GoalMeterView): "is-done" | "is-near" | "is-late" | "" {
  if (meter.requirement.comparison === "atLeast") {
    return meter.met ? "is-done" : "";
  }
  return !meter.met ? "is-late" : meter.progress > NEAR_THRESHOLD ? "is-near" : "";
}

/**
 * The silver/gold tick marks a bronze meter's own bar draws, ported from the
 * mockup's `tierTicks(goal)`.
 *
 * Skipped for `transportedCounter` (a defensive no-op kept for fidelity with
 * the mockup, which never actually reaches it either — no challenge tightens
 * a passenger-count floor tier over tier) and for any field a silver/gold
 * requirement does not itself mention. A tick within 3% of either edge is
 * skipped too — indistinguishable from the bar's own ends.
 */
function meterTicks(
  requirement: TierRequirementInfo,
  tiers: ChallengeTierRequirements | undefined,
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

/**
 * Builds and drives the goal bar.
 *
 * @param parent - The element the goal bar's markup is written into.
 * @param world - The run whose figures the bar reads.
 * @param options - The challenge being played and how to ask whether it is won.
 * @returns The presenter, already built and drawn once.
 */
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

  /**
   * Rebuilds the tier popover's rows from scratch.
   *
   * Numbers in the popover are only ever computed while it is open — see
   * `tier-rows.ts`'s own doc comment — so this is a no-op while closed, and
   * this is also what {@link presentGoalBar}'s own click listener on
   * `tierOpen` calls, added after {@link createDisclosure} has already run
   * its own toggle: opening the popover while paused, or after the run has
   * already ended, must not show whatever was left over from the last time a
   * tick happened to fire.
   */
  function drawTierRows(): void {
    if (!disclosure.isOpen()) {
      return;
    }
    clearChildren(tierRows);
    const rows = buildTierRows(options.challenge, world, options.getVerdict());
    for (const row of rows) {
      const rowEl = renderElement(
        markup`<div class="tierrow" data-tier="${row.tier}"><div class="tierrow-head">${raw(
          tierBadgeMarkup(row.tier),
        )}<b>${t(TIER_NAME_KEY[row.tier])}</b><span class="tierstate"></span></div></div>`,
      );
      requireElement(".tierstate", rowEl).innerHTML = spriteIconMarkup(TIER_STATE_ICON[row.state]);
      for (const need of row.requirements) {
        const needEl = renderElement(
          markup`<div class="tierneed"><span>${raw(
            REQ_TEXT[need.requirement.field](need.requirement.threshold),
          )}</span><span class="now"></span><span class="tierbar"><i style="width: 0%"></i></span></div>`,
        );
        setClass(needEl, "is-miss", need.miss);
        requireElement(".now", needEl).textContent = TIER_NOW[need.requirement.field](world);
        requireElement(".tierbar i", needEl).style.width = `${(need.progress * 100).toFixed(1)}%`;
        rowEl.append(needEl);
      }
      tierRows.append(rowEl);
    }
  }

  /** Patches every live value a tick can change, without touching translated prose. */
  function draw(): void {
    const meters = buildGoalMeters(options.challenge.condition.requirements, world);
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
        : (evaluateChallengeTier(verdict, world, options.challenge.tiers) ?? undefined);
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

    const { requirements } = options.challenge.condition;
    if (requirements.length === 0) {
      tierWrap.hidden = true;
      const free = renderElement(
        markup`<div class="goalfree">${raw(spriteIconMarkup("lamp"))}<span>${raw(
          options.challenge.condition.description,
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
        const ticks = meterTicks(meter.requirement, options.challenge.tiers);
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
