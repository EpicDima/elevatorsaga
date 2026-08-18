/**
 * The tier popover's own rows — bronze, and silver/gold when a challenge has
 * them — ported from `design/ui-mockup.html`'s `renderTiers()`/`drawTiers()`.
 *
 * Deliberately does not port the mockup's own `tiersNow()`: that function
 * exists there because the mockup's engine has no equivalent of
 * {@link "#entities/challenge-tier/index.ts"!evaluateChallengeTier} to ask
 * instead, so it re-derives bronze/silver/gold pass-fail from scratch, one
 * `Array.prototype.every(meets)` per tier. Production already has that
 * single source of truth, and re-deriving the same nested-tier logic a
 * second time here would be exactly the "parallel table that could drift"
 * `#game/challenge-tiers.ts`'s own doc comment on {@link TierPredicate}
 * warns against — so a row's held/lost state below is read off
 * {@link evaluateChallengeTier}'s one verdict instead of computed
 * independently.
 *
 * The mockup also does not gate a row's checkmark/cross on a live pass/fail
 * reading, only on `sim.finished` — a run "passing" a silver requirement on
 * its first tick, before anything has happened, would light silver green
 * for a reason that has nothing to do with the player's own effort. This
 * module follows the same rule: {@link buildTierRows}'s `verdict` parameter
 * is `null` for exactly as long as
 * {@link "#entities/challenge/index.ts"!ChallengeCondition.evaluate} itself
 * says so (still undecided), and every row reads `"pending"` for that whole
 * stretch regardless of where the run's own figures currently sit.
 */

import {
  CHALLENGE_TIERS,
  evaluateChallengeTier,
  requirementMet,
  requirementProgress,
} from "#entities/challenge-tier/index.ts";
import type { ChallengeTier, TierRequirementInfo } from "#entities/challenge-tier/index.ts";
import type { Challenge, ChallengeWorldStats } from "#entities/challenge/index.ts";

/** One requirement's own line inside a tier row. */
export interface TierRequirementRow {
  /** The figure, direction and bar this line reads. */
  readonly requirement: TierRequirementInfo;
  /** The live value of {@link requirement}'s own field. */
  readonly current: number;
  /** How full this line's own bar is, from `requirementProgress`. */
  readonly progress: number;
  /**
   * Whether this line should read as broken. While the run is still live,
   * only an at-most requirement already past its bar counts — an at-least
   * one not yet reached is simply not there yet, not a failure (the mockup's
   * own reasoning: "перевезти 100 человек", а перевезено десять — это не
   * провал, это середина прогона"). Once the run has ended, any unmet
   * requirement counts, in either direction.
   */
  readonly miss: boolean;
}

/** Whether a run has earned, missed, or not yet decided a tier row. */
export type TierRowState = "held" | "lost" | "pending";

/** One tier's own row in the popover. */
export interface TierRow {
  /** Which tier this row is for. */
  readonly tier: ChallengeTier;
  /** This tier's own requirements, each with its live figures. */
  readonly requirements: readonly TierRequirementRow[];
  /** Whether the run has earned this tier, missed it, or not decided yet. */
  readonly state: TierRowState;
}

function buildRequirementRow(
  requirement: TierRequirementInfo,
  world: ChallengeWorldStats,
  finished: boolean,
): TierRequirementRow {
  const met = requirementMet(requirement, world);
  return {
    requirement,
    current: world[requirement.field],
    progress: requirementProgress(requirement, world),
    miss: finished ? !met : requirement.comparison === "atMost" && !met,
  };
}

function tierRank(tier: ChallengeTier): number {
  return CHALLENGE_TIERS.indexOf(tier);
}

/**
 * Builds the popover's rows for one challenge: always bronze, plus
 * silver/gold when the challenge has them (see
 * {@link "#entities/challenge-tier/index.ts"!evaluateChallengeTier}'s own
 * doc comment on a `tiers === undefined` challenge — bronze is the only tier
 * such a challenge has). Empty when the challenge has nothing to meter at
 * all — the demo/sandbox tiles' own `requireDemo`/`requireSandbox`
 * conditions never resolve and carry `requirements: []`, mirroring the
 * mockup's own "sandbox: no rewards" case (`world.goals.length === 0`).
 *
 * @param challenge - The challenge being played.
 * @param world - The run's current statistics.
 * @param verdict - The same tri-state
 * {@link "#entities/challenge/index.ts"!ChallengeCondition.evaluate} itself
 * returns: `null` while still undecided, `true`/`false` once the run has
 * ended. Taken as a parameter rather than recomputed here for the same
 * reason {@link evaluateChallengeTier} takes its own `won` as a parameter —
 * a caller may fold in run-driving policy this module has no business
 * knowing about (an instant run's own timeout, for one), and there must be
 * only one place that decides a run is over.
 * @returns One row per tier this challenge has anything to say about, bronze
 * first.
 */
export function buildTierRows(
  challenge: Challenge,
  world: ChallengeWorldStats,
  verdict: boolean | null,
): readonly TierRow[] {
  if (challenge.condition.requirements.length === 0) {
    return [];
  }

  const finished = verdict !== null;
  const earnedTier =
    verdict === null ? null : evaluateChallengeTier(verdict, world, challenge.tiers);
  const rowState = (tier: ChallengeTier): TierRowState => {
    if (!finished) {
      return "pending";
    }
    return earnedTier !== null && tierRank(tier) <= tierRank(earnedTier) ? "held" : "lost";
  };
  const row = (tier: ChallengeTier, requirements: readonly TierRequirementInfo[]): TierRow => ({
    tier,
    requirements: requirements.map((requirement) =>
      buildRequirementRow(requirement, world, finished),
    ),
    state: rowState(tier),
  });

  const rows: TierRow[] = [row("bronze", challenge.condition.requirements)];
  if (challenge.tiers !== undefined) {
    rows.push(row("silver", challenge.tiers.silver.requirements));
    rows.push(row("gold", challenge.tiers.gold.requirements));
  }
  return rows;
}
