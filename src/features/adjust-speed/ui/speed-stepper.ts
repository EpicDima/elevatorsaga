/**
 * The speed control's `.speed-val` uses `aria-live="polite"` rather than
 * assertive, since a held-down arrow can change the value several times a
 * second and an assertive region would interrupt itself to announce each one.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";
import { isFastestTimeScale, isSlowestTimeScale } from "../model/time-scale.ts";

/** The speed control's markup: two arrows with the value between them, unlabeled until {@link presentSpeedStepper} draws it. */
export function speedStepperTemplate(): string {
  return markup`<div class="speed" role="group"><button type="button" class="speed-down unselectable">${raw(spriteIconMarkup("left"))}</button><span class="speed-val" aria-live="polite"></span><button type="button" class="speed-up unselectable">${raw(spriteIconMarkup("right"))}</button></div>`;
}

/** What the speed control needs in order to draw and drive itself. */
export interface SpeedStepperOptions {
  /** The controller being driven, consulted for `timeScale`. */
  readonly worldController: Pick<WorldController, "timeScale">;
  /** Whether the control is on its instant stop rather than on a time scale. */
  readonly instantSpeed: () => boolean;
  /** Whether the instant stop is on offer; false for a run with no verdict to crunch to, like the sandbox. */
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
  /** Relabels the value and both buttons, and disables whichever arrow has nothing left to offer. */
  update(): void;
}

/** Draws the speed control into `parent` and wires up its buttons. */
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
      // A tooltip, not visible text: the sentence would not fit the bar.
      value.title = instant
        ? t("game.timeScale.instantTitle")
        : t("game.timeScale.valueTitle", { value: formatTimeScale(timeScale) });

      const slower = t("game.timeScale.decrease");
      decrease.setAttribute("aria-label", slower);
      decrease.title = slower;
      const faster = t("game.timeScale.increase");
      increase.setAttribute("aria-label", faster);
      increase.title = faster;

      // An arrow dims rather than disappearing at the ends of the list.
      // `+` stops at the fastest finite step only where the instant stop is unavailable.
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
 * Renders a time scale the way the speed control shows it, e.g. `"2x"`, `"0.25x"`, or `"0,25×"` in Russian.
 *
 * The multiplication sign lives in the translation, not appended here, since it differs by locale.
 */
export function formatTimeScale(timeScale: number): string {
  // Rounding keeps float noise out of the label; Intl skips padding whole numbers with a decimal point.
  return t("game.timeScale.value", { value: Math.round(timeScale * 1000) / 1000 });
}
