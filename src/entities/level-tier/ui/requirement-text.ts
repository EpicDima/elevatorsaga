/**
 * One tier requirement in words: what it asks of a run, and where the run
 * stands against it right now.
 *
 * Both tables below were `#widgets/goal-bar/ui/goal-bar.ts`'s own
 * module-private `REQ_TEXT`/`TIER_NOW` until the run's verdict card wanted the
 * same two sentences for its "what is still missing" hint. A widget may not
 * import another widget, and a second copy of either table would be a second
 * place to remember when a level starts metering a field — so they moved
 * down here beside {@link "./tier-badge.ts"!tierBadgeMarkup}, the other piece
 * of tier presentation the goal bar and the verdict card already share.
 *
 * The pair is deliberately two functions over one requirement rather than the
 * two field-keyed tables it was: every caller had a {@link
 * TierRequirementInfo} in hand and was reaching into it for the field twice,
 * once per table, which is what let the goal bar ask one table about one
 * requirement and the other about a different one without the compiler
 * noticing.
 */

import type { LevelWorldStats } from "#game/levels.ts";
import type { TierRequirementInfo } from "#game/level-tiers.ts";
import { decimal, format, percent, seconds, t } from "#i18n/index.ts";

/**
 * One requirement's own sentence, keyed by the field it reads. Built from
 * nested `t()` calls exactly like `src/game/levels.ts`'s own condition
 * factories — every key has to reach `t` as a literal, so this is written out
 * by hand rather than assembled from the field's name.
 */
const REQ_TEXT: Readonly<Record<keyof LevelWorldStats, (threshold: number) => string>> = {
  transportedCounter: (threshold) =>
    t("game.goalBar.req.transportedCounter.html", {
      people: t("level.people.html", { count: threshold }),
    }),
  elapsedTime: (threshold) =>
    t("game.goalBar.req.elapsedTime.html", {
      time: t("level.timeLimit.html", { count: decimal(threshold, 1) }),
    }),
  maxWaitTime: (threshold) =>
    t("game.goalBar.req.maxWaitTime.html", {
      time: t("level.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgWaitTime: (threshold) =>
    t("game.goalBar.req.avgWaitTime.html", {
      time: t("level.waitLimit.html", { count: decimal(threshold, 1) }),
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
      time: t("level.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgPickupTime: (threshold) =>
    t("game.goalBar.req.avgPickupTime.html", {
      time: t("level.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
  avgRideTime: (threshold) =>
    t("game.goalBar.req.avgRideTime.html", {
      time: t("level.waitLimit.html", { count: decimal(threshold, 1) }),
    }),
};

/** The standalone "where the run is now" figure, one formatter per field. */
const REQ_NOW: Readonly<Record<keyof LevelWorldStats, (world: LevelWorldStats) => string>> = {
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

/**
 * What a tier requirement asks for, as a sentence fragment: "average delivery
 * no later than 1.1 s".
 *
 * Trusted markup, not plain text — the numbers inside come wrapped in the span
 * the game paints figures with — so a caller interpolates it through `raw()`
 * or writes it with `innerHTML`, never with `textContent`.
 *
 * @param requirement - The figure, direction and bar to describe.
 * @returns The requirement's own sentence, in the active language.
 */
export function tierRequirementText(requirement: TierRequirementInfo): string {
  return REQ_TEXT[requirement.field](requirement.threshold);
}

/**
 * The figure a tier requirement reads, as the run has it now: "1.3 s".
 *
 * Plain text, unlike {@link tierRequirementText} — it is one number with its
 * unit and nothing to mark up.
 *
 * @param requirement - The requirement whose field to read.
 * @param world - The run's statistics.
 * @returns The current value of the requirement's field, formatted for the
 * active language.
 */
export function tierRequirementNow(
  requirement: TierRequirementInfo,
  world: LevelWorldStats,
): string {
  return REQ_NOW[requirement.field](world);
}
