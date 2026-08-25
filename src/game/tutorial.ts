/**
 * The learning track: eight buildings, each one built around a single mistake.
 *
 * A level in {@link "./levels.ts"!levels} is a difficulty setting —
 * a building and a bar, and how the bar is cleared is the player's business. A
 * level here is a smaller and much stricter thing: a building tuned so that one
 * *particular* wrong program cannot clear the bar and one *particular* right
 * program clears it with room to spare. That gap is the entire teaching device,
 * because the track teaches by letting somebody watch their mistake fail and
 * then watch one changed line succeed.
 *
 * The gap is not a property of this code. It is a property of the numbers —
 * floors, spawn rate, threshold, seed — measured against the physics of
 * {@link "./world.ts"!World}. Nothing in a type system can hold it, so nothing
 * here asserts it; `tutorial-solutions.test.ts` replays both programs of every
 * level on ten seeds and requires the verdict each was measured to reach — the
 * loss and the win everywhere save one recorded seed of level 5, where no wait
 * limit can buy both. Ten seeds say whether a level works and cannot say how
 * often, so the three levels whose numbers turn on that are counted over four
 * hundred in `tutorial-sweep.test.ts`. Every number below was chosen against
 * those measurements, and where one of them moved away from what
 * `docs/tutorial-plan.md` first proposed, the entry says what forced it.
 *
 * The programs themselves are not written out here. They are messages, keyed
 * `tutorial.levelN.startingCode.code` and `tutorial.levelN.solutionCode.code`,
 * because their `//` comments are prose addressed to the player and a Russian
 * player was reading them in English. The JavaScript is byte-identical in every
 * locale and only the comments are translated, which `src/i18n/catalog.test.ts`
 * checks rather than trusts. Each level's lesson — what its program does wrong
 * and what the answer does instead — is still described in this file, above the
 * entry it belongs to.
 *
 * A {@link TutorialLevel} is structurally a {@link "./levels.ts"!Level}:
 * `options` and `condition` are named and typed to match, so a level can be
 * handed straight to the machinery that runs a level. Deliberately no
 * conversion function — a converter is a second place for the building to be
 * described, and the day it disagrees with this table the player plays a world
 * the solutions test never measured.
 */

import { t } from "../i18n/index.ts";
import {
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinTime,
  type LevelCondition,
} from "./levels.ts";
import type { RandomSeed } from "./random.ts";
import type { WorldOptions } from "./world.ts";

/**
 * One level: a building, a bar, the program the player is given, and the program
 * that clears it.
 *
 * `solutionCode` is reached through this table rather than through the test
 * that uses it because it is two things at once. It is the third hint — the
 * answer the player is shown after the two hints that do not give it away — and
 * it is the fixture the solutions test proves the level with. Those must be the
 * same bytes. Keeping the answer in the test file and the shown answer
 * somewhere else would leave the suite guarding a program nobody is ever given,
 * and the drift would be invisible: both copies still compile, both still pass,
 * and only the player is told something untrue. One string, reached one way, is
 * the version of this that cannot rot.
 *
 * The same argument puts `startingCode` here. It is what the editor is filled
 * with *and* what the test proves cannot win; a second copy would mean the
 * failure being demonstrated is not the failure being measured. Moving the text
 * into the catalog did not add a copy: it moved the one that exists, and the
 * table is still the only way anything reaches it.
 */
export interface TutorialLevel {
  /**
   * Stable identifier, used wherever a level has to survive being written down.
   *
   * A string rather than the position in this array, because the position is
   * the one thing about a level that is expected to change: inserting a ninth
   * level between two existing ones must not hand somebody the saved attempt,
   * the progress mark or the bookmarked address of a different level.
   */
  readonly id: string;
  /** The building the level is played in. */
  readonly options: WorldOptions;
  /** The bar that decides the run, built with the level constructors. */
  readonly condition: LevelCondition;
  /**
   * The seed this level is played on.
   *
   * Pinned rather than random, because "this program loses and that one wins"
   * is a statement about a particular stream of passengers. A random seed would
   * make the lesson a coin flip: a player could be shown a mistake that
   * happened to squeak past, which teaches the opposite of what was intended.
   * Each level is also measured on nine other seeds, so the pin buys
   * reproducibility rather than hiding a fluke.
   */
  readonly seed: RandomSeed;
  /**
   * The program the editor is filled with; contains the mistake to be found.
   *
   * A plain string, and read every time it is asked for rather than once:
   * {@link tutorialLevels} says why that matters.
   */
  readonly startingCode: string;
  /** The program that wins; shown as the last hint. Read the same way. */
  readonly solutionCode: string;
}

/**
 * Every level of the learning track, in the order they are played.
 *
 * The buildings are small on purpose. A level has to be legible while it runs —
 * the player is meant to watch the mistake happen, not read about it afterwards
 * — and every one of these is a run somebody can follow with their eyes.
 *
 * `startingCode` and `solutionCode` are getters rather than fields, for the
 * reason {@link "./fitness.ts"!fitnessLevels} is a function rather than the
 * constant it used to be: the programs are messages now, and a field in this
 * table would render them while this module is being imported — before
 * `main.ts` has a body to run, and so before anything has chosen a locale,
 * freezing all sixteen in the one language nobody had asked for. A getter is
 * read at the moment somebody needs the text: the editor when a level is opened,
 * the panel when the answer is drawn, the solutions test when it replays a run.
 * By then a language has been chosen, and a language chosen again later is
 * answered the next time either program is asked for.
 *
 * Every key is written out in full at the entry that uses it rather than built
 * from `id`, because a key assembled at runtime is a key the type checker
 * cannot see: the day a level is renamed, added or dropped, the compiler is the
 * one that should notice, not a player meeting an empty editor.
 */
export const tutorialLevels: readonly TutorialLevel[] = [
  /**
   * Level 1: an elevator that only ever visits one of the two floors.
   *
   * The mistake is visible from the shape of the code alone — one `goToFloor`
   * where a two-floor building needs two — and it is fatal rather than merely
   * slow: nobody is served at all, on any seed, however long the run.
   *
   * What that looks like on screen is worth stating exactly, because it is not
   * "an empty elevator standing still". {@link "./world.ts"!World} nudges a
   * standing car when a waiting passenger presses the button again, which sends
   * the car to the floor it is already on — doors open, people board. So the
   * parked car fills up (load factor 0.73 by 30 s on the pinned seed) and then
   * holds them there with `moveCount` at zero. A full elevator that delivers
   * nobody is a better first lesson than an empty one, and it is what the player
   * actually sees.
   *
   * The answer is the missing floor, added.
   */
  {
    id: "tutorial-1",
    // The smallest building in which "the elevator only visits one floor" can
    // even be said. The answer clears 10 deliveries by 22.8 s of its 60 on the
    // slowest of the ten measured seeds, and the starting code delivers nobody
    // at all on any of them, so this level's margin is as wide as a level's can be.
    options: { floorCount: 2, elevatorCount: 1, spawnRate: 0.5 },
    condition: requireUserCountWithinTime(10, 60),
    seed: "tutorial-1",
    get startingCode(): string {
      return t("tutorial.level1.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level1.solutionCode.code");
    },
  },
  /**
   * Level 2: nothing is subscribed, so nothing ever happens.
   *
   * The elevator is fetched and then never told anything. Written this way rather
   * than as an empty `init` so that the first line of the answer is already on
   * screen: the lesson is that a program is a set of handlers, and the player has
   * to reach for `on("idle")` unprompted.
   *
   * The answer is a round trip, restarted every time the car falls idle.
   */
  {
    id: "tutorial-2",
    // One floor more than level 1 and the same traffic: the step being taught is
    // writing the handler, not surviving a busier building. Answer: 36.5 s of
    // 60 at worst. Starting code: nobody moves, so it cannot win at any rate.
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.5 },
    condition: requireUserCountWithinTime(15, 60),
    seed: "tutorial-2",
    get startingCode(): string {
      return t("tutorial.level2.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level2.solutionCode.code");
    },
  },
  /**
   * Level 3: passengers get in and are never taken anywhere.
   *
   * The car returns to the ground floor and stops, which means it does open its
   * doors and does pick people up — and then ignores every button they press.
   * That is the point of the level: the first event that comes *from* the
   * simulation rather than from the car's own idleness.
   *
   * The answer listens to the buttons inside the car.
   */
  {
    id: "tutorial-3",
    // Four floors, so that a passenger's destination is genuinely ambiguous and
    // ignoring the cabin buttons is visibly not the same as being slow.
    // Answer: 40.1 s of 60 at worst. Starting code: 0 delivered on every seed.
    options: { floorCount: 4, elevatorCount: 1, spawnRate: 0.6 },
    condition: requireUserCountWithinTime(15, 60),
    seed: "tutorial-3",
    get startingCode(): string {
      return t("tutorial.level3.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level3.solutionCode.code");
    },
  },
  /**
   * Level 4: a destination queue that is filled and never started.
   *
   * The only level whose bug is in the API rather than in the reasoning, and the
   * reason it is a level at all is that assigning `destinationQueue` looks like it
   * should work and silently does not. Presented as somebody else's rewrite of
   * the round trip from level 2, so that the player is debugging a change rather
   * than being quizzed on a method they have never seen.
   *
   * The answer tells the car to look at the queue it was handed.
   */
  {
    id: "tutorial-4",
    // Spawn rate 0.8, raised from the 0.6 docs/tutorial-plan.md first proposed.
    // At 0.6 the answer's slowest measured seed finished at 56.0 s of 60 — a
    // level that survives by four seconds is a level that breaks the next time
    // the physics is touched, which is precisely the event this whole exercise
    // exists to catch. Raising the traffic costs the lesson nothing, because the
    // starting code never moves the car and so delivers nobody at *any* rate:
    // only the answer's side of the gap moves, and it moves to 45.3 s of 60 at
    // worst.
    options: { floorCount: 4, elevatorCount: 1, spawnRate: 0.8 },
    condition: requireUserCountWithinTime(15, 60),
    seed: "tutorial-4",
    get startingCode(): string {
      return t("tutorial.level4.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level4.solutionCode.code");
    },
  },
  /**
   * Level 5: a sweep of all nine floors, most of which nobody is waiting on.
   *
   * The first level that is not broken. It works, it is just slow, and it is slow
   * for a reason the player can name: the car spends its time on empty floors.
   * This is the first level judged on waiting rather than on throughput, because
   * the cost of a pointless stop is paid by the person watching the car go the
   * other way, and the clock the player is asked to think about should be theirs.
   *
   * The answer goes where somebody actually pressed a button.
   */
  {
    id: "tutorial-5",
    // Nine floors, where the plan says ten. On ten the answer's worst wait was
    // 27.6 s against the planned limit of 28 — four tenths of a second of
    // margin, i.e. none. The options were all measured: a limit of 32 on ten
    // floors still left only 4.4 s; capacity changes did nothing at all, because
    // at 0.2 passengers a second a four-person car is never the constraint; and
    // dropping the rate to 0.15 worked but stretched the run past 110 simulated
    // seconds, which is a long time to watch a car go to floors nobody is
    // standing on. Nine floors is the fix that keeps the lesson, since a sweep
    // is still eight wasted stops.
    //
    // The limit is 37, and it was 26 until four hundred seeds no threshold had
    // been fitted to were run against it. 26 was a ten-seed number and it
    // rejected the *answer* on 22 of those 400 — worst on seed t61, where the
    // correct program is stopped at 7 of the 15 delivered. There is no limit
    // that both accepts every answer and rejects every sweep, which is measured
    // rather than feared: the answer's worst wait is 35.88 s (seed u59) and the
    // sweep's best run delivers all 15 having made nobody wait longer than
    // 25.03 s (seed t88), so the two ranges overlap by eleven seconds. Of what
    // is left, 36 is the lowest limit the answer never loses to and it leaves
    // 0.12 s, which is not margin; 37 leaves 1.12 s. It costs the sweep 76 wins
    // in 400 where 26 cost it one, and that direction is the deliberate one: a
    // player wrongly told their correct program failed has nothing left to try,
    // while a player waved through meets the same lesson in level 1, where
    // a sweep of the building will not carry them. `tutorial-solutions.test.ts`
    // records the one seed of its own ten on which the sweep now wins.
    options: { floorCount: 9, elevatorCount: 1, spawnRate: 0.2 },
    condition: requireUserCountWithMaxWaitTime(15, 37),
    seed: "tutorial-5",
    get startingCode(): string {
      return t("tutorial.level5.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level5.solutionCode.code");
    },
  },
  /**
   * Level 6: indicators that lie, so half the building refuses to board.
   *
   * The subtlest failure in the track, and the one that most looks like bad luck:
   * the program is level 5's answer, correct in every line, plus two lines that
   * announce the car is going up and not down. Passengers believe the indicators,
   * so everyone heading down lets the car go and presses again, and the wait
   * clock keeps running on somebody the car has already visited.
   *
   * The answer admits the car goes both ways. Both indicators lit is the honest
   * statement of a program that has no notion of direction, and it is what a car
   * is built with, so deleting the two lines is the same program and the same
   * run — the hints offer that as the answer too. Switching them both *off* is
   * emphatically not the same program, which is worth knowing before anyone
   * writes that in a hint: a passenger boards only a car that admits it goes
   * their way, so an unlit car is one nobody enters, and it delivers nobody at
   * all on every seed measured. The answer says `true` twice rather than saying
   * nothing, because the lesson is what the indicators *say*, and "say yes to
   * everyone until you have something truer to say" needs a line to point at.
   */
  {
    id: "tutorial-6",
    // Spawn rate 0.25, where the plan says 0.3. At 0.3 the answer did not merely
    // scrape past, it *lost*: on seed "xyz" the lying indicators are not the only
    // thing keeping people waiting, and a single car serving five floors at that
    // rate reached exactly 25.0 s of wait with 11 delivered — the correct program
    // failing the level it is the answer to. Thinning the traffic separates the
    // two causes, which is the point: what should fail here is the lie, not the
    // load.
    //
    // It did not thin them as far as ten seeds suggested. Those ten put the
    // window at (16.7, 45.7) and the limit at 25; four hundred seeds nobody had
    // fitted a threshold to show there is no window at all. The answer's worst
    // wait is 25.07 s — seed u59, where the planned limit of 25 threw out the
    // correct program with 14 of the 15 delivered — and the liar's best run
    // gets all fifteen out having made nobody wait longer than 21.92 s (seed
    // t199), so the liar's good runs are better than the answer's bad ones by
    // three seconds. What the four hundred do show is a shelf: at every limit
    // from 26 to 30 the answer wins all 400 and the liar wins 3, so the number
    // is chosen inside it rather than at an edge, both edges being where a tail
    // this thin is least trustworthy. 28 it is, and 400/400 on two further
    // unseen sets agrees.
    options: { floorCount: 5, elevatorCount: 1, spawnRate: 0.25 },
    condition: requireUserCountWithMaxWaitTime(15, 28),
    seed: "tutorial-6",
    get startingCode(): string {
      return t("tutorial.level6.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level6.solutionCode.code");
    },
  },
  /**
   * Level 7: two elevators, one of which is never used.
   *
   * `elevators[0]` was harmless in every building so far and is exactly wrong
   * here, which is the whole lesson: the mistake is not a typo, it is an
   * assumption that quietly stopped holding. The second car sits still for the
   * entire run while the first one falls behind the traffic.
   *
   * The answer sends each call to the emptiest car. `loadFactor` rather than
   * queue length because it is the measure a player can check against what they
   * see on screen — a full car is drawn full. Any dispatch rule that uses both
   * cars wins this building; the hints say so, since a level that only accepts
   * one program teaches copying rather than dispatching.
   */
  {
    id: "tutorial-7",
    // 1.2 passengers a second over six floors. The plan had already retuned
    // this level once; the numbers still hold. Answer: 28 delivered by 48.3 s of
    // 60 at worst. Starting code: 23 of the required 28 on its best seed, which
    // is the number the threshold of 28 was placed above.
    //
    // What 28 does not do is *force* the lesson. Delete the hall-call block
    // from the starting code and the one car left driving, wandering between
    // cabin destinations, delivers up to 32 in the same 60 s and wins eight of
    // the ten seeds including this one — a program strictly smaller than the
    // one the player is handed, and one that never touches the second car.
    // Requiring 33 would exclude every one-car program measured while the
    // answer still wins on all ten seeds, its worst delivering 36. The bar is
    // left at the plan's 28 anyway: what this table guarantees is that the
    // given program loses and the shown answer wins, which holds either way,
    // and how hard a level leans on its lesson is the curriculum's decision, not
    // the harness's. Measured and reported rather than quietly retuned.
    options: { floorCount: 6, elevatorCount: 2, spawnRate: 1.2 },
    condition: requireUserCountWithinTime(28, 60),
    seed: "tutorial-7",
    get startingCode(): string {
      return t("tutorial.level7.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level7.solutionCode.code");
    },
  },
  /**
   * Level 8: an empty program, in the building level 1 is played in.
   *
   * The graduation level, and the only one whose starting code contains no mistake
   * to find, because there is nothing to fix — there is something to write. An
   * empty `init` is also the most honest possible measurement of whether the
   * track worked: no scaffolding, and the same building the player walks into
   * next if they press on to the real levels.
   *
   * The answer is level 7's answer, word for word and deliberately so.
   */
  {
    id: "tutorial-8",
    // Level 1's building and level 1's bar, copied deliberately: the
    // graduation level is passing the game's own first level, and a level that
    // was merely *similar* to it would make that claim false.
    //
    // That identity is also why this level keeps the thinnest margin in the
    // track. At 0.3 passengers a second the 15th passenger does not exist before
    // t ≈ 46.7 s, so the entire 60-second budget contains about 13 seconds of
    // slack no program can widen; the answer's slowest measured seed finishes at
    // 58.2 s. Every way of widening it — more traffic, more floors, a lower bar
    // — widens it by no longer being level 1. Measured, not assumed: the
    // answer wins on all ten seeds, and `tutorial-solutions.test.ts` holds this
    // one level to a smaller margin than the rest and says why.
    //
    // On four hundred seeds it wins 399. The one it loses is t165, where 14 are
    // out by the 60-second bar and the fifteenth arrives some ten seconds later.
    // That number is level 1's, not this level's, and it must not be tuned
    // away: `tutorial-sweep.test.ts` plays the same answer over the same four
    // hundred seeds in the building and against the bar read out of
    // `levels.ts`, loses the same single seed, and pins both counts at
    // exactly 399 — because anything that lifts this level to 400 does it by
    // making the graduation level no longer the game's own first level.
    //
    // Level 8 asks for nothing new; what it measures is whether the player can
    // now write, on an empty page, what they have spent seven levels assembling.
    // So its answer is level 7's, and it is written out under this level's own key
    // rather than pointed at level 7's, so that every level owns the same eight
    // messages and a translator meets no exception. `tutorial.test.ts` holds the
    // two equal in every locale, which is what a copy needs in order to be
    // allowed to exist.
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requireUserCountWithinTime(15, 60),
    seed: "tutorial-8",
    get startingCode(): string {
      return t("tutorial.level8.startingCode.code");
    },
    get solutionCode(): string {
      return t("tutorial.level8.solutionCode.code");
    },
  },
];
