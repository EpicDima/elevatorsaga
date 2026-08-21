/**
 * Limits and stepping for the simulation speed multiplier.
 *
 * Shared by the router, which validates `#timescale=X` against them, and the
 * `+`/`-` buttons, which step within them.
 *
 * {@link clampTimeScale} guards every value on its way to
 * `WorldController.timeScale`: a non-finite scale turns every simulated `dt`
 * into `NaN` and freezes the world with no way back short of editing the URL,
 * so every function here returns through it.
 *
 * ## Stops, not arithmetic
 *
 * The buttons walk {@link TIME_SCALES} instead of computing a new number — a
 * step along a list rather than a free value, because nobody needs 3.5x and no
 * press should be able to miss a rung. A fixed list of positive stops also
 * cannot round its way to a stopped world, so that hazard is closed by
 * construction rather than by a special case.
 *
 * The list holds no stop below `1`. Slower than real time is still *runnable*
 * — {@link TIME_SCALE_MIN} is well under `1`, so `#timescale=0.5` starts a
 * world at half speed and reads `0.5x` — but it is not *reachable by pressing
 * `-`*: from `0.5`, `-` has nothing slower to offer and `+` goes to `1`, and
 * there is no way back short of the URL. That trade is deliberate. Watching a
 * lift crawl at a tenth speed is a debugging tool for the person who typed the
 * URL, not a rung everyone else should have to step past to get to `1x`.
 *
 * The ladder's top is `20`, and {@link TIME_SCALE_MAX} stays well above it at
 * `64`: `#timescale=40` keeps working, `-` from there steps to the neighbouring
 * stop below (`20`), and `+` reports — through {@link isFastestTimeScale} —
 * that there is nothing finite left, which is where `#features/run-simulation`
 * hands over to its instant stop.
 *
 * ## Instant is not a time scale
 *
 * The speed control's last stop is "instantly", and no `Infinity` appears in
 * {@link TIME_SCALES} on purpose. `WorldController.timeScale` multiplies the
 * frame delta; an `Infinity` reaching it makes every `dt` non-finite and
 * freezes the world the same way a `NaN` would. Instant is therefore a state of
 * the *control* — see `#features/adjust-speed/ui/speed-stepper.ts` — and the
 * time scale underneath it is left alone, which is what makes stepping back out
 * of it land on the speed that was in force rather than on a nearest ladder
 * stop.
 */

/**
 * Every stop the `+`/`-` buttons offer, slowest first.
 *
 * Whole numbers only, and no `Infinity` — see this module's comment for why the
 * instant stop is not a number here.
 */
export const TIME_SCALES: readonly number[] = [1, 2, 3, 6, 10, 20];

/**
 * Time scale used when nothing valid is stored or requested.
 *
 * A stop on {@link TIME_SCALES}, and a slow one: this is the speed a player who
 * has never touched the control watches their first program at, and at `6x` a
 * lift has crossed the building before they have finished reading their own
 * code. A faster pace is one press away, and is then remembered.
 */
export const DEFAULT_TIME_SCALE = 2.0;

/**
 * Slowest the simulation may run.
 *
 * Well below `1` so that a deliberately slow `#timescale=0.5` still works —
 * the buttons no longer go there, but the URL still may.
 */
export const TIME_SCALE_MIN = 0.1;

/**
 * Fastest the simulation may run.
 *
 * Above the top of {@link TIME_SCALES} rather than equal to it, so that a
 * hand-written `#timescale=40` is honoured as asked instead of being quietly
 * rounded onto the ladder.
 */
export const TIME_SCALE_MAX = 64;

/**
 * Constrains a time scale to the runnable range.
 *
 * @param timeScale - Requested time scale; may be any number, including `NaN`.
 * @returns The clamped time scale, or {@link DEFAULT_TIME_SCALE} when the
 * request is not a finite number.
 */
export function clampTimeScale(timeScale: number): number {
  if (!Number.isFinite(timeScale)) {
    return DEFAULT_TIME_SCALE;
  }
  return Math.min(Math.max(timeScale, TIME_SCALE_MIN), TIME_SCALE_MAX);
}

/**
 * The time scale one press of the `+` button leads to.
 *
 * @param timeScale - Current time scale.
 * @returns The next stop up {@link TIME_SCALES}, or the current time scale when
 * there is no faster stop — a speed above the ladder's top, which only the URL
 * can ask for, stays where it is.
 */
export function increasedTimeScale(timeScale: number): number {
  return clampTimeScale(TIME_SCALES.find((stop) => stop > timeScale) ?? timeScale);
}

/**
 * The time scale one press of the `-` button leads to.
 *
 * @param timeScale - Current time scale.
 * @returns The next stop down {@link TIME_SCALES}, or the current time scale
 * when there is no slower stop. Never `0`: every stop is positive, so no press
 * can stop the world the way the legacy rounding could.
 */
export function decreasedTimeScale(timeScale: number): number {
  return clampTimeScale(TIME_SCALES.findLast((stop) => stop < timeScale) ?? timeScale);
}

/**
 * Whether `-` has nothing slower to offer, so the button should be disabled.
 *
 * True below the ladder as well as at its bottom: a URL-supplied `0.5` is
 * slower than every stop, and offering a `-` that changes nothing is worse
 * than offering none.
 *
 * @param timeScale - Current time scale.
 * @returns Whether the simulation is at or below the slowest stop.
 */
export function isSlowestTimeScale(timeScale: number): boolean {
  return !TIME_SCALES.some((stop) => stop < timeScale);
}

/**
 * Whether `+` has no faster *finite* stop to offer.
 *
 * The caller decides what that means for the button: `#features/adjust-speed`'s
 * stepper offers the instant stop from here rather than disabling anything, so
 * `+` at `20x` — and at a URL-supplied `40x` — is the press that switches the
 * control to `∞x`.
 *
 * @param timeScale - Current time scale.
 * @returns Whether the simulation is at or above the fastest stop.
 */
export function isFastestTimeScale(timeScale: number): boolean {
  return !TIME_SCALES.some((stop) => stop > timeScale);
}
