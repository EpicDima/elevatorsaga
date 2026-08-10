/**
 * The application: challenges, the world controller, and the wiring between
 * the editor, the presenters and the URL.
 *
 * Ported from the `$(function() { ... })` block of the legacy `app.js`.
 */

import type { Challenge } from "../game/challenges.ts";
import { createWorld } from "../game/world.ts";
import type { World } from "../game/world.ts";
import type { AnimationFrameRequester, WorldController } from "../game/world-controller.ts";
import type { CodeEditor } from "../ui/editor.ts";
import {
  clearAll,
  presentChallenge,
  presentCodeStatus,
  presentFeedback,
  presentStats,
  presentWorld,
  setDemoFullscreen,
} from "../ui/presenters.ts";
import type { ChallengePresenter } from "../ui/presenters.ts";
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
  /** Index of the challenge currently being played. */
  currentChallengeIndex = 0;

  readonly #elements: AppElements;
  readonly #editor: CodeEditor;
  readonly #storage: Storage;
  readonly #requestAnimationFrame: AnimationFrameRequester;
  #challengePresenter: ChallengePresenter | undefined = undefined;
  /** The parameters of the URL the current challenge was started from. */
  #query: RouteQuery = new Map<string, string>();

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
      this.startChallenge(this.currentChallengeIndex, true);
    });
    this.#editor.on("code_success", () => {
      presentCodeStatus(this.#elements.codeStatus);
    });
    this.#editor.on("usercode_error", (error) => {
      presentCodeStatus(this.#elements.codeStatus, error);
    });
  }

  /** Remembers the current time scale for the next visit. */
  #storeTimeScale(): void {
    try {
      this.#storage.setItem(TIME_SCALE_STORAGE_KEY, String(this.worldController.timeScale));
    } catch {
      // A browser that refuses storage should not stop the game.
    }
  }

  /** Starts, pauses or restarts the simulation, depending on where it is. */
  startStopOrRestart(): void {
    if (this.world?.challengeEnded === true) {
      this.startChallenge(this.currentChallengeIndex);
    } else {
      this.worldController.setPaused(!this.worldController.isPaused);
    }
  }

  /**
   * Acts on a route: applies its options and starts the challenge it names.
   *
   * @param params - The validated route parameters.
   * @param query - The raw parameters, kept for the next-challenge link.
   */
  handleRoute(params: RouteParams, query: RouteQuery): void {
    this.#query = query;
    if (params.devTest) {
      this.#editor.setDevTestCode();
    }
    setDemoFullscreen(params.fullscreen);
    this.worldController.setTimeScale(params.timeScale);
    this.startChallenge(params.challengeIndex, params.autoStart);
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

    this.world?.unWind();
    this.currentChallengeIndex = challengeIndex;
    const world = createWorld(challenge.options);
    this.world = world;
    window.world = world;

    clearAll([this.#elements.world, this.#elements.feedback]);
    presentStats(this.#elements.stats, world);
    this.#challengePresenter = presentChallenge(this.#elements.challenge, {
      challengeNum: challengeIndex + 1,
      description: challenge.condition.description,
      world,
      worldController: this.worldController,
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
          title: "Success!",
          message: "Challenge completed",
          url:
            challengeIndex + 1 < this.challenges.length
              ? createParamsUrl(this.#query, { challenge: challengeIndex + 2 })
              : "",
        });
      } else {
        presentFeedback(this.#elements.feedback, {
          title: "Challenge failed",
          message: "Maybe your program needs an improvement?",
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
}
