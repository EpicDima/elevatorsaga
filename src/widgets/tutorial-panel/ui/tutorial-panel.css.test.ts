/**
 * The learning track's panel, and the three surfaces stacked inside it.
 */

import { describe, expect, it } from "vitest";

import { contrast, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("ds palette on the lesson card", () => {
  // Each pair pins a token combination against a token change quietly taking
  // it under the contrast bar. `ds-accent`/`ds-code-bg` is 1.4.11's 3:1
  // graphical-indicator floor, not 1.4.3's 4.5:1 text floor.
  it.each([
    ["ds-text", "ds-panel", 4.5],
    ["ds-text-muted", "ds-panel", 4.5],
    ["ds-text-muted", "ds-raised", 4.5],
    ["ds-text", "ds-n-3", 4.5],
    ["ds-accent", "ds-code-bg", 3],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});
