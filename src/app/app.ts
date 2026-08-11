/**
 * The application: challenges, the world controller, and the wiring between
 * the editor, the presenters and the URL.
 *
 * Ported from the `$(function() { ... })` block of the legacy `app.js`.
 */

import { createSandboxChallenge } from "../game/challenges.ts";
import type { Challenge, SandboxOptions } from "../game/challenges.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import type { AnimationFrameRequester, WorldController } from "../game/world-controller.ts";
import { t } from "../i18n/index.ts";
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
  setDemoFullscreen,
} from "../ui/presenters.ts";
import type { ChallengePresenter } from "../ui/presenters.ts";
import type { ChallengeLinkData, SeedLinkData } from "../ui/templates.ts";
import { createParamsUrl } from "./router.ts";
import type { RouteParams, RouteQuery } from "./router.ts";
import { clampTimeScale, decreasedTimeScale, increasedTimeScale } from "./time-scale.ts";

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

/** The challenge bar's title, which a sandbox run rewrites once the bar is drawn. */
const CHALLENGE_TITLE_SELECTOR = ".challengetitle";

/**
 * The number the sandbox is drawn with before its title is rewritten.
 *
 * The bar's template renders `Challenge #{num}:` in front of every description,
 * and the sandbox is not challenge anything. It is given a number no challenge
 * can have — they are one-based, and the router refuses `#challenge=0` — so
 * that if the rewrite below ever fails to find the title, what shows is
 * obviously not an invitation to type `#challenge=0` into the address bar.
 */
const SANDBOX_CHALLENGE_NUM = 0;

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
  /** Where the chosen time scale is remembered; defaults to `localStorage`. */
  readonly storage?: Storage;
  /** Schedules simulation frames; defaults to `requestAnimationFrame`. */
  readonly requestAnimationFrame?: AnimationFrameRequester;
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
   * The seed every run is built from, or `null` to let each draw its own.
   *
   * Read from the URL and from nowhere else, which is the whole of the restart
   * rule: see {@link handleRoute}.
   */
  #seed: string | null = null;

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
      clearCodeStatus(this.#elements.codeStatus);
    });
    this.#editor.on("usercode_error", (error) => {
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
   * @param world - The run that has just been built.
   * @param challengeIndex - Its index in {@link challenges}, or `null` for the
   * sandbox, which the URL addresses by its building instead.
   * @returns Its seed, the URL that starts another run from it and the URL that
   * stops pinning it, or `null` when it has no seed to offer.
   */
  #seedLink(world: World, challengeIndex: number | null): SeedLinkData | null {
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
   * Both callers — the Restart button and the editor's "apply code" — mean "run
   * this again", and until the sandbox existed the only thing that could be on
   * screen was `challenges[currentChallengeIndex]`. Restarting through the
   * index would now throw a sandbox player back onto a numbered challenge, and
   * with it the building they had configured.
   *
   * @param autoStart - Whether to run without waiting for the Start button.
   */
  #restart(autoStart = false): void {
    const sandbox = this.#sandbox;
    if (sandbox === undefined) {
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
   * @param params - The validated route parameters.
   * @param query - The raw parameters, kept for the next-challenge link.
   */
  handleRoute(params: RouteParams, query: RouteQuery): void {
    this.#query = query;
    this.#seed = params.seed;
    if (params.devTest) {
      this.#editor.setDevTestCode();
    }
    setDemoFullscreen(params.fullscreen);
    this.worldController.setTimeScale(params.timeScale);
    if (params.sandbox === null) {
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
    this.#startRun(createSandboxChallenge(options), null, autoStart);
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
    // `undefined`, not `null`: the world generates a seed of its own when it is
    // given none, and records it either way, which is what makes an unpinned run
    // repeatable after the fact.
    const world = createWorld(challenge.options, this.#seed ?? undefined);
    this.world = world;
    window.world = world;
    const seed = this.#seedLink(world, challengeIndex);
    if (seed !== null) {
      // Printed at every start, because nobody knows a run is worth repeating
      // until it has already gone wrong -- by which time the only record of what
      // it was is this line.
      console.log(
        `Seed ${seed.seed} — the same passengers again, though never quite the same run: ${absoluteUrl(seed.url)}`,
      );
    }

    // Both of these regions can hold the focused element when a challenge
    // starts: the "Next challenge" link lives in the feedback overlay, and the
    // call and in-car buttons live in the building. Emptying them deletes it,
    // and focus falls back to <body> -- so a keyboard or screen-reader player
    // who takes the offered link is dropped at the top of the page instead of
    // arriving at the challenge they just asked for. Asked before the teardown,
    // because afterwards there is nothing left to ask about.
    const focusWasDestroyed = containsFocus([this.#elements.world, this.#elements.feedback]);
    clearAll([this.#elements.world, this.#elements.feedback]);
    presentStats(this.#elements.stats, world);
    this.#challengePresenter = presentChallenge(this.#elements.challenge, {
      challengeNum: challengeIndex === null ? SANDBOX_CHALLENGE_NUM : challengeIndex + 1,
      description: challenge.condition.description,
      challengeLinks: this.#challengeLinks(challengeIndex),
      seed,
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
    if (challengeIndex === null) {
      this.#retitleAsSandbox(challenge.condition.description);
    }
    presentWorld(this.#elements.world, world);

    world.on("stats_changed", () => {
      const challengeStatus = challenge.condition.evaluate(world);
      if (challengeStatus === null) {
        return;
      }
      world.challengeEnded = true;
      this.worldController.setPaused(true);
      if (challengeStatus) {
        presentFeedback(this.#elements.feedback, {
          title: t("game.feedback.success.title"),
          message: t("game.feedback.success.message"),
          // No link after the last challenge, and none for the sandbox, which
          // cannot get here at all: its condition never resolves. The seed is
          // dropped for the same reason the navigation row drops it: it belongs
          // to the building just completed, not to the next one.
          url:
            challengeIndex !== null && challengeIndex + 1 < this.challenges.length
              ? createParamsUrl(this.#query, { challenge: challengeIndex + 2, seed: null })
              : "",
        });
      } else {
        presentFeedback(this.#elements.feedback, {
          title: t("game.feedback.failure.title"),
          message: t("game.feedback.failure.message"),
          url: "",
        });
      }
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
}
