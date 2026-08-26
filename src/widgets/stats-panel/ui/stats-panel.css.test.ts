/**
 * Tests the strip's container-query wiring, which fails silently rather than loudly: an
 * `@container` naming a container nobody opens simply never matches, leaving a narrow pane
 * stuck with the wide layouts above it.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("statistics strip", () => {
  it("measures the tile grids against the pane rather than the window", () => {
    // The splitter can narrow the pane without the window itself changing, so the two-column
    // fallback must query the strip's own width, not a `@media` query on the window.
    expect(declaration(ruleBody(".statscontainer"), "container", ".statscontainer")).toBe(
      "panel / inline-size",
    );
    // Container and query must share a name, or the query silently never matches.
    expect(styleSource).toMatch(/^@container panel \(max-width: 520px\) \{$/m);
  });

  it("hangs the card on a panel it can leave through the top", () => {
    // Absolute against the panel, so the card's placement math lands in the panel's own
    // coordinates rather than whatever positioned ancestor happens to be above it.
    expect(declaration(ruleBody(".statspanel"), "position", ".statspanel")).toBe("relative");
    expect(declaration(ruleBody(".statcard"), "position", ".statcard")).toBe("absolute");
    // The card is taller than the strip and drawn above it, so a clipped panel would cut it off.
    expect(ruleBody(".statspanel")).not.toMatch(/overflow/);
    expect(ruleBody(".statscontainer")).not.toMatch(/overflow/);
  });

  it("lets the pointer reach the card, unlike the building's", () => {
    // This card stands flush on top of its tile, so a pointer moving up to read it moves
    // onto it — WCAG 1.4.13's "hoverable", which a card the pointer fell through couldn't meet.
    expect(ruleBody(".statcard")).not.toMatch(/pointer-events/);
    // Drawn inside the tile: the grids sit a hairline apart, so the default outward ring
    // would cross into the neighbors.
    expect(
      declaration(ruleBody(".statspanel .tile:focus-visible"), "outline-offset", ".tile"),
    ).toBe("-2px");
  });
});
