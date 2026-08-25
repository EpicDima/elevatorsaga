/**
 * The strip's own wiring, which fails silently rather than loudly: an
 * `@container` naming a container nobody opens does not error, it simply never
 * matches, and the wide layouts above it are then the only ones a narrow pane
 * ever gets.
 *
 * Whether a browser then draws the strip whole is `e2e/statistics-panel.spec.ts`.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("statistics strip", () => {
  it("measures the tile grids against the pane rather than the window", () => {
    // The figures are as wide as the game pane, and the splitter can take two
    // thirds of that away without the window changing by a pixel -- so the
    // two-column fallback the grids drop to has to be asked of the strip
    // itself. A `@media` query in its place would collapse the strip only
    // when the whole window narrowed, which on this page is the one thing
    // that cannot happen: `body.app` floors it at 1040px.
    expect(declaration(ruleBody(".statscontainer"), "container", ".statscontainer")).toBe(
      "panel / inline-size",
    );
    // Same name in the query as in the container, which is the whole of the
    // wiring: an `@container` naming something no ancestor opens does not
    // fail, it silently never matches, and the four- and three-column layouts
    // above it would then be the only ones a narrow pane ever got.
    expect(styleSource).toMatch(/^@container panel \(max-width: 520px\) \{$/m);
  });

  it("hangs the card on a panel it can leave through the top", () => {
    // Absolute against the panel, so the widget's own arithmetic is in the
    // panel's coordinates -- and the panel has to be what those coordinates
    // are measured from, or the card is placed against whatever positioned
    // ancestor happens to be above it.
    expect(declaration(ruleBody(".statspanel"), "position", ".statspanel")).toBe("relative");
    expect(declaration(ruleBody(".statcard"), "position", ".statcard")).toBe("absolute");
    // The card is taller than the strip and is drawn above it, so a panel that
    // clipped its own overflow would cut the card off at the figure it is
    // explaining.
    expect(ruleBody(".statspanel")).not.toMatch(/overflow/);
    expect(ruleBody(".statscontainer")).not.toMatch(/overflow/);
  });

  it("lets the pointer reach the card, unlike the building's", () => {
    // `.carcard` in `widgets/building-stage` is `pointer-events: none`, because
    // it is placed beside a shaft the pointer is standing in. This one stands
    // flush on top of its tile, so a pointer moving up to read it moves onto
    // it -- WCAG 1.4.13's "hoverable", which a card the pointer falls through
    // could not meet.
    expect(ruleBody(".statcard")).not.toMatch(/pointer-events/);
    // And the focus ring is drawn inside a tile: the grids are a hairline
    // apart, so the document's own outward offset would cross the neighbors.
    expect(
      declaration(ruleBody(".statspanel .tile:focus-visible"), "outline-offset", ".tile"),
    ).toBe("-2px");
  });
});
