/**
 * The Skyscraper block: levels built on how real lift systems are actually run.
 *
 * `design/elevator-dispatch-research.md` is where these come from — round-trip
 * time, traffic profiles, zoning, destination dispatch. The numbered levels in
 * {@link "./levels.ts"!levels} are the original game's and stay exactly as they
 * were, because a decade of published solutions is scored against them; this is
 * where the fork gets to ask a different question without moving anybody's
 * goalposts.
 *
 * A {@link SkyscraperLevel} is structurally a {@link "./levels.ts"!Level}:
 * `options` and `condition` are named and typed to match, so an entry can be
 * handed straight to the machinery that runs a level. Deliberately no
 * conversion function, for the reason `tutorial.ts` gives for the same choice —
 * a converter is a second place for the building to be described, and the day
 * it disagrees with this table the player plays a world nothing ever measured.
 *
 * Not a {@link "./tutorial.ts"!TutorialLevel} either, though the shapes are
 * close. The learning track promises something this block does not: every entry
 * there carries a program measured to *lose* and a program measured to *win*,
 * and `tutorial-solutions.test.ts` holds it to both on ten seeds. A level here
 * demonstrates a way of running a building; it does not stage one particular
 * mistake, so it has no losing program to be the fixture of, and reusing the
 * track's type would mean inventing one per entry to satisfy a test that is
 * about a different promise.
 *
 * There is no `kind: "teach" | "scored"` field, though the block does hold both
 * kinds. A level with nothing to say about silver and gold omits `tiers`, and
 * {@link "./level-tiers.ts"!evaluateLevelTier} already reads that as "bronze is
 * the only medal here" — so `kind` would be a second spelling of
 * `tiers === undefined`, and two spellings of one fact drift. When something
 * needs to draw the two kinds differently it can ask the question it already
 * has an answer to.
 */

import { t } from "../i18n/index.ts";
import { requireUserCountWithinMoves, type LevelCondition } from "./levels.ts";
import type { LevelTierRequirements } from "./level-tiers.ts";
import type { RandomSeed } from "./random.ts";
import type { WorldOptions } from "./world.ts";

/** One level of the Skyscraper block. */
export interface SkyscraperLevel {
  /**
   * Stable identifier, used wherever a level has to survive being written down
   * — the address bar, the saved program, the medal on record.
   *
   * A string rather than the position in this array, for
   * {@link "./tutorial.ts"!TutorialLevel}'s reason: the position is the one
   * thing about a level that is expected to change, and inserting a level
   * between two existing ones must not hand somebody another level's saved
   * attempt or bookmarked address.
   */
  readonly id: string;
  /** The building the level is played in. */
  readonly options: WorldOptions;
  /** The bar that decides the run, built with the level constructors. */
  readonly condition: LevelCondition;
  /**
   * Silver and gold, on top of the win/lose {@link condition}.
   *
   * Omitted by a level that only means "cleared", exactly as
   * {@link "./levels.ts"!Level} allows: `evaluateLevelTier` reads a missing
   * value as bronze being the only medal, which is what a short demonstrating
   * level has to say.
   */
  readonly tiers?: LevelTierRequirements;
  /**
   * The seed this level is played on.
   *
   * Pinned on every entry, which is a deliberate difference from levels 1-19
   * and costs something real: the passenger stream is the same every visit, so
   * the variety a fresh draw gives is gone. What it buys is worth more here.
   * These levels have no decade of published solutions to calibrate against, so
   * a threshold is set from one measured run rather than from a distribution —
   * and a silver earned by two different players is the same silver, on the
   * same crowd, rather than two numbers that happen to share a name.
   */
  readonly seed: RandomSeed;
  /**
   * The program the editor is filled with when the level is opened.
   *
   * Required rather than optional, unlike anywhere else: every level in this
   * block touches an idea the numbered levels do not, and without a starter of
   * its own a player arrives carrying whatever they last wrote for level 19 —
   * a program written for a building whose rules do not apply here.
   */
  readonly startingCode: string;
  /**
   * The level's name, shown on the card beside the building.
   *
   * Needed because nothing else on screen can carry it. The switcher's trigger
   * is 118px wide and says "Sky 3" — its own message comment explains why the
   * longer labels overflow there — and the goal bar says what the level asks
   * for, not what it is about. Without this the block would be a row of
   * numbered tiles whose ideas are never named.
   */
  readonly title: string;
  /** The paragraph shown beside the building, saying what this level is about. */
  readonly briefing: string;
}

/**
 * Every level of the Skyscraper block, in the order they are played.
 *
 * `startingCode`, `title` and `briefing` are getters rather than fields, for the
 * reason `tutorial.ts` spells out at `tutorialLevels`: all three are messages,
 * and a field here would render them while this module is being imported —
 * before anything has chosen a locale, freezing them in the one language nobody
 * asked for. A getter is read at the moment somebody needs the text, by which
 * time a language has been chosen, and a language chosen again later is
 * answered the next time any of them is asked for.
 *
 * Every key is written out in full at the entry that uses it rather than built
 * from `id`, again for `tutorialLevels`' reason: a key assembled at runtime is
 * a key the type checker cannot see, and the day a level is renamed the
 * compiler should be the one to notice rather than a player meeting an empty
 * editor.
 */
export const skyscraperLevels: readonly SkyscraperLevel[] = [
  /**
   * The first: twelve floors, three cars, and a budget of moves rather than
   * seconds.
   *
   * Nothing here is new API — that is the point of opening with it. What is new
   * is the building. Twelve floors is the first one in the game tall enough
   * that a car spends more of its life travelling than loading, which is the
   * thing the research this block comes from calls round-trip time, and it is
   * what every later level in the block is a way of shortening. Levels 6-15
   * already judge `moveCount`, but on buildings of six to nine floors, where a
   * wasted trip costs three floors; here it costs eleven.
   *
   * Measured at the pinned seed, with the same harness
   * `level-tiers-solutions.test.ts` drives its runs with. The shipped starter
   * hands each call to the next car in turn and sends it straight there, so a
   * car carries about one person a trip; it runs out of moves with 35 of the 40
   * delivered. Sorting the calls into the queue so a car sweeps past them
   * instead of bouncing between them — the repair the briefing points at, and
   * nothing more than that — wins on the same seed in 156. `level-reference-
   * code.ts`'s collective-control dispatcher does it in 134.
   *
   * So: five people short below, fourteen moves of headroom at the repair the
   * level teaches, thirty-six at the best dispatcher in the repository. Wide
   * enough that a change to the physics moves the numbers rather than flipping
   * any of the three verdicts, and `skyscraper-solutions.test.ts` is what
   * notices when it does.
   *
   * Worth writing down because it was measured and is not what you would guess:
   * keeping the direction indicators honest, so nobody boards a car heading
   * away from where they are going, is *not* enough on its own here — it lands
   * at 39 of 40, one person short. Twelve floors punishes the wasted trip, not
   * the wasted seat, and that is the distinction the level exists to draw.
   */
  {
    id: "sky-1",
    options: { floorCount: 12, elevatorCount: 3, spawnRate: 1.2, elevatorCapacities: [8] },
    condition: requireUserCountWithinMoves(40, 170),
    seed: 4,
    get startingCode(): string {
      return t("skyscraper.sky1.startingCode.code");
    },
    get title(): string {
      return t("skyscraper.sky1.title");
    },
    get briefing(): string {
      return t("skyscraper.sky1.briefing.html");
    },
  },
];
