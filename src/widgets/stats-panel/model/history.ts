/**
 * Sparkline sample history for the stats panel.
 *
 * Two guards decide whether a sample is worth recording, and only the first is
 * this module's. `stats_display_changed` can fire many times a second, so
 * {@link StatsHistory.push} accepts at most one sample per {@link THROTTLE_MS}
 * — {@link SPARK_POINTS} of them then cover roughly 32 seconds of history
 * regardless of simulation speed. The clock is caller-supplied rather than read
 * here, which is what keeps {@link StatsHistory.push} and
 * {@link sparklinePoints} pure and testable with an injected `now`.
 *
 * The second guard — do not record while the run is paused, or the history
 * fills with copies of the same sample — is not applied at all, and cannot be
 * from the event alone. `World`'s own `stats_display_changed` carries it from
 * its main tick, which only fires from inside
 * `if (!this.isPaused && !world.levelEnded && lastT !== null)`
 * (`world-controller.ts`), but that is not its only caller: `App#relocalize`
 * (`src/pages/game/index.ts`) re-fires the same event on every language switch,
 * unconditionally, so text stays correctly translated even while paused. A
 * presenter wired to the event therefore cannot tell a real tick from a paused
 * relocalize — pausing mid-run and switching languages twice, more than
 * {@link THROTTLE_MS} apart, pushes a duplicate sample and evicts a genuine
 * older one. `WorldController.isPaused` is public and is the fix, once the
 * widget composing {@link createStatsHistory} is given a way to read it; it is
 * handed a bare `World` today.
 */

const HISTORY_KEYS = [
  "avgWaitTime",
  "maxWaitTime",
  "avgLoadFactorOnMove",
  "transportedPerSec",
  "transportedCounter",
  "avgPickupTime",
  "avgRideTime",
  "avgPeoplePerStop",
  "waitingNow",
  "aboardNow",
] as const;

/** One of the figures the stats panel sparks. */
export type StatsHistoryKey = (typeof HISTORY_KEYS)[number];

/** How many samples {@link createStatsHistory} keeps per key. */
export const SPARK_POINTS = 160;

/** Real milliseconds between accepted pushes. */
const THROTTLE_MS = 200;

/**
 * The floor {@link sparklinePoints} scales a key's chart against — the value
 * below which a chart draws flat rather than exaggerating noise in a figure
 * that is, in practice, always small.
 *
 * Each floor is stated in its own key's units. `avgLoadFactorOnMove`'s is `0.4`
 * rather than `40` because that figure is kept as the `0..1` fraction
 * `percent()` expects, not as a percentage.
 */
export const SPARK_FLOOR: Readonly<Record<StatsHistoryKey, number>> = {
  avgWaitTime: 10,
  maxWaitTime: 10,
  avgLoadFactorOnMove: 0.4,
  transportedPerSec: 0.2,
  transportedCounter: 10,
  avgPickupTime: 10,
  avgRideTime: 10,
  avgPeoplePerStop: 1,
  waitingNow: 6,
  aboardNow: 4,
};

/** A running history of sparkline samples, one array per {@link StatsHistoryKey}. */
export interface StatsHistory {
  /**
   * Records one sample per key, unless called again before {@link THROTTLE_MS}
   * has passed since the last accepted call.
   *
   * @param now - The current time, in the same clock {@link reset} and every
   *   other call use — in practice `performance.now()`.
   * @param samples - One raw value per key, in that key's own units (see
   *   {@link SPARK_FLOOR}'s doc comment).
   * @returns Whether the samples were recorded.
   */
  push(now: number, samples: Readonly<Record<StatsHistoryKey, number>>): boolean;
  /** The recorded samples for one key, oldest first, capped at {@link SPARK_POINTS}. */
  samples(key: StatsHistoryKey): readonly number[];
  /** Clears every key's history and forgets the last push, so the next {@link push} always records. */
  reset(): void;
}

/**
 * Builds an empty {@link StatsHistory}.
 *
 * @returns The history, ready for its first {@link StatsHistory.push}.
 */
export function createStatsHistory(): StatsHistory {
  const series = new Map<StatsHistoryKey, number[]>(HISTORY_KEYS.map((key) => [key, []]));
  let lastPushAt: number | null = null;

  return {
    push(now, samples) {
      if (lastPushAt !== null && now - lastPushAt < THROTTLE_MS) {
        return false;
      }
      lastPushAt = now;
      for (const key of HISTORY_KEYS) {
        const points = series.get(key);
        if (points === undefined) {
          continue;
        }
        points.push(samples[key]);
        if (points.length > SPARK_POINTS) {
          points.shift();
        }
      }
      return true;
    },
    samples(key) {
      return series.get(key) ?? [];
    },
    reset() {
      for (const points of series.values()) {
        points.length = 0;
      }
      lastPushAt = null;
    },
  };
}

/**
 * Builds an SVG `<polyline>` `points` attribute from a sample series: the chart
 * spans a `0 0 100 16` viewBox, `y` is inverted (small values sit low), and the
 * scale never shrinks below `floor` so a quiet run draws a flat line near the
 * bottom rather than a jagged one blown up from noise.
 *
 * @param points - A sample series, oldest first.
 * @param floor - The minimum top-of-scale for this series; see {@link SPARK_FLOOR}.
 * @returns The `points` attribute value, or `""` for an empty series.
 */
export function sparklinePoints(points: readonly number[], floor: number): string {
  if (points.length === 0) {
    return "";
  }
  const top = Math.max(floor, ...points);
  const denominator = Math.max(1, points.length - 1);
  return points
    .map((point, index) => {
      const x = (index / denominator) * 100;
      const y = 15 - (point / top) * 13;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
