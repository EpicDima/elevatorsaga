import { afterEach, describe, expect, it, vi } from "vitest";

import { createRandomSource, generateRandomSeed, systemRandom } from "./random.ts";
import type { RandomSeed, RandomSource } from "./random.ts";

/** Draws enough values to say something about a stream. */
const SAMPLE_SIZE = 20000;

/**
 * Takes the first `count` values of a stream.
 *
 * @param random - Stream to draw from.
 * @param count - How many values to take.
 * @returns The values, in order.
 */
function take(random: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRandomSource", () => {
  it("returns values in [0, 1)", () => {
    const values = take(createRandomSource("range"), SAMPLE_SIZE);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.every(Number.isFinite)).toBe(true);
  });

  it("gives the same seed the same sequence", () => {
    expect(take(createRandomSource("seed"), 1000)).toEqual(take(createRandomSource("seed"), 1000));
  });

  it("gives different seeds different sequences", () => {
    expect(take(createRandomSource("seed"), 100)).not.toEqual(take(createRandomSource("도"), 100));
    expect(take(createRandomSource(1), 100)).not.toEqual(take(createRandomSource(2), 100));
  });

  it("separates neighbouring integer seeds, which a batch run reaches for first", () => {
    // Seeds are hashed rather than used as the generator state, so 1, 2 and 3
    // are not three windows onto one stream a fixed distance apart.
    const streams = [1, 2, 3].map((seed) => take(createRandomSource(seed), 100));
    for (const [i, stream] of streams.entries()) {
      for (const [j, other] of streams.entries()) {
        if (i !== j) {
          expect(stream.filter((value) => other.includes(value))).toEqual([]);
        }
      }
    }
  });

  it("treats a number seed and its string form alike", () => {
    // So that a seed printed next to the statistics still replays the run after
    // a trip through a URL, an input field or a log line.
    expect(take(createRandomSource(4711), 100)).toEqual(take(createRandomSource("4711"), 100));
  });

  it("hands out independent generators for the same seed", () => {
    const first = createRandomSource("independent");
    const second = createRandomSource("independent");
    first();
    first();
    expect(second()).toBe(take(createRandomSource("independent"), 1)[0]);
  });

  it("spreads its output evenly across the unit interval", () => {
    // What the simulation actually needs of it: `randomInt` slices this into
    // buckets, so a lumpy stream would bias passenger weights and floors. The
    // seed is fixed, so the margin below is a fact about this stream, not a
    // coin toss the suite makes on every run.
    const buckets = Array.from({ length: 10 }, () => 0);
    const random = createRandomSource("uniformity");
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const bucket = Math.floor(random() * buckets.length);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    const expected = SAMPLE_SIZE / buckets.length;
    // Three standard deviations of the binomial sampling error a genuinely
    // uniform stream would still show, sqrt(n * p * (1 - p)) with p = 1/10.
    const tolerance = 3 * Math.sqrt(SAMPLE_SIZE * 0.1 * 0.9);
    for (const count of buckets) {
      expect(Math.abs(count - expected)).toBeLessThan(tolerance);
    }
  });

  it("has a mean of a half", () => {
    const random = createRandomSource("mean");
    let sum = 0;
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      sum += random();
    }
    expect(sum / SAMPLE_SIZE).toBeCloseTo(0.5, 2);
  });

  it("does not repeat itself over a run's worth of draws", () => {
    // A full challenge run makes some thousands of draws; the generator's
    // period is 2^32, so none of them should be a rerun of an earlier one.
    const values = new Set(take(createRandomSource("period"), 10000));
    expect(values.size).toBe(10000);
  });

  it("never touches the global Math.random", () => {
    const global = vi.spyOn(Math, "random");
    take(createRandomSource("isolated"), 100);
    expect(global).not.toHaveBeenCalled();
  });
});

describe("generateRandomSeed", () => {
  it("returns a 32 bit unsigned integer", () => {
    const seeds = Array.from({ length: 1000 }, () => generateRandomSeed());
    expect(seeds.every(Number.isInteger)).toBe(true);
    expect(Math.min(...seeds)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seeds)).toBeLessThan(2 ** 32);
  });

  it("produces a usable seed at both extremes of its entropy", () => {
    // `Math.random` may legitimately return 0, and gets arbitrarily close to 1.
    const source = vi.spyOn(Math, "random");
    source.mockReturnValue(0);
    expect(generateRandomSeed()).toBe(0);
    source.mockReturnValue(0.9999999999);
    expect(generateRandomSeed()).toBe(2 ** 32 - 1);
  });

  it("gives a different seed nearly every time", () => {
    const seeds = new Set(Array.from({ length: 1000 }, () => generateRandomSeed()));
    expect(seeds.size).toBe(1000);
  });

  it("seeds streams that differ from one another", () => {
    const seeds: RandomSeed[] = [generateRandomSeed(), generateRandomSeed()];
    const [first, second] = seeds.map((seed) => take(createRandomSource(seed), 100));
    expect(first).not.toEqual(second);
  });
});

describe("systemRandom", () => {
  it("is the global Math.random, and the only thing that still is", () => {
    // Kept as one named export so that the places willing to be unreproducible
    // are greppable rather than scattered.
    const global = vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(systemRandom()).toBe(0.25);
    expect(global).toHaveBeenCalledTimes(1);
  });
});
