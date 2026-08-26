/**
 * Which box gives way when the game pane runs short, in both axes.
 * These rules fail silently rather than loudly, so this file pins the layout
 * declarations directly.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("the game pane's column", () => {
  it("leaves the building the only row of the game pane that gives way", () => {
    // `.stagearea` is `flex: 1 1 auto` with a zero minimum, so a short pane
    // shrinks the stage (which scrolls) rather than the goal bar or figures.
    expect(styleSource).toMatch(
      /^\.pane-game > \.level,\n\.pane-game > \.statscontainer \{\n {2}flex: 0 0 auto;\n\}$/m,
    );
    const stageArea = ruleBody(".stagearea");
    expect(declaration(stageArea, "flex", ".stagearea")).toBe("1 1 auto");
    expect(declaration(stageArea, "min-block-size", ".stagearea")).toBe("0");
    expect(styleSource).not.toMatch(/\.pane-game > \.tutorial\b/);
  });

  it("scrolls the card and the building as one box, and only down the page", () => {
    const stageArea = ruleBody(".stagearea");
    expect(declaration(stageArea, "flex-direction", ".stagearea")).toBe("column");
    // `hidden auto`, not `auto`: the inline axis belongs to `.stage`, and a
    // `visible`/other pair is not honored, so leaving it unwritten computes
    // to a second scrollbar under the building.
    expect(declaration(stageArea, "overflow", ".stagearea")).toBe("hidden auto");
    // `stage-column.ts` makes the column a tab stop while it scrolls, and a
    // ring drawn outside it would be clipped by the pane's own edge.
    expect(declaration(ruleBody(".stagearea:focus-visible"), "outline-offset", "the column")).toBe(
      "-3px",
    );
    for (const selector of [".stagearea > .tutorial", ".tutorial"]) {
      const card = ruleBody(selector);
      expect(card, `${selector} scrolls inside itself again`).not.toMatch(/^\s*overflow/m);
      expect(card, `${selector} has a height ceiling again`).not.toMatch(/^\s*max-block-size/m);
    }
  });

  it("stands the building at its full height, however tall that is", () => {
    const world = ruleBody(".stagearea > .world");
    // A minimum, not a height: a house too tall for the pane must grow the
    // column and be scrolled to, not scroll inside itself. Neither does it
    // shrink, or a lesson with every disclosure open would take it down to
    // nothing instead of lengthening the column.
    expect(declaration(world, "min-block-size", ".stagearea > .world")).toBe("100%");
    expect(declaration(world, "flex", ".stagearea > .world")).toBe("0 0 auto");
    expect(world, "a tall house is boxed into the pane again").not.toMatch(/^\s*block-size/m);
    expect(declaration(ruleBody(".stagearea > .tutorial"), "flex", ".stagearea > .tutorial")).toBe(
      "0 0 auto",
    );
    // `.world` clips so a house wider than the pane doesn't draw over the
    // editor; `.stage` scrolls, absorbing that width instead. Only that width:
    // `auto` in the block axis is the second scrollbar all of this is against.
    expect(ruleBody(".world")).toMatch(/^\s*overflow:\s*hidden;/m);
    expect(declaration(ruleBody(".stage"), "overflow", ".stage")).toBe("auto hidden");
  });

  it("states the card's width once, with no threshold anywhere", () => {
    // 640px fits the widest thing a lesson holds: 68 characters of 12px
    // monospace plus its surrounding padding and margins.
    const card = ruleBody(".stagearea > .tutorial");
    expect(declaration(card, "inline-size", ".stagearea > .tutorial")).toBe(
      "min(640px, 100% - 32px)",
    );
    expect(declaration(card, "margin-inline", ".stagearea > .tutorial")).toBe("auto");
    // `inline-size`, not `max-inline-size`: auto margins stop a flex item
    // stretching, but only `inline-size` keeps the card's width from
    // following its own content.
    expect(card, "the card is sized by its own content again").not.toMatch(/^\s*max-inline-size/m);
    expect(styleSource).not.toMatch(/container: stage\b/);
    expect(styleSource).not.toMatch(/@container stage\b/);
  });
});
