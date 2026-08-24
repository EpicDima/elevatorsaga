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
import {
  requireUserCountWithMaxWaitTime,
  requireUserCountWithinMoves,
  requireUserCountWithinMovesWithMaxWaitTime,
  requireUserCountWithinTimeWithMaxWaitTime,
  type LevelCondition,
} from "./levels.ts";
import {
  requireAll,
  underAvgWaitTime,
  underElapsedTime,
  underMaxWaitTime,
  underMoveCount,
  type LevelTierRequirements,
} from "./level-tiers.ts";
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
   * The card drawn beside the building, on the levels that have one.
   *
   * Most do not, and that is the point of the field being optional. A card is
   * for the level where a player meets a mechanic for the first time — traffic
   * profiles at `sky-2`, zoning at `sky-8`, destination dispatch at `sky-11` —
   * and a block where every level carried one
   * would be a block that stops the player to explain something on every visit,
   * spending the widest column on the screen to say what the previous level
   * already said. Where there is no card the region collapses and the building
   * takes the space back.
   *
   * One optional object rather than two optional strings, so that "a title and
   * a paragraph, or neither" is the shape of the type rather than a rule
   * somebody has to remember: a level cannot end up with a heading over an
   * empty card, and the page has one question to ask rather than two.
   */
  readonly card?: SkyscraperCard;
}

/** The name and the paragraph of a level that introduces something new. */
export interface SkyscraperCard {
  /**
   * The level's name.
   *
   * Carried here because nothing else on screen can carry it. The switcher's
   * trigger is 118px wide and says "Tower 3" — its own message comment explains
   * why the longer labels overflow there — and the goal bar says what the level
   * asks for, not what it is about.
   */
  readonly title: string;
  /** One paragraph on the idea the level is built on. Catalog markup. */
  readonly briefing: string;
}

/**
 * Every level of the Skyscraper block, in the order they are played.
 *
 * `startingCode` and `card` are getters rather than fields, for the reason
 * `tutorial.ts` spells out at `tutorialLevels`: both are messages, and a field
 * here would render them while this module is being imported — before anything
 * has chosen a locale, freezing them in the one language nobody asked for. A
 * getter is read at the moment somebody needs the text, by which time a
 * language has been chosen, and a language chosen again later is answered the
 * next time either of them is asked for. A `card` getter builds a fresh object
 * on every read for that same reason: the object is two messages, so it has to
 * be composed in the language being drawn rather than once, in whichever
 * language came first.
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
   * that a car spends more of its life traveling than loading, which is the
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
  },
  /**
   * Up-peak, small enough to watch: ten floors, two cars, six seats, and a
   * profile that puts every passenger of the run in the lobby going up.
   *
   * The first level of the three traffic pairs, and the shortest. Its whole job
   * is to make one fact visible in a single run — under `"up-peak"` the buttons
   * upstairs never light, so choosing a car for a call decides nothing and the
   * only figure left to move is how many people ride out per trip.
   *
   * Measured at the pinned seed with the harness in
   * `skyscraper-solutions.test.ts`. The budget is 60 moves for twenty people:
   * when it runs out the shipped starter has delivered 15 of them and
   * `DEV_TEST_CODE` 19, while the sweep `sky-3` ships with finishes in 45 moves
   * and `GOOD_CODE_BALANCED` in 45 as well — a quarter of the budget still
   * unspent. No `tiers`: a level that exists to show a profile has nothing to
   * say about silver.
   */
  {
    id: "sky-2",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 1.0,
      elevatorCapacities: [6],
      trafficProfile: "up-peak",
    },
    condition: requireUserCountWithinMoves(20, 60),
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky2.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky2.title"),
        briefing: t("skyscraper.sky2.briefing.html"),
      };
    },
  },
  /**
   * The same morning at scale, and the block's first level with medals: sixteen
   * floors, four cars of ten, eighty passengers out of one lobby.
   *
   * Opens with the sweep rather than the round-robin starter, because the
   * lesson of `sky-2` is assumed here and repeating its failure at this size
   * would only be slower, not more instructive. What the level asks for on top
   * is the thing a heavy up-peak actually rewards — a car that leaves full.
   *
   * Measured at the pinned seed. `DEV_TEST_CODE` has delivered 70 of the eighty
   * when the 300-move budget runs out. The starter shipped here finishes in 201
   * moves at 19.2s average wait, and `GOOD_CODE_BALANCED` in 195 at 15.8s. So
   * silver at 250 moves is the starter's for free — it is meant to be, the
   * level does not begin by taking something away — and gold needs 220 moves
   * *and* an average wait under 17s, which the starter misses on the wait by
   * two and a half seconds while `GOOD_CODE_BALANCED` takes both. Two axes
   * rather than one because moves alone would hand gold to a program that holds
   * every car in the lobby until the building has emptied itself into them.
   */
  {
    id: "sky-3",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [10],
      trafficProfile: "up-peak",
    },
    condition: requireUserCountWithinMoves(80, 300),
    tiers: {
      silver: underMoveCount(250),
      gold: requireAll(underMoveCount(220), underAvgWaitTime(17)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky3.startingCode.code");
    },
  },
  /**
   * Down-peak, small: twelve floors, two cars, and the lobby as everybody's
   * destination instead of everybody's origin.
   *
   * The starter is `sky-2`'s program again, deliberately — nothing about it has
   * become wrong in a new way. Its `idle` handler sends a free car to floor 0,
   * which was exactly right this morning and is now the one floor with nobody
   * on it, so every trip begins with a climb the run has already paid for.
   *
   * Measured at the pinned seed. The budget is 125 moves for twenty-five
   * people, and both one-errand-at-a-time programs are stranded at 23 of them
   * when it runs out — the shipped starter and `DEV_TEST_CODE` alike. The sweep
   * finishes in 72 moves. Note where `GOOD_CODE_BALANCED` lands: it clears, but
   * in 116, nine moves inside the budget rather than the fifty-three the sweep
   * has, because its own parking rule is the lobby too. That is the level's
   * point arriving from a direction nobody arranged, and the reason the budget
   * is 125 rather than 130.
   */
  {
    id: "sky-4",
    options: {
      floorCount: 12,
      elevatorCount: 2,
      spawnRate: 1.3,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
    },
    condition: requireUserCountWithinMoves(25, 125),
    seed: 2,
    get startingCode(): string {
      return t("skyscraper.sky4.startingCode.code");
    },
  },
  /**
   * The evening at scale, and the only level of the block judged on the clock
   * and the longest single wait rather than on floors crossed.
   *
   * Deliberately a different pair of axes from `sky-3`'s. What a down-peak does
   * badly is not waste distance — it forgets somebody: a car fills on the way
   * down and passes the floors below it with no room, and `User.elevatorAvailable`
   * puts the passenger it passed back to pressing the button. Scoring that in
   * moves would miss it entirely, because the moves happened.
   *
   * Measured at the pinned seed. The condition is fifty-five people inside 80
   * seconds with nobody waiting more than 75. `DEV_TEST_CODE` is at 52 of them
   * when the clock runs out. The starter shipped here — the sweep again — lands
   * at 74.85s with a longest wait of 65.43s, and `GOOD_CODE_BALANCED` at 64.93s
   * with 61.40s. Silver is under 72 seconds and gold under 68 with no wait over
   * 63, so the starter earns bronze and `GOOD_CODE_BALANCED` gold: the one
   * level in the block where the program already in the editor has a medal, and
   * the run is about improving on it rather than about reaching it.
   */
  {
    id: "sky-5",
    options: {
      floorCount: 14,
      elevatorCount: 3,
      spawnRate: 1.7,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
    },
    condition: requireUserCountWithinTimeWithMaxWaitTime(55, 80, 75),
    tiers: {
      silver: underElapsedTime(72),
      gold: requireAll(underElapsedTime(68), underMaxWaitTime(63)),
    },
    seed: 1,
    get startingCode(): string {
      return t("skyscraper.sky5.startingCode.code");
    },
  },
  /**
   * Lunch, small: nine floors, two cars, five seats, and demand in both
   * directions for the first time in the block.
   *
   * `"lunch"` draws each passenger either lobby-to-floor or floor-to-lobby, so
   * every trip touches floor 0 at one end. That is the first building here
   * where a car has somewhere useful to be in both directions, and so the first
   * where the round trip `sky-1` named can be made to carry somebody the whole
   * way round rather than half of it.
   *
   * Measured at the pinned seed. The budget is 56 moves for twenty people, and
   * it is the tightest in the block: at 56 the shipped starter has delivered 13
   * and `DEV_TEST_CODE` 14, while the sweep finishes in 41 moves and
   * `GOOD_CODE_BALANCED` in 50. Nine floors rather than twelve for exactly that
   * reason — the shorter shaft is what keeps `GOOD_CODE_BALANCED` inside the
   * budget instead of pushing it out with the naive pair, and a demonstrating
   * level that the repository's best dispatcher fails is a level demonstrating
   * the wrong thing.
   */
  {
    id: "sky-6",
    options: {
      floorCount: 9,
      elevatorCount: 2,
      spawnRate: 1.0,
      elevatorCapacities: [5],
      trafficProfile: "lunch",
    },
    condition: requireUserCountWithinMoves(20, 56),
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky6.startingCode.code");
    },
  },
  /**
   * The last of the traffic levels: twelve floors, three cars of eight, midday
   * demand, and sixty passengers scored in moves.
   *
   * Back to the round-robin starter one final time, in the building where it is
   * worst. Everything a car does here it does twice — out of the lobby loaded,
   * back to the lobby loaded — so a leg carrying nobody is the only thing there
   * is to lose, which is exactly what "one errand at a time" spends.
   *
   * Measured at the pinned seed. The budget is 210 moves for sixty people; the
   * shipped starter is at 39 of them when it runs out and `DEV_TEST_CODE` at
   * 43. The sweep finishes in 142 moves with a longest wait of 55.45s, and
   * `GOOD_CODE_BALANCED` in 184 with 65.86s. Silver is under 190 moves with no
   * wait over 70, gold under 150 moves — and the ordering that falls out is
   * worth stating, because it inverts `sky-3`'s: the plain sweep takes gold and
   * `GOOD_CODE_BALANCED` only silver. Its load cutoff holds a car at a floor
   * waiting to fill, which is the right instinct at an up-peak and a bad one
   * when the next call is as likely to be above the car as below it. The wait
   * clause on silver is what stops a program buying moves with a queue nobody
   * ever gets served from.
   */
  {
    id: "sky-7",
    options: {
      floorCount: 12,
      elevatorCount: 3,
      spawnRate: 1.4,
      elevatorCapacities: [8],
      trafficProfile: "lunch",
    },
    condition: requireUserCountWithinMoves(60, 210),
    tiers: {
      silver: requireAll(underMoveCount(190), underMaxWaitTime(70)),
      gold: underMoveCount(150),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky7.startingCode.code");
    },
  },
  /**
   * Zoning, small enough to watch it go wrong: ten floors, two cars, and a
   * building where one of them stops below the fifth floor and the other at the
   * fifth and above. Both serve the lobby, as every real zoned building does —
   * the split is of the floors people are going to, not of the one they are all
   * coming from.
   *
   * The block's second card, because this is where `servedFloors()` is met. It
   * is also the level where a wrong assignment does something no other level in
   * the game does — it *strands* a floor for good, and the three sentences that
   * explain why are the reason this entry has the longest comment in the file.
   *
   * A floor emits `up_button_pressed` only when its lamp goes from dark to lit
   * (`floor.ts`), and a car that does not serve a floor clears no lamp when it
   * arrives (`Floor.elevatorAvailable` returns before touching them). So the
   * sequence is: a zone-blind program sends the wrong car, the passenger refuses
   * to board and presses again, the lamp is already lit, no event is emitted,
   * and no program of any cleverness ever hears about that floor again.
   * `World`'s button-repressing rescue is no help either — it runs on emitted
   * presses. The floor is simply dead for the rest of the run.
   *
   * Which is why the bar is a wait cap and not a move budget, and this is the
   * one threshold in the block chosen for a mechanical reason rather than a
   * measured one. A stranded run stops moving: `moveCount` stops growing, so
   * `requireUserCountWithinMoves` never resolves, and the level would hang
   * rather than lose — `skyscraper-solutions.test.ts` would report it as still
   * undecided instead of failing the program that caused it.
   * `requireUserCountWithMaxWaitTime` resolves it as the loss it is, because
   * `world.maxWaitTime` keeps climbing with the people nobody is coming for.
   *
   * Measured at the pinned seed. Twenty people, nobody waiting over 35 seconds.
   * Both zone-blind programs strand the building and lose on the cap with 9 and
   * 10 delivered — the plain sweep this level ships, and `DEV_TEST_CODE`.
   * Adding the filter is the whole repair: the same sweep, asking
   * `servedFloors()` before it hands a call to a car, finishes in 56 moves with
   * a longest wait of 21.48s, and `GOOD_CODE_BALANCED` — which has the filter
   * since `level-reference-code.ts` learned about zones — in 52 with 27.36s.
   *
   * Small numbers on purpose. Two cars, six seats and 0.8 arrivals a second is
   * a building nobody is short of capacity in, so the only thing that can go
   * wrong here is the assignment, which is the one thing the level is about.
   */
  {
    id: "sky-8",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 0.8,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8, 9],
      ],
    },
    condition: requireUserCountWithMaxWaitTime(20, 35),
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky8.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky8.title"),
        briefing: t("skyscraper.sky8.briefing.html"),
      };
    },
  },
  /**
   * Two banks at scale: sixteen floors, four cars, the low eight and the high
   * nine, and an evening rush going down through both of them.
   *
   * Down-peak rather than up-peak, and that is the level's design rather than a
   * preference. Under `"up-peak"` every call comes from floor 0, which every car
   * serves, and the only other event a program hears is `floor_button_pressed`
   * from inside a car whose passenger boarded it — so a zone-blind program is
   * never once punished and the mechanic is invisible. Going down, the calls are
   * upstairs where the zones are, and the filter is the whole game.
   *
   * The bar carries a wait cap for `sky-8`'s reason: a stranded run stops
   * spending moves, and a move budget alone would leave it undecided rather than
   * lost. Sixty people inside 310 moves, nobody over 85 seconds.
   *
   * Measured at the pinned seed. The plain sweep strands the building and loses
   * on the cap with 20 delivered; `DEV_TEST_CODE` with 7. The zone-aware sweep
   * this level ships finishes in 277 moves at 20.89s average and a longest wait
   * of 76.00s — bronze, and not a comfortable one. `GOOD_CODE_BALANCED` takes
   * gold in 279 moves at 14.81s average with a longest wait of 61.81s.
   *
   * So the medals are wait figures and not moves: the two programs that finish
   * spend within two moves of each other, and every second of the difference
   * between them is in who was asked to wait. Silver is a longest wait under
   * 70s; gold under 65 with an average under 16. A move threshold here would
   * award the same tier to both and measure nothing.
   */
  {
    id: "sky-9",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [8],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [0, 8, 9, 10, 11, 12, 13, 14, 15],
      ],
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(60, 310, 85),
    tiers: {
      silver: underMaxWaitTime(70),
      gold: requireAll(underMaxWaitTime(65), underAvgWaitTime(16)),
    },
    seed: 2,
    get startingCode(): string {
      return t("skyscraper.sky9.startingCode.code");
    },
  },
  /**
   * The last of the zoned levels, and the first building whose banks overlap:
   * fifteen floors, four cars, floors 1-5 low only, 9-14 high only, and 6, 7
   * and 8 served by both.
   *
   * What the overlap adds is a decision the two disjoint banks of `sky-9` never
   * offered. There, a call had exactly one bank that could answer it and the
   * filter was the whole answer; here three of the fifteen floors can be
   * answered by either, and a program that always hands them to the same bank
   * has invented a queue for itself.
   *
   * Same shape of bar as `sky-9` and for the same reason — sixty people inside
   * 300 moves with nobody over 75 seconds, the cap being what turns a stranded
   * run into a loss rather than a hang.
   *
   * Measured at the pinned seed, and this is the level where the four programs
   * spread furthest. The plain sweep runs out of moves with 42 delivered and
   * `DEV_TEST_CODE` with 36 — neither strands the building outright, because
   * every floor here is reachable by a car the round-robin will eventually
   * offer it to, they simply waste the budget on cars that refuse. The
   * zone-aware sweep this level ships finishes in 238 moves, 23.02s average,
   * 57.31s longest — silver. `GOOD_CODE_BALANCED` finishes in the same 238
   * moves at 16.32s average and 51.52s longest — gold.
   *
   * Which is exactly the shape of the overlap: identical distance traveled,
   * six and a half seconds a person of difference in who was made to wait for
   * it. So silver is a longest wait under 60s, and gold asks for 250 moves
   * *and* an average under 18 — the move clause being what stops a program
   * buying the average by driving both banks over the middle floors all run.
   */
  {
    id: "sky-10",
    options: {
      floorCount: 15,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [8],
      trafficProfile: "down-peak",
      elevatorServedFloors: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [0, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      ],
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(60, 300, 75),
    tiers: {
      silver: underMaxWaitTime(60),
      gold: requireAll(underMoveCount(250), underAvgWaitTime(18)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky10.startingCode.code");
    },
  },
  /**
   * Destination dispatch, small and going down: ten floors, two cars of six,
   * and a building with no call buttons on any wall.
   *
   * The block's third card, and the last mechanic it introduces. What changes
   * is who decides which car somebody takes. Everywhere else in the game a
   * passenger boards whatever turns up pointing their way; here they name a
   * floor, wait for the car the program promised them, and board that one and
   * nothing else — so `takeRequest` is the only way anybody ever gets on.
   *
   * The starter books every journey and sends nothing, which is the mistake the
   * mechanic invites rather than a strawman: booking reads like dispatching and
   * is not. At the moment the run is lost both cars are still standing empty in
   * the lobby, `moveCount` is zero, and every floor above has its trip down
   * marked as answered — thirty-seven people behind a promise nobody kept.
   *
   * Which is why the bar is a wait cap rather than a move budget, for `sky-8`'s
   * reason arrived at from the other side. Nothing moves at all, so `moveCount`
   * never grows, and a move budget would leave that run undecided forever
   * instead of losing it.
   *
   * Measured at the pinned seed. Twenty people, nobody over 45 seconds. Four
   * programs lose here and every one of them delivers nobody at all: the starter
   * because it never sends a car, and the sweep, the editor's own default and
   * the reference dispatcher because the call-button events they are built on
   * are never raised in this building. `sky-12`'s starter — the same rotation
   * with `goToFloor` added — takes bronze with twenty-two delivered in 81 moves
   * and a longest wait of 19.66s.
   */
  {
    id: "sky-11",
    options: {
      floorCount: 10,
      elevatorCount: 2,
      spawnRate: 0.8,
      elevatorCapacities: [6],
      trafficProfile: "down-peak",
      destinationDispatch: true,
    },
    condition: requireUserCountWithMaxWaitTime(20, 45),
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky11.startingCode.code");
    },
    get card(): SkyscraperCard {
      return {
        title: t("skyscraper.sky11.title"),
        briefing: t("skyscraper.sky11.briefing.html"),
      };
    },
  },
  /**
   * Midday in a fourteen-floor tower, three cars of eight, and the first level
   * where the choice of car is the whole score.
   *
   * Opens with `sky-11`'s answer, so it opens already winning: the rotation
   * books a car and sends it, which is enough to clear the bar and not much
   * else. What it spends the budget on is distance — the car whose turn it is
   * is as likely to be at the far end of the building as beside the floor
   * asking, and under destination dispatch nobody else can pick that trip up on
   * the way, because nobody boards a car that was not booked for them.
   *
   * The wait cap is on the condition for the reason every level of this group
   * carries one: a program that books without sending stops the building dead,
   * and only the cap turns that into a loss rather than a run nobody can end.
   *
   * Measured at the pinned seed, and the three tiers are three different
   * programs rather than three guesses about one. Fifty people inside 330 moves,
   * nobody over 80 seconds: the rotation takes bronze with 309 of those moves,
   * so it wins by the width of the level and no more. The same program picking
   * the nearest car with room instead of the next one in turn — which is
   * `sky-13`'s starter — spends 144 and takes silver. Booking one car for
   * several of a floor's journeys at once brings it to 115 at a 20.45s average,
   * which is gold, and is `sky-13`'s subject arriving early.
   */
  {
    id: "sky-12",
    options: {
      floorCount: 14,
      elevatorCount: 3,
      spawnRate: 1.4,
      elevatorCapacities: [8],
      trafficProfile: "lunch",
      destinationDispatch: true,
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(50, 330, 80),
    tiers: {
      silver: underMoveCount(200),
      gold: requireAll(underMoveCount(130), underAvgWaitTime(22)),
    },
    seed: 1,
    get startingCode(): string {
      return t("skyscraper.sky12.startingCode.code");
    },
  },
  /**
   * The block's last level: the morning rush in a sixteen-floor tower, four
   * cars of ten, eighty passengers, and every one of them standing in the same
   * lobby naming a different floor.
   *
   * Up-peak on purpose, and it is the one arrangement where destination
   * dispatch has something no other dispatching rule can match. Every journey
   * of the run starts on floor 0, so the floor's book is a list of where the
   * queue is going — and a car booked for one of those trips can be booked for
   * the rest of them on its way up, which is what
   * `floor.pendingDestinations()` is for. The three levels before this one are
   * each about one journey at a time; this is the one where they stop being
   * separate.
   *
   * Measured at the pinned seed. Eighty people inside 340 moves, nobody over 90
   * seconds. The starter — the nearest car with room, answering one request at
   * a time — takes bronze in 193 moves at a 15.34s average. Grouping brings that
   * to 114 and costs 25.47s, and gold asks for both halves of that trade at once
   * because either one alone has a bad program that meets it: a car sent out
   * half full keeps the average down and spends the building's moves, and a car
   * that waits to fill spends none and leaves somebody standing.
   */
  {
    id: "sky-13",
    options: {
      floorCount: 16,
      elevatorCount: 4,
      spawnRate: 2.0,
      elevatorCapacities: [10],
      trafficProfile: "up-peak",
      destinationDispatch: true,
    },
    condition: requireUserCountWithinMovesWithMaxWaitTime(80, 340, 90),
    tiers: {
      silver: underMoveCount(170),
      gold: requireAll(underMoveCount(140), underAvgWaitTime(28)),
    },
    seed: 0,
    get startingCode(): string {
      return t("skyscraper.sky13.startingCode.code");
    },
  },
];
