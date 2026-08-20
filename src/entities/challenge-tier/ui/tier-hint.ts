/**
 * What a run still owes the next star, in one sentence —
 * `design/ui-mockup.html`'s own `tierHint(held)`, which the verdict card draws
 * as its `.verdict-more` line.
 *
 * The mockup's comment on that function is the whole specification, and it is
 * about tone rather than arithmetic: "ровно одной строкой и с числом, которое
 * получилось: «серебро» без «на сколько мимо» — это упрёк, а не подсказка."
 * So every unmet requirement is named with both figures — the bar and where
 * the run actually finished — and a run that has nothing left to earn says
 * nothing at all rather than congratulating itself a second time.
 *
 * Here rather than in the widget that draws it for the same reason
 * {@link "./requirement-text.ts"!tierRequirementText} is: it is made entirely
 * of tier vocabulary, and the widget it serves is deliberately kept free of
 * any way to work a tier out for itself.
 */

import type { ChallengeWorldStats } from "#game/challenges.ts";
import type { ChallengeTier, ChallengeTierRequirements } from "#game/challenge-tiers.ts";
import { formatList, t } from "#i18n/index.ts";

import { requirementMet } from "../model/tier-progress.ts";
import { tierRequirementNow, tierRequirementText } from "./requirement-text.ts";

/**
 * The sentence naming what the run would need for its next star, or `""` when
 * there is no next star to name.
 *
 * Trusted markup, like {@link tierRequirementText} it is built from: the
 * figures inside arrive already wrapped in the span the game paints numbers
 * with.
 *
 * Empty in each of the four cases where the line would be noise rather than
 * help: a challenge with no silver/gold bars at all, a run already rated gold,
 * a run that did not win (its caller has no tier to pass, so it never gets
 * here), and the defensive case of a tier whose predicate failed without any
 * of its own {@link ChallengeTierRequirements} being missed — a predicate is
 * free to test more than the requirements it advertises, and a hint listing
 * nothing would be a promise that clearing nothing earns the star.
 *
 * @param tiers - The challenge's silver and gold bars, or `undefined` for a
 * challenge that has none.
 * @param earned - The tier the run was actually rated, from
 * {@link "#game/challenge-tiers.ts"!evaluateChallengeTier}.
 * @param world - The run's final statistics.
 * @returns The hint, in the active language, or `""`.
 */
export function nextTierHint(
  tiers: ChallengeTierRequirements | undefined,
  earned: ChallengeTier,
  world: ChallengeWorldStats,
): string {
  if (tiers === undefined || earned === "gold") {
    return "";
  }
  // Written as the two-step ladder `ChallengeTierRequirements` itself is,
  // rather than indexed out of `CHALLENGE_TIERS`: that array holds bronze too,
  // which is the challenge's own condition and has no entry here to look up.
  const next = earned === "bronze" ? "silver" : "gold";
  const missed = tiers[next].requirements.filter(
    (requirement) => !requirementMet(requirement, world),
  );
  if (missed.length === 0) {
    return "";
  }
  const needs = formatList(
    missed.map((requirement) =>
      t("game.feedback.more.need.html", {
        req: tierRequirementText(requirement),
        now: tierRequirementNow(requirement, world),
      }),
    ),
  );
  return next === "gold"
    ? t("game.feedback.more.gold.html", { needs })
    : t("game.feedback.more.silver.html", { needs });
}
