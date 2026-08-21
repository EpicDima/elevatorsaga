/**
 * The two buttons that drive a run.
 *
 * Two, and they do different things: the first carries the run (start, pause,
 * resume), the second begins it again from nothing. Running headlessly is not a
 * third button but the last stop of the speed control (`#features/adjust-speed`)
 * — the primary button always starts *this* run, and how fast that run is
 * drawn, or whether it is drawn at all, is a setting beside it. See
 * `#pages/game`'s `runInstantly`, which the primary button reaches when the
 * speed control is on its instant stop.
 *
 * Every word below is written by {@link presentRunControls}'s `update()`
 * rather than baked into {@link runButtonsTemplate}: the row is drawn once, for
 * the life of the page, and only relabeled after, so a label baked into the
 * markup would still be in whatever language the page opened in after a change
 * of language.
 *
 * ## What the primary button says
 *
 * Playing → "Pause"; otherwise "Start" before the first tick and after the
 * last, and "Resume" in between. Two more states override that: a crunch in
 * progress, which disables the button and says so, and the instant stop being
 * selected, where the button reads "Start" whatever the run behind it has
 * already done, because pressing it starts that run over headlessly rather than
 * resuming it.
 *
 * The glyph is swapped rather than toggled with `hidden`: the HTML `hidden`
 * attribute is styled by a UA rule scoped to the HTML namespace, so an SVG
 * element carrying it stays visible.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createSpriteIcon, spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/**
 * The two run buttons, in the order they are read in.
 *
 * One box rather than two loose buttons, because the app bar spaces its own
 * children far enough apart to read as separate groups and these two are one.
 * Ships with no label at all — see the module comment for why
 * {@link presentRunControls} writes both instead. The glyphs are in the markup
 * because the resting state has one; `update()` swaps the primary's when the
 * run starts.
 *
 * `unselectable` because the primary button's label changes under the pointer
 * on every press, and without it a player pressing Pause twice ends up dragging
 * a selection across the bar.
 *
 * @returns The run buttons' markup, to be composed into the app bar alongside
 * the speed control.
 */
export function runButtonsTemplate(): string {
  return markup`<div class="runbox"><button type="button" class="btn btn-primary startstop unselectable">${raw(spriteIconMarkup("play"))}<span class="lbl"></span></button><button type="button" class="btn startover unselectable">${raw(spriteIconMarkup("restart"))}<span class="lbl"></span></button></div>`;
}

/** What the run buttons need in order to draw and drive themselves. */
export interface RunControlsOptions {
  /** The controller being driven, consulted for `isPaused`. */
  readonly worldController: Pick<WorldController, "isPaused">;
  /**
   * Whether the run on screen is over, so the button offers to start again.
   *
   * A function rather than the world itself, because this region outlives
   * every run it drives: it is drawn once for the life of the page, and the
   * world it is reporting on is replaced on every restart.
   */
  readonly levelEnded: () => boolean;
  /**
   * Whether the run on screen has already ticked, so the button offers to
   * resume rather than to start.
   *
   * A function for the same reason {@link levelEnded} is one.
   */
  readonly runStarted: () => boolean;
  /**
   * Whether the speed control is on its instant stop.
   *
   * The button reads "Start" throughout when it is, however far the run behind
   * it got: a crunch always begins at the beginning — `WorldController.start`
   * runs the player's `init` on its first unpaused frame — so "Resume" would
   * be a promise this button cannot keep.
   */
  readonly instantSpeed: () => boolean;
  /**
   * Whether a crunch started by this button is under way.
   *
   * A function for the same reason {@link levelEnded} is one: this row is
   * drawn once and outlives every run, including the private controller a
   * crunch drives itself with.
   */
  readonly instantRunInProgress: () => boolean;
  /** Called when the start/pause/resume button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
}

/** The rendered run buttons. */
export interface RunControlsPresenter {
  /**
   * Rewrites both buttons' labels, titles and disabled state, and swaps the
   * primary button's glyph.
   *
   * Everything this touches is state the row reports rather than owns, so it
   * is called after anything that could have moved any of it: a pause, a
   * change of speed, the end of a run, a language change.
   */
  update(): void;

  /**
   * Puts focus on the start button.
   *
   * For the app, and only for the case it alone can see: a redraw that
   * emptied a region focus was inside — the end-of-level overlay holding
   * the "Next level" link, or the building — leaves focus on `<body>` and
   * a keyboard player back at the top of the page. The start button is where
   * they were going anyway. This row is drawn into the app bar, which
   * survives every redraw, which is what makes it the place to land.
   */
  focusStartStop(): void;
}

/**
 * Draws the run buttons and wires them up.
 *
 * Called once, from {@link "#pages/game/index.ts"!presentControls}, and never
 * again — the markup never goes away, so {@link RunControlsPresenter.update}
 * is the whole of every redraw after the first.
 *
 * @param parent - The element {@link runButtonsTemplate}'s markup was written
 * into — the app bar's `.controls` mount, alongside the speed control.
 * @param options - The state to report on and the callbacks for the two
 * buttons.
 * @returns The presenter, already drawn.
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

  // What the primary button is showing, so that a redraw that has not changed
  // it -- a language change, a speed step -- leaves the element where it is
  // rather than replacing it with an identical one.
  let glyph: SpriteIconName = "play";

  const presenter: RunControlsPresenter = {
    update(): void {
      startOverLabel.textContent = t("game.button.startOver");
      startOver.title = t("game.button.startOverTitle");

      const crunching = options.instantRunInProgress();
      const ended = options.levelEnded();
      // Not `!isPaused` alone: a crunch drives a private controller, so the
      // shared one is paused throughout one and the button would read "Pause"
      // over a run nothing is drawing.
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

      // The one state where "Start" needs saying twice: the run on screen is
      // finished, and what the button offers is to throw the result away and
      // play it again -- which is not what "Start" means anywhere else on this
      // page. The button carries no `title` in any other state.
      if (ended && !crunching) {
        startStop.title = t("game.button.startAgainTitle");
      } else {
        startStop.removeAttribute("title");
      }

      // Disabled rather than hidden: a crunch is ordinarily too quick to ever
      // be seen in this state, so a player who does see it pressed the button
      // and wants to know it was heard, not to have it vanish out from under
      // the pointer. It is also the guard on the one press that has no sound
      // answer -- a crunch drives a world the shared controller was never
      // started with, so "Pause" and "Resume" have nothing to act on until it
      // is over.
      startStop.toggleAttribute("disabled", crunching);
    },

    focusStartStop(): void {
      startStop.focus();
    },
  };
  // Before anything can take focus, so that a screen reader announces "Start"
  // rather than an unnamed button.
  presenter.update();
  return presenter;
}
