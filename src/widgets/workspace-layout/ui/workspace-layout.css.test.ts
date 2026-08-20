/**
 * Which box gives way when the game pane runs short, in both axes.
 *
 * Every rule here fails silently rather than loudly: a flex row left on the
 * browser's own `flex: 0 1 auto` is squeezed instead of the box that scrolls, a
 * shrink order written backwards takes a narrow pane out of the house instead
 * of out of the card explaining it, and the two rules from another slice that
 * this row's floor rests on can be withdrawn by someone with no reason to read
 * this file. None of it shows up as an error anywhere; each shows up as a
 * layout that is merely wrong.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("the game pane's column", () => {
  it("leaves the building the only row of the game pane that gives way", () => {
    // The goal bar and the figures each take their own content's height and
    // keep it; `.stagearea` is `flex: 1 1 auto` with a zero minimum, so a pane
    // too short for all three shrinks the stage -- the one box here with
    // somewhere to put a shortfall, since `.stage` scrolls. Without this the
    // browser's own `flex: 0 1 auto` would let the strip be squeezed instead,
    // and the figures at the foot of it cut in half.
    expect(styleSource).toMatch(
      /^\.pane-game > \.level,\n\.pane-game > \.statscontainer \{\n {2}flex: 0 0 auto;\n\}$/m,
    );
    const stageArea = ruleBody(".stagearea");
    expect(declaration(stageArea, "flex", ".stagearea")).toBe("1 1 auto");
    expect(declaration(stageArea, "min-block-size", ".stagearea")).toBe("0");
    // And the learning track's panel is not a row of that column any more --
    // it is an item of `.stagearea` beside the building. A rule putting it
    // back among the pane's own children would be the old layout returning by
    // the back door, with the panel sized twice and by two different boxes.
    expect(styleSource).not.toMatch(/\.pane-game > \.tutorial\b/);
  });

  it("takes a narrow pane out of the lesson first and out of the building last", () => {
    // The two flex factors are one decision written in two places, and either
    // half alone inverts it. A shrink factor is weighed in proportion to the
    // basis it stands against, so the aside's `8` against 384px comes to 3072
    // and the building's `1` against 387px to 387 -- near enough eight to one
    // in favour of taking a shortfall out of the card. Reversed, a pane
    // narrower than both would hold the lesson at its full measure and squeeze
    // the house the lesson is describing, which is the box being explained.
    const aside = ruleBody(".stagearea > .tutorial");
    const world = ruleBody(".stagearea > .world");
    expect(declaration(aside, "flex", ".stagearea > .tutorial")).toBe("0 8 384px");
    expect(declaration(world, "flex", ".stagearea > .world")).toBe("1 1 387px");
    // The card's floor, which is what makes the order above finite. Measured
    // at the shipped split, the lesson holds its full 384px down to a 1280px
    // window, is 257px at 1040px, and reaches 220px on a pane of 468px -- a
    // splitter dragged well past the middle. Below that the building gives
    // way instead, and `.stage` scrolls, which is the one thing on this page
    // that can absorb a shortfall without hiding anything.
    expect(declaration(aside, "min-inline-size", ".stagearea > .tutorial")).toBe("220px");
    // Two rules in `widgets/building-stage` are what let the other side give
    // way at all, and both are written for something else, so both can be
    // taken away by someone with no reason to look here. A flex item's
    // automatic minimum is its content's, which on `.world` would be a floor
    // computed from a house; it is zero only because `.world` clips, and a
    // flex item that clips has no content-based minimum. And the shortfall has
    // to land somewhere -- `.stage` scrolls it. Measured without that
    // `overflow` on a 380px pane, level 7's house drew 229px of itself across
    // the splitter and over the editor, with nothing to scroll it back.
    expect(ruleBody(".world")).toMatch(/^\s*overflow:\s*hidden;/m);
    expect(declaration(ruleBody(".stage"), "overflow", ".stage")).toBe("auto");
  });

  it("never stands the lesson above the building", () => {
    // This port had a container query that turned the row into a column below
    // 740px of pane -- the mockup's own `@media (max-width: 1180px)`, measured
    // against the pane rather than the window. It is gone on the player's
    // instruction, and the reason is arithmetic: at the shipped 62% split a
    // 740px pane is a 1213px window, so a window merely a little small, a
    // browser at 125% zoom, or a splitter nudged towards the editor each put
    // the lesson back on top of the house it is about. The whole point of the
    // card is that the two are read together.
    //
    // Nothing may bring the branch back, and there are three ways in: opening
    // the container it queried, writing the query, or standing the row on its
    // side by any other route. A stacked lesson is also the one failure here
    // that looks deliberate rather than broken, so nothing else would report
    // it.
    expect(styleSource).not.toMatch(/container: stage\b/);
    expect(styleSource).not.toMatch(/@container stage\b/);
    expect(styleSource).not.toMatch(/\.stagearea\b[^{}]*\{[^{}]*flex-direction/);
  });
});
