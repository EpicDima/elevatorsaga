/**
 * Limits and stepping for the simulation speed multiplier.
 *
 * Split out of the router and the challenge bar because both need the same
 * numbers: the router validates `#timescale=X` against them, and the `+`/`-`
 * buttons step within them.
 *
 * The legacy code had neither a floor nor a ceiling on the stored value, which
 * made two things reachable:
 *
 * - `#timescale=abc` produced `parseFloat("abc") === NaN`, and a `NaN` time
 *   scale turned every simulated `dt` into `NaN`, freezing the world with no
 *   way back short of editing the URL;
 * - any time scale below `1.618 / 2` rounded down to `0` on the first press of
 *   the `-` button, which froze the world just as thoroughly — and `0 * 1.618`
 *   rounds to `0`, so the `+` button could not undo it.
 */

/** Time scale used when nothing valid is stored or requested. */
export const DEFAULT_TIME_SCALE = 2.0;

/**
 * Slowest the simulation may run.
 *
 * Well below `1` so that a deliberately slow `#timescale=0.5` still works.
 */
export const TIME_SCALE_MIN = 0.1;

/**
 * Fastest the simulation may run.
 *
 * The `+` button stops offering increases at {@link TIME_SCALE_STEP_CEILING},
 * so `round(39 * 1.618) === 63` is the highest value it can reach on its own;
 * 64 leaves that untouched while capping what the URL can ask for.
 */
export const TIME_SCALE_MAX = 64;

/** Ratio between two steps of the `+`/`-` buttons; the golden ratio. */
const TIME_SCALE_STEP_FACTOR = 1.618;

/** The `+` button does nothing at or above this time scale. */
const TIME_SCALE_STEP_CEILING = 40;

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
 * @returns The next time scale, or the current one when already at the ceiling.
 */
export function increasedTimeScale(timeScale: number): number {
  if (timeScale >= TIME_SCALE_STEP_CEILING) {
    return timeScale;
  }
  return clampTimeScale(Math.round(timeScale * TIME_SCALE_STEP_FACTOR));
}

/**
 * The time scale one press of the `-` button leads to.
 *
 * @param timeScale - Current time scale.
 * @returns The next time scale; never below `1`, so the world cannot be stopped
 * outright by rounding down to zero.
 */
export function decreasedTimeScale(timeScale: number): number {
  return clampTimeScale(Math.max(Math.round(timeScale / TIME_SCALE_STEP_FACTOR), 1));
}
