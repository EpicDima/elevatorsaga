/**
 * Sparkline sample history for the stats panel. {@link StatsHistory.push} throttles by real time
 * ({@link THROTTLE_MS}) alone, with a caller-supplied clock, and cannot tell a genuine tick from
 * a paused relocalize replaying the same values — pausing and switching languages twice, more than the throttle apart, pushes a duplicate sample and evicts a genuine older one.
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
 * The floor {@link sparklinePoints} scales a key's chart against, below which a chart draws flat
 * rather than exaggerating noise. Each floor is in its own key's units — `avgLoadFactorOnMove`'s
 * `0.4` is a `0..1` fraction, not a percentage.
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
  /** Records one sample per key, unless called again before {@link THROTTLE_MS} has passed since the last accepted call. */
  push(now: number, samples: Readonly<Record<StatsHistoryKey, number>>): boolean;
  /** The recorded samples for one key, oldest first, capped at {@link SPARK_POINTS}. */
  samples(key: StatsHistoryKey): readonly number[];
  /** Clears every key's history and forgets the last push, so the next {@link push} always records. */
  reset(): void;
}

/** Builds an empty {@link StatsHistory}. */
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
 * Builds an SVG `<polyline>` `points` attribute from a sample series: the chart spans a
 * `0 0 100 16` viewBox, `y` is inverted (small values sit low), and the scale never shrinks
 * below `floor` so a quiet run draws a flat line rather than a jagged one blown up from noise.
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
