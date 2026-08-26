/**
 * Limits and stepping for the simulation speed multiplier, shared by the
 * router (`#timescale=X`) and the `+`/`-` buttons.
 *
 * Every value bound for `WorldController.timeScale` passes through
 * {@link clampTimeScale}: a non-finite scale turns every frame delta into
 * `NaN` and freezes the world.
 */

/** Every stop the `+`/`-` buttons offer, slowest first; whole numbers only, no `Infinity`. */
export const TIME_SCALES: readonly number[] = [1, 2, 3, 6, 10, 20];

/** Time scale used when nothing valid is stored or requested; a slow stop on {@link TIME_SCALES}. */
export const DEFAULT_TIME_SCALE = 2.0;

/** Slowest the simulation may run; below {@link TIME_SCALES}'s own bottom so a URL-supplied `#timescale=0.5` still works. */
export const TIME_SCALE_MIN = 0.1;

/** Fastest the simulation may run; above {@link TIME_SCALES}'s top so a hand-written `#timescale=40` isn't rounded onto the ladder. */
export const TIME_SCALE_MAX = 64;

/** Constrains a time scale to the runnable range, defaulting a non-finite request to {@link DEFAULT_TIME_SCALE}. */
export function clampTimeScale(timeScale: number): number {
  if (!Number.isFinite(timeScale)) {
    return DEFAULT_TIME_SCALE;
  }
  return Math.min(Math.max(timeScale, TIME_SCALE_MIN), TIME_SCALE_MAX);
}

/** The time scale one press of `+` leads to: the next stop up {@link TIME_SCALES}, or unchanged past its top. */
export function increasedTimeScale(timeScale: number): number {
  return clampTimeScale(TIME_SCALES.find((stop) => stop > timeScale) ?? timeScale);
}

/** The time scale one press of `-` leads to: the next stop down {@link TIME_SCALES}, or unchanged below its bottom. */
export function decreasedTimeScale(timeScale: number): number {
  return clampTimeScale(TIME_SCALES.findLast((stop) => stop < timeScale) ?? timeScale);
}

/** Whether `-` has nothing slower to offer, including a URL-supplied value below the ladder's own bottom. */
export function isSlowestTimeScale(timeScale: number): boolean {
  return !TIME_SCALES.some((stop) => stop < timeScale);
}

/** Whether `+` has no faster finite stop to offer; the caller decides what to do next, e.g. offer the instant stop. */
export function isFastestTimeScale(timeScale: number): boolean {
  return !TIME_SCALES.some((stop) => stop > timeScale);
}
