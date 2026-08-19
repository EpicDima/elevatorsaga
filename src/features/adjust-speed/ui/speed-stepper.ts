/**
 * The speed stepper: two buttons and the multiplier they change.
 *
 * Peeled out of `src/ui/presenters.ts`'s `presentControls`, which now composes
 * this with `#features/run-simulation`'s run buttons into the one `.controls`
 * region `src/app/app.ts` draws once, for the life of the page.
 *
 * The two buttons carry their name as `aria-label`, rewritten by
 * {@link presentSpeedStepper}'s `update()` on a language change the same way
 * it rewrites the value between them — the row is drawn once and only
 * relabelled after, so a label baked into the markup would still be in
 * whatever language the page opened in.
 *
 * The controls used to be a `<h3>` wrapping two clickable `<i>` elements.
 * {@link speedStepperTemplate} is a plain container with real buttons now;
 * `.timescale` carries the heading's former metrics so the row looks the
 * same.
 *
 * `.timescale_value` carries `aria-live="polite"`, so a screen reader hears
 * the new speed whichever of the two buttons changed it. Polite rather than
 * assertive: the speed can change several times a second under a held-down
 * button, and an assertive region interrupts whatever is already being read
 * to announce each one, which for a value that settles in well under a
 * second is noise rather than information.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { iconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/**
 * The speed stepper's markup: two buttons and the value between them.
 *
 * Ships with no label at all — see the module comment for why
 * {@link presentSpeedStepper} writes the value and both `aria-label`s
 * instead.
 *
 * @returns The speed stepper's markup, to be composed into the wider
 * controls row alongside the run buttons.
 */
export function speedStepperTemplate(): string {
  return markup`<div class="timescale"><button type="button" class="timescale_decrease unselectable" aria-label="${t("game.timeScale.decrease")}">${raw(iconMarkup("minus-square"))}</button> <span class="emphasis-color timescale_value" aria-live="polite"></span> <button type="button" class="timescale_increase unselectable" aria-label="${t("game.timeScale.increase")}">${raw(iconMarkup("plus-square"))}</button></div>`;
}

/** What the speed stepper needs in order to draw and drive itself. */
export interface SpeedStepperOptions {
  /** The controller being driven, consulted for `timeScale`. */
  readonly worldController: Pick<WorldController, "timeScale">;
  /** Called when the `+` button is pressed. */
  readonly onTimeScaleIncrease: () => void;
  /** Called when the `-` button is pressed. */
  readonly onTimeScaleDecrease: () => void;
}

/** The rendered speed stepper. */
export interface SpeedStepperPresenter {
  /**
   * Relabels the value and rewrites both buttons' `aria-label`.
   *
   * Called after anything that could have moved the speed: a click of either
   * button, a time scale restored from storage or the URL, or a language
   * change.
   */
  update(): void;
}

/**
 * Draws the speed stepper and wires it up.
 *
 * Called once, from {@link "src/ui/presenters.ts"!presentControls}, and never
 * again — the markup never goes away, so {@link SpeedStepperPresenter.update}
 * is the whole of every redraw after the first.
 *
 * @param parent - The element {@link speedStepperTemplate}'s markup was
 * written into — the `.controls` region, today, alongside the run buttons'
 * markup.
 * @param options - The controller to report on and the callbacks for the two
 * buttons.
 * @returns The presenter, already drawn.
 */
export function presentSpeedStepper(
  parent: HTMLElement,
  options: SpeedStepperOptions,
): SpeedStepperPresenter {
  const value = requireElement(".timescale_value", parent);
  const decrease = requireElement(".timescale_decrease", parent);
  const increase = requireElement(".timescale_increase", parent);

  decrease.addEventListener("click", () => {
    options.onTimeScaleDecrease();
  });
  increase.addEventListener("click", () => {
    options.onTimeScaleIncrease();
  });

  const presenter: SpeedStepperPresenter = {
    update(): void {
      value.textContent = formatTimeScale(options.worldController.timeScale);
      decrease.setAttribute("aria-label", t("game.timeScale.decrease"));
      increase.setAttribute("aria-label", t("game.timeScale.increase"));
    },
  };
  presenter.update();
  return presenter;
}

/**
 * Renders a time scale the way the run controls show it.
 *
 * The legacy `timeScale.toFixed(0) + "x"` was fine for the whole numbers the
 * buttons produce and a lie for anything else: `#timescale=0.5` read `1x`, and
 * `#timescale=0.1` read `0x`, which says the simulation is stopped when it is
 * running at a tenth speed. Whole speeds still render as `1x` and `40x` — not
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
