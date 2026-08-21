/**
 * The speed control: two arrows and the multiplier between them, drawn in the
 * app bar beside the run buttons.
 *
 * The two buttons carry their name as `aria-label` as well as `title`,
 * rewritten by {@link presentSpeedStepper}'s `update()` on a language change
 * the same way it rewrites the value between them — the group is drawn once
 * and only relabeled after, so a label baked into the markup would still be
 * in whatever language the page opened in.
 *
 * `.speed-val` carries `aria-live="polite"`, so a screen reader hears the new
 * speed whichever of the two buttons changed it. Polite rather than assertive:
 * the speed can change several times a second under a held-down button, and an
 * assertive region interrupts whatever is already being read to announce each
 * one, which for a value that settles in well under a second is noise rather
 * than information. `role="group"` and the group's own name are on the wrapper
 * and nowhere else, so that a reader arriving at either arrow is told what the
 * pair is for before hearing "slower".
 *
 * ## The last stop
 *
 * Past 20x the control has one more stop, and it is not a speed: "instantly",
 * written `∞x`. The run is handed to `src/game/instant-run.ts` and counted
 * straight through to its verdict with nothing drawn.
 *
 * It sits at the far end of the same control because that is where a player
 * wants it: 20x is the speed they watch an already-written program at, and
 * "skip to the verdict" is the next thing they ask for from exactly there.
 * What it is *not* is a value of `WorldController.timeScale`, which multiplies
 * the frame delta; see `#features/adjust-speed/model/time-scale.ts` for that
 * distinction. This module never reads a time scale to decide whether it is on
 * that stop — the app tells it, through
 * {@link SpeedStepperOptions.instantSpeed}.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";
import { isFastestTimeScale, isSlowestTimeScale } from "../model/time-scale.ts";

/**
 * The speed control's markup: two arrows and the value between them.
 *
 * Ships with no label at all — see the module comment for why
 * {@link presentSpeedStepper} writes the value, the group's name and both
 * buttons' names instead. No glyph before the value: `6×` between two arrows
 * cannot be read as anything but a speed.
 *
 * @returns The speed control's markup, to be composed into the app bar
 * alongside the run buttons.
 */
export function speedStepperTemplate(): string {
  return markup`<div class="speed" role="group"><button type="button" class="speed-down unselectable">${raw(spriteIconMarkup("left"))}</button><span class="speed-val" aria-live="polite"></span><button type="button" class="speed-up unselectable">${raw(spriteIconMarkup("right"))}</button></div>`;
}

/** What the speed control needs in order to draw and drive itself. */
export interface SpeedStepperOptions {
  /** The controller being driven, consulted for `timeScale`. */
  readonly worldController: Pick<WorldController, "timeScale">;
  /**
   * Whether the control is on its instant stop rather than on a time scale.
   *
   * A function rather than a value for the same reason the run buttons ask
   * their questions that way: this group is drawn once, for the life of the
   * page, and the state it reports on moves under it.
   */
  readonly instantSpeed: () => boolean;
  /**
   * Whether the last stop is on offer for the run on screen.
   *
   * False on a run a crunch could never reach the end of — the sandbox, which
   * has no goal to resolve — and there `+` stops at the fastest finite step
   * instead of stepping past it. A function for the same reason
   * {@link instantSpeed} is one: the answer changes with the run, and this
   * group is drawn once.
   */
  readonly instantAvailable: () => boolean;
  /** Whether a crunch is under way, which is the one time the speed cannot be changed. */
  readonly instantRunInProgress: () => boolean;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
}

/** The rendered speed control. */
export interface SpeedStepperPresenter {
  /**
   * Relabels the value and rewrites the group's and both buttons' names, and
   * disables whichever arrow has nothing left to offer.
   *
   * Called after anything that could have moved the speed: a click of either
   * button, a time scale restored from storage or the URL, the start or end of
   * a crunch, or a language change.
   */
  update(): void;
}

/**
 * Draws the speed control and wires it up.
 *
 * Called once, from {@link "#pages/game/index.ts"!presentControls}, and never
 * again — the markup never goes away, so {@link SpeedStepperPresenter.update}
 * is the whole of every redraw after the first.
 *
 * @param parent - The element {@link speedStepperTemplate}'s markup was
 * written into — the app bar's `.controls` mount, alongside the run buttons.
 * @param options - The controller to report on and the callbacks for the two
 * buttons.
 * @returns The presenter, already drawn.
 */
export function presentSpeedStepper(
  parent: HTMLElement,
  options: SpeedStepperOptions,
): SpeedStepperPresenter {
  const group = requireElement(".speed", parent);
  const value = requireElement(".speed-val", parent);
  const decrease = requireElement(".speed-down", parent);
  const increase = requireElement(".speed-up", parent);

  decrease.addEventListener("click", () => {
    options.onTimeScaleDecrease();
  });
  increase.addEventListener("click", () => {
    options.onTimeScaleIncrease();
  });

  const presenter: SpeedStepperPresenter = {
    update(): void {
      const instant = options.instantSpeed();
      const busy = options.instantRunInProgress();
      const { timeScale } = options.worldController;

      group.setAttribute("aria-label", t("game.timeScale.label"));
      value.textContent = instant ? t("game.timeScale.instant") : formatTimeScale(timeScale);
      // A `title` rather than more visible text: the reading is two characters
      // wide by design, and the sentence explaining what "instantly" does to a
      // run would not fit the bar at any width.
      value.title = instant
        ? t("game.timeScale.instantTitle")
        : t("game.timeScale.valueTitle", { value: formatTimeScale(timeScale) });

      // The same word twice on each arrow: `aria-label` names the button for a
      // reader that never sees the glyph, `title` for a pointer that has no
      // other way to ask what it does.
      const slower = t("game.timeScale.decrease");
      decrease.setAttribute("aria-label", slower);
      decrease.title = slower;
      const faster = t("game.timeScale.increase");
      increase.setAttribute("aria-label", faster);
      increase.title = faster;

      // At the ends of the list an arrow dims rather than disappearing, so the
      // bar's row does not twitch when the speed reaches a limit.
      // `+` ordinarily has no end of its own, because the instant stop is
      // always one past the fastest finite one, so the only thing that stops
      // it is being on it already. Where that stop is not on offer -- see
      // {@link SpeedStepperOptions.instantAvailable} -- the fastest finite
      // step becomes the end of the ladder, and `+` dims there the way `-`
      // dims at the slowest.
      decrease.toggleAttribute("disabled", busy || (!instant && isSlowestTimeScale(timeScale)));
      increase.toggleAttribute(
        "disabled",
        busy || instant || (!options.instantAvailable() && isFastestTimeScale(timeScale)),
      );
    },
  };
  presenter.update();
  return presenter;
}

/**
 * Renders a time scale the way the speed control shows it.
 *
 * The legacy `timeScale.toFixed(0) + "x"` was fine for the whole numbers the
 * buttons produce and a lie for anything else: `#timescale=0.5` read `1x`, and
 * `#timescale=0.1` read `0x`, which says the simulation is stopped when it is
 * running at a tenth speed. Whole speeds still render as `1x` and `20x` — not
 * `1.0x` — and fractional ones render as themselves.
 *
 * The multiplication sign is part of the message rather than appended here,
 * because it is not the same character everywhere: English writes the `x` this
 * game has always written, and Russian typography wants `×`.
 *
 * @param timeScale - The multiplier the simulation is running at.
 * @returns The label, e.g. `"2x"`, `"0.25x"`, or `"0,25×"` in Russian.
 */
export function formatTimeScale(timeScale: number): string {
  // Rounding first keeps float noise (0.1 + 0.2 and friends) out of the label.
  // `Intl` then prints the result without padding whole numbers with a decimal
  // point the way toFixed does, since it is given no minimum fraction digits.
  return t("game.timeScale.value", { value: Math.round(timeScale * 1000) / 1000 });
}
