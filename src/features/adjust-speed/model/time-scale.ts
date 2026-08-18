/**
 * Limits and stepping for the simulation speed multiplier.
 *
 * Split out of the router and the challenge bar because both need the same
 * numbers: the router validates `#timescale=X` against them, and the `+`/`-`
 * buttons step within them.
 *
 * The legacy code had neither a floor nor a ceiling on the stored value, so
 * `#timescale=abc` produced `parseFloat("abc") === NaN`, and a `NaN` time scale
 * turned every simulated `dt` into `NaN`, freezing the world with no way back
 * short of editing the URL.
 *
 * A second hole needed a hand-written URL to fall into, but it was there:
 * `Math.round(timeScale / 1.618)` is `0` for anything below `1.618 / 2`, so
 * `#timescale=0.5` plus one press of `-` froze the world, and `0 * 1.618`
 * rounds to `0`, so `+` could not undo it. The buttons alone never produced a
 * fractional speed, so nobody could reach it by playing.
 *
 * Speeds below `1` are now a ladder of their own — {@link SLOW_TIME_SCALES} —
 * rather than a rounding accident: `-` walks down it and `+` walks back up,
 * so every press is reversible over the whole runnable range.
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
 * The stops below `1`, ascending, ending just short of `1`.
 *
 * Above `1` the buttons multiply and divide by {@link TIME_SCALE_STEP_FACTOR}
 * and round to a whole number, which is why the ladder reads 1, 2, 3, 5, 8. The
 * same arithmetic below `1` collapses: every value under `1.618 / 2` divides to
 * `0`. So the slow end gets an explicit ladder instead, halving from `1` until
 * it reaches {@link TIME_SCALE_MIN}.
 */
const SLOW_TIME_SCALES: readonly number[] = [TIME_SCALE_MIN, 0.25, 0.5];

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
  if (timeScale < 1) {
    // The next stop up the slow ladder, or `1` once past its top. A speed the
    // URL asked for that is not on the ladder still moves up, never down.
    return clampTimeScale(SLOW_TIME_SCALES.find((stop) => stop > timeScale) ?? 1);
  }
  if (timeScale >= TIME_SCALE_STEP_CEILING) {
    return timeScale;
  }
  return clampTimeScale(Math.round(timeScale * TIME_SCALE_STEP_FACTOR));
}

/**
 * The time scale one press of the `-` button leads to.
 *
 * @param timeScale - Current time scale.
 * @returns The next time scale, never below {@link TIME_SCALE_MIN}, and always
 * something {@link increasedTimeScale} can bring back.
 */
export function decreasedTimeScale(timeScale: number): number {
  if (timeScale <= 1) {
    // The next stop down the slow ladder; at or below the slowest, stay put
    // rather than round down to a stopped world.
    return clampTimeScale(SLOW_TIME_SCALES.findLast((stop) => stop < timeScale) ?? TIME_SCALE_MIN);
  }
  return clampTimeScale(Math.max(Math.round(timeScale / TIME_SCALE_STEP_FACTOR), 1));
}
