/**
 * The application: challenges, the world controller, and the wiring between
 * the editor, the presenters and the URL.
 *
 * Ported from the `$(function() { ... })` block of the legacy `app.js`.
 */

import { createSandboxChallenge } from "../game/challenges.ts";
import type { Challenge, SandboxOptions } from "../game/challenges.ts";
import { tutorialTasks } from "../game/tutorial.ts";
import type { TutorialTask } from "../game/tutorial.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import type { AnimationFrameRequester, WorldController } from "../game/world-controller.ts";
import { t } from "../i18n/index.ts";
import { defaultCode } from "../ui/default-code.ts";
import { clearChildren } from "../ui/dom.ts";
import { CODE_STORAGE_KEY } from "../ui/editor.ts";
import type { CodeEditor } from "../ui/editor.ts";
import {
  clearAll,
  clearCodeStatus,
  containsFocus,
  presentChallenge,
  presentCodeStatus,
  presentFeedback,
  presentStats,
  presentWorld,
  relabelWorld,
  setDemoFullscreen,
} from "../ui/presenters.ts";
import type { ChallengePresenter } from "../ui/presenters.ts";
import type { ChallengeLinkData, SeedLinkData } from "../ui/templates.ts";
import { presentTutorial } from "../ui/tutorial-panel.ts";
import { createParamsUrl } from "./router.ts";
import type { RouteParams, RouteQuery } from "./router.ts";
import { clampTimeScale, decreasedTimeScale, increasedTimeScale } from "./time-scale.ts";
import {
  countClearedTutorialTasks,
  firstUnclearedTutorialTask,
  readClearedTutorialTasks,
  recordClearedTutorialTask,
} from "./tutorial-progress.ts";

declare global {
  interface Window {
    /**
     * The world currently being played.
     *
     * A long-standing debugging hook: the wiki's solutions and half the bug
     * reports poke at `world` from the browser console, so it stays.
     *
     * It also hands the simulation to the player's program, which runs in
     * global scope, so `world.transportedCounter = 999999` in `init` wins any
     * challenge. That has been known since 2015 and is left open on purpose:
     * nothing is scored outside this browser tab, and the half-measures --
     * read-only counters, a write-blocking proxy -- only cost debuggability
     * while leaving `world.users` and `world.elevators` reachable. Closing it
     * for real means running the player's code in a worker or an iframe, which
     * is worth doing on the day a scoreboard exists and not before. The
     * options and their prices are laid out in `docs/fork-survey.md`.
     */
    world: World | undefined;
  }
}

/** Where the chosen simulation speed is remembered between visits. */
export const TIME_SCALE_STORAGE_KEY = "elevatorTimeScale";

/**
 * Stands in for a program that did not compile.
 *
 * The legacy code passed `null` to the world controller, which then threw a
 * TypeError on the first frame and reported *that* instead of the compilation
 * error the player actually needs to see. The compilation error is already in
 * the banner by this point, so the world simply does nothing.
 */
const NO_OP_CODE = {
  init: (): void => undefined,
  update: (): void => undefined,
};

/** The challenge bar's title, which a run outside the list rewrites once the bar is drawn. */
const CHALLENGE_TITLE_SELECTOR = ".challengetitle";

/** The link of the end-of-run overlay, whose words the last task of the track rewrites. */
const FEEDBACK_LINK_SELECTOR = ".feedback a";

/**
 * The number a run outside {@link App.challenges} is drawn with before its
 * title is rewritten.
 *
 * The bar's template renders `Challenge #{num}:` in front of every description,
 * and neither the sandbox nor a task of the learning track is challenge
 * anything. Both are given a number no challenge can have — they are one-based,
 * and the router refuses `#challenge=0` — so that if the rewrite below ever
 * fails to find the title, what shows is obviously not an invitation to type
 * `#challenge=0` into the address bar.
 */
const UNNUMBERED_CHALLENGE_NUM = 0;

/**
 * Turns the hash URL of a run into one that can be pasted somewhere else.
 *
 * The bar's link stays relative, because that is what a link in a page should
 * be and the browser resolves it when the player copies the address. The console
 * cannot copy anything, so what it prints has to be complete on its own.
 *
 * @param hash - A hash URL, as {@link createParamsUrl} builds them.
 * @returns The same URL, resolved against the page.
 */
function absoluteUrl(hash: string): string {
  return new URL(hash, window.location.href).href;
}

/** The page regions the app draws into. */
export interface AppElements {
  /** The challenge bar. */
  readonly challenge: HTMLElement;
  /**
   * Where the learning track's panel goes.
   *
   * Empty on every route but the track, and the stylesheet hides an empty one,
   * so a challenge and the demo are not left with a gap above the building.
   */
  readonly tutorial: HTMLElement;
  /**
   * The header's link into the learning track.
   *
   * Not a region this draws into but a single `href` it keeps current: the
   * markup ships pointing at task 1, and {@link App} moves it on to the first
   * task the player has not cleared. Required rather than optional, though a
   * missing one would break nothing that is running, because the failure it
   * prevents is silent — a page that quietly has no way into the track is
   * exactly the state this element exists to end.
   */
  readonly tutorialLink: HTMLElement;
  /** The building. */
  readonly world: HTMLElement;
  /** The statistics panel. */
  readonly stats: HTMLElement;
  /** The end-of-challenge overlay's container. */
  readonly feedback: HTMLElement;
  /** The "there is a problem with your code" banner's container. */
  readonly codeStatus: HTMLElement;
}

/** Everything the app needs to run. */
export interface AppOptions {
  /** The page regions to draw into. */
  readonly elements: AppElements;
  /** The player's editor. */
  readonly editor: CodeEditor;
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The challenges, in order. */
  readonly challenges: readonly Challenge[];
  /**
   * Where the chosen time scale and the learning track's progress are
   * remembered, and where the player's own program is looked for; defaults to
   * `localStorage`.
   *
   * The same store the editor was built over, or {@link App.playerCodeWouldBeReplaced}
   * answers about somebody else's browser: `main.ts` gives both `localStorage`
   * by leaving them their default, and the tests hand both the same object.
   */
  readonly storage?: Storage;
  /** Schedules simulation frames; defaults to `requestAnimationFrame`. */
  readonly requestAnimationFrame?: AnimationFrameRequester;
}

/**
 * The task of the learning track on screen, and where it sits in the track.
 *
 * The task itself rather than its index alone, because everything the panel and
 * the bar ask for — the identifier, the seed, the two programs, the condition —
 * is on it, and a second lookup by index is a second chance to look up the
 * wrong one. The index rides along because the track is the one part of the
 * game that is *numbered for the player*: "Task 3 of 8" is in the bar's title
 * and in the panel, and it is a position in the table rather than anything
 * stored, which is why nothing but the interface is allowed to use it.
 */
export interface TutorialRun {
  /** The task being played. */
  readonly task: TutorialTask;
  /** Its position in `tutorialTasks`, counted from zero. */
  readonly index: number;
}

/** How much of the learning track this browser has cleared. */
export interface TutorialProgress {
  /** How many tasks have been cleared, counting each task once. */
  readonly cleared: number;
  /** How many tasks the track has. */
  readonly count: number;
}

/**
 * Reads the remembered time scale.
 *
 * @param storage - Where the time scale is remembered.
 * @returns The stored time scale, or `undefined` when there is no usable one.
 */
export function readStoredTimeScale(storage: Storage): number | undefined {
  let stored: string | null;
  try {
    stored = storage.getItem(TIME_SCALE_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (stored === null) {
    return undefined;
  }
  const timeScale = Number.parseFloat(stored);
  return Number.isFinite(timeScale) ? clampTimeScale(timeScale) : undefined;
}

/** Runs the game. */
export class App {
  /** The challenges being played, in order. */
  readonly challenges: readonly Challenge[];
  /** The controller driving the simulation. */
  readonly worldController: WorldController;
  /** The world currently being played, once a challenge has started. */
  world: World | undefined = undefined;
  /**
   * Index of the challenge currently being played.
   *
   * Left where it was while the sandbox is running, since the sandbox is not in
   * the list: it says which numbered challenge a restart would return to, not
   * what is on screen. {@link isPlayingSandbox} is what distinguishes the two.
   */
  currentChallengeIndex = 0;

  readonly #elements: AppElements;
  readonly #editor: CodeEditor;
  readonly #storage: Storage;
  readonly #requestAnimationFrame: AnimationFrameRequester;
  #challengePresenter: ChallengePresenter | undefined = undefined;
  /** The parameters of the URL the current challenge was started from. */
  #query: RouteQuery = new Map<string, string>();
  /** The building the sandbox is running, or `undefined` for a challenge. */
  #sandbox: SandboxOptions | undefined = undefined;
  /**
   * The task of the learning track being played, or `undefined` for anything
   * else.
   *
   * The third thing that can be on screen, and the field that tells the other
   * two what to do about it: it decides which run a restart repeats, which seed
   * a world is built from, what the bar's title says, and which overlay the end
   * of a run gets. Set by {@link startTutorial} and cleared by
   * {@link startChallenge} and {@link startSandbox}, so that exactly one of the
   * three is ever in effect.
   */
  #tutorial: TutorialRun | undefined = undefined;
  /**
   * The seed every run is built from, or `null` to let each draw its own.
   *
   * Read from the URL and from nowhere else, which is the whole of the restart
   * rule: see {@link handleRoute}.
   *
   * A task of the learning track is the exception, and it does not change that
   * sentence: the task's own seed is applied where the world is built, and this
   * field goes on meaning "what the URL asked for" so that leaving the track
   * for a challenge finds the URL's seed still in it. See {@link #startRun}.
   */
  #seed: string | null = null;
  /**
   * What is on screen, or `undefined` before the first run has started.
   *
   * The challenge rather than its description, because a description is a
   * sentence in whatever language was active when it was asked for --
   * `ChallengeCondition.description` is a getter for exactly that reason -- and
   * {@link relocalise} has to be able to ask again. The index rides along
   * because it is what tells the sandbox apart from the challenges without
   * looking anything up, and it is `null` for the sandbox, which is not in the
   * list. Distinct from {@link currentChallengeIndex}, which says where a
   * restart would go rather than what is being played.
   */
  #run: { readonly challenge: Challenge; readonly challengeIndex: number | null } | undefined =
    undefined;
  /**
   * Whether the run on screen was won, or `undefined` while it is still going.
   *
   * The outcome and not the words: the overlay's title and message are
   * translated when they are drawn, so remembering what it said would mean
   * redrawing it in the language it was first shown in. Cleared at the start of
   * every run, alongside the overlay itself.
   */
  #outcome: boolean | undefined = undefined;
  /**
   * Whatever the player's program last threw, while the banner is showing it.
   *
   * Wrapped rather than held bare, because `throw undefined` is something player
   * code can do and the banner has to show it like anything else -- so the
   * wrapper is what distinguishes "no banner" from "a banner about `undefined`".
   * Kept for {@link relocalise}: the sentence around the error is a message, and
   * so is the description of a thrown object with nothing to say for itself.
   */
  #codeError: { readonly thrown: unknown } | undefined = undefined;

  /**
   * @param options - The page regions, the editor, the controller and the
   * challenges.
   */
  constructor(options: AppOptions) {
    this.#elements = options.elements;
    this.#editor = options.editor;
    this.worldController = options.worldController;
    this.challenges = options.challenges;
    this.#storage = options.storage ?? localStorage;
    this.#requestAnimationFrame =
      options.requestAnimationFrame ??
      ((callback): void => {
        requestAnimationFrame(callback);
      });

    // Subscribed once, for the lifetime of the app. The legacy code subscribed
    // inside startChallenge, so every challenge start added another listener
    // that was never removed: after N challenges the time scale was written to
    // storage N times and the challenge bar was rebuilt N times per click.
    this.worldController.on("timescale_changed", () => {
      this.#storeTimeScale();
      this.#challengePresenter?.update();
    });
    this.worldController.on("usercode_error", (e) => {
      console.log("World raised code error", e);
      this.#editor.trigger("usercode_error", e);
    });

    this.#editor.on("apply_code", () => {
      this.#restart(true);
    });
    this.#editor.on("code_success", () => {
      this.#codeError = undefined;
      clearCodeStatus(this.#elements.codeStatus);
    });
    this.#editor.on("usercode_error", (error) => {
      this.#codeError = { thrown: error };
      presentCodeStatus(this.#elements.codeStatus, error);
    });
  }

  /**
   * The navigation row of the challenge bar: one entry per challenge.
   *
   * Every entry is built with {@link createParamsUrl} from the parameters the
   * current challenge was started with, exactly as the next-challenge link is.
   * That is the whole point of the row: assigning `location.hash` outright --
   * which is how this feature is usually written -- would drop `timescale`,
   * `autostart`, `devtest` and anything else the URL is carrying, so a player
   * who had chosen 8x speed would silently lose it by jumping to another
   * challenge.
   *
   * `seed` is the exception, and is dropped: it was drawn for the building being
   * left, so carrying it into another challenge would pin a run nobody has
   * played. The rule the row follows is that what the player is carrying are
   * *preferences* — the speed, the autostart, the sandbox building they may come
   * back to — and a seed is not one. It names a single run, and naming a run
   * that has not been played yet is meaningless.
   *
   * Dropping it here is not the way back out of a pinned run, though it does
   * mean the row cannot pin what it did not draw. The way out is the seed line's
   * own `new draw` link ({@link #seedLink}), because the row has none to offer
   * the sandbox — it has no entry for it — and "press the challenge you are
   * already on" is not a move any interface can expect to be found.
   *
   * The last challenge is the endless demo (`requireDemo` in
   * `src/game/challenges.ts`): it has no win condition, so it is labelled
   * rather than numbered, and the row says so instead of offering a "challenge"
   * that can never be completed.
   *
   * The sandbox gets no entry of its own, and that is deliberate. The row is
   * the fixed progression through the game; the sandbox is not a station on it
   * and has no address to link to — its URL is whatever the player wrote, and
   * an entry pointing at "the sandbox" would have to invent parameters or
   * silently reuse whatever happened to be in the hash. Numbering it would make
   * it look like a twentieth challenge, which it is not. So while the sandbox
   * runs, the row still lists every challenge, with none of them marked
   * current: it is the way *out* of the sandbox, and the row saying "you are
   * not on any of these" is exactly right.
   *
   * @param challengeIndex - The challenge about to be drawn, marked as current,
   * or `null` when what is being drawn is not in the list.
   * @returns One entry per challenge, in playing order.
   */
  #challengeLinks(challengeIndex: number | null): readonly ChallengeLinkData[] {
    const lastIndex = this.challenges.length - 1;
    return this.challenges.map((_challenge, index) => ({
      num: index + 1,
      url: createParamsUrl(this.#query, { challenge: index + 1, seed: null }),
      current: index === challengeIndex,
      demo: index === lastIndex,
    }));
  }

  /**
   * The seed of a run, and the URL that starts another run from it.
   *
   * Read off the world rather than from {@link #seed}, so that the run whose
   * seed nobody chose — the overwhelmingly common one — is offered as readily as
   * the pinned one. That is the case the affordance exists for: the seed only
   * becomes interesting once the run has gone wrong.
   *
   * Built with {@link createParamsUrl}, so the challenge, the speed, the sandbox
   * building and every unknown key survive into the link, exactly as they do in
   * the navigation row. Unlike the row, these are the two links in the interface
   * whose job is the seed itself: one adds it, one takes it away.
   *
   * The `new draw` URL is offered only when the route pins a seed, which is the
   * only state it goes anywhere from — and it is {@link #seed}, the seed the
   * router accepted, that decides. A seed the router refused (`#seed=rush hour`,
   * which a browser percent-encodes on the way in) leaves the run unpinned and
   * the line offering to pin the seed that was actually drawn, which is what
   * happened.
   *
   * A task of the learning track offers no seed line at all, and it is the one
   * run in the game where that is the honest answer. Both halves of the line are
   * offers about the address bar, and on a task both are refused. "The same
   * passengers again" writes `seed=` into an address the router refuses it on —
   * `refuseSeedOnTrack` in `src/app/router.ts` — so following the game's own
   * link would warn on the console and have `startRouter` strip the key back out
   * of the bar in front of the player. "A new draw" offers to stop pinning a
   * seed that the *task* pins, which is the point of the task: `TutorialTask.seed`
   * records that a random one would make the lesson a coin flip. A line that
   * undoes itself is worse than no line, so the line goes, and the console print
   * built from the same data goes with it — what it prints is that same refused
   * URL. The seed is not lost: it is the task's, written down in the table.
   *
   * Rendering the seed as plain text was the alternative and was rejected. It
   * would occupy the same space in the bar to say a word that means nothing to
   * the player on the track — the seed of task 5 is `tutorial-5` — and the line
   * exists to be *acted* on. If the track ever wants the seed shown, the honest
   * form is the panel saying so in its own words, not the bar's link with its
   * href taken away.
   *
   * @param world - The run that has just been built.
   * @param challengeIndex - Its index in {@link challenges}, or `null` for the
   * sandbox, which the URL addresses by its building instead.
   * @returns Its seed, the URL that starts another run from it and the URL that
   * stops pinning it, or `null` when it has no seed to offer.
   */
  #seedLink(world: World, challengeIndex: number | null): SeedLinkData | null {
    if (this.#tutorial !== undefined) {
      return null;
    }
    if (world.seed === null) {
      // Only reachable when a caller handed the world a ready-made random
      // stream, which the app never does; a test that does gets no seed line
      // rather than a link with nothing to pin.
      return null;
    }
    const seed = String(world.seed);
    // Both links name the challenge, as every other link this class builds
    // does, and here it is load-bearing rather than tidy. A first visit has no
    // hash at all, so "everything you are carrying, minus the seed" is nothing
    // at all, and a hash cannot spell that except as a bare `#`. That does work
    // — the hash changes, so a fresh run is drawn — but `#` is also the
    // fragment meaning "the top of this document", so the browser scrolls there
    // on the way out of a pinned run. Naming the challenge makes it an address.
    // Where the URL already carries a challenge, which is every route the game
    // writes itself, this replaces it with the same value and changes nothing.
    const at = challengeIndex === null ? {} : { challenge: challengeIndex + 1 };
    return {
      seed,
      url: createParamsUrl(this.#query, { ...at, seed }),
      newDrawUrl: this.#seed === null ? null : createParamsUrl(this.#query, { ...at, seed: null }),
    };
  }

  /** Remembers the current time scale for the next visit. */
  #storeTimeScale(): void {
    try {
      this.#storage.setItem(TIME_SCALE_STORAGE_KEY, String(this.worldController.timeScale));
    } catch {
      // A browser that refuses storage should not stop the game.
    }
  }

  /** Whether what is on screen is the sandbox rather than a numbered challenge. */
  get isPlayingSandbox(): boolean {
    return this.#sandbox !== undefined;
  }

  /**
   * Starts whatever is currently on screen again, from the beginning.
   *
   * Its three callers — the Restart button, the editor's "apply code" and the
   * track panel's "start over" — all mean "run this again", and until the
   * sandbox existed the only thing that could be on screen was
   * `challenges[currentChallengeIndex]`. Restarting through the index would now
   * throw a sandbox player back onto a numbered challenge, and with it the
   * building they had configured. A task of the learning track is the same
   * hazard with a worse ending: `currentChallengeIndex` is left wherever the
   * last numbered challenge put it, so Ctrl-Enter on task 3 would apply the
   * player's edit to challenge 1 — a different building, and the attempt they
   * were half-way through no longer on screen to compare against.
   *
   * The order of the three is the order of {@link handleRoute} and means the
   * same thing: a task, or the sandbox, or a numbered challenge. Only one of
   * the two fields is ever set, so the order decides nothing at runtime; it is
   * written the same way in both places so that a reader who has checked one
   * has checked the other.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  #restart(autoStart = false): void {
    const tutorial = this.#tutorial;
    const sandbox = this.#sandbox;
    if (tutorial !== undefined) {
      this.startTutorial(tutorial.index, autoStart);
    } else if (sandbox === undefined) {
      this.startChallenge(this.currentChallengeIndex, autoStart);
    } else {
      this.startSandbox(sandbox, autoStart);
    }
  }

  /** Starts, pauses or restarts the simulation, depending on where it is. */
  startStopOrRestart(): void {
    if (this.world?.challengeEnded === true) {
      this.#restart();
    } else {
      this.worldController.setPaused(!this.worldController.isPaused);
    }
  }

  /**
   * Acts on a route: applies its options and starts the challenge it names.
   *
   * The URL also decides, alone, whether the same people walk in again. A `seed`
   * in the hash pins one and nothing else does, so `#seed=…` brings the same
   * passengers in the same order from the Restart button, from Ctrl-Enter and
   * from a reload alike, while a URL without one draws a fresh seed on every one
   * of them. How far that carries into the run itself is the subject of
   * `SEED_EXPLANATION` in `src/ui/templates.ts`: the passengers, yes; the run
   * they arrive into, no.
   *
   * The tempting alternative — remembering the seed the last run generated and
   * reusing it on Restart, but not on reload — was rejected twice over. It would
   * strand a player who is stuck on a challenge with the same passenger stream
   * however often they restart, and no way back to another draw short of editing
   * the address bar. And it would make the two ways of saying "again" mean
   * different things from one URL, which is exactly the kind of hidden state
   * this app keeps out of the game: the hash is what is being played. Pinning
   * after the fact costs one click on the seed in the bar, and every run prints
   * its seed as it starts, so the case that matters — the run that has already
   * gone wrong — stays recoverable.
   *
   * What makes that trade honest is that the click undoes: a pinned run's seed
   * line offers `new draw`, which is the same URL without the seed. Whichever
   * state the player is in, one click in the bar reaches the other, and neither
   * needs the address bar.
   *
   * What a route names is decided in one order, and the order is stated because
   * it is the whole of the dispatch: a route is a task of the learning track, or
   * the sandbox, or a numbered challenge. The router never sets more than one of
   * those — `#challenge=` holds one value — so this is a statement of precedence
   * rather than a decision made every time, and the precedence runs from the
   * most specific address to the least. `challengeIndex` is the least, because
   * the router resolves it to challenge 1 for any spelling it does not
   * understand, which is exactly what an unrecognised route should play and
   * exactly what a task's route must not: until this branch existed,
   * `#challenge=tutorial-5` played challenge 1 while the address bar went on
   * saying `tutorial-5`, and a reload never escaped it.
   *
   * @param params - The validated route parameters.
   * @param query - The raw parameters, kept for the next-challenge link.
   */
  handleRoute(params: RouteParams, query: RouteQuery): void {
    this.#query = query;
    this.#seed = params.seed;
    if (params.devTest) {
      // Into the buffer the flag is meant for, before it is loaded. The
      // reference solution is an edit of whatever is on screen, and what is on
      // screen at this point is the buffer of the run being *left* -- so
      // `#challenge=1,devtest=true` typed while a task was open used to write
      // the dev-test program into that task's key, where the switch below
      // flushed it, and then show the player their own program instead. The
      // attempt was gone and nothing said so. The router refuses this flag on a
      // task address, so the buffer it is asking for is always the player's own,
      // and opening a buffer that is already on screen does nothing.
      this.#editor.openPlayerBuffer();
      this.#editor.setDevTestCode();
    }
    setDemoFullscreen(params.fullscreen);
    this.worldController.setTimeScale(params.timeScale);
    if (params.tutorialIndex !== null) {
      this.startTutorial(params.tutorialIndex, params.autoStart);
    } else if (params.sandbox === null) {
      this.startChallenge(params.challengeIndex, params.autoStart);
    } else {
      this.startSandbox(params.sandbox, params.autoStart);
    }
  }

  /**
   * Tears the current challenge down and starts another one.
   *
   * @param challengeIndex - Zero-based index of the challenge to start.
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  startChallenge(challengeIndex: number, autoStart = false): void {
    const challenge = this.challenges[challengeIndex];
    if (challenge === undefined) {
      throw new RangeError(`No challenge with index ${String(challengeIndex)}`);
    }
    this.#sandbox = undefined;
    this.#leaveTutorialBuffer();
    this.currentChallengeIndex = challengeIndex;
    this.#startRun(challenge, challengeIndex, autoStart);
  }

  /**
   * Tears the current challenge down and starts a sandbox run in its place.
   *
   * The building comes from the URL, so it is bookmarkable and shareable, and
   * nothing about the run is remembered anywhere else: coming back to the same
   * link is coming back to the same building.
   *
   * @param options - The building to play in, already validated by the router.
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  startSandbox(options: SandboxOptions, autoStart = false): void {
    this.#sandbox = options;
    this.#leaveTutorialBuffer();
    this.#startRun(createSandboxChallenge(options), null, autoStart);
  }

  /**
   * Tears the current run down and starts a task of the learning track.
   *
   * A {@link TutorialTask} is structurally a {@link Challenge} — `options` and
   * `condition` are named and typed to match, deliberately — so it is handed
   * straight to the same machinery, with `null` where a challenge index would
   * go. That `null` is the whole of "a task is not a challenge": it is not
   * numbered in the bar, not marked in the navigation row, and not followed by a
   * link into the numbered ladder. {@link currentChallengeIndex} is left where
   * the last numbered challenge put it, exactly as the sandbox leaves it, since
   * it says where the player would return to and not what is on screen.
   *
   * The editor is switched to the task's own buffer before the run is built,
   * and the order matters: {@link #startRun} compiles whatever is in the editor
   * at the moment it starts, so opening the buffer afterwards would run the
   * previous task's program in this task's building for one run.
   *
   * @param tutorialIndex - Zero-based position of the task in `tutorialTasks`.
   * @param autoStart - Whether to run without waiting for the Start button.
   * @throws RangeError When no task has that position. Symmetric with
   * {@link startChallenge}: the router resolves a task address against the same
   * table, so this can only be reached by a caller that made the index up, and
   * a made-up index must not quietly play task 1.
   */
  startTutorial(tutorialIndex: number, autoStart = false): void {
    const task = tutorialTasks[tutorialIndex];
    if (task === undefined) {
      throw new RangeError(`No tutorial task with index ${String(tutorialIndex)}`);
    }
    this.#sandbox = undefined;
    this.#tutorial = { task, index: tutorialIndex };
    // The task's own attempt if the player has left one, and the starting code
    // only when they have not: somebody who half-solved task 4, wandered off to
    // a challenge and came back is owed their attempt, not the mistake again.
    this.#editor.openTutorialBuffer(task.id, task.startingCode);
    this.#startRun(task, null, autoStart);
  }

  /**
   * Puts the player's own program back in the editor on the way out of the
   * track.
   *
   * Called by both of the other two starts rather than by the router, because
   * the track is left in more ways than by following a link: the navigation row,
   * the panel's own way out, the Restart button after the player has typed
   * another address. Every one of them goes through `startChallenge` or
   * `startSandbox`, and none of them may leave a challenge being played with a
   * task's program in the editor, which would then be saved under the task's key
   * as the player edited it.
   *
   * Idempotent, and so safe to call when no task was running: the editor
   * returns early when the buffer asked for is the one already on screen, which
   * is what keeps a challenge-to-challenge jump from disturbing the caret or
   * emptying the undo history.
   */
  #leaveTutorialBuffer(): void {
    this.#tutorial = undefined;
    this.#editor.openPlayerBuffer();
  }

  /**
   * The task of the learning track on screen, or `undefined` for anything else.
   *
   * The panel's whole input: it decides from this whether to draw at all, which
   * task's hints to show, and which number to print. Exposed read-only, because
   * the way to change what is being played is {@link startTutorial} — a panel
   * that could assign this would leave the field disagreeing with the world.
   */
  get tutorial(): TutorialRun | undefined {
    return this.#tutorial;
  }

  /**
   * How much of the learning track this browser has cleared.
   *
   * Read from the store on every call rather than cached, which costs one
   * `getItem` per draw and buys the one thing a cache would lose: the count is
   * right after the win that has just happened, in a second tab, and after the
   * player clears their storage mid-session. Nothing here is on a frame path.
   *
   * @returns The cleared count and the size of the track.
   */
  tutorialProgress(): TutorialProgress {
    return {
      cleared: countClearedTutorialTasks(readClearedTutorialTasks(this.#storage), tutorialTasks),
      count: tutorialTasks.length,
    };
  }

  /**
   * Whether taking a task's program would overwrite something the player wrote.
   *
   * What the panel asks before it offers `tutorial.button.takeCodeConfirm`.
   * "Something the player wrote" is deliberately narrow: an empty store is not
   * it, and neither is the starting program the game itself put there, because
   * confirming the replacement of a program nobody typed teaches players to
   * dismiss the question — and the one time it matters is the time they do it
   * without reading.
   *
   * Compared against {@link defaultCode} rather than remembered, since the
   * player may have arrived on the track without ever opening the editor, in
   * which case what is in the store is whatever the last version of this game
   * wrote there.
   *
   * @returns Whether the player's own buffer holds a program of theirs.
   */
  playerCodeWouldBeReplaced(): boolean {
    let stored: string | null;
    try {
      stored = this.#storage.getItem(CODE_STORAGE_KEY);
    } catch {
      // A store that refuses to be read cannot be overwritten either, so there
      // is nothing to warn about.
      return false;
    }
    return stored !== null && stored.trim() !== "" && stored.trim() !== defaultCode().trim();
  }

  /**
   * Copies the program now in the editor into the player's own buffer.
   *
   * Written to the player's key rather than by switching buffers, which is what
   * keeps the player on the task. The button means "I want to keep this", not
   * "I am done here": somebody who takes the answer to task 6 usually wants to
   * go on reading task 6. The copy is waiting for them under the game's own
   * editor whenever they leave, because that is the key
   * {@link CodeEditor.openPlayerBuffer} reads.
   *
   * Through {@link CodeEditor.writePlayerCode} rather than into `#storage` here,
   * even though this class holds the same store: the editor reads its own copy
   * of a key before the store's, so a write from outside it is a copy the editor
   * does not have and will overwrite. See that method.
   *
   * Throws nothing when the store refuses the write, for the reason every other
   * write in this class swallows its own: the run the player is in is what
   * matters, and it does not depend on this. The refusal is not swallowed
   * though — it is the return value, and the panel is what tells them either
   * way. That is the whole point of the boolean; a caller that drops it turns
   * the button into one that silently does nothing when the store throws. Which
   * it does on a full quota, and in the private-browsing modes that hand out a
   * `Storage` object and refuse every write to it. Storage being *switched off*
   * is not on the list: `src/main.ts` reads `localStorage` bare, so a browser
   * that throws on the property has already stopped the game from starting, and
   * there is no button to press.
   *
   * @returns Whether the program was stored.
   */
  takeTutorialCode(): boolean {
    return this.#editor.writePlayerCode(this.#editor.getCode());
  }

  /**
   * Leaves the learning track for the numbered challenges.
   *
   * Challenge one and not `currentChallengeIndex`, which is where a player who
   * came to the track from challenge 12 would be sent back to. The track is what
   * somebody plays before they have a challenge to go back to, so the useful
   * exit is the beginning of the game; a player who did arrive from challenge 12
   * has that address in their history and in the navigation row.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  leaveTutorial(autoStart = false): void {
    this.startChallenge(0, autoStart);
  }

  /**
   * Builds a world for a challenge, draws it, and hands it to the controller.
   *
   * @param challenge - What to play: one of {@link challenges}, or the sandbox
   * challenge the URL just described.
   * @param challengeIndex - Its index in {@link challenges}, or `null` for the
   * sandbox, which is not in the list and so is neither numbered in the bar nor
   * marked in the navigation row nor followed by a "next challenge" link.
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  #startRun(challenge: Challenge, challengeIndex: number | null, autoStart: boolean): void {
    this.world?.unWind();
    // A task's own seed wins over the URL's, and it is the one seed in the game
    // the player cannot override. That is what `TutorialTask.seed` is for: the
    // lesson is "this program loses and that one wins", which is a statement
    // about a particular stream of passengers, and a random draw would make it a
    // coin flip. The router already refuses `seed` on a task address, so the two
    // can disagree only when a task is started from inside the app while the URL
    // still carries the seed of the challenge just left -- and then it is the
    // leftover that has to lose.
    //
    // `undefined`, not `null`: the world generates a seed of its own when it is
    // given none, and records it either way, which is what makes an unpinned run
    // repeatable after the fact.
    const world = createWorld(
      challenge.options,
      this.#tutorial?.task.seed ?? this.#seed ?? undefined,
    );
    this.world = world;
    window.world = world;
    const seed = this.#seedLink(world, challengeIndex);
    if (seed !== null) {
      // Printed at every start, because nobody knows a run is worth repeating
      // until it has already gone wrong -- by which time the only record of what
      // it was is this line.
      console.log(t("game.seed.console", { seed: seed.seed, url: absoluteUrl(seed.url) }));
    }

    // All three of these regions can hold the focused element when a challenge
    // starts: the "Next challenge" link lives in the feedback overlay, the call
    // and in-car buttons live in the building, and the learning track's panel
    // has the button that leaves the track. Emptying them deletes it, and focus
    // falls back to <body> -- so a keyboard or screen-reader player who takes
    // the offered link, or who presses "leave", is dropped at the top of the
    // page instead of arriving at the challenge they just asked for. Asked
    // before the teardown, because afterwards there is nothing left to ask
    // about.
    //
    // The panel is the odd one of the three: it is not emptied here but at the
    // end of `#drawChallengeBar`, after the bar has already put the focus on the
    // start button. That order is what makes one question cover all three -- by
    // the time the panel goes, the focus has left it.
    const focusWasDestroyed = containsFocus([
      this.#elements.world,
      this.#elements.feedback,
      this.#elements.tutorial,
    ]);
    clearAll([this.#elements.world, this.#elements.feedback]);
    this.#run = { challenge, challengeIndex };
    this.#outcome = undefined;
    presentStats(this.#elements.stats, world);
    this.#drawChallengeBar(world, focusWasDestroyed);
    presentWorld(this.#elements.world, world);

    world.on("stats_changed", () => {
      const challengeStatus = challenge.condition.evaluate(world);
      if (challengeStatus === null) {
        return;
      }
      world.challengeEnded = true;
      this.worldController.setPaused(true);
      // Recorded where the verdict is reached rather than in `#showOutcome`,
      // which `relocalise` calls again to redraw that verdict in another
      // language. Nothing miscounts today if it moves -- progress is a set of
      // task ids, so a redraw would re-add an id that is already in it -- and
      // that is exactly why the rule is worth writing down rather than leaving
      // to the type it happens to be stored in. The day progress records
      // anything a repeat would change, an attempt count, a first-cleared
      // timestamp, a language switch would quietly start writing it, and the
      // drawing path is the last place anybody would think to look. Drawing
      // stays drawing.
      const tutorial = this.#tutorial;
      if (challengeStatus && tutorial !== undefined) {
        recordClearedTutorialTask(this.#storage, tutorial.task.id);
        // The one moment the panel has to be redrawn without a run starting or a
        // language changing: the count it prints has just gone up, and the
        // player is looking at the panel while the success overlay tells them
        // so. Without this line the panel would still say "0 of 8 tasks done"
        // under an overlay congratulating them on the first. Drawn from the
        // store, like every other draw of it, so the line and the record cannot
        // disagree.
        this.#drawTutorialPanel();
      }
      this.#showOutcome(challengeStatus);
    });

    const codeObj = this.#editor.getCodeObj();
    this.worldController.start(
      world,
      codeObj ?? NO_OP_CODE,
      this.#requestAnimationFrame,
      autoStart,
    );
  }

  /**
   * Draws the challenge bar for whatever {@link #run} says is on screen.
   *
   * Its own method because it has two callers with nothing else in common: the
   * start of a run, and a language change. Everything it feeds the bar is asked
   * for again here rather than remembered from the last time — the description
   * from the condition's getter, the navigation row from {@link #challengeLinks},
   * the seed line from {@link #seedLink} — because each of those is a sentence
   * in the active language, and a bar rebuilt from strings captured at the start
   * of the run would come out in the language the run started in.
   *
   * Safe to call over an existing bar: the presenter replaces the markup
   * wholesale, subscribes to nothing on the world, and carries the focused
   * control and the seed disclosure's `open` state across for itself.
   *
   * @param world - The run being played; consulted for its seed and for
   * `challengeEnded`, which decides whether the button says Start or Restart.
   * @param focusWasDestroyed - Whether the caller has already deleted the
   * focused element by emptying the building or the overlay.
   */
  #drawChallengeBar(world: World, focusWasDestroyed: boolean): void {
    const run = this.#run;
    if (run === undefined) {
      return;
    }
    const { challenge, challengeIndex } = run;
    this.#challengePresenter = presentChallenge(this.#elements.challenge, {
      challengeNum: challengeIndex === null ? UNNUMBERED_CHALLENGE_NUM : challengeIndex + 1,
      description: challenge.condition.description,
      challengeLinks: this.#challengeLinks(challengeIndex),
      seed: this.#seedLink(world, challengeIndex),
      world,
      worldController: this.worldController,
      focusWasDestroyed,
      onStartStop: () => {
        this.startStopOrRestart();
      },
      onTimeScaleIncrease: () => {
        this.worldController.setTimeScale(increasedTimeScale(this.worldController.timeScale));
      },
      onTimeScaleDecrease: () => {
        this.worldController.setTimeScale(decreasedTimeScale(this.worldController.timeScale));
      },
    });
    // Both retitles hang off the same `challengeIndex === null`, which is what
    // "not one of the nineteen" means; which of the two it is comes from the
    // field, not from the index, because both unnumbered runs reach here the
    // same way.
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      this.#retitleAsTutorial(tutorial, challenge.condition.description);
    } else if (challengeIndex === null) {
      this.#retitleAsSandbox(challenge.condition.description);
    }
    this.#drawTutorialPanel();
  }

  /**
   * Draws the learning track's panel, or empties its region when what is on
   * screen is not a task.
   *
   * Hung off the end of {@link #drawChallengeBar} rather than given call sites
   * of its own, because that method's two callers are exactly the two moments
   * the panel has to be drawn again: the start of a run, which is the only
   * thing that can change which task is on screen, and a language change, which
   * has to reach every word on the page — and the panel is most of the words on
   * it. The alternative, calling this from both places, is two call sites to
   * keep in step and a third to forget when a third caller appears. It runs
   * after the bar so that the page is written in the order it is read.
   *
   * Emptying is not an afterthought but the common case: nineteen challenges,
   * the sandbox and the demo all reach here, and every one of them has to leave
   * the region empty, since the stylesheet hides it only while it is. Leaving
   * the last task's hints above challenge 1 would be worse than a gap — they
   * are the answer to a task the player is no longer playing.
   *
   * The three callbacks are closures over this object rather than a public
   * method for the panel to call, which is what keeps the panel from having to
   * know that "start over" is {@link #restart}: the same private method the
   * Restart button and Ctrl-Enter go through, with the same `autoStart` of
   * `false`, so a task restarted from the panel waits for Start exactly as one
   * restarted from the bar does. Two buttons that say the same thing must not
   * do different things.
   *
   * The panel's `hasOwnProgram` is a function and not a boolean because it is
   * asked at the moment the player presses "take this program", not at the
   * moment the panel was drawn: a player who writes their first program during
   * task 5 would otherwise be told nothing before it was overwritten, since the
   * panel was drawn when the store was still empty.
   */
  #drawTutorialPanel(): void {
    // Before the early return, because the header's link has to be current on
    // every route and not only on the track: a player looking at challenge 12 is
    // exactly who it is there for. Riding along with the panel rather than
    // taking call sites of its own for the reason given above, and because the
    // two draws it needs are the two this method already gets -- the start of a
    // run, and the win that has just moved the progress it is computed from.
    this.#drawTutorialLink();
    const tutorial = this.#tutorial;
    if (tutorial === undefined) {
      clearChildren(this.#elements.tutorial);
      return;
    }
    presentTutorial(this.#elements.tutorial, {
      taskIndex: tutorial.index,
      clearedCount: this.tutorialProgress().cleared,
      hasOwnProgram: () => this.playerCodeWouldBeReplaced(),
      onRestart: () => {
        this.#restart();
      },
      onTakeCode: () => this.takeTutorialCode(),
      onLeave: () => {
        this.leaveTutorial();
      },
    });
  }

  /**
   * Points the header's link at the task the player would want next.
   *
   * The track is reachable by address alone and, until this link existed, only
   * by address: a player who was never told what to type had no way to find out
   * that eight tasks were there at all.
   *
   * Where it goes is the first task not yet cleared, which is what makes the
   * link usable more than once. Always pointing at task 1 would strand a
   * returning player who cleared four yesterday — nothing else on the page
   * offers task 5, so they would have to win task 1 again to be shown task 2.
   *
   * A finished track goes back to task 1. There is no fifth option worth having:
   * the last task is not an entrance, and a link that does nothing is worse than
   * one that starts the track over — which is a thing a player who has finished
   * may well want, and the panel says how far along they are either way.
   *
   * Built with {@link createParamsUrl} like every other link the app makes, so
   * the speed and the sandbox building the player is carrying ride along, and
   * the seed is dropped: it belongs to the run being left, and the router would
   * refuse it on a task address anyway.
   */
  #drawTutorialLink(): void {
    const next =
      firstUnclearedTutorialTask(readClearedTutorialTasks(this.#storage), tutorialTasks) ??
      tutorialTasks[0];
    if (next === undefined) {
      // An empty track. Unreachable with the table this build ships, and the
      // honest answer is to leave the shipped `href` alone rather than write a
      // link to a task that does not exist.
      return;
    }
    this.#elements.tutorialLink.setAttribute(
      "href",
      createParamsUrl(this.#query, { challenge: next.id, seed: null }),
    );
  }

  /**
   * Draws the end-of-challenge overlay, and remembers that it is showing.
   *
   * The outcome is the thing worth remembering; the three strings are worked out
   * from it here, every time, so that {@link relocalise} can draw the same
   * verdict again in another language. The presenter replaces the overlay's
   * contents rather than appending, so calling this twice about one run leaves
   * one overlay.
   *
   * @param won - Whether the challenge's condition was met.
   */
  #showOutcome(won: boolean): void {
    this.#outcome = won;
    const tutorial = this.#tutorial;
    if (tutorial !== undefined) {
      this.#showTutorialOutcome(tutorial, won);
      return;
    }
    const challengeIndex = this.#run?.challengeIndex ?? null;
    presentFeedback(this.#elements.feedback, {
      title: won ? t("game.feedback.success.title") : t("game.feedback.failure.title"),
      message: won ? t("game.feedback.success.message") : t("game.feedback.failure.message"),
      // No link after a failure, none after the last challenge, and none for the
      // sandbox, which cannot get here at all: its condition never resolves. The
      // seed is dropped for the same reason the navigation row drops it: it
      // belongs to the building just completed, not to the next one.
      url:
        won && challengeIndex !== null && challengeIndex + 1 < this.challenges.length
          ? createParamsUrl(this.#query, { challenge: challengeIndex + 2, seed: null })
          : "",
    });
  }

  /**
   * Puts everything the app has drawn into the language that is active now.
   *
   * Called when the language picker changes the language, after the catalogue
   * has been fetched and after `localisePage` has rewritten the shell. The run
   * in progress survives it: nothing here tears down a world, so the passengers,
   * the clock, the score and the seed are the ones the player already had.
   * Restarting would have been a great deal less code, and it is the one outcome
   * this feature refuses -- losing a run because somebody changed a language is
   * worse than any amount of it staying in the old one.
   *
   * The five regions and why each is done the way it is:
   *
   * - The challenge bar is rebuilt from scratch by {@link #drawChallengeBar},
   *   which is cheap and correct: the bar subscribes to nothing.
   * - The learning track's panel goes with the bar, because
   *   {@link #drawTutorialPanel} is called from the end of it. It is the region
   *   with the most words in it and the one a player is most likely to be
   *   reading when they change the language, which is why it is built from
   *   message keys rather than from finished sentences: see the note at the top
   *   of `src/ui/tutorial-panel.ts`.
   * - The statistics *labels* are shell, and `localisePage` has already dealt
   *   with them. The *figures* go through `Intl` in {@link presentStats}, so a
   *   Russian reader wants `2 675 с` where an English one has `2,675s`, and they
   *   are written only when the world says they changed. Re-triggering that
   *   event redraws all six and adds no subscription; calling `presentStats`
   *   again would add a second one, and the panel would be written twice per
   *   frame for the rest of the run.
   * - The building is renamed in place by {@link relabelWorld} rather than
   *   redrawn, because {@link presentWorld} appends and subscribes per floor,
   *   per car and per passenger. Nothing visible in it is a word.
   * - The end-of-challenge overlay is drawn again from the remembered outcome,
   *   if there is one.
   *
   * The banner about a failed program is drawn again too, since the sentence
   * around the error is a message. What it wraps is not: an exception's own text
   * is whatever the player's program produced, and it is shown again exactly as
   * it was.
   *
   * Two lines in the page are left alone on purpose, and both report something
   * that has already happened: the save confirmation next to the Save button and
   * the fitness benchmark's result. Re-translating either would mean asserting
   * in the new language that a thing happened at a time nobody recorded; both
   * are rewritten by the next save and the next measurement. The editor's own
   * accessible name is the third, and that one is a limitation rather than a
   * choice -- CodeMirror is given it when the view is built.
   *
   * The learning track's "program taken" line is a fourth report of something
   * that has already happened and is deliberately *not* in that group: it is
   * inside the panel this redraws, so leaving it alone was never an option --
   * the redraw would have thrown it away. It says nothing about when, so it can
   * be said again in the new language, and `src/ui/tutorial-panel.ts` carries
   * the answer rather than the sentence across the redraw in order to say it.
   */
  relocalise(): void {
    const world = this.world;
    if (world !== undefined) {
      this.#drawChallengeBar(world, false);
      world.trigger("stats_display_changed");
    }
    relabelWorld(this.#elements.world);
    if (this.#outcome !== undefined) {
      this.#showOutcome(this.#outcome);
    }
    if (this.#codeError !== undefined) {
      presentCodeStatus(this.#elements.codeStatus, this.#codeError.thrown);
    }
  }

  /**
   * Replaces the challenge bar's title with the sandbox's own.
   *
   * The bar is a shared template that writes `Challenge #N: ` in front of every
   * description, which is right for the nineteen entries in the list and a lie
   * for the sandbox: there is no challenge N to go to, and a player reading it
   * would reasonably try. The description already names the building in full,
   * and it stands on its own — it begins "Sandbox:" — so the prefix is dropped
   * rather than given a number that means nothing.
   *
   * Done here, after the render, rather than by templating a different title,
   * because the sandbox is the only caller that needs it and the bar's markup
   * is not this module's to change. Missing the title is not fatal: what shows
   * then is the description behind {@link SANDBOX_CHALLENGE_NUM}, which is
   * wrong but readable, and a blank bar would be worse.
   *
   * @param description - The sandbox description, containing markup built in
   * `src/game/challenges.ts` and never from player input.
   */
  #retitleAsSandbox(description: string): void {
    const title = this.#elements.challenge.querySelector(CHALLENGE_TITLE_SELECTOR);
    if (title !== null) {
      title.innerHTML = description;
    }
  }

  /**
   * Puts a task's position into the challenge bar's title.
   *
   * The same repair as {@link #retitleAsSandbox} and for the same reason — the
   * bar's template writes `Challenge #N:` in front of every description and
   * there is no challenge N here — but the answer is the opposite one. The
   * sandbox drops the prefix because its description already names the building;
   * a task keeps a prefix and changes what it counts, because "task 3 of 8" is
   * the one thing about a task that the description cannot say and that the
   * player most wants: how far along they are.
   *
   * The number is the position in `tutorialTasks` rather than anything read from
   * the task, which is the only place in the app allowed to use it — see
   * {@link TutorialRun}. The description rides in as markup, exactly as it does
   * for the sandbox: it is built in `src/game/challenges.ts` from the task's own
   * condition and never from player input.
   *
   * @param tutorial - The task on screen and where it sits in the track.
   * @param description - The condition's sentence, containing markup.
   */
  #retitleAsTutorial(tutorial: TutorialRun, description: string): void {
    const title = this.#elements.challenge.querySelector(CHALLENGE_TITLE_SELECTOR);
    if (title !== null) {
      title.innerHTML = t("tutorial.bar.title.html", {
        number: tutorial.index + 1,
        count: tutorialTasks.length,
        description,
      });
    }
  }

  /**
   * Draws the end-of-run overlay for a task of the learning track.
   *
   * A task ends in one of three ways and the game already had words for only one
   * of them. A loss is an ordinary loss and says so: the program did not clear
   * the bar, which on the track is the *expected* first outcome, so nothing here
   * treats it as special or offers a way onwards — the player is meant to go
   * back to the editor, and the panel is where the hints are.
   *
   * A win in the middle of the track offers the next task. It cannot use
   * `game.feedback.next`, which the template writes into every link and which
   * says "Next challenge": the numbered ladder is not where task 4 lives, and a
   * player who follows a link labelled that way lands somewhere they did not ask
   * for. So the link's words are replaced after the render, the way the sandbox
   * replaces the title, and for the same reason — the template is shared and its
   * markup is not this module's to change.
   *
   * A win on the *last* task replaces the whole overlay. Task 8 is challenge 1
   * with the hints taken away, so what the player has in the editor at that
   * moment is a program that clears the first real challenge, and the only
   * useful thing to say is "take it with you". That is `tutorial.finish.*`, and
   * its link leaves the track for challenge 1 rather than offering a ninth task
   * that does not exist.
   *
   * Nothing is recorded here. {@link #startRun} records the clear where the
   * condition resolves, so that {@link relocalise} can call this again to redraw
   * the same verdict in another language without a language change counting as
   * a second win.
   *
   * @param tutorial - The task that just ended and where it sits in the track.
   * @param won - Whether the task's condition was met.
   */
  #showTutorialOutcome(tutorial: TutorialRun, won: boolean): void {
    const isLastTask = tutorial.index + 1 >= tutorialTasks.length;
    const nextTask = tutorialTasks[tutorial.index + 1];
    const finished = won && isLastTask;
    presentFeedback(this.#elements.feedback, {
      title: finished
        ? t("tutorial.finish.title")
        : won
          ? t("game.feedback.success.title")
          : t("game.feedback.failure.title"),
      message: finished
        ? t("tutorial.finish.message")
        : won
          ? t("game.feedback.success.message")
          : t("game.feedback.failure.message"),
      // The seed is dropped from both, as it is from every link the app builds:
      // it belongs to the run just finished. On the way to challenge 1 that is
      // also what keeps the link usable at all -- the router refuses a seed on a
      // task address and would refuse this one on arrival if it survived.
      url: finished
        ? createParamsUrl(this.#query, { challenge: 1, seed: null })
        : won && nextTask !== undefined
          ? createParamsUrl(this.#query, { challenge: nextTask.id, seed: null })
          : "",
    });
    if (won) {
      this.#relabelFeedbackLink(
        finished ? t("tutorial.finish.toChallenges") : t("tutorial.finish.nextTask"),
      );
    }
  }

  /**
   * Replaces the words in the end-of-run link, leaving its caret icon alone.
   *
   * The link is one text node followed by an icon element, so the text node is
   * rewritten rather than the link: assigning `textContent` would take the caret
   * with it, and assigning `innerHTML` would put a translated string through the
   * HTML parser for no reason.
   *
   * Missing the link is not an error and is the ordinary case — there is no link
   * after a loss. What the player sees if the shape of the template ever changes
   * under this is the template's own wording, which is wrong but readable, and
   * the same trade {@link #retitleAsSandbox} already makes.
   *
   * @param words - What the link should say, already in the active language.
   */
  #relabelFeedbackLink(words: string): void {
    const link = this.#elements.feedback.querySelector(FEEDBACK_LINK_SELECTOR);
    const text = link?.firstChild;
    if (text?.nodeType === Node.TEXT_NODE) {
      text.textContent = `${words} `;
    }
  }
}
