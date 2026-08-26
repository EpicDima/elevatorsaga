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

  // The copy button is a bare glyph on the answer: no border and no text, so
  // the glyph is the control's whole visible boundary, at 1.4.11's 3:1. It
  // paints two surfaces — the code block at rest, `--ds-n-3` under the
  // pointer — and a mark can be read on either, the pointer being where the
  // click it reports came from.
  it.each([
    ["at rest", "ds-text-muted"],
    ["hovered", "ds-text"],
    ["after a copy", "ds-ok"],
    ["after a refusal", "ds-bad-ink"],
  ])("keeps the copy glyph %s visible on either surface, in both themes", (_state, glyph) => {
    for (const [, palette] of THEMES) {
      for (const surface of ["ds-code-bg", "ds-n-3"]) {
        expect(
          contrast(themed(palette, glyph), themed(palette, surface)),
          `${glyph} on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // The plate under the pointer is the button's only hover affordance, so it
  // has to be a step the eye catches on the block it is drawn over. This is a
  // low bar on purpose — `--ds-raised`, the token next to it, is 1.03 in the
  // light theme, which is no step at all.
  it("steps the copy button's hover plate off the code block, in both themes", () => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, "ds-n-3"), themed(palette, "ds-code-bg")),
      ).toBeGreaterThanOrEqual(1.1);
    }
  });
});
