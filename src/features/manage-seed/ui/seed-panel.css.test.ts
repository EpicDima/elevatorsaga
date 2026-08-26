/**
 * Checks the seed field's contrast, and that no `:focus` rule was added: a
 * tinted-border treatment fails WCAG 1.4.11, so that rule's absence is itself
 * asserted.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  over,
  ruleBody,
  styleSource,
  THEMES,
  themed,
} from "#shared/styles/test-helpers.ts";

/**
 * The token a rule paints a property with, by name, so it can be looked up per theme
 * rather than resolved once against whichever theme block comes last in the stylesheet.
 */
function paintedWith(selector: string, property: string): string {
  const found = new RegExp(`^\\s*${property}:\\s*var\\(--([\\w-]+)\\);`, "m").exec(
    ruleBody(selector),
  );
  expect(found, `${selector} no longer paints ${property} with a token`).not.toBeNull();
  return found?.[1] ?? "";
}

describe("the seed field", () => {
  it.each(THEMES)("sets the seed itself readably, %s theme", (_, palette) => {
    // The field fills itself with --ds-bg, not the popover's --ds-panel, so this pairing needs its own check.
    const fill = themed(palette, paintedWith(".seedrow .val", "background"));
    const ink = themed(palette, paintedWith(".seedrow .val", "color"));
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("marks a seed that cannot be played, %s theme", (_, palette) => {
    // The border meets two surfaces, the field's fill inside and the popover's outside; WCAG 1.4.11 asks 3:1 of both.
    const border = themed(palette, paintedWith(".seedrow .val:user-invalid", "border-color"));
    expect(contrast(border, themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(3);
    expect(contrast(border, themed(palette, "ds-panel"))).toBeGreaterThanOrEqual(3);
  });

  it("waits for the player to finish before calling a seed bad", () => {
    // :invalid would match the moment `required` is unsatisfied, which select-all-then-type passes through.
    expect(styleSource).toContain(".seedrow .val:user-invalid");
    expect(styleSource).not.toContain(".seedrow .val:invalid");
  });

  it.each(THEMES)(
    "leaves the field to the document's focus ring, because a tinted border fails 1.4.11, %s theme",
    (_, palette) => {
      // Measured rather than just noted, so a future --ds-accent-line change that clears 3:1 is caught here.
      const background = themed(palette, "ds-bg");
      const tinted = over(themed(palette, "ds-accent-line"), background);
      expect(contrast(tinted, background)).toBeLessThan(3);
      expect(styleSource).not.toContain(".seedrow .val:focus");
    },
  );
});
