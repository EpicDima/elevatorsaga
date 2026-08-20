/**
 * Which box gives way when the game pane runs short, in both axes.
 *
 * Every rule here fails silently rather than loudly: a flex row left on the
 * browser's own `flex: 0 1 auto` is squeezed instead of the box that scrolls,
 * and an `@container` naming a container nobody opens never matches and never
 * says so. None of it shows up as an error anywhere; each shows up as a layout
 * that is merely wrong.
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

  it("takes a narrow pane out of the lesson and never out of the building", () => {
    // The two flex factors are one decision written in two places, and either
    // half alone inverts it: the aside states a 384px basis it is allowed to
    // shrink from, and the building states that it is not. Reversed, a pane
    // narrower than both would hold the lesson at its full measure and clip
    // the house the lesson is describing, which is the one box on this page
    // that has to stay whole.
    expect(declaration(ruleBody(".stagearea > .tutorial"), "flex", ".stagearea > .tutorial")).toBe(
      "0 1 384px",
    );
    expect(declaration(ruleBody(".stagearea > .world"), "flex-shrink", ".stagearea > .world")).toBe(
      "0",
    );
    // The ceiling is the other half of that refusal, and it is what keeps it
    // from turning into a licence: a zero shrink factor on an `auto` basis is a
    // *content* size, and this box's content is a building. Level 18's is
    // 1030px wide, and unbounded it made a 1062px `.world` inside a 794px pane
    // -- 268px of it clipped away with nothing to scroll, because `.stage` only
    // scrolls what it is narrower than. Capped at the row, the stage is
    // narrower again and its own `ResizeObserver` compresses the shafts to fit.
    expect(
      declaration(ruleBody(".stagearea > .world"), "max-inline-size", ".stagearea > .world"),
    ).toBe("100%");
    // Below the width where both fit, the row stacks instead of overflowing,
    // and it asks the pane rather than the window -- same reasoning as the
    // figures in `widgets/stats-panel`, and the same failure if the names
    // disagree: an `@container` naming something no ancestor opens never
    // matches and never says so.
    //
    // The container is the pane and not the row, which is the part that has
    // already been got wrong once here: a query container is never the subject
    // of its own query, so `container: stage` on `.stagearea` left the
    // `flex-direction: column` inside the query matching nothing while the
    // rules for its children matched, and a 1040px window drew a lesson at its
    // full measure beside an 83px-wide building.
    expect(declaration(ruleBody(".pane-game"), "container", ".pane-game")).toBe(
      "stage / inline-size",
    );
    expect(ruleBody(".stagearea")).not.toMatch(/container/);
    expect(styleSource).toMatch(/^@container stage \(max-width: 760px\) \{$/m);
    // And stacked, the same priority has to be stated again in the other axis,
    // because the row's flex factors are about width and the two boxes are now
    // competing for height. The lesson is the one with no natural end: level 7
    // with its answer open asks for 1290px of the 399px row a 1040x600 window
    // leaves, and unbounded it took all of it -- the building measured 0px
    // tall. The ceiling is inside the query, so it is matched at that indent
    // rather than through `ruleBody`, which reads the unstacked rule.
    expect(styleSource).toMatch(/^ {2}\.stagearea > \.tutorial \{[^}]*\n {4}max-block-size: 50%;/m);
  });
});
