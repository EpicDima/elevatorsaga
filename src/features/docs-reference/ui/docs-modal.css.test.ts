/**
 * Covers both dialogs' surfaces: the hotkeys dialog shares this shape and
 * `.btn`'s close button, so every pair below is one both of them paint.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  ruleBody,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

describe("docs and hotkeys dialogs", () => {
  // The dialog's own --ds-panel/--ds-bg pairs, not the sitewide page-background table.
  it.each([
    ["ds-text", "ds-panel", 4.5],
    ["ds-text-muted", "ds-panel", 4.5],
    ["ds-code-fn", "ds-panel", 4.5],
    ["ds-text-muted", "ds-bg", 4.5],
    ["ds-text", "ds-raised", 4.5],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  it("holds the chevron to the 3:1 a graphical indicator is asked for, not 4.5:1", () => {
    // The one place --ds-text-faint remains: a rotating icon, which WCAG 1.4.11 allows at 3:1.
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, "ds-text-faint"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("spells the search field's placeholder, which no browser draws readably by itself", () => {
    // Chrome's own placeholder is #757575, which reads 3.97:1 on this field in
    // the dark theme and 4.08:1 in the light one; the field's --ds-bg pair above covers the rest.
    expect(
      declaration(ruleBody(".docs-find::placeholder"), "color", ".docs-find::placeholder"),
    ).toBe(token("ds-text-muted"));
  });

  it("keeps the group heading, the empty-search message and the clear icon off --ds-text-faint", () => {
    // Reads the actual declaration, not just the token by name: a revert to
    // --ds-text-faint would otherwise still pass by measuring the wrong token.
    for (const selector of [".docs-body h3", ".docs-empty", ".docsclear"]) {
      expect(declaration(ruleBody(selector), "color", selector)).toBe(token("ds-text-muted"));
    }
  });
});
