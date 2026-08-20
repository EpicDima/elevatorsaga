/**
 * The card is a sheet stretched over the whole building, and the difference
 * between one that lets the pointer through and one that does not is invisible
 * until a player tries to press a call button.
 *
 * The clip it is drawn inside belongs to `widgets/building-stage`, which is
 * where that half is measured; its own badge colours are part of the `--*-soft`
 * family measured in `shared/styles/tokens.css.test.ts`.
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
    // `.feedbackcontainer` is opened over the whole stage so the card inside
    // it can be centred on the building, and it stays open for the whole run,
    // empty. A sheet that could take the pointer would swallow every hover and
    // click the floors, the shafts and the cars live on -- silently, since a
    // transparent box looks like nothing at all -- so it passes the pointer
    // down and the card takes it back for itself.
    const container = ruleBody(".feedbackcontainer");
    expect(declaration(container, "inset", ".feedbackcontainer")).toBe("0");
    expect(declaration(container, "pointer-events", ".feedbackcontainer")).toBe("none");
    expect(declaration(ruleBody(".verdict"), "pointer-events", ".verdict")).toBe("auto");
  });

  it("stands the card over the stage's own bottom fade rather than under it", () => {
    // `.stagewrap::after` (`widgets/building-stage`) is the shadow that says a
    // tall building carries on below the fold, it is 22px tall, and the card
    // sits 22px off the bottom -- so the two overlap exactly. Neither box
    // establishes a stacking context of its own, which is what puts their
    // z-indexes in competition across the DOM, and a fade drawn over the
    // verdict would grey out its lower edge for no reason a reader could see.
    const fade = ruleBody(".stagewrap::before,\n.stagewrap::after");
    expect(Number(declaration(ruleBody(".verdict"), "z-index", ".verdict"))).toBeGreaterThan(
      Number(declaration(fade, "z-index", ".stagewrap::after")),
    );
  });

  it.each(THEMES)("keeps the verdict's message and its hint readable, %s theme", (_, palette) => {
    // The mockup paints the hint --text-faint, 3.62:1 dark and 3.14:1 light on
    // the card's own --ds-panel -- short of 1.4.3's 4.5:1 in both, which is
    // the same deviation `.meter-head .cap` and `.tierneed .now` already make.
    expect(declaration(ruleBody(".verdict p"), "color", ".verdict p")).toBe(token("ds-text-muted"));
    expect(
      contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-panel")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves the hint quieter than the message it hangs under", () => {
    // Written compound, `.verdict .verdict-more`, and that is the point of the
    // test: the mockup's own rule is a bare `.verdict-more`, which loses both
    // of its declarations to `.verdict p` on specificity and renders the hint
    // at the message's own size there. Since the ink is now the same for both
    // (above), size is the whole of what separates them.
    expect(styleSource, ".verdict-more is a bare rule again, and loses to .verdict p").not.toMatch(
      /^\.verdict-more\s*\{/m,
    );
    const message = declaration(ruleBody(".verdict p"), "font-size", ".verdict p");
    const hint = declaration(ruleBody(".verdict .verdict-more"), "font-size", ".verdict-more");
    expect(Number.parseFloat(hint)).toBeLessThan(Number.parseFloat(message));
  });

  it("drops the card's entrance for a reader who asked for no motion", () => {
    // The rise says nothing the mark, the headline and the live region do not
    // already say, so it goes entirely rather than being shortened -- the same
    // treatment `.blink`, `.meter-fill` and the car doors get.
    expect(styleSource).toMatch(
      /^@media \(prefers-reduced-motion: reduce\) \{\n {2}\.verdict \{\n {4}animation: none;\n {2}\}\n\}$/m,
    );
  });
});
