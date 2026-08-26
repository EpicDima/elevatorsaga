/**
 * The card is a sheet stretched over the whole building; whether it lets the
 * pointer through is invisible until a player tries to press a call button.
 */

import { describe, expect, it } from "vitest";

import {
  declaration,
  ruleBody,
  styleSource,
  THEMES,
  themed,
  token,
  contrast,
} from "#shared/styles/test-helpers.ts";

describe("the run verdict card", () => {
  it("lets the pointer through the sheet the card stands on", () => {
    // The container stays open, empty, for the whole run, so a sheet that
    // could take the pointer would silently swallow every click on the
    // building underneath; the card takes the pointer back for itself.
    const container = ruleBody(".feedbackcontainer");
    expect(declaration(container, "inset", ".feedbackcontainer")).toBe("0");
    expect(declaration(container, "pointer-events", ".feedbackcontainer")).toBe("none");
    expect(declaration(ruleBody(".verdict"), "pointer-events", ".verdict")).toBe("auto");
  });

  it("stands the card over the stage's own bottom fade rather than under it", () => {
    // The card and the stage's bottom fade overlap exactly; a fade drawn over the verdict would gray out its lower edge.
    const fade = ruleBody(".stagewrap::before,\n.stagewrap::after");
    expect(Number(declaration(ruleBody(".verdict"), "z-index", ".verdict"))).toBeGreaterThan(
      Number(declaration(fade, "z-index", ".stagewrap::after")),
    );
  });

  it.each(THEMES)("keeps the verdict's message and its hint readable, %s theme", (_, palette) => {
    // `--ds-text-faint` falls short of WCAG 1.4.3's 4.5:1 on this card's `--ds-panel`; `--ds-text-muted` clears it.
    expect(declaration(ruleBody(".verdict p"), "color", ".verdict p")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-panel")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves the hint quieter than the message it hangs under", () => {
    // Written compound, `.verdict .verdict-more`: a bare rule loses to `.verdict p` on specificity.
    expect(styleSource, ".verdict-more is a bare rule again, and loses to .verdict p").not.toMatch(
      /^\.verdict-more\s*\{/m,
    );
    const message = declaration(ruleBody(".verdict p"), "font-size", ".verdict p");
    const hint = declaration(ruleBody(".verdict .verdict-more"), "font-size", ".verdict-more");
    expect(Number.parseFloat(hint)).toBeLessThan(Number.parseFloat(message));
  });

  it("drops the card's entrance for a reader who asked for no motion", () => {
    expect(styleSource).toMatch(
      /^@media \(prefers-reduced-motion: reduce\) \{\n {2}\.verdict \{\n {4}animation: none;\n {2}\}\n\}$/m,
    );
  });
});
