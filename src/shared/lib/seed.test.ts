/**
 * The seed grammar the router and the settings field both read.
 */

import { describe, expect, it } from "vitest";

import {
  isUsableSeed,
  SEED_INPUT_PATTERN,
  SEED_MAX_LENGTH,
  SEED_PATTERN,
} from "#shared/lib/seed.ts";

describe("a seed the hash can carry", () => {
  it.each([
    ["a generated one", "1234567890"],
    ["a label somebody typed", "rush-hour"],
    ["the underscores and dots the class allows", "issue_61.v2"],
    ["a UUID", "3f2504e0-4f89-11d3-9a0c-0305e82c3301"],
    ["one character", "x"],
    ["the longest one allowed", "a".repeat(SEED_MAX_LENGTH)],
  ])("accepts %s", (_case, seed) => {
    expect(isUsableSeed(seed)).toBe(true);
  });

  it.each([
    // Nothing to replay, and `seed=` spells exactly this.
    ["nothing at all", ""],
    // The whole reason the rule is this narrow: a browser makes this `rush%20hour`.
    ["a space", "rush hour"],
    ["a non-Latin letter", "час-пик"],
    ["a character the hash grammar splits on", "a,b"],
    ["one character too many", "a".repeat(SEED_MAX_LENGTH + 1)],
  ])("refuses %s", (_case, seed) => {
    expect(isUsableSeed(seed)).toBe(false);
  });

  it("spells the same rule for an <input pattern> as for itself", () => {
    // The two constants are written out separately, because the attribute is
    // anchored by the browser and the regular expression anchors itself. What
    // must not drift is everything between the anchors.
    expect(new RegExp(`^${SEED_INPUT_PATTERN}$`).source).toBe(SEED_PATTERN.source);
  });
});
