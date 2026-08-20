/**
 * The seed row is the one place in the settings popover a player types into, so
 * it is the one place with a field's two states to answer for: the ink it sets
 * a seed in, and the border that says the seed cannot be played.
 *
 * The rule that is *not* there is checked too. `design/ui-mockup.html` marks a
 * focused `.val` by tinting its border and dropping the ring, and that is the
 * one thing in this block that could not be ported — the check below is what
 * keeps someone from porting it back on the strength of the mockup alone.
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
 * The token a rule paints a property with, by name.
 *
 * `declaration` resolves a `var()` through the whole-stylesheet palette, which
 * collapses the two themes into whichever block comes last. These rules are
 * measured in both themes, so what is wanted here is the token's name, to be
 * looked up per theme.
 *
 * @param selector - The rule's selector.
 * @param property - The property to read.
 * @returns The token's name, without the leading `--`.
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
    // The field fills itself --ds-bg rather than taking the popover's
    // --ds-panel, so this pairing is not one the sitewide table in
    // `shared/styles/tokens.css.test.ts` covers. 12.5px regular is small text:
    // WCAG 1.4.3 asks 4.5:1.
    const fill = themed(palette, paintedWith(".seedrow .val", "background"));
    const ink = themed(palette, paintedWith(".seedrow .val", "color"));
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("marks a seed that cannot be played, %s theme", (_, palette) => {
    // The border is a graphical object carrying meaning against the two
    // surfaces that meet at it: the field's own --ds-bg inside, and the
    // popover's --ds-panel outside. WCAG 1.4.11 asks 3:1 of both.
    const border = themed(palette, paintedWith(".seedrow .val:user-invalid", "border-color"));
    expect(contrast(border, themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(3);
    expect(contrast(border, themed(palette, "ds-panel"))).toBeGreaterThanOrEqual(3);
  });

  it("waits for the player to finish before calling a seed bad", () => {
    // :invalid would match the moment `required` is unsatisfied, and select-all
    // then type -- the ordinary way to replace a seed -- passes through empty.
    // The distinction is the rule's whole point, so it is asserted rather than
    // left to the comment beside it.
    expect(styleSource).toContain(".seedrow .val:user-invalid");
    expect(styleSource).not.toContain(".seedrow .val:invalid");
  });

  it.each(THEMES)(
    "leaves the field to the document's focus ring, because the mockup's own fails 1.4.11, %s theme",
    (_, palette) => {
      // What the mockup does here is `border-color: var(--ds-accent-line);
      // outline: none`. Composited over the --ds-bg the field is filled with,
      // that border comes to well under the 3:1 a focus indicator is asked
      // for -- in the light theme it is barely a shade off the fill. Recorded
      // as the measurement rather than as a note, so that the day
      // --ds-accent-line changes enough to carry a focus indicator, this test
      // is what says so.
      const background = themed(palette, "ds-bg");
      const tinted = over(themed(palette, "ds-accent-line"), background);
      expect(contrast(tinted, background)).toBeLessThan(3);
      expect(styleSource).not.toContain(".seedrow .val:focus");
    },
  );
});
