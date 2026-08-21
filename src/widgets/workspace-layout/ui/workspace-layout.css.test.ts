/**
 * Which box gives way when the game pane runs short, in both axes.
 *
 * Every rule here fails silently rather than loudly: a row of the pane left on
 * the browser's own `flex: 0 1 auto` is squeezed instead of the box that
 * scrolls, a card or a house left shrinkable is squeezed instead of scrolled
 * to, an `overflow` written on one axis when it was meant for the other hands
 * the building a scrollbar it does not need, and the two rules from another
 * slice that this column rests on can be withdrawn by someone with no reason to
 * read this file. None of it shows up as an error anywhere; each shows up as a
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
    // it is an item of `.stagearea`, above the building and inside the same
    // scroll. A rule putting it back among the pane's own children would be
    // the old layout returning by the back door, with the panel sized twice
    // and by two different boxes, and taking its height out of the stage on
    // every route that shows it.
    expect(styleSource).not.toMatch(/\.pane-game > \.tutorial\b/);
  });

  it("scrolls the card and the building as one box, and only down the page", () => {
    // The whole of the feature: one scroll over both boxes, so a lesson longer
    // than the pane is scrolled through rather than squeezed into a column
    // beside the house, and a player who has read down to step three gets back
    // to the building the same way they got to the step.
    const stageArea = ruleBody(".stagearea");
    expect(declaration(stageArea, "flex-direction", ".stagearea")).toBe("column");
    // `hidden auto` and not `auto`: the inline axis belongs to `.stage`, which
    // scrolls a building wider than the pane inside itself without taking the
    // card along with it. Nor may the axis go unwritten -- a pair with
    // `visible` on one axis and anything else on the other is not honoured,
    // the `visible` computing to `auto` -- so silence here is a second
    // scrollbar under the building rather than none.
    expect(declaration(stageArea, "overflow", ".stagearea")).toBe("hidden auto");
    // And the card is not a scroll container of its own any more. It used to
    // carry a ceiling and an `overflow`, which is the layout this replaced: a
    // lesson scrolling inside a box that was itself inside a pane that did
    // not, two scrollbars a few pixels apart with the wheel answering
    // whichever one the pointer happened to be over. Either declaration coming
    // back to either of the card's two rules brings that with it.
    for (const selector of [".stagearea > .tutorial", ".tutorial"]) {
      const card = ruleBody(selector);
      expect(card, `${selector} scrolls inside itself again`).not.toMatch(/^\s*overflow/m);
      expect(card, `${selector} has a height ceiling again`).not.toMatch(/^\s*max-block-size/m);
    }
  });

  it("gives the building a whole screenful whatever the card above it is doing", () => {
    // A stated height, and what it prevents is invisible in a screenshot:
    // `.stage` re-lays the building out to the height it is given, through a
    // `ResizeObserver`, so a box sized from whatever the card leaves would
    // redraw the whole house every time a player opened a hint -- the floors
    // changing height under the cursor at the moment the lesson is telling
    // them to look at one.
    const world = ruleBody(".stagearea > .world");
    expect(declaration(world, "block-size", ".stagearea > .world")).toBe("100%");
    // Rigid, both of them, because this column overflows on purpose. `.world`
    // states `min-block-size: 0` in `widgets/building-stage`, so left
    // shrinkable it has no content-based floor to be stopped at and would give
    // a long lesson's overflow straight back out of the house; the card's own
    // automatic minimum is the height of wrapping prose, which is very nearly
    // nothing. What an over-full column here has to do is scroll.
    expect(declaration(world, "flex", ".stagearea > .world")).toBe("0 0 auto");
    expect(declaration(ruleBody(".stagearea > .tutorial"), "flex", ".stagearea > .tutorial")).toBe(
      "0 0 auto",
    );
    // Two rules in `widgets/building-stage` that this column rests on, both
    // written for something else and so removable by someone with no reason to
    // look here: `.world` clips, which is what keeps a house wider than the
    // pane from drawing itself across the splitter and over the editor --
    // measured at 229px of level 7 on a 380px pane -- and `.stage` scrolls,
    // which is where that width goes instead.
    expect(ruleBody(".world")).toMatch(/^\s*overflow:\s*hidden;/m);
    expect(declaration(ruleBody(".stage"), "overflow", ".stage")).toBe("auto");
  });

  it("states the card's width once, with no threshold anywhere", () => {
    // 640px is the width of the widest thing a lesson holds: 68 characters of
    // 12px monospace in the longest answer, inside that block's padding,
    // `.tutorialsolution`'s margins and the card's own. The arithmetic is
    // written out at the rule; what matters here is that it is one number at
    // every width of pane, and centred rather than stretched.
    const card = ruleBody(".stagearea > .tutorial");
    expect(declaration(card, "inline-size", ".stagearea > .tutorial")).toBe(
      "min(640px, 100% - 32px)",
    );
    expect(declaration(card, "margin-inline", ".stagearea > .tutorial")).toBe("auto");
    // `inline-size` and not `max-inline-size`, which is how a centred card is
    // usually written and which would size this one from its own content
    // instead: auto margins on the cross axis stop a flex item stretching, so
    // a step whose prose is short would draw a narrower frame than the step
    // before it, and opening a hint would widen the card under the cursor.
    expect(card, "the card is sized by its own content again").not.toMatch(/^\s*max-inline-size/m);
    // No container query changing the layout below some width of pane: at the
    // shipped 62% split a 740px pane is a 1213px window, so a window merely a
    // little small, a browser at 125% zoom or a splitter nudged towards the
    // editor would each redraw the page as something else. One shape at every
    // width.
    expect(styleSource).not.toMatch(/container: stage\b/);
    expect(styleSource).not.toMatch(/@container stage\b/);
  });
});
