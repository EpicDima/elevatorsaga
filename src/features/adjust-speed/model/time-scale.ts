/**
 * Limits and stepping for the simulation speed multiplier.
 *
 * Split out of the router and the level bar because both need the same
 * numbers: the router validates `#timescale=X` against them, and the `+`/`-`
 * buttons step within them.
 *
 * The legacy code had neither a floor nor a ceiling on the stored value, so
 * `#timescale=abc` produced `parseFloat("abc") === NaN`, and a `NaN` time scale
 * turned every simulated `dt` into `NaN`, freezing the world with no way back
 * short of editing the URL. {@link clampTimeScale} is the guard against that,
 * and every function here returns through it.
 *
 * ## Stops, not arithmetic
 *
 * The buttons used to multiply and divide by the golden ratio and round, with
 * a second hand-written ladder below `1` because that arithmetic collapses
 * there: `Math.round(0.5 / 1.618)` is `0`, and `0 * 1.618` rounds to `0`, so
 * one press of `-` at a URL-supplied `0.5` froze the world for good. Both are
 * gone. {@link TIME_SCALES} is `design/ui-mockup.html`'s own `SPEEDS` list, and
 * the buttons walk it, which is what its comment there asks for: "шаг по
 * списку, а не свободное число: 3,5x никому не нужно, а промахнуться мимо
 * ступени нельзя". A fixed list of positive stops cannot round its way to a
 * stopped world, so the hazard is gone by construction rather than by a second
 * special case.
 *
 * What the mockup's list drops is every stop below `1`. Slower than real time
 * is still *runnable* — {@link TIME_SCALE_MIN} is unchanged, so `#timescale=0.5`
 * still starts a world at half speed and still reads `0.5x` — but it is no
 * longer *reachable by pressing `-`*: from `0.5`, `-` has nothing slower to
 * offer and `+` goes to `1`, and there is no way back short of the URL. That
 * is the deliberate trade the mockup makes. Watching a lift crawl at a tenth
 * speed is a debugging tool for the person who typed the URL, not a rung
 * everyone else should have to step past to get to `1x`.
 *
 * The ladder's top is `20`, and {@link TIME_SCALE_MAX} stays well above it at
 * `64`: `#timescale=40` keeps working, `-` from there steps to the neighbouring
 * stop below (`20`), and `+` reports — through {@link isFastestTimeScale} —
 * that there is nothing finite left, which is where `#features/run-simulation`
 * hands over to its instant stop.
 *
 * ## Instant is not a time scale
 *
 * The speed control's last stop is "instantly", and the mockup writes it
 * `INSTANT = Infinity` in the same array as the numbers. Nothing of the sort
 * appears here on purpose. `WorldController.timeScale` multiplies the frame
 * delta; an `Infinity` reaching it makes every `dt` non-finite and freezes the
 * world exactly the way the `NaN` above did. Instant is therefore a state of
 * the *control* — see `#features/adjust-speed/ui/speed-stepper.ts` and the flag
 * `#pages/game`'s `App` keeps beside it — and the time scale underneath it is
 * left alone, which is also what makes stepping back out of it land on the
 * speed that was in force rather than on a nearest ladder stop.
 */

/**
 * Every stop the `+`/`-` buttons offer, slowest first.
 *
 * `design/ui-mockup.html`'s own `SPEEDS`, minus its trailing `Infinity` — see
 * this module's comment for why that one is not a number here.
 */
export const TIME_SCALES: readonly number[] = [1, 2, 3, 6, 10, 20];

/**
 * Time scale used when nothing valid is stored or requested.
 *
 * A stop on {@link TIME_SCALES}, but not the mockup's own opening `6`: this is
 * the speed a player who has never touched the control watches their first
 * program at, and at `6x` a lift has crossed the building before they have
 * finished reading their own code. Anyone who wants the mockup's pace gets it
 * in one press, and it is then remembered.
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
