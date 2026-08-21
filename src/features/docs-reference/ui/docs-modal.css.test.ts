/**
 * The two dialogs' own surfaces, and the contrast each one has to hold.
 *
 * The hotkeys dialog (`features/hotkeys-help`) is measured here with the
 * reference: they are one shape with two contents, they share `.btn`'s close
 * button, and every pair below is a pair both of them paint.
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
  // The dialog's own panel, not --ds-bg: .docs/.keys paint --ds-panel, and
  // .docsclear/.keyrow kbd paint --ds-bg, the search field's own background
  // -- neither pairing the sitewide page-background table in
  // `shared/styles/tokens.css.test.ts` covers.
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
    // The one place --ds-text-faint still appears: a
    // rotating icon, which WCAG 1.4.11 holds to 3:1 rather than 1.4.3's
    // 4.5:1 -- the bar the same pair clears without --ds-text-muted's help
    // (docs-modal.css's own comment on .docs-body h3 has the numbers for both).
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, "ds-text-faint"), themed(palette, "ds-panel")),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the group heading, the empty-search message and the clear icon off --ds-text-faint", () => {
    // Regression guard for the deviations the rules' own comments document:
    // a revert to --ds-text-faint would still be an arithmetic pass if this
    // read the token by name instead of the declaration, since nothing would
    // then stop it from measuring the *wrong* token.
    for (const selector of [".docs-body h3", ".docs-empty", ".docsclear"]) {
      expect(declaration(ruleBody(selector), "color", selector)).toBe(token("ds-text-muted"));
    }
  });
});
