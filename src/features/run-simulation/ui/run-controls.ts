/**
 * The two buttons that drive a run: start/pause/resume, and start over.
 * The primary glyph is swapped rather than hidden, since SVG ignores the
 * `hidden` attribute's default styling.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createSpriteIcon, spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/**
 * The two run buttons, drawn as one box with no label — see
 * {@link presentRunControls}. `unselectable` avoids text selection when the
 * label changes mid-click.
 */
export function runButtonsTemplate(): string {
  return markup`<div class="runbox"><button type="button" class="btn btn-primary startstop unselectable">${raw(spriteIconMarkup("play"))}<span class="lbl"></span></button><button type="button" class="btn startover unselectable">${raw(spriteIconMarkup("restart"))}<span class="lbl"></span></button></div>`;
}

/** What the run buttons need in order to draw and drive themselves. */
export interface RunControlsOptions {
  /** The controller being driven, consulted for `isPaused`. */
  readonly worldController: Pick<WorldController, "isPaused">;
  /** Whether the run on screen is over, so the button offers to start again. */
  readonly levelEnded: () => boolean;
  /** Whether the run on screen has already ticked, so the button offers to resume. */
  readonly runStarted: () => boolean;
  /**
   * Whether the speed control is on its instant stop. The button then always
   * reads "Start", since a crunch restarts the run from the beginning.
   */
  readonly instantSpeed: () => boolean;
  /** Whether a crunch started by this button is under way. */
  readonly instantRunInProgress: () => boolean;
  /** Called when the start/pause/resume button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
}

/** The rendered run buttons. */
export interface RunControlsPresenter {
  /**
   * Rewrites both buttons' labels, titles, and disabled state, and swaps
   * the primary glyph. Call after anything that could move that state.
   */
  update(): void;

  /**
   * Puts focus on the start button — where a keyboard player lands after a
   * redraw empties whatever held focus (e.g. the end-of-level overlay).
   */
  focusStartStop(): void;
}

/**
 * Draws the run buttons and wires them up. Called once; every redraw after
 * the first goes through {@link RunControlsPresenter.update}.
 */
export function presentRunControls(
  parent: HTMLElement,
  options: RunControlsOptions,
): RunControlsPresenter {
  const startStop = requireElement(".startstop", parent);
  const startStopLabel = requireElement(".startstop .lbl", parent);
  const startOver = requireElement(".startover", parent);
  const startOverLabel = requireElement(".startover .lbl", parent);

  startStop.addEventListener("click", () => {
    options.onStartStop();
  });
  startOver.addEventListener("click", () => {
    options.onStartOver();
  });

  // Tracks the shown glyph so an unrelated redraw doesn't replace it with an identical one.
  let glyph: SpriteIconName = "play";

  const presenter: RunControlsPresenter = {
    update(): void {
      startOverLabel.textContent = t("game.button.startOver");
      startOver.title = t("game.button.startOverTitle");

      const crunching = options.instantRunInProgress();
      const ended = options.levelEnded();
      // Not `!isPaused` alone: the shared controller stays paused during a
      // crunch, which drives a private one.
      const playing = !crunching && !ended && !options.worldController.isPaused;

      const wanted: SpriteIconName = playing ? "pause" : "play";
      if (wanted !== glyph) {
        glyph = wanted;
        startStop.firstElementChild?.replaceWith(createSpriteIcon(wanted));
      }

      if (crunching) {
        startStopLabel.textContent = t("game.button.runningInstantly");
      } else if (playing) {
        startStopLabel.textContent = t("game.button.pause");
      } else if (ended || options.instantSpeed() || !options.runStarted()) {
        startStopLabel.textContent = t("game.button.start");
      } else {
        startStopLabel.textContent = t("game.button.resume");
      }

      // "Start" here means something different: restart a finished run from
      // scratch, so it gets a title the other "Start" states don't.
      if (ended && !crunching) {
        startStop.title = t("game.button.startAgainTitle");
      } else {
        startStop.removeAttribute("title");
      }

      // Disabled rather than hidden, so a player who sees this state gets
      // feedback instead of a vanishing button. Also guards presses that
      // have nothing to act on until the crunch ends.
      startStop.toggleAttribute("disabled", crunching);
    },

    focusStartStop(): void {
      startStop.focus();
    },
  };
  // Runs before anything can take focus, so a screen reader announces "Start" not a blank button.
  presenter.update();
  return presenter;
}
